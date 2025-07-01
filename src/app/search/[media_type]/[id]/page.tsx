
'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, Eye } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { SendRecommendationButton } from '@/components/search/SendRecommendationButton';
import { Rating } from '@/components/discover/Rating';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const API_KEY = 'a13668181ace74d6999323ca0c6defbe';

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface Genre {
    id: number;
    name: string;
}

export default function DetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const id = params.id as string;
  const media_type = params.media_type as 'movie' | 'tv';
  const title = searchParams.get('title') || 'Untitled';
  const poster = searchParams.get('poster');
  const ratingFromSearch = searchParams.get('rating') || '0';
  const yearFromSearch = searchParams.get('year');

  const [platforms, setPlatforms] = useState<WatchProvider[] | null>(null);
  const [loadingProviders, setLoadingProviders] = useState(true);
  
  const [overview, setOverview] = useState<string | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  
  const [userRating, setUserRating] = useState(0);
  const [isWatched, setIsWatched] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);

  useEffect(() => {
    async function getWatchProviders(id: string, type: 'movie' | 'tv') {
      setLoadingProviders(true);
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`
        );
        if (!res.ok) throw new Error('Failed to fetch providers');
        
        const json = await res.json();
        const tr = json.results?.TR;
        if (!tr) {
          setPlatforms([]);
          return;
        }

        const allProviders: WatchProvider[] = [
          ...(tr.flatrate || []),
          ...(tr.buy || []),
          ...(tr.rent || []),
        ];

        const unique = allProviders.filter(
          (v, i, a) => a.findIndex((t) => t.provider_id === v.provider_id) === i
        );
        setPlatforms(unique);
      } catch (error) {
        console.error('Error fetching watch providers:', error);
        setPlatforms([]);
      } finally {
        setLoadingProviders(false);
      }
    }

    if (id && media_type) {
      getWatchProviders(id, media_type);
    }
  }, [id, media_type]);

  useEffect(() => {
    async function getDetails(id: string, type: 'movie' | 'tv') {
      setLoadingDetails(true);
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/${type}/${id}?api_key=${API_KEY}`
        );
        if (!res.ok) throw new Error('Failed to fetch details');
        const data = await res.json();
        setOverview(data.overview || 'No description available.');
        setGenres(data.genres || []);
      } catch (error) {
        console.error('Error fetching details:', error);
        setOverview('Could not load description.');
        setGenres([]);
      } finally {
        setLoadingDetails(false);
      }
    }
    if (id && media_type) {
      getDetails(id, media_type);
    }
  }, [id, media_type]);
  
  useEffect(() => {
    if (!user || !id) {
        setLoadingUserData(false);
        return;
    }
    
    const fetchUserData = async () => {
        setLoadingUserData(true);
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const ratedMovie = (data.ratedMovies || []).find((m: any) => m.movieId === id && m.mediaType === media_type);
                const watchedMovie = (data.watchedMovies || []).some((m: any) => m.movieId === id && m.mediaType === media_type);
                setUserRating(ratedMovie?.rating || 0);
                setIsWatched(watchedMovie);
            }
        } catch (error) {
            console.error("Error fetching user data for detail page:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load your rating.' });
        } finally {
            setLoadingUserData(false);
        }
    };

    fetchUserData();
  }, [user, id, media_type, toast]);

  const handleRateMovie = async (rating: number) => {
    if (!user) return;
    const movieIdentifier = { movieId: id, mediaType: media_type };
    const originalRating = userRating;
    setUserRating(rating);

    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const currentRatings = userDoc.data()?.ratedMovies || [];
      const newRatings = [...currentRatings.filter((r: any) => r.movieId !== id || r.mediaType !== media_type), {...movieIdentifier, rating}];
      
      await updateDoc(userDocRef, { ratedMovies: newRatings });
      toast({ title: 'Rating saved!', description: 'Your recommendations will be updated.' });
    } catch (error) {
       setUserRating(originalRating);
       toast({ variant: 'destructive', title: 'Error', description: 'Could not save rating.' });
    }
  };
  
  const handleToggleWatched = async (watched: boolean) => {
    if (!user) return;
    const movieIdentifier = { movieId: id, mediaType: media_type };
    const originalWatched = isWatched;
    setIsWatched(watched);
    
    try {
        const userDocRef = doc(db, 'users', user.uid);
        if (watched) {
            await updateDoc(userDocRef, { watchedMovies: arrayUnion(movieIdentifier) });
        } else {
            await updateDoc(userDocRef, { watchedMovies: arrayRemove(movieIdentifier) });
        }
    } catch (error) {
        setIsWatched(originalWatched);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };

  const posterUrl = poster && poster !== 'null'
    ? `https://image.tmdb.org/t/p/w500${poster}`
    : 'https://placehold.co/500x750.png';

  const decodedTitle = decodeURIComponent(title);

  const movieDetails = {
    id: id,
    media_type: media_type,
    title: decodedTitle,
    poster: poster,
  };

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/search">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Search
            </Link>
          </Button>
        </div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-12">
          <div className="w-full flex-shrink-0 md:w-64">
             <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg">
                <Image
                  src={posterUrl}
                  alt={`Poster for ${decodedTitle}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 256px"
                  data-ai-hint="movie poster"
                />
             </div>
          </div>
          <div className="flex-grow">
            <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">{decodedTitle}</h1>
            <div className="mt-2 flex items-center gap-2 text-muted-foreground">
              {media_type === 'movie' ? 'Movie' : 'TV Show'}
              {yearFromSearch && yearFromSearch !== 'null' && (
                <>
                  <span className="text-sm">·</span>
                  <span>{yearFromSearch}</span>
                </>
              )}
              <span className="text-sm">·</span>
               <div className="flex items-center gap-1">
                 <Star className="h-4 w-4 text-amber-500" />
                 <span className="font-semibold text-foreground">{parseFloat(ratingFromSearch).toFixed(1)}</span>
                 <span>/ 10</span>
               </div>
            </div>

            {loadingDetails ? (
              <div className="mt-4 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="flex gap-2 pt-2">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-24 rounded-full" />
                </div>
              </div>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap gap-2">
                    {genres.map(genre => (
                        <Badge key={genre.id} variant="secondary">{genre.name}</Badge>
                    ))}
                </div>
                <p className="mt-4 text-muted-foreground">{overview}</p>
              </>
            )}
            
            <div className="mt-6 flex flex-col items-start gap-4">
              <div className="flex items-center gap-2">
                <SendRecommendationButton movie={movieDetails} />
              </div>
              
              {!loadingUserData && (
                <>
                  <div className="flex flex-col items-start gap-2">
                      <p className="text-sm font-semibold text-muted-foreground">Your Rating</p>
                      <Rating rating={userRating} onRatingChange={handleRateMovie} starSize={24} />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                        id={`watched-detail-${id}`}
                        checked={isWatched}
                        onCheckedChange={handleToggleWatched}
                    />
                    <label
                        htmlFor={`watched-detail-${id}`}
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                        <Eye className="h-4 w-4" />
                        Mark as Watched
                    </label>
                  </div>
                </>
              )}
            </div>
            
            <div className="mt-8">
              <h2 className="text-xl font-bold font-headline">Watch in Türkiye</h2>
              {loadingProviders ? (
                <div className="mt-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              ) : platforms && platforms.length === 0 ? (
                <p className="mt-4 text-muted-foreground">No streaming platforms found.</p>
              ) : (
                platforms && (
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {platforms.map((p) => (
                      <div key={p.provider_id} className="flex items-center gap-3 rounded-lg bg-card p-3 shadow-sm">
                        <div className="relative h-10 w-10 overflow-hidden rounded-md bg-white">
                          <Image
                            src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                            alt={`${p.provider_name} logo`}
                            fill
                            className="object-contain"
                            sizes="40px"
                          />
                        </div>
                        <span className="text-sm font-medium">{p.provider_name}</span>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
