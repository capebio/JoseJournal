import { createHmac, createPublicKey, verify as cryptoVerify, timingSafeEqual } from 'crypto';

/**
 * Minimal JWT verification supporting the two paths JOSE needs:
 *  - HS256 dev tokens (AUTH_DEV_MODE) so e2e/local runs work without Keycloak;
 *  - RS256 Keycloak tokens (live), public key supplied by jwks-rsa.
 * Deliberately small and dependency-light; not a general JOSE/JWS library.
 */
export interface JwtClaims {
  sub: string;
  iss?: string;
  exp?: number;
  iat?: number;
  // JOSE dev/extension claims:
  accountId?: string;
  assurance?: 'unverified' | 'verified' | 'certified';
  roles?: string[];
  orcid?: string;
  name?: string;
  preferred_username?: string;
  realm_access?: { roles?: string[] };
  [k: string]: unknown;
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function decodeJwt(token: string): { header: any; claims: JwtClaims; signingInput: string; signature: Buffer } {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('malformed JWT');
  const header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
  const claims = JSON.parse(b64urlDecode(parts[1]).toString('utf8')) as JwtClaims;
  return { header, claims, signingInput: `${parts[0]}.${parts[1]}`, signature: b64urlDecode(parts[2]) };
}

export function verifyHs256(token: string, secret: string): JwtClaims {
  const { header, claims, signingInput, signature } = decodeJwt(token);
  if (header.alg !== 'HS256') throw new Error(`expected HS256, got ${header.alg}`);
  const expected = createHmac('sha256', secret).update(signingInput).digest();
  if (expected.length !== signature.length || !timingSafeEqual(expected, signature)) {
    throw new Error('bad HS256 signature');
  }
  assertNotExpired(claims);
  return claims;
}

export function verifyRs256(token: string, pem: string): JwtClaims {
  const { header, claims, signingInput, signature } = decodeJwt(token);
  if (header.alg !== 'RS256') throw new Error(`expected RS256, got ${header.alg}`);
  const key = createPublicKey(pem);
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(signingInput), key, signature);
  if (!ok) throw new Error('bad RS256 signature');
  assertNotExpired(claims);
  return claims;
}

function assertNotExpired(claims: JwtClaims): void {
  if (typeof claims.exp === 'number' && Date.now() / 1000 > claims.exp) {
    throw new Error('token expired');
  }
}

/** Mint an HS256 dev token (used by e2e helpers and the dev login endpoint). */
export function signHs256(claims: JwtClaims, secret: string, ttlSeconds = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { iat: now, exp: now + ttlSeconds, ...claims };
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const signingInput = `${enc(header)}.${enc(body)}`;
  const sig = createHmac('sha256', secret).update(signingInput).digest('base64url');
  return `${signingInput}.${sig}`;
}
