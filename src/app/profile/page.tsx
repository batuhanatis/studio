
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, User, LogOut, Star, Users, Gift, Combine } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { doc, onSnapshot } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileRatings } from '@/components/profile/ProfileRatings';
import { ProfileFriends } from '@/components/profile/ProfileFriends';
import { ProfileRecommendations } from '@/components/profile/ProfileRecommendations';
import { ProfileBlends } from '@/components/profile/ProfileBlends';

interface UserProfileData {
    username?: string;
    ratedMovies?: any[];
    friends?: string[];
    activeBlendsWith?: string[];
}

export default function ProfilePage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<UserProfileData>({});

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.push('/login');
      return;
    }
    
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            setProfileData(doc.data());
        }
    });

    return () => unsubscribe();

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
          <main className="container mx-auto max-w-2xl px-4 py-16">
            <div className="text-center">
                 <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <User className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold font-headline">You are browsing as a guest</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    Create a free account to get a profile, save your watchlists, ratings, and recommendations permanently.
                </p>
                <Button asChild size="lg" className="mt-6">
                    <Link href="/register">Create Account</Link>
                </Button>
            </div>
          </main>
        </div>
      );
  }

  // View for permanent users
  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col md:flex-row items-start gap-8">
            <div className="flex-shrink-0 flex flex-col items-center md:items-start text-center md:text-left">
                <Avatar className="h-28 w-28 text-5xl">
                    <AvatarFallback>{getInitials(firebaseUser.email)}</AvatarFallback>
                </Avatar>
                <h1 className="mt-4 text-2xl font-bold font-headline">{profileData.username || firebaseUser.email}</h1>
                <p className="text-muted-foreground">{firebaseUser.email}</p>
                 <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
                    <div><span className="font-bold text-foreground">{profileData.ratedMovies?.length || 0}</span> Ratings</div>
                    <div><span className="font-bold text-foreground">{profileData.friends?.length || 0}</span> Friends</div>
                 </div>
                <Button variant="outline" onClick={handleLogout} className="mt-6 w-full">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
            </div>
            <div className="flex-grow w-full">
                <Tabs defaultValue="ratings" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                        <TabsTrigger value="ratings"><Star className="mr-2 h-4 w-4" />Ratings</TabsTrigger>
                        <TabsTrigger value="friends"><Users className="mr-2 h-4 w-4" />Friends</TabsTrigger>
                        <TabsTrigger value="recommendations"><Gift className="mr-2 h-4 w-4" />Recommendations</TabsTrigger>
                        <TabsTrigger value="blends"><Combine className="mr-2 h-4 w-4" />Blends</TabsTrigger>
                    </TabsList>
                    <TabsContent value="ratings" className="mt-6">
                       <ProfileRatings userId={firebaseUser.uid} />
                    </TabsContent>
                    <TabsContent value="friends" className="mt-6">
                        <ProfileFriends />
                    </TabsContent>
                    <TabsContent value="recommendations" className="mt-6">
                        <ProfileRecommendations />
                    </TabsContent>
                    <TabsContent value="blends" className="mt-6">
                        <ProfileBlends />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
      </main>
    </div>
  );
}
