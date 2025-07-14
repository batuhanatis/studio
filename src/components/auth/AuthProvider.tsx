'use client';

import {
  auth,
  db,
  onAuthStateChanged,
  signInAnonymously,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
  type User,
  deleteDoc,
  deleteUser,
  getDocs,
  writeBatch
} from '@/lib/firebase';

import { createContext, useEffect, useState, type ReactNode, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  firebaseUser: User | null;
  loading: boolean;
  notificationCount: number;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createUserProfileDocument = async (firebaseUser: User) => {
  if (!firebaseUser?.uid) return;

  const userDocRef = doc(db, 'users', firebaseUser.uid);

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const snapshot = await getDoc(userDocRef);

      if (!snapshot.exists()) {
        const { uid, email, displayName, photoURL } = firebaseUser;
        await setDoc(userDocRef, {
          uid: uid,
          email: email,
          isAnonymous: firebaseUser.isAnonymous,
          username: email?.split('@')[0] || `user_${uid.substring(0,6)}`,
          displayName: displayName || "",
          photoURL: photoURL || "",
          bio: "",
          watchlists: [], 
          friends: [],
          activeBlendsWith: [],
          likedMovies: [],
          dislikedMovies: [],
          createdAt: serverTimestamp(),
        });
      } else {
        const data = snapshot.data();
        if (data.isAnonymous && !firebaseUser.isAnonymous) {
          const updateData: { isAnonymous: boolean; email?: string | null; displayName?: string | null; photoURL?: string | null } = {
            isAnonymous: false,
          };
          if (firebaseUser.email) updateData.email = firebaseUser.email;
          if (firebaseUser.displayName) updateData.displayName = firebaseUser.displayName;
          if (firebaseUser.photoURL) updateData.photoURL = firebaseUser.photoURL;

          await updateDoc(userDocRef, updateData);
        }
      }

      return;
    } catch (error: any) {
      attempts++;
      if (error.code === 'permission-denied' && attempts < maxAttempts) {
        console.warn(`Attempt ${attempts} failed: Permission denied. Retrying in ${attempts * 200}ms...`);
        await delay(attempts * 200);
      } else {
        throw error;
      }
    }
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationCount, setNotificationCount] = useState(0);
  const { toast } = useToast();
  const userRef = useRef<User | null>(null);

  useEffect(() => {
    userRef.current = firebaseUser;
  }, [firebaseUser]);

  useEffect(() => {
    const handleBeforeUnload = async (event: BeforeUnloadEvent) => {
      if (userRef.current && userRef.current.isAnonymous) {
        try {
          // This is often not guaranteed to run, but it's the best client-side effort.
          // A more robust solution would be a backend cron job.
          await deleteDoc(doc(db, 'users', userRef.current.uid));
          await deleteUser(userRef.current);
        } catch (error) {
           // We can't do much here as the browser is closing.
           console.error("Failed to clean up anonymous user on exit.", error);
        }
      }
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);


  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (newFirebaseUser) => {
      if (newFirebaseUser) {
        try {
          await createUserProfileDocument(newFirebaseUser);
          setFirebaseUser(newFirebaseUser);
        } catch (error: any) {
          console.error("Error during profile creation/update:", error);
          toast({
            variant: 'destructive',
            title: 'Could not sync your profile',
            description: 'Please check your Firestore rules and make sure they are published.',
            duration: 9000,
          });
          setFirebaseUser(newFirebaseUser);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(true);
        setFirebaseUser(null);
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous sign-in failed:", error);
          toast({
            variant: 'destructive',
            title: 'Authentication Failed',
            description: 'Could not start an anonymous session. Please refresh the page.',
          });
          setLoading(false);
        }
      }
    });

    return () => unsubscribeAuth();
  }, [toast]);

  useEffect(() => {
    if (!firebaseUser || firebaseUser.isAnonymous) {
      setNotificationCount(0);
      return;
    }
    
    let unsubscribers: Unsubscribe[] = [];
    
    const friendRequestQuery = query(
      collection(db, 'friendRequests'),
      where('toUserId', '==', firebaseUser.uid),
      where('status', '==', 'pending')
    );
    const blendRequestQuery = query(
      collection(db, 'blendRequests'),
      where('toUserId', '==', firebaseUser.uid),
      where('status', '==', 'pending')
    );

    const chatsQuery = query(
        collection(db, 'chats'),
        where('users', 'array-contains', firebaseUser.uid)
    );

    let friendRequestCount = 0;
    let blendRequestCount = 0;
    let unreadChatsCount = 0;

    const updateTotal = () => {
        setNotificationCount(friendRequestCount + blendRequestCount + unreadChatsCount);
    }

    const friendUnsub = onSnapshot(friendRequestQuery, (snapshot) => {
        friendRequestCount = snapshot.size;
        updateTotal();
    });
    unsubscribers.push(friendUnsub);

    const blendUnsub = onSnapshot(blendRequestQuery, (snapshot) => {
        blendRequestCount = snapshot.size;
        updateTotal();
    });
    unsubscribers.push(blendUnsub);

    const chatsUnsub = onSnapshot(chatsQuery, (snapshot) => {
        unreadChatsCount = 0;
        snapshot.docs.forEach(d => {
            const chatData = d.data();
            const lastMessage = chatData.lastMessage;
            if (lastMessage && lastMessage.senderId !== firebaseUser.uid) {
                if (!lastMessage.readBy || !lastMessage.readBy.includes(firebaseUser.uid)) {
                    unreadChatsCount++;
                }
            }
        });
        updateTotal();
    }, (error) => {
      console.error("Chat notification listener error: ", error);
    });
    unsubscribers.push(chatsUnsub);

    return () => {
        unsubscribers.forEach(unsub => unsub());
    }

  }, [firebaseUser]);

  const value = {
    firebaseUser,
    loading,
    notificationCount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
