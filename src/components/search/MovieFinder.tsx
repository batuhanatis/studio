'use client';

import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Film, Tv } from 'lucide-react';

interface SearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
  vote_average: number;
  popularity: number;
}

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

export function MovieFinder() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast({
        title: 'Empty Search',
        description: 'Please enter a movie or TV show title.',
      });
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setResults([]);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(
          query
        )}&include_adult=false`
      );

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.status_message || 'Failed to fetch from TMDB');
      }

      const data = await res.json();
      const sortedResults = (data.results || [])
        .filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
        .sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity);
      setResults(sortedResults);
    } catch (error: any) {
      console.error('Error fetching movie data:', error);
      toast({
        variant: 'destructive',
        title: 'Search Failed',
        description: error.message || 'Could not fetch movie data. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full text-center">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
          Find Movies & TV Shows
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Search for movies and TV shows from The Movie Database (TMDB).
        </p>
      </div>

      <form onSubmit={handleSearch} className="w-full max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="e.g., The Matrix, Breaking Bad..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full bg-card py-3 pl-10 pr-32 text-base shadow-sm"
            disabled={isLoading}
          />
          <Button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-accent px-4 py-2 text-sm font-semibold hover:bg-accent/90"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              'Search'
            )}
          </Button>
        </div>
      </form>

      {isLoading && (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Searching...</p>
        </div>
      )}

      {hasSearched && !isLoading && results.length === 0 && (
         <div className="pt-8 text-center text-muted-foreground">
           <p>No results found for &quot;{query}&quot;.</p>
         </div>
      )}

      {results.length > 0 && (
        <div className="w-full max-w-4xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {results.map((item) => (
            <Card key={item.id} className="shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              <CardContent className="p-0 flex">
                <div className="relative w-28 h-40 md:w-32 md:h-48 flex-shrink-0 bg-muted">
                  <Image
                    src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
                    alt={item.title || item.name || 'Poster'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 112px, 128px"
                    data-ai-hint="movie poster"
                  />
                </div>
                <div className="p-4 flex flex-col justify-center gap-1">
                  <h3 className="text-lg font-bold font-headline">{item.title || item.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {item.media_type === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                    <span>{item.media_type === 'movie' ? 'Movie' : 'TV Show'}</span>
                  </div>
                  <p className="mt-2 text-sm text-foreground">
                    <span className="font-semibold">Rating:</span> {item.vote_average > 0 ? `${item.vote_average.toFixed(1)} / 10` : 'N/A'}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
