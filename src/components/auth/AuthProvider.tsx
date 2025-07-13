
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
  type User
} from '@/lib/firebase';

import { createContext, useEffect, useState, type ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  firebaseUser: User | null;
  loading: boolean;
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
          ratedMovies: [],
          watchedMovies: [],
          createdAt: serverTimestamp(),
        });
      } else {
        const data = snapshot.data();
        if (data.isAnonymous && !firebaseUser.isAnonymous) {
          // When an anonymous user signs up, their profile gets upgraded.
          // The username is now set during the registration process.
          // We only update the necessary fields that change upon linking.
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
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (newFirebaseUser) => {
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
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous sign-in failed:", error);
          toast({
            variant: 'destructive',
            title: 'Authentication Failed',
            description: 'Could not start an anonymous session. Please refresh the page.',
          });
          setFirebaseUser(null);
          setLoading(false);
        }
      }
    });

    return () => unsubscribe();
  }, [toast]);

  const value = {
    firebaseUser,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
