import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './core/query/queryClient';
import { AuthProvider } from './core/auth/auth';
import { startPublicReplication } from './core/offline/offline';
import App from './App';
import './styles/tokens.css';
import './styles/jose.css';

// Best-effort offline replication of public projections (no-op if Couch CORS is off).
startPublicReplication();

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
