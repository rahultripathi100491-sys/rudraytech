import { Injectable } from '@angular/core';
import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState
} from '@microsoft/signalr';

import { BehaviorSubject } from 'rxjs';

import { OnlineUser } from '../models/online-user';

@Injectable({
  providedIn: 'root'
})
export class PresenceService {

  private readonly hubUrl =
    'https://localhost:7001/hubs/presence';

  private hubConnection!: HubConnection;

  private readonly onlineUsersSubject =
    new BehaviorSubject<OnlineUser[]>([]);

  public readonly onlineUsers$ =
    this.onlineUsersSubject.asObservable();

  async start(
    userId: string,
    userName: string
  ): Promise<void> {

    if (
      this.hubConnection &&
      this.hubConnection.state === HubConnectionState.Connected
    ) {
      return;
    }

    this.hubConnection =
      new HubConnectionBuilder()
        .withUrl(
          `${this.hubUrl}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`
        )
        .withAutomaticReconnect()
        .build();

    this.registerEvents();

    await this.hubConnection.start();

    await this.loadOnlineUsers();
  }

  private registerEvents(): void {

    this.hubConnection.on(
      'UserOnline',
      (user: OnlineUser) => {

        const users = this.onlineUsersSubject.value;

        const exists =
          users.some(x => x.userId === user.userId);

        if (!exists) {

          this.onlineUsersSubject.next([
            ...users,
            user
          ]);
        }
      }
    );

    this.hubConnection.on(
      'UserOffline',
      (user: OnlineUser) => {

        const users =
          this.onlineUsersSubject.value
            .filter(x => x.userId !== user.userId);

        this.onlineUsersSubject.next(users);
      }
    );
  }

  private async loadOnlineUsers(): Promise<void> {

    const users =
      await this.hubConnection.invoke<OnlineUser[]>(
        'GetOnlineUsers'
      );

    this.onlineUsersSubject.next(users);
  }

  async stop(): Promise<void> {

    if (!this.hubConnection) {
      return;
    }

    await this.hubConnection.stop();
  }
}
