'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { Loader2, Film, Tv, Inbox } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface Recommendation {
  id: string;
  fromUserId: string;
  fromUserEmail?: string;
  movieId: string;
  movieTitle: string;
  moviePoster: string | null;
  mediaType: 'movie' | 'tv';
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

export function RecommendationList() {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'recommendations'),
      where('toUserId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        setLoading(true);
        try {
          const recs: Recommendation[] = await Promise.all(
            querySnapshot.docs.map(async (d) => {
              const data = d.data();
              const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
              const fromUserEmail = fromUserDoc.exists()
                ? fromUserDoc.data().email
                : 'A friend';
              return {
                id: d.id,
                ...data,
                fromUserEmail,
              } as Recommendation;
            })
          );
          setRecommendations(recs);
        } catch (error) {
          console.error('Error processing recommendations:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not load recommendations.',
          });
          setRecommendations([]);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching recommendations snapshot:', error);
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: 'Could not load your recommendations.',
        });
        setRecommendations([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, toast]);

  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">
        From Your Friends
      </h1>

      {loading && (
        <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p>Loading recommendations...</p>
        </div>
      )}

      {!loading && recommendations.length === 0 && (
        <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
          <Inbox className="h-16 w-16" />
          <p className="text-lg">Your inbox is empty.</p>
          <p className="text-sm">Recommendations from friends will appear here.</p>
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="w-full max-w-4xl space-y-4">
          {recommendations.map((item) => {
            const title = item.movieTitle;
            const href = `/search/${item.mediaType}/${item.movieId}?title=${encodeURIComponent(
              title
            )}&poster=${item.moviePoster}&rating=0`;
            const posterUrl =
              item.moviePoster && item.moviePoster !== 'null'
                ? `https://image.tmdb.org/t/p/w200${item.moviePoster}`
                : 'https://placehold.co/200x300.png';
            return (
              <Link href={href} key={item.id} className="block">
                <Card className="shadow-md overflow-hidden hover:shadow-lg hover:border-primary/50 transition-all duration-200">
                  <CardContent className="p-0 flex">
                    <div className="relative w-28 h-40 md:w-32 md:h-48 flex-shrink-0 bg-muted">
                      <Image
                        src={posterUrl}
                        alt={title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 112px, 128px"
                        data-ai-hint="movie poster"
                      />
                    </div>
                    <div className="p-4 flex flex-col justify-center gap-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback>
                            {getInitials(item.fromUserEmail || '?')}
                          </AvatarFallback>
                        </Avatar>
                        <span>
                          <span className="font-semibold text-foreground">
                            {item.fromUserEmail}
                          </span>{' '}
                          recommended
                        </span>
                      </div>
                      <h3 className="text-lg font-bold font-headline">{title}</h3>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {item.mediaType === 'movie' ? (
                          <Film className="h-4 w-4" />
                        ) : (
                          <Tv className="h-4 w-4" />
                        )}
                        <span>{item.mediaType === 'movie' ? 'Movie' : 'TV Show'}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDistanceToNow(new Date(item.createdAt.seconds * 1000))} ago
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
