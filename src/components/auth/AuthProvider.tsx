
'use client';

import { auth, db, signInAnonymously } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  firebaseUser: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const createUserProfileDocument = async (firebaseUser: User) => {
  if (!firebaseUser) return;
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userDocRef);

  if (!snapshot.exists()) {
    const { email, uid, isAnonymous } = firebaseUser;
    const createdAt = serverTimestamp();
    
    try {
        await setDoc(userDocRef, {
            uid,
            email,
            isAnonymous,
            createdAt,
            friends: [],
            ratedMovies: [],
            watchedMovies: [],
        });
    } catch (error) {
        throw error;
    }
  } else {
    // If user exists, ensure isAnonymous flag is up to date.
    // This happens when an anonymous user is upgraded.
    const data = snapshot.data();
    if (data.isAnonymous && !firebaseUser.isAnonymous) {
        await updateDoc(userDocRef, { 
            isAnonymous: false,
            email: firebaseUser.email 
        });
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
        // User is signed in (either permanently or anonymously)
        try {
          await createUserProfileDocument(newFirebaseUser);
          setFirebaseUser(newFirebaseUser);
        } catch (error: any) {
          console.error("Error during profile creation/update:", error);
          toast({
            variant: 'destructive',
            title: 'Profile Sync Failed',
            description: 'Could not sync your profile with the database. Some features might not work correctly.',
            duration: 9000,
          });
          // Still set the user to allow app access, but with a warning.
          setFirebaseUser(newFirebaseUser);
        } finally {
          setLoading(false);
        }
      } else {
        // User is not signed in, so sign them in anonymously.
        setLoading(true); // Keep loading while we sign in anonymously
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the new anonymous user.
        } catch (error) {
          console.error("Anonymous sign-in failed:", error);
          toast({
            variant: 'destructive',
            title: 'Authentication Failed',
            description: 'Could not start an anonymous session. Please refresh the page to try again.',
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
