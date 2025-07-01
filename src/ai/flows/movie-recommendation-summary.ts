//Movie Finder App: Providing recommendations and summaries for movies.

'use server';

/**
 * @fileOverview Fetches movie recommendations and summaries using an LLM.
 *
 * - getMovieRecommendationSummary - A function that suggests where to watch a movie and provides a summary.
 * - MovieRecommendationSummaryInput - The input type for the getMovieRecommendationSummary function.
 * - MovieRecommendationSummaryOutput - The return type for the getMovieRecommendationSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MovieRecommendationSummaryInputSchema = z.object({
  movieTitle: z.string().describe('The title of the movie to find recommendations for.'),
});
export type MovieRecommendationSummaryInput = z.infer<typeof MovieRecommendationSummaryInputSchema>;

const MovieRecommendationSummaryOutputSchema = z.object({
  recommendationSummary: z.string().describe('A short summary of why the movie is recommended and where to watch it.'),
});
export type MovieRecommendationSummaryOutput = z.infer<typeof MovieRecommendationSummaryOutputSchema>;

export async function getMovieRecommendationSummary(input: MovieRecommendationSummaryInput): Promise<MovieRecommendationSummaryOutput> {
  return movieRecommendationSummaryFlow(input);
}

const movieRecommendationSummaryPrompt = ai.definePrompt({
  name: 'movieRecommendationSummaryPrompt',
  input: {schema: MovieRecommendationSummaryInputSchema},
  output: {schema: MovieRecommendationSummaryOutputSchema},
  prompt: `You are a movie recommendation expert. A user is looking for where to watch the movie "{{{movieTitle}}}". Provide a short summary of why it's recommended and where they can watch it. Be concise. Focus on streaming services.`,
});

const movieRecommendationSummaryFlow = ai.defineFlow(
  {
    name: 'movieRecommendationSummaryFlow',
    inputSchema: MovieRecommendationSummaryInputSchema,
    outputSchema: MovieRecommendationSummaryOutputSchema,
  },
  async input => {
    const {output} = await movieRecommendationSummaryPrompt(input);
    return output!;
  }
);
