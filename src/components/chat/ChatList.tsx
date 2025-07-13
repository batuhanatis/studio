
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, MessageSquare } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Chat {
  id: string; // The chat document ID
  users: string[]; // Array of user UIDs in the chat
  lastMessage: {
    text: string;
    senderId: string;
    createdAt: { seconds: number; nanoseconds: number };
    readBy: string[];
  };
  otherUser: { // Details of the other user in the chat
    uid: string;
    username: string;
    photoURL?: string;
  };
}

export function ChatList() {
  const { firebaseUser } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'chats'),
      where('users', 'array-contains', firebaseUser.uid),
      orderBy('lastMessage.createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (querySnapshot) => {
        try {
          const fetchedChats: Chat[] = await Promise.all(
            querySnapshot.docs.map(async (d) => {
              const data = d.data();
              const otherUserId = data.users.find((uid: string) => uid !== firebaseUser.uid);
              const userDoc = await getDoc(doc(db, 'users', otherUserId));
              const otherUserData = userDoc.exists()
                ? (userDoc.data() as Chat['otherUser'])
                : { uid: 'unknown', username: 'Unknown User' };

              return {
                id: d.id,
                ...data,
                otherUser: otherUserData,
              } as Chat;
            })
          );
          setChats(fetchedChats);
        } catch (error) {
          console.error("Error processing chats:", error);
          toast({ variant: 'destructive', title: 'Error', description: 'Could not load your conversations.' });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error fetching chats snapshot:", error);
        toast({ variant: 'destructive', title: 'Connection Error', description: 'Could not sync your chats.' });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [firebaseUser, toast]);
  
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  }
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
        <Card className="text-center py-10">
            <CardHeader>
                 <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>No Chats Yet</CardTitle>
                <CardDescription>
                    Find friends in the Discover tab to start a conversation.
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }

  return (
    <div className="space-y-3">
      {chats.map(chat => {
        const isUnread = chat.lastMessage?.senderId !== firebaseUser?.uid && !chat.lastMessage?.readBy.includes(firebaseUser?.uid || '');
        return (
            <div
                key={chat.id}
                onClick={() => router.push(`/chat/${chat.id}`)}
                className="flex items-center gap-4 p-3 rounded-lg cursor-pointer hover:bg-secondary transition-colors"
            >
                <Avatar className="h-12 w-12">
                    {chat.otherUser.photoURL && <AvatarImage src={chat.otherUser.photoURL} alt={chat.otherUser.username} />}
                    <AvatarFallback>{getInitials(chat.otherUser.username)}</AvatarFallback>
                </Avatar>
                <div className="flex-grow overflow-hidden">
                    <div className="flex justify-between items-start">
                        <h3 className="font-semibold truncate">{chat.otherUser.username}</h3>
                        {chat.lastMessage?.createdAt && (
                             <p className="text-xs text-muted-foreground flex-shrink-0">
                                {formatDistanceToNow(new Date(chat.lastMessage.createdAt.seconds * 1000), { addSuffix: true })}
                            </p>
                        )}
                    </div>
                    <p className={cn("text-sm truncate", isUnread ? "text-foreground font-bold" : "text-muted-foreground")}>
                       {chat.lastMessage?.senderId === firebaseUser?.uid && "You: "}
                       {chat.lastMessage?.text || "No messages yet"}
                    </p>
                </div>
            </div>
        )
      })}
    </div>
  );
}
