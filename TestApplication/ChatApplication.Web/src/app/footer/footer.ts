import { Component, ElementRef, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatService } from '../services/chat'; // adjust path

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
// Sidebar state
  showNewChatModal = false;
  searchQuery = '';
  //searchResults: UserSearchResult[] = [];

  // Conversations stream
  //conversations$: Observable<Conversation[]>;

  // Active chat state
  activeTargetUserId: string | null = null;
  activeTargetName: string | null = null;

  // Messages
  newMessageText = '';
  isSending = false;
  currentUserId = localStorage.getItem('userId') || '';

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  constructor(public chatService: ChatService) {
    //this.conversations$ = this.chatService.getConversations();
  }

  ngOnInit(): void {
    // auto-scroll when new messages arrive
    this.chatService.activeMessages$.subscribe(() => {
      setTimeout(() => this.scrollToBottom(), 100);
    });
  }

  /** Sidebar actions */
  openNewChatModal() {
    this.showNewChatModal = true;
    this.searchQuery = '';
    //this.searchResults = [];
  }

  closeNewChatModal() {
    this.showNewChatModal = false;
  }

  onSearchUsers() {
    if (!this.searchQuery.trim()) {
      //this.searchResults = [];
      return;
    }
    this.chatService.searchUsers(this.searchQuery).subscribe(users => {
      //this.searchResults = users;
    });
  }

  // selectUserAndStartChat(user: UserSearchResult) {
  //   this.activeTargetUserId = user.id;
  //   this.activeTargetName = user.name;
  //   this.chatService.loadConversationHistory(user.id);
  //   this.closeNewChatModal();
  // }

  /** Conversation list click */
  startConversation(userId: string, name: string) {
    this.activeTargetUserId = userId;
    this.activeTargetName = name;
    this.chatService.loadConversationHistory(userId);
  }

  /** Footer send message */
  async onSendMessage() {
    if (!this.newMessageText.trim() || !this.activeTargetUserId) return;

    this.isSending = true;
    try {
      await this.chatService.sendMessage(this.activeTargetUserId, this.newMessageText);
      this.newMessageText = '';
      this.scrollToBottom();
    } catch (err) {
      console.error('Send failed', err);
    } finally {
      this.isSending = false;
    }
  }

  /** Utility: scroll to bottom of chat */
  private scrollToBottom() {
    if (this.scrollContainer) {
      this.scrollContainer.nativeElement.scrollTop =
        this.scrollContainer.nativeElement.scrollHeight;
    }
  }
}
