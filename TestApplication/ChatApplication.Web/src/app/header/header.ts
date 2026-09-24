import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/auth.service';
import { RouterModule } from '@angular/router';

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
}
