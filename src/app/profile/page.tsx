
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, Mail, LogOut, User } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export default function ProfilePage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [authStatus, setAuthStatus] = useState('Checking auth state...');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setAuthStatus(`Kullanıcı giriş yaptı: ${user.uid} (Anonymous: ${user.isAnonymous})`);
      } else {
        setAuthStatus("Giriş yapan kullanıcı yok");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/search');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: 'Could not log you out. Please try again.',
      });
    }
  };
  
  const getInitials = (email: string | null | undefined) => {
    if (!email) return 'G'; // Guest
    return email.substring(0, 2).toUpperCase();
  }
  
  if (loading || !firebaseUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Profile...</p>
        </div>
      </div>
    );
  }
  
  if (firebaseUser.isAnonymous) {
      return (
        <div className="min-h-screen w-full bg-background">
          <Header />
          <main className="container mx-auto max-w-2xl px-4 py-8">
            <Card className="text-center">
                <CardHeader>
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                        <User className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">You are browsing anonymously</CardTitle>
                    <CardDescription>
                        Create a free account to permanently save your watchlists, ratings, and recommendations.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button asChild size="lg">
                        <Link href="/register">Create Account</Link>
                    </Button>
                    <div className="mt-4 rounded-md border border-dashed p-2 text-sm font-mono text-muted-foreground">
                        {authStatus}
                    </div>
                </CardContent>
            </Card>
          </main>
        </div>
      );
  }

  // View for permanent users
  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardHeader>
             <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-3xl">
                        {getInitials(firebaseUser.email)}
                    </AvatarFallback>
                </Avatar>
                <div className="grid gap-1">
                    <CardTitle className="text-2xl">Profile</CardTitle>
                    <CardDescription>View your account information here.</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-3 rounded-md border p-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{firebaseUser.email}</span>
            </div>
            
            <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>

            <div className="mt-4 rounded-md border border-dashed p-2 text-sm font-mono text-muted-foreground">
                {authStatus}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
