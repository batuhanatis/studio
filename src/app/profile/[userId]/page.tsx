'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Loader2, User, LogOut, Users, Combine, ArrowLeft, Settings, Heart, ThumbsDown } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { doc, onSnapshot } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProfileLikes } from '@/components/profile/ProfileLikes';
import { ProfileFriends } from '@/components/profile/ProfileFriends';
import { ProfileBlends } from '@/components/profile/ProfileBlends';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ProfileDislikes } from '@/components/profile/ProfileDislikes';

interface UserProfileData {
    username?: string;
    email?: string;
    photoURL?: string;
    bio?: string;
    displayName?: string;
    likedMovies?: any[];
    dislikedMovies?: any[];
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
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
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
            <h1 className="text-3xl font-bold text-destructive font-headline">{error}</h1>
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
            <Card className="p-8 text-center">
                 <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold font-headline">You are browsing as a guest</h2>
                <p className="mt-2 text-lg text-muted-foreground">
                    Create a free account to get a profile, save your watchlists, likes, and recommendations permanently.
                </p>
                <Button asChild size="lg" className="mt-6">
                    <Link href="/register">Create Account</Link>
                </Button>
            </Card>
          </main>
        </div>
      );
  }

  const likedCount = profileData?.likedMovies?.length || 0;
  const dislikedCount = profileData?.dislikedMovies?.length || 0;
  const displayName = profileData?.displayName || profileData?.username;

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
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:gap-12">
            <div className="flex w-full flex-shrink-0 flex-col items-center md:w-64">
                <Avatar className="h-24 w-24 border-4 border-primary/20 text-4xl md:h-32 md:w-32 md:text-5xl">
                    {profileData?.photoURL && <AvatarImage src={profileData.photoURL} alt={displayName} />}
                    <AvatarFallback>{getInitials(displayName)}</AvatarFallback>
                </Avatar>
                <h1 className="mt-4 text-center text-2xl font-bold font-headline md:text-3xl">{displayName}</h1>
                <p className="text-center text-muted-foreground">@{profileData?.username}</p>
                {profileData?.bio && <p className="mt-2 text-center text-sm text-foreground/80">{profileData.bio}</p>}
                 
                <Card className="mt-6 w-full text-sm">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Heart /> Liked</span> <Badge variant="secondary">{likedCount}</Badge></div>
                    <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><ThumbsDown /> Disliked</span> <Badge variant="secondary">{dislikedCount}</Badge></div>
                    <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-muted-foreground"><Users /> Friends</span> <Badge variant="secondary">{profileData?.friends?.length || 0}</Badge></div>
                  </CardContent>
                </Card>

                {isOwnProfile && (
                    <>
                        <Button variant="outline" asChild className="mt-6 w-full">
                           <Link href="/profile/edit"><Settings className="mr-2 h-4 w-4"/> Edit Profile</Link>
                        </Button>
                        <Button variant="outline" onClick={handleLogout} className="mt-2 w-full">
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </Button>
                    </>
                )}
            </div>
            <div className="w-full flex-grow">
                <Tabs defaultValue="likes" className="w-full">
                    <TabsList className={`grid w-full ${isOwnProfile ? 'grid-cols-4' : 'grid-cols-4'}`}>
                        <TabsTrigger value="likes"><Heart className="mr-2 h-4 w-4" />Likes</TabsTrigger>
                        <TabsTrigger value="dislikes"><ThumbsDown className="mr-2 h-4 w-4" />Dislikes</TabsTrigger>
                        <TabsTrigger value="friends"><Users className="mr-2 h-4 w-4" />Friends</TabsTrigger>
                        {isOwnProfile && <TabsTrigger value="blends"><Combine className="mr-2 h-4 w-4" />Blends</TabsTrigger>}
                    </TabsList>
                    <TabsContent value="likes" className="mt-6">
                       <ProfileLikes userId={profileUserId} />
                    </TabsContent>
                    <TabsContent value="dislikes" className="mt-6">
                       <ProfileDislikes userId={profileUserId} />
                    </TabsContent>
                    <TabsContent value="friends" className="mt-6">
                        <ProfileFriends userId={profileUserId} />
                    </TabsContent>
                     {isOwnProfile && (
                        <>
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
