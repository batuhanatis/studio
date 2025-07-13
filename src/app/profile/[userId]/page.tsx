
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, User, LogOut, Star, Users, Gift, Combine, ArrowLeft, Tv, Clapperboard, Check } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileWatched } from '@/components/profile/ProfileWatched';

interface UserProfileData {
    username?: string;
    email?: string;
    photoURL?: string;
    ratedMovies?: any[];
    watchedMovies?: any[];
    friends?: string[];
    activeBlendsWith?: string[];
}

export default function ProfilePage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const profileUserId = params.userId as string;
  
  const { toast } = useToast();
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = firebaseUser?.uid === profileUserId;

  useEffect(() => {
    if (!profileUserId) return;
    
    setProfileLoading(true);
    const userDocRef = doc(db, 'users', profileUserId);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
        if (doc.exists()) {
            setProfileData(doc.data() as UserProfileData);
            setError(null);
        } else {
            setError("Profile not found.");
            setProfileData(null);
        }
        setProfileLoading(false);
    }, (err) => {
        console.error("Error fetching profile:", err);
        setError("Could not load profile. You may not have permission to view it.");
        setProfileLoading(false);
    });

    return () => unsubscribe();

  }, [profileUserId]);

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
    if (!email) return '?';
    return email.substring(0, 2).toUpperCase();
  }
  
  if (loading || profileLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Profile...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
     return (
        <div className="min-h-screen w-full bg-background">
          <Header />
          <main className="container mx-auto max-w-2xl px-4 py-16 text-center">
            <h1 className="text-3xl font-bold font-headline text-destructive">{error}</h1>
             <Button asChild className="mt-6">
                <Link href="/search">Go Home</Link>
            </Button>
          </main>
        </div>
     );
  }

  if (firebaseUser?.isAnonymous && isOwnProfile) {
      return (
        <div className="min-h-screen w-full bg-background">
          <Header />
          <main className="container mx-auto max-w-2xl px-4 py-16">
            <Card className="text-center p-8">
                 <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                    <User className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold font-headline">You are browsing as a guest</CardTitle>
                <CardDescription className="mt-2 text-lg text-muted-foreground">
                    Create a free account to get a profile, save your watchlists, ratings, and recommendations permanently.
                </CardDescription>
                <Button asChild size="lg" className="mt-6">
                    <Link href="/register">Create Account</Link>
                </Button>
            </Card>
          </main>
        </div>
      );
  }

  const ratedMovieCount = profileData?.ratedMovies?.filter(m => m.mediaType === 'movie').length || 0;
  const ratedTvCount = profileData?.ratedMovies?.filter(m => m.mediaType === 'tv').length || 0;
  const watchedCount = profileData?.watchedMovies?.length || 0;

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-5xl px-4 py-8">
        {!isOwnProfile && (
             <div className="mb-4">
                <Button asChild variant="outline" size="sm" onClick={() => router.back()}>
                    <span><ArrowLeft className="mr-2 h-4 w-4" /> Back</span>
                </Button>
             </div>
        )}
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 md:gap-12">
            <div className="flex-shrink-0 flex flex-col items-center w-full md:w-64">
                <Avatar className="h-32 w-32 text-5xl border-4 border-primary/20">
                    {profileData?.photoURL && <AvatarImage src={profileData.photoURL} alt={profileData.username || profileData.email} />}
                    <AvatarFallback>{getInitials(profileData?.email)}</AvatarFallback>
                </Avatar>
                <h1 className="mt-4 text-3xl font-bold font-headline">{profileData?.username || profileData?.email}</h1>
                <p className="text-muted-foreground">{profileData?.email}</p>
                 
                <Card className="w-full mt-6 text-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Clapperboard /> Movies Rated</span> <Badge variant="secondary">{ratedMovieCount}</Badge></div>
                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Tv /> TV Shows Rated</span> <Badge variant="secondary">{ratedTvCount}</Badge></div>
                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Check /> Items Watched</span> <Badge variant="secondary">{watchedCount}</Badge></div>
                    <div className="flex justify-between items-center"><span className="flex items-center gap-2 text-muted-foreground"><Users /> Friends</span> <Badge variant="secondary">{profileData?.friends?.length || 0}</Badge></div>
                  </CardContent>
                </Card>

                {isOwnProfile && (
                    <Button variant="outline" onClick={handleLogout} className="mt-6 w-full">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                )}
            </div>
            <div className="flex-grow w-full">
                <Tabs defaultValue="ratings" className="w-full">
                    <TabsList className={`grid w-full ${isOwnProfile ? 'grid-cols-3 md:grid-cols-5' : 'grid-cols-3'}`}>
                        <TabsTrigger value="ratings"><Star className="mr-2 h-4 w-4" />Ratings</TabsTrigger>
                        <TabsTrigger value="watched"><Check className="mr-2 h-4 w-4" />Watched</TabsTrigger>
                        <TabsTrigger value="friends"><Users className="mr-2 h-4 w-4" />Friends</TabsTrigger>
                        {isOwnProfile && <TabsTrigger value="recommendations"><Gift className="mr-2 h-4 w-4" />For You</TabsTrigger>}
                        {isOwnProfile && <TabsTrigger value="blends"><Combine className="mr-2 h-4 w-4" />Blends</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="ratings" className="mt-6">
                       <ProfileRatings userId={profileUserId} />
                    </TabsContent>
                    <TabsContent value="watched" className="mt-6">
                       <ProfileWatched userId={profileUserId} />
                    </TabsContent>
                    <TabsContent value="friends" className="mt-6">
                        <ProfileFriends userId={profileUserId} />
                    </TabsContent>
                     {isOwnProfile && (
                        <>
                            <TabsContent value="recommendations" className="mt-6">
                                <ProfileRecommendations />
                            </TabsContent>
                            <TabsContent value="blends" className="mt-6">
                                <ProfileBlends />
                            </TabsContent>
                        </>
                     )}
                </Tabs>
            </div>
        </div>
      </main>
    </div>
  );
}
