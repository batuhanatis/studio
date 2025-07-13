
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { debounce } from 'lodash';

import { Input } from '@/components/ui/input';
import { Loader2, Search, Film, Filter, X, Tv, RefreshCw } from 'lucide-react';
import { MovieResultCard } from './MovieResultCard';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
  vote_average: number;
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

interface LikedMovieData extends UserMovieData {
  title: string;
  poster: string | null;
}

interface Genre {
  id: number;
  name: string;
}

interface Platform {
  provider_id: number;
  provider_name: string;
}

interface Filters {
  genres: number[];
  platforms: number[];
  year: [number, number];
  hideWatched: boolean;
  mediaType: 'all' | 'movie' | 'tv';
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function MovieFinder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlQuery = searchParams.get('query') || '';

  const [query, setQuery] = useState(urlQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!urlQuery);
  
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);

  const [filters, setFilters] = useState<Filters>({
    genres: [],
    platforms: [],
    year: [1980, new Date().getFullYear()],
    hideWatched: true,
    mediaType: 'all',
  });
  
  const [refreshCount, setRefreshCount] = useState(0);

  const { toast } = useToast();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [watched, setWatched] = useState<UserMovieData[]>([]);
  const [loadingWatched, setLoadingWatched] = useState(true);
  const [preferredGenreIds, setPreferredGenreIds] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    setQuery(urlQuery);
    if(urlQuery) {
        setHasSearched(true);
    }
  }, [urlQuery]);

  // User data listener
  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
        setLoadingWatched(false);
        setLoadingProfile(false);
        return;
    }
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWatched(data.watchedMovies || []);
        
        const likedMovies: LikedMovieData[] = data.likedMovies || [];
        
        if (likedMovies.length > 0) {
            const genreDetailsPromises = likedMovies.slice(0, 5).map(m => 
                fetch(`https://api.themoviedb.org/3/${m.mediaType}/${m.movieId}?api_key=${API_KEY}`)
                    .then(res => res.ok ? res.json() : Promise.resolve({ genres: [] }))
                    .then(details => details.genres?.map((g: Genre) => g.id) || [])
            );
            const genreIdArrays = await Promise.all(genreDetailsPromises);
            const uniqueGenreIds = [...new Set(genreIdArrays.flat())];
            setPreferredGenreIds(uniqueGenreIds.join('|'));
        }
      }
      setLoadingWatched(false);
      setLoadingProfile(false);
    });
    return () => unsubscribe();
  }, [firebaseUser, authLoading]);

  // Fetch genres and platforms for filter controls
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [movieGenresRes, tvGenresRes, providersRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}`),
          fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${API_KEY}`),
          fetch(`https://api.themoviedb.org/3/watch/providers/movie?api_key=${API_KEY}&watch_region=TR`)
        ]);

        const [movieGenres, tvGenres, providersData] = await Promise.all([
          movieGenresRes.json(),
          tvGenresRes.json(),
          providersRes.json()
        ]);
        
        const combinedGenres = [...(movieGenres.genres || []), ...(tvGenres.genres || [])];
        const uniqueGenres = Array.from(new Map(combinedGenres.map(g => [g.id, g])).values());
        
        setAllGenres(uniqueGenres);
        setAllPlatforms((providersData.results || []).sort((a:Platform, b:Platform) => a.provider_name.localeCompare(b.provider_name)));
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load filter options.' });
      }
    };
    fetchFilterOptions();
  }, [toast]);
  
  const fetchDiscoverData = useCallback(async (currentFilters: Filters, genrePrefs: string, currentResults: SearchResult[] = []) => {
    setIsLoading(true);
    try {
        const genreQuery = currentFilters.genres.length > 0 
            ? currentFilters.genres.join(',')
            : genrePrefs;
        
        const mediaTypePath = currentFilters.mediaType === 'all' ? 'trending/all/week' : `discover/${currentFilters.mediaType}`;
        const page = Math.floor(Math.random() * 20) + 1;

        const discoverUrl = currentFilters.mediaType === 'all'
            ? `https://api.themoviedb.org/3/${mediaTypePath}?api_key=${API_KEY}&language=en-US&page=${page}`
            : `https://api.themoviedb.org/3/${mediaTypePath}?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=${page}&watch_region=TR&with_genres=${genreQuery}&with_watch_providers=${currentFilters.platforms.join('|')}&${currentFilters.mediaType === 'movie' ? 'primary_release_date' : 'first_air_date'}.gte=${currentFilters.year[0]}-01-01&${currentFilters.mediaType === 'movie' ? 'primary_release_date' : 'first_air_date'}.lte=${currentFilters.year[1]}-12-31`;

        const res = await fetch(discoverUrl);
        if (!res.ok) throw new Error('Failed to fetch from TMDB');
        const data = await res.json();
        
        const currentResultIds = new Set(currentResults.map(r => r.id));
        const items = (data.results || [])
            .filter((item: any) => item.poster_path && !currentResultIds.has(item.id))
            .map((item: any) => ({ ...item, media_type: item.media_type || currentFilters.mediaType }));
        
        setResults(items); 

    } catch (error: any) {
        console.error("Error fetching recommendations:", error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not load recommendations.' });
        setResults([]);
    } finally {
        setIsLoading(false);
    }
  }, [toast]);
  
  const searchMovies = useCallback(async (searchQuery: string, currentFilters: Filters) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
        setHasSearched(false);
        fetchDiscoverData(currentFilters, preferredGenreIds, []);
        return;
    }
    
    setHasSearched(true);
    
    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    const mediaTypePath = currentFilters.mediaType === 'all' ? 'multi' : currentFilters.mediaType;

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${mediaTypePath}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(
          trimmedQuery
        )}&include_adult=false`
      );
      if (!res.ok) throw new Error('Failed to fetch search results');
      const data = await res.json();
      
      const filteredResults = (data.results || [])
        .filter((item: SearchResult) => 
            item.poster_path &&
            (!currentFilters.genres.length || (item.genre_ids && currentFilters.genres.every(g => item.genre_ids?.includes(g))))
        )
        .sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity);

      setResults(filteredResults);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Search Failed', description: error.message });
        setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, fetchDiscoverData, preferredGenreIds]);

  const debouncedSearch = useCallback(debounce((q: string, f: Filters) => searchMovies(q, f), 500), [searchMovies]);

  // Effect for handling search query changes
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams.toString());
    if (query) {
      newParams.set('query', query);
    } else {
      newParams.delete('query');
    }
    router.replace(`${pathname}?${newParams.toString()}`, { scroll: false });
    
    debouncedSearch(query, filters);
  }, [query, filters, router, pathname, searchParams, debouncedSearch]);

  // Effect for initial load of recommendations when search is empty
  useEffect(() => {
    if (!query && !hasSearched && !loadingProfile) {
      fetchDiscoverData(filters, preferredGenreIds, []);
    }
  }, [query, hasSearched, filters, preferredGenreIds, fetchDiscoverData, loadingProfile]);
  
  // Effect for the refresh button
  useEffect(() => {
    if (refreshCount > 0) {
      fetchDiscoverData(filters, preferredGenreIds, results);
    }
  }, [refreshCount, fetchDiscoverData, filters, preferredGenreIds, results]);

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieData = results.find(r => r.id === movieId && r.media_type === mediaType);
    if(!movieData) return;

    const movieIdentifier = { 
        movieId: String(movieId), 
        mediaType: mediaType,
        title: movieData.title || movieData.name,
        poster: movieData.poster_path
    };

    try {
      if (isWatched) {
        await updateDoc(userDocRef, { watchedMovies: arrayUnion(movieIdentifier) });
      } else {
        await updateDoc(userDocRef, { watchedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };
  
  const resetFilters = () => {
    handleFilterChange({
        genres: [],
        platforms: [],
        year: [1980, new Date().getFullYear()],
        mediaType: 'all'
    });
  }

  const activeFilterCount = filters.genres.length + filters.platforms.length + (filters.mediaType !== 'all' ? 1 : 0);
  const watchedIds = new Set(watched.map(item => String(item.movieId)));
  
  const displayedResults = filters.hideWatched
    ? results.filter(movie => !watchedIds.has(String(movie.id)))
    : results;

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>{query ? 'Searching...' : 'Loading recommendations...'}</p>
        </div>
      );
    }

    if (query && query.length > 0 && query.length < 2) {
      return (
        <div className="pt-16 text-center text-muted-foreground flex flex-col items-center gap-4">
          <p className="text-lg font-medium text-foreground">Keep typing...</p>
          <p>Enter at least 2 characters to search.</p>
        </div>
      );
    }
    
    if (hasSearched && displayedResults.length === 0) {
      return (
        <div className="pt-16 text-center text-muted-foreground flex flex-col items-center gap-4">
          <Search className="h-16 w-16 text-muted-foreground/30" />
          <p className="text-lg font-medium text-foreground">No results found.</p>
          <p>Try adjusting your search or filters.</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full text-center max-w-3xl">
        <h1 className="text-4xl font-bold font-headline tracking-tight text-center md:text-5xl">
          Find Your Next Watch
        </h1>
        <p className="mt-4 text-lg text-muted-foreground text-center">
          Search for titles or browse recommendations tailored to your taste.
        </p>
      </div>
      
      <div className="w-full max-w-3xl space-y-4">
        <form onSubmit={(e) => {e.preventDefault(); searchMovies(query, filters)}} className="w-full">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search titles like 'Inception' or browse recommendations below..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-14 w-full rounded-full bg-card py-3 pl-12 pr-4 text-base shadow-lg shadow-black/20"
            />
          </div>
        </form>
        
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" disabled={isLoading}>
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {activeFilterCount}
                        </span>
                    )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80" align="start">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Filters</h4>
                            <p className="text-sm text-muted-foreground">Adjust your results.</p>
                        </div>
                        <div className="grid gap-6">
                            <div>
                                <Label>Media Type</Label>
                                <div className="flex items-center space-x-2 mt-2">
                                    <Button variant={filters.mediaType === 'all' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange({ mediaType: 'all' })}>All</Button>
                                    <Button variant={filters.mediaType === 'movie' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange({ mediaType: 'movie' })}>Movies</Button>
                                    <Button variant={filters.mediaType === 'tv' ? 'secondary' : 'ghost'} size="sm" onClick={() => handleFilterChange({ mediaType: 'tv' })}>TV</Button>
                                </div>
                            </div>
                            <div className="grid gap-3">
                                <Label>Genre</Label>
                                <ScrollArea className="h-40 rounded-md border p-2">
                                    {allGenres.map((genre) => (
                                    <div key={genre.id} className="flex items-center space-x-2 py-1">
                                        <Checkbox id={`genre-${genre.id}`} checked={filters.genres.includes(genre.id)} onCheckedChange={(checked) => handleFilterChange({ genres: checked ? [...filters.genres, genre.id] : filters.genres.filter(id => id !== genre.id) })} />
                                        <Label htmlFor={`genre-${genre.id}`} className="font-normal">{genre.name}</Label>
                                    </div>
                                    ))}
                                </ScrollArea>
                            </div>
                            <div className="grid gap-3">
                                <Label>Streaming On</Label>
                                <ScrollArea className="h-40 rounded-md border p-2">
                                    {allPlatforms.map((p) => (
                                    <div key={p.provider_id} className="flex items-center space-x-2 py-1">
                                        <Checkbox id={`platform-${p.provider_id}`} checked={filters.platforms.includes(p.provider_id)} onCheckedChange={(checked) => handleFilterChange({ platforms: checked ? [...filters.platforms, p.provider_id] : filters.platforms.filter(id => id !== p.provider_id) })} />
                                        <Label htmlFor={`platform-${p.provider_id}`} className="font-normal">{p.provider_name}</Label>
                                    </div>
                                    ))}
                                </ScrollArea>
                            </div>
                             <div className="grid gap-3">
                                <Label>Release Year: {filters.year[0]} - {filters.year[1]}</Label>
                                <Slider value={filters.year} onValueChange={(value) => handleFilterChange({ year: value as [number, number] })} min={1950} max={new Date().getFullYear()} step={1} />
                            </div>
                        </div>
                        {activeFilterCount > 0 && <Button variant="ghost" size="sm" onClick={resetFilters}><X className="mr-2 h-4 w-4" /> Reset Filters</Button>}
                    </div>
                </PopoverContent>
            </Popover>

            <div className="flex items-center space-x-2">
                <Switch id="hide-watched" checked={filters.hideWatched} onCheckedChange={(checked) => handleFilterChange({ hideWatched: checked })} disabled={isLoading} />
                <Label htmlFor="hide-watched">Hide Watched</Label>
            </div>
        </div>
      </div>
      
      <Separator />

      {!hasSearched && !isLoading && (
        <div className="w-full text-right">
            <Button variant="outline" onClick={() => setRefreshCount(c => c + 1)} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Recommendations
            </Button>
        </div>
      )}

      {displayedResults.length > 0 && (
         <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {displayedResults.map((item) => (
                    <MovieResultCard
                        key={`${item.id}-${item.media_type}`}
                        item={item}
                        isWatched={watchedIds.has(String(item.id))}
                        onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
                    />
                ))}
            </div>
         </div>
      )}

      {renderStatus()}
    </div>
  );
}
