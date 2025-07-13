
'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Rating } from './Rating';
import { Eye, Star } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { AddToWatchlistButton } from '../watchlists/AddToWatchlistButton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
  onRate: (rating: number) => void;
  onToggleWatched: (watched: boolean) => void;
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

const DiscoverCard = React.forwardRef<HTMLDivElement, DiscoverCardProps>(
  ({ movie, rating = 0, isWatched = false, onRate, onToggleWatched }, ref) => {
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
        } catch {
          if (!isCancelled) setPlatforms([]);
        } finally {
          if (!isCancelled) setLoadingProviders(false);
        }
      }
      getWatchProviders(movie.id, movie.media_type);

      return () => { isCancelled = true; }
    }, [movie]);
    
    if (!movie) {
      return (
        <div ref={ref}>
          <Card className="w-full max-w-sm h-[75vh] mx-auto overflow-hidden shadow-2xl animate-pulse rounded-2xl">
              <Skeleton className="w-full h-full" />
          </Card>
        </div>
      )
    }

    const title = movie.title || movie.name || 'Untitled';
    const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://placehold.co/500x750.png';
    const releaseYear = movie.release_date?.substring(0, 4) || movie.first_air_date?.substring(0, 4);
    const href = `/search/${movie.media_type}/${movie.id}?title=${encodeURIComponent(title)}&poster=${movie.poster_path}&rating=${movie.vote_average}&year=${releaseYear || ''}`;
    
    const movieDetails = {
      id: movie.id,
      media_type: movie.media_type,
      title: title,
      poster: movie.poster_path,
      vote_average: movie.vote_average,
      release_date: movie.release_date,
      first_air_date: movie.first_air_date,
    };

    return (
      <div ref={ref} className="w-full max-w-sm mx-auto">
        <Card className="w-full h-[75vh] overflow-y-auto shadow-2xl rounded-2xl group cursor-grab active:cursor-grabbing snap-y snap-mandatory scrollbar-hide">
            {/* Poster Section */}
            <div className="h-full w-full flex-shrink-0 snap-start">
              <div className="relative w-full aspect-[2/3]">
                  <Image
                    src={posterUrl}
                    alt={`Poster for ${title}`}
                    fill
                    style={{ objectFit: "cover" }}
                    sizes="(max-width: 640px) 100vw, 384px"
                    priority
                    data-ai-hint="movie poster"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>

            {/* Content Section */}
            <div className="bg-card w-full p-4 snap-start">
                <CardHeader className="p-0">
                    <Link href={href}><CardTitle className="text-2xl font-bold font-headline tracking-tight hover:underline">{title}</CardTitle></Link>
                    <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-amber-400" />
                          <span className="font-semibold text-foreground">{movie.vote_average.toFixed(1)}</span>
                          <span>/ 10</span>
                        </div>
                        {releaseYear && <span className="text-sm">·</span>}
                        {releaseYear && <span>{releaseYear}</span>}
                    </div>
                    <CardDescription className="pt-2 text-base text-card-foreground/90">
                        {movie.overview}
                    </CardDescription>
                </CardHeader>
                
                <Separator className="my-4" />

                <CardContent className="p-0 space-y-4">
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold text-muted-foreground">Rate this {movie.media_type === 'movie' ? 'movie' : 'show'}</h3>
                        <Rating rating={rating} onRatingChange={onRate} />
                    </div>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id={`watched-${movie.id}`}
                                checked={isWatched}
                                onCheckedChange={onToggleWatched}
                            />
                            <label
                                htmlFor={`watched-${movie.id}`}
                                className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                            >
                                <Eye className="h-4 w-4" />
                                Mark as Watched
                            </label>
                        </div>
                        <AddToWatchlistButton movie={movieDetails} isIconOnly={true} />
                    </div>

                    <Separator className="my-4" />

                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground mb-2">Watch in Türkiye</h3>
                        {loadingProviders ? (
                            <div className="flex gap-2">
                                <Skeleton className="h-10 w-10 rounded-md" />
                                <Skeleton className="h-10 w-10 rounded-md" />
                            </div>
                        ) : platforms && platforms.length > 0 ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                {platforms.slice(0, 5).map((p) => (
                                <div key={p.provider_id} className="relative h-10 w-10 overflow-hidden rounded-md bg-white/90 shadow-sm" title={p.provider_name}>
                                    <Image
                                      src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                                      alt={`${p.provider_name} logo`}
                                      fill
                                      className="object-contain p-1"
                                      sizes="40px"
                                    />
                                </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No streaming platforms found.</p>
                        )}
                    </div>
                </CardContent>
            </div>
        </Card>
      </div>
    );
  }
);

DiscoverCard.displayName = "DiscoverCard";
export { DiscoverCard };
