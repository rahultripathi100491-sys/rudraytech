import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SignalRService } from './services/signalr.service';
import { Header } from './header/header';
import { Footer } from './footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('ChatApplication.Web');
  private signalRService = inject(SignalRService);

  ngOnInit(): void {
    const token = localStorage.getItem('token') || '';
    if (token) {
      this.signalRService.startConnection(token);
    }
  }
}
