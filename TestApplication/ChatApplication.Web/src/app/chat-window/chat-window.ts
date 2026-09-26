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
import { CallService } from '../services/call.service';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.css']
})
export class ChatWindowComponent implements OnInit, OnDestroy, AfterViewChecked {
  protected chatService = inject(ChatService);
  protected callService = inject(CallService);

  public incomingCallUserId: string | null = null;
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

  private subscriptions = new Subscription();

  ngOnInit(): void {
    this.subscriptions.add(
      this.chatService.activeMessages$.subscribe(() => {
        this.scrollToBottom();
      })
    );

    this.subscriptions.add(
      this.callService.incomingCall$.subscribe((fromUserId) => {
        this.incomingCallUserId = fromUserId;
      })
    );
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
    }
    this.chatService.searchUsers(this.searchQuery).subscribe({
      next: (results) => (this.searchResults = results),
      error: (err) => console.error('Failed to search users:', err)
    });
  }

  public selectConversation(targetUserId: string, targetName?: string): void {
    this.activeTargetUserId = targetUserId;
    if (targetName) {
      this.activeTargetName = targetName;
    }
    this.chatService.loadConversationHistory(targetUserId);
  }

  public async onSendMessage(): Promise<void> {
    if (!this.newMessageText.trim() || !this.activeTargetUserId || this.isSending) {
      return;
    }
    const messageContent = this.newMessageText;
    this.newMessageText = '';
    this.isSending = true;
    try {
      await this.chatService.sendMessage(this.activeTargetUserId, messageContent);
    } catch (error) {
      console.error('Failed to dispatch message:', error);
      this.newMessageText = messageContent;
    } finally {
      this.isSending = false;
      this.scrollToBottom();
    }
  }

  private scrollToBottom(): void {
    try {
      if (this.scrollContainer) {
        this.scrollContainer.nativeElement.scrollTop =
          this.scrollContainer.nativeElement.scrollHeight;
      }
    } catch {}
  }

  public startConversation(targetUserId: string, targetName: string): void {
    this.activeTargetUserId = targetUserId;
    this.activeTargetName = targetName;
    this.chatService.loadConversationHistory(targetUserId);
  }

  public selectUserAndStartChat(user: UserSearchResult): void {
    this.activeTargetUserId = user.id;
    this.activeTargetName = user.name;
    this.closeNewChatModal();
    this.chatService.loadConversationHistory(user.id);
  }

  // 📞 Call Management Handlers
  public startCall(): void {
    if (!this.activeTargetUserId) return;
    this.callService.startCall(this.activeTargetUserId);
  }

  public acceptIncomingCall(): void {
    if (this.incomingCallUserId) {
      this.callService.acceptCall(this.incomingCallUserId);
    }
  }

  public rejectIncomingCall(): void {
    if (this.incomingCallUserId) {
      this.callService.rejectCall(this.incomingCallUserId);
    }
  }

  public endCall(): void {
    this.callService.endCall();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
}