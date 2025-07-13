
'use server';

/**
 * @fileOverview Creates movie recommendations based on a user's watchlist.
 *
 * - getWatchlistRecommendations - A function that generates movie recommendations from a list of titles.
 */

import { ai } from '@/ai/genkit';
import { WatchlistRecommendationsInputSchema, WatchlistRecommendationsOutputSchema, type WatchlistRecommendationsInput, type WatchlistRecommendationsOutput } from './schemas';

export async function getWatchlistRecommendations(input: WatchlistRecommendationsInput): Promise<WatchlistRecommendationsOutput> {
  return watchlistRecommendationsFlow(input);
}

const recommendationsPrompt = ai.definePrompt({
  name: 'watchlistRecommendationsPrompt',
  input: { schema: WatchlistRecommendationsInputSchema },
  output: { schema: WatchlistRecommendationsOutputSchema },
  prompt: `You are a movie recommendation expert.
  
You will be given a list of movies from a user's watchlist. Your task is to analyze this list and recommend 15 other movies or TV shows that they would likely enjoy.

Do not recommend movies that are already in their list. Provide a diverse list of recommendations.

Watchlist movies:
{{#each movieTitles}}
- {{{this}}}
{{/each}}

Based on this list, suggest 15 new titles.
`,
});

const watchlistRecommendationsFlow = ai.defineFlow(
  {
    name: 'watchlistRecommendationsFlow',
    inputSchema: WatchlistRecommendationsInputSchema,
    outputSchema: WatchlistRecommendationsOutputSchema,
  },
  async (input) => {
    if (input.movieTitles.length === 0) {
        return { recommendedTitles: [] };
    }
  
    const { output } = await recommendationsPrompt(input);
    return output!;
  }
);
