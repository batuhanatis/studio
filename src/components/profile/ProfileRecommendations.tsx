'use client';

// This component is a direct wrapper for RecommendationList.
// It keeps the profile page clean and delegates the recommendation logic.
import { RecommendationList } from '@/components/recommendations/RecommendationList';

export function ProfileRecommendations() {
  return <RecommendationList />;
}
