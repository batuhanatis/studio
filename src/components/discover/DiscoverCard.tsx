'use client';

import React, { useEffect, useState, forwardRef } from 'react';
import Image from 'next/image';
import { Rating } from './Rating';
import { Checkbox } from '@/components/ui/checkbox';
import { Eye } from 'lucide-react';

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

interface DiscoverCardProps {
    movie: any;
    rating?: number;
    isWatched?: boolean;
    onRate: (rating: number) => void;
    onToggleWatched: (watched: boolean) => void;
}

export const DiscoverCard = forwardRef<HTMLDivElement, DiscoverCardProps>(function DiscoverCard({ movie, rating = 0, isWatched = false, onRate, onToggleWatched }, ref) {
  const [platforms, setPlatforms] = useState<any[]>([]);

  useEffect(() => {
    if (!movie) return;
    async function fetchProviders() {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/${movie.media_type}/${movie.id}/watch/providers?api_key=${API_KEY}`);
        const data = await res.json();
        const tr = data.results?.TR;
        if (tr) {
            const all = [...(tr.flatrate || []), ...(tr.rent || []), ...(tr.buy || [])];
            const unique = all.filter((v, i, a) => a.findIndex(t => t.provider_id === v.provider_id) === i);
            setPlatforms(unique);
        } else {
            setPlatforms([]);
        }
      } catch {
        setPlatforms([]);
      }
    }
    fetchProviders();
  }, [movie]);

  if (!movie) return null;

  const title = movie.title || movie.name || 'Untitled';
  const year = movie.release_date?.slice(0, 4) || movie.first_air_date?.slice(0, 4);
  const posterUrl = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : 'https://placehold.co/500x750.png';

  return (
    <div ref={ref} className="relative w-full h-full rounded-lg overflow-hidden shadow-2xl bg-card">
      <Image
        src={posterUrl}
        alt={title}
        fill
        className="object-cover"
        sizes="100vw"
        data-ai-hint="movie poster"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent" />

      <div className="absolute bottom-0 w-full text-white p-4 space-y-3">
        <h1 className="text-3xl font-bold font-headline mb-1">{title}</h1>
        <p className="text-sm text-muted-foreground mb-2">{year} · {movie.vote_average.toFixed(1)} / 10</p>
        <p className="text-base leading-relaxed line-clamp-3">{movie.overview}</p>

        <div className="space-y-4 pt-2">
          <div>
            <Rating rating={rating} onRatingChange={onRate} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id={`watched-${movie.id}`} checked={isWatched} onCheckedChange={onToggleWatched} />
            <label htmlFor={`watched-${movie.id}`} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <Eye className="w-4 h-4" /> Mark as Watched
            </label>
          </div>
        </div>

        {platforms.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2">Available in Türkiye:</h3>
            <div className="flex flex-wrap gap-2">
              {platforms.slice(0, 5).map(p => (
                <div key={p.provider_id} className="relative w-10 h-10 rounded-md bg-white/80 overflow-hidden">
                  <Image src={`https://image.tmdb.org/t/p/original${p.logo_path}`} alt={p.provider_name} fill className="object-contain p-1" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});