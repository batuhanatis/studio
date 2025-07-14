
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useRouter, useSearchParams } from 'next/navigation';
import { debounce } from 'lodash';

import { Input } from '@/components/ui/input';
import { Loader2, Search, Filter, X, RefreshCw } from 'lucide-react';
import { MovieResultCard } from './MovieResultCard';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { getWatchlistRecommendations } from '@/ai/flows/watchlist-recommendations';

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
  origin_country?: string[];
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
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

interface Country {
  iso_3166_1: string;
  english_name: string;
}

interface Filters {
  genres: number[];
  platforms: number[];
  countries: string[];
  year: [number, number];
  hideInteracted: boolean;
  mediaType: 'all' | 'movie' | 'tv';
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';
const RESULTS_PER_PAGE = 10;

export function MovieFinder() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlQuery = searchParams.get('query') || '';

  const [query, setQuery] = useState(urlQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [visibleResultsCount, setVisibleResultsCount] = useState(RESULTS_PER_PAGE);
  
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);
  const [allCountries, setAllCountries] = useState<Country[]>([]);

  const [filters, setFilters] = useState<Filters>({
    genres: [],
    platforms: [],
    countries: [],
    year: [1980, new Date().getFullYear()],
    hideInteracted: true,
    mediaType: 'all',
  });
  
  const { toast } = useToast();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [liked, setLiked] = useState<UserMovieData[]>([]);
  const [disliked, setDisliked] = useState<UserMovieData[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const initialFetchDone = useRef(false);

  // User data listener
  useEffect(() => {
    if (authLoading || !firebaseUser) {
      setLoadingUserData(false);
      return;
    }
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLiked(data.likedMovies || []);
        setDisliked(data.dislikedMovies || []);
      }
      setLoadingUserData(false);
    }, (err) => {
      console.error("Error fetching user data:", err);
      setLoadingUserData(false);
    });
    return () => unsubscribe();
  }, [firebaseUser, authLoading]);

  // Fetch genres, platforms, and countries for filter controls
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [movieGenresRes, tvGenresRes, providersRes, countriesRes] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}`),
          fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${API_KEY}`),
          fetch(`https://api.themoviedb.org/3/watch/providers/movie?api_key=${API_KEY}&watch_region=TR`),
          fetch(`https://api.themoviedb.org/3/configuration/countries?api_key=${API_KEY}`)
        ]);

        const [movieGenres, tvGenres, providersData, countriesData] = await Promise.all([
          movieGenresRes.json(),
          tvGenresRes.json(),
          providersRes.json(),
          countriesRes.json()
        ]);
        
        const combinedGenres = [...(movieGenres.genres || []), ...(tvGenres.genres || [])];
        const uniqueGenres = Array.from(new Map(combinedGenres.map(g => [g.id, g])).values());
        
        setAllGenres(uniqueGenres);
        setAllPlatforms((providersData.results || []).sort((a:Platform, b:Platform) => a.provider_name.localeCompare(b.provider_name)));
        setAllCountries((countriesData || []).sort((a:Country, b:Country) => a.english_name.localeCompare(b.english_name)));
      } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load filter options.' });
      }
    };
    fetchFilterOptions();
  }, [toast]);
  
  const fetchGenericDiscoverData = useCallback(async (currentFilters: Filters) => {
    const genreQuery = currentFilters.genres.join(',');
    const countryQuery = currentFilters.countries.join(',');
    const mediaTypePath = currentFilters.mediaType === 'all' ? 'trending/all/week' : `discover/${currentFilters.mediaType}`;
    const page = Math.floor(Math.random() * 20) + 1;

    let discoverUrl;
    if (currentFilters.mediaType === 'all') {
        discoverUrl = `https://api.themoviedb.org/3/${mediaTypePath}?api_key=${API_KEY}&language=en-US&page=${page}`;
    } else {
        const dateParam = currentFilters.mediaType === 'movie' ? 'primary_release_date' : 'first_air_date';
        const params = new URLSearchParams({
            api_key: API_KEY,
            language: 'en-US',
            sort_by: 'popularity.desc',
            include_adult: 'false',
            page: String(page),
            watch_region: 'TR',
            [`${dateParam}.gte`]: `${currentFilters.year[0]}-01-01`,
            [`${dateParam}.lte`]: `${currentFilters.year[1]}-12-31`,
        });
        if (genreQuery) params.set('with_genres', genreQuery);
        if (currentFilters.platforms.length > 0) params.set('with_watch_providers', currentFilters.platforms.join('|'));
        if (countryQuery) params.set('with_origin_country', countryQuery);
        
        discoverUrl = `https://api.themoviedb.org/3/${mediaTypePath}?${params.toString()}`;
    }


    const res = await fetch(discoverUrl);
    if (!res.ok) throw new Error('Failed to fetch from TMDB');
    const data = await res.json();
    
    return (data.results || [])
        .filter((item: any) => item.poster_path)
        .map((item: any) => ({ ...item, media_type: item.media_type || currentFilters.mediaType }));
  }, []);

  const searchMovieByTitle = useCallback(async (title: string): Promise<SearchResult | null> => {
     try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(title)}`);
        if (!res.ok) return null;
        const data = await res.json();
        const result = (data.results || []).find((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);
        return result || null;
     } catch {
        return null;
     }
  }, []);

  const fetchAiDiscoverData = useCallback(async (userLikedMovies: UserMovieData[]) => {
    try {
        const movieTitles = userLikedMovies.map(m => m.title);
        const result = await getWatchlistRecommendations({ movieTitles });
        
        if (!result || result.recommendedTitles.length === 0) {
            return [];
        }
        
        const moviePromises = result.recommendedTitles.map(title => searchMovieByTitle(title));
        const movies = (await Promise.all(moviePromises)).filter((m): m is SearchResult => m !== null);
        
        return Array.from(new Map(movies.map(m => [m.id, m])).values());
    } catch (err: any) {
        toast({ variant: 'destructive', title: 'AI Error', description: err.message || 'Could not get AI recommendations.' });
        return [];
    }
  }, [searchMovieByTitle, toast]);
  
  const fetchDiscoverData = useCallback(async (currentFilters: Filters, userLikedMovies: UserMovieData[]) => {
    setIsLoading(true);
    setHasSearched(false);
    setVisibleResultsCount(RESULTS_PER_PAGE);
    try {
        let items: SearchResult[];
        if (userLikedMovies.length > 5 && currentFilters.genres.length === 0 && currentFilters.countries.length === 0) {
            items = await fetchAiDiscoverData(userLikedMovies);
        } else {
            items = await fetchGenericDiscoverData(currentFilters);
        }
        
        setResults(items);

    } catch (error: any) {
        console.error("Error fetching recommendations:", error);
        toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not load recommendations.' });
        setResults([]);
    } finally {
        setIsLoading(false);
    }
  }, [toast, fetchAiDiscoverData, fetchGenericDiscoverData]);

  const searchMovies = useCallback(async (searchQuery: string, currentFilters: Filters) => {
    const trimmedQuery = searchQuery.trim();
    if (!trimmedQuery) {
        fetchDiscoverData(currentFilters, liked);
        return;
    }
    
    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    
    const mediaTypePath = currentFilters.mediaType === 'all' ? 'multi' : currentFilters.mediaType;

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/${mediaTypePath}?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(
          trimmedQuery
        )}&include_adult=false`
      );
      if (!res.ok) throw new Error('Failed to fetch search results');
      const data = await res.json();
      
      const filteredByGenre = (data.results || [])
        .filter((item: SearchResult) => 
            item.poster_path &&
            (!currentFilters.genres.length || (item.genre_ids && currentFilters.genres.every(g => item.genre_ids?.includes(g))))
        );
      
      const finalResults = filteredByGenre.sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity);
        
      setResults(finalResults);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Search Failed', description: error.message });
        setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast, liked, fetchDiscoverData]);

  const debouncedSearch = useRef(
    debounce((q: string, f: Filters) => {
      const newParams = new URLSearchParams(window.location.search);
      if (q) {
        newParams.set('query', q);
      } else {
        newParams.delete('query');
      }
      router.replace(`${window.location.pathname}?${newParams.toString()}`, { scroll: false });
      searchMovies(q, f);
    }, 300)
  ).current;

  useEffect(() => {
    return () => {
      debouncedSearch.cancel();
    };
  }, [debouncedSearch]);


  useEffect(() => {
    setQuery(urlQuery);
    if (loadingUserData) return;
    
    if (!initialFetchDone.current) {
        if (urlQuery) {
            searchMovies(urlQuery, filters);
        } else {
            fetchDiscoverData(filters, liked);
        }
        initialFetchDone.current = true;
    }

  }, [urlQuery, filters, loadingUserData, liked, searchMovies, fetchDiscoverData]);

  const handleFilterChange = (newFilters: Partial<Filters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    if (urlQuery) {
        searchMovies(urlQuery, updatedFilters);
    } else {
        fetchDiscoverData(updatedFilters, liked);
    }
  };
  
  const resetFilters = () => {
    const newFilters = {
        genres: [],
        platforms: [],
        countries: [],
        year: [1980, new Date().getFullYear()],
        mediaType: 'all'
    };
    handleFilterChange(newFilters);
  }
  
  const handleRefresh = useCallback(() => {
    if (!loadingUserData && !isLoading) {
      fetchDiscoverData(filters, liked);
    }
  }, [loadingUserData, isLoading, fetchDiscoverData, filters, liked]);


  const activeFilterCount = filters.genres.length + filters.platforms.length + filters.countries.length + (filters.mediaType !== 'all' ? 1 : 0);
  const likedIds = new Set(liked.map(item => `${item.movieId}-${item.mediaType}`));
  const dislikedIds = new Set(disliked.map(item => `${item.movieId}-${item.mediaType}`));
  
  let finalResults = results;
  if(filters.hideInteracted) {
    finalResults = finalResults.filter(movie => !likedIds.has(`${movie.id}-${movie.media_type}`) && !dislikedIds.has(`${movie.id}-${movie.media_type}`));
  }
  
  const visibleResults = finalResults.slice(0, visibleResultsCount);


  const renderStatus = () => {
    if (isLoading || (authLoading && loadingUserData)) {
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
    
    if (visibleResults.length === 0 && (hasSearched || filters.countries.length > 0 || filters.genres.length > 0)) {
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
        <h1 className="text-3xl md:text-5xl font-bold font-headline tracking-tight text-center">
          Find Your Next Watch
        </h1>
        <p className="mt-4 text-md md:text-lg text-muted-foreground text-center">
          Search for titles or browse recommendations tailored to your taste.
        </p>
      </div>
      
      <div className="w-full max-w-3xl space-y-4">
        <form onSubmit={(e) => {e.preventDefault(); debouncedSearch(query, filters);}} className="w-full">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search titles like 'Inception' or browse recommendations below..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                debouncedSearch(e.target.value, filters);
              }}
              className="h-14 w-full rounded-full bg-card py-3 pl-12 pr-4 text-base shadow-lg shadow-black/20 md:text-sm"
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
                                <Label>Yapım Yeri Ülke <span className="text-xs text-muted-foreground">(sadece keşfet)</span></Label>
                                <ScrollArea className="h-40 rounded-md border p-2">
                                    {allCountries.map((c) => (
                                    <div key={c.iso_3166_1} className="flex items-center space-x-2 py-1">
                                        <Checkbox id={`country-${c.iso_3166_1}`} checked={filters.countries.includes(c.iso_3166_1)} onCheckedChange={(checked) => handleFilterChange({ countries: checked ? [...filters.countries, c.iso_3166_1] : filters.countries.filter(id => id !== c.iso_3166_1) })} />
                                        <Label htmlFor={`country-${c.iso_3166_1}`} className="font-normal">{c.english_name}</Label>
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
                <Switch id="hide-interacted" checked={filters.hideInteracted} onCheckedChange={(checked) => handleFilterChange({ hideInteracted: checked })} disabled={isLoading} />
                <Label htmlFor="hide-interacted">Hide Liked/Disliked</Label>
            </div>
        </div>
      </div>
      
      <Separator />

      {!urlQuery && (
        <div className="w-full text-right">
            <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Recommendations
            </Button>
        </div>
      )}

      {visibleResults.length > 0 && (
         <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {visibleResults.map((item) => (
                    <MovieResultCard
                        key={`${item.id}-${item.media_type}`}
                        item={item}
                        isLiked={likedIds.has(`${item.id}-${item.media_type}`)}
                        isDisliked={dislikedIds.has(`${item.id}-${item.media_type}`)}
                    />
                ))}
            </div>
         </div>
      )}
      
      {finalResults.length > visibleResultsCount && (
        <div className="mt-6">
            <Button onClick={() => setVisibleResultsCount(prev => prev + RESULTS_PER_PAGE)} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Load More'}
            </Button>
        </div>
      )}


      {renderStatus()}
    </div>
  );
}

    