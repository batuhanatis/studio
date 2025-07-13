
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { MovieResultCard } from '@/components/search/MovieResultCard';
import { Loader2, Film, Wand2, ArrowLeft, Heart, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { getWatchlistRecommendations } from '@/ai/flows/watchlist-recommendations';

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

interface MovieDetails {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster_path: string | null;
  poster?: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

interface Watchlist {
  id: string;
  name: string;
  movies: MovieDetails[];
  userId: string;
}

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
}

interface MovieApiResult extends MovieDetails {
    name?: string;
    popularity: number;
    genre_ids: number[];
}

export function WatchlistDetail({ listId }: { listId: string }) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState({ list: true, recommendations: false });
  const [error, setError] = useState<string | null>(null);
  
  const [recommendations, setRecommendations] = useState<MovieDetails[]>([]);
  
  const [watched, setWatched] = useState<UserMovieData[]>([]);
  const [liked, setLiked] = useState<UserMovieData[]>([]);
  const [disliked, setDisliked] = useState<UserMovieData[]>([]);

  // Fetch user interaction lists for card states
  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            setWatched(data.watchedMovies || []);
            setLiked(data.likedMovies || []);
            setDisliked(data.dislikedMovies || []);
        }
    });
    return () => unsubscribe();
  }, [firebaseUser, authLoading]);

  // Fetch watchlist details
  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    setLoading(prev => ({...prev, list: true}));
    const listDocRef = doc(db, 'watchlists', listId);
    
    const unsubscribe = onSnapshot(listDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const listData = docSnap.data();
        if (listData.userId === firebaseUser.uid) {
          setWatchlist({ ...listData, id: docSnap.id } as Watchlist);
        } else {
          setError("You don't have permission to view this list.");
        }
      } else {
        setError("Watchlist not found. It may have been deleted.");
      }
      setLoading(prev => ({...prev, list: false}));
    }, () => {
        setError("Failed to load watchlist due to a connection error.");
        setLoading(prev => ({...prev, list: false}));
    });

    return () => unsubscribe();
  }, [firebaseUser, listId, authLoading]);
  
  const searchMovieByTitle = useCallback(async (title: string): Promise<MovieDetails | null> => {
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

  const handleGetRecommendations = async () => {
    if (!watchlist || watchlist.movies.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Empty List',
        description: 'Add some movies to your list before getting recommendations.',
      });
      return;
    }
    setLoading(prev => ({...prev, recommendations: true}));
    try {
      const movieTitles = watchlist.movies.map(m => m.title);
      const result = await getWatchlistRecommendations({ movieTitles });
      
      if (!result || result.recommendedTitles.length === 0) {
        toast({ title: 'No Results', description: "The AI couldn't find any recommendations right now." });
        return;
      }
      
      const moviePromises = result.recommendedTitles.map(title => searchMovieByTitle(title));
      const movies = (await Promise.all(moviePromises)).filter((m): m is MovieDetails => m !== null);
      
      const uniqueMovies = Array.from(new Map(movies.map(m => [m.id, m])).values());
      setRecommendations(uniqueMovies);

    } catch (err: any) {
      toast({ variant: 'destructive', title: 'AI Error', description: err.message || 'Could not get recommendations.' });
    } finally {
      setLoading(prev => ({...prev, recommendations: false}));
    }
  };

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieData = watchlist?.movies.find(r => r.id === movieId && r.media_type === mediaType);
    if (!movieData) return;

    const movieIdentifier = { 
        movieId: String(movieId), 
        mediaType: mediaType,
        title: movieData.title,
        poster: movieData.poster_path || movieData.poster
    };

    try {
      if (isWatched) {
        await updateDoc(userDocRef, { watchedMovies: arrayUnion(movieIdentifier) });
      } else {
        await updateDoc(userDocRef, { watchedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };

  const handleToggleLike = async (item: MovieDetails, isLiked: boolean) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier = {
      movieId: String(item.id),
      mediaType: item.media_type,
      title: item.title,
      poster: item.poster_path || item.poster,
    };
  
    try {
      if (isLiked) {
        await updateDoc(userDocRef, { 
            likedMovies: arrayUnion(movieIdentifier),
            dislikedMovies: arrayRemove(movieIdentifier)
        });
        toast({ title: 'Liked!', description: `Added "${movieIdentifier.title}" to your likes.`});
      } else {
        await updateDoc(userDocRef, { likedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update like status.' });
    }
  };

  const handleToggleDislike = async (item: MovieDetails, isDisliked: boolean) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier = {
      movieId: String(item.id),
      mediaType: item.media_type,
      title: item.title,
      poster: item.poster_path || item.poster,
    };

    try {
      if (isDisliked) {
        await updateDoc(userDocRef, {
            dislikedMovies: arrayUnion(movieIdentifier),
            likedMovies: arrayRemove(movieIdentifier)
        });
      } else {
        await updateDoc(userDocRef, { dislikedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update dislike status.' });
    }
  };

  const watchedIds = new Set(watched.map(item => String(item.movieId)));
  const likedIds = new Set(liked.map(item => `${item.movieId}-${item.mediaType}`));
  const dislikedIds = new Set(disliked.map(item => String(item.movieId)));
  
  if (loading.list || authLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }
  
  if (error) {
    return <div className="text-center py-12 text-destructive">{error}</div>;
  }

  if (!watchlist) {
    return <div className="text-center py-12 text-muted-foreground">Watchlist not found.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href="/watchlists"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Watchlists</Link>
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                 <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">{watchlist.name}</h1>
                 <p className="mt-2 text-lg text-muted-foreground">{watchlist.movies.length} {watchlist.movies.length === 1 ? 'item' : 'items'}</p>
            </div>
            <Button onClick={handleGetRecommendations} disabled={loading.recommendations || watchlist.movies.length === 0}>
                {loading.recommendations ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <Wand2 className="mr-2 h-4 w-4" />
                )}
                Get AI Recommendations
            </Button>
        </div>
      </div>
      
      {watchlist.movies.length === 0 ? (
        <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
            <Film className="h-16 w-16" />
            <p className="text-lg">This list is empty</p>
            <p className="text-sm">Add movies and shows from the Search page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {watchlist.movies.map((item) => (
            <MovieResultCard
              key={`${item.id}-${item.media_type}`}
              item={{...item, poster_path: item.poster || item.poster_path}}
              isWatched={watchedIds.has(String(item.id))}
              isLiked={likedIds.has(`${item.id}-${item.media_type}`)}
              isDisliked={dislikedIds.has(String(item.id))}
              onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
              onToggleLike={(isLiked) => handleToggleLike(item, isLiked)}
              onToggleDislike={(isDisliked) => handleToggleDislike(item, isDisliked)}
            />
          ))}
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-6 pt-8">
            <Separator />
            <h2 className="text-2xl font-bold font-headline">AI Recommendations for You</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {recommendations.map((item) => (
                <MovieResultCard
                key={`${item.id}-${item.media_type}`}
                item={item}
                isWatched={watchedIds.has(String(item.id))}
                isLiked={likedIds.has(`${item.id}-${item.media_type}`)}
                isDisliked={dislikedIds.has(String(item.id))}
                onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
                onToggleLike={(isLiked) => handleToggleLike(item, isLiked)}
                onToggleDislike={(isDisliked) => handleToggleDislike(item, isDisliked)}
                />
            ))}
            </div>
        </div>
      )}
    </div>
  );
}
