'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getBlendRecommendations } from '@/ai/flows/blend-recommendations';
import { MovieResultCard } from '@/components/search/MovieResultCard';
import { Loader2, Film, Combine } from 'lucide-react';

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

interface Movie {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  media_type: 'movie' | 'tv';
  vote_average: number;
  popularity: number;
  release_date?: string;
  first_air_date?: string;
}

interface UserProfile {
    uid: string;
    username: string;
    email: string;
    likedMovies: { movieId: string; mediaType: 'movie' | 'tv' }[];
    dislikedMovies: any[];
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

export function BlendFeed({ friendId }: { friendId: string }) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [friendProfile, setFriendProfile] = useState<UserProfile | null>(null);
  const [blendMovies, setBlendMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Finding your friend...');
  const [error, setError] = useState<string | null>(null);

  const [liked, setLiked] = useState<UserMovieData[]>([]);
  const [disliked, setDisliked] = useState<UserMovieData[]>([]);

  // Fetch current user's lists
  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            setLiked(data.likedMovies || []);
            setDisliked(data.dislikedMovies || []);
        }
    });
    return () => unsubscribe();
  }, [firebaseUser, authLoading]);

  const fetchMovieDetails = useCallback(async (movieId: string, mediaType: 'movie' | 'tv'): Promise<string | null> => {
    try {
      const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${movieId}?api_key=${API_KEY}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.title || data.name || null;
    } catch {
      return null;
    }
  }, []);

  const searchMovieByTitle = useCallback(async (title: string): Promise<Movie | null> => {
     try {
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${API_KEY}&query=${encodeURIComponent(title)}`);
        if (!res.ok) return null;
        const data = await res.json();
        const result = (data.results || []).find((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);
        return result || null;
     } catch {
        return null;
     }
  }, []);


  const createBlend = useCallback(async () => {
    if (authLoading || !firebaseUser) return;
    setLoading(true);

    try {
      // 1. Fetch friend data
      setLoadingMessage('Finding your friend...');
      const friendDocSnap = await doc(db, 'users', friendId).get();
      if (!friendDocSnap.exists()) throw new Error("Could not find your friend's profile.");
      const friendData = friendDocSnap.data() as UserProfile;
      setFriendProfile(friendData);

      setLoadingMessage('Analyzing your movie tastes...');
      const currentUserDocSnap = await doc(db, 'users', firebaseUser.uid).get();
      if (!currentUserDocSnap.exists()) throw new Error("Could not find your profile.");
      const currentUserData = currentUserDocSnap.data() as UserProfile;

      const currentUserLiked = currentUserData.likedMovies || [];
      const friendLiked = friendData.likedMovies || [];

      if (currentUserLiked.length === 0 || friendLiked.length === 0) {
        throw new Error("You both need to like at least one movie to create a Blend.");
      }

      // 2. Get movie titles for high ratings
      setLoadingMessage('Comparing your favorite movies...');
      const currentUserMovieTitles = (await Promise.all(
        currentUserLiked.map(m => fetchMovieDetails(m.movieId, m.mediaType))
      )).filter((t): t is string => t !== null);
      
      const friendMovieTitles = (await Promise.all(
        friendLiked.map(m => fetchMovieDetails(m.movieId, m.mediaType))
      )).filter((t): t is string => t !== null);

      // 3. Call AI Flow
      setLoadingMessage('Asking the AI for recommendations...');
      const blendResult = await getBlendRecommendations({ currentUserMovieTitles, friendMovieTitles });

      if (!blendResult || blendResult.recommendedTitles.length === 0) {
        throw new Error("The AI couldn't find any common ground. Try liking more movies!");
      }

      // 4. Fetch full movie details for recommendations
      setLoadingMessage('Building your Blend...');
      const moviePromises = blendResult.recommendedTitles.map(title => searchMovieByTitle(title));
      const movies = (await Promise.all(moviePromises)).filter((m): m is Movie => m !== null);
      
      const uniqueMovies = Array.from(new Map(movies.map(m => [m.id, m])).values());

      setBlendMovies(uniqueMovies);
    } catch (err: any) {
      console.error("Error creating blend:", err);
      toast({ variant: 'destructive', title: 'Blend Failed', description: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser, friendId, toast, fetchMovieDetails, searchMovieByTitle, authLoading]);
  
  useEffect(() => {
    createBlend();
  }, [createBlend]);
  
  const likedIds = new Set(liked.map(item => `${item.movieId}-${item.mediaType}`));
  const dislikedIds = new Set(disliked.map(item => `${item.movieId}-${item.mediaType}`));
  
  if (loading || authLoading) {
     return (
        <div className="flex flex-col items-center gap-4 pt-8 text-muted-foreground">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold">{loadingMessage}</p>
            <p className="text-sm">This can take a moment, please wait...</p>
        </div>
      );
  }
  
  if (error) {
    return (
        <div className="flex flex-col items-center gap-4 pt-8 text-center text-muted-foreground">
            <Combine className="h-16 w-16" />
            <p className="text-lg font-semibold">Could Not Create Blend</p>
            <p className="max-w-md text-sm">{error}</p>
        </div>
    );
  }

  const friendDisplayName = friendProfile?.username || friendProfile?.email || 'your friend';

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight font-headline md:text-4xl">
          A Blend for You &amp; {friendDisplayName}
        </h1>
        <p className="mt-2 text-md text-muted-foreground md:text-lg">
          Movies and shows you might both enjoy, based on your liked movies.
        </p>
      </div>

      {blendMovies.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-8 text-center text-muted-foreground">
            <Film className="h-16 w-16" />
            <p className="text-lg">No Recommendations Found</p>
            <p className="text-sm">The AI couldn't find a good match. Try liking more movies!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {blendMovies.map((item) => (
            <MovieResultCard
              key={item.id}
              item={item}
              isLiked={likedIds.has(`${item.id}-${item.mediaType}`)}
              isDisliked={dislikedIds.has(`${item.id}-${item.mediaType}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
