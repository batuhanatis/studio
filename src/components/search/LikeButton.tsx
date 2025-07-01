'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Heart, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LikeButtonProps {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

export function LikeButton({ movieId, mediaType }: LikeButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLiked, setIsLiked] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkLikedStatus = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const likedMovies = userData.likedMovies || [];
        const movieIsLiked = likedMovies.some(
          (movie: any) => movie.movieId === movieId && movie.mediaType === mediaType
        );
        setIsLiked(movieIsLiked);
      }
    } catch (error) {
      console.error("Error checking like status:", error);
    } finally {
      setLoading(false);
    }
  }, [user, movieId, mediaType]);

  useEffect(() => {
    checkLikedStatus();
  }, [checkLikedStatus]);

  const handleLikeToggle = async () => {
    if (!user) {
      toast({
        variant: 'destructive',
        title: 'Not Logged In',
        description: 'You need to be logged in to like movies.',
      });
      return;
    }

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);
    const movieData = { movieId, mediaType };

    try {
      if (isLiked) {
        await updateDoc(userDocRef, { likedMovies: arrayRemove(movieData) });
      } else {
        await updateDoc(userDocRef, { likedMovies: arrayUnion(movieData) });
      }
      setIsLiked(!isLiked);
      toast({
        title: isLiked ? 'Removed from Likes' : 'Added to Likes!',
        description: `Recommendations on the search page will update based on your likes.`,
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not update your likes. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Button variant="outline" size="icon" disabled><Loader2 className="h-4 w-4 animate-spin" /></Button>;
  }

  return (
    <Button variant="outline" size="icon" onClick={handleLikeToggle} aria-label={isLiked ? 'Unlike' : 'Like'}>
      <Heart className={`h-4 w-4 ${isLiked ? 'text-destructive fill-destructive' : ''}`} />
    </Button>
  );
}
