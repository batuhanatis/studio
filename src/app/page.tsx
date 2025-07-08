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
      return; // Wait until auth state is resolved
    }

    if (firebaseUser) {
      // User is either permanent or anonymous, send them to the app.
      router.push('/search');
    }
    // There is no "else" because AuthProvider handles signing in non-logged-in users.
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
