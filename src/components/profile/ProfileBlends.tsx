'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { Loader2, Users, Combine } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface UserProfile {
    uid: string;
    username?: string;
    email: string;
    photoURL?: string;
    activeBlendsWith?: string[];
}

interface BlendPartner {
    uid: string;
    username?: string;
    email: string;
    photoURL?: string;
}

export function ProfileBlends() {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [blends, setBlends] = useState<BlendPartner[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !firebaseUser) return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
      setLoading(true);
      if (docSnap.exists()) {
        const userData = docSnap.data() as UserProfile;
        if (userData.activeBlendsWith && userData.activeBlendsWith.length > 0) {
          const blendPromises = userData.activeBlendsWith.map(async (friendId) => {
            const friendDoc = await getDoc(doc(db, 'users', friendId));
            if (friendDoc.exists()) {
              return friendDoc.data() as BlendPartner;
            }
            return null;
          });
          const resolvedBlends = (await Promise.all(blendPromises)).filter(
            (b): b is BlendPartner => b !== null
          );
          setBlends(resolvedBlends);
        } else {
          setBlends([]);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseUser, authLoading]);
  
  const getInitials = (email: string | undefined) => {
    if (!email) return '?';
    return email.substring(0, 2).toUpperCase();
  }

  if (loading || authLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (blends.length === 0) {
    return (
        <Card className="text-center py-10">
            <CardHeader>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <Combine className="h-8 w-8 text-primary" />
                </div>
                <CardTitle>No Active Blends</CardTitle>
                <CardDescription>
                    Go to the Friends tab to send a Blend invite to a friend. Once they accept, your blend will appear here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Button asChild>
                    <Link href={`/profile/${firebaseUser?.uid}`}>Go to Friends</Link>
                </Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {blends.map((blendPartner) => (
        <Card key={blendPartner.uid}>
          <CardHeader>
            <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                    {blendPartner.photoURL && <AvatarImage src={blendPartner.photoURL} alt={blendPartner.username} />}
                    <AvatarFallback className="text-xl">{getInitials(blendPartner.email)}</AvatarFallback>
                </Avatar>
                <div>
                    <CardTitle className="text-lg">Blend with</CardTitle>
                    <CardDescription>{blendPartner.username || blendPartner.email}</CardDescription>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/blend/${blendPartner.uid}`}>
                <Combine className="mr-2 h-4 w-4" /> View Blend
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
