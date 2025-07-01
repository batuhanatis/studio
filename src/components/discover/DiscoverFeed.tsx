
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from 'firebase/firestore';
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

  useEffect(() => {
    async function fetchMovies() {
      setLoading(true);
      try {
        const movieRes = await fetch(
          `https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`
        );
        const tvRes = await fetch(
          `https://api.themoviedb.org/3/discover/tv?api_key=${API_KEY}&language=en-US&sort_by=popularity.desc&include_adult=false&page=1`
        );

        if (!movieRes.ok || !tvRes.ok) throw new Error('Failed to fetch from TMDB');
        
        const movieData = await movieRes.json();
        const tvData = await tvRes.json();

        const combined = [
          ...movieData.results.map((m: any) => ({ ...m, media_type: 'movie' })),
          ...tvData.results.map((t: any) => ({ ...t, media_type: 'tv' })),
        ]
          .filter(item => item.poster_path && item.overview)
          .sort(() => 0.5 - Math.random()); // Shuffle

        setMovies(combined);
      } catch (error) {
        console.error("Error fetching discover feed:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load movies.' });
      } finally {
        setLoading(false);
      }
    }
    fetchMovies();
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    setLoadingUserData(true);
    const userDocRef = doc(db, 'users', user.uid);
    getDoc(userDocRef).then((docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRatings(data.ratedMovies || []);
        setUserWatched(data.watchedMovies || []);
      }
      setLoadingUserData(false);
    });
  }, [user]);

  const handleRateMovie = async (movieId: number, mediaType: 'movie' | 'tv', rating: number) => {
    if (!user) return;
    const movieIdentifier = { movieId: String(movieId), mediaType };
    
    const newRatings = [...userRatings.filter(r => r.movieId !== String(movieId) || r.mediaType !== mediaType), {...movieIdentifier, rating}];
    setUserRatings(newRatings);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, { ratedMovies: newRatings });
      toast({ title: 'Rating saved!', description: 'Your recommendations will be updated.' });
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Could not save rating.' });
    }
  };

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!user) return;
    const movieIdentifier = { movieId: String(movieId), mediaType };
    
    if (isWatched) {
        setUserWatched(prev => [...prev, movieIdentifier]);
        await updateDoc(doc(db, 'users', user.uid), { watchedMovies: arrayUnion(movieIdentifier) });
    } else {
        setUserWatched(prev => prev.filter(m => m.movieId !== String(movieId) || m.mediaType !== mediaType));
        await updateDoc(doc(db, 'users', user.uid), { watchedMovies: arrayRemove(movieIdentifier) });
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


  if (loading || loadingUserData) {
    return (
      <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Loading your next discovery...</p>
      </div>
    );
  }

  if (movies.length === 0) {
    return (
      <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
        <Film className="h-16 w-16" />
        <p className="text-lg">Could not load movies.</p>
        <p className="text-sm">Please try again later.</p>
      </div>
    );
  }

  const currentMovie = movies[currentIndex];
  const currentRating = userRatings.find(r => r.movieId === String(currentMovie?.id) && r.mediaType === currentMovie?.media_type)?.rating || 0;
  const currentIsWatched = userWatched.some(m => m.movieId === String(currentMovie?.id) && m.mediaType === currentMovie?.media_type);

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
        <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
            {movies.map((movie, index) => (
                <div className="relative flex-[0_0_100%]" key={movie.id}>
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
    </div>
  );
}
