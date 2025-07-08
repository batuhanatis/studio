
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, type RefObject } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Film, Heart, X as XIcon } from 'lucide-react';
import TinderCard from 'react-tinder-card';
import { DiscoverCard } from './DiscoverCard';
import { Button } from '@/components/ui/button';

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
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

interface UserRatingData extends UserMovieData {
  rating: number;
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function DiscoverFeed() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userRatings, setUserRatings] = useState<UserRatingData[]>([]);
  const [userWatched, setUserWatched] = useState<UserMovieData[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(true);
  
  const [currentIndex, setCurrentIndex] = useState(0);

  const childRefs = useMemo(
    () =>
      Array(movies.length)
        .fill(0)
        .map(() => React.createRef<{ swipe: (dir: 'left' | 'right') => Promise<void> }>()),
    [movies.length]
  );
  
  const canSwipe = currentIndex >= 0;

  const swipe = async (dir: 'left' | 'right') => {
    if (canSwipe && currentIndex < movies.length) {
      if (childRefs[currentIndex]?.current) {
        await childRefs[currentIndex].current!.swipe(dir);
      }
    }
  }

  const fetchAndSetMovies = useCallback(async () => {
    setLoading(true);
    setMovies([]);
    
    try {
      let seenMovieIds = new Set<string>();

      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            const ratedMovies: UserRatingData[] = userData.ratedMovies || [];
            const watchedMovies: UserMovieData[] = userData.watchedMovies || [];
            seenMovieIds = new Set([...ratedMovies.map(m => m.movieId), ...watchedMovies.map(m => m.movieId)]);
          }
        } catch (dbError) {
          console.warn("Could not fetch user data, showing generic popular titles.", dbError);
        }
      }
      
      const movieRes = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`);
      const tvRes = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`);
      
      if (!movieRes.ok || !tvRes.ok) throw new Error("Failed to fetch from TMDB API");
      
      const movieData = await movieRes.json();
      const tvData = await tvRes.json();

      const popularMovies = (movieData.results || []).map((m: any) => ({ ...m, media_type: 'movie' as const }));
      const popularTv = (tvData.results || []).map((t: any) => ({ ...t, media_type: 'tv' as const }));
      
      const allPopular = [...popularMovies, ...popularTv];

      const filtered = allPopular.filter(item => 
        item.poster_path && 
        item.overview && 
        !seenMovieIds.has(String(item.id))
      );

      const shuffledMovies = filtered.sort(() => 0.5 - Math.random());
      
      setMovies(shuffledMovies);
      setCurrentIndex(shuffledMovies.length - 1);

    } catch (error) {
        console.error("Error fetching discover feed:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load movies.' });
        setMovies([]);
    } finally {
        setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchAndSetMovies();
  }, [fetchAndSetMovies]);

  useEffect(() => {
    if (!user) {
      setLoadingUserData(false);
      return;
    }
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setUserRatings(data.ratedMovies || []);
            setUserWatched(data.watchedMovies || []);
        }
        setLoadingUserData(false);
    }, (error) => {
        console.error("Error fetching user data snapshot:", error);
        toast({ variant: 'destructive', title: 'Connection Error', description: 'Could not load your saved ratings.' });
        setLoadingUserData(false);
    });
    return () => unsubscribe();
  }, [user, toast]);

  const handleRateMovie = async (movieId: number, mediaType: 'movie' | 'tv', rating: number) => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const movieIdStr = String(movieId);
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) throw new Error("User profile not found.");
            
            const data = userDoc.data();
            const currentRatings: any[] = data.ratedMovies ? [...data.ratedMovies] : [];
            const ratingIndex = currentRatings.findIndex(r => r.movieId === movieIdStr && r.mediaType === mediaType);

            if (ratingIndex > -1) {
                if (currentRatings[ratingIndex].rating === rating) return;
                currentRatings[ratingIndex].rating = rating;
            } else {
                currentRatings.push({ movieId: movieIdStr, mediaType, rating });
            }
            transaction.update(userDocRef, { ratedMovies: currentRatings });
        });
        if (rating === 5) {
          toast({ title: 'Liked!', description: 'Added to your profile.' });
        }
    } catch (error: any) {
       console.error("Failed to rate movie:", error);
       toast({ variant: 'destructive', title: 'Error Saving Rating', description: error.message || 'Could not save your rating.' });
    }
  };
  
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

  const swiped = (direction: 'left' | 'right', movie: Movie, index: number) => {
    setCurrentIndex(index - 1);
    if (direction === 'right') {
        handleRateMovie(movie.id, movie.media_type, 5);
    }
  };

  return (
    <div className="flex flex-col items-center w-full h-full">
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
            Discover New Titles
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
            Swipe right to like, left to skip.
        </p>
      </div>

      <div className="relative flex-grow w-full flex items-center justify-center">
          {(loading || loadingUserData) && movies.length === 0 ? (
            <DiscoverCard onRate={()=>{}} onToggleWatched={()=>{}}/>
          ) : !loading && movies.length === 0 ? (
            <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
              <Film className="h-16 w-16" />
              <p className="text-lg">All Caught Up!</p>
              <p className="text-sm">You've seen all available recommendations. Check back later!</p>
            </div>
          ) : (
             <div className="relative w-full max-w-sm h-[75vh]">
                {movies.map((movie, index) => (
                    <TinderCard
                        ref={childRefs[index]}
                        className="absolute"
                        key={movie.id}
                        onSwipe={(dir) => swiped(dir as 'left' | 'right', movie, index)}
                        preventSwipe={['up', 'down']}
                    >
                        <DiscoverCard
                            movie={movie}
                            rating={userRatings.find(r => r.movieId === String(movie.id) && r.mediaType === movie.media_type)?.rating || 0}
                            isWatched={userWatched.some(m => m.movieId === String(movie.id) && m.mediaType === movie.media_type)}
                            onRate={(rating) => handleRateMovie(movie.id, movie.media_type, rating)}
                            onToggleWatched={(watched) => handleToggleWatched(movie.id, movie.media_type, watched)}
                        />
                    </TinderCard>
                ))}
             </div>
          )}
      </div>

      {!loading && movies.length > 0 && (
        <div className="flex items-center gap-6 mt-4 z-10">
            <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => swipe('left')}>
                <XIcon className="h-8 w-8" />
            </Button>
            <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-primary text-primary hover:bg-primary/10" onClick={() => swipe('right')}>
                <Heart className="h-8 w-8" />
            </Button>
        </div>
      )}
    </div>
  );
}
