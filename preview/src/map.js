// -----------------------------------------------------------------------------
//  Kurd Castle — browser preview
//  File: map.js
//  Purpose: Deterministic value noise, terrain generation, the occupancy grid,
//           the navigation surfaces (ground / wall-bypass / clearance-2), A*
//           with a binary heap and the Dijkstra flow fields the horde walks on.
//           Mirrors World/MapGenerator.cs, World/MapGrid.cs, World/
//           NavigationGrid.cs, World/AStarPathfinder.cs and FlowFieldService.cs.
// -----------------------------------------------------------------------------

export const TERRAIN = {
  WATER: 0, GRASS: 1, ROUGH: 2, DIRT: 3, SAND: 4, ROCK: 5, IRON: 6, FERTILE: 7,
};

export const NAV = {
  GROUND: 0, BYPASS: 1, WIDE: 2,
  IMPASSABLE: 0,
  NORMAL: 10,
  CLIMB: 130,
  MOAT: 220,
  GATE: 18,
};

export class Rng {
  constructor(seed) { this.state = (seed | 0) === 0 ? 0x9e3779b9 : seed | 0; }
  nextUInt() {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x | 0;
    return x >>> 0;
  }
  value() { return (this.nextUInt() >>> 8) / 16777216; }
  range(min, max) { return min + this.value() * (max - min); }
  int(min, max) { return Math.floor(this.range(min, max)); }
  chance(p) { return this.value() < p; }
  pick(list) { return list[this.int(0, list.length)]; }
}

// ---------------------------------------------------------------- noise
function hash2(x, y, seed) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  h ^= h >>> 16;
  return (h & 0xffffff) / 16777216;
}

const smooth = (t) => t * t * (3 - 2 * t);

export function valueNoise(x, y, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const v00 = hash2(x0, y0, seed), v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed), v11 = hash2(x0 + 1, y0 + 1, seed);
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

export function fbm(x, y, seed, octaves = 4, lacunarity = 2, gain = 0.5) {
  let sum = 0, amp = 1, norm = 0, fx = x, fy = y;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(fx, fy, seed + i * 7919) * amp;
    norm += amp;
    amp *= gain; fx *= lacunarity; fy *= lacunarity;
  }
  return sum / norm;
}

// ---------------------------------------------------------------- terrain
export class TerrainMap {
  constructor(width, height) {
    this.width = width; this.height = height;
    const n = width * height;
    this.cells = new Uint8Array(n);
    this.elevation = new Uint8Array(n);
    this.trees = new Uint8Array(n);
    this.harvest = new Uint8Array(n);
  }
  index(x, y) { return y * this.width + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
  get(x, y) { return this.inBounds(x, y) ? this.cells[this.index(x, y)] : TERRAIN.ROCK; }
  set(x, y, type, elevation = 0) {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);
    this.cells[i] = type; this.elevation[i] = elevation;
  }
  getElevation(x, y) { return this.inBounds(x, y) ? this.elevation[this.index(x, y)] : 4; }
  hasTree(x, y) { return this.inBounds(x, y) && this.trees[this.index(x, y)] === 1; }
  setTree(x, y, present) {
    if (!this.inBounds(x, y)) return;
    this.trees[this.index(x, y)] = present ? 1 : 0;
  }
  hasDeposit(x, y, resource) {
    switch (resource) {
      case 'wood': return this.hasTree(x, y);
      case 'stone': return this.get(x, y) === TERRAIN.ROCK;
      case 'iron': return this.get(x, y) === TERRAIN.IRON;
      case 'food': return this.get(x, y) === TERRAIN.FERTILE;
      default: return false;
    }
  }
  consumeHarvest(x, y) {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);
    if (this.harvest[i] > 0) this.harvest[i]--;
    if (this.harvest[i] > 0) return;
    if (this.trees[i]) { this.trees[i] = 0; return; }
    if (this.cells[i] === TERRAIN.ROCK) this.cells[i] = TERRAIN.ROUGH;
    else if (this.cells[i] === TERRAIN.IRON) this.cells[i] = TERRAIN.ROCK;
  }
  isWalkableTerrain(x, y) {
    const t = this.get(x, y);
    return t !== TERRAIN.WATER && t !== TERRAIN.ROCK && t !== TERRAIN.IRON;
  }
  findNearestDeposit(fromX, fromY, resource, radius) {
    let best = null, bestD = Infinity;
    for (let y = Math.max(0, fromY - radius); y <= Math.min(this.height - 1, fromY + radius); y++) {
      for (let x = Math.max(0, fromX - radius); x <= Math.min(this.width - 1, fromX + radius); x++) {
        if (!this.hasDeposit(x, y, resource)) continue;
        const d = (x - fromX) ** 2 + (y - fromY) ** 2;
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    }
    return bestD <= radius * radius ? best : null;
  }
  hasTerrainWithin(cx, cy, w, h, type) {
    for (let y = cy; y < cy + h; y++)
      for (let x = cx; x < cx + w; x++)
        if (this.get(x, y) === type) return true;
    return false;
  }
  hasTreeWithin(cx, cy, w, h, pad = 1) {
    for (let y = cy - pad; y < cy + h + pad; y++)
      for (let x = cx - pad; x < cx + w + pad; x++)
        if (this.hasTree(x, y)) return true;
    return false;
  }
}

export function generateMap(seed, width, height) {
  const map = new TerrainMap(width, height);
  const playerStart = { x: Math.round(width * 0.2), y: Math.round(height * 0.2) };
  const enemyCamp = { x: Math.round(width * 0.8), y: Math.round(height * 0.8) };
  const heights = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width, ny = y / height;
      const base = fbm(nx * 3.4, ny * 3.4, seed, 5, 2.1, 0.52);
      const dx = nx - 0.5, dy = ny - 0.5;
      const mask = Math.max(0, 1 - Math.pow(Math.sqrt(dx * dx + dy * dy) * 2, 1.35));
      const swBias = 0.06 * (1 - (nx + ny) * 0.5);
      heights[y * width + x] = Math.min(1, Math.max(0, base * (0.72 + 0.42 * mask) + swBias));
    }
  }

  // Normalise the field across its 2nd..98th percentile. Without this some
  // seeds never reach the rock threshold and the map has no stone at all,
  // which would make half the build menu unusable.
  const sorted = Float32Array.from(heights).sort();
  const lo = sorted[Math.floor(sorted.length * 0.02)];
  const hi = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.98))];
  const span = Math.max(1e-4, hi - lo);
  for (let i = 0; i < heights.length; i++) {
    heights[i] = Math.min(1, Math.max(0, (heights[i] - lo) / span));
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const h = heights[y * width + x];
      if (h < 0.315) { map.set(x, y, TERRAIN.WATER, 0); continue; }
      const elevation = Math.min(4, Math.floor((h - 0.315) * 6));
      if (h > 0.735) map.set(x, y, TERRAIN.ROCK, elevation);
      else if (elevation >= 3) map.set(x, y, TERRAIN.ROUGH, elevation);
      else map.set(x, y, TERRAIN.GRASS, elevation);
    }
  }

  // Iron veins inside the mountains.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (map.get(x, y) !== TERRAIN.ROCK) continue;
      if (fbm(x * 0.09, y * 0.09, seed ^ 0x5a17, 3, 2, 0.5) > 0.66) map.set(x, y, TERRAIN.IRON, map.getElevation(x, y));
    }
  }

  // Forests.
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const t = map.get(x, y);
      if (t === TERRAIN.WATER || t === TERRAIN.ROCK || t === TERRAIN.IRON) continue;
      const f = fbm(x * 0.11, y * 0.11, seed ^ 0x1f0f, 4, 2.3, 0.55);
      const bonus = map.getElevation(x, y) === 0 ? 0.05 : 0;
      if (f + bonus > 0.6) { map.setTree(x, y, true); map.harvest[map.index(x, y)] = 3; }
    }
  }

  // Fertile floodplain beside water.
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      if (map.get(x, y) !== TERRAIN.GRASS) continue;
      let water = false;
      for (let dy = -2; dy <= 2 && !water; dy++)
        for (let dx = -2; dx <= 2 && !water; dx++)
          if (map.get(x + dx, y + dy) === TERRAIN.WATER) water = true;
      if (!water) continue;
      if (valueNoise(x * 0.06, y * 0.06, seed ^ 0x30d9) > 0.35) map.set(x, y, TERRAIN.FERTILE, map.getElevation(x, y));
    }
  }

  const flatten = (center, radius, ground) => {
    const elevation = map.getElevation(center.x, center.y);
    for (let y = center.y - radius; y <= center.y + radius; y++) {
      for (let x = center.x - radius; x <= center.x + radius; x++) {
        if (!map.inBounds(x, y)) continue;
        const d = Math.hypot(x - center.x, y - center.y);
        if (d > radius) continue;
        map.set(x, y, d > radius - 1.5 ? TERRAIN.ROUGH : ground, elevation);
        map.setTree(x, y, false);
      }
    }
  };
  flatten(playerStart, 9, TERRAIN.GRASS);
  flatten(enemyCamp, 8, TERRAIN.DIRT);

  // Guaranteed road between the two armies, with fords where it crosses water.
  const carveRoad = (a, b) => {
    let x = a.x, y = a.y;
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
    let err = dx - dy;
    for (let guard = 0; guard < 4096; guard++) {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = x + ox, cy = y + oy;
          if (!map.inBounds(cx, cy)) continue;
          map.setTree(cx, cy, false);
          if (map.get(cx, cy) === TERRAIN.WATER) map.set(cx, cy, TERRAIN.SAND, 0);
          else if (ox === 0 && oy === 0) map.set(cx, cy, TERRAIN.DIRT, map.getElevation(cx, cy));
        }
      }
      if (x === b.x && y === b.y) break;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  };
  carveRoad(playerStart, enemyCamp);

  // Starter woodlots so the opening never dead-ends on a bad seed.
  const rng = new Rng(seed ^ 0x7e57);
  // Keep the castle clearing and the raider camp clear: planting a tree on the
  // keep footprint would make the opening build order impossible.
  const reserved = (x, y) =>
    (Math.max(Math.abs(x - playerStart.x), Math.abs(y - playerStart.y)) < 8) ||
    (Math.max(Math.abs(x - enemyCamp.x), Math.abs(y - enemyCamp.y)) < 7);
  const ensureForest = (center, radius, target) => {
    let existing = 0;
    for (let y = center.y - radius; y <= center.y + radius; y++)
      for (let x = center.x - radius; x <= center.x + radius; x++)
        if (map.hasTree(x, y)) existing++;
    if (existing >= target) return;
    let planted = 0, attempts = 0;
    while (existing + planted < target && attempts < 3000) {
      attempts++;
      const bx = rng.int(center.x - radius, center.x + radius);
      const by = rng.int(center.y - radius, center.y + radius);
      if (!map.isWalkableTerrain(bx, by) || reserved(bx, by)) continue;
      for (let i = 0; i < rng.int(3, 8); i++) {
        const tx = bx + rng.int(-2, 3), ty = by + rng.int(-2, 3);
        if (!map.isWalkableTerrain(tx, ty) || map.hasTree(tx, ty) || reserved(tx, ty)) continue;
        map.setTree(tx, ty, true);
        map.harvest[map.index(tx, ty)] = 3;
        planted++;
      }
    }
  };
  ensureForest(playerStart, 14, 90);
  ensureForest(enemyCamp, 14, 60);

  return { map, playerStart, enemyCamp, seed, width, height };
}

// ---------------------------------------------------------------- occupancy
export class OccupancyGrid {
  constructor(map) {
    this.map = map;
    this.width = map.width; this.height = map.height;
    const n = this.width * this.height;
    this.owner = new Int32Array(n).fill(-1);
    this.navGround = new Uint8Array(n);
    this.navBypass = new Uint8Array(n);
    this.version = 0;
  }
  index(x, y) { return y * this.width + x; }
  occupant(x, y) { return this.map.inBounds(x, y) ? this.owner[this.index(x, y)] : -1; }
  isOccupied(x, y) { return this.occupant(x, y) >= 0; }
  occupy(rect, handle, ground, bypass) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!this.map.inBounds(x, y)) continue;
        const i = this.index(x, y);
        this.owner[i] = handle;
        this.navGround[i] = ground;
        this.navBypass[i] = bypass;
        this.map.setTree(x, y, false);
      }
    }
    this.version++;
  }
  release(rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!this.map.inBounds(x, y)) continue;
        const i = this.index(x, y);
        this.owner[i] = -1;
        this.navGround[i] = 0;
        this.navBypass[i] = 0;
      }
    }
    this.version++;
  }
  releaseNav(rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!this.map.inBounds(x, y)) continue;
        const i = this.index(x, y);
        this.navGround[i] = 0;
        this.navBypass[i] = 0;
      }
    }
    this.version++;
  }
  setGate(rect, open) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (!this.map.inBounds(x, y)) continue;
        const i = this.index(x, y);
        this.navGround[i] = open ? NAV.GATE : NAV.IMPASSABLE;
        this.navBypass[i] = open ? NAV.GATE : NAV.CLIMB;
      }
    }
    this.version++;
  }
}

export class NavGrid {
  constructor(grid) {
    this.grid = grid;
    this.width = grid.width; this.height = grid.height;
    this.surfaces = {};
    this.versions = {};
  }
  surface(profile) {
    const key = profile;
    if (this.versions[key] === this.grid.version && this.surfaces[key]) return this.surfaces[key];
    const cost = new Uint8Array(this.width * this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const i = y * this.width + x;
        let base;
        if (!this.grid.map.isWalkableTerrain(x, y)) base = NAV.IMPASSABLE;
        else {
          switch (this.grid.map.get(x, y)) {
            case TERRAIN.ROUGH: base = 12; break;
            case TERRAIN.SAND: base = 17; break;
            case TERRAIN.DIRT: base = 11; break;
            case TERRAIN.FERTILE: base = 13; break;
            default: base = NAV.NORMAL; break;
          }
        }
        if (base === NAV.IMPASSABLE) { cost[i] = NAV.IMPASSABLE; continue; }

        const navGround = this.grid.navGround[i];
        if (navGround === 0) cost[i] = base;
        else if (navGround === NAV.IMPASSABLE) cost[i] = profile === NAV.BYPASS ? this.grid.navBypass[i] : NAV.IMPASSABLE;
        else cost[i] = navGround;
      }
    }
    if (profile === NAV.WIDE) {
      const copy = cost.slice();
      for (let y = 1; y < this.height - 1; y++) {
        for (let x = 1; x < this.width - 1; x++) {
          const i = y * this.width + x;
          if (copy[i] === NAV.IMPASSABLE) { cost[i] = NAV.IMPASSABLE; continue; }
          if (copy[i - 1] === NAV.IMPASSABLE || copy[i + 1] === NAV.IMPASSABLE ||
              copy[i - this.width] === NAV.IMPASSABLE || copy[i + this.width] === NAV.IMPASSABLE) {
            cost[i] = NAV.IMPASSABLE;
          }
        }
      }
      for (let x = 0; x < this.width; x++) {
        cost[x] = NAV.IMPASSABLE;
        cost[(this.height - 1) * this.width + x] = NAV.IMPASSABLE;
      }
      for (let y = 0; y < this.height; y++) {
        cost[y * this.width] = NAV.IMPASSABLE;
        cost[y * this.width + this.width - 1] = NAV.IMPASSABLE;
      }
    }
    this.surfaces[key] = cost;
    this.versions[key] = this.grid.version;
    return cost;
  }
  cost(x, y, profile) {
    if (!this.grid.map.inBounds(x, y)) return NAV.IMPASSABLE;
    return this.surface(profile)[this.grid.map.index(x, y)];
  }
  walkable(x, y, profile) { return this.cost(x, y, profile) !== NAV.IMPASSABLE; }

  findWalkableNear(x, y, profile, radius) {
    if (this.walkable(x, y, profile)) return { x, y };
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.walkable(x + dx, y + dy, profile)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  }

  lineOfSight(ax, ay, bx, by, profile) {
    const cost = this.surface(profile);
    const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
    const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let err = dx - dy, x = ax, y = ay;
    for (let guard = 0; guard < 512; guard++) {
      if (!this.grid.map.inBounds(x, y)) return false;
      if (cost[this.grid.map.index(x, y)] === NAV.IMPASSABLE) return false;
      if (x === bx && y === by) return true;
      const e2 = err * 2;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return false;
  }
}

// ---------------------------------------------------------------- A*
export class MinHeap {
  constructor() { this.nodes = []; this.f = []; this.pos = new Map(); }
  get size() { return this.nodes.length; }
  clear() { this.nodes.length = 0; this.f.length = 0; this.pos.clear(); }
  pushOrUpdate(node, f) {
    const p = this.pos.get(node);
    if (p === undefined) {
      this.nodes.push(node); this.f.push(f);
      this.pos.set(node, this.nodes.length - 1);
      this.siftUp(this.nodes.length - 1);
    } else if (f < this.f[p]) {
      this.f[p] = f;
      this.siftUp(p);
    }
  }
  pop() {
    const root = this.nodes[0];
    const lastNode = this.nodes.pop();
    const lastF = this.f.pop();
    this.pos.delete(root);
    if (this.nodes.length > 0) {
      this.nodes[0] = lastNode; this.f[0] = lastF;
      this.pos.set(lastNode, 0);
      this.siftDown(0);
    }
    return root;
  }
  siftUp(i) {
    const node = this.nodes[i], f = this.f[i];
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.f[parent] <= f) break;
      this.nodes[i] = this.nodes[parent]; this.f[i] = this.f[parent];
      this.pos.set(this.nodes[i], i);
      i = parent;
    }
    this.nodes[i] = node; this.f[i] = f; this.pos.set(node, i);
  }
  siftDown(i) {
    const node = this.nodes[i], f = this.f[i];
    const half = this.nodes.length >> 1;
    while (i < half) {
      let child = (i << 1) + 1;
      const right = child + 1;
      if (right < this.nodes.length && this.f[right] < this.f[child]) child = right;
      if (f <= this.f[child]) break;
      this.nodes[i] = this.nodes[child]; this.f[i] = this.f[child];
      this.pos.set(this.nodes[i], i);
      i = child;
    }
    this.nodes[i] = node; this.f[i] = f; this.pos.set(node, i);
  }
}

export class PathFinder {
  constructor(nav) {
    this.nav = nav;
    this.width = nav.width; this.height = nav.height;
    this.cells = this.width * this.height;
    this.gScore = new Int32Array(this.cells);
    this.cameFrom = new Int32Array(this.cells).fill(-1);
    this.stamp = new Int32Array(this.cells);
    this.closed = new Uint8Array(this.cells);
    this.searchStamp = 0;
    this.open = new MinHeap();
    this.lastExpanded = 0;
    this.lastResult = 0;
    this.totalSearches = 0;
  }

  heuristic(ax, ay, bx, by) {
    const dx = Math.abs(ax - bx), dy = Math.abs(ay - by);
    const diag = Math.min(dx, dy);
    return diag * 14 + (Math.max(dx, dy) - diag) * 10;
  }

  findPath(sx, sy, gx, gy, profile, allowPartial = true, budget = 9000) {
    const cost = this.nav.surface(profile);
    const map = this.nav.grid.map;
    const startW = this.nav.findWalkableNear(sx, sy, profile, 6);
    if (!startW) { this.lastResult = 0; return null; }
    const start = startW;

    const goalBlocked = !map.inBounds(gx, gy) || cost[map.index(gx, gy)] === NAV.IMPASSABLE;
    let goals = [];
    if (goalBlocked) {
      for (const [ox, oy] of [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]) {
        const c = this.nav.cost(gx + ox, gy + oy, profile);
        if (c !== NAV.IMPASSABLE) goals.push({ x: gx + ox, y: gy + oy });
      }
      if (goals.length === 0) {
        const snap = this.nav.findWalkableNear(gx, gy, profile, 5);
        if (snap) goals.push(snap);
      }
    } else {
      goals.push({ x: gx, y: gy });
    }
    if (goals.length === 0) { this.lastResult = 0; return null; }
    const goalSet = new Set(goals.map((g) => map.index(g.x, g.y)));

    this.searchStamp++;
    this.open.clear();
    const startIndex = map.index(start.x, start.y);
    this.stamp[startIndex] = this.searchStamp;
    this.gScore[startIndex] = 0;
    this.cameFrom[startIndex] = -1;
    this.closed[startIndex] = 0;
    this.open.pushOrUpdate(startIndex, 0);

    let found = false, bestNode = startIndex, bestH = Infinity, expanded = 0;
    const neighbours = [[0, 1, 10], [1, 1, 14], [1, 0, 10], [1, -1, 14], [0, -1, 10], [-1, -1, 14], [-1, 0, 10], [-1, 1, 14]];

    while (this.open.size > 0 && expanded < budget) {
      const current = this.open.pop();
      this.closed[current] = 1;
      expanded++;
      const cx = current % this.width, cy = (current / this.width) | 0;

      if (goalSet.has(current)) { found = true; bestNode = current; break; }

      const h = this.heuristicToNearest(cx, cy, goals);
      if (h < bestH) { bestH = h; bestNode = current; }

      const cg = this.gScore[current];
      for (const [ox, oy, base] of neighbours) {
        const nx = cx + ox, ny = cy + oy;
        if (!map.inBounds(nx, ny)) continue;
        const ni = map.index(nx, ny);
        const cellCost = cost[ni];
        if (cellCost === NAV.IMPASSABLE) continue;
        if (ox !== 0 && oy !== 0) {
          if (cost[map.index(cx + ox, cy)] === NAV.IMPASSABLE) continue;
          if (cost[map.index(cx, cy + oy)] === NAV.IMPASSABLE) continue;
        }
        if (this.stamp[ni] === this.searchStamp && this.closed[ni]) continue;
        const step = Math.max(1, Math.floor((base * cellCost) / NAV.NORMAL));
        const tentative = cg + step;
        if (this.stamp[ni] !== this.searchStamp) {
          this.stamp[ni] = this.searchStamp;
          this.closed[ni] = 0;
          this.cameFrom[ni] = current;
          this.gScore[ni] = tentative;
          this.open.pushOrUpdate(ni, tentative + this.heuristicToNearest(nx, ny, goals));
        } else if (tentative < this.gScore[ni]) {
          this.cameFrom[ni] = current;
          this.gScore[ni] = tentative;
          this.open.pushOrUpdate(ni, tentative + this.heuristicToNearest(nx, ny, goals));
        }
      }
    }

    if (!found && !allowPartial) { this.lastResult = 0; return null; }
    if (bestNode === startIndex) { this.lastResult = 0; return null; }

    const path = [];
    let node = bestNode;
    while (node !== -1 && node !== startIndex) {
      path.push({ x: node % this.width, y: (node / this.width) | 0 });
      node = this.cameFrom[node];
    }
    path.reverse();
    this.lastExpanded = expanded;
    this.lastResult = found ? 1 : 2;
    this.totalSearches++;
    return path.length ? path : null;
  }

  heuristicToNearest(x, y, goals) {
    let best = Infinity;
    for (const g of goals) best = Math.min(best, this.heuristic(x, y, g.x, g.y));
    return best;
  }

  /** String-pulling, identical in spirit to AStarPathfinder.Smooth(). */
  smooth(path, profile) {
    if (!path || path.length <= 2) return path;
    const out = [path[0]];
    let anchor = path[0];
    for (let i = 1; i < path.length; i++) {
      const isLast = i === path.length - 1;
      if (isLast || !this.nav.lineOfSight(anchor.x, anchor.y, path[i + 1].x, path[i + 1].y, profile)) {
        out.push(path[i]);
        anchor = path[i];
      }
    }
    return out;
  }
}

export class FlowField {
  constructor(nav) {
    this.nav = nav;
    this.width = nav.width; this.height = nav.height;
    this.cells = this.width * this.height;
    this.dist = new Int32Array(this.cells).fill(-1);
    this.stamp = new Int32Array(this.cells);
    this.open = new MinHeap();
    this.searchStamp = 0;
    this.complete = false;
    this.rebuildStarted = false;
    this.target = { x: -1, y: -1 };
    this.profile = 0;
  }

  startRebuild(target, profile) {
    this.target = { ...target };
    this.profile = profile;
    this.searchStamp++;
    this.complete = false;
    this.open.clear();
    this.dist.fill(-1);
    this.stamp.fill(0);
    const map = this.nav.grid.map;
    if (!map.inBounds(target.x, target.y)) { this.complete = true; return; }
    const i = map.index(target.x, target.y);
    this.dist[i] = 0;
    this.stamp[i] = this.searchStamp;
    this.open.pushOrUpdate(i, 0);
  }

  step(budget) {
    if (this.complete) return;
    const cost = this.nav.surface(this.profile);
    const map = this.nav.grid.map;
    const neighbours = [[0, 1, 10], [1, 1, 14], [1, 0, 10], [1, -1, 14], [0, -1, 10], [-1, -1, 14], [-1, 0, 10], [-1, 1, 14]];
    let expanded = 0;
    while (this.open.size > 0 && expanded < budget) {
      const current = this.open.pop();
      const cd = this.dist[current];
      const cx = current % this.width, cy = (current / this.width) | 0;
      expanded++;
      for (const [ox, oy, base] of neighbours) {
        const nx = cx + ox, ny = cy + oy;
        if (!map.inBounds(nx, ny)) continue;
        const ni = map.index(nx, ny);
        const cellCost = cost[ni];
        if (cellCost === NAV.IMPASSABLE) continue;
        if (ox !== 0 && oy !== 0) {
          if (cost[map.index(cx + ox, cy)] === NAV.IMPASSABLE) continue;
          if (cost[map.index(cx, cy + oy)] === NAV.IMPASSABLE) continue;
        }
        const step = Math.max(1, Math.floor((base * cellCost) / NAV.NORMAL));
        const nd = cd + step;
        if (this.stamp[ni] !== this.searchStamp || nd < this.dist[ni]) {
          this.dist[ni] = nd;
          this.stamp[ni] = this.searchStamp;
          this.open.pushOrUpdate(ni, nd);
        }
      }
    }
    if (this.open.size === 0) this.complete = true;
  }

  costAt(x, y) {
    const map = this.nav.grid.map;
    if (!map.inBounds(x, y)) return -1;
    const i = map.index(x, y);
    return this.stamp[i] === this.searchStamp ? this.dist[i] : -1;
  }

  nextStep(x, y) {
    const here = this.costAt(x, y);
    if (here < 0) return null;
    let best = here, bestCell = null, bestTargetDist = Infinity;
    for (const [ox, oy] of [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]) {
      const nx = x + ox, ny = y + oy;
      const c = this.costAt(nx, ny);
      if (c < 0) continue;
      const targetDist = (nx - this.target.x) ** 2 + (ny - this.target.y) ** 2;
      if (c < best || (c === best && targetDist < bestTargetDist)) {
        best = c; bestCell = { x: nx, y: ny }; bestTargetDist = targetDist;
      }
    }
    return bestCell;
  }
}

export class FlowFieldService {
  constructor(nav) {
    this.nav = nav;
    this.fields = new Map();
  }
  field(profile, target) {
    const key = `${profile}:${target.x},${target.y}`;
    let field = this.fields.get(key);
    if (!field || field.profile !== profile) {
      field = new FlowField(this.nav);
      field.profile = profile;
      this.fields.set(key, field);
      field.startRebuild(target, profile);
      field.rebuildStarted = true;
    }
    return field;
  }
  step(budget) {
    let remaining = budget;
    for (const field of this.fields.values()) {
      if (field.complete || remaining <= 0) continue;
      const before = field.open.size;
      field.step(remaining);
      remaining -= Math.max(0, before - field.open.size);
    }
  }
  invalidate() {
    for (const field of this.fields.values()) {
      field.rebuildStarted = false;
      field.startRebuild(field.target, field.profile);
    }
  }
}
