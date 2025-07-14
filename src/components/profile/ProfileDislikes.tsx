'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2, ThumbsDown } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '../ui/button';

interface DislikedMovie {
  movieId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  poster?: string;
}

interface ProfileDislikesProps {
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

export function ProfileDislikes({ userId }: ProfileDislikesProps) {
  const [dislikedMovies, setDislikedMovies] = useState<DislikedMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, async (doc) => {
      setLoading(true);
      if (doc.exists()) {
        const dislikes: DislikedMovie[] = doc.data().dislikedMovies || [];
        
        const moviesWithPosters = await Promise.all(dislikes.map(async (movie) => {
            if (!movie.poster) {
                const posterPath = await fetchPoster(movie.movieId, movie.mediaType);
                return { ...movie, poster: posterPath };
            }
            return movie;
        }));
        setDislikedMovies(moviesWithPosters.reverse());
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

  if (dislikedMovies.length === 0) {
    return (
      <Card className="flex flex-col items-center justify-center py-10 text-center">
        <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <ThumbsDown className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No Dislikes Yet</CardTitle>
            <CardDescription>
                Dislike movies and shows on their detail pages or in the Discover feed.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild>
                <Link href="/discover">Start Discovering</Link>
            </Button>
        </CardContent>
    </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {dislikedMovies.map((movie) => {
        const posterUrl = movie.poster
          ? `https://image.tmdb.org/t/p/w500${movie.poster}`
          : 'https://placehold.co/500x750.png';
        const href = `/search/${movie.mediaType}/${movie.movieId}`;

        return (
          <Link href={href} key={`${movie.movieId}-${movie.mediaType}`}>
            <Card className="group relative overflow-hidden">
              <div style={{ position: 'relative', width: '100%', aspectRatio: '2 / 3' }}>
                <Image
                  src={posterUrl}
                  alt={`Poster for ${movie.title}`}
                  fill
                  style={{ objectFit: 'cover' }}
                  className="transition-transform group-hover:scale-105"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  data-ai-hint="movie poster"
                />
              </div>
               <div className="absolute inset-x-0 bottom-0 flex h-1/3 items-end bg-gradient-to-t from-black/90 to-transparent p-3">
                  <h3 className="text-lg font-bold leading-tight text-white line-clamp-2">{movie.title}</h3>
               </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
