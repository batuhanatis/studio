'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { MailCheck, LogOut, Loader2 } from 'lucide-react';

export default function VerifyEmailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  // This effect checks if the email has been verified and redirects if so.
  useEffect(() => {
    if (loading) return;

    if (!user) {
      // If for some reason user is not logged in, send to login page.
      router.replace('/login');
      return;
    }
    
    // The user is logged in, now check for verification.
    if (user.emailVerified) {
      router.replace('/search');
      return;
    }
    
    // Set up an interval to automatically check for verification.
    const interval = setInterval(async () => {
      // Need to reload the user from the auth object to get the latest state.
      if (auth.currentUser) {
        await auth.currentUser.reload();
        if (auth.currentUser.emailVerified) {
          clearInterval(interval);
          router.replace('/search');
        }
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [user, loading, router]);


  const handleResendVerification = async () => {
    if (!user) return;
    setIsSending(true);
    try {
      await sendEmailVerification(user);
      toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox (and spam folder).',
      });
    } catch (error: any) {
      console.error("Error resending verification email:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not send verification email. Please try again later.',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/login');
  };

  // While loading or if user is not available yet, show a loading screen.
  if (loading || !user || user.emailVerified) {
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
    <main className="flex min-h-screen w-full items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
             <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Verify Your Email</CardTitle>
          <CardDescription>
            A verification link has been sent to{' '}
            <span className="font-semibold text-foreground">{user.email}</span>. Please
            check your inbox to complete your registration.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center text-sm text-muted-foreground">
          <p>
            Once you've verified, this page will update automatically. If you don't see the email, check your spam folder.
          </p>
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button onClick={handleResendVerification} disabled={isSending} className="w-full">
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Resend Verification Email
          </Button>
          <Button variant="outline" onClick={handleLogout} className="w-full">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </CardFooter>
      </Card>
    </main>
  );
}
