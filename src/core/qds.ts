/**
 * Quarter-Degree Square (QDS / QDGC) grid — the southern-African standard used
 * across Casabio. A QDS code (~0.25°, roughly 25km) is the FINEST locality that
 * may ever appear in a public projection (§3.7, §6). Precise lat/lon lives only
 * in the restricted Postgres table.
 *
 * Code form, e.g. "2318CA":
 *   "23"  degrees latitude  (south, absolute)
 *   "18"  degrees longitude (east,  absolute)
 *   "C"   half-degree quadrant of the 1° cell   (A=NW B=NE C=SW D=SE)
 *   "A"   quarter-degree quadrant of that cell   (A=NW B=NE C=SW D=SE)
 *
 * v1 assumes the JOSE/Casabio working region: southern latitudes, eastern
 * longitudes (lat ≤ 0, lon ≥ 0). encodeQDS rejects anything else so a sign
 * mistake can never silently mis-place — or worse, under-generalise — a point.
 */

const QUAD = ['A', 'B', 'C', 'D'] as const; // index by (south?1:0)*2 + (east?1:0)

function quadrant(fracLat: number, fracLon: number, cell: number): { letter: string; subLat: number; subLon: number } {
  const half = cell / 2;
  const south = fracLat >= half; // larger |lat| = further south
  const east = fracLon >= half; // larger |lon| = further east
  const letter = QUAD[(south ? 2 : 0) + (east ? 1 : 0)];
  return {
    letter,
    subLat: fracLat - (south ? half : 0),
    subLon: fracLon - (east ? half : 0),
  };
}

export function encodeQDS(lat: number, lon: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('encodeQDS: lat/lon must be finite');
  }
  if (lat > 0 || lon < 0) {
    throw new Error('encodeQDS: v1 supports the southern/eastern region (lat<=0, lon>=0)');
  }
  const absLat = Math.abs(lat);
  const absLon = Math.abs(lon);
  const latDeg = Math.floor(absLat);
  const lonDeg = Math.floor(absLon);

  let fracLat = absLat - latDeg;
  let fracLon = absLon - lonDeg;

  const half = quadrant(fracLat, fracLon, 1.0);
  fracLat = half.subLat;
  fracLon = half.subLon;
  const quarter = quadrant(fracLat, fracLon, 0.5);

  const latStr = String(latDeg).padStart(2, '0');
  const lonStr = String(lonDeg).padStart(2, '0');
  return `${latStr}${lonStr}${half.letter}${quarter.letter}`;
}

/** Bounding box of a QDS cell, as {south,north,west,east} in signed degrees. */
export function qdsBounds(code: string): { south: number; north: number; west: number; east: number } {
  const m = /^(\d{2})(\d{2})([A-D])([A-D])$/.exec(code);
  if (!m) throw new Error(`qdsBounds: malformed QDS code "${code}"`);
  const latDeg = Number(m[1]);
  const lonDeg = Number(m[2]);
  const half = m[3];
  const quarter = m[4];

  let latOff = 0;
  let lonOff = 0;
  // half-degree quadrant within the 1° cell
  if (half === 'C' || half === 'D') latOff += 0.5; // south half
  if (half === 'B' || half === 'D') lonOff += 0.5; // east half
  // quarter-degree quadrant within the 0.5° cell
  if (quarter === 'C' || quarter === 'D') latOff += 0.25;
  if (quarter === 'B' || quarter === 'D') lonOff += 0.25;

  // absolute degrees; convert to signed (south negative, east positive)
  const absNorth = latDeg + latOff; // smaller |lat| edge
  const absSouth = latDeg + latOff + 0.25;
  const west = lonDeg + lonOff;
  const east = lonDeg + lonOff + 0.25;
  return { north: -absNorth, south: -absSouth, west, east };
}

/** Closed GeoJSON-style polygon ring for the QDS cell (the only geometry made public). */
export function qdsPolygon(code: string): { type: 'Polygon'; coordinates: number[][][] } {
  const b = qdsBounds(code);
  // [lon, lat] pairs, closed ring, counter-clockwise
  const ring: number[][] = [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
  return { type: 'Polygon', coordinates: [ring] };
}
