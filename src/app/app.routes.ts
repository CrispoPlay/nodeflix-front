import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/auth/auth-page').then((m) => m.AuthPage)
  },
  {
    path: 'generos',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/genres/genre-page').then((m) => m.GenrePage)
  },
  {
    path: 'clips',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/clips/clips-page').then((m) => m.ClipsPage)
  },
  {
    path: 'caratulas',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/covers/covers-page').then((m) => m.CoversPage)
  },
  {
    path: 'browse',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/browse/browse-page').then((m) => m.BrowsePage)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
