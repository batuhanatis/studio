
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, onSnapshot, runTransaction, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Film } from 'lucide-react';
import useEmblaCarousel from 'embla-carousel-react';
import { DiscoverCard } from './DiscoverCard';

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
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });

  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [userRatings, setUserRatings] = useState<UserRatingData[]>([]);
  const [userWatched, setUserWatched] = useState<UserMovieData[]>([]);
  const [loadingUserData, setLoadingUserData] = useState(true);

  const fetchAndSetMovies = useCallback(async () => {
    setLoading(true);
    try {
      let initialMovies: Movie[] = [];
      let ratedMovies: UserRatingData[] = [];
      let watchedMovies: UserMovieData[] = [];

      if (user) {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userData = userDoc.data();
            ratedMovies = userData.ratedMovies || [];
            watchedMovies = userData.watchedMovies || [];
          }
        } catch (dbError) {
          console.warn("Could not fetch user ratings, falling back to popular titles.", dbError);
          // Gracefully continue without user data, popular titles will be fetched.
        }
      }
      
      const seenMovieIds = new Set([...ratedMovies.map(m => m.movieId), ...watchedMovies.map(m => m.movieId)]);
      const highlyRated = ratedMovies.filter(r => r.rating >= 4);

      if (highlyRated.length > 0) {
        const seedMovie = highlyRated[Math.floor(Math.random() * highlyRated.length)];
        const res = await fetch(`https://api.themoviedb.org/3/${seedMovie.mediaType}/${seedMovie.movieId}/recommendations?api_key=${API_KEY}&language=en-US`);
        if (res.ok) {
            const data = await res.json();
            initialMovies = (data.results || [])
                .map((m: any) => ({...m, media_type: m.media_type || seedMovie.mediaType}))
                .filter((m: Movie) => m.poster_path && m.overview && !seenMovieIds.has(String(m.id)));
        }
      }

      if (initialMovies.length < 20) {
        const movieRes = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`);
        const tvRes = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`);
        
        if (!movieRes.ok || !tvRes.ok) {
            throw new Error("Failed to fetch from TMDB API");
        }
        
        const movieData = await movieRes.json();
        const tvData = await tvRes.json();

        const popular = [
            ...(movieData.results || []).map((m: any) => ({ ...m, media_type: 'movie' })),
            ...(tvData.results || []).map((t: any) => ({ ...t, media_type: 'tv' })),
        ].filter(item => item.poster_path && item.overview && !seenMovieIds.has(String(item.id)));
        
        const existingIds = new Set(initialMovies.map(r => r.id));
        const uniquePopular = popular.filter(p => !existingIds.has(p.id));

        initialMovies.push(...uniquePopular);
      }
      
      if (initialMovies.length === 0 && seenMovieIds.size > 0) {
         // This is the correct case for the "no new movies" message.
      } else if (initialMovies.length === 0) {
        // If we still have no movies, it means the TMDB API calls likely failed.
        throw new Error("Failed to fetch any movies from the API.");
      }

      setMovies(initialMovies.sort(() => 0.5 - Math.random()));
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
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
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
    if (!user) {
        toast({ variant: 'destructive', title: 'Not signed in', description: 'You must be signed in to rate movies.' });
        return;
    }
    const userDocRef = doc(db, 'users', user.uid);
    const movieIdStr = String(movieId);

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("User profile not found. Please try again.");
            }
            
            const data = userDoc.data();
            const currentRatings: any[] = data.ratedMovies ? [...data.ratedMovies] : [];
            
            const ratingIndex = currentRatings.findIndex(r => r.movieId === movieIdStr && r.mediaType === mediaType);

            if (ratingIndex > -1) {
                // Update existing rating if it changed
                if (currentRatings[ratingIndex].rating === rating) return; // No change needed
                currentRatings[ratingIndex].rating = rating;
            } else {
                // Add new rating
                currentRatings.push({ movieId: movieIdStr, mediaType, rating });
            }
            
            transaction.update(userDocRef, { ratedMovies: currentRatings });
        });

        toast({ title: 'Rating saved!', description: 'Your recommendations will be updated based on your new rating.' });
      
        if (rating >= 4) {
            const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}/recommendations?api_key=${API_KEY}&language=en-US`);
            if (res.ok) {
                const data = await res.json();
                const seenMovieIds = new Set([
                    ...userRatings.map(m => m.movieId), 
                    ...userWatched.map(m => m.movieId),
                    ...movies.map(m => String(m.id)),
                    String(movieId)
                ]);
                const newRecs = (data.results || [])
                    .map((m: any) => ({...m, media_type: m.media_type || mediaType}))
                    .filter((m: Movie) => m.poster_path && m.overview && !seenMovieIds.has(String(m.id)));
                
                if (newRecs.length > 0) {
                    setMovies(prev => [...prev, ...newRecs.sort(() => 0.5 - Math.random())]);
                    toast({ title: "We've found more for you!", description: "New recommendations added to your queue."});
                }
            }
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

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrentIndex(emblaApi.selectedScrollSnap());
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect) };
  }, [emblaApi]);


  return (
    <div className="w-full">
       <div className="text-center mb-8">
            <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
                Discover New Titles
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
                Rate movies and shows to get better recommendations.
            </p>
        </div>
        
        { (loading || loadingUserData) && movies.length === 0 ? (
            <DiscoverCard />
        ) : !loading && movies.length === 0 ? (
             <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
                <Film className="h-16 w-16" />
                <p className="text-lg">No New Movies to Discover</p>
                <p className="text-sm">You've rated all available movies, or we couldn't find any. Try again later!</p>
            </div>
        ) : (
            <div className="overflow-hidden" ref={emblaRef}>
                <div className="flex">
                {movies.map((movie, index) => (
                    <div className="relative flex-[0_0_100%]" key={`${movie.id}-${index}`}>
                        <DiscoverCard
                            movie={movie}
                            rating={userRatings.find(r => r.movieId === String(movie.id) && r.mediaType === movie.media_type)?.rating || 0}
                            isWatched={userWatched.some(m => m.movieId === String(movie.id) && m.mediaType === movie.media_type)}
                            onRate={(rating) => handleRateMovie(movie.id, movie.media_type, rating)}
                            onToggleWatched={(watched) => handleToggleWatched(movie.id, movie.media_type, watched)}
                            onPrev={scrollPrev}
                            onNext={scrollNext}
                            isFirst={index === 0}
                            isLast={index === movies.length - 1}
                        />
                    </div>
                ))}
                </div>
            </div>
        )}
    </div>
  );
}
