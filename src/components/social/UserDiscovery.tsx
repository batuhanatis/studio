
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import {
  doc,
  getDoc,
  query,
  collection,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  limit,
  orderBy,
  startAt,
  endAt,
  getDocs,
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { debounce } from 'lodash';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Loader2, UserPlus, Search } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

interface UserProfile {
  uid: string;
  username: string;
  email: string;
  photoURL?: string;
  friends?: string[];
}

export function UserDiscovery() {
  const { firebaseUser } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);

  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);

  const [friends, setFriends] = useState<string[]>([]);
  const [sentRequests, setSentRequests] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState(false);

  useEffect(() => {
    if (!firebaseUser) return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubUser = onSnapshot(userDocRef, (snap) => {
        setFriends(snap.data()?.friends || []);
    });

    const sentReqQuery = query(collection(db, 'friendRequests'), where('fromUserId', '==', firebaseUser.uid), where('status', '==', 'pending'));
    const unsubSent = onSnapshot(sentReqQuery, (snap) => {
        setSentRequests(snap.docs.map(d => d.data().toUserId));
    });

    return () => {
        unsubUser();
        unsubSent();
    };
  }, [firebaseUser]);


  const fetchSuggestions = useCallback(async () => {
    if (!firebaseUser) return;
    setLoadingSuggestions(true);
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, limit(20));
        const userDocs = await getDocs(q);
        const allUsers = userDocs.docs.map(d => d.data() as UserProfile);

        const friendIds = new Set(friends);
        const suggestedUsers = allUsers
            .filter(u => u.uid !== firebaseUser.uid && !friendIds.has(u.uid))
            .sort(() => 0.5 - Math.random()) 
            .slice(0, 8); 

        setSuggestions(suggestedUsers);

    } catch (error) {
        console.error("Error fetching suggestions:", error);
    } finally {
        setLoadingSuggestions(false);
    }
  }, [firebaseUser, friends]);

  useEffect(() => {
    if (firebaseUser && friends.length >= 0 && searchQuery.length === 0) {
        fetchSuggestions();
    }
  }, [firebaseUser, friends, searchQuery, fetchSuggestions]);

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
          .filter(user => user.uid !== firebaseUser?.uid);
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
    return () => debouncedSearch.cancel();
  }, [searchQuery, debouncedSearch]);
  
  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    return name.substring(0, 2).toUpperCase();
  }

  const handleAddFriend = async (targetUser: UserProfile) => {
    if (!firebaseUser) return;
    setLoadingAction(true);

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
        setLoadingAction(false);
    }
  };
  
  const isFriend = (uid: string) => friends.includes(uid);
  const hasSentRequest = (uid: string) => sentRequests.includes(uid);

  const UserCard = ({ user }: { user: UserProfile }) => (
    <div key={user.uid} className="flex items-center justify-between p-3 rounded-md hover:bg-secondary">
      <Link href={`/profile/${user.uid}`} className="flex items-center gap-4 hover:underline">
        <Avatar className="h-12 w-12">
          {user.photoURL && <AvatarImage src={user.photoURL} alt={user.username} />}
          <AvatarFallback>{getInitials(user.username)}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{user.username}</span>
      </Link>
      {isFriend(user.uid) ? (
        <Button variant="outline" size="sm" disabled>Friend</Button>
      ) : hasSentRequest(user.uid) ? (
        <Button variant="outline" size="sm" disabled>Request Sent</Button>
      ) : (
        <Button size="sm" onClick={() => handleAddFriend(user)} disabled={loadingAction}>
          <UserPlus className="mr-2 h-4 w-4" /> Add
        </Button>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
          <CardTitle>Find New Friends</CardTitle>
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
        </CardContent>
      </Card>
      
      {isSearching ? (
        <div className="flex justify-center items-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : searchResults.length > 0 ? (
        <div className="space-y-2 pt-2">
            <h2 className="text-xl font-bold">Search Results</h2>
            {searchResults.map(user => <UserCard key={user.uid} user={user} />)}
        </div>
      ) : searchQuery.length > 0 ? (
         <p className="text-center text-muted-foreground">No users found for "{searchQuery}".</p>
      ) : null}

      {!searchQuery && (
        <div className="space-y-4">
            <h2 className="text-xl font-bold">People You May Know</h2>
            {loadingSuggestions ? (
                 <div className="flex justify-center items-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : suggestions.length > 0 ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suggestions.map(user => <UserCard key={user.uid} user={user} />)}
                 </div>
            ) : (
                <p className="text-center text-muted-foreground">No suggestions right now. Check back later!</p>
            )}
        </div>
      )}

    </div>
  );
}
