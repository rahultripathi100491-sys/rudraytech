export interface ChatMessage {
    id?: string;
    senderUserId: string;
    receiverUserId?: string;
    content: string;
    sentAt?: string;
    sentAtUtc?: string;
    status?: string | null;
}
export interface Conversation {
  id: string;
  participantUserId: string;
  participantName: string;
  lastMessage?: string;
  unreadCount: number;
}
export interface MessageNotification {
  id: string;
  senderUserId: string;
  senderUserName: string;
  message: string;
  receivedAt: string;
}
export interface MessageHistoryDto {
  id: string;
  senderUserId: string;
  content: string;
  status: string | number;
  sentAtUtc: string;
  deliveredAt?: string | null;
  readAt?: string | null;
}
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}