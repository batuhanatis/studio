'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (firebaseUser) {
      const isEmailPasswordUser = firebaseUser.providerData.some(
        (provider) => provider.providerId === 'password'
      );

      if (isEmailPasswordUser && !firebaseUser.emailVerified) {
        router.push('/verify-email');
      } else {
        router.push('/search');
      }
    } else {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading Movie Finder...</p>
      </div>
    </div>
  );
}
