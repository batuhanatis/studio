'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Film, Tv, Star, Heart, ThumbsDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AddToWatchlistButton } from '../watchlists/AddToWatchlistButton';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';


interface SearchResult {
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

interface UserMovieData {
  movieId: string;
  mediaType: 'movie' | 'tv';
  title: string;
  poster: string | null;
}

interface MovieResultCardProps {
  item: SearchResult;
  isLiked: boolean;
  isDisliked: boolean;
}

export function MovieResultCard({ item, isLiked, isDisliked }: MovieResultCardProps) {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();

  const title = item.title || item.name || 'Untitled';
  const releaseYear = item.release_date?.substring(0, 4) || item.first_air_date?.substring(0, 4);
  const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : 'https://placehold.co/500x750.png';
  const href = `/search/${item.media_type}/${item.id}`;

  const movieDetails = {
    id: item.id,
    media_type: item.media_type,
    title: title,
    poster: item.poster_path,
    vote_average: item.vote_average,
    release_date: item.release_date,
    first_air_date: item.first_air_date,
  };
  
  const handleToggleLike = async () => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier: UserMovieData = {
      movieId: String(item.id),
      mediaType: item.media_type,
      title: item.title || item.name || 'Untitled',
      poster: item.poster_path,
    };
  
    try {
      if (!isLiked) {
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

  const handleToggleDislike = async () => {
    if (!firebaseUser) return;
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const movieIdentifier: UserMovieData = {
      movieId: String(item.id),
      mediaType: item.media_type,
      title: item.title || item.name || 'Untitled',
      poster: item.poster_path,
    };
  
    try {
      if (!isDisliked) {
        await updateDoc(userDocRef, { 
            dislikedMovies: arrayUnion(movieIdentifier),
            likedMovies: arrayRemove(movieIdentifier)
        });
        toast({ title: 'Disliked!', description: `You won't see recommendations for "${movieIdentifier.title}".`});
      } else {
        await updateDoc(userDocRef, { dislikedMovies: arrayRemove(movieIdentifier) });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update dislike status.' });
    }
  };

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/60 bg-card shadow-md transition-all duration-300 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/20 group">
      <Link href={href} className="relative block">
        <div className="absolute inset-0 z-10 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            data-ai-hint="movie poster"
          />
        </div>
      </Link>
      <CardContent className="flex flex-grow flex-col p-3">
        <Link href={href} className="flex-grow">
          <h3 className="font-headline font-bold leading-tight line-clamp-2 transition-colors hover:text-primary">{title}</h3>
        </Link>
        <div className="mt-auto space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                    {item.media_type === 'movie' ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
                    <span>{releaseYear || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-accent" />
                    <span className="font-semibold text-foreground">{item.vote_average > 0 ? `${item.vote_average.toFixed(1)}` : 'N/A'}</span>
                </div>
            </div>
          
            <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleToggleLike}
                    >
                      <Heart className={cn("h-4 w-4", isLiked ? 'text-red-500 fill-current' : 'text-muted-foreground')} />
                    </Button>
                     <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={handleToggleDislike}
                    >
                      <ThumbsDown className={cn("h-4 w-4", isDisliked ? 'text-blue-500 fill-current' : 'text-muted-foreground')} />
                    </Button>
                </div>
                <AddToWatchlistButton movie={movieDetails} isIconOnly={true} />
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
