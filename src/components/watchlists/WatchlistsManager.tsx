
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, collection, getDoc, runTransaction } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, List, Trash2, Edit, Film } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

export function WatchlistsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [newListName, setNewListName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<Watchlist | null>(null);
  const [editedName, setEditedName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingList, setDeletingList] = useState<Watchlist | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setWatchlists(docSnap.data().watchlists || []);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching watchlists:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not load watchlists.' });
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, toast]);

  const handleCreateList = async () => {
    if (!user || !newListName.trim()) return;
    setIsCreating(true);

    const userDocRef = doc(db, 'users', user.uid);
    const newId = doc(collection(db, 'users')).id;
    const newList: Watchlist = { id: newId, name: newListName.trim(), movies: [] };

    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            const currentWatchlists = userDoc.exists() ? userDoc.data().watchlists || [] : [];
            const updatedWatchlists = [...currentWatchlists, newList];

            if (userDoc.exists()) {
                transaction.update(userDocRef, { watchlists: updatedWatchlists });
            } else {
                transaction.set(userDocRef, { watchlists: updatedWatchlists });
            }
        });
        
        toast({ title: 'Success!', description: `Created list "${newList.name}".` });
        setNewListName('');
        setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Transaction failed: ", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create list.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateName = async () => {
    if (!user || !editingList || !editedName.trim()) return;
    setIsUpdating(true);
    const userDocRef = doc(db, 'users', user.uid);
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("User profile not found.");
            }
            const currentWatchlists: Watchlist[] = userDoc.data().watchlists || [];
            const updatedWatchlists = currentWatchlists.map(list =>
                list.id === editingList.id ? { ...list, name: editedName.trim() } : list
            );
            transaction.update(userDocRef, { watchlists: updatedWatchlists });
        });

        toast({ title: 'Success!', description: 'List name updated.' });
        setEditingList(null);
    } catch (error: any) {
        console.error("Transaction failed: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update list name.' });
    } finally {
        setIsUpdating(false);
    }
  };
  
  const handleDeleteList = async () => {
    if (!user || !deletingList) return;
    setIsDeleting(true);
    const userDocRef = doc(db, 'users', user.uid);
    try {
        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                 throw new Error("User profile not found.");
            }
            const currentWatchlists: Watchlist[] = userDoc.data()?.watchlists || [];
            const updatedWatchlists = currentWatchlists.filter(list => list.id !== deletingList.id);
            transaction.update(userDocRef, { watchlists: updatedWatchlists });
        });
        
        toast({ title: 'Success!', description: 'List deleted.' });
        setDeletingList(null);
    } catch (error: any) {
        console.error("Transaction failed: ", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not delete list.' });
    } finally {
        setIsDeleting(false);
    }
  };


  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold font-headline tracking-tight md:text-4xl">Your Watchlists</h1>
         <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" /> New List</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create a new watchlist</DialogTitle>
                </DialogHeader>
                <div className="flex gap-2 py-4">
                    <Input placeholder="e.g. Weekend Movies" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
                    <Button onClick={handleCreateList} disabled={isCreating || !newListName.trim()}>
                        {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
      </div>

      {watchlists.length === 0 ? (
        <Alert>
          <List className="h-4 w-4" />
          <AlertTitle>No watchlists yet!</AlertTitle>
          <AlertDescription>
            Create your first watchlist to start saving movies and TV shows. Use the "New List" button.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {watchlists.map(list => (
            <Card key={list.id} className="flex flex-col">
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle className="hover:text-primary transition-colors">
                    <Link href={`/watchlists/${list.id}`}>{list.name}</Link>
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 pt-2">
                    <Film className="h-4 w-4" />
                    {list.movies.length} {list.movies.length === 1 ? 'item' : 'items'}
                  </CardDescription>
                </div>
                 <div className="flex gap-2">
                    <Dialog onOpenChange={(open) => !open && setEditingList(null)}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => { setEditingList(list); setEditedName(list.name); }}>
                                <Edit className="h-4 w-4" />
                            </Button>
                        </DialogTrigger>
                       {editingList?.id === list.id && (
                        <DialogContent>
                            <DialogHeader><DialogTitle>Rename "{editingList.name}"</DialogTitle></DialogHeader>
                            <div className="flex gap-2 py-4">
                                <Input value={editedName} onChange={(e) => setEditedName(e.target.value)} />
                                <Button onClick={handleUpdateName} disabled={isUpdating || !editedName.trim()}>
                                    {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
                                </Button>
                            </div>
                        </DialogContent>
                       )}
                    </Dialog>
                     <Dialog onOpenChange={(open) => !open && setDeletingList(null)}>
                         <DialogTrigger asChild>
                             <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeletingList(list)}>
                                 <Trash2 className="h-4 w-4" />
                             </Button>
                         </DialogTrigger>
                         {deletingList?.id === list.id && (
                             <DialogContent>
                                 <DialogHeader>
                                     <DialogTitle>Delete "{deletingList.name}"?</DialogTitle>
                                     <CardDescription>This action cannot be undone. All movies in this list will be removed.</CardDescription>
                                 </DialogHeader>
                                 <DialogFooter>
                                     <Button variant="secondary" onClick={() => setDeletingList(null)}>Cancel</Button>
                                     <Button variant="destructive" onClick={handleDeleteList} disabled={isDeleting}>
                                         {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete'}
                                     </Button>
                                 </DialogFooter>
                             </DialogContent>
                         )}
                     </Dialog>
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex items-end">
                <Button asChild variant="secondary" className="w-full">
                    <Link href={`/watchlists/${list.id}`}>View List</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
