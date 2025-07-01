
'use client';

import Image from 'next/image';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Rating } from './Rating';
import { Eye, ChevronLeft, ChevronRight } from 'lucide-react';

interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
  overview: string;
}

interface DiscoverCardProps {
  movie: Movie;
  rating: number;
  isWatched: boolean;
  onRate: (rating: number) => void;
  onToggleWatched: (watched: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function DiscoverCard({ movie, rating, isWatched, onRate, onToggleWatched, onNext, onPrev, isFirst, isLast }: DiscoverCardProps) {
  const title = movie.title || movie.name || 'Untitled';
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : 'https://placehold.co/500x750.png';

  return (
    <Card className="relative w-full max-w-sm mx-auto overflow-hidden shadow-2xl">
      <CardContent className="p-0">
        <div className="relative aspect-[2/3] w-full">
          <Image
            src={posterUrl}
            alt={`Poster for ${title}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 500px"
            data-ai-hint="movie poster"
            priority
          />
        </div>
      </CardContent>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      <div className="absolute bottom-0 w-full p-6 text-white">
        <CardHeader className="p-0">
          <CardTitle className="text-3xl font-bold font-headline tracking-tight text-white drop-shadow-md">{title}</CardTitle>
          <CardDescription className="line-clamp-3 text-white/90 drop-shadow-sm mt-2">
            {movie.overview}
          </CardDescription>
        </CardHeader>
        <CardFooter className="mt-6 flex flex-col items-center gap-6 p-0">
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm font-semibold">Rate this {movie.media_type === 'movie' ? 'movie' : 'show'}</p>
            <Rating rating={rating} onRatingChange={onRate} />
          </div>
          <div className="flex items-center space-x-2">
             <Checkbox
                id={`watched-${movie.id}`}
                checked={isWatched}
                onCheckedChange={onToggleWatched}
                className="border-white text-white data-[state=checked]:bg-primary data-[state=checked]:border-primary"
             />
             <label
                htmlFor={`watched-${movie.id}`}
                className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
             >
                <Eye className="h-4 w-4" />
                Mark as Watched
             </label>
           </div>
        </CardFooter>
      </div>
      
       <Button
        variant="outline"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75 disabled:opacity-30"
        onClick={onPrev}
        disabled={isFirst}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/50 text-white hover:bg-black/75 disabled:opacity-30"
        onClick={onNext}
        disabled={isLast}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </Card>
  );
}
