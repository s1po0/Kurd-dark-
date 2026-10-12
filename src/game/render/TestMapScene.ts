import Phaser from 'phaser';
import { Terrain, type TileGrid } from '../sim/tileGrid';
import type { MapControls } from './GameCanvas';

export const TILE_PX = 32;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2;

// Original palette. Colours are chosen for readability on small screens.
const TERRAIN_HEX: Record<number, number> = {
  [Terrain.Grass]: 0x6f9a48,
  [Terrain.FertileGrass]: 0x8fae4e,
  [Terrain.Forest]: 0x2f5a2c,
  [Terrain.Rock]: 0x8c877c,
  [Terrain.Iron]: 0x6b6470,
  [Terrain.Marsh]: 0x4b6b4a,
  [Terrain.ShallowWater]: 0x3f7fb0,
  [Terrain.DeepWater]: 0x24517a,
  [Terrain.Hill]: 0x9b8f5a,
};

/**
 * M0 test map. The whole terrain is baked once into one Graphics object;
 * M1 replaces this with 16×16-tile chunk textures. Gestures: one finger or
 * mouse drag pans, two fingers pinch-zoom and pan together, the wheel zooms.
 */
export class TestMapScene extends Phaser.Scene {
  private lastSingle: { x: number; y: number } | null = null;
  private lastPinch: { dist: number; mx: number; my: number } | null = null;

  constructor() {
    super('TestMap');
  }

  create(): void {
    const grid = this.game.registry.get('tileGrid') as TileGrid;
    const worldW = grid.width * TILE_PX;
    const worldH = grid.height * TILE_PX;
    const cam = this.cameras.main;

    this.drawTerrain(grid);
    // Allow a little overscroll past the map edge.
    cam.setBounds(-TILE_PX * 4, -TILE_PX * 4, worldW + TILE_PX * 8, worldH + TILE_PX * 8);
    cam.setZoom(1);
    cam.centerOn(worldW / 2, worldH / 2);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.lastSingle = { x: p.x, y: p.y };
      this.lastPinch = null;
    });
    this.input.on('pointerup', () => {
      this.lastSingle = null;
      this.lastPinch = null;
    });
    this.input.on('wheel', (_p: unknown, _objs: unknown, _dx: number, dy: number) => {
      this.zoomBy(dy > 0 ? 0.9 : 1.1);
    });

    const controls: MapControls = {
      zoomBy: (factor) => {
        this.zoomBy(factor);
      },
      resetView: () => {
        cam.setZoom(1);
        cam.centerOn(worldW / 2, worldH / 2);
      },
    };
    this.game.registry.set('mapControls', controls);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.registry.remove('mapControls');
    });
  }

  override update(): void {
    const cam = this.cameras.main;
    const down = this.input.manager.pointers.filter((p) => p.isDown);

    if (down.length >= 2) {
      const a = down[0];
      const b = down[1];
      if (!a || !b) return;
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (this.lastPinch && this.lastPinch.dist > 0) {
        this.zoomBy(dist / this.lastPinch.dist);
        cam.scrollX -= (mx - this.lastPinch.mx) / cam.zoom;
        cam.scrollY -= (my - this.lastPinch.my) / cam.zoom;
      }
      this.lastPinch = { dist, mx, my };
      this.lastSingle = null;
      return;
    }

    if (down.length === 1) {
      const p = down[0];
      if (!p) return;
      if (this.lastSingle) {
        cam.scrollX -= (p.x - this.lastSingle.x) / cam.zoom;
        cam.scrollY -= (p.y - this.lastSingle.y) / cam.zoom;
      }
      this.lastSingle = { x: p.x, y: p.y };
      this.lastPinch = null;
    }
  }

  private zoomBy(factor: number): void {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM));
  }

  private drawTerrain(grid: TileGrid): void {
    const g = this.add.graphics();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const t = grid.terrain[y * grid.width + x] ?? Terrain.DeepWater;
        g.fillStyle(TERRAIN_HEX[t] ?? 0x000000, 1);
        g.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
      }
    }
    // Faint grid lines help judge scale while panning.
    g.lineStyle(1, 0x000000, 0.08);
    for (let i = 0; i <= grid.width; i++) g.lineBetween(i * TILE_PX, 0, i * TILE_PX, grid.height * TILE_PX);
    for (let j = 0; j <= grid.height; j++) g.lineBetween(0, j * TILE_PX, grid.width * TILE_PX, j * TILE_PX);
  }
}
