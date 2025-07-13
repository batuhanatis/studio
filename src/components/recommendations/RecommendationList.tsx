
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
import { Loader2, Inbox, Tv, Film } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Recommendation {
  id: string;
  fromUserId: string;
  fromUsername?: string;
  fromPhotoURL?: string;
  movieId: string;
  movieTitle: string;
  moviePoster: string | null;
  mediaType: 'movie' | 'tv';
  createdAt: {
    seconds: number;
    nanoseconds: number;
  };
}

interface GroupedRecommendation {
    senderId: string;
    senderName: string;
    senderPhotoURL?: string;
    recommendations: Recommendation[];
    lastSent: Date;
}

export function RecommendationList() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [groupedRecommendations, setGroupedRecommendations] = useState<GroupedRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const getInitials = (name?: string) => name ? name.substring(0, 2).toUpperCase() : '?';

  useEffect(() => {
    if (authLoading || !firebaseUser) {
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
          const fetchedRecs: Recommendation[] = await Promise.all(
            querySnapshot.docs.map(async (d) => {
              const data = d.data();
              const fromUserDoc = await getDoc(doc(db, 'users', data.fromUserId));
              const fromUserData = fromUserDoc.exists()
                ? fromUserDoc.data()
                : { username: 'A friend', photoURL: '' };
              return {
                id: d.id,
                ...data,
                fromUsername: fromUserData.username,
                fromPhotoURL: fromUserData.photoURL,
              } as Recommendation;
            })
          );
          
          const groups: Record<string, GroupedRecommendation> = {};
          
          fetchedRecs.forEach(rec => {
              if (!groups[rec.fromUserId]) {
                  groups[rec.fromUserId] = {
                      senderId: rec.fromUserId,
                      senderName: rec.fromUsername || 'A friend',
                      senderPhotoURL: rec.fromPhotoURL,
                      recommendations: [],
                      lastSent: new Date(0)
                  };
              }
              groups[rec.fromUserId].recommendations.push(rec);
              const recDate = new Date(rec.createdAt.seconds * 1000);
              if (recDate > groups[rec.fromUserId].lastSent) {
                  groups[rec.fromUserId].lastSent = recDate;
              }
          });
          
          const sortedGroups = Object.values(groups).sort((a, b) => b.lastSent.getTime() - a.lastSent.getTime());

          setGroupedRecommendations(sortedGroups);

        } catch (error) {
          console.error('Error processing recommendations:', error);
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Could not load recommendations.',
          });
          setGroupedRecommendations([]);
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
        setGroupedRecommendations([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, toast, authLoading]);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recommendations Inbox</CardTitle>
        <CardDescription>Movies and shows recommended to you by your friends.</CardDescription>
      </CardHeader>
      <CardContent>
          {loading || authLoading ? (
            <div className="flex flex-col items-center gap-2 pt-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Loading recommendations...</p>
            </div>
          ) : groupedRecommendations.length === 0 ? (
            <div className="pt-8 text-center text-muted-foreground flex flex-col items-center gap-4">
              <Inbox className="h-16 w-16" />
              <p className="text-lg">Your inbox is empty.</p>
              <p className="text-sm">Recommendations from friends will appear here.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-2">
              {groupedRecommendations.map((group) => (
                <AccordionItem value={group.senderId} key={group.senderId} className="border-b-0">
                   <Card className="overflow-hidden">
                    <AccordionTrigger className="p-4 hover:no-underline hover:bg-muted/50">
                        <div className="flex items-center justify-between w-full">
                           <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10">
                                {group.senderPhotoURL && <AvatarImage src={group.senderPhotoURL} alt={group.senderName} />}
                                <AvatarFallback>{getInitials(group.senderName)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <p className="font-semibold text-left">{group.senderName}</p>
                                    <p className="text-xs text-muted-foreground text-left">{group.recommendations.length} new recommendation{group.recommendations.length > 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <span className="text-xs text-muted-foreground pr-2">{formatDistanceToNow(group.lastSent)} ago</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                        <div className="border-t">
                            {group.recommendations.map(item => {
                                 const href = `/search/${item.mediaType}/${item.movieId}`;
                                 const posterUrl = item.moviePoster
                                     ? `https://image.tmdb.org/t/p/w200${item.moviePoster}`
                                     : 'https://placehold.co/200x300.png';

                                return (
                                <Link href={href} key={item.id} className="block hover:bg-secondary/50">
                                    <div className="flex items-center gap-4 p-3 border-b last:border-b-0">
                                        <div className="relative w-16 aspect-[2/3] flex-shrink-0 bg-muted rounded-md overflow-hidden">
                                        <Image
                                            src={posterUrl}
                                            alt={item.movieTitle}
                                            fill
                                            className="object-cover"
                                            sizes="64px"
                                            data-ai-hint="movie poster"
                                        />
                                        </div>
                                        <div className="flex-grow">
                                            <h4 className="font-semibold">{item.movieTitle}</h4>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                {item.mediaType === 'movie' ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
                                                <span>{item.mediaType === 'movie' ? 'Movie' : 'TV Show'}</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground self-start">{formatDistanceToNow(new Date(item.createdAt.seconds * 1000))} ago</p>
                                    </div>
                                </Link>
                                );
                            })}
                        </div>
                    </AccordionContent>
                   </Card>
                </AccordionItem>
              ))}
            </Accordion>
          )}
      </CardContent>
    </Card>
  );
}
