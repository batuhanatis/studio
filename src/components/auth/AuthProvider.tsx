
'use client';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, type User, signInAnonymously } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { createContext, useEffect, useState, type ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  firebaseUser: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper function to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createUserProfileDocument = async (firebaseUser: User) => {
  if (!firebaseUser) return;
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const snapshot = await getDoc(userDocRef);

      if (!snapshot.exists()) {
        const { email, uid, isAnonymous } = firebaseUser;
        const createdAt = serverTimestamp();
        
        await setDoc(userDocRef, {
            uid,
            email,
            isAnonymous,
            createdAt,
            friends: [],
            ratedMovies: [],
            watchedMovies: [],
        });
      } else {
        const data = snapshot.data();
        if (data.isAnonymous && !firebaseUser.isAnonymous) {
            await updateDoc(userDocRef, { 
                isAnonymous: false,
                email: firebaseUser.email 
            });
        }
      }
      return; // Success, exit the loop
    } catch (error: any) {
      attempts++;
      if (error.code === 'permission-denied' && attempts < maxAttempts) {
        console.warn(`Attempt ${attempts} failed: Permission denied. Retrying in ${attempts * 200}ms...`);
        await delay(attempts * 200); // Wait a bit before retrying
      } else {
        // For other errors or if max attempts are reached, throw the error
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
            title: 'Profile Sync Failed',
            description: 'Could not sync your profile. Please check Firestore rules.',
            duration: 9000,
          });
          // Still set the user to allow app access, but with a warning.
          setFirebaseUser(newFirebaseUser);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(true);
        try {
          const userCredential = await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the new anonymous user.
          // The profile creation and loading state will be handled in that subsequent call.
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
