
'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

import { Input } from '@/components/ui/input';
import { Loader2, Search, Keyboard, Film, Star } from 'lucide-react';
import { MovieResultCard } from './MovieResultCard';

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
}

interface UserRatingData {
    movieId: string;
    mediaType: 'movie' | 'tv';
    rating: number;
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function MovieFinder() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recommendations, setRecommendations] = useState<SearchResult[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  
  const { toast } = useToast();
  const { user } = useAuth();

  const [watched, setWatched] = useState<UserMovieData[]>([]);
  const [loadingWatched, setLoadingWatched] = useState(true);

  useEffect(() => {
    if (!user) {
        setLoadingWatched(false);
        return;
    }
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            setWatched(doc.data().watchedMovies || []);
        }
        setLoadingWatched(false);
    }, (error) => {
        console.error("Error fetching watched list:", error);
        setLoadingWatched(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fetchRecommendations = async () => {
      setLoadingRecs(true);
      if (!user) {
        setLoadingRecs(false);
        return;
      }
      
      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (signal.aborted) return;

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const ratedMovies: UserRatingData[] = userData.ratedMovies || [];
          const highlyRated = ratedMovies.filter(r => r.rating >= 4);

          if (highlyRated.length > 0) {
            const seedMovie = highlyRated[Math.floor(Math.random() * highlyRated.length)];
            const res = await fetch(
              `https://api.themoviedb.org/3/${seedMovie.mediaType}/${seedMovie.movieId}/recommendations?api_key=${API_KEY}&language=en-US`,
              { signal }
            );
            if (signal.aborted || !res.ok) {
              setRecommendations([]);
              return;
            }
            const data = await res.json();
            if (signal.aborted) return;
            
            const recommendedItems = (data.results || [])
              .map((item: any) => ({ ...item, media_type: seedMovie.mediaType }))
              .filter((item: any) => item.poster_path)
              .sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity)
              .slice(0, 10);
            setRecommendations(recommendedItems);
          } else {
            setRecommendations([]);
          }
        }
      } catch (error) {
        if (!signal.aborted) {
          console.error("Failed to fetch recommendations:", error);
          setRecommendations([]);
        }
      } finally {
        if (!signal.aborted) {
          setLoadingRecs(false);
        }
      }
    };

    if (query.trim().length === 0 && !hasSearched) {
      fetchRecommendations();
    } else {
      setLoadingRecs(true);
      setRecommendations([]);
    }

    return () => controller.abort();
  }, [query, hasSearched, user]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const searchMovies = async (searchQuery: string) => {
      const trimmedQuery = searchQuery.trim();

      if (trimmedQuery.length === 0) {
        setResults([]);
        setHasSearched(false);
        setIsLoading(false);
        return;
      }
      
      setHasSearched(true);

      if (trimmedQuery.length < 3) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(
            trimmedQuery
          )}&include_adult=false`,
          { signal }
        );

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.status_message || 'Failed to fetch from TMDB');
        }

        const data = await res.json();
        if (!signal.aborted) {
          const sortedResults = (data.results || [])
            .filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
            .sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity);
          setResults(sortedResults);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }
        if (!signal.aborted) {
          console.error('Error fetching movie data:', error);
          toast({
            variant: 'destructive',
            title: 'Search Failed',
            description: error.message || 'Could not fetch movie data. Please try again.',
          });
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    const debounceTimer = setTimeout(() => {
      searchMovies(query);
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query, toast]);

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const movieIdentifier = { movieId: String(movieId), mediaType };

    try {
      if (isWatched) {
        await updateDoc(userDocRef, { watchedMovies: arrayUnion(movieIdentifier) });
      } else {
        await updateDoc(userDocRef, { watchedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      console.error("Toggle watched failed: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };

  const watchedIds = new Set(watched.map(item => item.movieId));

  const renderRecommendations = () => {
    if (query.trim().length > 0 || hasSearched) return null;

    if (loadingRecs || loadingWatched) {
      return (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading recommendations for you...</p>
        </div>
      );
    }
    
    if (recommendations.length > 0) {
      return (
        <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-bold font-headline">Recommended For You</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {recommendations.map((item) => (
                <MovieResultCard
                    key={item.id}
                    item={item}
                    isWatched={watchedIds.has(String(item.id))}
                    onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
                />
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
        <Star className="h-16 w-16" />
        <p className="text-lg">Welcome to Movie Finder!</p>
        <p className="text-sm">Go to the Discover page to rate movies and get personalized recommendations.</p>
      </div>
    );
  };

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Searching...</p>
        </div>
      );
    }

    const trimmedQuery = query.trim();
    if (hasSearched && trimmedQuery.length > 0 && trimmedQuery.length < 3) {
        return (
             <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
               <Keyboard className="h-16 w-16" />
               <p className="text-lg">Keep typing...</p>
               <p className="text-sm">Enter at least 3 characters to see results.</p>
             </div>
        );
    }
    
    if (hasSearched && !isLoading && results.length === 0 && trimmedQuery.length >= 3) {
      return (
         <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
            <Search className="h-16 w-16" />
           <p className="text-lg">No results found for &quot;{query}&quot;.</p>
           <p className="text-sm">Try a different search term.</p>
         </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full text-left sm:text-center">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
          Find Movies & TV Shows
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover where to watch your favorite movies and series.
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Start typing to search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full bg-card py-3 pl-10 pr-4 text-base shadow-sm"
          />
        </div>
      </form>

      {renderRecommendations()}
      {renderStatus()}

      {results.length > 0 && !isLoading && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {results.map((item) => (
                <MovieResultCard
                    key={item.id}
                    item={item}
                    isWatched={watchedIds.has(String(item.id))}
                    onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
                />
            ))}
           </div>
        </div>
      )}
    </div>
  );
}
