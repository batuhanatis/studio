
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, ListPlus } from 'lucide-react';

interface MovieDetails {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  poster: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
}

interface Watchlist {
  id: string;
  name: string;
  movies: MovieDetails[];
}

interface AddToWatchlistButtonProps {
  movie: MovieDetails;
  isIconOnly?: boolean;
}

export function AddToWatchlistButton({ movie, isIconOnly = false }: AddToWatchlistButtonProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingToList, setAddingToList] = useState<string | null>(null);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!user || !isOpen) return;

    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWatchlists(data.watchlists || []);
      }
      setLoading(false);
    }, () => {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not load your lists.' });
        setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, user, toast]);

  const handleAddToList = async (listId: string) => {
    if (!user) return;
    setAddingToList(listId);
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) throw new Error("User not found");

      const currentWatchlists: Watchlist[] = docSnap.data().watchlists || [];
      const listIndex = currentWatchlists.findIndex(l => l.id === listId);

      if (listIndex === -1) throw new Error("Watchlist not found");

      const targetList = currentWatchlists[listIndex];
      const movieExists = targetList.movies.some(m => m.id === movie.id && m.media_type === movie.media_type);

      if (movieExists) {
        toast({ variant: 'default', title: 'Already Added', description: `"${movie.title}" is already in "${targetList.name}".` });
        setIsOpen(false);
        return;
      }
      
      const updatedMovies = [...targetList.movies, movie];
      currentWatchlists[listIndex] = { ...targetList, movies: updatedMovies };

      await setDoc(userDocRef, { watchlists: currentWatchlists }, { merge: true });
      toast({ title: 'Success!', description: `Added "${movie.title}" to "${targetList.name}".` });
      setIsOpen(false);

    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not add to list.' });
    } finally {
      setAddingToList(null);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!user || !newListName.trim()) return;
    setIsCreating(true);
    
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(userDocRef);
      if (!docSnap.exists()) throw new Error("User not found");
      
      const newId = doc(collection(db, 'users')).id;
      const newList: Watchlist = {
        id: newId,
        name: newListName.trim(),
        movies: [movie]
      };

      const currentWatchlists = docSnap.data().watchlists || [];
      const updatedWatchlists = [...currentWatchlists, newList];
      
      await setDoc(userDocRef, { watchlists: updatedWatchlists }, { merge: true });
      toast({ title: 'Success!', description: `Created list "${newList.name}" and added "${movie.title}".` });
      setNewListName('');
      setIsOpen(false);
      
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message || 'Could not create list.' });
    } finally {
      setIsCreating(false);
    }
  };

  const buttonContent = isIconOnly ? (
    <ListPlus className="h-4 w-4" />
  ) : (
    <>
      <ListPlus className="mr-2 h-4 w-4" /> Add to List
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {isIconOnly ? (
          <Button variant="outline" size="icon" aria-label="Add to Watchlist">
            {buttonContent}
          </Button>
        ) : (
          <Button variant="outline">
            {buttonContent}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add "{movie.title}" to a list</DialogTitle>
          <DialogDescription>Select an existing list or create a new one.</DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : watchlists.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {watchlists.map(list => (
              <Button
                key={list.id}
                variant="ghost"
                className="w-full justify-start"
                disabled={!!addingToList}
                onClick={() => handleAddToList(list.id)}
              >
                {addingToList === list.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                    <ListPlus className="mr-2 h-4 w-4" />
                )}
                {list.name}
              </Button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">You don't have any lists yet.</p>
        )}

        <div className="mt-4 pt-4 border-t">
          <h4 className="font-semibold text-sm mb-2">Create a new list</h4>
          <div className="flex gap-2">
            <Input 
              placeholder="e.g. Sci-Fi Favorites"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              disabled={isCreating}
            />
            <Button onClick={handleCreateAndAdd} disabled={isCreating || !newListName.trim()}>
              {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
