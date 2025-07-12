
'use client';

// This component is a direct wrapper for FriendManager.
// The FriendManager component contains all the logic for adding/managing friends and blends.
import { FriendManager } from '@/components/friends/FriendManager';

export function ProfileFriends() {
  return <FriendManager />;
}
