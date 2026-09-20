import { Routes } from '@angular/router';

export const routes: Routes = [
    {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },

  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login')
        .then(m => m.LoginComponent)
  },

  {
    path: 'register',
    loadComponent: () =>
      import('./auth/register/register')
        .then(m => m.RegisterComponent)
  },
    {
    path: 'chat',
    loadComponent: () =>
      import('./chat-window/chat-window').then((m) => m.ChatWindowComponent)
  },
  {
    path: 'chat/:id',
    loadComponent: () =>
      import('./chat-window/chat-window').then((m) => m.ChatWindowComponent)
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
