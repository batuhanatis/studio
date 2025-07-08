'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) {
      return;
    }

    if (user) {
      const isEmailPasswordUser = user.providerData.some(
        (provider) => provider.providerId === 'password'
      );

      if (isEmailPasswordUser && !user.emailVerified) {
        router.push('/verify-email');
      } else {
        router.push('/search');
      }
    } else {
      router.push('/login');
    }
  }, [user, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading Movie Finder...</p>
      </div>
    </div>
  );
}
