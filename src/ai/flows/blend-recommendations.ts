
'use server';

/**
 * @fileOverview Creates movie recommendations based on the tastes of two users.
 *
 * - getBlendRecommendations - A function that generates a movie blend.
 */

import { ai } from '@/ai/genkit';
import { BlendRecommendationsInputSchema, BlendRecommendationsOutputSchema, type BlendRecommendationsInput, type BlendRecommendationsOutput } from './schemas';

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

User 1's liked movies:
{{#each currentUserMovieTitles}}
- {{{this}}}
{{/each}}

User 2's liked movies:
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
