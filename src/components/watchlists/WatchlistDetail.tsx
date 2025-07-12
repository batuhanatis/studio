
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { getWatchlistRecommendations } from '@/ai/flows/watchlist-recommendations';
import { MovieResultCard } from '@/components/search/MovieResultCard';
import { Loader2, Film, Wand2, ArrowLeft } from 'lucide-react';
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
  const [recommendations, setRecommendations] = useState<MovieApiResult[]>([]);
  const [loading, setLoading] = useState({ list: true, recs: false });
  const [error, setError] = useState<string | null>(null);
  const [watched, setWatched] = useState<UserMovieData[]>([]);

  // Fetch watched list for card states
  useEffect(() => {
    if (authLoading || !firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            setWatched(docSnap.data().watchedMovies || []);
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
  
  const searchMovieByTitle = useCallback(async (title: string): Promise<MovieApiResult | null> => {
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

  // Fetch recommendations when watchlist is loaded
  useEffect(() => {
    const fetchRecs = async () => {
        if (!watchlist || watchlist.movies.length === 0) return;
        setLoading(prev => ({...prev, recs: true}));
        try {
            const movieTitles = watchlist.movies.map(m => m.title).filter((t): t is string => !!t);
            if (movieTitles.length === 0) {
              setLoading(prev => ({...prev, recs: false}));
              return;
            }
            
            const result = await getWatchlistRecommendations({ movieTitles });
            
            if (result && result.recommendedTitles.length > 0) {
                const moviePromises = result.recommendedTitles.map(title => searchMovieByTitle(title));
                const movies = (await Promise.all(moviePromises)).filter((m): m is MovieApiResult => m !== null);
                const uniqueMovies = Array.from(new Map(movies.map(m => [m.id, m])).values());
                setRecommendations(uniqueMovies);
            }
        } catch (err) {
            toast({ variant: 'destructive', title: 'AI Error', description: 'Could not fetch recommendations.' });
        } finally {
            setLoading(prev => ({...prev, recs: false}));
        }
    };
    fetchRecs();
  }, [watchlist, toast, searchMovieByTitle]);

  const handleToggleWatched = async (movieId: number, mediaType: 'movie' | 'tv', isWatched: boolean) => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier = { movieId: String(movieId), mediaType };
    
    try {
        if (isWatched) {
            await updateDoc(userDocRef, { watchedMovies: arrayUnion(movieIdentifier) });
        } else {
            await updateDoc(userDocRef, { watchedMovies: arrayRemove(movieIdentifier) });
        }
    } catch (e) {
        console.error("Toggle watched failed: ", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };

  const watchedIds = new Set(watched.map(item => String(item.movieId)));
  
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {watchlist.movies.map((item) => (
            <MovieResultCard
              key={item.id}
              item={{...item, poster_path: item.poster, name: item.title, popularity: item.popularity || 0, genre_ids: []}}
              isWatched={watchedIds.has(String(item.id))}
              onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
            />
          ))}
        </div>
      )}

      {loading.recs && (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Finding recommendations for you...</p>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="space-y-6 pt-6">
            <Separator />
            <div className="flex items-center gap-3">
                <Wand2 className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold font-headline">Recommended For You</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {recommendations.map((item) => (
                    <MovieResultCard
                        key={item.id}
                        item={{...item, poster: item.poster_path}}
                        isWatched={watchedIds.has(String(item.id))}
                        onToggleWatched={(isWatched) => handleToggleWatched(item.id, item.media_type, isWatched)}
                    />
                ))}
            </div>
        </div>
      )}
    </div>
  );
}
