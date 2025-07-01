'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

import { Input } from '@/components/ui/input';
import { Loader2, Search, Keyboard } from 'lucide-react';
import { MovieResultCard } from './MovieResultCard';

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
    const controller = new AbortController();
    const { signal } = controller;

    const searchMovies = async (searchQuery: string) => {
      const trimmedQuery = searchQuery.trim();

      if (trimmedQuery.length === 0) {
        setResults([]);
        setHasSearched(false);
        setIsLoading(false);
        return;
      }
      
      setHasSearched(true);

      if (trimmedQuery.length < 3) {
        setResults([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&language=en-US&query=${encodeURIComponent(
            trimmedQuery
          )}&include_adult=false`,
          { signal }
        );

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.status_message || 'Failed to fetch from TMDB');
        }

        const data = await res.json();
        if (!signal.aborted) {
          const sortedResults = (data.results || [])
            .filter((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path)
            .sort((a: SearchResult, b: SearchResult) => b.popularity - a.popularity);
          setResults(sortedResults);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return; // This is expected when a new search is initiated.
        }
        if (!signal.aborted) {
          console.error('Error fetching movie data:', error);
          toast({
            variant: 'destructive',
            title: 'Search Failed',
            description: error.message || 'Could not fetch movie data. Please try again.',
          });
        }
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    const debounceTimer = setTimeout(() => {
      searchMovies(query);
    }, 300);

    return () => {
      clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [query, toast]);

  const renderStatus = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Searching...</p>
        </div>
      );
    }

    const trimmedQuery = query.trim();
    if (hasSearched && trimmedQuery.length > 0 && trimmedQuery.length < 3) {
        return (
             <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
               <Keyboard className="h-16 w-16" />
               <p className="text-lg">Keep typing...</p>
               <p className="text-sm">Enter at least 3 characters to see results.</p>
             </div>
        );
    }
    
    if (hasSearched && !isLoading && results.length === 0 && trimmedQuery.length >= 3) {
      return (
         <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
            <Search className="h-16 w-16" />
           <p className="text-lg">No results found for &quot;{query}&quot;.</p>
           <p className="text-sm">Try a different search term.</p>
         </div>
      );
    }
    return null;
  };

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
          />
        </div>
      </form>

      {renderStatus()}

      {results.length > 0 && !isLoading && (
        <div className="w-full max-w-4xl space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {results.map((item) => (
             <MovieResultCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
