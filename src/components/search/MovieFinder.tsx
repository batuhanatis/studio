'use client';

import { useState } from 'react';
import { getMovieRecommendationSummary } from '@/ai/flows/movie-recommendation-summary.ts';
import type { MovieRecommendationSummaryOutput } from '@/ai/flows/movie-recommendation-summary.ts';
import { useToast } from '@/hooks/use-toast';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Search, Wand2 } from 'lucide-react';

export function MovieFinder() {
  const [movieTitle, setMovieTitle] = useState('');
  const [result, setResult] = useState<MovieRecommendationSummaryOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieTitle.trim()) {
      toast({
        title: 'Empty Search',
        description: 'Please enter a movie title.',
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    try {
      const summary = await getMovieRecommendationSummary({ movieTitle });
      setResult(summary);
    } catch (error) {
      console.error('Error fetching movie recommendation:', error);
      toast({
        variant: 'destructive',
        title: 'Something went wrong',
        description: 'Failed to get movie recommendation. Please try again later.',
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full text-center">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
          Where can I watch...
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Enter a movie title and we&apos;ll tell you where to stream it.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="w-full max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="e.g., The Matrix"
            value={movieTitle}
            onChange={(e) => setMovieTitle(e.target.value)}
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
              'Find'
            )}
          </Button>
        </div>
      </form>

      {isLoading && (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Searching for recommendations...</p>
        </div>
      )}

      {result && (
        <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-headline">
                <Wand2 className="h-6 w-6 text-primary" />
                Recommendation for {movieTitle}
              </CardTitle>
              <CardDescription>
                Here&apos;s a summary and where you can watch it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap leading-relaxed">
                {result.recommendationSummary}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
