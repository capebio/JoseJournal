/**
 * QDS — the locality primitive (SPEC-RECONCILED §8). A hemisphere-aware recursive
 * quad-tree, verified against Casabio's Southern-African convention. The QDS code
 * (~0.25°, depth 2, roughly 25 km) is the FINEST locality that may appear in a
 * public projection (§6); precise lat/lon lives only in the restricted store.
 *
 * Code form:  {S|N}{deg2}{E|W}{deg3}{letters}      e.g. "S33E018CD"
 *   Quadrants: A=NW  B=NE  C=SW  D=SE   (recursive, to any depth)
 *   Depth:     0 = degree cell · 1 = half-degree (1 letter) · 2 = QDS (2 letters) · n = n letters
 *
 * Verified vectors: Cape Town (−33.92, 18.42) → "S33E018CD"; London (51.50, −0.12) → "N51W000BD".
 *
 * Implement ONCE, server-side, identically to the client primitive.
 */

/** Public obfuscation cap (quarter-degree square). Public clients never see finer. */
export const QDS_PUBLIC_DEPTH = 2;

/**
 * Degree-label edge convention.
 *
 * // DECISION: D8 — for the N and W hemispheres, which 1° edge does the degree
 * number name? Default (and verified for S/E): floor(abs(deg)), i.e. the
 * equatorward / Greenwich-ward edge. This is what makes London → "N51W000BD".
 * The recursive quadrant letters (A/B/C/D) are NOT in question — only this edge.
 * Change this one function once Casabio confirms the canonical N/W convention.
 */
function degreeLabel(deg: number, width: number, posChar: string, negChar: string): string {
  const hemi = deg < 0 ? negChar : posChar;
  return hemi + String(Math.floor(Math.abs(deg))).padStart(width, '0');
}

/**
 * Encode a precise point to its QDS code at `depth` (default 2 = the public QDS).
 * Region-agnostic: works in all four hemispheres. `north = lat ≥ latMid`,
 * `east = lon ≥ lonMid` (true N/E regardless of sign); append A=NW B=NE C=SW D=SE
 * and recurse into the chosen sub-cell.
 */
export function qdsCell(lat: number, lon: number, depth: number = QDS_PUBLIC_DEPTH): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('qdsCell: lat/lon must be finite');
  }
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('qdsCell: lat/lon out of range');
  }
  const d = Math.floor(depth);
  if (d < 0) throw new Error('qdsCell: depth must be >= 0');

  // The signed 1° cell [floor(deg), floor(deg)+1).
  let latLo = Math.floor(lat);
  let lonLo = Math.floor(lon);
  let size = 1;
  let letters = '';
  for (let i = 0; i < d; i++) {
    size /= 2;
    const latMid = latLo + size;
    const lonMid = lonLo + size;
    const north = lat >= latMid;
    const east = lon >= lonMid;
    letters += north ? (east ? 'B' : 'A') : east ? 'D' : 'C';
    if (north) latLo = latMid;
    if (east) lonLo = lonMid;
  }
  return degreeLabel(lat, 2, 'N', 'S') + degreeLabel(lon, 3, 'E', 'W') + letters;
}

/**
 * Legacy alias — the public QDS (depth 2). Retained so existing call sites keep
 * working; new code should call qdsCell(lat, lon, depth) directly.
 */
export function encodeQDS(lat: number, lon: number): string {
  return qdsCell(lat, lon, QDS_PUBLIC_DEPTH);
}

const QDS_RE = /^([NS])(\d{2})([EW])(\d{3})([A-D]*)$/;

/** Bounding box of a QDS cell (any depth), as signed {south,north,west,east}. */
export function qdsBounds(code: string): { south: number; north: number; west: number; east: number } {
  const m = QDS_RE.exec(code);
  if (!m) throw new Error(`qdsBounds: malformed QDS code "${code}"`);
  const [, latHemi, latNum, lonHemi, lonNum, letters] = m;
  // Reconstruct the signed 1° base cell from the degree label (D8 edge convention).
  let latLo = latHemi === 'N' ? Number(latNum) : -(Number(latNum) + 1);
  let lonLo = lonHemi === 'E' ? Number(lonNum) : -(Number(lonNum) + 1);
  let size = 1;
  for (const L of letters) {
    size /= 2;
    if (L === 'A' || L === 'B') latLo += size; // north sub-cell
    if (L === 'B' || L === 'D') lonLo += size; // east sub-cell
  }
  return { south: latLo, north: latLo + size, west: lonLo, east: lonLo + size };
}

/** Closed GeoJSON-style polygon ring for the QDS cell (the only geometry made public). */
export function qdsPolygon(code: string): { type: 'Polygon'; coordinates: number[][][] } {
  const b = qdsBounds(code);
  // [lon, lat] pairs, closed ring.
  const ring: number[][] = [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
  return { type: 'Polygon', coordinates: [ring] };
}
