
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { EditProfileForm } from '@/components/profile/EditProfileForm';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function EditProfilePage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser || firebaseUser.isAnonymous) {
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
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
            <Button asChild variant="outline" size="sm">
                <Link href={`/profile/${firebaseUser.uid}`}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile</Link>
            </Button>
        </div>
        <EditProfileForm />
      </main>
    </div>
  );
}
