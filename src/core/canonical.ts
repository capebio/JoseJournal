/**
 * RFC 8785 — JSON Canonicalization Scheme (JCS).
 *
 * The versioning core (§5) hashes the canonical serialisation of a version's
 * content+meta to derive its immutable, content-addressed identity. The
 * serialisation MUST be deterministic across machines and runs, independent of
 * key insertion order — that is exactly what JCS guarantees.
 *
 * Implementation notes (faithful to RFC 8785):
 * - Object keys sorted by their UTF-16 code-unit sequence. JS default string
 *   comparison (and Array.prototype.sort with no comparator) compares by UTF-16
 *   code units, which is the required ordering.
 * - Strings/numbers serialised via the ECMAScript-conformant JSON.stringify,
 *   whose Number→String and String escaping match the JCS profile.
 * - No insignificant whitespace.
 * - `undefined` members are dropped (as JSON does); non-finite numbers are
 *   rejected — they have no canonical form and must never enter a hash.
 */
export function canonicalize(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';

  const t = typeof value;

  if (t === 'string') return JSON.stringify(value);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error('JCS: non-finite number has no canonical form');
    }
    return JSON.stringify(value);
  }
  if (t === 'bigint') {
    throw new Error('JCS: bigint is not representable in canonical JSON');
  }

  if (Array.isArray(value)) {
    return '[' + value.map((v) => serialize(v === undefined ? null : v)).join(',') + ']';
  }

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort(); // UTF-16 code-unit order
    const members: string[] = [];
    for (const k of keys) {
      const v = obj[k];
      if (v === undefined) continue; // JSON drops undefined members
      members.push(JSON.stringify(k) + ':' + serialize(v));
    }
    return '{' + members.join(',') + '}';
  }

  throw new Error(`JCS: unsupported value type "${t}"`);
}
