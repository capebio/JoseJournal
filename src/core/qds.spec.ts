import { qdsBounds, qdsCell } from './qds';

/**
 * SPEC-RECONCILED §8 conformance for the QDS locality primitive: the verified
 * vectors, four-hemisphere round-trips, and depth-parametric behaviour.
 */
describe('qdsCell — §8 hemisphere-aware QDS', () => {
  it('matches the verified vectors', () => {
    expect(qdsCell(-33.9249, 18.4241)).toBe('S33E018CD'); // Cape Town (S/E)
    expect(qdsCell(51.5074, -0.1278)).toBe('N51W000BD'); // London (N/W)
  });

  it('round-trips a known point into its own cell bounds in all four hemispheres', () => {
    const pts: Array<[string, number, number]> = [
      ['S/E Cape Town', -33.9249, 18.4241],
      ['N/W London', 51.5074, -0.1278],
      ['N/E Tokyo', 35.6762, 139.6503],
      ['S/W Buenos Aires', -34.6037, -58.3816],
    ];
    for (const [, lat, lon] of pts) {
      const b = qdsBounds(qdsCell(lat, lon));
      expect(lat).toBeGreaterThanOrEqual(b.south);
      expect(lat).toBeLessThanOrEqual(b.north);
      expect(lon).toBeGreaterThanOrEqual(b.west);
      expect(lon).toBeLessThanOrEqual(b.east);
    }
  });

  it('is depth-parametric and prefix-stable (more letters = finer)', () => {
    const lat = -33.9249;
    const lon = 18.4241;
    expect(qdsCell(lat, lon, 0)).toBe('S33E018'); // degree cell, no letters
    expect(qdsCell(lat, lon, 1)).toBe('S33E018C'); // half-degree
    expect(qdsCell(lat, lon, 2)).toBe('S33E018CD'); // QDS (public floor)
    const d3 = qdsCell(lat, lon, 3);
    expect(d3.startsWith('S33E018CD')).toBe(true);
    expect(d3).toHaveLength('S33E018'.length + 3);
  });

  it('the public depth-2 cell is exactly a quarter degree on each side', () => {
    const b = qdsBounds(qdsCell(-33.9249, 18.4241));
    expect(b.north - b.south).toBeCloseTo(0.25, 9);
    expect(b.east - b.west).toBeCloseTo(0.25, 9);
  });

  it('rejects non-finite and out-of-range coordinates', () => {
    expect(() => qdsCell(Infinity, 18)).toThrow();
    expect(() => qdsCell(-33, 200)).toThrow();
  });
});
