
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Send, Users, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useRouter } from 'next/navigation';

interface MovieDetails {
  id: string;
  media_type: 'movie' | 'tv';
  title: string;
  poster: string | null;
}

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  photoURL?: string;
}

export function SendRecommendationButton({ movie, isIconOnly = false }: { movie: MovieDetails, isIconOnly?: boolean }) {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && firebaseUser) {
      const fetchFriends = async () => {
        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              if (userData.friends && userData.friends.length > 0) {
                const friendProfiles = await Promise.all(
                  userData.friends.map(async (uid: string) => {
                    const friendDoc = await getDoc(doc(db, 'users', uid));
                    return friendDoc.exists() ? (friendDoc.data() as UserProfile) : null;
                  })
                );
                setFriends(friendProfiles.filter(Boolean) as UserProfile[]);
              } else {
                setFriends([]);
              }
            }
        } catch (error) {
            console.error("Error fetching friends list:", error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Could not load your friends list. Please check your connection.'
            });
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
      };
      fetchFriends();
    }
  }, [isOpen, firebaseUser, toast]);

  const handleSend = async (friendId: string) => {
    if (!firebaseUser) return;
    setSending(friendId);

    const chatId = [firebaseUser.uid, friendId].sort().join('_');
    const chatDocRef = doc(db, 'chats', chatId);
    const messagesRef = collection(chatDocRef, 'messages');

    try {
        const chatDoc = await getDoc(chatDocRef);
        if (!chatDoc.exists()) {
             await setDoc(chatDocRef, {
                users: [firebaseUser.uid, friendId],
                createdAt: serverTimestamp(),
            });
        }
        
      const recommendationMessage = {
        text: `Recommended: ${movie.title}`,
        senderId: firebaseUser.uid,
        createdAt: serverTimestamp(),
        type: 'recommendation',
        movie: {
          id: movie.id,
          title: movie.title,
          poster: movie.poster,
          mediaType: movie.media_type
        },
      };

      await addDoc(messagesRef, recommendationMessage);
      await updateDoc(chatDocRef, {
          lastMessage: {
              text: `Sent a movie recommendation.`,
              senderId: firebaseUser.uid,
              createdAt: serverTimestamp(),
              readBy: [firebaseUser.uid]
          }
      });

      toast({ title: 'Success!', description: `Recommendation sent to your friend.` });
      setIsOpen(false);
      router.push(`/chat/${chatId}`);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send recommendation.' });
    } finally {
      setSending(null);
    }
  };
  
  const getInitials = (name?: string) => name ? name.substring(0, 2).toUpperCase() : '?';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isIconOnly ? (
            <Button variant="outline" size="icon" aria-label="Send to a Friend">
                <Send className="h-4 w-4" />
            </Button>
        ) : (
            <Button variant="outline">
                <Send className="mr-2 h-4 w-4" /> Send to a Friend
            </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send "{movie.title}"</DialogTitle>
          <DialogDescription>Select a friend to share this with.</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loading ? (
            <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
          ) : friends.length > 0 ? (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {friends.map((friend) => (
                <li key={friend.uid}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start h-auto p-2"
                    onClick={() => handleSend(friend.uid)}
                    disabled={!!sending}
                  >
                    {sending === friend.uid ? (
                      <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                    ) : (
                      <Avatar className="mr-3 h-8 w-8">
                        {friend.photoURL && <AvatarImage src={friend.photoURL} alt={friend.username} />}
                        <AvatarFallback>{getInitials(friend.username)}</AvatarFallback>
                      </Avatar>
                    )}
                    <span>{friend.username}</span>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-sm text-muted-foreground flex flex-col items-center gap-3 py-4">
              <Users className="h-12 w-12 text-muted-foreground/50"/>
              <p className="font-semibold text-lg text-foreground">No friends yet!</p>
              <p>Add friends to share movies with them.</p>
              <Button asChild className="mt-4" onClick={() => setIsOpen(false)}>
                  <Link href={`/chat`}>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Find Friends
                  </Link>
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
            <Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
