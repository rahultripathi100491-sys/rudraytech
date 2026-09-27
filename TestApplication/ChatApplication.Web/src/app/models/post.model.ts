export interface PostModel {
  id: string;
  content: string;
  profileImage?: string | null;
  userName: string;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isLikedByCurrentUser: boolean;
}
