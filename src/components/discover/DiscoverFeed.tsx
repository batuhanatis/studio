
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, runTransaction, updateDoc, arrayUnion, arrayRemove, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Film, Heart, X as XIcon, RefreshCw } from 'lucide-react';
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
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [userRatings, setUserRatings] = useState<UserRatingData[]>([]);
  const [userWatched, setUserWatched] = useState<UserMovieData[]>([]);
  
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentIndexRef = useRef(currentIndex);

  const childRefs = useMemo(
    () =>
      Array(movies.length)
        .fill(0)
        .map(() => React.createRef<{ swipe: (dir: 'left' | 'right' | 'up' | 'down') => Promise<void> }>()),
    [movies.length]
  );
  
  const updateCurrentIndex = (val: number) => {
    setCurrentIndex(val);
    currentIndexRef.current = val;
  }

  const canSwipe = currentIndex >= 0 && currentIndex < movies.length;

  const swipe = async (dir: 'left' | 'right') => {
    if (canSwipe) {
      const cardRef = childRefs[currentIndex];
      if (cardRef && cardRef.current) {
        await cardRef.current.swipe(dir);
      }
    }
  }

  const fetchDiscoverMovies = useCallback(async (isRestart = false) => {
    if (authLoading) return;
    setLoading(true);
    
    let seenMovieIds = new Set<string>();
    if (firebaseUser && !isRestart) {
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const rated: UserMovieData[] = userData.ratedMovies || [];
                const watched: UserMovieData[] = userData.watchedMovies || [];
                seenMovieIds = new Set([...rated.map(m => m.movieId), ...watched.map(m => m.movieId)]);
            }
        } catch (dbError) {
            console.warn("Could not fetch user seen movies, showing generic titles.", dbError);
        }
    }
    
    try {
        const pagesToFetch = 5;
        let allPopular: Movie[] = [];

        for (let page = 1; page <= pagesToFetch; page++) {
          const movieRes = fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=${page}`);
          const tvRes = fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=${page}`);
          
          const responses = await Promise.all([movieRes, tvRes]);
          const [movieData, tvData] = await Promise.all(responses.map(res => res.json()));

          const popularMovies = (movieData.results || []).map((m: any) => ({ ...m, media_type: 'movie' as const }));
          const popularTv = (tvData.results || []).map((t: any) => ({ ...t, media_type: 'tv' as const }));
          allPopular.push(...popularMovies, ...popularTv);
        }

        const uniqueItems = Array.from(new Map(allPopular.map(item => [item.id, item])).values())
            .filter(item => item.poster_path && item.overview);
        
        const filtered = uniqueItems.filter(item => !seenMovieIds.has(String(item.id)));
        
        const moviesToShow = filtered.length > 20 ? filtered : uniqueItems;
        const shuffledMovies = moviesToShow.sort(() => 0.5 - Math.random()).slice(0, 50); // Limit to 50 cards at a time
        
        setMovies(shuffledMovies);
        updateCurrentIndex(shuffledMovies.length - 1);

    } catch (error) {
        console.error("Error fetching discover feed:", error);
        toast({ variant: 'destructive', title: 'Could not load recommendations', description: 'There was an issue connecting to the movie database.' });
        setMovies([]);
    } finally {
        setLoading(false);
    }
  }, [firebaseUser, toast, authLoading]);

  useEffect(() => {
    fetchDiscoverMovies();
  }, [fetchDiscoverMovies]);

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

  const handleRateMovie = async (movieId: number, mediaType: 'movie' | 'tv', rating: number) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
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
       let description = error.message || 'Could not save your rating.';
       if (error.code === 'permission-denied') {
           description = "Your rating could not be saved due to a permissions issue. Please check your Firestore rules.";
       }
       toast({ variant: 'destructive', title: 'Error Saving Rating', description });
    }
  };
  
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

  const swiped = (direction: 'left' | 'right', movie: Movie, index: number) => {
    updateCurrentIndex(index - 1);
    if (direction === 'right') {
        handleRateMovie(movie.id, movie.media_type, 5);
    }
  };
  
  const outOfFrame = (name: string, idx: number) => {
    // This is a safety check. If the card goes out of frame and it's the one we're tracking,
    // we make sure our index moves past it.
    if (currentIndexRef.current >= idx) {
        childRefs[idx].current = null;
        updateCurrentIndex(idx - 1);
    }
  }

  const renderContent = () => {
      if (loading || authLoading) {
        return <DiscoverCard onRate={()=>{}} onToggleWatched={()=>{}}/>;
      }
    
      if (movies.length === 0) {
        return (
            <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
              <Film className="h-16 w-16" />
              <p className="text-lg">Could Not Load Movies</p>
              <p className="text-sm">Please check your connection and try again later.</p>
               <Button onClick={() => fetchDiscoverMovies(true)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Try Again
               </Button>
            </div>
        );
      }
      
      if (currentIndex < 0) {
        return (
            <div className="text-center text-muted-foreground flex flex-col items-center gap-4">
              <Film className="h-16 w-16" />
              <p className="text-lg">That's all for now!</p>
              <p className="text-sm">You've swiped through all the available titles.</p>
              <Button onClick={() => fetchDiscoverMovies(true)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Load More
              </Button>
            </div>
        )
      }

      return (
         <div className="relative w-full max-w-sm h-[75vh]">
            {movies.map((movie, index) => (
                <TinderCard
                    ref={childRefs[index]}
                    className="absolute"
                    key={movie.id}
                    onSwipe={(dir) => swiped(dir as 'left' | 'right', movie, index)}
                    onCardLeftScreen={() => outOfFrame(movie.title || 'movie', index)}
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
      )
  }

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
        {renderContent()}
      </div>

      {!loading && !authLoading && movies.length > 0 && currentIndex >= 0 && (
        <div className="flex items-center gap-6 mt-4 z-10">
            <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-destructive text-destructive hover:bg-destructive/10" onClick={() => swipe('left')} disabled={!canSwipe}>
                <XIcon className="h-8 w-8" />
            </Button>
            <Button variant="outline" size="icon" className="w-16 h-16 rounded-full border-2 border-primary text-primary hover:bg-primary/10" onClick={() => swipe('right')} disabled={!canSwipe}>
                <Heart className="h-8 w-8" />
            </Button>
        </div>
      )}
    </div>
  );
}
