
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// This page is now a simple redirector to the dynamic profile page.
export default function ProfileRedirectPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (firebaseUser) {
      // Redirect to the user's own dynamic profile page
      router.replace(`/profile/${firebaseUser.uid}`);
    } else {
      // If not logged in for some reason, send to login
      router.replace('/login');
    }
  }, [firebaseUser, loading, router]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading Profile...</p>
      </div>
    </div>
  );
}
