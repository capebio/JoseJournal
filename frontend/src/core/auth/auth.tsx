/**
 * Client auth. The real trust boundary is the server's Keycloak guard; in dev we
 * mint HS256 tokens via POST /auth/dev-login (the backend's dev path). The token
 * is decoded only to render the principal — never trusted for authority, which
 * always lives server-side (Frontend Spec §2).
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../api/client';
import { setToken, getToken } from '../api/client';
import type { Assurance, ActorRole, Principal } from '../api/types';

function decodePrincipal(token: string | null): Principal | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      sub: payload.sub,
      accountId: payload.accountId ?? payload.sub,
      assurance: (payload.assurance ?? 'unverified') as Assurance,
      roles: (payload.roles ?? []) as ActorRole[],
      orcid: payload.orcid ?? null,
    };
  } catch {
    return null;
  }
}

export interface DevLoginInput { sub: string; accountId?: string; assurance?: Assurance; roles?: ActorRole[]; orcid?: string; name?: string }

interface AuthCtx {
  principal: Principal | null;
  login: (input: DevLoginInput) => Promise<void>;
  logout: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [principal, setPrincipal] = useState<Principal | null>(() => decodePrincipal(getToken()));

  const login = useCallback(async (input: DevLoginInput) => {
    const { token } = await api<{ token: string }>('/auth/dev-login', { method: 'POST', body: input });
    setToken(token);
    setPrincipal(decodePrincipal(token));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setPrincipal(null);
  }, []);

  const value = useMemo(() => ({ principal, login, logout }), [principal, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}

/** Convenience presets matching the seeded actors / common roles. */
export const QUICK_LOGINS: DevLoginInput[] = [
  { sub: 'web-author', accountId: 'acct:botha', assurance: 'verified', roles: ['author', 'contributor'], name: 'R. Botha' },
  { sub: 'web-editor', accountId: 'acct:klak', assurance: 'certified', roles: ['editor', 'steward', 'reviewer'], name: 'A. Klak' },
  { sub: 'web-reviewer', accountId: 'acct:smith', assurance: 'verified', roles: ['reviewer'], name: 'J. Smith' },
  { sub: 'web-reader', accountId: 'acct:reader', assurance: 'unverified', roles: [], name: 'Guest reader' },
];
