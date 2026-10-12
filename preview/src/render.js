// -----------------------------------------------------------------------------
//  Kurd Castle — browser preview
//  File: render.js
//  Purpose: Isometric renderer on a 2D canvas (no assets, everything drawn from
//           the simulation). Terrain is baked once into an offscreen canvas;
//           buildings are cached as per-type sprites; units and projectiles are
//           drawn straight from the sim each frame.
// -----------------------------------------------------------------------------

import { TERRAIN } from './map.js';
import { TEAM, STATE } from './sim.js';

export const TILE_W = 44;
export const TILE_H = 22;
export const HEIGHT_PX = 13;

// Stronghold-style palette: bright, sunlit meadow greens, warm earth tracks,
// honey sand and cool stone. Original colours — nothing is sampled from a
// commercial game.
const TERRAIN_COLOR = {
  [TERRAIN.WATER]: [58, 128, 168],
  [TERRAIN.GRASS]: [122, 170, 74],
  [TERRAIN.ROUGH]: [154, 146, 100],
  [TERRAIN.DIRT]: [166, 124, 78],
  [TERRAIN.SAND]: [212, 192, 130],
  [TERRAIN.ROCK]: [164, 158, 144],
  [TERRAIN.IRON]: [128, 120, 128],
  [TERRAIN.FERTILE]: [156, 178, 78],
};

const SKY_TOP = '#7fb4df';
const SKY_HORIZON = '#eadfb4';

function shade(rgb, factor) {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] * factor)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] * factor)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] * factor)));
  return `rgb(${r},${g},${b})`;
}

function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffff) / 65536;
}

// =============================================================================
//  Camera
// =============================================================================
export class Camera2 {
  constructor(world) {
    this.x = world.playerStart.x;
    this.y = world.playerStart.y;
    this.zoom = 1;
    this.minZoom = 0.45;
    this.maxZoom = 3.2;
    this.angle = 0;
    this.followX = null;
    this.followY = null;
  }
  clampTo(world) {
    this.x = Math.max(-6, Math.min(world.map.width + 6, this.x));
    this.y = Math.max(-6, Math.min(world.map.height + 6, this.y));
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
  }
  panBy(worldDx, worldDy) { this.x += worldDx; this.y += worldDy; }
  zoomBy(factor) { this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor)); }
  focus(x, y, instant = false) { this.focusX = x; this.focusY = y; this.instant = instant; }
}

export class IsoView {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = world;
    this.camera = new Camera2(world);
    this.viewWidth = canvas.clientWidth || 800;
    this.viewHeight = canvas.clientHeight || 600;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.terrainCanvas = null;
    this.terrainSignature = -1;
    this.signatureTimer = 0;
    this.buildingSprites = new Map();
    this.ghost = null;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.viewWidth = Math.max(320, Math.round(rect.width));
    this.viewHeight = Math.max(240, Math.round(rect.height));
    this.canvas.width = Math.round(this.viewWidth * this.dpr);
    this.canvas.height = Math.round(this.viewHeight * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get zoom() { return this.camera.zoom; }

  projectionBasis() {
    const zoom = this.camera.zoom;
    return {
      hw: (TILE_W / 2) * zoom,
      hh: (TILE_H / 2) * zoom,
      cx: (this.camera.x - this.camera.y) * (TILE_W / 2) * zoom,
      cy: (this.camera.x + this.camera.y) * (TILE_H / 2) * zoom,
      cos: Math.cos(this.camera.angle),
      sin: Math.sin(this.camera.angle),
      zoom,
    };
  }

  worldToScreen(wx, wy, z = 0) {
    const b = this.projectionBasis();
    const px = (wx - wy) * b.hw - b.cx;
    const py = (wx + wy) * b.hh - b.cy - z * HEIGHT_PX * b.zoom;
    return {
      x: px * b.cos - py * b.sin + this.viewWidth / 2,
      y: px * b.sin + py * b.cos + this.viewHeight / 2,
    };
  }

  screenToWorld(sx, sy) {
    const b = this.projectionBasis();
    const x = sx - this.viewWidth / 2;
    const y = sy - this.viewHeight / 2;
    const px = x * b.cos + y * b.sin + b.cx;
    const py = -x * b.sin + y * b.cos + b.cy;
    return { x: px / (2 * b.hw) + py / (2 * b.hh), y: py / (2 * b.hh) - px / (2 * b.hw) };
  }

  /** Visual height offset for a terrain cell, in world height units. */
  elevationAt(wx, wy) {
    const x = Math.floor(wx), y = Math.floor(wy);
    if (!this.world.map.inBounds(x, y)) return 0;
    return this.world.map.getElevation(x, y) * (3 / HEIGHT_PX);
  }

  screenToCell(sx, sy) {
    const w = this.screenToWorld(sx, sy);
    return { x: Math.floor(w.x), y: Math.floor(w.y) };
  }

  // ===========================================================================
  //  Terrain bake
  // ===========================================================================
  terrainChecksum() {
    const trees = this.world.map.trees;
    let sum = 0;
    for (let i = 0; i < trees.length; i += 7) sum = (sum * 31 + trees[i]) | 0;
    return sum;
  }

  bakeTerrain() {
    const world = this.world;
    const map = world.map;
    const w = (map.width + map.height) * (TILE_W / 2) + TILE_W;
    const h = (map.width + map.height) * (TILE_H / 2) + TILE_H * 4;
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w);
    canvas.height = Math.ceil(h);
    const ctx = canvas.getContext('2d');

    const toX = (x, y) => (x - y) * (TILE_W / 2) + (map.height * TILE_W) / 2;
    const toY = (x, y) => (x + y) * (TILE_H / 2) + 40;

    for (let sum = 0; sum <= map.width + map.height - 2; sum++) {
      for (let x = 0; x < map.width; x++) {
        const y = sum - x;
        if (y < 0 || y >= map.height) continue;
        const type = map.get(x, y);
        const base = TERRAIN_COLOR[type] || TERRAIN_COLOR[TERRAIN.GRASS];
        const variance = 0.9 + hash2(x, y) * 0.2;
        const elevation = map.getElevation(x, y);
        const cx = toX(x, y);
        const cy = toY(x, y) - elevation * 3;

        ctx.beginPath();
        ctx.moveTo(cx, cy - TILE_H / 2);
        ctx.lineTo(cx + TILE_W / 2, cy);
        ctx.lineTo(cx, cy + TILE_H / 2);
        ctx.lineTo(cx - TILE_W / 2, cy);
        ctx.closePath();
        ctx.fillStyle = shade(base, variance);
        ctx.fill();

        // Soft bevel so neighbouring tiles read as a sunlit meadow, not a checkerboard.
        ctx.strokeStyle = 'rgba(40,60,20,0.10)';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        if (type === TERRAIN.WATER) {
          ctx.fillStyle = 'rgba(150,215,240,0.14)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(220,245,255,0.35)';
          ctx.lineWidth = 1;
          const ry = cy + (hash2(x, y + 9) - 0.5) * TILE_H * 0.4;
          ctx.beginPath();
          ctx.moveTo(cx - 8, ry);
          ctx.quadraticCurveTo(cx, ry - 2.5, cx + 8, ry);
          ctx.stroke();
        }
        if (type === TERRAIN.GRASS || type === TERRAIN.FERTILE || type === TERRAIN.ROUGH) {
          // grass tufts and the odd wildflower
          const n = 3 + Math.floor(hash2(x + 3, y + 1) * 3);
          for (let i = 0; i < n; i++) {
            const tx = cx + (hash2(x * 17 + i, y) - 0.5) * TILE_W * 0.7;
            const ty = cy + (hash2(x, y * 17 + i) - 0.5) * TILE_H * 0.6;
            ctx.strokeStyle = i % 2 ? 'rgba(70,118,38,0.55)' : 'rgba(170,214,108,0.55)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx - 1.5, ty - 3);
            ctx.moveTo(tx, ty);
            ctx.lineTo(tx + 1.5, ty - 3.5);
            ctx.stroke();
          }
          if (type === TERRAIN.GRASS && hash2(x * 3, y * 3) > 0.9) {
            ctx.fillStyle = hash2(x, y) > 0.5 ? '#f4e9a8' : '#f2c4d0';
            ctx.beginPath();
            ctx.arc(cx + (hash2(y, x) - 0.5) * 16, cy + 2, 1.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (type === TERRAIN.ROCK || type === TERRAIN.IRON) {
          for (let i = 0; i < 3; i++) {
            const hx = hash2(x * 13 + i, y * 7 + i);
            const hy = hash2(x * 5 - i, y * 11 + i);
            const px = cx + (hx - 0.5) * TILE_W * 0.6;
            const py = cy + (hy - 0.5) * TILE_H * 0.6;
            ctx.fillStyle = 'rgba(70,64,56,0.35)';
            ctx.beginPath(); ctx.ellipse(px, py + 1, 2.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = type === TERRAIN.IRON ? 'rgba(180,150,120,0.55)' : 'rgba(235,230,218,0.5)';
            ctx.beginPath(); ctx.ellipse(px, py, 2.4, 1.4, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
        if (type === TERRAIN.FERTILE) {
          ctx.strokeStyle = 'rgba(60,80,20,0.35)';
          ctx.lineWidth = 1;
          for (let i = 0; i < 2; i++) {
            const off = (i - 0.5) * TILE_W * 0.28;
            ctx.beginPath();
            ctx.moveTo(cx + off - 6, cy + off * 0.5 + 3);
            ctx.lineTo(cx + off + 6, cy + off * 0.5 + 3);
            ctx.stroke();
          }
        }

        if (map.hasTree(x, y)) {
          const jitterX = (hash2(x, y * 3) - 0.5) * 8;
          const jitterY = (hash2(x * 3, y) - 0.5) * 4;
          const px = cx + jitterX;
          const py = cy + jitterY;
          ctx.fillStyle = 'rgba(20,30,15,0.28)';
          ctx.beginPath();
          ctx.ellipse(px + 2, py + 2, 7, 3.5, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#3c2a17';
          ctx.fillRect(px - 1.2, py - 6, 2.4, 8);
          ctx.fillStyle = hash2(x * 7, y * 5) > 0.5 ? '#2f5c2a' : '#376b2c';
          ctx.beginPath();
          ctx.moveTo(px, py - 26);
          ctx.lineTo(px + 8, py - 4);
          ctx.lineTo(px - 8, py - 4);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#417a33';
          ctx.beginPath();
          ctx.moveTo(px, py - 20);
          ctx.lineTo(px + 6, py - 6);
          ctx.lineTo(px - 6, py - 6);
          ctx.closePath();
          ctx.fill();
        }
      }
    }

    this.terrainCanvas = canvas;
    this.terrainOrigin = { x: (map.height * TILE_W) / 2, y: 40 };
    this.terrainSignature = this.terrainChecksum();
  }

  // ===========================================================================
  //  Building sprites (cached)
  // ===========================================================================
  buildingSprite(def, team) {
    const key = `${def.id}:${team}`;
    const cached = this.buildingSprites.get(key);
    if (cached) return cached;

    const w = def.fp[0], h = def.fp[1];
    const height = (def.height || 2) * HEIGHT_PX;
    const padX = TILE_W;
    const canvasW = Math.ceil((w + h) * (TILE_W / 2) + padX * 2);
    const canvasH = Math.ceil((w + h) * (TILE_H / 2) + height + TILE_H);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');

    // World→local projection: cell (0,0) center of the footprint is at the
    // middle of the canvas.
    const ox = canvasW / 2;
    const oy = canvasH - TILE_H - 6;
    const project = (x, y, z) => ({
      x: ox + (x - y) * (TILE_W / 2),
      y: oy + (x + y) * (TILE_H / 2) - z * HEIGHT_PX,
    });

    const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2;
    const ground = [project(x0, y0, 0), project(x1, y0, 0), project(x1, y1, 0), project(x0, y1, 0)];
    const top = [project(x0, y0, 1), project(x1, y0, 1), project(x1, y1, 1), project(x0, y1, 1)];

    // Player: warm limestone walls and terracotta roofs. Raiders: weathered
    // timber, dark hide and slate-brown roofs, so the two sides read at a glance.
    const palette = team === TEAM.PLAYER
      ? { top: 'rgba(226,214,184,0.98)', side: 'rgba(186,170,138,0.98)', roof: '#b4532e', rim: 'rgba(60,44,28,0.7)', mortar: 'rgba(96,78,54,0.28)' }
      : { top: 'rgba(160,122,88,0.98)', side: 'rgba(118,86,60,0.98)', roof: '#4f3026', rim: 'rgba(36,22,14,0.8)', mortar: 'rgba(48,30,18,0.3)' };

    if (def.isMoat) {
      ctx.fillStyle = 'rgba(38,72,110,0.92)';
      ctx.beginPath();
      ctx.moveTo(ground[0].x, ground[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(ground[i].x, ground[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(20,30,40,0.7)';
      ctx.stroke();
      const sprite = { canvas, ox, oy, height };
      this.buildingSprites.set(key, sprite);
      return sprite;
    }

    // 1. ground footprint (shadow + foundation)
    ctx.fillStyle = 'rgba(18,16,12,0.35)';
    ctx.beginPath();
    ctx.moveTo(ground[0].x, ground[0].y + 2);
    for (let i = 1; i < 4; i++) ctx.lineTo(ground[i].x, ground[i].y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade([134, 122, 98], 1);
    ctx.beginPath();
    ctx.moveTo(ground[0].x, ground[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(ground[i].x, ground[i].y);
    ctx.closePath();
    ctx.fill();

    // 2. two visible side faces (the edges that meet at the front corner)
    const front = ground[2];
    const frontLeft = ground[3];
    const frontRight = ground[1];
    const topFront = top[2];
    const topLeft = top[3];
    const topRight = top[1];

    ctx.fillStyle = palette.side;
    for (const [bl, br, tl, tr] of [[frontLeft, front, topLeft, topFront], [frontRight, front, topRight, topFront]]) {
      ctx.beginPath();
      ctx.moveTo(bl.x, bl.y);
      ctx.lineTo(br.x, br.y);
      ctx.lineTo(tr.x, tr.y);
      ctx.lineTo(tl.x, tl.y);
      ctx.closePath();
      ctx.fill();
      // Masonry courses clipped to the face: horizontal mortar lines.
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = palette.mortar;
      ctx.lineWidth = 1;
      const top = Math.min(tl.y, tr.y), bottom = Math.max(bl.y, br.y);
      ctx.beginPath();
      for (let yy = Math.floor(top / 4) * 4; yy <= bottom; yy += 4) {
        ctx.moveTo(bl.x - 2, yy + 0.5);
        ctx.lineTo(br.x + 2, yy + 0.5);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. top face
    ctx.fillStyle = palette.top;
    ctx.beginPath();
    ctx.moveTo(top[0].x, top[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(top[i].x, top[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = palette.rim;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 4. gable roof for domestic buildings
    if (def.roofline !== null && !def.isWall && !def.isTower && !def.isGate && !def.isKeep && !def.isStorage) {
      const ridgeZ = 1 + (def.roofHeight || 0.9);
      const alongX = w >= h;
      const a = alongX ? project(x0 - 0.15, 0, 1) : project(0, y0 - 0.15, 1);
      const b = alongX ? project(x1 + 0.15, 0, 1) : project(0, y1 + 0.15, 1);
      const r1 = alongX ? project(x0 - 0.15, 0, ridgeZ) : project(0, y0 - 0.15, ridgeZ);
      const r2 = alongX ? project(x1 + 0.15, 0, ridgeZ) : project(0, y1 + 0.15, ridgeZ);
      const frontA = alongX ? project(x0 - 0.15, h / 2, 1) : project(w / 2, y0 - 0.15, 1);
      const frontB = alongX ? project(x1 + 0.15, h / 2, 1) : project(w / 2, y1 + 0.15, 1);
      const rearA = alongX ? project(x0 - 0.15, -h / 2, 1) : project(-w / 2, y0 - 0.15, 1);
      const rearB = alongX ? project(x1 + 0.15, -h / 2, 1) : project(-w / 2, y1 + 0.15, 1);

      ctx.fillStyle = palette.roof;
      ctx.beginPath();
      ctx.moveTo(rearA.x, rearA.y); ctx.lineTo(rearB.x, rearB.y);
      ctx.lineTo(r2.x, r2.y); ctx.lineTo(r1.x, r1.y);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = team === TEAM.PLAYER ? 'rgb(205,104,62)' : 'rgb(96,60,46)';
      ctx.beginPath();
      ctx.moveTo(frontA.x, frontA.y); ctx.lineTo(frontB.x, frontB.y);
      ctx.lineTo(r2.x, r2.y); ctx.lineTo(r1.x, r1.y);
      ctx.closePath(); ctx.fill();

      // Roof tile rows on the sunlit slope.
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(frontA.x, frontA.y); ctx.lineTo(frontB.x, frontB.y);
      ctx.lineTo(r2.x, r2.y); ctx.lineTo(r1.x, r1.y);
      ctx.closePath(); ctx.clip();
      ctx.strokeStyle = 'rgba(90,30,14,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 1; k < 6; k++) {
        const t = k / 6;
        ctx.moveTo(frontA.x + (r1.x - frontA.x) * t - 2, frontA.y + (r1.y - frontA.y) * t);
        ctx.lineTo(frontB.x + (r2.x - frontB.x) * t + 2, frontB.y + (r2.y - frontB.y) * t);
      }
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = 'rgba(40,22,14,0.6)';
      ctx.stroke();
      void a; void b;
    }

    // 5. crenellations on walls and towers
    if (def.isWall || def.isTower || def.isGate || def.isKeep) {
      ctx.fillStyle = 'rgba(206,200,182,0.95)';
      const step = 0.5;
      for (let t = 0; t < w + h; t += step * 2) {
        const p = project(x0 + (t % (w + step * 2)) * 0.5 - w / 2 + w / 2, y0 + ((t * 0.7) % (h + step)) - h / 2, 1.05);
        ctx.fillRect(p.x - 2, p.y - 4, 4, 4);
      }
    }

    // 6. flag for keep and towers
    if (def.isKeep || def.isTower) {
      const base = project(0, 0, 1 + (def.height || 2) * 0.06 + 1.4);
      ctx.strokeStyle = '#3a3126';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x, base.y - 14);
      ctx.stroke();
      ctx.fillStyle = team === TEAM.PLAYER ? '#c8322c' : '#8a2a22';
      ctx.beginPath();
      ctx.moveTo(base.x, base.y - 14);
      ctx.lineTo(base.x + 12, base.y - 10);
      ctx.lineTo(base.x, base.y - 6);
      ctx.closePath();
      ctx.fill();
    }

    const sprite = { canvas, ox, oy, height };
    this.buildingSprites.set(key, sprite);
    return sprite;
  }

  // ===========================================================================
  //  Frame
  // ===========================================================================
  draw(dt) {
    const ctx = this.ctx;
    const world = this.world;
    const camera = this.camera;

    if (camera.focusX !== undefined && camera.focusX !== null) {
      camera.x = camera.focusX; camera.y = camera.focusY;
      camera.focusX = null; camera.focusY = null;
    }
    camera.clampTo(world);

    this.signatureTimer += dt;
    if (this.signatureTimer > 0.75) {
      this.signatureTimer = 0;
      if (this.terrainChecksum() !== this.terrainSignature) this.bakeTerrain();
    }

    const sky = ctx.createLinearGradient(0, 0, 0, this.viewHeight);
    sky.addColorStop(0, SKY_TOP);
    sky.addColorStop(0.55, SKY_HORIZON);
    sky.addColorStop(1, '#b9c98a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);

    // Terrain (baked once, transformed with the camera each frame)
    const basis = this.projectionBasis();
    const scale = basis.zoom;
    ctx.save();
    ctx.translate(this.viewWidth / 2, this.viewHeight / 2);
    ctx.rotate(camera.angle);
    ctx.translate(-basis.cx, -basis.cy);
    ctx.scale(scale, scale);
    ctx.translate(-this.terrainOrigin.x, -this.terrainOrigin.y);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.terrainCanvas, 0, 0);
    ctx.restore();

    // Placement ghost goes under buildings so the outline reads as ground decal.
    if (this.ghost) this.drawGhost(ctx, this.ghost, dt);

    // Buildings sorted back-to-front so overlaps resolve correctly.
    const buildings = world.buildings.slice().sort((a, b) => {
      const ca = world.rectCenter(a.rect), cb = world.rectCenter(b.rect);
      return (ca.x + ca.y) - (cb.x + cb.y);
    });
    for (const b of buildings) this.drawBuilding(ctx, b);

    // Units
    const units = world.units.filter((u) => u.alive && !u.garrisoned)
      .sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const u of units) this.drawUnit(ctx, u);

    // Projectiles
    for (const p of world.projectiles) this.drawProjectile(ctx, p);

    // Pings
    for (const p of world.pings) {
      const s = this.worldToScreen(p.x, p.y, 0);
      const t = 1 - p.life;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, (6 + t * 22) * scale, (3 + t * 11) * scale, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Impact / hit / miss markers
    for (const e of world.events) {
      if (e.type !== 'impact' && e.type !== 'miss' && e.type !== 'hit') continue;
      const s = this.worldToScreen(e.x, e.y, 0.5);
      if (e.type === 'hit') {
        ctx.fillStyle = 'rgba(255,240,200,0.75)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.4 * scale, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.strokeStyle = e.type === 'impact' ? '#f0b040' : '#d0d0d0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, e.type === 'impact' ? 9 * scale : 5 * scale, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (world.state === STATE.MENU || world.state === STATE.PAUSED ||
        world.state === STATE.VICTORY || world.state === STATE.DEFEAT) {
      ctx.fillStyle = 'rgba(10,12,10,0.45)';
      ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
    }
  }

  drawBuilding(ctx, b) {
    const def = b.def;
    const sprite = this.buildingSprite(def, b.team);
    const center = this.world.rectCenter(b.rect);
    const base = this.worldToScreen(center.x - 0.5, center.y - 0.5, this.elevationAt(center.x - 0.5, center.y - 0.5));
    const scale = this.camera.zoom;

    ctx.save();
    ctx.translate(base.x - (sprite.ox) * scale, base.y - (sprite.oy) * scale);
    ctx.scale(scale, scale);

    if (b.rubble) {
      ctx.globalAlpha = 0.5;
      ctx.drawImage(sprite.canvas, 0, 0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(60,50,40,0.75)';
      ctx.beginPath();
      ctx.ellipse(sprite.ox, sprite.oy, TILE_W * 0.4, TILE_H * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    if (b.site) {
      ctx.globalAlpha = 0.35 + 0.45 * Math.min(1, b.buildProgress);
      ctx.drawImage(sprite.canvas, 0, 0, sprite.canvas.width, sprite.canvas.height * Math.max(0.25, b.buildProgress));
      ctx.globalAlpha = 0.85;
      ctx.strokeStyle = '#e8c65a';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(4, 4, sprite.canvas.width - 8, sprite.canvas.height - 8);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    ctx.drawImage(sprite.canvas, 0, 0);
    if (b.flash > 0) {
      ctx.globalAlpha = b.flash * 0.5;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(sprite.canvas, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    if (b.team === TEAM.PLAYER && def.isGate) {
      ctx.fillStyle = b.gateOpen ? 'rgba(90,220,120,0.9)' : 'rgba(230,90,70,0.9)';
      ctx.beginPath();
      ctx.arc(sprite.ox, sprite.oy - 10, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Health bar when damaged, building site progress, or storage contents.
    const damaged = b.hp < b.maxHp - 0.5;
    if (damaged) {
      const s = this.worldToScreen(center.x - 0.5, center.y - 0.5,
        this.elevationAt(center.x - 0.5, center.y - 0.5) + (def.height || 2) + 0.6);
      const width = 34 * scale;
      ctx.fillStyle = 'rgba(12,10,8,0.75)';
      ctx.fillRect(s.x - width / 2, s.y - 3, width, 5);
      const pct = Math.max(0, b.hp / b.maxHp);
      ctx.fillStyle = pct > 0.55 ? '#5fd67a' : (pct > 0.25 ? '#e8c65a' : '#e04a3c');
      ctx.fillRect(s.x - width / 2 + 1, s.y - 2, (width - 2) * pct, 3);
    }
    if (b.stored.amount > 0 && b.stored.type) {
      const s = this.worldToScreen(center.x - 0.5, center.y - 0.5,
        this.elevationAt(center.x - 0.5, center.y - 0.5) + (def.height || 2) + 1.1);
      ctx.fillStyle = 'rgba(12,10,8,0.7)';
      ctx.fillRect(s.x - 11 * scale, s.y - 4 * scale, 22 * scale, 8 * scale);
      ctx.fillStyle = '#e8c65a';
      ctx.font = `${Math.round(8 * scale)}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(String(b.stored.amount), s.x, s.y + 2 * scale);
      ctx.textAlign = 'left';
    }
  }

  drawUnit(ctx, u) {
    const scale = this.camera.zoom;
    const bob = Math.sin(u.bob) * 1.1;
    const s = this.worldToScreen(u.x, u.y, this.elevationAt(u.x, u.y));
    const radius = (u.def.radius || 0.26) * TILE_W * 0.9;

    // Shadow
    ctx.fillStyle = 'rgba(12,16,10,0.35)';
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, radius * 1.1, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();

    if (u.garrisoned) return;

    if (u.selected) {
      ctx.strokeStyle = '#5fd67a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, radius * 1.5, radius * 0.75, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bodyY = s.y - 12 * scale + bob;
    const bodyR = Math.max(3, 5.2 * scale);
    const color = u.flash > 0 ? '#ffffff' : u.def.color;

    // Weapon
    ctx.strokeStyle = '#4a3d2c';
    ctx.lineWidth = Math.max(1, 1.8 * scale);
    const facing = ((u.facing || 0) * Math.PI) / 180;
    const wx = Math.sin(facing), wy = Math.cos(facing);
    if (u.def.role === 'ranged') {
      ctx.beginPath();
      ctx.arc(s.x + wx * 8 * scale, bodyY + wy * 3 * scale, 5 * scale, facing - 1.2, facing + 1.2);
      ctx.stroke();
    } else if (u.def.worker) {
      ctx.beginPath();
      ctx.moveTo(s.x + wx * 4 * scale, bodyY + wy * 3 * scale);
      ctx.lineTo(s.x + wx * 7 * scale, bodyY - 4 * scale);
      ctx.stroke();
    } else if (u.def.role === 'siege') {
      ctx.fillStyle = '#6b4f30';
      ctx.fillRect(s.x - 8 * scale, s.y - 8 * scale, 16 * scale, 8 * scale);
    } else {
      ctx.beginPath();
      ctx.moveTo(s.x + wx * 5 * scale, bodyY - 2 * scale);
      ctx.lineTo(s.x + wx * 6 * scale + 5 * scale, bodyY - 7 * scale);
      ctx.stroke();
    }

    // Body + head
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(s.x, bodyY, bodyR * 0.8, bodyR, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = u.team === TEAM.ENEMY ? '#e0bda6' : '#e6c9a8';
    ctx.beginPath();
    ctx.arc(s.x, bodyY - bodyR * 1.05, bodyR * 0.55, 0, Math.PI * 2);
    ctx.fill();

    if (u.team === TEAM.ENEMY) {
      ctx.strokeStyle = '#b03a2e';
      ctx.lineWidth = Math.max(1, 1.6 * scale);
      ctx.beginPath();
      ctx.moveTo(s.x - bodyR * 0.8, bodyY - bodyR * 0.4);
      ctx.lineTo(s.x + bodyR * 0.8, bodyY + bodyR * 0.2);
      ctx.stroke();
    }

    if (u.carryAmount > 0) {
      ctx.fillStyle = '#d8a84c';
      ctx.fillRect(s.x - 4 * scale, bodyY - 2 * scale, 8 * scale, 5 * scale);
    }

    if (u.hp < u.maxHp - 0.5) {
      const w = 16 * scale;
      ctx.fillStyle = 'rgba(10,10,8,0.8)';
      ctx.fillRect(s.x - w / 2, s.y - 22 * scale, w, 3);
      ctx.fillStyle = u.hp / u.maxHp > 0.5 ? '#5fd67a' : '#e04a3c';
      ctx.fillRect(s.x - w / 2, s.y - 22 * scale, w * Math.max(0, u.hp / u.maxHp), 3);
    }
  }

  drawProjectile(ctx, p) {
    const scale = this.camera.zoom;
    const s = this.worldToScreen(p.x, p.y, p.z);
    if (p.splash > 0) {
      ctx.fillStyle = '#6f6a60';
      ctx.beginPath();
      ctx.arc(s.x, s.y, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const dx = p.tx - p.sx, dy = p.ty - p.sy;
    const angle = Math.atan2((dx - dy) * (TILE_H / 2), (dx + dy) * (TILE_H / 2));
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(angle);
    ctx.strokeStyle = '#3f3524';
    ctx.lineWidth = Math.max(1, 1.6 * scale);
    ctx.beginPath();
    ctx.moveTo(-6 * scale, 0);
    ctx.lineTo(4 * scale, 0);
    ctx.stroke();
    ctx.fillStyle = '#d8d0c0';
    ctx.beginPath();
    ctx.moveTo(4 * scale, 0);
    ctx.lineTo(1 * scale, -2 * scale);
    ctx.lineTo(1 * scale, 2 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  drawGhost(ctx, ghost, dt) {
    const { def, cellX, cellY, valid, team } = ghost;
    const world = this.world;
    const rect = world.rectOf(def, cellX, cellY);
    const scale = this.camera.zoom;

    // Footprint decal
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const p = this.worldToScreen(x, y, this.elevationAt(x, y));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - TILE_H / 2 * scale);
        ctx.lineTo(p.x + TILE_W / 2 * scale, p.y);
        ctx.lineTo(p.x, p.y + TILE_H / 2 * scale);
        ctx.lineTo(p.x - TILE_W / 2 * scale, p.y);
        ctx.closePath();
        ctx.fillStyle = valid ? 'rgba(77,242,97,0.35)' : 'rgba(242,64,51,0.38)';
        ctx.fill();
        ctx.strokeStyle = valid ? 'rgba(120,255,150,0.8)' : 'rgba(255,120,110,0.85)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Translucent preview of the structure itself.
    const sprite = this.buildingSprite(def, team);
    const center = world.rectCenter(rect);
    const base = this.worldToScreen(center.x - 0.5, center.y - 0.5, this.elevationAt(center.x - 0.5, center.y - 0.5));
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(dt * 0.006 + performance.now() / 260) * 0.08;
    ctx.translate(base.x - sprite.ox * scale, base.y - sprite.oy * scale);
    ctx.scale(scale, scale);
    ctx.drawImage(sprite.canvas, 0, 0);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ===========================================================================
  //  Minimap (drawn into the small HUD canvas)
  // ===========================================================================
  drawMinimap(ctx, width, height) {
    const world = this.world;
    const map = world.map;
    const sx = width / map.width;
    const sy = height / map.height;

    ctx.clearRect(0, 0, width, height);
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const type = map.get(x, y);
        let color = '#3f6c33';
        if (type === TERRAIN.WATER) color = '#2f5f8c';
        else if (type === TERRAIN.ROCK) color = '#8d8a84';
        else if (type === TERRAIN.IRON) color = '#6f6a72';
        else if (type === TERRAIN.ROUGH) color = '#6b6a52';
        else if (type === TERRAIN.DIRT) color = '#7a6244';
        else if (type === TERRAIN.SAND) color = '#b9a978';
        else if (type === TERRAIN.FERTILE) color = '#7f8f3c';
        if (map.hasTree(x, y)) color = '#2f5c2a';
        ctx.fillStyle = color;
        ctx.fillRect(x * sx, y * sy, Math.ceil(sx), Math.ceil(sy));
      }
    }

    for (const b of world.buildings) {
      if (b.rubble) continue;
      ctx.fillStyle = b.team === TEAM.PLAYER
        ? (b.site ? 'rgba(230,200,90,0.85)' : 'rgba(226,226,226,0.95)')
        : 'rgba(200,60,50,0.95)';
      ctx.fillRect(b.rect.x * sx, b.rect.y * sy, Math.max(2, b.rect.w * sx), Math.max(2, b.rect.h * sy));
    }
    for (const u of world.units) {
      if (!u.alive || u.garrisoned) continue;
      ctx.fillStyle = u.team === TEAM.PLAYER ? (u.def.worker ? '#9fd08a' : '#ffffff') : '#e0554a';
      ctx.fillRect(u.x * sx - 1, u.y * sy - 1, 2.5, 2.5);
    }

    // Viewport rectangle
    const halfW = this.viewWidth / 2;
    const halfH = this.viewHeight / 2;
    const tl = this.screenToWorld(0, 0);
    const tr = this.screenToWorld(this.viewWidth, 0);
    const bl = this.screenToWorld(0, this.viewHeight);
    const br = this.screenToWorld(this.viewWidth, this.viewHeight);
    const minX = Math.min(tl.x, tr.x, bl.x, br.x);
    const maxX = Math.max(tl.x, tr.x, bl.x, br.x);
    const minY = Math.min(tl.y, tr.y, bl.y, br.y);
    const maxY = Math.max(tl.y, tr.y, bl.y, br.y);
    ctx.strokeStyle = 'rgba(240,235,220,0.85)';
    ctx.lineWidth = 1;
    ctx.strokeRect(minX * sx, minY * sy, (maxX - minX) * sx, (maxY - minY) * sy);
    void halfW; void halfH;
  }
}
