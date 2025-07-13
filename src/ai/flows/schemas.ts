/**
 * @fileOverview Schemas and types for Genkit flows.
 * This file does not contain 'use server' and can safely export Zod schemas and types.
 */

import { z } from 'zod';

// Schemas for blend-recommendations flow
export const BlendRecommendationsInputSchema = z.object({
  currentUserMovieTitles: z.array(z.string()).describe('A list of movie titles the current user likes.'),
  friendMovieTitles: z.array(z.string()).describe('A list of movie titles the friend likes.'),
});
export type BlendRecommendationsInput = z.infer<typeof BlendRecommendationsInputSchema>;

export const BlendRecommendationsOutputSchema = z.object({
  recommendedTitles: z.array(z.string()).describe('A list of 10 movie or TV show titles that both users might enjoy.'),
});
export type BlendRecommendationsOutput = z.infer<typeof BlendRecommendationsOutputSchema>;


// Schemas for movie-recommendation-summary flow
export const MovieRecommendationSummaryInputSchema = z.object({
  movieTitle: z.string().describe('The title of the movie to find recommendations for.'),
});
export type MovieRecommendationSummaryInput = z.infer<typeof MovieRecommendationSummaryInputSchema>;

const MovieRecommendationSummaryOutputSchema = z.object({
  recommendationSummary: z.string().describe('A short summary of why the movie is recommended and where to watch it.'),
});
export type MovieRecommendationSummaryOutput = z.infer<typeof MovieRecommendationSummaryOutputSchema>;


// Schemas for watchlist-recommendations flow
export const WatchlistRecommendationsInputSchema = z.object({
    movieTitles: z.array(z.string()).describe('A list of movie titles in the watchlist.'),
});
export type WatchlistRecommendationsInput = z.infer<typeof WatchlistRecommendationsInputSchema>;

export const WatchlistRecommendationsOutputSchema = z.object({
    recommendedTitles: z.array(z.string()).describe('A list of 5 new movie or TV show titles based on the watchlist.'),
});
export type WatchlistRecommendationsOutput = z.infer<typeof WatchlistRecommendationsOutputSchema>;
