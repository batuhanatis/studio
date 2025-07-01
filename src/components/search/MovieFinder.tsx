'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';

import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Search, Film, Tv, Star } from 'lucide-react';

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

  useEffect(() => {
    if (query.trim() === '') {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    const searchMovies = async () => {
      if (query.trim().length < 3) {
        setResults([]);
        setIsLoading(false);
        return;
      }

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

    const debounceTimer = setTimeout(() => {
      searchMovies();
    }, 500); // 500ms delay

    return () => clearTimeout(debounceTimer);
  }, [query, toast]);

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full text-center">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
          Find Movies & TV Shows
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Discover where to watch your favorite movies and series.
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="w-full max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Start typing to search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 w-full rounded-full bg-card py-3 pl-10 pr-4 text-base shadow-sm"
            disabled={isLoading}
          />
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
           <p className="text-sm">Please try a different search term.</p>
         </div>
      )}

      {results.length > 0 && (
        <div className="w-full max-w-4xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {results.map((item) => {
            const title = item.title || item.name || 'Untitled';
            const href = `/search/${item.media_type}/${item.id}?title=${encodeURIComponent(title)}&poster=${item.poster_path}&rating=${item.vote_average}`;
            return (
            <Link href={href} key={item.id} className="block">
                <Card className="shadow-md overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200">
                <CardContent className="p-0 flex">
                    <div className="relative w-28 h-40 md:w-32 md:h-48 flex-shrink-0 bg-muted">
                    <Image
                        src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
                        alt={title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 112px, 128px"
                        data-ai-hint="movie poster"
                    />
                    </div>
                    <div className="p-4 flex flex-col justify-center gap-1">
                    <h3 className="text-lg font-bold font-headline">{title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {item.media_type === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                        <span>{item.media_type === 'movie' ? 'Movie' : 'TV Show'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-foreground mt-2">
                        <Star className="h-4 w-4 text-amber-500" />
                        <span className="font-semibold">{item.vote_average > 0 ? `${item.vote_average.toFixed(1)}` : 'N/A'}</span>
                        <span className="text-muted-foreground">/ 10</span>
                    </div>
                    </div>
                </CardContent>
                </Card>
            </Link>
          )})}
        </div>
      )}
    </div>
  );
}
