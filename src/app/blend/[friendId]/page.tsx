
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { BlendFeed } from '@/components/blend/BlendFeed';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export default function BlendPage() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const friendId = params.friendId as string;
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.push('/login');
      return;
    }

    const checkBlendAuthorization = async () => {
      try {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userData = userDoc.data();
          // A blend is authorized if the friendId is in the user's `activeBlendsWith` array.
          if (Array.isArray(userData.activeBlendsWith) && userData.activeBlendsWith.includes(friendId)) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        }
      } catch (error) {
        console.error("Error checking blend authorization:", error);
        setIsAuthorized(false);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkBlendAuthorization();

  }, [firebaseUser, authLoading, router, friendId]);
  
  if (authLoading || checkingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Verifying Blend...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
       <div className="min-h-screen w-full bg-background">
        <Header />
        <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 mb-6">
                <Lock className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold font-headline">Access Denied</h1>
            <p className="mt-2 text-lg text-muted-foreground">
                You don't have an active Blend with this user.
            </p>
            <p className="text-muted-foreground">
                Go to your Friends list to send or accept a Blend invite.
            </p>
            <Button asChild className="mt-6">
                <Link href="/friends">Go to Friends</Link>
            </Button>
        </main>
       </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <BlendFeed friendId={friendId} />
      </main>
    </div>
  );
}

    