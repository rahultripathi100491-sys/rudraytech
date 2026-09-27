export interface Comment {
  id: string;
  userId: string;
  userName: string;
  profileImage?: string | null;
  content: string;
  createdAt: string;
}
