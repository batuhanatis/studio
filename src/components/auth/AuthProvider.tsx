'use client';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { createContext, useEffect, useState, type ReactNode } from 'react';

interface AuthContextType {
  user: User | null;
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
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // When user logs in or signs up, ensure their profile exists.
          // This might fail if Firestore rules are not set correctly.
          await createUserProfileDocument(firebaseUser);
          setUser(firebaseUser);
        } else {
          setUser(null);
        }
      } catch (error) {
          console.error("Error during authentication state change, possibly due to Firestore permissions:", error);
          // We still set the user so the app knows someone is authenticated,
          // but features requiring a DB profile might fail.
          // This prevents the entire app from getting stuck on a loading screen.
          setUser(firebaseUser); 
      } finally {
        // This is crucial to ensure the app is never stuck in a loading state.
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
