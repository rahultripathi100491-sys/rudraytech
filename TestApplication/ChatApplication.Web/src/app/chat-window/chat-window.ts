import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../services/chat';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-window.html',
  styleUrls: ['./chat-window.css']
})
export class ChatWindowComponent implements OnInit {
  protected chatService = inject(ChatService);

  newMessage = '';
  targetUserId = 'target-user-guid'; // Replace with active selected user

  ngOnInit(): void {
    this.chatService.loadConversationHistory(this.targetUserId);
  }

  async send(): Promise<void> {
    if (!this.newMessage.trim()) return;

    await this.chatService.sendMessage(this.targetUserId, this.newMessage);
    this.newMessage = '';
  }
}