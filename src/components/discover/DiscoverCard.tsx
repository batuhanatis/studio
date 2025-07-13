
'use client';

import React, { forwardRef } from 'react';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye, Star, ListPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AddToWatchlistButton } from '../watchlists/AddToWatchlistButton';
import { Separator } from '../ui/separator';

interface DiscoverCardProps {
    movie: any;
    isWatched?: boolean;
    platforms?: any[];
    onToggleWatched: (watched: boolean) => void;
    swipeDirection: 'left' | 'right' | null;
    swipeOpacity: number;
}

export const DiscoverCard = forwardRef<HTMLDivElement, DiscoverCardProps>(function DiscoverCard({ movie, isWatched = false, platforms, onToggleWatched, swipeDirection, swipeOpacity }, ref) {

  if (!movie) return null;

  const title = movie.title || movie.name || 'Untitled';
  const year = movie.release_date?.slice(0, 4) || movie.first_air_date?.slice(0, 4);
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://placehold.co/500x750.png';

  const movieDetailsForButton = {
    id: movie.id,
    media_type: movie.media_type,
    title: title,
    poster: movie.poster_path,
    vote_average: movie.vote_average,
    release_date: movie.release_date,
    first_air_date: movie.first_air_date,
  };

  return (
    <Card
      ref={ref}
      className="h-full w-full overflow-y-auto scrollbar-hide bg-card shadow-2xl"
    >
      <div className="relative aspect-[2/3] w-full flex-shrink-0">
        <Image
          src={posterUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="100vw"
          priority
          data-ai-hint="movie poster"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />
        
        <div
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
          style={{ opacity: swipeOpacity }}
        >
          {swipeDirection === 'right' && (
            <div className="transform -rotate-12 rounded-lg border-4 border-green-500 bg-green-500/10 px-8 py-4 font-bold text-green-500 text-5xl tracking-widest">
              LIKE
            </div>
          )}
          {swipeDirection === 'left' && (
            <div className="transform rotate-12 rounded-lg border-4 border-destructive bg-destructive/10 px-8 py-4 font-bold text-destructive text-5xl tracking-widest">
              NOPE
            </div>
          )}
        </div>
      </div>

      <div className="w-full bg-card p-4 text-white">
        <h1 className="text-3xl font-bold font-headline mb-1">{title}</h1>
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
            <span>{year}</span>
            <div className="flex items-center gap-1.5 text-foreground">
                <Star className="h-5 w-5 text-accent fill-accent" />
                <span className="font-bold text-lg">{movie.vote_average.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">/ 10</span>
            </div>
        </div>

        <p className="text-base leading-relaxed line-clamp-4 text-foreground/80">{movie.overview}</p>

        <div className="space-y-4 pt-6">
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox id={`watched-${movie.id}`} checked={isWatched} onCheckedChange={onToggleWatched} />
                <label htmlFor={`watched-${movie.id}`} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <Eye className="w-4 h-4" /> Watched
                </label>
              </div>
              <AddToWatchlistButton movie={movieDetailsForButton} isIconOnly />
          </div>
        </div>
        
        {platforms && platforms.length > 0 && (
            <div className="pt-6">
                <Separator />
                <div className="mt-4">
                    <h2 className="text-sm font-semibold text-muted-foreground mb-3">Available on</h2>
                    <div className="flex flex-wrap gap-3">
                    {platforms.map((p) => (
                        <div key={p.provider_id} className="flex flex-col items-center gap-2 text-center w-16">
                            <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-secondary/50 shadow-sm">
                                <Image
                                src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                                alt={`${p.provider_name} logo`}
                                fill
                                className="object-contain p-1"
                                sizes="48px"
                                />
                            </div>
                        </div>
                    ))}
                    </div>
                </div>
            </div>
        )}
      </div>
    </Card>
  );
});
