'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRedirectResult } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SignInGooglePage() {
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const processRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User successfully signed in.
          // The AuthProvider, which wraps the entire app, will detect the new auth state
          // and handle creating the user profile document if it doesn't exist.
          toast({
            title: 'Welcome!',
            description: 'You have been successfully signed in.',
          });
          router.push('/search');
        } else {
          // This can happen if the page is loaded without a redirect in progress.
          // Redirect to login to be safe.
          router.push('/login');
        }
      } catch (error: any) {
        console.error('Google sign-in redirect error:', error);
        let description = 'An unexpected error occurred. Please try again from the login page.';
        
        if (error.code === 'auth/account-exists-with-different-credential') {
            description = 'An account already exists with the same email address but different sign-in credentials. Please sign in using the original method.';
        } else if (error.code === 'auth/unauthorized-domain') {
            description = "Bu alan adı google ile giriş için yetkilendirilmemiş. Lütfen Firebase projenizin Authentication -> Settings -> Authorized domains listesine bu alan adını ekleyin.";
        }
        
        toast({
          variant: 'destructive',
          title: 'Google Sign-In Failed',
          description: description,
        });
        router.push('/login');
      }
    };

    processRedirect();
  }, [router, toast]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Completing sign-in, please wait...</p>
      </div>
    </div>
  );
}
