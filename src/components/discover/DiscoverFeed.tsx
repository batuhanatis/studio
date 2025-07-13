
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

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

interface MovieFeedbackData extends UserMovieData {
  title: string;
  poster: string | null;
}

export function DiscoverFeed() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [userWatched, setUserWatched] = useState<UserMovieData[]>([]);
  
  const [lastSwipedMovie, setLastSwipedMovie] = useState<Movie | null>(null);
  
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeOpacity, setSwipeOpacity] = useState(0);

  const tinderCardRefs = useMemo(() => Array(movies.length).fill(0).map(() => React.createRef<any>()), [movies.length]);
  const currentIndexRef = useRef(0);
  
  const [platforms, setPlatforms] = useState<WatchProvider[]>([]);

  const [triggerFetch, setTriggerFetch] = useState(0);

  const fetchMovies = useCallback(async (isRestart = false) => {
    if (authLoading) return;
    if (isRestart) {
        setLoading(true);
    } else {
        setLoadingMore(true);
    }

    let seenMovieIds = new Set();
    if (firebaseUser) {
        try {
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                const liked = data.likedMovies || [];
                const disliked = data.dislikedMovies || [];
                const watched = data.watchedMovies || [];
                seenMovieIds = new Set([
                    ...liked.map((m: any) => m.movieId), 
                    ...disliked.map((m: any) => m.movieId), 
                    ...watched.map((m: any) => m.movieId)
                ]);
            }
        } catch {}
    }

    try {
      const page = Math.floor(Math.random() * 20) + 1;
      const movieReq = fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&page=${page}`);
      const tvReq = fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&page=${page}`);
      
      const [movieRes, tvRes] = await Promise.all([movieReq, tvReq]);
      const [moviesJson, tvJson] = await Promise.all([movieRes.json(), tvRes.json()]);

      const allResults = [
        ...(moviesJson.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
        ...(tvJson.results || []).map((t: any) => ({ ...t, media_type: 'tv' }))
      ];
      
      const uniqueAndFiltered = Array.from(new Map(allResults.map(m => [m.id, m])).values())
                        .filter(m => m.poster_path && m.overview)
                        .filter(m => !seenMovieIds.has(String(m.id)));
      
      const shuffled = uniqueAndFiltered.sort(() => 0.5 - Math.random());
      
      setMovies(prev => {
        const newMovies = isRestart ? shuffled.slice(0, 10) : [...prev, ...shuffled.slice(0, 5)];
        currentIndexRef.current = newMovies.length -1;
        return newMovies;
      });

    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load movies.' });
    } finally {
      if (isRestart) setLoading(false);
      setLoadingMore(false);
    }
  }, [firebaseUser, toast, authLoading]);
  
  const fetchProviders = useCallback(async (movie: Movie | null) => {
    if (!movie) {
        setPlatforms([]);
        return;
    }
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${movie.media_type}/${movie.id}/watch/providers?api_key=${API_KEY}`);
        const data = await res.json();
        const tr = data.results?.TR;
        if (tr) {
            const allProviders: WatchProvider[] = [
                ...(tr.flatrate || []),
                ...(tr.buy || []),
                ...(tr.rent || []),
            ];
            const unique = allProviders.filter((v, i, a) => a.findIndex((t) => t.provider_id === v.provider_id) === i);
            setPlatforms(unique);
        } else {
            setPlatforms([]);
        }
    } catch {
        setPlatforms([]);
    }
  }, []);

  // Fetch providers for the top card whenever the movie list changes
  useEffect(() => {
    if (movies.length > 0) {
        const topMovie = movies[movies.length - 1];
        fetchProviders(topMovie);
    } else {
        setPlatforms([]);
    }
  }, [movies, fetchProviders]);

  // Initial fetch and subsequent fetches
  useEffect(() => {
    fetchMovies(movies.length === 0);
  }, [triggerFetch]);

  // User data listener
  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserWatched(data.watchedMovies || []);
      }
    });
    return () => unsub();
  }, [firebaseUser]);

  const handleLikeMovie = async (movie: Movie) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    try {
      const newLike: MovieFeedbackData = {
        movieId: String(movie.id),
        mediaType: movie.media_type,
        title: movie.title || movie.name || 'Untitled',
        poster: movie.poster_path,
      };
      
      await updateDoc(ref, { 
          likedMovies: arrayUnion(newLike),
          dislikedMovies: arrayRemove(newLike)
      });
      toast({ title: 'Liked!', description: `Added "${newLike.title}" to your likes.`});

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Like failed', description: e.message });
    }
  };

  const handleDislikeMovie = async (movie: Movie) => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    try {
        const newDislike: MovieFeedbackData = {
            movieId: String(movie.id),
            mediaType: movie.media_type,
            title: movie.title || movie.name || 'Untitled',
            poster: movie.poster_path,
        };
        await updateDoc(ref, {
            dislikedMovies: arrayUnion(newDislike),
            likedMovies: arrayRemove(newDislike)
        });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Dislike failed', description: e.message });
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
      handleLikeMovie(movie);
    } else if (direction === 'left') {
      handleDislikeMovie(movie);
    }

    // This is a stable way to remove the top card
    setMovies((prevMovies) => prevMovies.slice(0, prevMovies.length - 1));
    
    // Reset swipe feedback
    setSwipeDirection(null);
    setSwipeOpacity(0);
  };
  
  // Fetch more movies when the stack runs low
  useEffect(() => {
    if (movies.length <= 4 && !loadingMore && !loading) {
      setTriggerFetch(c => c + 1);
    }
  }, [movies.length, loadingMore, loading]);

  const swipe = async (dir: 'left' | 'right') => {
    if (movies.length > 0 && currentIndexRef.current < movies.length && tinderCardRefs[currentIndexRef.current]) {
      await tinderCardRefs[currentIndexRef.current].current.swipe(dir);
    }
  };
  
  const restoreCard = async () => {
    if(lastSwipedMovie) {
        // This is a more stable way to add the card back
        setMovies(prev => [...prev, lastSwipedMovie]);
        setLastSwipedMovie(null);
    }
  }
  
  const handleSwipeProgress = (progress: number, direction: 'left' | 'right' | 'up' | 'down') => {
      if(direction === 'left' || direction === 'right') {
          setSwipeDirection(direction);
          setSwipeOpacity(Math.min(progress * 2, 1));
      }
  };
  
  const handleSwipeRequirementFulfilled = () => {
      setSwipeDirection(null);
      setSwipeOpacity(0);
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
        if (loadingMore) {
            return (
                <div className="flex flex-col items-center justify-center text-center h-full">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-lg text-muted-foreground mt-4">Finding more titles...</p>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center text-center h-full">
                <p className="text-lg text-muted-foreground">You've seen everything for now!</p>
                <Button onClick={() => setTriggerFetch(c => c + 1)} className="mt-4"><RefreshCw className="mr-2 h-4 w-4" /> Reload</Button>
            </div>
        );
    }

    return movies.map((movie, index) => {
        const isTopCard = index === movies.length - 1;
        const isWatched = userWatched.some(w => w.movieId === String(movie.id));
        
        return (
            <TinderCard
                ref={tinderCardRefs[index]}
                className="absolute inset-0"
                key={movie.id}
                onSwipe={(dir) => swiped(dir, movie)}
                onSwipeRequirementUnfulfilled={() => { setSwipeDirection(null); setSwipeOpacity(0); }}
                onSwipeProgress={(p, d) => isTopCard && handleSwipeProgress(p, d)}
                preventSwipe={['up', 'down']}
            >
                <DiscoverCard
                    movie={movie}
                    isWatched={isWatched}
                    platforms={isTopCard ? platforms : undefined}
                    onToggleWatched={(watched) => handleToggleWatched(movie, watched)}
                    swipeDirection={isTopCard ? swipeDirection : null}
                    swipeOpacity={isTopCard ? swipeOpacity : 0}
                />
            </TinderCard>
        );
    }).reverse(); // Reverse to get the stack effect correct with the new removal logic
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
