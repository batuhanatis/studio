
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, Eye, Heart, ThumbsDown } from 'lucide-react';
import Image from 'next/image';
import { AddToWatchlistButton } from '@/components/watchlists/AddToWatchlistButton';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SendRecommendationButton } from '@/components/search/SendRecommendationButton';
import { cn } from '@/lib/utils';

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
  const router = useRouter();
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const id = params.id as string;
  const media_type = params.media_type as 'movie' | 'tv';
  
  const [details, setDetails] = useState<any>(null);
  const [platforms, setPlatforms] = useState<WatchProvider[] | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [isWatched, setIsWatched] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [loadingUserData, setLoadingUserData] = useState(true);

  useEffect(() => {
    async function getDetails(id: string, type: 'movie' | 'tv') {
      setLoading(true);
      try {
        const detailRes = fetch(`https://api.themoviedb.org/3/${type}/${id}?api_key=${API_KEY}&language=en-US`);
        const providerRes = fetch(`https://api.themoviedb.org/3/${type}/${id}/watch/providers?api_key=${API_KEY}`);
        
        const [detailData, providerData] = await Promise.all([(await detailRes).json(), (await providerRes).json()]);

        setDetails(detailData);
        
        const tr = providerData.results?.TR;
        if (tr) {
            const allProviders: WatchProvider[] = [
                ...(tr.flatrate || []),
                ...(tr.buy || []),
                ...(tr.rent || []),
            ];
            const unique = allProviders.filter((v, i, a) => a.findIndex((t) => t.provider_id === v.provider_id) === i);
            setPlatforms(unique);
        } else {
            setPlatforms([]);
        }

      } catch (error) {
        console.error('Error fetching details:', error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load movie details.' });
      } finally {
        setLoading(false);
      }
    }
    if (id && media_type) {
      getDetails(id, media_type);
    }
  }, [id, media_type, toast]);
  
  useEffect(() => {
    if (authLoading || !firebaseUser || !id) {
        setLoadingUserData(false);
        return;
    }
    
    setLoadingUserData(true);
    const userDocRef = doc(db, 'users', firebaseUser.uid);

    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            const movieIdentifier = `${id}-${media_type}`;
            const watchedMovie = (data.watchedMovies || []).some((m: any) => `${m.movieId}-${m.mediaType}` === movieIdentifier);
            const likedMovie = (data.likedMovies || []).some((m: any) => `${m.movieId}-${m.mediaType}` === movieIdentifier);
            const dislikedMovie = (data.dislikedMovies || []).some((m: any) => `${m.movieId}-${m.mediaType}` === movieIdentifier);
            setIsWatched(watchedMovie);
            setIsLiked(likedMovie);
            setIsDisliked(dislikedMovie);
        }
        setLoadingUserData(false);
    }, (error) => {
        console.error("Error fetching user data snapshot:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load your user data.' });
        setLoadingUserData(false);
    });

    return () => unsubscribe();
  }, [firebaseUser, id, media_type, toast, authLoading]);
  
  const handleToggleWatched = async (watched: boolean) => {
    if (!firebaseUser || !details) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier = { 
        movieId: id, 
        mediaType: media_type, 
        title: details.title || details.name,
        poster: details.poster_path
    };

    try {
      if (watched) {
        await updateDoc(userDocRef, { watchedMovies: arrayUnion(movieIdentifier) });
      } else {
        await updateDoc(userDocRef, { watchedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
        console.error("Toggle watched failed: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update watched status.' });
    }
  };

  const handleToggleLike = async () => {
    if (!firebaseUser || !details) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier = {
      movieId: id,
      mediaType: media_type,
      title: details.title || details.name,
      poster: details.poster_path,
    };
  
    try {
      if (!isLiked) {
        await updateDoc(userDocRef, { 
            likedMovies: arrayUnion(movieIdentifier),
            dislikedMovies: arrayRemove(movieIdentifier) // Ensure it's not in dislikes
        });
        toast({ title: 'Liked!', description: `Added "${movieIdentifier.title}" to your likes.`});
      } else {
        await updateDoc(userDocRef, { likedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update like status.' });
    }
  };

  const handleToggleDislike = async () => {
    if (!firebaseUser || !details) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier = {
      movieId: id,
      mediaType: media_type,
      title: details.title || details.name,
      poster: details.poster_path,
    };
  
    try {
      if (!isDisliked) {
        await updateDoc(userDocRef, { 
            dislikedMovies: arrayUnion(movieIdentifier),
            likedMovies: arrayRemove(movieIdentifier) // Ensure it's not in likes
        });
        toast({ title: 'Disliked!', description: `You won't see recommendations for "${movieIdentifier.title}".`});
      } else {
        await updateDoc(userDocRef, { dislikedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update dislike status.' });
    }
  };


  const title = details?.title || details?.name || 'Loading...';
  const releaseYear = details?.release_date?.substring(0, 4) || details?.first_air_date?.substring(0, 4);

  const posterUrl = details?.poster_path
    ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
    : 'https://placehold.co/500x750.png';

  const movieDetailsForButton = details ? {
    id: Number(id),
    media_type: media_type,
    title: title,
    poster: details.poster_path,
    vote_average: details.vote_average,
    release_date: details.release_date,
    first_air_date: details.first_air_date,
  } : null;

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <Button asChild variant="outline" size="sm" onClick={() => router.back()}>
            <span>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </span>
          </Button>
        </div>

        {loading ? (
            <div className="flex flex-col gap-8 md:flex-row md:gap-12">
                <Skeleton className="relative aspect-[2/3] w-full md:w-64 flex-shrink-0 rounded-lg" />
                <div className="flex-grow space-y-4">
                    <Skeleton className="h-10 w-3/4" />
                    <Skeleton className="h-5 w-1/2" />
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-24 rounded-full" />
                    </div>
                    <Skeleton className="h-20 w-full" />
                </div>
            </div>
        ) : (
            details && (
                <div className="flex flex-col gap-8 md:flex-row md:gap-12">
                <div className="w-full flex-shrink-0 md:w-64">
                    <Card className="overflow-hidden shadow-2xl shadow-primary/10">
                    <div className="relative w-full aspect-[2/3]">
                        <Image
                        src={posterUrl}
                        alt={`Poster for ${title}`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 256px"
                        data-ai-hint="movie poster"
                        />
                    </div>
                    </Card>
                </div>
                <div className="flex-grow">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{media_type === 'movie' ? 'Movie' : 'TV Show'}</span>
                        {releaseYear && (
                            <>
                                <span>·</span>
                                <span>{releaseYear}</span>
                            </>
                        )}
                    </div>
                    <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl mt-1">{title}</h1>
                    
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                        {details.genres.map((genre: Genre) => (
                            <Badge key={genre.id} variant="secondary">{genre.name}</Badge>
                        ))}
                    </div>

                    <div className="flex items-center gap-2 mt-4">
                        <Star className="h-6 w-6 text-accent fill-accent md:h-7 md:w-7" />
                        <span className="text-2xl font-bold text-foreground md:text-3xl">{details.vote_average.toFixed(1)}</span>
                        <span className="text-base text-foreground/80">/ 10</span>
                    </div>

                    <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{details.overview || 'No description available.'}</p>
                    
                    <div className="mt-6 space-y-4">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleToggleLike}
                            disabled={loadingUserData}
                            aria-label="Like or unlike"
                        >
                            <Heart className={cn("h-5 w-5", isLiked ? 'text-red-500 fill-current' : 'text-muted-foreground')} />
                        </Button>
                         <Button
                            variant="outline"
                            size="icon"
                            onClick={handleToggleDislike}
                            disabled={loadingUserData}
                            aria-label="Dislike or un-dislike"
                        >
                            <ThumbsDown className={cn("h-5 w-5", isDisliked ? 'text-blue-500 fill-current' : 'text-muted-foreground')} />
                        </Button>
                        {movieDetailsForButton && <AddToWatchlistButton movie={movieDetailsForButton} />}
                        {movieDetailsForButton && <SendRecommendationButton movie={{...movieDetailsForButton, id: String(id)}} />}
                    </div>

                    <Card>
                        <CardContent className="space-y-4 p-4">
                        {authLoading || loadingUserData ? (
                            <div className="flex justify-center items-center h-10">
                                <Loader2 className="animate-spin text-primary" />
                            </div>
                        ) : (
                            <>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                id={`watched-detail-${id}`}
                                checked={isWatched}
                                onCheckedChange={handleToggleWatched}
                                />
                                <label
                                htmlFor={`watched-detail-${id}`}
                                className="flex cursor-pointer items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                <Eye className="h-4 w-4" />
                                Mark as Watched
                                </label>
                            </div>
                            </>
                        )}
                        </CardContent>
                    </Card>
                    </div>
                    
                    {platforms && platforms.length > 0 && (
                        <div className="mt-8">
                            <h2 className="text-xl font-bold font-headline">Watch in Türkiye</h2>
                            <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
                            {platforms.map((p) => (
                                <div key={p.provider_id} className="flex flex-col items-center gap-2 text-center">
                                <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-secondary/50 shadow-sm">
                                    <Image
                                    src={`https://image.tmdb.org/t/p/original${p.logo_path}`}
                                    alt={`${p.provider_name} logo`}
                                    fill
                                    className="object-contain p-1"
                                    sizes="64px"
                                    />
                                </div>
                                <span className="text-xs font-medium text-muted-foreground">{p.provider_name}</span>
                                </div>
                            ))}
                            </div>
                        </div>
                    )}
                </div>
                </div>
            )
        )}
      </main>
    </div>
  );
}
