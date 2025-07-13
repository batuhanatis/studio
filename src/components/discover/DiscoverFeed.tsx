'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, updateDoc, arrayUnion, arrayRemove, onSnapshot, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Heart, X as XIcon, RefreshCw, Loader2, Undo } from 'lucide-react';
import TinderCard from 'react-tinder-card';
import { DiscoverCard } from './DiscoverCard';
import { Button } from '@/components/ui/button';

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

interface Movie {
  id: number;
  media_type: 'movie' | 'tv';
  title?: string;
  name?: string;
  poster_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

interface UserRatingData extends UserMovieData {
  rating: number;
  title: string;
  poster: string | null;
}

export function DiscoverFeed() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userRatings, setUserRatings] = useState<UserRatingData[]>([]);
  const [userWatched, setUserWatched] = useState<UserMovieData[]>([]);
  
  const [lastSwipedMovie, setLastSwipedMovie] = useState<Movie | null>(null);

  const tinderCardRef = useRef<any>(null);

  const fetchMovies = useCallback(async (isRestart = false, genreSeed: string | null = null) => {
    if (authLoading) return;
    setLoading(true);

    let seenMovieIds = new Set();
    if (firebaseUser && !isRestart) {
        try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                const rated = data.ratedMovies || [];
                const watched = data.watchedMovies || [];
                seenMovieIds = new Set([...rated.map((m: any) => m.movieId), ...watched.map((m: any) => m.movieId)]);
            }
        } catch {}
    }

    try {
      const page = Math.floor(Math.random() * 10) + 1; // Fetch from a random page for variety
      const genreQuery = genreSeed ? `&with_genres=${genreSeed}` : '';
      const movieReq = fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&page=${page}${genreQuery}`);
      const tvReq = fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&page=${page}${genreQuery}`);
      
      const [movieRes, tvRes] = await Promise.all([movieReq, tvReq]);
      const [moviesJson, tvJson] = await Promise.all([movieRes.json(), tvRes.json()]);

      const allResults = [
        ...(moviesJson.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
        ...(tvJson.results || []).map((t: any) => ({ ...t, media_type: 'tv' }))
      ];
      
      const unique = Array.from(new Map(allResults.map(m => [m.id, m])).values())
                        .filter(m => m.poster_path && m.overview);
      
      const filtered = unique.filter(m => !seenMovieIds.has(String(m.id)));
      
      const shuffled = (filtered.length > 5 ? filtered : unique).sort(() => 0.5 - Math.random());
      
      setMovies(prev => isRestart ? shuffled.slice(0, 5) : [...prev, ...shuffled.slice(0, 5)]);

    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load movies.' });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [firebaseUser, toast, authLoading]);

  // Initial fetch
  useEffect(() => {
    fetchMovies(true);
  }, [fetchMovies]);

  // User data listener
  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserRatings(data.ratedMovies || []);
        setUserWatched(data.watchedMovies || []);
      }
    });
    return () => unsub();
  }, [firebaseUser]);

  const handleRateMovie = async (movie: Movie, rating: number) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    try {
      const newRating: UserRatingData = {
        movieId: String(movie.id),
        mediaType: movie.media_type,
        rating: rating,
        title: movie.title || movie.name || 'Untitled',
        poster: movie.poster_path
      };
      
      await runTransaction(db, async tx => {
        const snap = await tx.get(ref);
        if (!snap.exists()) {
          // If the user document doesn't exist, create it.
          // This can happen if AuthProvider is slow to create the initial document.
          tx.set(ref, { ratedMovies: [newRating] }, { merge: true });
          return;
        }

        const data = snap.data();
        const existingRatings: UserRatingData[] = data.ratedMovies || [];
        const idx = existingRatings.findIndex(r => r.movieId === String(movie.id) && r.mediaType === movie.media_type);
        
        if (idx > -1) {
          existingRatings[idx].rating = rating;
        } else {
          existingRatings.push(newRating);
        }
        tx.update(ref, { ratedMovies: existingRatings });
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Rating failed', description: e.message });
    }
  };

  const handleToggleWatched = async (movie: Movie, watched: boolean) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier: UserMovieData & { title: string; poster: string | null } = {
        movieId: String(movie.id),
        mediaType: movie.media_type,
        title: movie.title || movie.name || 'Untitled',
        poster: movie.poster_path
    };

    try {
      if (watched) {
        await updateDoc(ref, { watchedMovies: arrayUnion(movieIdentifier) });
      } else {
        await updateDoc(ref, { watchedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };

  const swiped = (direction: string, movie: Movie) => {
    setLastSwipedMovie(movie);
    if (direction === 'right') {
      handleRateMovie(movie, 5);
      toast({ title: 'Liked!', description: `You rated "${movie.title || movie.name}" 5 stars.`});
    }
    setMovies(prev => prev.filter(m => m.id !== movie.id));
  };
  
  // Fetch more movies when the stack is low
  useEffect(() => {
    if (!loading && movies.length <= 3) {
        setLoadingMore(true);
        const highRated = userRatings.filter(r => r.rating >= 4);
        if (highRated.length > 0) {
            // Pick a random liked movie to get recommendations from
            const seedMovieId = highRated[Math.floor(Math.random() * highRated.length)].movieId;
            fetchMovies(false, seedMovieId);
        } else {
            // Fetch random popular movies if no ratings yet
            fetchMovies(false);
        }
    }
  }, [movies.length, loading, fetchMovies, userRatings]);

  const swipe = async (dir: 'left' | 'right') => {
    if (movies.length > 0 && tinderCardRef.current) {
      await tinderCardRef.current.swipe(dir);
    }
  };
  
  const restoreCard = async () => {
    if(lastSwipedMovie) {
        setMovies(prev => [lastSwipedMovie, ...prev]);
        setLastSwipedMovie(null);
    }
  }

  const renderContent = () => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center text-center h-full">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg text-muted-foreground mt-4">Loading recommendations...</p>
            </div>
        );
    }
    
    if (movies.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center h-full">
                <p className="text-lg text-muted-foreground">You've seen everything for now!</p>
                <Button onClick={() => fetchMovies(true)} className="mt-4"><RefreshCw className="mr-2 h-4 w-4" /> Reload</Button>
            </div>
        );
    }

    return movies.map((movie, index) => {
        const isTopCard = index === movies.length - 1;
        const rating = userRatings.find(r => r.movieId === String(movie.id))?.rating;
        const isWatched = userWatched.some(w => w.movieId === String(movie.id));
        
        return (
            <TinderCard
                ref={isTopCard ? tinderCardRef : null}
                className="absolute inset-0"
                key={movie.id}
                onSwipe={(dir) => swiped(dir, movie)}
                preventSwipe={['up', 'down']}
            >
                <DiscoverCard
                    movie={movie}
                    rating={rating}
                    isWatched={isWatched}
                    onRate={(newRating) => handleRateMovie(movie, newRating)}
                    onToggleWatched={(watched) => handleToggleWatched(movie, watched)}
                />
            </TinderCard>
        );
    });
  }

  return (
    <div className="flex flex-col h-full w-full">
      <div className="relative flex-grow w-full max-w-lg mx-auto aspect-[3/5]">
        {renderContent()}
      </div>

      <div className="flex justify-center items-center gap-6 py-4 flex-shrink-0">
        <Button variant="outline" size="icon" className="h-16 w-16 rounded-full border-2 border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => swipe('left')} disabled={movies.length === 0}>
            <XIcon className="h-8 w-8" />
        </Button>
        <Button variant="outline" size="icon" className="h-12 w-12 rounded-full border-2" onClick={restoreCard} disabled={!lastSwipedMovie}>
            <Undo className="h-6 w-6" />
        </Button>
        <Button variant="outline" size="icon" className="h-16 w-16 rounded-full border-2 border-green-500/50 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => swipe('right')} disabled={movies.length === 0}>
            <Heart className="h-8 w-8" />
        </Button>
      </div>
    </div>
  );
}
