'use server';

/**
 * @fileOverview Creates movie recommendations based on the tastes of two users.
 *
 * - getBlendRecommendations - A function that generates a movie blend.
 * - BlendRecommendationsInput - The input type for the function.
 * - BlendRecommendationsOutput - The return type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

export const BlendRecommendationsInputSchema = z.object({
  currentUserMovieTitles: z.array(z.string()).describe('A list of movie titles the current user likes.'),
  friendMovieTitles: z.array(z.string()).describe('A list of movie titles the friend likes.'),
});
export type BlendRecommendationsInput = z.infer<typeof BlendRecommendationsInputSchema>;

export const BlendRecommendationsOutputSchema = z.object({
  recommendedTitles: z.array(z.string()).describe('A list of 10 movie or TV show titles that both users might enjoy.'),
});
export type BlendRecommendationsOutput = z.infer<typeof BlendRecommendationsOutputSchema>;

export async function getBlendRecommendations(input: BlendRecommendationsInput): Promise<BlendRecommendationsOutput> {
  return blendRecommendationsFlow(input);
}

const blendPrompt = ai.definePrompt({
  name: 'blendPrompt',
  input: { schema: BlendRecommendationsInputSchema },
  output: { schema: BlendRecommendationsOutputSchema },
  prompt: `You are a movie recommendation expert who helps two friends find something to watch together.
  
You will be given two lists of movies that each person likes. Your task is to analyze these lists and recommend 10 other movies or TV shows that both of them would likely enjoy.

Do not recommend movies that are already in their lists. Provide a diverse list of recommendations, including both popular and less-known titles if possible.

User 1's favorite movies:
{{#each currentUserMovieTitles}}
- {{{this}}}
{{/each}}

User 2's favorite movies:
{{#each friendMovieTitles}}
- {{{this}}}
{{/each}}

Based on these combined tastes, suggest 10 new titles.
`,
});

const blendRecommendationsFlow = ai.defineFlow(
  {
    name: 'blendRecommendationsFlow',
    inputSchema: BlendRecommendationsInputSchema,
    outputSchema: BlendRecommendationsOutputSchema,
  },
  async (input) => {
    // If one or both users have no liked movies, we can't generate a blend.
    // Return an empty list in this case.
    if (input.currentUserMovieTitles.length === 0 || input.friendMovieTitles.length === 0) {
        return { recommendedTitles: [] };
    }
  
    const { output } = await blendPrompt(input);
    return output!;
  }
);
