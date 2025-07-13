
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2, Film, CheckCircle } from 'lucide-react';
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

interface WatchedMovie {
  movieId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  poster?: string;
}

interface ProfileWatchedProps {
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

export function ProfileWatched({ userId }: ProfileWatchedProps) {
  const [watchedMovies, setWatchedMovies] = useState<WatchedMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, async (doc) => {
      setLoading(true);
      if (doc.exists()) {
        const watched: WatchedMovie[] = doc.data().watchedMovies || [];
        
        const moviesWithData = await Promise.all(watched.map(async (movie) => {
            let poster = movie.poster;
            if (!poster) {
                poster = await fetchPoster(movie.movieId, movie.mediaType);
            }
            return { ...movie, poster };
        }));
        setWatchedMovies(moviesWithData.reverse());
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

  if (watchedMovies.length === 0) {
    return (
      <Card className="text-center py-10 flex flex-col items-center justify-center">
        <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <CheckCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Nothing Watched Yet</CardTitle>
            <CardDescription>
                Use the "Mark as Watched" checkbox on any movie or show page.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild>
                <Link href="/search">Find Something to Watch</Link>
            </Button>
        </CardContent>
    </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-4">
      {watchedMovies.map((movie) => {
        const posterUrl = movie.poster
          ? `https://image.tmdb.org/t/p/w500${movie.poster}`
          : 'https://placehold.co/500x750.png';
        const href = `/search/${movie.mediaType}/${movie.movieId}`;

        return (
          <Link href={href} key={`${movie.movieId}-${movie.mediaType}`}>
            <Card className="overflow-hidden group relative">
                <div className="relative w-full aspect-[2/3] bg-muted">
                    <Image
                        src={posterUrl}
                        alt={`Poster for ${movie.title}`}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                        data-ai-hint="movie poster"
                    />
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
