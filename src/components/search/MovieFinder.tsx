
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

import { Input } from '@/components/ui/input';
import { Loader2, Search, Keyboard, Film, Star, Sparkles } from 'lucide-react';
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const urlQuery = searchParams.get('query') || '';

  const [query, setQuery] = useState(urlQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(!!urlQuery);
  const [recommendations, setRecommendations] = useState<SearchResult[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(true);
  
  const { toast } = useToast();
  const { firebaseUser, loading: authLoading } = useAuth();

  const [watched, setWatched] = useState<UserMovieData[]>([]);
  const [loadingWatched, setLoadingWatched] = useState(true);

  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
        setLoadingWatched(false);
        return;
    }
    const userDocRef = doc(db, 'users', firebaseUser.uid);
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
  }, [firebaseUser, authLoading]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    const fetchRecommendations = async () => {
      if (authLoading) return;
      setLoadingRecs(true);
      if (!firebaseUser) {
        // For guests, show trending movies
        try {
            const res = await fetch(`https://api.themoviedb.org/3/trending/all/week?api_key=${API_KEY}`, { signal });
            if (!res.ok) throw new Error('Could not fetch trending.');
            const data = await res.json();
            if (signal.aborted) return;
            const trendingItems = (data.results || [])
              .filter((item: any) => item.poster_path && (item.media_type === 'movie' || item.media_type === 'tv'))
              .slice(0, 10);
            setRecommendations(trendingItems);
        } catch (error) {
            if (!signal.aborted) setRecommendations([]);
        } finally {
            if (!signal.aborted) setLoadingRecs(false);
        }
        return;
      }
      
      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
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
              setLoadingRecs(false);
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

    if (query.trim().length === 0) {
      fetchRecommendations();
    } else {
      setLoadingRecs(false);
      setRecommendations([]);
    }

    return () => controller.abort();
  }, [query, firebaseUser, authLoading]);

  const searchMovies = useCallback(async (searchQuery: string) => {
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
        )}&include_adult=false`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.status_message || 'Failed to fetch from TMDB');
      }

      const data = await res.json();
      const sortedResults = (data.results || [])
        .filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
        .sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity);
      setResults(sortedResults);
    } catch (error: any) {
      console.error('Error fetching movie data:', error);
      toast({
        variant: 'destructive',
        title: 'Search Failed',
        description: error.message || 'Could not fetch movie data. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  

  useEffect(() => {
    if (urlQuery) {
        searchMovies(urlQuery);
    }
  }, [urlQuery, searchMovies]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (query) {
        params.set('query', query);
      } else {
        params.delete('query');
      }
      // Use replace to avoid adding to history on every keystroke
      router.replace(`${pathname}?${params.toString()}`);
      searchMovies(query);
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(debounceTimer);
    };
  }, [query, pathname, router, searchParams, searchMovies]);

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
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
    if (hasSearched) return null;

    if (loadingRecs || loadingWatched || authLoading) {
      return (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading great things for you...</p>
        </div>
      );
    }
    
    if (recommendations.length > 0) {
      return (
        <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-bold font-headline flex items-center gap-2"><Sparkles className="text-accent" /> {firebaseUser && !firebaseUser.isAnonymous ? "Recommended For You" : "Trending This Week"}</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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
      <div className="pt-16 text-center text-muted-foreground flex flex-col items-center gap-4">
        <Star className="h-16 w-16 text-accent/30" />
        <p className="text-lg font-medium text-foreground">Welcome to WatchMe!</p>
        <p className="max-w-md">Go to the Discover page to start rating movies and shows. Your ratings will help us recommend titles you'll love.</p>
      </div>
    );
  };

  const renderStatus = () => {
    if (!hasSearched) return null;

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
             <div className="pt-16 text-center text-muted-foreground flex flex-col items-center gap-4">
               <Keyboard className="h-16 w-16 text-muted-foreground/30" />
               <p className="text-lg font-medium text-foreground">Keep typing...</p>
               <p>Enter at least 3 characters to see results.</p>
             </div>
        );
    }
    
    if (hasSearched && !isLoading && results.length === 0 && trimmedQuery.length >= 3) {
      return (
         <div className="pt-16 text-center text-muted-foreground flex flex-col items-center gap-4">
            <Search className="h-16 w-16 text-muted-foreground/30" />
           <p className="text-lg font-medium text-foreground">No results found for &quot;{query}&quot;.</p>
           <p>Try a different search term.</p>
         </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full text-center max-w-2xl">
        <h1 className="text-4xl font-bold font-headline tracking-tight md:text-5xl">
          Find Movies & TV Shows
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Discover where to watch your favorite movies and series, get recommendations, and share them with friends.
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-2xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search for titles like 'Inception', 'The Office'..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-14 w-full rounded-full bg-card py-3 pl-12 pr-4 text-base shadow-lg shadow-black/20"
          />
        </div>
      </form>

      {renderRecommendations()}
      
      {hasSearched && !isLoading && results.length > 0 && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
           <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
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

      {renderStatus()}
    </div>
  );
}
