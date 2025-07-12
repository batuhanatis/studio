
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Film, Tv, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useEffect } from 'react';
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

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface MovieResultCardProps {
  item: SearchResult;
  isWatched: boolean;
  onToggleWatched: (watched: boolean) => void;
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function MovieResultCard({ item, isWatched, onToggleWatched }: MovieResultCardProps) {
  const [platforms, setPlatforms] = useState<WatchProvider[] | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  const title = item.title || item.name || 'Untitled';
  const releaseYear = item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4);
  const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://placehold.co/500x750.png';
  const href = `/search/${item.media_type}/${item.id}?title=${encodeURIComponent(title)}&poster=${item.poster_path}&rating=${item.vote_average}&year=${releaseYear || ''}`;

  const movieDetails = {
    id: item.id,
    media_type: item.media_type,
    title: title,
    poster: item.poster_path,
    vote_average: item.vote_average,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };

  useEffect(() => {
    let isCancelled = false;
    async function getWatchProviders(id: number, type: 'movie' | 'tv') {
      setLoadingProviders(true);
      try {
        const res = await fetch(`https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`);
        if (isCancelled || !res.ok) {
            if (!isCancelled) setPlatforms([]);
            return;
        }
        
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
        
        const unique = allProviders.filter(
          (v, i, a) => a.findIndex((t) => t.provider_id === v.provider_id) === i
        );
        if (!isCancelled) setPlatforms(unique);
      } catch (error) {
        if (!isCancelled) setPlatforms([]);
      } finally {
        if (!isCancelled) setLoadingProviders(false);
      }
    }
    
    getWatchProviders(item.id, item.media_type);
    
    return () => { isCancelled = true; }
  }, [item.id, item.media_type]);


  return (
    <div className="h-full">
        <Card className="shadow-md overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200 flex flex-col h-full bg-card">
        <Link href={href} className="block">
            <div className="relative w-full aspect-[2/3] bg-muted">
            <Image
                src={posterUrl}
                alt={title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                data-ai-hint="movie poster"
            />
            </div>
        </Link>
        <CardContent className="p-3 flex flex-col flex-grow">
            <Link href={href} className="flex-grow">
            <h3 className="text-base font-bold font-headline line-clamp-2 hover:underline">{title}</h3>
            </Link>
            <div className="mt-auto pt-2">
                <div className="h-8 mt-1 mb-2 flex items-center gap-1.5 flex-wrap">
                {loadingProviders ? (
                    <div className="flex gap-1.5">
                        <Skeleton className="h-6 w-6 rounded-md" />
                        <Skeleton className="h-6 w-6 rounded-md" />
                    </div>
                ) : (
                    platforms && platforms.length > 0 &&
                        platforms.slice(0, 3).map((p) => (
                            <div key={p.provider_id} className="relative h-6 w-6 overflow-hidden rounded-md bg-white/90 shadow-sm" title={p.provider_name}>
                                <Image
                                    src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                                    alt={`${p.provider_name} logo`}
                                    fill
                                    className="object-contain p-0.5"
                                    sizes="24px"
                                />
                            </div>
                        ))
                )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    {item.media_type === 'movie' ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
                    <span>{item.media_type === 'movie' ? 'Movie' : 'TV Show'}</span>
                    {releaseYear && <span className="text-xs">·</span>}
                    {releaseYear && <span>{releaseYear}</span>}
                </div>
                <div className="flex items-center gap-1 text-sm text-foreground">
                    <Star className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold">{item.vote_average > 0 ? `${item.vote_average.toFixed(1)}` : 'N/A'}</span>
                    <span className="text-muted-foreground text-xs">/ 10</span>
                </div>
                <div className="flex items-center justify-between mt-2 border-t border-border pt-2">
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
    </div>
  );
}
