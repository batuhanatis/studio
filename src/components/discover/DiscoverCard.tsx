'use client';

import React, { forwardRef } from 'react';
import Image from 'next/image';
import { Star, ListPlus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AddToWatchlistButton } from '../watchlists/AddToWatchlistButton';
import { Separator } from '../ui/separator';

interface DiscoverCardProps {
    movie: any;
    platforms?: any[];
    swipeDirection: 'left' | 'right' | null;
    swipeOpacity: number;
}

export const DiscoverCard = forwardRef<HTMLDivElement, DiscoverCardProps>(function DiscoverCard({ movie, platforms, swipeDirection, swipeOpacity }, ref) {

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
      className="w-full h-full overflow-y-auto shadow-2xl bg-card scrollbar-hide"
    >
      <div className="relative flex-shrink-0 w-full aspect-[2/3]">
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
            <div className="px-6 py-3 font-bold tracking-widest text-green-500 transform border-4 border-green-500 rounded-lg -rotate-12 bg-green-500/10 text-4xl md:px-8 md:py-4 md:text-5xl">
              LIKE
            </div>
          )}
          {swipeDirection === 'left' && (
            <div className="px-6 py-3 font-bold tracking-widest text-destructive transform border-4 border-destructive rounded-lg rotate-12 bg-destructive/10 text-4xl md:px-8 md:py-4 md:text-5xl">
              NOPE
            </div>
          )}
        </div>
      </div>

      <div className="w-full p-4 text-white bg-card">
        <h1 className="mb-1 text-2xl font-bold md:text-3xl font-headline">{title}</h1>
        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
            <span>{year}</span>
            <div className="flex items-center gap-1.5 text-foreground">
                <Star className="w-4 h-4 text-accent md:h-5 md:w-5 fill-accent" />
                <span className="text-base font-bold md:text-lg">{movie.vote_average.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">/ 10</span>
            </div>
        </div>

        <p className="text-base leading-relaxed text-foreground/80 line-clamp-4">{movie.overview}</p>

        <div className="pt-6 space-y-4">
          <div className="flex items-center gap-4">
              <AddToWatchlistButton movie={movieDetailsForButton} />
          </div>
        </div>
        
        {platforms && platforms.length > 0 && (
            <div className="pt-6">
                <Separator />
                <div className="mt-4">
                    <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Available on</h2>
                    <div className="flex flex-wrap gap-3">
                    {platforms.map((p) => (
                        <div key={p.provider_id} className="flex flex-col items-center w-16 gap-2 text-center">
                            <div className="relative w-12 h-12 overflow-hidden rounded-lg shadow-sm bg-secondary/50">
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
