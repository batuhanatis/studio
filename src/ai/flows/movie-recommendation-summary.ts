//Movie Finder App: Providing recommendations and summaries for movies.

'use server';

/**
 * @fileOverview Fetches movie recommendations and summaries using an LLM.
 *
 * - getMovieRecommendationSummary - A function that suggests where to watch a movie and provides a summary.
 */

import {ai} from '@/ai/genkit';
import { MovieRecommendationSummaryInputSchema, type MovieRecommendationSummaryInput, type MovieRecommendationSummaryOutput } from './schemas';
import { z } from 'zod';

// The output schema is simple and only used here, so we can define it inline.
const MovieRecommendationSummaryOutputSchema = z.object({
  recommendationSummary: z.string().describe('A short summary of why the movie is recommended and where to watch it.'),
});


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
