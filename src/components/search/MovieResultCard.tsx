
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Film, Tv, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '../ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { AddToWatchlistButton } from '../watchlists/AddToWatchlistButton';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
  vote_average: number;
  popularity: number;
  release_date?: string;
  first_air_date?: string;
}

interface MovieResultCardProps {
  item: SearchResult;
  isWatched: boolean;
  onToggleWatched: (watched: boolean) => void;
}

export function MovieResultCard({ item, isWatched, onToggleWatched }: MovieResultCardProps) {
  const title = item.title || item.name || 'Untitled';
  const releaseYear = item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4);
  const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://placehold.co/500x750.png';
  const href = `/search/${item.media_type}/${item.id}`;

  const movieDetails = {
    id: item.id,
    media_type: item.media_type,
    title: title,
    poster: item.poster_path,
    vote_average: item.vote_average,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };

  return (
    <Card className="shadow-md overflow-hidden hover:shadow-lg hover:shadow-primary/20 transition-all duration-300 flex flex-col h-full bg-card group border-border/60 hover:border-primary/40">
      <Link href={href} className="block relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="aspect-[2/3] w-full bg-muted overflow-hidden">
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
            data-ai-hint="movie poster"
          />
        </div>
      </Link>
      <CardContent className="p-3 flex flex-col flex-grow">
        <Link href={href} className="flex-grow">
          <h3 className="font-bold font-headline line-clamp-2 leading-tight hover:text-primary transition-colors">{title}</h3>
        </Link>
        <div className="mt-auto pt-2 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                    {item.media_type === 'movie' ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
                    <span>{releaseYear || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-accent" />
                    <span className="font-semibold text-foreground">{item.vote_average > 0 ? `${item.vote_average.toFixed(1)}` : 'N/A'}</span>
                </div>
            </div>
          
            <div className="flex items-center justify-between mt-2 border-t border-border/60 pt-2">
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`watched-card-${item.id}`}
                        checked={isWatched}
                        onCheckedChange={onToggleWatched}
                        aria-label="Mark as watched"
                    />
                    <label
                        htmlFor={`watched-card-${item.id}`}
                        className="text-xs text-muted-foreground cursor-pointer"
                    >
                        Watched
                    </label>
                </div>
                <AddToWatchlistButton movie={movieDetails} isIconOnly={true} />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
