
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Film, Heart, X as XIcon, RefreshCw, Loader2 } from 'lucide-react';
import TinderCard from 'react-tinder-card';
import { DiscoverCard } from './DiscoverCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';

interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  popularity: number;
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

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';
const MOVIES_PER_BATCH = 5;

export function DiscoverFeed() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [userRatings, setUserRatings] = useState<Omit<UserRatingData, 'title' | 'poster'>[]>([]);
  const [userWatched, setUserWatched] = useState<UserMovieData[]>([]);
  const [seenMovieIds, setSeenMovieIds] = useState<Set<string>>(new Set());
  
  const canSwipe = movies.length > 0;

  const swipe = async (dir: 'left' | 'right') => {
    // This function is for programmatic swiping via buttons.
    // We simulate a swipe on the last card in the array (which is the top one).
    if (canSwipe) {
      const movieToSwipe = movies[movies.length - 1];
      if (dir === 'right') {
        handleRateMovie(movieToSwipe, 5);
      }
      // Remove the swiped movie from the state
      setMovies(prevMovies => prevMovies.slice(0, prevMovies.length - 1));
    }
  };
  
  const fetchPersonalizedRecommendations = useCallback(async (currentSeenIds: Set<string>) => {
    if (!firebaseUser || authLoading) return [];

    try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const ratedMovies: UserRatingData[] = userData.ratedMovies || [];
            const highlyRated = ratedMovies.filter(r => r.rating >= 4);

            if (highlyRated.length > 0) {
                const seedMovie = highlyRated[Math.floor(Math.random() * highlyRated.length)];
                const res = await fetch(`https://api.themoviedb.org/3/${seedMovie.mediaType}/${seedMovie.movieId}/recommendations?api_key=${API_KEY}&language=en-US`);
                if (!res.ok) return [];

                const data = await res.json();
                const recommendedItems = (data.results || [])
                    .map((item: any) => ({ ...item, media_type: seedMovie.mediaType, popularity: item.popularity || 0 }))
                    .filter((item: any) => item.poster_path && !currentSeenIds.has(String(item.id)))
                    .sort((a: Movie, b: Movie) => (b.vote_average || 0) - (a.vote_average || 0));
                
                return recommendedItems.slice(0, MOVIES_PER_BATCH);
            }
        }
    } catch (error) {
        console.error("Failed to fetch personalized recommendations:", error);
    }
    return [];
  }, [firebaseUser, authLoading]);

  const fetchGenericMovies = useCallback(async (currentSeenIds: Set<string>) => {
    try {
        const page = 1 + Math.floor(currentSeenIds.size / 20);
        const movieRes = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=${page}`);
        const tvRes = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=${page}`);
        
        const [movieData, tvData] = await Promise.all([movieRes.json(), tvRes.json()]);

        const allPopular = [
            ...(movieData.results || []).map((m: any) => ({ ...m, media_type: 'movie' as const, popularity: m.popularity || 0 })),
            ...(tvData.results || []).map((t: any) => ({ ...t, media_type: 'tv' as const, popularity: t.popularity || 0 }))
        ];

        const filtered = allPopular
            .filter(item => item.poster_path && item.overview && !currentSeenIds.has(String(item.id)))
            .sort(() => 0.5 - Math.random());
        
        return filtered.slice(0, MOVIES_PER_BATCH);
    } catch (error) {
        console.error("Error fetching generic movies:", error);
        toast({ variant: 'destructive', title: 'Could not load movies', description: 'There was an issue connecting to the movie database.' });
        return [];
    }
  }, [toast]);
  
  const loadMoreMovies = useCallback(async (forceGeneric = false) => {
    if (loadingMore) return;
    setLoadingMore(true);
    let newMovies: Movie[] = [];
    const newSeenIds = new Set(seenMovieIds);
    
    if (firebaseUser && !firebaseUser.isAnonymous && !forceGeneric) {
        newMovies = await fetchPersonalizedRecommendations(newSeenIds);
    }

    if (newMovies.length < MOVIES_PER_BATCH) {
        const genericMovies = await fetchGenericMovies(newSeenIds);
        newMovies.push(...genericMovies.slice(0, MOVIES_PER_BATCH - newMovies.length));
    }

    if (newMovies.length > 0) {
        newMovies.forEach(m => newSeenIds.add(String(m.id)));
        setSeenMovieIds(newSeenIds);
        setMovies(prev => [...prev, ...newMovies]);
    } else {
        toast({ title: "That's all for now!", description: "You've seen everything we have. Try again later!" });
    }
    
    setLoadingMore(false);
  }, [seenMovieIds, firebaseUser, fetchPersonalizedRecommendations, fetchGenericMovies, toast, loadingMore]);

  // Load initial movies when component mounts or user changes
  useEffect(() => {
    const initializeFeed = async () => {
      setLoading(true);
      setMovies([]); // Reset movies
      let initialSeenIds = new Set<string>();
      if (firebaseUser) {
          try {
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                  const userData = userDoc.data();
                  const rated: UserMovieData[] = userData.ratedMovies || [];
                  const watched: UserMovieData[] = userData.watchedMovies || [];
                  initialSeenIds = new Set([...rated.map(m => m.movieId), ...watched.map(m => m.movieId)]);
              }
          } catch (dbError) {
              console.warn("Could not fetch user seen movies, showing generic titles.", dbError);
          }
      }
      setSeenMovieIds(initialSeenIds);
      
      const initialMovies = await fetchGenericMovies(initialSeenIds);
      setMovies(initialMovies);
      setLoading(false);
    };

    if (!authLoading) {
      initializeFeed();
    }
  }, [authLoading, firebaseUser, fetchGenericMovies]);


  // Subscribe to user's ratings and watched list
  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setUserRatings(data.ratedMovies || []);
            setUserWatched(data.watchedMovies || []);
        }
    }, (error) => {
        console.error("Error fetching user data snapshot for cards:", error);
    });
    return () => unsubscribe();
  }, [firebaseUser, authLoading]);

  const handleRateMovie = async (movie: Movie, rating: number) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdStr = String(movie.id);
    const movieTitle = movie.title || movie.name;

    if (!movieTitle) return;

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw new Error("User profile not found.");
            
            const data = userDoc.data();
            const currentRatings: UserRatingData[] = data.ratedMovies ? [...data.ratedMovies] : [];
            const ratingIndex = currentRatings.findIndex(r => r.movieId === movieIdStr && r.mediaType === movie.media_type);

            const ratingData = { 
                movieId: movieIdStr, 
                mediaType: movie.media_type, 
                rating,
                title: movieTitle,
                poster: movie.poster_path
            };

            if (ratingIndex > -1) {
                if (currentRatings[ratingIndex].rating === rating) return;
                currentRatings[ratingIndex] = ratingData;
            } else {
                currentRatings.push(ratingData);
            }
            transaction.update(userDocRef, { ratedMovies: currentRatings });
        });
        if (rating === 5) {
          toast({ title: 'Liked!', description: `Added "${movieTitle}" to your profile.` });
        }
    } catch (error: any) {
       console.error("Failed to rate movie:", error);
       let description = error.message || 'Could not save your rating.';
       if (error.code === 'permission-denied') {
           description = "Your rating could not be saved due to a permissions issue. Please check your Firestore rules.";
       }
       toast({ variant: 'destructive', title: 'Error Saving Rating', description });
    }
  };
  
  const handleToggleWatched = async (movie: Movie, isWatched: boolean) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    
    const movieTitle = movie.title || movie.name;
    if (!movieTitle) return;
    
    const movieIdentifier = { 
        movieId: String(movie.id), 
        mediaType: movie.media_type,
        title: movieTitle,
        poster: movie.poster_path
    };

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

  const swiped = (direction: 'left' | 'right', movie: Movie) => {
    if (direction === 'right') {
        handleRateMovie(movie, 5);
    }
  };
  
  const onCardLeftScreen = (myIdentifier: number) => {
    setMovies(prevMovies => prevMovies.filter(m => m.id !== myIdentifier));
  };
  
  useEffect(() => {
    if (!loading && movies.length < MOVIES_PER_BATCH) {
        loadMoreMovies();
    }
  }, [movies.length, loading, loadMoreMovies]);


  const renderContent = () => {
      if (loading) {
        return (
            <Card className="w-full max-w-sm h-[75vh] mx-auto overflow-hidden shadow-2xl rounded-2xl">
              <Skeleton className="w-full h-full" />
            </Card>
        );
      }

      return (
         <div className="relative w-full max-w-sm h-[75vh]">
            {movies.length > 0 ? (
                movies.map((movie) => (
                    <TinderCard
                        className="absolute w-full h-full"
                        key={movie.id}
                        onSwipe={(dir) => swiped(dir as 'left' | 'right', movie)}
                        preventSwipe={['up', 'down']}
                        onCardLeftScreen={() => onCardLeftScreen(movie.id)}
                    >
                        <DiscoverCard
                            movie={movie}
                            rating={userRatings.find(r => r.movieId === String(movie.id) && r.mediaType === movie.media_type)?.rating || 0}
                            isWatched={userWatched.some(m => m.movieId === String(movie.id) && m.mediaType === movie.media_type)}
                            onRate={(rating) => handleRateMovie(movie, rating)}
                            onToggleWatched={(watched) => handleToggleWatched(movie, watched)}
                        />
                    </TinderCard>
                ))
            ) : (
                 <Card className="w-full h-full flex items-center justify-center p-8">
                    <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
                        <Film className="h-16 w-16" />
                        <p className="text-lg">That's all for now!</p>
                        <Button onClick={() => loadMoreMovies(true)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Load More
                        </Button>
                    </div>
                </Card>
            )}
             {loadingMore && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-2xl">
                    <div className="flex flex-col items-center gap-4 text-primary">
                        <Loader2 className="h-12 w-12 animate-spin" />
                        <p className="text-lg font-semibold text-foreground">Finding more titles...</p>
                    </div>
                </div>
            )}
         </div>
      )
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
            Discover New Titles
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
            Swipe right to like, left to skip.
        </p>
      </div>

      <div className="relative flex-grow w-full flex items-center justify-center">
        {renderContent()}
      </div>

      <div className="flex items-center gap-6 mt-4 z-10">
          <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => swipe('left')} disabled={!canSwipe || loadingMore}>
              <XIcon className="h-8 w-8" />
          </Button>
          <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-primary text-primary hover:bg-primary/10" onClick={() => swipe('right')} disabled={!canSwipe || loadingMore}>
              <Heart className="h-8 w-8" />
          </Button>
      </div>
    </div>
  );
}

    

    