'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SendRecommendationButton } from '@/components/search/SendRecommendationButton';

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export default function DetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const id = params.id as string;
  const media_type = params.media_type as 'movie' | 'tv';
  const title = searchParams.get('title') || 'Untitled';
  const poster = searchParams.get('poster');
  const rating = searchParams.get('rating') || '0';

  const [platforms, setPlatforms] = useState<WatchProvider[] | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);

  useEffect(() => {
    async function getWatchProviders(id: string, type: 'movie' | 'tv') {
      setLoadingProviders(true);
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`
        );
        if (!res.ok) throw new Error('Failed to fetch providers');
        
        const json = await res.json();
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
      } catch (error) {
        console.error('Error fetching watch providers:', error);
        setPlatforms([]);
      } finally {
        setLoadingProviders(false);
      }
    }

    if (id && media_type) {
      getWatchProviders(id, media_type);
    }
  }, [id, media_type]);

  const posterUrl = poster && poster !== 'null'
    ? `https://image.tmdb.org/t/p/w500${poster}`
    : 'https://placehold.co/500x750.png';

  const decodedTitle = decodeURIComponent(title);

  const movieDetails = {
    id: id,
    media_type: media_type,
    title: decodedTitle,
    poster: poster,
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/search">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <div className="w-full flex-shrink-0 md:w-64">
             <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg">
                <Image
                  src={posterUrl}
                  alt={`Poster for ${decodedTitle}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 256px"
                  data-ai-hint="movie poster"
                />
             </div>
          </div>
          <div className="flex-grow">
            <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">{decodedTitle}</h1>
            <div className="mt-2 flex items-center gap-2 text-muted-foreground">
              {media_type === 'movie' ? 'Movie' : 'TV Show'}
              <span className="text-sm">·</span>
               <div className="flex items-center gap-1">
                 <Star className="h-4 w-4 text-amber-500" />
                 <span className="font-semibold text-foreground">{parseFloat(rating).toFixed(1)}</span>
                 <span>/ 10</span>
               </div>
            </div>

            <div className="mt-6">
              <SendRecommendationButton movie={movieDetails} />
            </div>
            
            <div className="mt-8">
              <h2 className="text-xl font-bold font-headline">Watch in Türkiye</h2>
              {loadingProviders ? (
                <div className="mt-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              ) : platforms && platforms.length === 0 ? (
                <p className="mt-4 text-muted-foreground">No streaming platforms found.</p>
              ) : (
                platforms && (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {platforms.map((p) => (
                      <div key={p.provider_id} className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-sm">
                        <div className="relative h-10 w-10 overflow-hidden rounded-md bg-white">
                          <Image
                            src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                            alt={`${p.provider_name} logo`}
                            fill
                            className="object-contain"
                            sizes="40px"
                          />
                        </div>
                        <span className="text-sm font-medium">{p.provider_name}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
