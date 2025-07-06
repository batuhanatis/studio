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
// It's called when the user signs in for the first time.
const createUserProfileDocument = async (user: User) => {
  if (!user) return;
  const userDocRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userDocRef);

  if (!snapshot.exists()) {
    const { email, uid } = user;
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
      console.error("Error creating user document:", error);
      // This is a fallback error, it shouldn't be triggered with the new architecture.
    }
  }
};


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // When user logs in or signs up, ensure their profile exists.
        await createUserProfileDocument(firebaseUser);
        setUser(firebaseUser);
      } else {
        setUser(null);
      }
      setLoading(false);
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
