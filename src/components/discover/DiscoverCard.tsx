
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Rating } from './Rating';
import { Eye, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Skeleton } from '../ui/skeleton';

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

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface DiscoverCardProps {
  movie?: Movie;
  rating?: number;
  isWatched?: boolean;
  onRate?: (rating: number) => void;
  onToggleWatched?: (watched: boolean) => void;
  onNext?: () => void;
  onPrev?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function DiscoverCard({ movie, rating = 0, isWatched = false, onRate, onToggleWatched, onNext, onPrev, isFirst, isLast }: DiscoverCardProps) {
  const [platforms, setPlatforms] = useState<WatchProvider[] | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  useEffect(() => {
    if (!movie) return;
    setLoadingProviders(true);
    let isCancelled = false;
    
    async function getWatchProviders(id: number, type: 'movie' | 'tv') {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`);
        if (isCancelled || !res.ok) return;
        const json = await res.json();
        if (isCancelled) return;
        
        const tr = json.results?.TR;
        if (!tr) {
            setPlatforms([]);
            return;
        }

        const allProviders: WatchProvider[] = [
          ...(tr.flatrate || []),
          ...(tr.buy || []),
          ...(tr.rent || []),
        ];
        const unique = allProviders.filter((v, i, a) => a.findIndex((t) => t.provider_id === v.provider_id) === i);
        setPlatforms(unique);
      } catch (error) {
        if (!isCancelled) setPlatforms([]);
      } finally {
        if (!isCancelled) setLoadingProviders(false);
      }
    }
    getWatchProviders(movie.id, movie.media_type);

    return () => { isCancelled = true; }
  }, [movie]);
  
  if (!movie || !onRate || !onToggleWatched || !onNext || !onPrev) {
    return (
       <Card className="relative w-full max-w-sm mx-auto overflow-hidden shadow-2xl animate-pulse">
        <CardContent className="p-0">
          <Skeleton className="aspect-[2/3] w-full" />
        </CardContent>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
        <div className="absolute bottom-0 w-full p-6 text-white">
          <CardHeader className="p-0 space-y-2">
            <Skeleton className="h-9 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/4 rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </CardHeader>
           <Skeleton className="h-8 w-full mt-4 rounded-md" />
          <CardFooter className="mt-4 flex flex-col items-center gap-4 p-0">
             <Skeleton className="h-10 w-40 rounded-full" />
             <Skeleton className="h-6 w-32 rounded-md" />
          </CardFooter>
        </div>
      </Card>
    )
  }

  const title = movie.title || movie.name || 'Untitled';
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://placehold.co/500x750.png';
  const releaseYear = movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4);
  const href = `/search/${movie.media_type}/${movie.id}?title=${encodeURIComponent(title)}&poster=${movie.poster_path}&rating=${movie.vote_average}&year=${releaseYear || ''}`;

  return (
    <Card className="relative w-full max-w-sm mx-auto overflow-hidden shadow-2xl">
      <CardContent className="p-0">
        <Link href={href} className="block w-full" aria-label={`View details for ${title}`}>
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
        </Link>
      </CardContent>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 w-full p-6 text-white">
        <CardHeader className="p-0">
          <CardTitle className="text-3xl font-bold font-headline tracking-tight text-white drop-shadow-md">{title}</CardTitle>
           <div className="mt-2 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-400" />
              <span className="font-semibold drop-shadow-sm">{movie.vote_average.toFixed(1)}</span>
              <span className="text-white/80">/ 10</span>
            </div>
            {releaseYear && <span className="text-white/80">·</span>}
            {releaseYear && <span className="drop-shadow-sm">{releaseYear}</span>}
          </div>
          <CardDescription className="line-clamp-2 text-white/90 drop-shadow-sm mt-1">
            {movie.overview}
          </CardDescription>
        </CardHeader>
        
        <div className="mt-4 h-8">
          { !loadingProviders && platforms && platforms.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap animate-in fade-in">
                {platforms.slice(0, 4).map((p) => (
                  <div key={p.provider_id} className="relative h-8 w-8 overflow-hidden rounded-md bg-white/90 shadow-sm" title={p.provider_name}>
                    <Image
                      src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                      alt={`${p.provider_name} logo`}
                      fill
                      className="object-contain p-0.5"
                      sizes="32px"
                    />
                  </div>
                ))}
              </div>
            )
          }
        </div>

        <CardFooter className="mt-4 flex flex-col items-center gap-4 p-0">
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
