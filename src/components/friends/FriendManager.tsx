'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  query,
  collection,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Loader2, UserPlus, Check, X, Users, Mail, Combine } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';

interface UserProfile {
  uid: string;
  email: string;
}

const addFriendSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
});

export function FriendManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState({ requests: true, friends: true, action: false });

  const form = useForm<z.infer<typeof addFriendSchema>>({
    resolver: zodResolver(addFriendSchema),
    defaultValues: { email: '' },
  });

  useEffect(() => {
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      const userData = snapshot.data();

      if (!userData) {
        setRequests([]);
        setFriends([]);
        setLoading({ requests: false, friends: false, action: false });
        return;
      }

      // Fetch friend requests
      setLoading(prev => ({ ...prev, requests: true }));
      try {
        if (userData.friendRequestsReceived?.length > 0) {
          const requestUids: string[] = userData.friendRequestsReceived;
          const requestProfiles = await Promise.all(
            requestUids.map(async (uid) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
            })
          );
          setRequests(requestProfiles.filter(Boolean) as UserProfile[]);
        } else {
          setRequests([]);
        }
      } catch (error) {
        console.error("Error fetching friend requests:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load friend requests.' });
        setRequests([]);
      } finally {
        setLoading(prev => ({ ...prev, requests: false }));
      }

      // Fetch friends
      setLoading(prev => ({ ...prev, friends: true }));
      try {
        let finalFriends: UserProfile[] = [];
        if (userData.friends?.length > 0) {
          const friendUids: string[] = userData.friends;
          const friendProfiles = await Promise.all(
            friendUids.map(async (uid) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
            })
          );
          finalFriends = friendProfiles.filter(Boolean) as UserProfile[];
        }
        
        // Add a test user for demonstration
        finalFriends.push({ uid: 'test-friend-for-blend', email: 'test.friend@example.com' });

        // Ensure uniqueness
        const uniqueFriends = Array.from(new Map(finalFriends.map(f => [f.uid, f])).values());
        setFriends(uniqueFriends);

      } catch (error) {
        console.error("Error fetching friends list:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load friends list.' });
        setFriends([]);
      } finally {
        setLoading(prev => ({ ...prev, friends: false }));
      }
    });

    return () => unsubscribe();
  }, [user, toast]);

  const handleAddFriend = async (values: z.infer<typeof addFriendSchema>) => {
    if (!user || values.email === user.email) {
      toast({ variant: 'destructive', title: 'Error', description: "You can't add yourself as a friend." });
      return;
    }

    setLoading(prev => ({...prev, action: true}));
    try {
      const q = query(collection(db, 'users'), where('email', '==', values.email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error('User not found.');
      }

      const targetUser = querySnapshot.docs[0].data();
      const targetUserId = targetUser.uid;

      if (friends.some(f => f.uid === targetUserId)) {
          throw new Error("You are already friends with this user.");
      }

      const currentUserDocRef = doc(db, 'users', user.uid);
      const targetUserDocRef = doc(db, 'users', targetUserId);

      await updateDoc(currentUserDocRef, { friendRequestsSent: arrayUnion(targetUserId) });
      await updateDoc(targetUserDocRef, { friendRequestsReceived: arrayUnion(user.uid) });

      toast({ title: 'Success', description: 'Friend request sent!' });
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(prev => ({...prev, action: false}));
    }
  };

  const handleRequest = async (targetId: string, accept: boolean) => {
    if (!user) return;
    setLoading(prev => ({...prev, action: true}));

    try {
      const batch = writeBatch(db);
      const currentUserDocRef = doc(db, 'users', user.uid);
      const targetUserDocRef = doc(db, 'users', targetId);

      batch.update(currentUserDocRef, { friendRequestsReceived: arrayRemove(targetId) });
      batch.update(targetUserDocRef, { friendRequestsSent: arrayRemove(user.uid) });

      if (accept) {
        batch.update(currentUserDocRef, { friends: arrayUnion(targetId) });
        batch.update(targetUserDocRef, { friends: arrayUnion(user.uid) });
      }

      await batch.commit();
      toast({ title: 'Success', description: `Friend request ${accept ? 'accepted' : 'declined'}.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to process request.' });
    } finally {
      setLoading(prev => ({...prev, action: false}));
    }
  };
  
  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Add Friend</CardTitle>
          <CardDescription>Send a friend request by entering their email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddFriend)} className="flex items-center gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <Input placeholder="friend@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={loading.action}>
                {loading.action ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Send Request
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/> Friend Requests</CardTitle>
            <CardDescription>People who want to be your friend.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading.requests ? (
              <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : requests.length > 0 ? (
              <ul className="space-y-3">
                {requests.map((req) => (
                  <li key={req.uid} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(req.email)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{req.email}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => handleRequest(req.uid, true)} disabled={loading.action}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-600 hover:bg-red-500/20" onClick={() => handleRequest(req.uid, false)} disabled={loading.action}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-center text-sm text-muted-foreground">No pending friend requests.</p>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Your Friends</CardTitle>
            <CardDescription>Your current list of friends.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading.friends ? (
              <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : friends.length > 0 ? (
              <ul className="space-y-3">
                {friends.map((friend) => (
                  <li key={friend.uid} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                    <Avatar>
                       <AvatarFallback>{getInitials(friend.email)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{friend.email}</span>
                    <div className="ml-auto">
                        <Button asChild variant="outline" size="sm">
                            <Link href={`/blend/${friend.uid}`}>
                                <Combine className="mr-2 h-4 w-4" /> Blend
                            </Link>
                        </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12" />
                <p className="font-semibold text-base text-card-foreground">You haven't added any friends yet.</p>
                <p className="text-sm">Use the form above to send a friend request.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
