
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db, storage, ref, uploadBytes, getDownloadURL } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import Image from 'next/image';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, UploadCloud } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const formSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters long.' }).max(20).regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores.'),
  displayName: z.string().min(1, { message: 'Display name is required.' }).max(50),
  bio: z.string().max(160, { message: 'Bio must be 160 characters or less.' }).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditProfileForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { firebaseUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: '',
      displayName: '',
      bio: '',
    },
  });
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    const names = name.split(' ');
    if (names.length > 1) {
      return (names[0][0] + names[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  useEffect(() => {
    if (firebaseUser) {
      setIsFetching(true);
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      getDoc(userDocRef)
        .then((docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            form.reset({
              username: data.username || '',
              displayName: data.displayName || data.username || '',
              bio: data.bio || '',
            });
            setCurrentPhotoURL(data.photoURL || null);
          }
        })
        .finally(() => setIsFetching(false));
    }
  }, [firebaseUser, form]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0 || !firebaseUser) {
      return;
    }
    const file = event.target.files[0];
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({ variant: 'destructive', title: 'File too large', description: 'Please select an image smaller than 5MB.' });
      return;
    }
    if (!file.type.startsWith('image/')) {
        toast({ variant: 'destructive', title: 'Invalid file type', description: 'Please select an image file.' });
        return;
    }

    setIsUploading(true);
    const storageRef = ref(storage, `profile-pictures/${firebaseUser.uid}`);
    
    try {
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userDocRef, { photoURL: downloadURL });
      
      setCurrentPhotoURL(downloadURL);
      toast({ title: 'Success', description: 'Profile picture updated!' });
    } catch (error: any) {
      console.error(error);
      let description = 'Could not upload image. Please try again.';
      if (error.code === 'storage/unauthorized') {
        description = 'You do not have permission to upload. Please check storage rules in your Firebase project.'
      }
      toast({ variant: 'destructive', title: 'Upload Failed', description });
    } finally {
      setIsUploading(false);
    }
  };

  async function onSubmit(values: FormValues) {
    if (!firebaseUser) return;
    setIsLoading(true);

    try {
      // Check if username is unique (if it has been changed)
      const currentUsername = form.formState.defaultValues?.username;
      if (values.username !== currentUsername) {
        const usernameQuery = query(collection(db, 'users'), where('username', '==', values.username));
        const usernameSnapshot = await getDocs(usernameQuery);
        if (!usernameSnapshot.empty) {
          form.setError('username', { message: 'This username is already taken.' });
          setIsLoading(false);
          return;
        }
      }
      
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      await updateDoc(userDocRef, {
        username: values.username,
        displayName: values.displayName,
        bio: values.bio,
      });

      toast({
        title: 'Profile Updated!',
        description: 'Your changes have been saved successfully.',
      });
      router.push(`/profile/${firebaseUser.uid}`);

    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'An unexpected error occurred. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (isFetching) {
    return (
        <div className="flex justify-center items-center h-64">
             <Loader2 className="mr-2 h-8 w-8 animate-spin" />
        </div>
    )
  }

  return (
    <Card className="shadow-lg border-border/50">
      <CardHeader>
        <CardTitle className="text-2xl font-headline flex items-center gap-2"><User /> Edit Your Profile</CardTitle>
        <CardDescription>Update your public profile information and picture.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <Avatar className="h-24 w-24 text-3xl border-4 border-primary/20">
                {currentPhotoURL && <AvatarImage src={currentPhotoURL} alt={form.getValues('displayName')} />}
                <AvatarFallback>{getInitials(form.getValues('displayName'))}</AvatarFallback>
              </Avatar>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
                {isUploading ? 'Uploading...' : 'Change Picture'}
              </Button>
            </div>
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="your_unique_username" {...field} disabled={isLoading || isUploading} />
                  </FormControl>
                  <FormDescription>This is your unique @handle. It can only contain letters, numbers, and underscores.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="displayName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Your Name" {...field} disabled={isLoading || isUploading} />
                  </FormControl>
                  <FormDescription>This name will be visible to other users on your profile.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bio</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Tell us a little about yourself" {...field} disabled={isLoading || isUploading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
                <Button type="submit" disabled={isLoading || isUploading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
