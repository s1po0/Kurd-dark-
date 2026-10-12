// M0 test map: a deterministic patchwork of terrain so pan and zoom can be
// judged. Replaced by the seeded generator in M1.
import { createRng } from '../sim/rng';
import { createTileGrid, Terrain, type TileGrid } from '../sim/tileGrid';

export const TEST_MAP_SIZE = 96;
export const TEST_MAP_SEED = 20261012;

export function buildTestMap(seed: number = TEST_MAP_SEED): TileGrid {
  const grid = createTileGrid(TEST_MAP_SIZE, TEST_MAP_SIZE, Terrain.Grass);
  const rng = createRng(seed);
  const set = (x: number, y: number, t: Terrain): void => {
    if (x >= 0 && y >= 0 && x < grid.width && y < grid.height) {
      grid.terrain[y * grid.width + x] = t;
    }
  };
  // A lake, a forest belt, a rock outcrop and a fertile field, all seeded.
  const cx = Math.floor(TEST_MAP_SIZE * 0.3), cy = Math.floor(TEST_MAP_SIZE * 0.35);
  for (let y = 0; y < TEST_MAP_SIZE; y++) {
    for (let x = 0; x < TEST_MAP_SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d < 9) set(x, y, d < 6 ? Terrain.DeepWater : Terrain.ShallowWater);
      else if (x > 58 && x < 74 && y > 10 && y < 40 && rng.next() < 0.45) set(x, y, Terrain.Forest);
      else if (x > 70 && x < 84 && y > 60 && y < 80) set(x, y, Terrain.Rock);
      else if (x > 20 && x < 42 && y > 58 && y < 76) set(x, y, Terrain.FertileGrass);
      else if (x > 40 && x < 52 && y > 6 && y < 18 && rng.next() < 0.3) set(x, y, Terrain.Hill);
    }
  }
  return grid;
}
