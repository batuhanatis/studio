'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Heart, X as XIcon, RefreshCw, Loader2, Undo } from 'lucide-react';
import TinderCard from 'react-tinder-card';
import { DiscoverCard } from './DiscoverCard';
import { Button } from '@/components/ui/button';
import { useSearchParams, useRouter } from 'next/navigation';
import { NewUserOnboarding } from './NewUserOnboarding';

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
  title: string;
  poster: string | null;
}

function DiscoverFeedContent() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [lastSwipedMovie, setLastSwipedMovie] = useState<{movie: Movie; direction: 'left' | 'right' } | null>(null);
  
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [swipeOpacity, setSwipeOpacity] = useState(0);
  
  const [platforms, setPlatforms] = useState<WatchProvider[]>([]);

  const [triggerFetch, setTriggerFetch] = useState(0);
  
  const currentIndexRef = useRef(movies.length - 1);
  const tinderCardRefs = useMemo(() => Array(movies.length).fill(0).map(() => React.createRef<any>()), [movies.length]);

  const fetchMovies = useCallback(async (isRestart = false) => {
    if (authLoading || !firebaseUser) return;
    if (isRestart) {
        setLoading(true);
    } else {
        setLoadingMore(true);
    }

    let seenMovieIds = new Set();
    try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            const likedMovies = data.likedMovies || [];
            const disliked = data.dislikedMovies || [];
            seenMovieIds = new Set([
                ...likedMovies.map((m: any) => m.movieId), 
                ...disliked.map((m: any) => m.movieId)
            ]);
        }
    } catch {}

    try {
      const page = Math.floor(Math.random() * 20) + 1;
      const movieReq = fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&page=${page}`);
      const tvReq = fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&page=${page}`);
      
      const [movieRes, tvRes] = await Promise.all([movieReq, tvReq]);
      const [moviesJson, tvJson] = await Promise.all([movieRes.json(), tvRes.json()]);

      const tmdbResults = [
        ...(moviesJson.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
        ...(tvJson.results || []).map((t: any) => ({ ...t, media_type: 'tv' }))
      ];
      
      const uniqueAndFiltered = Array.from(new Map(tmdbResults.map(m => [m.id, m])).values())
                        .filter(m => m.poster_path && m.overview)
                        .filter(m => !seenMovieIds.has(String(m.id)));
      
      const shuffled = uniqueAndFiltered.sort(() => 0.5 - Math.random());
      
      setMovies(prev => {
        if (isRestart) {
            const newMovies = shuffled.slice(0, 10);
            currentIndexRef.current = newMovies.length -1;
            return newMovies;
        } else {
            const currentIds = new Set(prev.map(m => m.id));
            const newUniqueMovies = shuffled.filter(m => !currentIds.has(m.id)).slice(0, 5);
            const combined = [...prev, ...newUniqueMovies];
            currentIndexRef.current = combined.length -1;
            return combined;
        }
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

  useEffect(() => {
    if (movies.length > 0) {
        const topMovie = movies[movies.length - 1];
        fetchProviders(topMovie);
    } else {
        setPlatforms([]);
    }
  }, [movies, fetchProviders]);

  useEffect(() => {
    fetchMovies(true);
  }, [triggerFetch, firebaseUser]); // Re-fetch when user changes

  const handleInteraction = async (movie: Movie, type: 'like' | 'dislike') => {
    if (!firebaseUser) return;
    const ref = doc(db, 'users', firebaseUser.uid);
    try {
      const interactionData: UserMovieData = {
        movieId: String(movie.id),
        mediaType: movie.media_type,
        title: movie.title || movie.name || 'Untitled',
        poster: movie.poster_path,
      };

      if (type === 'like') {
        await updateDoc(ref, { 
            likedMovies: arrayUnion(interactionData),
            dislikedMovies: arrayRemove(interactionData)
        });
        toast({ title: 'Liked!', description: `Added "${interactionData.title}" to your likes.`});
      } else { // 'dislike'
        await updateDoc(ref, { 
            dislikedMovies: arrayUnion(interactionData),
            likedMovies: arrayRemove(interactionData)
        });
      }

    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Action failed', description: e.message });
    }
  };

  const swiped = (direction: 'left' | 'right', movie: Movie) => {
    setLastSwipedMovie({movie, direction});
    if (direction === 'right') {
      handleInteraction(movie, 'like');
    } else {
      handleInteraction(movie, 'dislike');
    }

    setMovies((prevMovies) => prevMovies.filter(m => m.id !== movie.id));
    
    setSwipeDirection(null);
    setSwipeOpacity(0);
  };
  
  useEffect(() => {
    if (movies.length <= 4 && !loadingMore && !loading) {
      fetchMovies(false);
    }
  }, [movies.length, loadingMore, loading, fetchMovies]);

  const swipe = async (dir: 'left' | 'right') => {
    const topCardIndex = movies.length - 1;
    if (topCardIndex >= 0 && tinderCardRefs[topCardIndex]) {
      await tinderCardRefs[topCardIndex].current.swipe(dir);
    }
  };
  
  const restoreCard = async () => {
    if(lastSwipedMovie) {
        const { movie, direction } = lastSwipedMovie;
        // Undo the like/dislike
        if (firebaseUser) {
            const ref = doc(db, 'users', firebaseUser.uid);
            const movieIdentifier = {
                movieId: String(movie.id),
                mediaType: movie.media_type,
                title: movie.title || movie.name || 'Untitled',
                poster: movie.poster_path,
            };
            try {
                if (direction === 'right') {
                    await updateDoc(ref, { likedMovies: arrayRemove(movieIdentifier) });
                    toast({ title: 'Like Undone' });
                } else {
                     await updateDoc(ref, { dislikedMovies: arrayRemove(movieIdentifier) });
                     toast({ title: 'Dislike Undone' });
                }
            } catch (e) {
                // handle error if needed
            }
        }
        setMovies(prev => [...prev, movie]);
        setLastSwipedMovie(null);
    }
  }
  
  const handleSwipeProgress = (progress: number, direction: 'left' | 'right' | 'up' | 'down') => {
      if(direction === 'left' || direction === 'right') {
          setSwipeDirection(direction);
          setSwipeOpacity(Math.min(progress * 2, 1));
      }
  };

  const renderContent = () => {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-lg text-muted-foreground">Finding new titles...</p>
            </div>
        );
    }
    
    if (movies.length === 0) {
        if (loadingMore) {
            return (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 text-lg text-muted-foreground">Finding more titles...</p>
                </div>
            );
        }
        return (
            <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-lg text-muted-foreground">You've seen everything for now!</p>
                <Button onClick={() => setTriggerFetch(c => c + 1)} className="mt-4"><RefreshCw className="mr-2 h-4 w-4" /> Reload</Button>
            </div>
        );
    }

    return movies.map((movie, index) => {
        const isTopCard = index === movies.length - 1;
        
        return (
            <TinderCard
                ref={tinderCardRefs[index]}
                className="absolute inset-0"
                key={`${movie.id}-${movie.media_type}`}
                onSwipe={(dir) => swiped(dir as 'left' | 'right', movie)}
                onSwipeRequirementUnfulfilled={() => { setSwipeDirection(null); setSwipeOpacity(0); }}
                onSwipeProgress={(p, d) => isTopCard && handleSwipeProgress(p, d as any)}
                preventSwipe={['up', 'down']}
            >
                <DiscoverCard
                    movie={movie}
                    platforms={isTopCard ? platforms : undefined}
                    swipeDirection={isTopCard ? swipeDirection : null}
                    swipeOpacity={isTopCard ? swipeOpacity : 0}
                />
            </TinderCard>
        );
    });
  }

  const isNewUser = searchParams.get('new_user') === 'true';

  return (
    <div className="flex flex-col w-full h-full">
      {isNewUser && <NewUserOnboarding />}
      <div className="relative flex-grow w-full max-w-lg mx-auto aspect-[3/5]">
        {renderContent()}
      </div>

      <div className="flex items-center justify-center flex-shrink-0 gap-6 py-4">
        <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20" onClick={() => swipe('left')} disabled={movies.length === 0}>
            <XIcon className="w-8 h-8" />
        </Button>
        <Button variant="outline" size="icon" className="w-12 h-12 rounded-full border-2" onClick={restoreCard} disabled={!lastSwipedMovie}>
            <Undo className="w-6 h-6" />
        </Button>
        <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-green-500/50 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => swipe('right')} disabled={movies.length === 0}>
            <Heart className="w-8 h-8" />
        </Button>
      </div>
    </div>
  );
}

export function DiscoverFeed() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <DiscoverFeedContent />
        </Suspense>
    )
}
