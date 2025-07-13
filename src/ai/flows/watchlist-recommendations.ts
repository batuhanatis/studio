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
  const [loading, setLoading] = useState({ list: true });
  const [error, setError] = useState<string | null>(null);
  
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
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">{watchlist.name}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{watchlist.movies.length} {watchlist.movies.length === 1 ? 'item' : 'items'}</p>
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
    </div>
  );
}