
'use client';

import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Film, LogOut, Users, Gift, Compass } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

export function Header() {
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Logout Failed',
        description: 'Could not log you out. Please try again.',
      });
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/search" className="flex items-center gap-2">
          <Film className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-bold font-headline tracking-tight text-foreground">
            Movie Finder
          </h1>
        </Link>
        <div className="flex items-center gap-1">
           <Button asChild variant="ghost" size="sm">
            <Link href="/discover">
              <Compass className="mr-2 h-4 w-4" />
              Discover
            </Link>
          </Button>
           <Button asChild variant="ghost" size="sm">
            <Link href="/recommendations">
              <Gift className="mr-2 h-4 w-4" />
              Recommendations
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/friends">
              <Users className="mr-2 h-4 w-4" />
              Friends
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
