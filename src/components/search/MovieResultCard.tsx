
'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Film, Tv, Star } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { SendRecommendationButton } from './SendRecommendationButton';

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

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function MovieResultCard({ item }: { item: SearchResult }) {
  const [platforms, setPlatforms] = useState<WatchProvider[] | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  useEffect(() => {
    let isCancelled = false;

    async function getWatchProviders(id: number, type: 'movie' | 'tv') {
      if (!id || !type) return;
      setLoadingProviders(true);
      
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`
        );
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

        const unique = allProviders.filter(
          (v, i, a) => a.findIndex((t) => t.provider_id === v.provider_id) === i
        );
        setPlatforms(unique);
      } catch (error: any) {
        if (!isCancelled) {
          console.error('Error fetching watch providers:', error);
          setPlatforms([]);
        }
      } finally {
        if (!isCancelled) {
          setLoadingProviders(false);
        }
      }
    }

    getWatchProviders(item.id, item.media_type);

    return () => {
      isCancelled = true;
    };
  }, [item.id, item.media_type]);
  
  const title = item.title || item.name || 'Untitled';
  const releaseYear = item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4);
  const href = `/search/${item.media_type}/${item.id}?title=${encodeURIComponent(title)}&poster=${item.poster_path}&rating=${item.vote_average}&year=${releaseYear || ''}`;

  const movieDetails = {
    id: String(item.id),
    media_type: item.media_type,
    title: title,
    poster: item.poster_path,
  };

  return (
    <Card className="shadow-md overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200">
      <CardContent className="p-0 flex w-full">
        <Link href={href} className="block flex-shrink-0">
          <div className="relative w-28 h-40 md:w-32 md:h-48 bg-muted">
            <Image
              src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
              alt={title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 112px, 128px"
              data-ai-hint="movie poster"
            />
          </div>
        </Link>
        <div className="p-4 flex flex-col justify-between gap-1 flex-grow">
          <div>
            <Link href={href}>
                <h3 className="text-lg font-bold font-headline line-clamp-2 hover:underline">{title}</h3>
            </Link>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {item.media_type === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                <span>{item.media_type === 'movie' ? 'Movie' : 'TV Show'}</span>
                {releaseYear && <span className="text-xs">·</span>}
                {releaseYear && <span className="text-sm">{releaseYear}</span>}
            </div>
            <div className="flex items-center gap-1 text-sm text-foreground mt-2">
                <Star className="h-4 w-4 text-amber-500" />
                <span className="font-semibold">{item.vote_average > 0 ? `${item.vote_average.toFixed(1)}` : 'N/A'}</span>
                <span className="text-muted-foreground">/ 10</span>
            </div>
          </div>

          <div className="mt-2 flex items-end justify-between">
            <div className="flex-grow">
              <h4 className="text-xs font-semibold text-muted-foreground mb-1.5">Available on:</h4>
              {loadingProviders ? (
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              ) : platforms && platforms.length > 0 ? (
                <div className="flex items-center gap-2 flex-wrap">
                    {platforms.slice(0, 3).map((p) => (
                        <div key={p.provider_id} className="relative h-8 w-8 overflow-hidden rounded-md bg-white/80 shadow-sm" title={p.provider_name}>
                          <Image
                            src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                            alt={`${p.provider_name} logo`}
                            fill
                            className="object-contain p-0.5"
                            sizes="32px"
                          />
                        </div>
                    ))}
                     {platforms.length > 3 && (
                        <div className="flex items-center justify-center h-8 w-8 rounded-md bg-muted text-muted-foreground text-xs font-bold">
                            +{platforms.length - 3}
                        </div>
                    )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">No streaming info found.</div>
              )}
            </div>
            <div className="flex-shrink-0 ml-4">
                <SendRecommendationButton movie={movieDetails} isIconOnly />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
