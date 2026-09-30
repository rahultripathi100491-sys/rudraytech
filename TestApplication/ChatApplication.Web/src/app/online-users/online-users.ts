import {
  Component,
  OnInit,
  OnDestroy
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { PresenceService } from '../services/presence.service';
import { OnlineUser } from '../models/online-user';

@Component({
  selector: 'app-online-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './online-users.html',
  styleUrl: './online-users.css'
})
export class OnlineUsersComponent
  implements OnInit, OnDestroy {

  users: OnlineUser[] = [];

  private readonly destroy$ =
    new Subject<void>();

  constructor(
    private readonly presenceService: PresenceService
  ) {}

  async ngOnInit(): Promise<void> {

    this.presenceService.onlineUsers$
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.users = users;
      });

    // Demo user
    const userId =
      crypto.randomUUID();

    const userName =
      'User ' +
      Math.floor(Math.random() * 1000);

    await this.presenceService.start(
      userId,
      userName
    );
  }

  async ngOnDestroy(): Promise<void> {

    this.destroy$.next();
    this.destroy$.complete();

    await this.presenceService.stop();
  }
}
