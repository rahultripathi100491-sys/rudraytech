import { RouterModule, Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { NgModule } from '@angular/core';
import { Friendsuggation } from './friendsuggation/friendsuggation';

export const routes: Routes = [
    { path: 'login', loadComponent: () => import('./auth/login/login').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./auth/register/register').then(m => m.RegisterComponent) },
  { path: 'post', loadComponent: () => import('./post/post').then(m => m.Post), canActivate: [authGuard] },
  { path: 'messages', loadComponent: () => import('./chat-window/chat-window').then(m => m.ChatWindowComponent), canActivate: [authGuard] },
  { path: 'friends', loadComponent: () => import('./friendsuggation/friendsuggation').then(m=> m.Friendsuggation), canActivate: [authGuard] },
  { path: '', redirectTo: 'login', pathMatch: 'full' }, 
  { path: '**', redirectTo: 'login' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
