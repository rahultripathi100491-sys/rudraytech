import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { RouterModule, Router } from '@angular/router';
import { ChatService } from '../services/chat';
import { MessageNotification } from '../models/chat-message';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  userName: string | null = null;
  profilePic: string | null = null;
  
  protected chatService = inject(ChatService);
  private router = inject(Router);

  unreadMessages$ = this.chatService.unreadMessages$;
  public notifications$ = this.chatService.notifications$;

  public showNotifications = false;

  constructor(public authService: AuthService) {
    this.userName = localStorage.getItem('userName');
    this.profilePic = localStorage.getItem('profilePic');
  }

  getInitials(): string {
    if (!this.userName) return '';
    const parts = this.userName.trim().split(' ');
    const first = parts[0]?.charAt(0).toUpperCase() || '';
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0).toUpperCase() : '';
    return first + last;
  }

  logout() {
    this.authService.logout();
    this.userName = null;
    this.profilePic = null;
  }

  getTotalUnread(unread: Record<string, number>): number {
    return Object.values(unread).reduce((total, count) => total + count, 0);
  }

  openNotifications(): void {
    console.log('Unread notifications:', this.chatService.getTotalUnreadCount());
  }

  public async requestNotificationPermission(): Promise<void> { 
    await this.chatService.requestNotificationPermission(); 
  }

  public toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
  }

  public closeNotifications(): void {
    this.showNotifications = false;
  }

  public openNotification(notification: MessageNotification): void {
    // Navigate to chat interface if not currently on chat
    this.router.navigate(['/chat']);

    // Load active target conversation
    this.chatService.loadConversationHistory(notification.senderUserId);

    // Remove notification item from header dropdown
    this.chatService.removeNotification(notification.id);

    this.showNotifications = false;
  }

  public clearAllNotifications(): void {
    this.chatService.clearNotifications();
  }

  public trackByNotification(index: number, notification: MessageNotification): string {
    return notification.id;
  }
}