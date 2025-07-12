'use client';

import { useEffect, useState } from 'react';
import { auth, onAuthStateChanged, type User } from '@/lib/firebase';

export default function AnonAuthTest() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log('Auth state changed:', u);
      setUser(u);
    });

    return () => unsubscribe();
  }, []);

  if (!user) return <div>Loading user state...</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-2">Auth Test Page</h1>
      <p>User ID: <code>{user.uid}</code></p>
      <p>Is Anonymous: {user.isAnonymous ? 'Yes' : 'No'}</p>
    </div>
  );
}
