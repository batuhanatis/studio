'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { FriendManager } from '@/components/friends/FriendManager';

export default function FriendsPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    const isEmailPasswordUser = firebaseUser.providerData.some(
      (provider) => provider.providerId === 'password'
    );
    if (isEmailPasswordUser && !firebaseUser.emailVerified) {
      router.push('/verify-email');
    }
  }, [firebaseUser, loading, router]);
  
  const isEmailPasswordUser = firebaseUser?.providerData.some(
    (provider) => provider.providerId === 'password'
  );

  if (loading || !firebaseUser || (isEmailPasswordUser && !firebaseUser.emailVerified)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Friends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <FriendManager />
      </main>
    </div>
  );
}
