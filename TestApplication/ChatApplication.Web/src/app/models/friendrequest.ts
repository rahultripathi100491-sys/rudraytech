export interface FriendRequest {
  friendshipId: string;
  userId: string;
  name: string;
  profileImage?: string;
  createdDate: string;
  isOnLine: Boolean,
  lastSeen: string
}