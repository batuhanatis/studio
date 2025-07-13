
'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { ChatList } from '@/components/chat/ChatList';
import { UserDiscovery } from '@/components/social/UserDiscovery';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, UserPlus } from 'lucide-react';

export default function ChatsPage() {
  const { firebaseUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser) {
      router.push('/login');
    }
  }, [firebaseUser, loading, router]);

  if (loading || !firebaseUser) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading Chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Header />
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <Tabs defaultValue="chats" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chats"><MessageSquare className="mr-2 h-4 w-4"/>Chats</TabsTrigger>
                <TabsTrigger value="discover"><UserPlus className="mr-2 h-4 w-4"/>Discover Friends</TabsTrigger>
            </TabsList>
            <TabsContent value="chats" className="mt-6">
                <ChatList />
            </TabsContent>
            <TabsContent value="discover" className="mt-6">
                <UserDiscovery />
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
