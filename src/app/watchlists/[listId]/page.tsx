'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { WatchlistDetail } from '@/components/watchlists/WatchlistDetail';

export default function WatchlistDetailPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const listId = params.listId as string;

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);
  
  if (loading || !firebaseUser || !listId) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Watchlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <WatchlistDetail listId={listId} />
      </main>
    </div>
  );
}
