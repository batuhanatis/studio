
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function ChatPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const chatId = params.chatId as string;
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.push('/login');
      return;
    }

    const verifyChatAccess = async () => {
      setCheckingAuth(true);
      try {
        const chatDocRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatDocRef);
        if (chatDoc.exists()) {
          const chatData = chatDoc.data();
          // The chat document should have a 'users' array field.
          if (chatData.users?.includes(firebaseUser.uid)) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
      } catch (error) {
        console.error("Error verifying chat access:", error);
        setIsAuthorized(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    verifyChatAccess();
  }, [firebaseUser, authLoading, chatId, router]);

  if (authLoading || checkingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen w-full bg-background">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">You do not have permission to view this chat.</p>
          <Button asChild className="mt-6">
            <Link href="/chat">Back to Chats</Link>
          </Button>
        </main>
      </div>
    );
  }
  
  // From the chatId (e.g., "uid1_uid2"), find the other user's ID
  const friendId = chatId.split('_').find(id => id !== firebaseUser?.uid);

  if (!friendId) {
    // This case should be rare if authorization passes.
     return (
      <div className="min-h-screen w-full bg-background">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-destructive">Chat Not Found</h1>
          <p className="mt-2 text-muted-foreground">Could not determine the other user in this chat.</p>
          <Button asChild className="mt-6">
            <Link href="/chat">Back to Chats</Link>
          </Button>
        </main>
      </div>
    );
  }


  return (
    <div className="flex h-[100svh] w-full flex-col bg-background">
      <Header />
      <div className="flex-grow overflow-hidden">
        <ChatInterface chatId={chatId} recipientId={friendId} />
      </div>
    </div>
  );
}
