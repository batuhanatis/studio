
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
  limit,
  orderBy,
  startAt,
  endAt,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { debounce } from 'lodash';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus, Check, X, Users, Mail, Combine, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Separator } from '../ui/separator';

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  photoURL?: string;
  friends?: string[];
  activeBlendsWith?: string[];
}

interface RequestWithSenderProfile {
    id: string;
    fromUserId: string;
    fromUsername: string;
    fromPhotoURL?: string;
    type: 'friend' | 'blend';
    originalRequest: FriendRequest | BlendRequest;
}


interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted';
}

interface BlendRequest {
    id: string;
    fromUserId: string;
    toUserId: string;
    status: 'pending' | 'accepted';
}

interface FriendManagerProps {
    userId: string;
}

export function FriendManager({ userId }: FriendManagerProps) {
  const { firebaseUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const isOwnProfile = firebaseUser?.uid === userId;

  const [profileData, setProfileData] = useState<UserProfile | null>(null);
  const [incomingRequests, setIncomingRequests] = useState<RequestWithSenderProfile[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [sentFriendRequests, setSentFriendRequests] = useState<string[]>([]);
  const [sentBlendRequests, setSentBlendRequests] = useState<BlendRequest[]>([]);
  
  const [loading, setLoading] = useState({ requests: true, friends: true, action: false, blendRequests: true });

  // States for the new friend search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  }

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setIsSearching(false);
        return;
      }
      setIsSearching(true);
      try {
        const usersRef = collection(db, 'users');
        // The `\uf8ff` is a trick to create a range for "starts with" queries in Firestore
        const q = query(
          usersRef,
          orderBy('username'),
          startAt(searchQuery.toLowerCase()),
          endAt(searchQuery.toLowerCase() + '\uf8ff'),
          limit(10)
        );
        const querySnapshot = await getDocs(q);
        const users = querySnapshot.docs
          .map(doc => doc.data() as UserProfile)
          .filter(user => user.uid !== firebaseUser?.uid); // Exclude self
        setSearchResults(users);
      } catch (error) {
        console.error("Error searching users:", error);
        toast({ variant: 'destructive', title: 'Search Error', description: 'Could not perform user search.' });
      } finally {
        setIsSearching(false);
      }
    }, 500),
    [firebaseUser, toast]
  );

  useEffect(() => {
    debouncedSearch(searchQuery);
    // Cleanup debounce on unmount
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);

  // Listener for incoming friend and blend requests (only for own profile)
  useEffect(() => {
    if (!isOwnProfile || !firebaseUser) {
      setLoading(p => ({ ...p, requests: false, blendRequests: false }));
      return;
    }

    const processRequests = async (snapshot: any, type: 'friend' | 'blend') => {
        const fetchedRequests: RequestWithSenderProfile[] = await Promise.all(
            snapshot.docs.map(async (d: any) => {
                const requestData = { ...d.data(), id: d.id };
                const fromUserDoc = await getDoc(doc(db, 'users', requestData.fromUserId));
                const fromUserData = fromUserDoc.exists() ? fromUserDoc.data() : { username: 'A friend', photoURL: '' };

                return {
                    id: d.id,
                    fromUserId: requestData.fromUserId,
                    fromUsername: fromUserData.username,
                    fromPhotoURL: fromUserData.photoURL,
                    type: type,
                    originalRequest: requestData,
                };
            })
        );
        return fetchedRequests;
    };

    const friendQuery = query(collection(db, 'friendRequests'), where('toUserId', '==', firebaseUser.uid), where('status', '==', 'pending'));
    const blendQuery = query(collection(db, 'blendRequests'), where('toUserId', '==', firebaseUser.uid), where('status', '==', 'pending'));
    const sentFriendQuery = query(collection(db, 'friendRequests'), where('fromUserId', '==', firebaseUser.uid), where('status', '==', 'pending'));


    const unsubFriends = onSnapshot(friendQuery, async (snapshot) => {
        const friendReqs = await processRequests(snapshot, 'friend');
        setIncomingRequests(prev => [...prev.filter(p => p.type !== 'friend'), ...friendReqs]);
        setLoading(p => ({ ...p, requests: false }));
    });
    
    const unsubBlends = onSnapshot(blendQuery, async (snapshot) => {
        const blendReqs = await processRequests(snapshot, 'blend');
        setIncomingRequests(prev => [...prev.filter(p => p.type !== 'blend'), ...blendReqs]);
        setLoading(p => ({ ...p, blendRequests: false }));
    });
    
    // Listener for user's sent friend requests to disable buttons
    const unsubSentFriends = onSnapshot(sentFriendQuery, (snap) => {
        setSentFriendRequests(snap.docs.map(d => d.data().toUserId));
    });

    // Listener for user's sent blend requests to disable buttons
    const unsubSentBlends = onSnapshot(query(collection(db, 'blendRequests'), where('fromUserId', '==', firebaseUser.uid)), (snap) => {
        setSentBlendRequests(snap.docs.map(d => ({...d.data(), id: d.id } as BlendRequest)));
    });


    return () => {
        unsubFriends();
        unsubBlends();
        unsubSentFriends();
        unsubSentBlends();
    };
  }, [firebaseUser, isOwnProfile]);

  // Listener for user's profile data (friends, active blends, etc.) for the viewed profile
  useEffect(() => {
    if (!userId) return;
    const userDocRef = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDocRef, async (snapshot) => {
      setLoading(p => ({ ...p, friends: true }));
      try {
        if (snapshot.exists()) {
            const userData = snapshot.data() as UserProfile;
            setProfileData(userData);

            let finalFriends: UserProfile[] = [];
            if (userData?.friends && userData.friends.length > 0) {
              const friendDocs = await Promise.all(
                userData.friends.map(friendId => getDoc(doc(db, 'users', friendId)))
              );
              finalFriends = friendDocs
                .filter(doc => doc.exists())
                .map(d => d.data() as UserProfile);
            }
            setFriends(finalFriends);
        } else {
            setProfileData(null);
            setFriends([]);
        }
      } catch (error) {
        console.error("Error fetching friends list:", error);
      } finally {
        setLoading(p => ({ ...p, friends: false }));
      }
    });
    return () => unsubscribe();
  }, [userId]);
  

  const handleAddFriend = async (targetUser: UserProfile) => {
    if (!firebaseUser) return;
    setLoading(prev => ({...prev, action: true}));

    try {
      const currentUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
      const currentUsername = currentUserDoc.exists() ? currentUserDoc.data().username : "A Friend";
      
      await addDoc(collection(db, 'friendRequests'), {
        fromUserId: firebaseUser.uid,
        fromUsername: currentUsername,
        toUserId: targetUser.uid,
        toUsername: targetUser.username,
        status: 'pending', createdAt: serverTimestamp(),
      });
      toast({ title: 'Success', description: 'Friend request sent!' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setLoading(prev => ({...prev, action: false}));
    }
  };

  const handleFriendRequest = async (request: RequestWithSenderProfile, accept: boolean) => {
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
        const currentUserDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const currentUsername = currentUserDoc.exists() ? currentUserDoc.data().username : "A friend";

        await addDoc(collection(db, 'blendRequests'), {
            fromUserId: firebaseUser.uid,
            fromUsername: currentUsername,
            toUserId: friend.uid,
            toUsername: friend.username,
            status: 'pending',
            createdAt: serverTimestamp(),
        });
        toast({ title: 'Sent!', description: `Blend invite sent to ${friend.username}.` });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not send invite.' });
    } finally {
        setLoading(prev => ({ ...prev, action: false }));
    }
  };
  
  const handleBlendRequest = async (request: RequestWithSenderProfile, accept: boolean) => {
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
  
        toast({ title: 'Blend Accepted!', description: `You can now view your Blend with ${request.fromUsername}.` });
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

  const handleRequest = (request: RequestWithSenderProfile, accept: boolean) => {
      if (request.type === 'friend') {
          handleFriendRequest(request, accept);
      } else {
          handleBlendRequest(request, accept);
      }
  }
  
  const hasActiveBlendWith = (friendId: string) => profileData?.activeBlendsWith?.includes(friendId);
  const hasPendingBlendInviteTo = (friendId: string) => sentBlendRequests.some(r => r.toUserId === friendId && r.status === 'pending');
  const hasSentFriendRequestTo = (friendId: string) => sentFriendRequests.includes(friendId);
  const isFriend = (friendId: string) => friends.some(f => f.uid === friendId);


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
                        <Avatar>
                            {friend.photoURL && <AvatarImage src={friend.photoURL} alt={friend.username} />}
                            <AvatarFallback>{getInitials(friend.username)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{friend.username}</span>
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
          <CardDescription>Search for users by their username to send a friend request.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search for a username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {isSearching ? (
             <div className="flex justify-center items-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
             </div>
          ) : (
            searchResults.length > 0 && (
                <div className="space-y-2 pt-2">
                    {searchResults.map(user => (
                        <div key={user.uid} className="flex items-center justify-between p-2 rounded-md hover:bg-secondary">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    <AvatarImage src={user.photoURL} alt={user.username} />
                                    <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
                                </Avatar>
                                <span className="font-medium">{user.username}</span>
                            </div>
                            {isFriend(user.uid) ? (
                                <Button variant="outline" size="sm" disabled>Friend</Button>
                            ) : hasSentFriendRequestTo(user.uid) ? (
                                <Button variant="outline" size="sm" disabled>Request Sent</Button>
                            ) : (
                                <Button size="sm" onClick={() => handleAddFriend(user)} disabled={loading.action}>
                                    <UserPlus className="mr-2 h-4 w-4" /> Add
                                </Button>
                            )}
                        </div>
                    ))}
                </div>
            )
          )}
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
                  {incomingRequests.length === 0 ? (
                     <p className="text-center text-sm text-muted-foreground py-4">No pending requests.</p>
                  ) : (
                     <ul className="space-y-3">
                        {incomingRequests.map((req) => (
                            <li key={req.id} className="flex items-center justify-between rounded-lg bg-secondary p-3">
                            <div className="flex items-center gap-3">
                                <Avatar>
                                    {req.fromPhotoURL && <AvatarImage src={req.fromPhotoURL} alt={req.fromUsername} />}
                                    <AvatarFallback>{getInitials(req.fromUsername)}</AvatarFallback>
                                </Avatar>
                                <div>
                                    <span className="font-medium">{req.fromUsername}</span>
                                    <div className={`text-xs ${req.type === 'blend' ? 'text-primary' : 'text-muted-foreground'}`}>
                                        {req.type === 'friend' ? 'Friend Request' : 'Blend Invite'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="icon" variant="outline" className="h-8 w-8 bg-green-500/10 text-green-600 hover:bg-green-500/20" onClick={() => handleRequest(req, true)} disabled={loading.action}><Check className="h-4 w-4" /></Button>
                                <Button size="icon" variant="outline" className="h-8 w-8 bg-red-500/10 text-red-600 hover:bg-red-500/20" onClick={() => handleRequest(req, false)} disabled={loading.action}><X className="h-4 w-4" /></Button>
                            </div>
                            </li>
                        ))}
                     </ul>
                  )}
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
                        <Avatar>
                            {friend.photoURL && <AvatarImage src={friend.photoURL} alt={friend.username} />}
                            <AvatarFallback>{getInitials(friend.username)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{friend.username}</span>
                    </Link>
                    <div className="ml-auto">
                        {hasActiveBlendWith(friend.uid) ? (
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
