
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2, Star } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';


interface RatedMovie {
  movieId: string;
  mediaType: 'movie' | 'tv';
  rating: number;
  title: string;
  poster?: string;
}

interface ProfileRatingsProps {
  userId: string;
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

async function fetchPoster(movieId: string, mediaType: 'movie' | 'tv') {
    try {
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${API_KEY}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.poster_path;
    } catch {
        return null;
    }
}

export function ProfileRatings({ userId }: ProfileRatingsProps) {
  const [ratedMovies, setRatedMovies] = useState<RatedMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, async (doc) => {
      setLoading(true);
      if (doc.exists()) {
        const ratings: RatedMovie[] = doc.data().ratedMovies || [];
        
        // Fetch posters if they don't exist
        const moviesWithPosters = await Promise.all(ratings.map(async (movie) => {
            if (!movie.poster) {
                const posterPath = await fetchPoster(movie.movieId, movie.mediaType);
                return { ...movie, poster: posterPath };
            }
            return movie;
        }));
        setRatedMovies(moviesWithPosters.sort((a,b) => b.rating - a.rating));
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (ratedMovies.length === 0) {
    return (
      <Card className="text-center py-10 flex flex-col items-center justify-center">
        <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Star className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No Ratings Yet</CardTitle>
            <CardDescription>
                Go to the Discover page to start rating movies and shows!
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild>
                <Link href="/discover">Start Rating</Link>
            </Button>
        </CardContent>
    </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-4">
      {ratedMovies.map((movie) => {
        const posterUrl = movie.poster
          ? `https://image.tmdb.org/t/p/w500${movie.poster}`
          : 'https://placehold.co/500x750.png';
        const href = `/search/${movie.mediaType}/${movie.movieId}`;

        return (
          <Link href={href} key={`${movie.movieId}-${movie.mediaType}`}>
            <Card className="overflow-hidden group relative">
                <div className="aspect-[2/3] w-full bg-muted">
                    <Image
                        src={posterUrl}
                        alt={`Poster for ${movie.title}`}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                        data-ai-hint="movie poster"
                    />
                </div>
                <div className="absolute top-2 right-2">
                    <Badge variant="destructive" className="flex items-center gap-1 text-base bg-black/70 backdrop-blur-sm border-accent/50 text-accent font-bold">
                        <Star className="h-4 w-4 fill-accent" /> {movie.rating}
                    </Badge>
                </div>
                 <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/90 to-transparent p-3 flex items-end">
                    <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">{movie.title}</h3>
                 </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
