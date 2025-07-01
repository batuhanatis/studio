'use server';

/**
 * @fileOverview Creates movie recommendations based on a user's watchlist.
 *
 * - getWatchlistRecommendations - A function that generates movie recommendations from a list.
 * - WatchlistRecommendationsInput - The input type for the function.
 * - WatchlistRecommendationsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const WatchlistRecommendationsInputSchema = z.object({
  movieTitles: z.array(z.string()).describe('A list of movie titles from a user\'s watchlist.'),
});
export type WatchlistRecommendationsInput = z.infer<typeof WatchlistRecommendationsInputSchema>;

export const WatchlistRecommendationsOutputSchema = z.object({
  recommendedTitles: z.array(z.string()).describe('A list of 10 movie or TV show titles that the user might enjoy based on their watchlist.'),
});
export type WatchlistRecommendationsOutput = z.infer<typeof WatchlistRecommendationsOutputSchema>;

export async function getWatchlistRecommendations(input: WatchlistRecommendationsInput): Promise<WatchlistRecommendationsOutput> {
  return watchlistRecommendationsFlow(input);
}

const recommendationsPrompt = ai.definePrompt({
  name: 'watchlistRecommendationsPrompt',
  input: { schema: WatchlistRecommendationsInputSchema },
  output: { schema: WatchlistRecommendationsOutputSchema },
  prompt: `You are a movie recommendation expert. Given the following list of movies and TV shows from a user's watchlist, analyze the genres, actors, and directors to recommend 10 other titles they would likely enjoy.

Do not recommend titles that are already in their list. Provide a diverse list of recommendations.

User's watchlist:
{{#each movieTitles}}
- {{{this}}}
{{/each}}

Based on this watchlist, suggest 10 new titles.
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
