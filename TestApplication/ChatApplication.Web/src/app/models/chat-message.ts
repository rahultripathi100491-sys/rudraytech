export interface ChatMessage {
    id?: string;
    senderUserId: string;
    receiverUserId?: string;
    content: string;
    sentAt?: string;
    sentAtUtc?: string;
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