
'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Loader2, Heart } from 'lucide-react';
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

interface LikedMovie {
  movieId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  poster?: string;
}

interface ProfileLikesProps {
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

export function ProfileLikes({ userId }: ProfileLikesProps) {
  const [likedMovies, setLikedMovies] = useState<LikedMovie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, async (doc) => {
      setLoading(true);
      if (doc.exists()) {
        const likes: LikedMovie[] = doc.data().likedMovies || [];
        
        // Fetch posters if they are missing
        const moviesWithPosters = await Promise.all(likes.map(async (movie) => {
            if (!movie.poster) {
                const posterPath = await fetchPoster(movie.movieId, movie.mediaType);
                return { ...movie, poster: posterPath };
            }
            return movie;
        }));
        setLikedMovies(moviesWithPosters.reverse());
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

  if (likedMovies.length === 0) {
    return (
      <Card className="text-center py-10 flex flex-col items-center justify-center">
        <CardHeader>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                <Heart className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>No Likes Yet</CardTitle>
            <CardDescription>
                Go to the Discover page to start liking movies and shows!
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Button asChild>
                <Link href="/discover">Start Liking</Link>
            </Button>
        </CardContent>
    </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {likedMovies.map((movie) => {
        const posterUrl = movie.poster
          ? `https://image.tmdb.org/t/p/w500${movie.poster}`
          : 'https://placehold.co/500x750.png';
        const href = `/search/${movie.mediaType}/${movie.movieId}`;

        return (
          <Link href={href} key={`${movie.movieId}-${movie.mediaType}`}>
            <Card className="overflow-hidden group relative">
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
