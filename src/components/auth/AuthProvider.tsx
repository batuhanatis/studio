
'use client';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createContext, useEffect, useState, type ReactNode } from 'react';

interface AuthContextType {
  firebaseUser: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// This function creates a user profile in Firestore if it doesn't exist.
// It's designed to be called from onAuthStateChanged and will throw on failure.
const createUserProfileDocument = async (firebaseUser: User) => {
  if (!firebaseUser) return;
  const userDocRef = doc(db, 'users', firebaseUser.uid);
  const snapshot = await getDoc(userDocRef);

  if (!snapshot.exists()) {
    const { email, uid } = firebaseUser;
    const createdAt = serverTimestamp();
    
    await setDoc(userDocRef, {
      uid,
      email,
      createdAt,
      friends: [],
      ratedMovies: [],
      watchedMovies: [],
    });
  }
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (newFirebaseUser) => {
      try {
        if (newFirebaseUser) {
          // When user logs in or signs up, AWAIT the profile creation/check
          // before we proceed. This is crucial to prevent race conditions.
          await createUserProfileDocument(newFirebaseUser);
          setFirebaseUser(newFirebaseUser);
        } else {
          setFirebaseUser(null);
        }
      } catch (error) {
          console.error("Error during authentication state change, possibly due to Firestore permissions:", error);
          // If profile creation fails, we must NOT set the user.
          // Setting to null ensures the app state remains consistent and will
          // likely redirect to a safe page like /login.
          setFirebaseUser(null);
      } finally {
        // This is crucial to ensure the app is never stuck in a loading state.
        // It now runs only AFTER the profile document check is complete (or has failed).
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

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
