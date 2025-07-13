
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { MovieFinder } from '@/components/search/MovieFinder';

function SearchPageContent() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <MovieFinder />
      </main>
    </div>
  );
}


export default function SearchPage() {
  // Wrapping SearchPageContent in Suspense can cause hydration errors
  // if SearchPageContent or its children use client-side only hooks like useSearchParams.
  // We can render it directly as it handles its own loading state.
  return <SearchPageContent />;
}

