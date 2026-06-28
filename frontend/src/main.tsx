import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './core/query/queryClient';
import { AuthProvider } from './core/auth/auth';
import App from './App';
import './styles/tokens.css';
import './styles/jose.css';

// Best-effort offline replication of public projections (no-op if Couch CORS is
// off). Deferred to idle and lazily importing PouchDB so first paint — including
// a read-only visitor on a slow connection — is never taxed by the offline layer.
const whenIdle = (cb: () => void) =>
  typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 4000 }) : setTimeout(cb, 2000);
whenIdle(() => {
  void import('./core/offline/offline-store').then((m) => m.startPublicReplication()).catch(() => {});
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
