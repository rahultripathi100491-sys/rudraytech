import { 
  Component, 
  OnInit, 
  OnDestroy, 
  ViewChild, 
  ElementRef, 
  AfterViewChecked, 
  inject 
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription } from 'rxjs';
import { ChatService, UserSearchResult } from '../services/chat';
import { ChatMessage, Conversation } from '../models/chat-message';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.css']
})
export class ChatWindowComponent implements OnInit {

  protected chatService = inject(ChatService);
  public showNewChatModal = false;
  public searchQuery = '';
  public searchResults: UserSearchResult[] = [];

  @ViewChild('scrollContainer') private scrollContainer!: ElementRef;

  public conversations$: Observable<Conversation[]> = this.chatService.getConversations();
  public activeTargetUserId: string | null = null;
  public activeTargetName: string = '';
  public currentUserId: string = localStorage.getItem('userId') || '';
  
  public newMessageText: string = '';
  public isSending: boolean = false;

  private messageSubscription!: Subscription;

  ngOnInit(): void {
    // Auto-scroll whenever active messages stream receives new payloads
    this.messageSubscription = this.chatService.activeMessages$.subscribe(() => {
      this.scrollToBottom();
    });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  public openNewChatModal(): void {
    this.showNewChatModal = true;
    this.searchQuery = '';
    this.searchResults = [];
  }

  public closeNewChatModal(): void {
    this.showNewChatModal = false;
  }

  public onSearchUsers(): void {
    if (!this.searchQuery.trim()) {
      this.searchResults = [];
      return;
    }this.chatService.searchUsers(this.searchQuery).subscribe({
      next: (results) => (this.searchResults = results),
      error: (err) => console.error('Failed to search users:', err)
    });
  }

  /**
   * Selects a contact, loads history, and opens active chat session
   */
  public selectConversation(targetUserId: string, targetName?: string): void {
    this.activeTargetUserId = targetUserId;
    if (targetName) {
      this.activeTargetName = targetName;
    }
    this.chatService.loadConversationHistory(targetUserId);
  }

  /**
   * Dispatches new message via ChatService
   */
  public async onSendMessage(): Promise<void> {
    if (!this.newMessageText.trim() || !this.activeTargetUserId || this.isSending) {
      return;
    }

    const messageContent = this.newMessageText;
    this.newMessageText = ''; // Instant input reset
    this.isSending = true;

    try {
      await this.chatService.sendMessage(this.activeTargetUserId, messageContent);
    } catch (error) {
      console.error('Failed to dispatch message:', error);
      // Restore draft input on dispatch error
      this.newMessageText = messageContent;
    } finally {
      this.isSending = false;
      this.scrollToBottom();
    }
  }

  /**
   * Keeps active chat viewport scrolled to bottom
   */
  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop = 
          this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch (err) {
      // Container element might be unmounted
    }
  }

  ngOnDestroy(): void {
    if (this.messageSubscription) {
      this.messageSubscription.unsubscribe();
    }
  }
  // Action to start or select a conversation
  public startConversation(targetUserId: string, targetName: string): void {
    this.activeTargetUserId = targetUserId;
    this.activeTargetName = targetName;
    this.chatService.loadConversationHistory(targetUserId);
  }
  public selectUserAndStartChat(user: UserSearchResult): void {
    this.activeTargetUserId = user.id;
    this.activeTargetName = user.name;

    // 1. Close search UI
    this.closeNewChatModal();

    // 2. Load existing history (returns [] if new user)
    this.chatService.loadConversationHistory(user.id);
  }
}