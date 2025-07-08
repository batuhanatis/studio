
'use client';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
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
    const { email, uid } = firebaseUser;
    const createdAt = serverTimestamp();
    
    try {
        await setDoc(userDocRef, {
            uid,
            email,
            createdAt,
            friends: [],
            ratedMovies: [],
            watchedMovies: [],
        });
    } catch (error) {
        // Re-throw the error to be caught by the onAuthStateChanged listener
        throw error;
    }
  }
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (newFirebaseUser) => {
      try {
        if (newFirebaseUser) {
          await createUserProfileDocument(newFirebaseUser);
        }
        setFirebaseUser(newFirebaseUser);
      } catch (error: any) {
          console.error("Error during authentication state change, possibly due to Firestore permissions:", error);
          toast({
            variant: 'destructive',
            title: 'Profile Creation Failed',
            description: 'Login was successful, but creating your user profile failed. Please check your Firestore security rules and try again.',
            duration: 9000,
          });
          // This allows login even if profile creation fails, to avoid a login loop.
          setFirebaseUser(newFirebaseUser);
      } finally {
        setLoading(false);
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
