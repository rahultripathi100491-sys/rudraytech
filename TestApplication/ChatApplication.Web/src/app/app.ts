import { Component, signal, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { SignalRService } from './services/signalr.service';
import { Header } from './header/header';
import { Footer } from './footer/footer';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { OnlineUsersComponent } from './online-users/online-users';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, CommonModule, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private router = inject(Router);
  protected readonly title = signal('ChatApplication.Web');
  private signalRService = inject(SignalRService);
  public showHeader = true;

  // Pages where the header should NOT be displayed
  private readonly publicPages: string[] = [
    '/login',
    '/register',
    '/forgot-password',
    '/reset-password'
  ];

  constructor() {

    // Check initial route
    this.updateHeaderVisibility(this.router.url);

    // Check whenever route changes
    this.router.events
      .pipe(
        filter(
          event => event instanceof NavigationEnd
        )
      )
      .subscribe(
        (event: NavigationEnd) => {
          this.updateHeaderVisibility(
            event.urlAfterRedirects
          );
        }
      );
  }

  ngOnInit(): void {
    const token = localStorage.getItem('token') || '';
    if (token) {
      this.signalRService.startConnection(token);
    }
  }
  private updateHeaderVisibility(url: string): void {

    // Remove query string
    const cleanUrl = url.split('?')[0].split('#')[0];

    this.showHeader =
      !this.publicPages.includes(cleanUrl);
  }
}
