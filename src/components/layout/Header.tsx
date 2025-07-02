'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Film, Users, Gift, Compass, Sparkles, List, Menu, User } from 'lucide-react';
import Link from 'next/link';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

export function Header() {
  const router = useRouter();

  const navLinks = (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/discover">
          <Compass className="mr-2 h-4 w-4" />
          Discover
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href="/foryou">
          <Sparkles className="mr-2 h-4 w-4" />
          For You
        </Link>
      </Button>
      <Button asChild variant="ghost" size="sm">
        <Link href="/watchlists">
          <List className="mr-2 h-4 w-4" />
          Watchlists
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
      <Button asChild variant="ghost" size="sm">
        <Link href="/profile">
          <User className="mr-2 h-4 w-4" />
          Profilim
        </Link>
      </Button>
    </>
  );

  const mobileNavLinks = (
    <nav className="flex flex-col gap-2">
        <SheetClose asChild>
            <Link href="/discover" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-accent">
                <Compass className="h-5 w-5" />
                <span className="font-medium">Discover</span>
            </Link>
        </SheetClose>
        <SheetClose asChild>
            <Link href="/foryou" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-accent">
                <Sparkles className="h-5 w-5" />
                <span className="font-medium">For You</span>
            </Link>
        </SheetClose>
        <SheetClose asChild>
            <Link href="/watchlists" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-accent">
                <List className="h-5 w-5" />
                <span className="font-medium">Watchlists</span>
            </Link>
        </SheetClose>
        <SheetClose asChild>
            <Link href="/recommendations" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-accent">
                <Gift className="h-5 w-5" />
                <span className="font-medium">Recommendations</span>
            </Link>
        </SheetClose>
        <SheetClose asChild>
            <Link href="/friends" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-accent">
                <Users className="h-5 w-5" />
                <span className="font-medium">Friends</span>
            </Link>
        </SheetClose>
        <SheetClose asChild>
            <Link href="/profile" className="flex items-center gap-3 rounded-md p-2 text-foreground hover:bg-accent">
                <User className="h-5 w-5" />
                <span className="font-medium">Profilim</span>
            </Link>
        </SheetClose>
    </nav>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-card/80 backdrop-blur">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/search" className="flex items-center gap-2">
          <Film className="h-7 w-7 text-primary" />
          <h1 className="text-xl font-bold font-headline tracking-tight text-foreground">
            Movie Finder
          </h1>
        </Link>
        
        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {navLinks}
        </div>
        
        {/* Mobile Navigation */}
        <div className="md:hidden">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Menu className="h-6 w-6" />
                        <span className="sr-only">Open menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[250px] p-4">
                     <Link href="/search" className="mb-6 flex items-center gap-2">
                        <Film className="h-7 w-7 text-primary" />
                        <h1 className="text-xl font-bold font-headline tracking-tight text-foreground">
                            Movie Finder
                        </h1>
                    </Link>
                    {mobileNavLinks}
                </SheetContent>
            </Sheet>
        </div>
      </div>
    </header>
  );
}
