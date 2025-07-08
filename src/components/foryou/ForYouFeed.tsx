
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Film } from 'lucide-react';
import { MovieResultCard } from '@/components/search/MovieResultCard';
import { FilterControls, type Filters, type Genre, type Platform } from './FilterControls';
import { debounce } from 'lodash';

interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
  vote_average: number;
  popularity: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

interface UserRatingData extends UserMovieData {
  rating: number;
}


const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function ForYouFeed() {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [allGenres, setAllGenres] = useState<Genre[]>([]);
  const [allPlatforms, setAllPlatforms] = useState<Platform[]>([]);

  const [filters, setFilters] = useState<Filters>({
    genres: [],
    platforms: [],
    year: [1980, new Date().getFullYear()],
    hideWatched: true,
  });

  const [watched, setWatched] = useState<UserMovieData[]>([]);
  const [preferredGenreIds, setPreferredGenreIds] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  const fetchDiscoverData = useCallback(async (currentFilters: Filters, genrePrefs: string) => {
    setLoading(true);
    setMovies([]); // Clear previous results to show loading state correctly
    try {
        const genreQuery = currentFilters.genres.length > 0 
            ? currentFilters.genres.join(',')
            : genrePrefs;

        const urls = [
            `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1&watch_region=TR&with_genres=${genreQuery}&with_watch_providers=${currentFilters.platforms.join('|')}&primary_release_date.gte=${currentFilters.year[0]}-01-01&primary_release_date.lte=${currentFilters.year[1]}-12-31`,
            `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1&watch_region=TR&with_genres=${genreQuery}&with_watch_providers=${currentFilters.platforms.join('|')}&first_air_date.gte=${currentFilters.year[0]}-01-01&first_air_date.lte=${currentFilters.year[1]}-12-31`,
            `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=2&watch_region=TR&with_genres=${genreQuery}&with_watch_providers=${currentFilters.platforms.join('|')}&primary_release_date.gte=${currentFilters.year[0]}-01-01&primary_release_date.lte=${currentFilters.year[1]}-12-31`,
            `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=2&watch_region=TR&with_genres=${genreQuery}&with_watch_providers=${currentFilters.platforms.join('|')}&first_air_date.gte=${currentFilters.year[0]}-01-01&first_air_date.lte=${currentFilters.year[1]}-12-31`,
        ];

        const media_types = ['movie', 'tv', 'movie', 'tv'];

        // This keeps track of seen IDs to avoid duplicates in the UI
        const seenMovieIds = new Set<number>();

        const fetchPromises = urls.map((url, index) => 
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error(`TMDB API request failed with status ${res.status}`);
                    return res.json();
                })
                .then(data => {
                    const newMovies = (data.results || [])
                        .map((m: any) => ({ ...m, media_type: media_types[index] as 'movie' | 'tv' }))
                        .filter((item: Movie) => item.poster_path);
                    
                    // Filter out duplicates before adding
                    const uniqueNewMovies = newMovies.filter((m: Movie) => {
                        if (seenMovieIds.has(m.id)) {
                            return false;
                        }
                        seenMovieIds.add(m.id);
                        return true;
                    });

                    if (uniqueNewMovies.length > 0) {
                        setMovies(prevMovies => [...prevMovies, ...uniqueNewMovies].sort((a, b) => b.popularity - a.popularity));
                    }
                })
                .catch(error => {
                    // Don't show a toast for every failed page, just log it.
                    console.error("Error fetching a page of recommendations:", error);
                })
        );
        
        // Wait for all fetches to complete to turn off the main loading spinner
        await Promise.all(fetchPromises);

    } catch (error) {
      console.error("Error setting up discover feed fetch:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load movies.' });
      setMovies([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Debounced version of fetchDiscoverData
  const debouncedFetch = useCallback(debounce(fetchDiscoverData, 500), [fetchDiscoverData]);


  useEffect(() => {
    if (!loadingProfile) {
        debouncedFetch(filters, preferredGenreIds);
    }
  }, [filters, debouncedFetch, loadingProfile, preferredGenreIds]);

  // Fetch genres and platforms for filter controls
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const movieGenresRes = await fetch(`https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}`);
        const tvGenresRes = await fetch(`https://api.themoviedb.org/3/genre/tv/list?api_key=${API_KEY}`);
        const providersRes = await fetch(`https://api.themoviedb.org/3/watch/providers/movie?api_key=${API_KEY}&watch_region=TR`);

        const movieGenres = await movieGenresRes.json();
        const tvGenres = await tvGenresRes.json();
        const providersData = await providersRes.json();

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

  // Fetch user profile data to personalize the feed
  useEffect(() => {
    if (!firebaseUser) {
        setLoadingProfile(false);
        return;
    }
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        setLoadingProfile(true);
        try {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setWatched(data.watchedMovies || []);

                const ratings: UserRatingData[] = data.ratedMovies || [];
                const highlyRated = ratings.filter(r => r.rating >= 4)
                                         .sort((a, b) => b.rating - a.rating)
                                         .slice(0, 5);
                
                if (highlyRated.length > 0) {
                     const genreDetailsPromises = highlyRated.map(m => 
                        fetch(`https://api.themoviedb.org/3/${m.mediaType}/${m.movieId}?api_key=${API_KEY}`)
                            .then(res => res.ok ? res.json() : Promise.resolve({ genres: [] }))
                            .then(details => details.genres?.map((g: Genre) => g.id) || [])
                     );
                     const genreIdArrays = await Promise.all(genreDetailsPromises);
                     const uniqueGenreIds = [...new Set(genreIdArrays.flat())];
                     setPreferredGenreIds(uniqueGenreIds.join('|'));
                } else {
                     setPreferredGenreIds('');
                }
            }
        } catch (error) {
            console.error("Error processing user profile:", error);
        } finally {
            setLoadingProfile(false);
        }
    });
    return () => unsubscribe();
  }, [firebaseUser]);

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!firebaseUser) return;
    const movieIdentifier = { movieId: String(movieId), mediaType };
    
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      const currentWatched = userDoc.data()?.watchedMovies || [];
      
      let updatedWatched;
      const movieExists = currentWatched.some((m: any) => m.movieId === String(movieId) && m.mediaType === mediaType);

      if (isWatched) {
        if (!movieExists) {
            updatedWatched = [...currentWatched, movieIdentifier];
        } else {
            updatedWatched = currentWatched;
        }
      } else {
        updatedWatched = currentWatched.filter((m: any) => m.movieId !== String(movieId) || m.mediaType !== mediaType);
      }
      
      await setDoc(userDocRef, { watchedMovies: updatedWatched }, { merge: true });

    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };
  
  const watchedIds = new Set(watched.map(item => String(item.movieId)));
  const filteredMovies = filters.hideWatched
    ? movies.filter(movie => !watchedIds.has(String(movie.id)))
    : movies;

  return (
    <div className="space-y-8">
      <div className="text-left sm:text-center">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
          For You
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover movies and shows tailored to your taste.
        </p>
      </div>

      <FilterControls
        allGenres={allGenres}
        allPlatforms={allPlatforms}
        filters={filters}
        onFilterChange={setFilters}
        loading={loading || loadingProfile}
      />
      
      {/* Initial loading spinner, shown only when no movies are loaded yet */}
      {(loading || loadingProfile) && filteredMovies.length === 0 && (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Loading recommendations...</p>
        </div>
      )}

      {/* No results message */}
      {!(loading || loadingProfile) && filteredMovies.length === 0 && (
        <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
            <Film className="h-16 w-16" />
            <p className="text-lg">No Results Found</p>
            <p className="text-sm">Try adjusting your filters to find more titles.</p>
        </div>
      )}

      {/* Movie grid, shown as soon as there's at least one movie */}
      {filteredMovies.length > 0 && (
        <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredMovies.map((item) => (
                <MovieResultCard
                key={item.id}
                item={item}
                isWatched={watchedIds.has(String(item.id))}
                onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
                />
            ))}
            </div>
            {/* "Loading more" spinner shown at the bottom while still fetching */}
            {(loading || loadingProfile) && (
                <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p>Loading more...</p>
                </div>
            )}
        </>
      )}
    </div>
  );
}
