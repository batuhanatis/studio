'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { MovieResultCard } from '@/components/search/MovieResultCard';
import { Loader2, Film, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { getWatchlistRecommendations } from '@/ai/flows/watchlist-recommendations';

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

export function WatchlistDetail({ listId }: { listId: string }) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [loading, setLoading] = useState({ list: true, recommendations: false });
  const [error, setError] = useState<string | null>(null);
  
  const [allRecommendations, setAllRecommendations] = useState<MovieDetails[]>([]);
  const [visibleRecommendationsCount, setVisibleRecommendationsCount] = useState(5);
  
  const [liked, setLiked] = useState<UserMovieData[]>([]);
  const [disliked, setDisliked] = useState<UserMovieData[]>([]);

  // Fetch user interaction lists for card states
  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
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
        const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=a13668181ace74d6999323ca0c6defbe&query=${encodeURIComponent(title)}`);
        if (!res.ok) return null;
        const data = await res.json();
        const result = (data.results || []).find((item: any) => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);
        return result || null;
     } catch {
        return null;
     }
  }, []);

  // Automatically fetch recommendations when watchlist is loaded
  useEffect(() => {
    const fetchRecommendations = async () => {
        if (!watchlist || watchlist.movies.length === 0) {
            return;
        }
        setLoading(prev => ({...prev, recommendations: true}));
        setVisibleRecommendationsCount(5); 
        setAllRecommendations([]);
        try {
            const movieTitles = watchlist.movies.map(m => m.title);
            const result = await getWatchlistRecommendations({ movieTitles });
            
            if (!result || result.recommendedTitles.length === 0) {
                // Don't show a toast, just load nothing.
                setLoading(prev => ({...prev, recommendations: false}));
                return;
            }
            
            const moviePromises = result.recommendedTitles.map(title => searchMovieByTitle(title));
            const movies = (await Promise.all(moviePromises)).filter((m): m is MovieDetails => m !== null);
            
            const uniqueMovies = Array.from(new Map(movies.map(m => [m.id, m])).values());
            setAllRecommendations(uniqueMovies);

        } catch (err: any) {
            toast({ variant: 'destructive', title: 'AI Error', description: err.message || 'Could not get recommendations.' });
        } finally {
            setLoading(prev => ({...prev, recommendations: false}));
        }
    };
    
    fetchRecommendations();

  }, [watchlist, searchMovieByTitle, toast]);

  const likedIds = new Set(liked.map(item => `${item.movieId}-${item.mediaType}`));
  const dislikedIds = new Set(disliked.map(item => `${item.movieId}-${item.mediaType}`));
  
  if (loading.list || authLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }
  
  if (error) {
    return <div className="py-12 text-center text-destructive">{error}</div>;
  }

  if (!watchlist) {
    return <div className="py-12 text-center text-muted-foreground">Watchlist not found.</div>;
  }

  const visibleRecommendations = allRecommendations.slice(0, visibleRecommendationsCount);

  return (
    <div className="space-y-8">
      <div>
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href="/watchlists"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Watchlists</Link>
        </Button>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                 <h1 className="text-3xl font-bold tracking-tight font-headline md:text-4xl">{watchlist.name}</h1>
                 <p className="mt-2 text-md text-muted-foreground md:text-lg">{watchlist.movies.length} {watchlist.movies.length === 1 ? 'item' : 'items'}</p>
            </div>
        </div>
      </div>
      
      {watchlist.movies.length === 0 ? (
        <div className="flex flex-col items-center gap-4 pt-8 text-center text-muted-foreground">
            <Film className="h-16 w-16" />
            <p className="text-lg">This list is empty</p>
            <p className="text-sm">Add movies and shows from the Search page.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {watchlist.movies.map((item) => (
            <MovieResultCard
              key={`${item.id}-${item.media_type}`}
              item={{...item, poster_path: item.poster || item.poster_path}}
              isLiked={likedIds.has(`${item.id}-${item.media_type}`)}
              isDisliked={dislikedIds.has(`${item.id}-${item.media_type}`)}
            />
          ))}
        </div>
      )}

      {loading.recommendations ? (
        <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin" /></div>
      ) : allRecommendations.length > 0 && (
        <div className="pt-8 space-y-6">
            <Separator />
            <h2 className="text-2xl font-bold font-headline">AI Recommendations for You</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleRecommendations.map((item) => (
                <MovieResultCard
                  key={`${item.id}-${item.media_type}`}
                  item={item}
                  isLiked={likedIds.has(`${item.id}-${item.media_type}`)}
                  isDisliked={dislikedIds.has(`${item.id}-${item.media_type}`)}
                />
            ))}
            </div>
            {visibleRecommendationsCount < allRecommendations.length && (
                <div className="mt-6 text-center">
                    <Button
                        variant="secondary"
                        onClick={() => setVisibleRecommendationsCount(prev => prev + 5)}
                    >
                        Load More
                    </Button>
                </div>
            )}
        </div>
      )}
    </div>
  );
}
