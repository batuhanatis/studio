
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { doc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, googleProvider, db, linkWithCredential, linkWithPopup, EmailAuthProvider } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Clapperboard, Loader2 } from 'lucide-react';

const formSchema = z.object({
  username: z.string().min(3, {
    message: 'Username must be at least 3 characters long.',
  }).max(20, {
    message: 'Username must be 20 characters or less.',
  }).regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Username can only contain letters, numbers, and underscores.',
  }),
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  password: z.string().min(6, {
    message: 'Password must be at least 6 characters long.',
  }),
});

const GoogleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12s5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.574l6.19,5.238C39.904,36.218,44,30.608,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
    </svg>
);

export function RegisterForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    if (!auth.currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'No active guest session found to upgrade.' });
      setIsLoading(false);
      return;
    }

    try {
      // 1. Check if username is unique
      const usernameQuery = query(collection(db, 'users'), where('username', '==', values.username));
      const usernameSnapshot = await getDocs(usernameQuery);
      if (!usernameSnapshot.empty) {
        toast({ variant: 'destructive', title: 'Username Taken', description: 'This username is already in use. Please choose another one.' });
        form.setError('username', { message: 'This username is already taken.' });
        return;
      }
      
      // 2. Link account
      const credential = EmailAuthProvider.credential(values.email, values.password);
      await linkWithCredential(auth.currentUser, credential);

      // 3. Update user profile with username
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, { 
          email: values.email, 
          username: values.username,
          isAnonymous: false 
      });
      
      toast({
        title: 'Account Created!',
        description: 'Your progress is now saved to your new account.',
      });
      router.push('/discover?new_user=true');
    } catch (error: any) {
      let title = 'Registration Failed';
      let description = 'An unexpected error occurred. Please try again.';

      if (error.code === 'auth/email-already-in-use') {
        description = 'This email is already in use by another account. Please try logging in instead.';
      } else if (error.code === 'auth/weak-password') {
        description = 'The password is too weak. It must be at least 6 characters long.';
      }
      
      toast({ variant: 'destructive', title, description });

    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsGoogleLoading(true);
    if (!auth.currentUser) {
      toast({ variant: 'destructive', title: 'Error', description: 'No active guest session found to upgrade.' });
      setIsGoogleLoading(false);
      return;
    }

    try {
        const result = await linkWithPopup(auth.currentUser, googleProvider);
        const user = result.user;
        const userDocRef = doc(db, 'users', user.uid);
        
        // Use email as a fallback username if display name is not available
        const username = user.displayName?.replace(/\s/g, '').toLowerCase() || user.email?.split('@')[0];
        
        // Since Google sign-in doesn't have a username step, we can't guarantee uniqueness beforehand.
        // We will just set it, but a more robust system might ask the user to confirm/change it on first login.
        await updateDoc(userDocRef, { 
            email: user.email, 
            username: username,
            displayName: user.displayName,
            photoURL: user.photoURL,
            isAnonymous: false,
        });
        toast({ title: 'Account Created!', description: 'Your progress is now saved to your Google account.' });
        router.push('/discover?new_user=true');
    } catch (error: any) {
        let description = 'An unexpected error occurred. Please try again.';
        if (error.code === 'auth/popup-closed-by-user') {
            setIsGoogleLoading(false);
            return;
        } else if (error.code === 'auth/credential-already-in-use') {
            description = 'This Google account is already linked to another user. Please log in with Google instead.';
        }
        
        toast({
            variant: 'destructive',
            title: 'Failed to Link Google Account',
            description,
        });
    } finally {
        setIsGoogleLoading(false);
    }
  }

  return (
    <Card className="shadow-2xl shadow-black/25 border-border/50">
      <CardHeader className="items-center text-center">
        <div className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
          <Clapperboard className="h-10 w-10" />
        </div>
        <CardTitle className="text-2xl font-headline">Save Your Progress</CardTitle>
        <CardDescription>Create a free account to save your watchlists and ratings permanently.</CardDescription>
      </CardHeader>
      <CardContent>
         <div className="space-y-4">
             <Button variant="outline" className="w-full" onClick={handleGoogleSignIn} disabled={isLoading || isGoogleLoading}>
                {isGoogleLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
            </Button>
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or with your email
                </span>
              </div>
            </div>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="your_username" {...field} disabled={isLoading || isGoogleLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="you@example.com" {...field} disabled={isLoading || isGoogleLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="••••••••" {...field} disabled={isLoading || isGoogleLoading} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Create Account'}
                </Button>
              </form>
            </Form>
         </div>
      </CardContent>
      <CardFooter className="flex justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
