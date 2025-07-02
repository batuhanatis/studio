
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  query,
  collection,
  where,
  getDocs,
  onSnapshot,
  writeBatch,
  addDoc,
  serverTimestamp,
  deleteDoc,
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
  friends?: string[];
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserEmail: string;
  toUserId: string;
  status: 'pending' | 'accepted';
}

const addFriendSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
});

type AddFriendFormValues = z.infer<typeof addFriendSchema>;

export function FriendManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState({ requests: true, friends: true, action: false });

  const form = useForm<AddFriendFormValues>({
    resolver: zodResolver(addFriendSchema),
    defaultValues: { email: '' },
  });

  // Listener for incoming friend requests
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FriendRequest));
      setIncomingRequests(requests);
      setLoading(p => ({ ...p, requests: false }));
    });
    return () => unsubscribe();
  }, [user]);
  
  // Listener for sent requests (to auto-add friend on acceptance)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'friendRequests'), where('fromUserId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FriendRequest));
      setSentRequests(requests);
    });
    return () => unsubscribe();
  }, [user]);

  // Process accepted requests
  useEffect(() => {
    if (!user) return;
    const accepted = sentRequests.find(r => r.status === 'accepted');
    if (accepted) {
      const userDocRef = doc(db, 'users', user.uid);
      updateDoc(userDocRef, { friends: arrayUnion(accepted.toUserId) })
        .then(() => deleteDoc(doc(db, 'friendRequests', accepted.id)))
        .catch(e => console.error("Error finalizing friendship:", e));
    }
  }, [sentRequests, user]);
  
  // Listener for user's profile to get friends list
  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      const userData = snapshot.data() as UserProfile | undefined;
      setLoading(p => ({ ...p, friends: true }));
      try {
        let finalFriends: UserProfile[] = [];
        if (userData?.friends && userData.friends.length > 0) {
          const friendProfiles = await Promise.all(
            userData.friends.map(async (uid) => {
              const userDoc = await getDoc(doc(db, 'users', uid));
              return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
            })
          );
          finalFriends = friendProfiles.filter(Boolean) as UserProfile[];
        }
        finalFriends.push({ uid: 'test-friend-for-blend', email: 'test.friend@example.com' });
        const uniqueFriends = Array.from(new Map(finalFriends.map(f => [f.uid, f])).values());
        setFriends(uniqueFriends);
      } catch (error) {
        console.error("Error fetching friends list:", error);
      } finally {
        setLoading(p => ({ ...p, friends: false }));
      }
    });
    return () => unsubscribe();
  }, [user]);


  const handleAddFriend = async (values: AddFriendFormValues) => {
    if (!user || !user.email || values.email === user.email) {
      toast({ variant: 'destructive', title: 'Error', description: "You can't add yourself as a friend." });
      return;
    }
    setLoading(prev => ({...prev, action: true}));

    try {
      const q = query(collection(db, 'users'), where('email', '==', values.email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) throw new Error('User not found.');
      const targetUser = querySnapshot.docs[0].data() as UserProfile;
      const targetUserId = targetUser.uid;

      if (friends.some(f => f.uid === targetUserId)) throw new Error("You are already friends with this user.");
      
      const existingReqQuery = query(collection(db, 'friendRequests'), where('fromUserId', '==', user.uid), where('toUserId', '==', targetUserId));
      const existingReqSnapshot = await getDocs(existingReqQuery);
      if (!existingReqSnapshot.empty) throw new Error("You've already sent a request to this user.");

      await addDoc(collection(db, 'friendRequests'), {
        fromUserId: user.uid,
        fromUserEmail: user.email,
        toUserId: targetUserId,
        toUserEmail: targetUser.email,
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      toast({ title: 'Success', description: 'Friend request sent!' });
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(prev => ({...prev, action: false}));
    }
  };

  const handleRequest = async (request: FriendRequest, accept: boolean) => {
    if (!user) return;
    setLoading(prev => ({...prev, action: true}));

    const requestDocRef = doc(db, 'friendRequests', request.id);

    try {
      if (accept) {
         const batch = writeBatch(db);
         // Add sender to current user's friend list
         const currentUserDocRef = doc(db, 'users', user.uid);
         batch.update(currentUserDocRef, { friends: arrayUnion(request.fromUserId) });
         // Update request status so sender's client can complete the friendship
         batch.update(requestDocRef, { status: 'accepted' });
         await batch.commit();
         toast({ title: 'Success', description: `Friend request accepted.` });
      } else {
        // Just delete the request
        await deleteDoc(requestDocRef);
        toast({ title: 'Success', description: 'Friend request declined.' });
      }
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
            ) : incomingRequests.length > 0 ? (
              <ul className="space-y-3">
                {incomingRequests.map((req) => (
                  <li key={req.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{getInitials(req.fromUserEmail)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{req.fromUserEmail}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => handleRequest(req, true)} disabled={loading.action}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-600 hover:bg-red-500/20" onClick={() => handleRequest(req, false)} disabled={loading.action}>
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

    