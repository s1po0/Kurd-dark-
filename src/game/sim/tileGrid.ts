// Tile grid stored in typed arrays (no objects per tile).
export const Terrain = {
  Grass: 0,
  FertileGrass: 1,
  Forest: 2,
  Rock: 3,
  Iron: 4,
  Marsh: 5,
  ShallowWater: 6,
  DeepWater: 7,
  Hill: 8,
} as const;

export type Terrain = (typeof Terrain)[keyof typeof Terrain];

export interface TileGrid {
  readonly width: number;
  readonly height: number;
  readonly terrain: Uint8Array;
}

export function createTileGrid(width: number, height: number, fill: Terrain = Terrain.Grass): TileGrid {
  return { width, height, terrain: new Uint8Array(width * height).fill(fill) };
}

export function inBounds(grid: TileGrid, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < grid.width && y < grid.height;
}

export function terrainAt(grid: TileGrid, x: number, y: number): Terrain {
  return (grid.terrain[y * grid.width + x] ?? Terrain.DeepWater) as Terrain;
}
