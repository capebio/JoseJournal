import { canonicalize } from './canonical';
import { computeVersionHash, sha256Hex } from './hash';
import { encodeQDS, qdsBounds, qdsPolygon } from './qds';
import type { KnowledgeObjectContent, VersionMeta } from './types';

describe('RFC 8785 JCS canonicalization', () => {
  it('is independent of key insertion order', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe(canonicalize({ a: 2, b: 1 }));
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
  it('sorts by UTF-16 code units and preserves array order', () => {
    expect(canonicalize({ Z: 1, a: 2, A: 3 })).toBe('{"A":3,"Z":1,"a":2}');
    expect(canonicalize([3, 1, 2])).toBe('[3,1,2]');
  });
  it('drops undefined members and rejects non-finite numbers', () => {
    expect(canonicalize({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(() => canonicalize({ a: Infinity })).toThrow();
  });
});

describe('content hashing', () => {
  const content: KnowledgeObjectContent = { title: 't', sections: [], claims: {} };
  const meta: VersionMeta = {
    ko: 'ko:1', parent: null, branch: 'main', authors: ['acct:b', 'acct:a'],
    status: 'raw', visibility: 'private', lenses: { language: 'en', depthVariants: ['surface'], register: 'academic' },
  };
  it('is deterministic and author-order-independent', () => {
    const h1 = computeVersionHash(content, meta);
    const h2 = computeVersionHash(content, { ...meta, authors: ['acct:a', 'acct:b'] });
    expect(h1.versionId).toBe(h2.versionId);
    expect(h1.versionId).toMatch(/^ver:sha256-[0-9a-f]{64}$/);
  });
  it('changes when status changes (status is part of identity)', () => {
    const h1 = computeVersionHash(content, meta);
    const h2 = computeVersionHash(content, { ...meta, status: 'vor' });
    expect(h1.versionId).not.toBe(h2.versionId);
  });
  it('sha256Hex matches a known vector', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('QDS grid (anti-poaching generalisation)', () => {
  it('encodes a southern/eastern point to a 4-digit + 2-letter code', () => {
    const code = encodeQDS(-33.9249, 18.4241);
    expect(code).toMatch(/^\d{4}[A-D]{2}$/);
    expect(code.startsWith('3318')).toBe(true);
  });
  it('rejects northern/western coordinates rather than under-generalising', () => {
    expect(() => encodeQDS(10, 18)).toThrow();
    expect(() => encodeQDS(-33, -18)).toThrow();
  });
  it('the precise point lies within its QDS cell bounds', () => {
    const code = encodeQDS(-33.9249, 18.4241);
    const b = qdsBounds(code);
    expect(-33.9249).toBeLessThanOrEqual(b.north);
    expect(-33.9249).toBeGreaterThanOrEqual(b.south);
    expect(18.4241).toBeGreaterThanOrEqual(b.west);
    expect(18.4241).toBeLessThanOrEqual(b.east);
    const poly = qdsPolygon(code);
    expect(poly.coordinates[0].length).toBe(5); // closed ring
  });
  it('a QDS cell is at most a quarter degree on each side', () => {
    const b = qdsBounds(encodeQDS(-33.9249, 18.4241));
    expect(b.north - b.south).toBeCloseTo(0.25, 6);
    expect(b.east - b.west).toBeCloseTo(0.25, 6);
  });
});
