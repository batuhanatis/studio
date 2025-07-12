'use client';

import { useEffect, useState } from 'react';
import { auth, signInAnonymously, onAuthStateChanged, type User } from '@/lib/firebase';

export default function AnonAuthTest() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u);
      setUser(u);
      if (!u) {
        signInAnonymously(auth)
          .then((cred) => console.log('Signed in anonymously:', cred.user))
          .catch((err) => console.error('Anonymous sign-in error:', err));
      }
    });

    return () => unsubscribe();
  }, []);

  if (!user) return <div>Loading or signing in anonymously...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">Welcome!</h1>
      <p>User ID: <code>{user.uid}</code></p>
      <p>Is Anonymous: {user.isAnonymous ? 'Yes' : 'No'}</p>
    </div>
  );
}
