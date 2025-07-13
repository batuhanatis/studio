
'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  doc,
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  updateDoc,
  arrayUnion
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Send, ArrowLeft, Tv, Film } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';
import { Card } from '../ui/card';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: { seconds: number; nanoseconds: number };
  type: 'text' | 'recommendation';
  movie?: {
    id: string;
    title: string;
    poster: string | null;
    mediaType: 'movie' | 'tv';
  };
}

interface Recipient {
  uid: string;
  username: string;
  photoURL?: string;
  isOnline?: boolean;
}

interface ChatInterfaceProps {
  chatId: string;
  recipientId: string;
}

export function ChatInterface({ chatId, recipientId }: ChatInterfaceProps) {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fetch recipient's profile data
    const userDocRef = doc(db, 'users', recipientId);
    const unsubscribeUser = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        setRecipient(doc.data() as Recipient);
      }
    });

    // Listen for new messages in the chat
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Message));
      setMessages(newMessages);
      setLoading(false);
    });
    
    // Mark chat as read
    const markAsRead = async () => {
        if(firebaseUser) {
            const chatDocRef = doc(db, 'chats', chatId);
            await updateDoc(chatDocRef, {
                'lastMessage.readBy': arrayUnion(firebaseUser.uid)
            });
        }
    };
    markAsRead();


    return () => {
      unsubscribeUser();
      unsubscribeMessages();
    };
  }, [chatId, recipientId, firebaseUser]);
  
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !firebaseUser) return;

    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const chatDocRef = doc(db, 'chats', chatId);
    const text = newMessage;
    setNewMessage('');

    try {
      await addDoc(messagesRef, {
        text,
        senderId: firebaseUser.uid,
        createdAt: serverTimestamp(),
        type: 'text',
      });
      await updateDoc(chatDocRef, {
          lastMessage: {
              text,
              senderId: firebaseUser.uid,
              createdAt: serverTimestamp(),
              readBy: [firebaseUser.uid] // Sender has read it by default
          }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not send message.' });
    }
  };
  
  if (loading) {
    return (
        <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Chat Header */}
      <div className="flex items-center gap-4 border-b p-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden">
            <Link href="/chat"><ArrowLeft/></Link>
        </Button>
        <Avatar>
          {recipient?.photoURL && <AvatarImage src={recipient.photoURL} alt={recipient.username} />}
          <AvatarFallback>{getInitials(recipient?.username)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="font-bold text-lg">{recipient?.username}</h2>
          {/* Add online status if available */}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.map((msg, index) => {
          const isSender = msg.senderId === firebaseUser?.uid;
          const showAvatar = index === messages.length - 1 || messages[index + 1]?.senderId !== msg.senderId;

          if (msg.type === 'recommendation' && msg.movie) {
             const movie = msg.movie;
             const href = `/search/${movie.mediaType}/${movie.id}`;
             const posterUrl = movie.poster ? `https://image.tmdb.org/t/p/w200${movie.poster}` : 'https://placehold.co/200x300.png';
             return (
                 <div key={msg.id} className={cn('flex items-end gap-2 my-2', isSender ? 'justify-end' : 'justify-start')}>
                     <Card className="max-w-xs p-2">
                        <Link href={href} className="group">
                             <h4 className="font-semibold text-sm mb-2">{movie.title}</h4>
                             <div className="relative w-40 aspect-[2/3] bg-muted rounded-md overflow-hidden">
                                <Image src={posterUrl} alt={movie.title} fill className="object-cover" sizes="160px" />
                             </div>
                             <p className="text-xs text-muted-foreground mt-2 group-hover:underline">View Details</p>
                        </Link>
                     </Card>
                 </div>
             )
          }

          return (
            <div key={msg.id} className={cn('flex items-end gap-2 my-1', isSender ? 'justify-end' : 'justify-start')}>
              {/* Other user's avatar */}
              {!isSender && (
                 <div className="w-8">
                    {showAvatar && (
                        <Avatar className="h-8 w-8">
                            {recipient?.photoURL && <AvatarImage src={recipient.photoURL} />}
                            <AvatarFallback>{getInitials(recipient?.username)}</AvatarFallback>
                        </Avatar>
                    )}
                 </div>
              )}
              <div
                className={cn(
                  'max-w-xs rounded-lg px-4 py-2 break-words',
                  isSender ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                )}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="border-t p-4">
        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" size="icon" disabled={!newMessage.trim()}>
            <Send />
          </Button>
        </form>
      </div>
    </div>
  );
}
