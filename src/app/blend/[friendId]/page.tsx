
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
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
  const [authMessage, setAuthMessage] = useState('Verifying Blend...');

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      router.push('/login');
      return;
    }

    const checkBlendAuthorization = async () => {
      try {
        setCheckingAuth(true);
        setAuthMessage('Checking your profile...');
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (!userDoc.exists()) {
          setIsAuthorized(false);
          setAuthMessage("Your profile could not be found.");
          setCheckingAuth(false);
          return;
        }

        const userData = userDoc.data();
        // Check if the current user has an active blend with the friend.
        const userHasBlend = Array.isArray(userData.activeBlendsWith) && userData.activeBlendsWith.includes(friendId);
        if (!userHasBlend) {
            setIsAuthorized(false);
            setAuthMessage("You don't have an active Blend with this user.");
            setCheckingAuth(false);
            return;
        }

        setAuthMessage(`Checking your friend's profile...`);
        const friendDocRef = doc(db, 'users', friendId);
        const friendDoc = await getDoc(friendDocRef);

        if (!friendDoc.exists()) {
            setIsAuthorized(false);
            setAuthMessage("Your friend's profile could not be found.");
            setCheckingAuth(false);
            return;
        }
        
        const friendData = friendDoc.data();
        // Check if the friend also has an active blend with the current user. This confirms mutual agreement.
        const friendHasBlend = Array.isArray(friendData.activeBlendsWith) && friendData.activeBlendsWith.includes(firebaseUser.uid);
        if (!friendHasBlend) {
            setIsAuthorized(false);
            setAuthMessage("This Blend is not active on your friend's side yet.");
            setCheckingAuth(false);
            return;
        }

        // Both users have the blend active.
        setIsAuthorized(true);
      } catch (error) {
        console.error("Error checking blend authorization:", error);
        setIsAuthorized(false);
        setAuthMessage("An error occurred while verifying the Blend.");
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
          <p className="text-muted-foreground">{authMessage}</p>
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
            <h1 className="text-3xl font-bold font-headline">Blend Not Active</h1>
            <p className="mt-2 text-lg text-muted-foreground">
                {authMessage}
            </p>
            <p className="text-muted-foreground">
                Go to your Friends list to send or accept a Blend invite. The Blend will be active once one person accepts the invite.
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
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/profile/${firebaseUser?.uid}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile</Link>
        </Button>
        <BlendFeed friendId={friendId} />
      </main>
    </div>
  );
}
