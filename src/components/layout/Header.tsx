
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Film, Compass, User, LogIn, Menu, List, Users } from 'lucide-react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const router = useRouter();
  const { firebaseUser, notificationCount } = useAuth();
  const isAnonymous = firebaseUser?.isAnonymous;

  const authNav = isAnonymous ? (
    <Button asChild>
      <Link href="/login">
        <LogIn className="mr-2 h-4 w-4" />
        Login / Sign Up
      </Link>
    </Button>
  ) : (
     <Button asChild variant="secondary" className="relative">
        <Link href={`/profile/${firebaseUser?.uid}`}>
          <User className="mr-2 h-4 w-4" />
          Profile
          {notificationCount > 0 && (
            <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
                {notificationCount}
            </span>
          )}
        </Link>
      </Button>
  );

  const mobileAuthNav = isAnonymous ? (
    <SheetClose asChild>
      <Link href="/login" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-secondary">
        <LogIn className="h-5 w-5" />
        <span className="font-medium">Login / Sign Up</span>
      </Link>
    </SheetClose>
  ) : (
    <SheetClose asChild>
      <Link href={`/profile/${firebaseUser?.uid}`} className="relative flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-secondary">
        <User className="h-5 w-5" />
        <span className="font-medium">Profile</span>
        {notificationCount > 0 && (
          <span className="ml-auto flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground">
              {notificationCount}
          </span>
        )}
      </Link>
    </SheetClose>
  );
  
  const navLinks = (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/search">
          <Film className="mr-2 h-4 w-4" />
          Search
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href="/discover">
          <Compass className="mr-2 h-4 w-4" />
          Discover
        </Link>
      </Button>
       <Button asChild variant="ghost" size="sm">
        <Link href="/watchlists">
          <List className="mr-2 h-4 w-4" />
          Watchlists
        </Link>
      </Button>
       <Button asChild variant="ghost" size="sm">
        <Link href="/social">
          <Users className="mr-2 h-4 w-4" />
          Social
        </Link>
      </Button>
    </>
  );

  const mobileNavLinks = (
    <nav className="flex flex-col gap-2">
        <SheetClose asChild>
            <Link href="/search" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-secondary">
                <Film className="h-5 w-5" />
                <span className="font-medium">Search</span>
            </Link>
        </SheetClose>
        <SheetClose asChild>
            <Link href="/discover" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-secondary">
                <Compass className="h-5 w-5" />
                <span className="font-medium">Discover</span>
            </Link>
        </SheetClose>
        <SheetClose asChild>
            <Link href="/watchlists" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-secondary">
                <List className="h-5 w-5" />
                <span className="font-medium">Watchlists</span>
            </Link>
        </SheetClose>
         <SheetClose asChild>
            <Link href="/social" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-secondary">
                <Users className="h-5 w-5" />
                <span className="font-medium">Social</span>
            </Link>
        </SheetClose>
        {mobileAuthNav}
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm">
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        <Link href="/search" className="flex items-center gap-2">
          <Film className="h-7 w-7 text-accent" />
          <h1 className="text-xl font-bold font-headline tracking-tight text-foreground">
            WatchMe
          </h1>
        </Link>
        
        <div className="hidden items-center gap-2 md:flex">
          {navLinks}
        </div>
        
        <div className="flex items-center gap-2">
            <div className="hidden md:block">
                {authNav}
            </div>
            <div className="md:hidden">
                <Sheet>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="h-6 w-6" />
                            <span className="sr-only">Open menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[250px] p-4 bg-background">
                         <Link href="/search" className="mb-6 flex items-center gap-2">
                            <Film className="h-7 w-7 text-accent" />
                            <h1 className="text-xl font-bold font-headline tracking-tight text-foreground">
                                WatchMe
                            </h1>
                        </Link>
                        {mobileNavLinks}
                    </SheetContent>
                </Sheet>
            </div>
        </div>
      </div>
    </header>
  );
}
