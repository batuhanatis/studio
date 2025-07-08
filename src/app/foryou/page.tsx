'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ForYouFeed } from '@/components/foryou/ForYouFeed';

export default function ForYouPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const isEmailPasswordUser = user.providerData.some(
      (provider) => provider.providerId === 'password'
    );
    if (isEmailPasswordUser && !user.emailVerified) {
      router.push('/verify-email');
    }
  }, [user, loading, router]);
  
  const isEmailPasswordUser = user?.providerData.some(
    (provider) => provider.providerId === 'password'
  );

  if (loading || !user || (isEmailPasswordUser && !user.emailVerified)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading For You...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <ForYouFeed />
      </main>
    </div>
  );
}
