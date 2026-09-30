export interface Friend {
  userId: string;
  name: string;
  profileImage?: string | null;
  isOnLine: boolean,
  lastSeen: string
}
