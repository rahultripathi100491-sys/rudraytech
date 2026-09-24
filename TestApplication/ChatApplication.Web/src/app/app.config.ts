import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};

// Define explicit domain-to-backend mappings
const DOMAIN_MAP: Record<string, { baseUrl: string; hubUrl: string }> = {
  // Local Development
  'localhost': {
    baseUrl: 'https://localhost:7072/api',
    hubUrl: 'https://localhost:7072'
  },
  '127.0.0.1': {
    baseUrl: 'https://localhost:7072/api',
    hubUrl: 'https://localhost:7072'
  },

  // Live Frontend Domains
  'rudraytech.lovestoblog.com': {
    baseUrl: 'https://testapplication.somee.com/api',
    hubUrl: 'https://testapplication.somee.com'
  },
  'testapplication.somee.com': {
    baseUrl: 'https://testapplication.somee.com/api',
    hubUrl: 'https://testapplication.somee.com'
  }
};

// Fallback configuration if opened under an unmapped domain
const FALLBACK_CONFIG = {
  baseUrl: 'https://testapplication.somee.com/api',
  hubUrl: 'https://testapplication.somee.com'
};
// Detect active domain from browser runtime
const activeHostname = window.location.hostname.toLowerCase();

// Export base URLs for services
export const APP_CONFIG = DOMAIN_MAP[activeHostname] || FALLBACK_CONFIG;

export const BASE_URL = APP_CONFIG.baseUrl;
export const HUB_URL = APP_CONFIG.hubUrl;