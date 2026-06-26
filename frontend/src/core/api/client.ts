/**
 * Typed fetch client against the NestJS trust boundary (IS §7). The bearer token
 * is held in memory + localStorage; precise data returned here is held in memory
 * only — never written to the offline store (Frontend Spec §2, AC 11.5).
 */
export const API_BASE = (import.meta.env.VITE_API_BASE as string) || 'http://localhost:3000';

const TOKEN_KEY = 'jose.token';
let token: string | null = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export function setToken(t: string | null): void {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage may be unavailable */
  }
}
export function getToken(): string | null {
  return token;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Suppress throwing on non-2xx; return the parsed body + status instead. */
  raw?: boolean;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(API_BASE + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });

  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!res.ok && !opts.raw) {
    const msg = (parsed as { message?: string })?.message ?? res.statusText;
    throw new ApiError(res.status, Array.isArray(msg) ? msg.join(', ') : String(msg), parsed);
  }
  return parsed as T;
}

/** Variant that returns status alongside the body (for 403/409 policy flows, AC 11.5/11.6). */
export async function apiStatus<T = unknown>(path: string, opts: ApiOptions = {}): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed as T };
}
