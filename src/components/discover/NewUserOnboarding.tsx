
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Heart, CheckCircle } from 'lucide-react';

const GOAL = 5;

export function NewUserOnboarding() {
  const { firebaseUser } = useAuth();
  const [likedCount, setLikedCount] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;

    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const count = data.likedMovies?.length || 0;
        setLikedCount(count);

        if (count >= GOAL) {
          // Add a small delay before hiding to show the "Done!" message
          setTimeout(() => {
            setIsVisible(false);
          }, 2000);
        }
      }
    });

    return () => unsubscribe();
  }, [firebaseUser]);

  if (!isVisible) {
    return null;
  }

  const remaining = GOAL - likedCount;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 flex justify-center">
      <div className="bg-card border border-primary/20 shadow-2xl rounded-lg p-4 w-full max-w-md animate-in slide-in-from-bottom-5 duration-500">
        {remaining > 0 ? (
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 text-primary p-3 rounded-full">
                <Heart className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg font-headline">Welcome! Let's get to know you.</h3>
              <p className="text-muted-foreground">
                Like <span className="font-bold text-foreground">{remaining} more</span> {remaining === 1 ? 'movie' : 'movies'} to get personalized recommendations.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4 text-green-500">
             <div className="bg-green-500/10 p-3 rounded-full">
                <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg font-headline">All set!</h3>
              <p className="text-green-500/80">You're ready to get amazing recommendations.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
