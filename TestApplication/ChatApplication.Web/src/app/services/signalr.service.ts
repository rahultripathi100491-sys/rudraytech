import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SignalRService {
  private hubConnection!: signalR.HubConnection;
  public messageReceived$ = new Subject<{ senderUserId: string; message: string; sentAt: string }>();

  public startConnection(token: string): void {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl('https://localhost:7072/chatHub', {
        accessTokenFactory: () => token
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection
      .start()
      .then(() => console.log('SignalR Connection Started'))
      .catch(err => console.error('Error starting SignalR connection: ' + err));

    this.registerSignalRListeners();
  }

  private registerSignalRListeners(): void {
    this.hubConnection.on('ReceiveMessage', (data) => {
      this.messageReceived$.next(data);
    });
  }

  public sendMessage(receiverUserId: string, message: string): Promise<void> {
    return this.hubConnection.invoke('SendMessage', receiverUserId, message);
  }
}