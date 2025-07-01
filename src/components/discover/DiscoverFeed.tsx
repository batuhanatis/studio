
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
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
      const userDocRef = user ? doc(db, 'users', user.uid) : null;
      const userDoc = userDocRef ? await getDoc(userDocRef) : null;
      
      const userData = userDoc?.data();
      const ratedMovies: UserRatingData[] = userData?.ratedMovies || [];
      const watchedMovies: UserMovieData[] = userData?.watchedMovies || [];
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

      if (initialMovies.length < 10) {
        const movieRes = await fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`);
        const tvRes = await fetch(`https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`);
        
        const movieData = await movieRes.json();
        const tvData = await tvRes.json();

        const popular = [
            ...movieData.results.map((m: any) => ({ ...m, media_type: 'movie' })),
            ...tvData.results.map((t: any) => ({ ...t, media_type: 'tv' })),
        ].filter(item => item.poster_path && item.overview && !seenMovieIds.has(String(item.id)));
        
        const existingIds = new Set(initialMovies.map(r => r.id));
        const uniquePopular = popular.filter(p => !existingIds.has(p.id));

        initialMovies.push(...uniquePopular);
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
    if (!user) return;
    const movieIdentifier = { movieId: String(movieId), mediaType };
    
    const originalRatings = [...userRatings];
    const newRatings = [...originalRatings.filter(r => r.movieId !== String(movieId) || r.mediaType !== mediaType), {...movieIdentifier, rating}];
    setUserRatings(newRatings);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { ratedMovies: newRatings });
      toast({ title: 'Rating saved!', description: 'Your recommendations will be updated.' });
      
      if (rating >= 4) {
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}/recommendations?api_key=${API_KEY}&language=en-US`);
        if (res.ok) {
            const data = await res.json();
            const seenMovieIds = new Set([
                ...newRatings.map(m => m.movieId), 
                ...userWatched.map(m => m.movieId),
                ...movies.map(m => String(m.id))
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
    } catch (error) {
       setUserRatings(originalRatings);
       toast({ variant: 'destructive', title: 'Error', description: 'Could not save rating.' });
    }
  };

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!user) return;
    const movieIdentifier = { movieId: String(movieId), mediaType };
    
    const originalWatched = [...userWatched];
    if (isWatched) {
        setUserWatched(prev => [...prev, movieIdentifier]);
    } else {
        setUserWatched(prev => prev.filter(m => m.movieId !== String(movieId) || m.mediaType !== mediaType));
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      if (isWatched) {
        await updateDoc(userDocRef, { watchedMovies: arrayUnion(movieIdentifier) });
      } else {
        await updateDoc(userDocRef, { watchedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      setUserWatched(originalWatched);
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
