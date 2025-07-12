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
        // Yeni kullanıcı için daha zengin bir profil belgesi oluşturuluyor
        await setDoc(userDocRef, {
          uid: uid,
          email: email,
          isAnonymous: firebaseUser.isAnonymous,
          username: "batuhanatis", // Varsayılan bir kullanıcı adı
          displayName: displayName || "",
          photoURL: photoURL || "",
          bio: "",
          watchlist: [], // Kullanıcının izleme listesi
          friends: [],
          ratedMovies: [],
          watchedMovies: [],
          createdAt: serverTimestamp(),
        });
      } else {
        const data = snapshot.data();
        // Eğer anonim kullanıcı kalıcı hale geliyorsa, bilgilerini güncelle
        if (data.isAnonymous && !firebaseUser.isAnonymous) {
          await updateDoc(userDocRef, {
            isAnonymous: false,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || "",
            photoURL: firebaseUser.photoURL || "",
          });
        }
      }

      return; // İşlem başarılı, döngüden çık
    } catch (error: any) {
      attempts++;
      if (error.code === 'permission-denied' && attempts < maxAttempts) {
        console.warn(`Attempt ${attempts} failed: Permission denied. Retrying in ${attempts * 200}ms...`);
        await delay(attempts * 200);
      } else {
        // Yeniden deneme limiti aşıldıysa veya başka bir hata varsa, hatayı fırlat
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
          // Profil oluşturulamasa bile kullanıcıyı ayarlamaya devam et
          setFirebaseUser(newFirebaseUser);
        } finally {
          setLoading(false);
        }
      } else {
        // Giriş yapmış kullanıcı yoksa, anonim oturum aç
        setLoading(true);
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged tekrar tetiklenecek ve anonim kullanıcıyı işleyecek
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
