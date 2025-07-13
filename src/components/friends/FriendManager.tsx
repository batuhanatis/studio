
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
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Loader2, UserPlus, Check, X, Users, Mail, Combine } from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Separator } from '../ui/separator';

interface UserProfile {
  uid: string;
  email: string;
  friends?: string[];
  activeBlendsWith?: string[];
}

interface FriendRequest {
  id: string;
  fromUserId: string;
  fromUserEmail: string;
  toUserId: string;
  status: 'pending' | 'accepted';
}

interface BlendRequest {
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

interface FriendManagerProps {
    userId: string;
}

export function FriendManager({ userId }: FriendManagerProps) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const isOwnProfile = firebaseUser?.uid === userId;

  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [incomingBlendRequests, setIncomingBlendRequests] = useState<BlendRequest[]>([]);
  const [sentBlendRequests, setSentBlendRequests] = useState<BlendRequest[]>([]);
  
  const [loading, setLoading] = useState({ requests: true, friends: true, action: false, blendRequests: true });

  const form = useForm<AddFriendFormValues>({
    resolver: zodResolver(addFriendSchema),
    defaultValues: { email: '' },
  });
  
  const getInitials = (email: string) => email.substring(0, 2).toUpperCase();

  // Listener for incoming friend requests (only for own profile)
  useEffect(() => {
    if (!isOwnProfile || !firebaseUser) {
        setLoading(p => ({ ...p, requests: false }));
        return;
    };
    const q = query(collection(db, 'friendRequests'), where('toUserId', '==', firebaseUser.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as FriendRequest));
      setIncomingRequests(requests);
      setLoading(p => ({ ...p, requests: false }));
    });
    return () => unsubscribe();
  }, [firebaseUser, isOwnProfile]);
  
  // Listener for user's profile data (friends, active blends, etc.) for the viewed profile
  useEffect(() => {
    if (!userId) return;
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      setLoading(p => ({ ...p, friends: true }));
      try {
        const userData = snapshot.data() as UserProfile | undefined;
        setProfileData(userData || null);

        let finalFriends: UserProfile[] = [];
        if (userData?.friends && userData.friends.length > 0) {
          const friendDocs = await getDocs(query(collection(db, 'users'), where('uid', 'in', userData.friends)));
          finalFriends = friendDocs.docs.map(d => d.data() as UserProfile);
        }
        setFriends(finalFriends);
      } catch (error) {
        console.error("Error fetching friends list:", error);
      } finally {
        setLoading(p => ({ ...p, friends: false }));
      }
    });
    return () => unsubscribe();
  }, [userId]);

  // Listener for blend requests (sent and received) (only for own profile)
  useEffect(() => {
    if (!isOwnProfile || !firebaseUser) {
        setLoading(p => ({ ...p, blendRequests: false }));
        return;
    }
    setLoading(p => ({ ...p, blendRequests: true }));
    
    const incomingQuery = query(collection(db, 'blendRequests'), where('toUserId', '==', firebaseUser.uid), where('status', '==', 'pending'));
    const sentQuery = query(collection(db, 'blendRequests'), where('fromUserId', '==', firebaseUser.uid));

    const unsubIncoming = onSnapshot(incomingQuery, (snap) => {
        setIncomingBlendRequests(snap.docs.map(d => ({...d.data(), id: d.id } as BlendRequest)));
        setLoading(p => ({ ...p, blendRequests: false }));
    });
    
    const unsubSent = onSnapshot(sentQuery, (snap) => {
        setSentBlendRequests(snap.docs.map(d => ({...d.data(), id: d.id } as BlendRequest)));
    });

    return () => {
        unsubIncoming();
        unsubSent();
    };
  }, [firebaseUser, isOwnProfile]);

  const handleAddFriend = async (values: AddFriendFormValues) => {
    if (!firebaseUser || !firebaseUser.email || values.email === firebaseUser.email) {
        toast({ variant: 'destructive', title: 'Error', description: "You can't add yourself as a friend." });
        return;
    }
    setLoading(prev => ({...prev, action: true}));

    try {
      const q = query(collection(db, 'users'), where('email', '==', values.email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) throw new Error('User not found.');
      const targetUser = querySnapshot.docs[0].data() as UserProfile;
      if (friends.some(f => f.uid === targetUser.uid)) throw new Error("You are already friends.");
      if (incomingRequests.some(r => r.fromUserId === targetUser.uid)) throw new Error("This user has already sent you a request. Check your incoming requests.");
      
      const existingReqQuery = query(collection(db, 'friendRequests'), where('fromUserId', '==', firebaseUser.uid), where('toUserId', '==', targetUser.uid));
      if (!(await getDocs(existingReqQuery)).empty) throw new Error("You've already sent a request to this user.");

      await addDoc(collection(db, 'friendRequests'), {
        fromUserId: firebaseUser.uid, fromUserEmail: firebaseUser.email, username: firebaseUser.displayName || firebaseUser.email,
        toUserId: targetUser.uid, toUserEmail: targetUser.email,
        status: 'pending', createdAt: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'Friend request sent!' });
      form.reset();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(prev => ({...prev, action: false}));
    }
  };

  const handleFriendRequest = async (request: FriendRequest, accept: boolean) => {
    if (!firebaseUser) return;
    setLoading(prev => ({...prev, action: true}));
    const requestDocRef = doc(db, 'friendRequests', request.id);
    try {
      if (accept) {
         const batch = writeBatch(db);
         batch.update(doc(db, 'users', firebaseUser.uid), { friends: arrayUnion(request.fromUserId) });
         batch.update(doc(db, 'users', request.fromUserId), { friends: arrayUnion(firebaseUser.uid) });
         batch.delete(requestDocRef);
         await batch.commit();
         toast({ title: 'Success', description: `Friend request accepted.` });
      } else {
        await deleteDoc(requestDocRef);
        toast({ title: 'Success', description: 'Friend request declined.' });
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to process request.' });
    } finally {
      setLoading(prev => ({...prev, action: false}));
    }
  };

  const handleSendBlendInvite = async (friend: UserProfile) => {
    if (!firebaseUser || !firebaseUser.email) return;
    setLoading(prev => ({ ...prev, action: true }));
    try {
        await addDoc(collection(db, 'blendRequests'), {
            fromUserId: firebaseUser.uid,
            fromUserEmail: firebaseUser.email,
            toUserId: friend.uid,
            toUserEmail: friend.email,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Sent!', description: `Blend invite sent to ${friend.email}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not send invite.' });
    } finally {
        setLoading(prev => ({ ...prev, action: false }));
    }
  };
  
  const handleBlendRequest = async (request: BlendRequest, accept: boolean) => {
    if (!firebaseUser) return;
    setLoading(prev => ({ ...prev, action: true }));
    const requestDocRef = doc(db, 'blendRequests', request.id);
    try {
      if (accept) {
        const batch = writeBatch(db);
  
        const currentUserDocRef = doc(db, 'users', firebaseUser.uid);
        const friendDocRef = doc(db, 'users', request.fromUserId);
  
        batch.update(currentUserDocRef, { activeBlendsWith: arrayUnion(request.fromUserId) });
        batch.update(friendDocRef, { activeBlendsWith: arrayUnion(firebaseUser.uid) });
        
        batch.delete(requestDocRef);
        
        await batch.commit();
  
        toast({ title: 'Blend Accepted!', description: `You can now view your Blend with ${request.fromUserEmail}.` });
        router.push(`/blend/${request.fromUserId}`);
      } else {
        await deleteDoc(requestDocRef);
        toast({ title: 'Declined', description: `You declined the Blend invite.` });
      }
    } catch (error: any) {
        console.error("Error processing blend invite", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to process Blend invite. Check your Firestore rules.' });
    } finally {
        setLoading(prev => ({ ...prev, action: false }));
    }
  };
  
  const hasActiveBlendWith = (friendId: string) => profileData?.activeBlendsWith?.includes(friendId);
  const hasPendingBlendInviteTo = (friendId: string) => sentBlendRequests.some(r => r.toUserId === friendId && r.status === 'pending');

  if (!isOwnProfile) {
     return (
        <div>
             {loading.friends || authLoading ? (
              <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : friends.length > 0 ? (
              <ul className="space-y-3">
                {friends.map((friend) => (
                  <li key={friend.uid} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                    <Link href={`/profile/${friend.uid}`} className="flex items-center gap-3 hover:underline">
                        <Avatar><AvatarFallback>{getInitials(friend.email)}</AvatarFallback></Avatar>
                        <span className="font-medium">{friend.email}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12" /><p className="font-semibold text-base text-card-foreground">No friends yet.</p>
              </div>
            )}
        </div>
     )
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Add Friend</CardTitle>
          <CardDescription>Send a friend request by entering their email.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddFriend)} className="flex items-start gap-4">
              <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem className="flex-grow"><FormControl><Input placeholder="friend@example.com" {...field} /></FormControl><FormMessage /></FormItem>
              )}/>
              <Button type="submit" disabled={loading.action || authLoading}>
                {loading.action ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />} Send
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/> Incoming Requests</CardTitle>
            <CardDescription>Requests from others to be your friend or start a Blend.</CardDescription>
          </CardHeader>
          <CardContent>
             {(loading.requests || loading.blendRequests || authLoading) ? (
                <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
             ) : (
                <>
                  {incomingRequests.length === 0 && incomingBlendRequests.length === 0 && (
                     <p className="text-center text-sm text-muted-foreground py-4">No pending requests.</p>
                  )}
                  <ul className="space-y-3">
                    {incomingRequests.map((req) => (
                      <li key={req.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                         <div className="flex items-center gap-3"><Avatar><AvatarFallback>{getInitials(req.fromUserEmail)}</AvatarFallback></Avatar><span className="font-medium">{req.fromUserEmail}</span><span className="text-xs text-muted-foreground">(Friend Request)</span></div>
                         <div className="flex gap-2"><Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => handleFriendRequest(req, true)} disabled={loading.action}><Check className="h-4 w-4" /></Button><Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-600 hover:bg-red-500/20" onClick={() => handleFriendRequest(req, false)} disabled={loading.action}><X className="h-4 w-4" /></Button></div>
                      </li>
                    ))}
                    {incomingBlendRequests.map((req) => (
                      <li key={req.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                         <div className="flex items-center gap-3"><Avatar><AvatarFallback>{getInitials(req.fromUserEmail)}</AvatarFallback></Avatar><span className="font-medium">{req.fromUserEmail}</span><span className="text-xs text-primary">(Blend Invite)</span></div>
                         <div className="flex gap-2"><Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => handleBlendRequest(req, true)} disabled={loading.action}><Check className="h-4 w-4" /></Button><Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-600 hover:bg-red-500/20" onClick={() => handleBlendRequest(req, false)} disabled={loading.action}><X className="h-4 w-4" /></Button></div>
                      </li>
                    ))}
                  </ul>
                </>
             )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Your Friends</CardTitle>
            <CardDescription>Create a Blend to get shared recommendations.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading.friends || authLoading ? (
              <div className="flex justify-center"><Loader2 className="animate-spin text-primary" /></div>
            ) : friends.length > 0 ? (
              <ul className="space-y-3">
                {friends.map((friend) => (
                  <li key={friend.uid} className="flex items-center gap-3 rounded-lg bg-secondary p-3">
                    <Link href={`/profile/${friend.uid}`} className="flex items-center gap-3 hover:underline">
                        <Avatar><AvatarFallback>{getInitials(friend.email)}</AvatarFallback></Avatar>
                        <span className="font-medium">{friend.email}</span>
                    </Link>
                    <div className="ml-auto">
                        {profileData?.activeBlendsWith?.includes(friend.uid) ? (
                             <Button asChild size="sm">
                                <Link href={`/blend/${friend.uid}`}><Combine className="mr-2 h-4 w-4" /> View Blend</Link>
                             </Button>
                        ) : hasPendingBlendInviteTo(friend.uid) ? (
                            <Button variant="outline" size="sm" disabled>Invite Sent</Button>
                        ) : (
                            <Button variant="outline" size="sm" onClick={() => handleSendBlendInvite(friend)} disabled={loading.action}>
                                {loading.action ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Combine className="mr-2 h-4 w-4" /> Invite to Blend</>}
                            </Button>
                        )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center text-muted-foreground">
                <Users className="h-12 w-12" /><p className="font-semibold text-base text-card-foreground">No friends yet.</p><p className="text-sm">Use the form above to add friends.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
