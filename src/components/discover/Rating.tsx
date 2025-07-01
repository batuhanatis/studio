
'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingProps {
  rating: number;
  onRatingChange: (newRating: number) => void;
  starSize?: number;
}

export function Rating({ rating, onRatingChange, starSize = 28 }: RatingProps) {
  const [hoverRating, setHoverRating] = useState(0);

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onClick={() => onRatingChange(star)}
          onMouseEnter={() => setHoverRating(star)}
          onMouseLeave={() => setHoverRating(0)}
          className="p-1 rounded-full transition-transform duration-150 ease-in-out hover:scale-125"
          aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
        >
          <Star
            className={cn(
              'transition-colors',
              (hoverRating || rating) >= star ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground'
            )}
            style={{ width: starSize, height: starSize }}
          />
        </button>
      ))}
    </div>
  );
}
