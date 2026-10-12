import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/sim/rng';
import { buildTestMap } from '../src/game/data/testMap';
import { Terrain, createTileGrid, inBounds, terrainAt } from '../src/game/sim/tileGrid';

describe('seeded rng', () => {
  it('gives the same sequence for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 50 }, () => a.next());
    const seqB = Array.from({ length: 50 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('stays in [0, 1) and differs across seeds', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('int() is inclusive of both ends', () => {
    const r = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(2, 4));
    expect([...seen].sort()).toEqual([2, 3, 4]);
  });
});

describe('tile grid', () => {
  it('stores terrain in a typed array and bounds-checks', () => {
    const g = createTileGrid(4, 3, Terrain.Rock);
    expect(g.terrain).toBeInstanceOf(Uint8Array);
    expect(g.terrain.length).toBe(12);
    expect(terrainAt(g, 3, 2)).toBe(Terrain.Rock);
    expect(inBounds(g, 4, 0)).toBe(false);
    expect(inBounds(g, 0, 2)).toBe(true);
  });
});

describe('test map', () => {
  it('is deterministic for a seed and 96x96', () => {
    const a = buildTestMap(123);
    const b = buildTestMap(123);
    expect(a.width).toBe(96);
    expect(a.height).toBe(96);
    expect(Array.from(a.terrain)).toEqual(Array.from(b.terrain));
  });
});
