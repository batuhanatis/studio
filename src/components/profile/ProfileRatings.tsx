
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
      <div className="text-center py-10">
        <p className="text-muted-foreground">No ratings yet.</p>
        <p className="text-sm text-muted-foreground">Go to Discover to start rating movies and shows!</p>
        <Button asChild className="mt-4">
            <Link href="/discover">Discover</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
      {ratedMovies.map((movie) => {
        const posterUrl = movie.poster
          ? `https://image.tmdb.org/t/p/w500${movie.poster}`
          : 'https://placehold.co/500x750.png';
        const href = `/search/${movie.mediaType}/${movie.movieId}?title=${encodeURIComponent(movie.title)}`;

        return (
          <Link href={href} key={movie.movieId}>
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
                    <Badge variant="destructive" className="flex items-center gap-1">
                        <Star className="h-3 w-3" /> {movie.rating}
                    </Badge>
                </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

