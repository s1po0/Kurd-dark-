// -----------------------------------------------------------------------------
//  Kurd Castle — browser preview
//  File: sim.js
//  Purpose: The simulation. Same systems and the same tick order as
//           Core/GameWorld.cs:
//
//             construction → economy → population → worker jobs → units →
//             combat → projectiles → enemy commander → waves → objectives
//
//           Pure logic: no canvas, no DOM. render.js draws whatever is here.
// -----------------------------------------------------------------------------

import {
  Sim, Map, Economy, Population, Popularity, Combat, Ai, Progression,
  BUILDINGS, UNITS, WAVES, damageMultiplier, rationMultiplier, taxGoldPerMinute,
  RATION_POPULARITY, TAX_POPULARITY,
} from './balance.js';
import { generateMap, OccupancyGrid, NavGrid, PathFinder, FlowFieldService, NAV, TERRAIN, Rng } from './map.js';

export const TEAM = { PLAYER: 'player', ENEMY: 'enemy' };

export const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', VICTORY: 'victory', DEFEAT: 'defeat' };

let nextHandle = 1;

export class World {
  constructor(seed) {
    this.seed = seed;
    const generated = generateMap(seed, Map.Width, Map.Height);
    this.map = generated.map;
    this.playerStart = generated.playerStart;
    this.enemyCamp = generated.enemyCamp;

    this.grid = new OccupancyGrid(this.map);
    this.nav = new NavGrid(this.grid);
    this.pathfinder = new PathFinder(this.nav);
    this.flowFields = new FlowFieldService(this.nav);

    this.rng = new Rng(seed ^ 0x51ed);
    this.time = 0;
    this.tick = 0;
    this.state = STATE.MENU;
    this.speed = 1;
    this.paused = false;

    this.buildings = [];
    this.units = [];
    this.projectiles = [];
    this.pings = [];
    this.toasts = [];
    this.events = [];
    this.projectileSeq = 1;

    this.keepCell = { ...this.playerStart };
    this.territoryRadius = 15;
    this.territoryLinkRadius = 9;

    this.ledger = {
      player: { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, weapons: 0, armor: 0, ale: 0 },
      enemy: { wood: 0, stone: 0, iron: 0, gold: 0, food: 0, weapons: 0, armor: 0, ale: 0 },
    };
    this.storageCaps = { wood: 0, stone: 0, iron: 0, gold: 99999, food: 0, weapons: 0, armor: 0, ale: 0 };
    this.rates = { food: 0, gold: 0, wood: 0, stone: 0, iron: 0 };
    this.rateAccum = { player: {}, enemy: {} };

    this.kingdom = {
      player: {
        peasants: 0, military: 0, housing: Population.BaseHousing, popularity: Population.PopularityStart,
        rations: 'full', taxes: 'normal', factors: [], underAttack: 0,
      },
      enemy: { peasants: 0, military: 0, popularity: 50 },
    };

    this.waveIndex = 0;
    this.wavesTotal = WAVES.length;
    this.waveActive = false;
    this.waveTimer = WAVES[0].delay;
    this.wavesCleared = 0;
    this.activeWaveUnits = [];
    this.objectives = { enemyCampDestroyed: false };

    this.focusTargetHandle = -1;
    this.commanderTimer = 0;
    this.economyTimer = 0;
    this.assignTimer = 0;
    this.selected = [];
    this.selectedBuilding = null;
    this.attackMove = false;
    this.score = { enemiesKilled: 0, buildingsRaised: 0, peasantsArrived: 0, peasantsLeft: 0, deliveries: 0 };

    this.prepareScenario();
    this.recalculateStorage();
  }

  // =====================================================================
  //  Helpers
  // =====================================================================
  toast(message, severity = 'info') {
    this.toasts.push({ message, severity, until: this.time + 3.4 });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  handleOf(building) { return building ? building.handle : -1; }
  buildingAt(x, y) {
    const handle = this.grid.occupant(x, y);
    if (handle < 0) return null;
    return this.buildings.find((b) => b.handle === handle) || null;
  }
  unitAt(x, y, radius = 0.9) {
    let best = null, bestD = radius * radius;
    for (const u of this.units) {
      if (!u.alive) continue;
      const d = (u.x - x) ** 2 + (u.y - y) ** 2;
      if (d <= bestD) { bestD = d; best = u; }
    }
    return best;
  }
  rectOf(def, cx, cy) {
    const w = def.fp[0], h = def.fp[1];
    return { x: cx - ((w - 1) >> 1), y: cy - ((h - 1) >> 1), w, h };
  }
  rectCenter(rect) { return { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }; }

  // =====================================================================
  //  Scenario
  // =====================================================================
  prepareScenario() {
    for (const [key, amount] of Object.entries(Economy.StartingResources)) {
      this.ledger.player[key] = amount;
    }

    this.place(BUILDINGS.keep, this.playerStart.x, this.playerStart.y, TEAM.PLAYER, true);
    const nearKeep = [['stockpile', 5], ['hovel', 6], ['hovel', 6], ['house', 7]];
    for (const [id, radius] of nearKeep) this.placeNear(BUILDINGS[id], this.playerStart, radius, TEAM.PLAYER);
    // The keep clearing has no trees left in it, so the woodcutters are planted
    // against the tree line instead of dropped at random.
    this.placeNearTrees(BUILDINGS.hut, this.playerStart, 15, TEAM.PLAYER);
    this.placeNearTrees(BUILDINGS.hut, this.playerStart, 16, TEAM.PLAYER);
    this.placeNearTrees(BUILDINGS.forester, this.playerStart, 17, TEAM.PLAYER);
    this.placeNearTerrain(BUILDINGS.quarry, this.playerStart, TERRAIN.ROCK, 20, TEAM.PLAYER);
    this.placeNearTerrain(BUILDINGS.farm, this.playerStart, TERRAIN.FERTILE, 22, TEAM.PLAYER);

    // Enemy camp: siege camp + tents, mirrored by BUILDINGS entries so the
    // structures are destructible with the same code path as the player's.
    this.placeNear(BUILDINGS.hovel, this.enemyCamp, 3, TEAM.ENEMY, 'EnemyTent');
    this.placeNear(BUILDINGS.hovel, this.enemyCamp, 4, TEAM.ENEMY, 'EnemyTent');
    this.placeNear(BUILDINGS.sawmill, this.enemyCamp, 2, TEAM.ENEMY, 'SiegeCamp');
    this.placeNear(BUILDINGS.tower, this.enemyCamp, 5, TEAM.ENEMY, 'WarBanner');

    for (let i = 0; i < Population.StartingPeasants; i++) {
      const cell = this.nav.findWalkableNear(this.playerStart.x, this.playerStart.y, NAV.GROUND, 6) || this.playerStart;
      this.spawnUnit(UNITS.peasant, TEAM.PLAYER, cell.x + 0.5 + this.rng.range(-1, 1), cell.y + 0.5 + this.rng.range(-1, 1));
    }
  }

  placeNear(def, anchor, radius, team, label = null) {
    for (let attempt = 0; attempt < 60; attempt++) {
      const cx = anchor.x + this.rng.int(-radius * 2, radius * 2 + 1);
      const cy = anchor.y + this.rng.int(-radius * 2, radius * 2 + 1);
      const placed = this.place(def, cx, cy, team, true, label);
      if (placed) return placed;
    }
    return null;
  }

  placeNearTrees(def, anchor, radius, team) {
    let fallback = null;
    for (let y = anchor.y - radius; y <= anchor.y + radius; y++) {
      for (let x = anchor.x - radius; x <= anchor.x + radius; x++) {
        if (!this.map.isWalkableTerrain(x, y) || this.map.hasTree(x, y)) continue;
        if (!this.map.hasTreeWithin(x, y, def.fp[0], def.fp[1])) continue;
        // Keep the hut off the map edge and out of the middle of a thicket: a
        // lumberjack who cannot stand next to his own hut never delivers a log.
        if (x < 3 || y < 3 || x > this.map.width - 4 || y > this.map.height - 4) continue;
        if (this.walkableNeighbours(x, y, def.fp[0], def.fp[1]) < 2) {
          fallback = fallback || { x, y };
          continue;
        }
        const placed = this.place(def, x, y, team, true);
        if (placed) return placed;
      }
    }
    if (fallback) {
      const placed = this.place(def, fallback.x, fallback.y, team, true);
      if (placed) return placed;
    }
    return this.placeNear(def, anchor, 10, team);
  }

  /** How many of the eight cells around a footprint are open ground? */
  walkableNeighbours(cx, cy, w, h) {
    let open = 0;
    for (let y = cy - 1; y <= cy + h; y++) {
      for (let x = cx - 1; x <= cx + w; x++) {
        const inside = x >= cx && x < cx + w && y >= cy && y < cy + h;
        if (inside) continue;
        if (this.nav.walkable(x, y, NAV.GROUND) && !this.map.hasTree(x, y)) open++;
      }
    }
    return open;
  }

  placeNearTerrain(def, anchor, terrain, radius, team) {
    for (let y = anchor.y - radius; y <= anchor.y + radius; y++) {
      for (let x = anchor.x - radius; x <= anchor.x + radius; x++) {
        if (this.map.get(x, y) !== terrain) continue;
        const placed = this.place(def, x, y, team, true);
        if (placed) return placed;
      }
    }
    return null;
  }

  // =====================================================================
  //  Placement
  // =====================================================================
  validatePlacement(def, cx, cy, team) {
    if (!def) return 'Unknown';
    const rect = this.rectOf(def, cx, cy);

    if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > this.map.width || rect.y + rect.h > this.map.height) {
      return 'Outside the map';
    }

    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (this.grid.isOccupied(x, y)) return 'Something is already there';
        const tree = this.map.hasTree(x, y);
        if (tree && !def.isMoat) return 'Trees are in the way';
        const walkable = this.map.isWalkableTerrain(x, y);
        const depositOk = (def.needsRock && this.map.get(x, y) === TERRAIN.ROCK) ||
                          (def.needsIron && this.map.get(x, y) === TERRAIN.IRON);
        if (!walkable && !depositOk) return 'That ground is not buildable';
        if (def.isMoat && this.map.get(x, y) === TERRAIN.WATER) return 'Already water';
      }
    }

    if (def.needsForest && !this.map.hasTreeWithin(rect.x, rect.y, rect.w, rect.h)) return 'Needs trees next to it';
    if (def.needsRock && !this.map.hasTerrainWithin(rect.x, rect.y, rect.w, rect.h, TERRAIN.ROCK)) return 'Needs a rock deposit';
    if (def.needsIron && !this.map.hasTerrainWithin(rect.x, rect.y, rect.w, rect.h, TERRAIN.IRON)) return 'Needs an iron vein';
    if (def.needsFertile && !this.map.hasTerrainWithin(rect.x, rect.y, rect.w, rect.h, TERRAIN.FERTILE)) return 'Needs fertile soil';

    if (!this.withinTerritory(rect, team)) return 'Build within your territory or beside an existing building';
    if (!this.canAfford(def.cost, team)) return 'Not enough resources';
    return null;
  }

  withinTerritory(rect, team) {
    const center = this.rectCenter(rect);
    const anchor = team === TEAM.PLAYER ? this.keepCell : this.enemyCamp;
    if (Math.hypot(anchor.x - center.x, anchor.y - center.y) <= this.territoryRadius) return true;
    for (const b of this.buildings) {
      if (b.team !== team) continue;
      const c = this.rectCenter(b.rect);
      if (Math.max(Math.abs(c.x - center.x), Math.abs(c.y - center.y)) <= this.territoryLinkRadius) return true;
    }
    return false;
  }

  canAfford(cost, team) {
    for (const [key, amount] of Object.entries(cost || {})) {
      if ((this.ledger[team][key] || 0) < amount) return false;
    }
    return true;
  }

  spend(cost, team) {
    if (!this.canAfford(cost, team)) return false;
    for (const [key, amount] of Object.entries(cost || {})) this.ledger[team][key] -= amount;
    return true;
  }

  place(def, cx, cy, team, instant = false, label = null) {
    const error = instant ? this.validatePlacement(def, cx, cy, team) : null;
    if (instant && error && error !== 'Not enough resources') return null;
    if (!instant) {
      const placementError = this.validatePlacement(def, cx, cy, team);
      if (placementError) { this.events.push({ type: 'rejected', reason: placementError, def }); return null; }
      if (!this.spend(def.cost, team)) return null;
    }

    const rect = this.rectOf(def, cx, cy);
    const building = {
      handle: nextHandle++,
      def, team, label: label || def.name, rect,
      hp: instant ? (def.hp || 200) : Math.max(1, (def.hp || 200) * 0.25),
      maxHp: def.hp || 200,
      site: !instant,
      buildProgress: instant ? 1 : 0,
      stored: { type: null, amount: 0, capacity: 30 },
      workers: [], garrison: [],
      gateOpen: true, production: 0, lastRate: 0,
      trainingQueue: [], trainingProgress: 0,
      repairQueued: false, flash: 0, rubble: false, rubbleTimer: 0, aura: def.aura || 0,
      enemiesAttacking: 0,
    };

    const cost = this.navCostFor(def);
    this.grid.occupy(rect, building.handle, cost.ground, cost.bypass);
    if (def.isGate) this.grid.setGate(rect, true);
    this.buildings.push(building);
    this.recalculateStorage();
    this.recalculateAuras();

    if (instant) {
      if (def.isKeep && team === TEAM.PLAYER) this.keepCell = this.rectCenter(rect);
      if (team === TEAM.PLAYER) this.score.buildingsRaised++;
    } else {
      this.toast(`${def.name} site ready — peasants will build it`);
    }
    return building;
  }

  navCostFor(def) {
    if (def.isGate) return { ground: NAV.GATE, bypass: NAV.CLIMB };
    if (def.isStairs) return { ground: NAV.GATE, bypass: NAV.CLIMB };
    if (def.isMoat) return { ground: NAV.GATE, bypass: NAV.MOAT };
    if (!def.blocks) return { ground: NAV.NORMAL + 4, bypass: NAV.NORMAL + 4 };
    return { ground: NAV.IMPASSABLE, bypass: NAV.CLIMB };
  }

  demolish(building) {
    if (!building || building.def.isKeep) return false;
    const refund = {};
    for (const [key, amount] of Object.entries(building.def.cost || {})) {
      const value = Math.floor(amount * Economy.SalvageRatio);
      if (value > 0) { refund[key] = value; this.addResource(key, value, building.team); }
    }
    this.removeBuilding(building, false);
    this.toast(`${building.def.name} demolished`);
    return true;
  }

  removeBuilding(building, destroyed) {
    building.workers.forEach((h) => {
      const worker = this.unitByHandle(h);
      if (worker) { worker.job = null; worker.jobBuilding = -1; worker.order = 'idle'; worker.path = []; }
    });
    building.garrison.forEach((h) => {
      const unit = this.unitByHandle(h);
      if (unit) {
        unit.garrisoned = false; unit.building = -1; unit.alive = true;
        const exit = this.nav.findWalkableNear(building.rect.x, building.rect.y, NAV.GROUND, 6);
        if (exit) { unit.x = exit.x + 0.5; unit.y = exit.y + 0.5; }
      }
    });

    if (destroyed) {
      this.grid.releaseNav(building.rect);
      building.rubble = true;
      building.rubbleTimer = 12;
      this.toast(`${building.def.name} destroyed!`, 'danger');
      if (building.def.isKeep && building.team === TEAM.PLAYER) this.triggerDefeat();
    } else {
      this.grid.release(building.rect);
      this.buildings = this.buildings.filter((b) => b !== building);
    }
    if (building.def.isKeep && building.team === TEAM.ENEMY) this.objectives.enemyCampDestroyed = true;
    this.recalculateStorage();
    this.recalculateAuras();
  }

  clearRubble(building) {
    this.grid.release(building.rect);
    this.buildings = this.buildings.filter((b) => b !== building);
  }

  toggleGate(building) {
    if (!building || !building.def.isGate) return;
    building.gateOpen = !building.gateOpen;
    this.grid.setGate(building.rect, building.gateOpen);
    this.toast(building.gateOpen ? 'Gate opened' : 'Gate sealed');
  }

  setAllGates(open) {
    for (const b of this.buildings) {
      if (b.team !== TEAM.PLAYER || !b.def.isGate) continue;
      b.gateOpen = open;
      this.grid.setGate(b.rect, open);
    }
    this.toast(open ? 'Gates opened' : 'Gates sealed');
  }

  recalculateStorage() {
    const caps = { ...Economy.BaseStorage };
    for (const b of this.buildings) {
      if (b.team !== TEAM.PLAYER || b.site || b.rubble) continue;
      const bonus = b.def.storage;
      if (!bonus) continue;
      for (const [key, value] of Object.entries(bonus)) caps[key] = (caps[key] || 0) + value;
    }
    this.storageCaps = caps;
  }

  recalculateAuras() {
    for (const b of this.buildings) b.workerBonus = 1;
    for (const mill of this.buildings) {
      if (mill.site || mill.rubble || !mill.def.recipe || mill.def.recipe.job !== 'miller') continue;
      const center = this.rectCenter(mill.rect);
      for (const farm of this.buildings) {
        if (farm.site || farm.rubble || farm.def.recipe?.job !== 'farmer') continue;
        const farmCenter = this.rectCenter(farm.rect);
        if (Math.hypot(farmCenter.x - center.x, farmCenter.y - center.y) <= Math.max(mill.rect.w, mill.rect.h) + 6) {
          farm.workerBonus = Math.max(farm.workerBonus || 1, 1.5);
        }
      }
    }
  }

  // =====================================================================
  //  Resources
  // =====================================================================
  addResource(key, amount, team = TEAM.PLAYER) {
    const cap = team === TEAM.PLAYER ? (this.storageCaps[key] ?? 999) : 99999;
    const current = this.ledger[team][key] || 0;
    const stored = Math.min(amount, Math.max(0, cap - current));
    this.ledger[team][key] = current + stored;
    this.rateAccum[team][key] = (this.rateAccum[team][key] || 0) + stored;
    return stored;
  }

  takeResource(key, amount, team = TEAM.PLAYER) {
    const current = this.ledger[team][key] || 0;
    const taken = Math.min(current, amount);
    this.ledger[team][key] = current - taken;
    this.rateAccum[team][key] = (this.rateAccum[team][key] || 0) - taken;
    return taken;
  }

  housingCapacity(team) {
    let total = Population.BaseHousing;
    for (const b of this.buildings) {
      if (b.team !== team || b.site || b.rubble) continue;
      total += b.def.housing || 0;
    }
    return total;
  }

  popularityAura(team) {
    let total = 0;
    for (const b of this.buildings) {
      if (b.team !== team || b.site || b.rubble) continue;
      total += b.def.aura || 0;
    }
    return total;
  }

  // =====================================================================
  //  Units
  // =====================================================================
  spawnUnit(def, team, x, y) {
    if (this.units.length >= 300) return null;
    const unit = {
      handle: nextHandle++, def, team, x, y, alive: true, hp: def.hp, maxHp: def.hp,
      state: 'idle', order: 'idle', path: [], pathIndex: 0, dest: null, facing: team === TEAM.PLAYER ? 45 : 225,
      bob: this.rng.range(0, Math.PI * 2), cooldown: 0, windup: 0, scanTimer: 0,
      target: -1, targetBuilding: -1, job: def.worker ? 'idle' : null, jobBuilding: -1,
      carry: null, carryAmount: 0, garrisoned: false, building: -1, selected: false,
      stuckTimer: 0,
      flash: 0, repathTimer: 0, combatTimer: 0, workTimer: 0, morale: 100, attackBuilding: -1,
      retreatCount: 0, regroupTimer: 0, deathTimer: 0,
    };
    this.units.push(unit);
    return unit;
  }

  unitByHandle(handle) { return this.units.find((u) => u.handle === handle) || null; }

  killUnit(unit, byPlayer = false) {
    if (!unit || !unit.alive) return;
    unit.alive = false;
    unit.state = 'dead';
    unit.selected = false;
    unit.deathTimer = 1.2;
    if (unit.jobBuilding >= 0) {
      const building = this.buildings.find((b) => b.handle === unit.jobBuilding);
      if (building) building.workers = building.workers.filter((h) => h !== unit.handle);
    }
    if (unit.team === TEAM.ENEMY && byPlayer) this.score.enemiesKilled++;
    this.events.push({ type: 'unitDied', unit });
  }

  countUnits(team, filter = () => true) {
    let n = 0;
    for (const u of this.units) if (u.alive && u.team === team && filter(u)) n++;
    return n;
  }

  assignPath(unit, goal, profile = NAV.GROUND) {
    unit.dest = goal;
    if (this.nav.lineOfSight(Math.floor(unit.x), Math.floor(unit.y), goal.x, goal.y, profile)) {
      unit.path = [goal];
      unit.pathIndex = 0;
      return true;
    }
    const path = this.pathfinder.findPath(Math.floor(unit.x), Math.floor(unit.y), goal.x, goal.y, profile, true);
    if (!path) { unit.path = []; return false; }
    unit.path = this.pathfinder.smooth(path, profile);
    unit.pathIndex = 0;
    return true;
  }

  // =====================================================================
  //  Player commands (called by the UI / input layer)
  // =====================================================================
  issueOrder(cellX, cellY, attackMove = false) {
    const military = this.selected.filter((u) => u.alive && !u.def.worker);
    if (military.length === 0) {
      if (this.selected.length > 0) this.toast('Peasants need a job, not an order');
      return;
    }
    const columns = Math.ceil(Math.sqrt(military.length));
    military.forEach((unit, index) => {
      const col = index % columns, row = Math.floor(index / columns);
      let gx = cellX + (col - Math.floor(columns / 2));
      let gy = cellY + (row - Math.floor(columns / 2));
      const spot = this.nav.findWalkableNear(gx, gy, NAV.GROUND, 3);
      if (spot) { gx = spot.x; gy = spot.y; }
      this.assignPath(unit, { x: gx, y: gy });
      unit.order = attackMove ? 'attackMove' : 'move';
      unit.target = -1;
    });
    this.pings.push({ x: cellX + 0.5, y: cellY + 0.5, color: attackMove ? '#e04a3c' : '#5fd67a', life: 1 });
  }

  trainingBuilding(unitId) {
    return this.buildings.find((b) => b.team === TEAM.PLAYER && !b.site && !b.rubble &&
                                       Array.isArray(b.def.trains) && b.def.trains.includes(unitId)) || null;
  }

  trainUnit(unitId) {
    const building = this.trainingBuilding(unitId);
    if (!building) { this.toast('Build the right training building first', 'warning'); return; }
    const def = UNITS[unitId];
    if (!def) return;
    if (building.trainingQueue.length >= 5) { this.toast('Training queue full'); return; }
    if (!this.canAfford(def.train, TEAM.PLAYER)) { this.toast(`Not enough resources for a ${def.name}`, 'warning'); return; }
    if (this.countUnits(TEAM.PLAYER, (u) => u.def.worker) + this.countUnits(TEAM.PLAYER, (u) => !u.def.worker) >= Population.MaxPopulation) {
      this.toast('Population limit reached', 'warning');
      return;
    }
    this.spend(def.train, TEAM.PLAYER);
    building.trainingQueue.push(unitId);
    this.toast(`${def.name} queued at the ${building.def.name}`);
  }

  garrisonSelected(building) {
    if (!building || !building.def.garrison) return;
    const slots = building.def.garrison - building.garrison.length;
    if (slots <= 0) { this.toast('Garrison is full'); return; }
    const archers = this.selected.filter((u) => u.alive && u.team === TEAM.PLAYER && !u.def.worker);
    let moved = 0;
    for (const unit of archers) {
      if (moved >= slots) break;
      unit.garrisoned = true;
      unit.building = building.handle;
      unit.x = building.rect.x + building.rect.w / 2;
      unit.y = building.rect.y + building.rect.h / 2;
      unit.path = [];
      unit.order = 'garrison';
      building.garrison.push(unit.handle);
      moved++;
    }
    this.selected = this.selected.filter((u) => !u.garrisoned);
    this.toast(moved > 0 ? `${moved} troops manning the ${building.def.name}` : 'Select archers first', moved > 0 ? 'success' : 'warning');
  }

  cycleRations() {
    const order = ['none', 'half', 'full', 'extra'];
    const current = this.kingdom.player.rations;
    this.kingdom.player.rations = order[(order.indexOf(current) + 1) % order.length];
    this.toast(`Rations: ${this.kingdom.player.rations}`);
  }

  cycleTaxes() {
    const order = ['generous', 'low', 'normal', 'high', 'brutal'];
    const current = this.kingdom.player.taxes;
    this.kingdom.player.taxes = order[(order.indexOf(current) + 1) % order.length];
    this.toast(`Taxes: ${this.kingdom.player.taxes}`);
  }

  setSpeed(multiplier) { this.speed = multiplier; }
  togglePause() {
    if (this.state === STATE.PAUSED) { this.state = STATE.PLAYING; }
    else if (this.state === STATE.PLAYING) { this.state = STATE.PAUSED; }
  }

  startMatch() { this.state = STATE.PLAYING; }
  triggerVictory(title, summary) {
    if (this.state === STATE.VICTORY || this.state === STATE.DEFEAT) return;
    this.state = STATE.VICTORY;
    this.victoryTitle = title; this.victorySummary = summary;
  }
  triggerDefeat() {
    if (this.state === STATE.VICTORY || this.state === STATE.DEFEAT) return;
    this.state = STATE.DEFEAT;
    this.victoryTitle = 'The Keep Has Fallen';
    this.victorySummary = 'Your lord\'s keep was breached.';
  }

  // =====================================================================
  //  Frame update
  // =====================================================================
  update(dt) {
    // Advance the wave schedule even on the menu so the banner countdown works.
    if (this.state === STATE.PAUSED || this.state === STATE.MENU) return;
    if (this.state !== STATE.PLAYING) {
      this.stepProjectiles(dt);
      return;
    }

    const scaled = dt * this.speed;
    this.time += scaled;
    this.events.length = 0;

    this.stepConstruction(scaled);
    this.stepTraining(scaled);
    this.stepEconomy(scaled);
    this.stepPopulation(scaled);
    this.stepWorkerJobs(scaled);
    this.stepUnits(scaled);
    this.stepCombat(scaled);
    this.stepProjectiles(scaled);
    this.stepCommander(scaled);
    this.stepWaves(scaled);
    this.stepCorpses(scaled);
    this.stepObjectives();

    this.toasts = this.toasts.filter((t) => t.until > this.time);
    this.pings = this.pings.filter((p) => (p.life -= scaled) > 0);
  }

  // ---------------------------------------------------------------- construction
  stepConstruction(dt) {
    for (const b of this.buildings) {
      if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 2.4);
      if (b.rubble) {
        b.rubbleTimer -= dt;
        if (b.rubbleTimer <= 0) this.clearRubble(b);
        continue;
      }
      if (b.site) {
        const builders = b.workers.length;
        if (builders > 0) {
          const rate = (1 / Math.max(0.5, b.def.buildTime)) * Math.min(0.6 + 0.4 * builders, 2.4);
          b.buildProgress += rate * dt;
          b.hp = b.maxHp * 0.25 + (b.maxHp * 0.75) * Math.min(1, b.buildProgress);
          if (b.buildProgress >= 1) {
            b.site = false;
            b.hp = b.maxHp;
            this.toast(`${b.def.name} completed`, 'success');
            this.recalculateStorage();
            this.recalculateAuras();
          }
        }
        continue;
      }
      if (b.repairQueued && b.hp < b.maxHp) {
        const heal = Math.min(Economy.RepairHpPerSecond * dt, b.maxHp - b.hp);
        const cost = Math.ceil(heal * Economy.RepairCostPerHp);
        const stone = this.takeResource('stone', cost, b.team);
        if (stone <= 0) { b.repairQueued = false; this.toast('Out of stone — repairs stalled', 'warning'); }
        else {
          b.hp = Math.min(b.maxHp, b.hp + heal);
          if (b.hp >= b.maxHp) { b.repairQueued = false; this.toast(`${b.def.name} fully repaired`, 'success'); }
        }
      }
      if (b.def.isGate) b.gateOpen = b.gateOpen;
    }
  }

  // ---------------------------------------------------------------- economy
  stepEconomy(dt) {
    for (const b of this.buildings) {
      if (b.site || b.rubble) continue;
      const recipe = b.def.recipe;
      if (!recipe) continue;
      const slots = b.def.work || 0;
      if (slots > 0 && b.workers.length === 0) { b.lastRate = 0; continue; }
      if (b.stored.amount >= b.stored.capacity) { b.lastRate = 0; continue; }

      const staffRatio = slots > 0 ? b.workers.length / slots : 1;
      const rate = (b.workerBonus || 1) * Math.max(0.15, staffRatio) / Math.max(0.5, recipe.seconds);
      b.production += rate * dt;
      b.lastRate = rate * (recipe.amount || 0) * 60;
      if (b.production < 1) continue;
      b.production = 0;
      this.completeCycle(b, recipe);
    }

    this.economyTimer += dt;
    if (this.economyTimer < Sim.EconomyIntervalSeconds) return;
    const elapsed = this.economyTimer;
    this.economyTimer = 0;
    this.settleEconomy(TEAM.PLAYER, elapsed);
  }

  completeCycle(b, recipe) {
    if (recipe.in && recipe.inAmount) {
      if (this.takeResource(recipe.in, recipe.inAmount, b.team) < recipe.inAmount) return;
    }
    if (recipe.depletes) {
      const tile = this.map.findNearestDeposit(b.rect.x + (b.rect.w >> 1), b.rect.y + (b.rect.h >> 1), recipe.out, 12);
      if (!tile) { b.lastRate = 0; return; }
      this.map.consumeHarvest(tile.x, tile.y);
    }
    if (recipe.out && recipe.amount) {
      if (b.stored.type && b.stored.type !== recipe.out && b.stored.amount > 0) {
        this.addResource(b.stored.type, b.stored.amount, b.team);
        b.stored.amount = 0;
      }
      b.stored.type = recipe.out;
      b.stored.amount = Math.min(b.stored.capacity, b.stored.amount + recipe.amount);
    }
    if (recipe.job === 'forester') {
      for (let i = 0; i < 10; i++) {
        const tx = b.rect.x + this.rng.int(-6, 7);
        const ty = b.rect.y + this.rng.int(-6, 7);
        if (!this.map.isWalkableTerrain(tx, ty) || this.map.hasTree(tx, ty) || this.grid.isOccupied(tx, ty)) continue;
        this.map.setTree(tx, ty, true);
        this.map.harvest[this.map.index(tx, ty)] = 3;
        break;
      }
    }
  }

  settleEconomy(team, elapsedSeconds) {
    const stats = this.kingdom.player;
    if (team !== TEAM.PLAYER) return;

    const minutes = elapsedSeconds / 60;
    const mouths = stats.peasants + Math.round(stats.military * 0.5);
    const wanted = mouths * Population.FoodPerPeasantPerMinute * minutes * rationMultiplier(stats.rations);
    const foodNeeded = Math.floor(wanted);
    const foodConsumed = foodNeeded > 0 ? this.takeResource('food', foodNeeded) : 0;
    const starving = foodNeeded > 0 && foodConsumed < foodNeeded;

    const goldRate = taxGoldPerMinute(stats.taxes) * stats.peasants * minutes;
    const goldInt = Math.floor(Math.abs(goldRate));
    if (goldInt > 0) {
      if (goldRate >= 0) this.addResource('gold', goldInt);
      else this.takeResource('gold', goldInt);
    }

    const inns = this.buildings.filter((b) => b.team === TEAM.PLAYER && !b.site && !b.rubble && b.def.id === 'inn').length;
    if (inns > 0) {
      const aleWanted = Math.floor(inns * minutes * 0.5);
      if (aleWanted > 0) this.takeResource('ale', aleWanted);
    }

    if (starving) this.toast('Your people are starving!', 'warning');

    for (const key of ['wood', 'stone', 'iron', 'food', 'weapons', 'armor', 'ale', 'gold']) {
      const accum = this.rateAccum.player[key] || 0;
      const perMinute = elapsedSeconds > 0 ? (accum * 60) / elapsedSeconds : 0;
      // Smoothed: deliveries are bursty, and a jittery HUD number reads as a bug.
      this.rates[key] = this.rates[key] * 0.6 + perMinute * 0.4;
      this.rateAccum.player[key] = 0;
    }
  }

  // ---------------------------------------------------------------- training
  stepTraining(dt) {
    for (const b of this.buildings) {
      if (b.site || b.rubble || !b.def.trains) continue;
      if (b.trainingQueue.length === 0) { b.trainingProgress = 0; continue; }
      const unitId = b.trainingQueue[0];
      const def = UNITS[unitId];
      const rate = 1 / Math.max(1, def.trainTime);
      b.trainingProgress += rate * dt;
      if (b.trainingProgress >= 1) {
        // Stronghold rule: a soldier is a promoted peasant, so if nobody is idle
        // the finished recruit waits in the yard instead of vanishing.
        const peasant = this.nearestIdlePeasant(b);
        if (!peasant) {
          b.trainingProgress = 1;
          if (!b.awaitingPeasant) {
            b.awaitingPeasant = true;
            this.toast(`${def.name} ready — waiting for an idle peasant`, 'warning');
          }
          continue;
        }
        b.awaitingPeasant = false;
        b.trainingProgress = 0;
        b.trainingQueue.shift();
        // Stronghold rule: a peasant is promoted, not conjured.
        peasant.def = def;
        peasant.maxHp = def.hp;
        peasant.hp = def.hp;
        peasant.job = null;
        peasant.jobBuilding = -1;
        peasant.carry = null;
        peasant.carryAmount = 0;
        peasant.path = [];
        peasant.order = 'guard';
        peasant.state = 'guard';
        this.toast(`${def.name} trained at the ${b.def.name}`, 'success');
      }
    }
  }

  nearestIdlePeasant(building) {
    const center = this.rectCenter(building.rect);
    let best = null, bestDist = Infinity;
    for (const u of this.units) {
      if (!u.alive || u.team !== TEAM.PLAYER || !u.def.worker || u.garrisoned) continue;
      if (u.jobBuilding >= 0) continue;
      const d = Math.hypot(u.x - center.x, u.y - center.y);
      if (d < bestDist) { bestDist = d; best = u; }
    }
    return best;
  }

  // ---------------------------------------------------------------- population
  stepPopulation(dt) {
    this.recalculatePopularity(dt);

    const stats = this.kingdom.player;
    const total = stats.peasants + stats.military;
    const food = this.ledger.player.food;

    if (this.popSpawnTimer === undefined) this.popSpawnTimer = 0;
    if (this.popLeaveTimer === undefined) this.popLeaveTimer = 0;

    if (total < Population.MaxPopulation && stats.housingFree > 0 && food > 2) {
      const interval = this.spawnInterval(stats.popularity);
      this.spawnCountdown = Math.max(0, interval - this.popSpawnTimer);
      this.popSpawnTimer += dt;
      if (this.popSpawnTimer >= interval) {
        this.popSpawnTimer = 0;
        const spot = this.nav.findWalkableNear(this.keepCell.x, this.keepCell.y, NAV.GROUND, 8) || this.keepCell;
        const peasant = this.spawnUnit(UNITS.peasant, TEAM.PLAYER, spot.x + 0.5, spot.y + 0.5);
        if (peasant) {
          this.score.peasantsArrived++;
          this.toast('A new peasant arrives', 'success');
        }
      }
    } else {
      this.spawnCountdown = 0;
    }

    if (stats.popularity < Population.PeasantLeavesAbove) {
      this.popLeaveTimer += dt;
      if (this.popLeaveTimer >= 8) {
        this.popLeaveTimer = 0;
        const peasant = this.units.find((u) => u.alive && u.team === TEAM.PLAYER && u.def.worker && !u.garrisoned);
        if (peasant && stats.peasants > 1) {
          this.killUnit(peasant, false);
          this.score.peasantsLeft++;
          this.toast('A peasant abandoned your castle', 'warning');
        }
      }
    } else {
      this.popLeaveTimer = 0;
    }
  }

  spawnInterval(popularity) {
    const t = Math.min(1, Math.max(0, popularity / 100));
    return Population.MaxSpawnInterval + (Population.MinSpawnInterval - Population.MaxSpawnInterval) * t * t;
  }

  recalculatePopularity(dt) {
    const stats = this.kingdom.player;
    const peasants = this.countUnits(TEAM.PLAYER, (u) => u.def.worker && !u.garrisoned);
    const military = this.countUnits(TEAM.PLAYER, (u) => !u.def.worker);
    const housing = this.housingCapacity(TEAM.PLAYER);
    stats.peasants = peasants;
    stats.military = military;
    stats.housing = housing;
    stats.housingUsed = peasants + Math.ceil(military * 0.5);
    stats.housingFree = housing - stats.housingUsed;

    const factors = [];
    factors.push({ label: `Rations (${stats.rations})`, value: RATION_POPULARITY[stats.rations] });
    factors.push({ label: `Taxes (${stats.taxes})`, value: TAX_POPULARITY[stats.taxes] });

    const inns = this.buildings.filter((b) => b.team === TEAM.PLAYER && !b.site && !b.rubble && b.def.id === 'inn').length;
    const ale = this.ledger.player.ale;
    let aleBonus = 0;
    if (inns > 0 && ale > 0) aleBonus = Math.min(Popularity.AleBonusMax, inns * Popularity.AleBonusPerInn);
    if (aleBonus > 0) factors.push({ label: 'Ale in the inns', value: aleBonus });

    const free = stats.housingFree;
    const housingFactor = free < 0 ? free * Popularity.OvercrowdPenalty : Math.min(Popularity.SpareHousingBonus, free * 0.2);
    if (Math.abs(housingFactor) > 0.01) factors.push({ label: free < 0 ? 'Overcrowded' : 'Spare housing', value: housingFactor });

    const aura = this.popularityAura(TEAM.PLAYER);
    if (Math.abs(aura) > 0.01) factors.push({ label: 'Buildings', value: aura });

    const fear = this.computeFear();
    if (fear > 0.01) factors.push({ label: 'Enemy at the gates', value: -fear });
    if (stats.underAttack > 0) factors.push({ label: 'Keep under attack', value: -Popularity.KeepUnderAttackPenalty });

    const total = factors.reduce((sum, f) => sum + f.value, 0);
    stats.factors = factors;
    stats.targetPopularity = total;
    const target = Math.min(Population.PopularityMax,
      Math.max(Population.PopularityMin, Popularity.Baseline + total));
    const delta = target - stats.popularity;
    const step = Math.min(Math.abs(delta), Popularity.DriftPerSecond * dt);
    stats.popularity += Math.sign(delta) * step;
    if (stats.underAttack > 0) stats.underAttack = Math.max(0, stats.underAttack - dt);
  }

  computeFear() {
    let fear = 0;
    for (const u of this.units) {
      if (!u.alive || u.team !== TEAM.ENEMY) continue;
      const dist = Math.hypot(u.x - this.keepCell.x, u.y - this.keepCell.y);
      if (dist > Ai.AggroRadius) continue;
      const weight = u.def.role === 'siege' ? 2.5 : 1;
      fear += Popularity.FearPerEnemyNearKeep * weight * (1 - dist / Ai.AggroRadius);
    }
    return Math.min(Popularity.FearMax, fear);
  }

  stepWorkerJobs(dt) {
    // Workers act every tick, but the assignment pass is throttled hard.
    for (const unit of this.units) {
      if (!unit.alive || unit.team !== TEAM.PLAYER || !unit.def.worker || unit.garrisoned) continue;
      const building = unit.jobBuilding >= 0 ? this.buildings.find((b) => b.handle === unit.jobBuilding) : null;

      if (unit.jobBuilding >= 0 && !building) {
        unit.job = null; unit.jobBuilding = -1; unit.order = 'idle';
        continue;
      }

      if (unit.carryAmount > 0) { this.tickHauling(unit, dt, building); continue; }
      if (building) { this.tickWorking(unit, dt, building); continue; }

      // Loiter a little so the castle looks inhabited.
      unit.order = 'idle';
      if (!unit.path.length && (!unit.loiterTimer || unit.loiterTimer <= 0)) {
        unit.loiterTimer = this.rng.range(4, 11);
        const target = this.nav.findWalkableNear(
          this.keepCell.x + this.rng.int(-6, 7), this.keepCell.y + this.rng.int(-6, 7), NAV.GROUND, 5);
        if (target) this.assignPath(unit, target);
      }
      if (unit.loiterTimer > 0) unit.loiterTimer -= dt;
    }

    this.assignTimer += dt;
    if (this.assignTimer < 0.75) return;
    this.assignTimer = 0;
    this.assignJobs();
  }

  assignJobs() {
    const idle = this.units.filter((u) => u.alive && u.team === TEAM.PLAYER && u.def.worker &&
                                        !u.garrisoned && u.carryAmount === 0 &&
                                        (u.jobBuilding < 0 || !this.buildings.find((b) => b.handle === u.jobBuilding)));
    if (idle.length === 0) return;

    const sites = this.buildings.filter((b) => b.team === TEAM.PLAYER && b.site && b.def.id !== 'keep');
    const staffable = this.buildings.filter((b) => b.team === TEAM.PLAYER && !b.site && !b.rubble &&
                                                   (b.def.work || 0) > b.workers.length);

    const take = (target) => {
      if (idle.length === 0) return null;
      let bestIndex = 0, bestDist = Infinity;
      idle.forEach((u, i) => {
        const d = Math.max(Math.abs(Math.floor(u.x) - target.x), Math.abs(Math.floor(u.y) - target.y));
        if (d < bestDist) { bestDist = d; bestIndex = i; }
      });
      return idle.splice(bestIndex, 1)[0];
    };

    for (const site of sites) {
      const needed = Math.max(1, Math.min(6, Math.ceil((site.rect.w * site.rect.h) / 2)));
      while (site.workers.length < needed) {
        const worker = take(this.rectCenter(site.rect));
        if (!worker) break;
        site.workers.push(worker.handle);
        worker.job = 'builder';
        worker.jobBuilding = site.handle;
        worker.order = 'work';
        this.assignPath(worker, this.findWorkCell(worker, site));
      }
    }

    for (const building of staffable) {
      while (building.workers.length < (building.def.work || 0)) {
        const worker = take(this.rectCenter(building.rect));
        if (!worker) break;
        building.workers.push(worker.handle);
        worker.job = building.def.recipe ? building.def.recipe.job : 'worker';
        worker.jobBuilding = building.handle;
        worker.order = 'work';
        this.assignPath(worker, this.findWorkCell(worker, building));
      }
    }
  }

  /**
   * The cell a worker stands on to use a building. Searches ring by ring so a
   * hut wedged against a thicket still gets a reachable spot instead of the
   * unwalkable centre of its own footprint (which used to strand its lumberjack
   * for the rest of the match). Returns null when there is no open ground at
   * all, and the caller then lets the worker work where it stands.
   */
  /** Distance from a unit to the nearest edge of a rect (0 when inside). */
  rectDistance(unit, rect) {
    const dx = Math.max(rect.x - unit.x, 0, unit.x - (rect.x + rect.w));
    const dy = Math.max(rect.y - unit.y, 0, unit.y - (rect.y + rect.h));
    return Math.hypot(dx, dy);
  }

  findWorkCell(worker, building) {
    const rect = building.rect;
    for (let radius = 1; radius <= 4; radius++) {
      let best = null, bestDist = Infinity;
      for (let y = rect.y - radius; y < rect.y + rect.h + radius; y++) {
        for (let x = rect.x - radius; x < rect.x + rect.w + radius; x++) {
          if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) continue;
          if (radius > 1 &&
              x >= rect.x - radius + 1 && x < rect.x + rect.w + radius - 1 &&
              y >= rect.y - radius + 1 && y < rect.y + rect.h + radius - 1) continue; // inner rings already tried
          if (!this.nav.walkable(x, y, NAV.GROUND)) continue;
          if (this.grid.isOccupied(x, y)) continue;
          const d = Math.hypot(x - worker.x, y - worker.y);
          if (d < bestDist) { bestDist = d; best = { x, y }; }
        }
      }
      if (best) return best;
    }
    return null;
  }

  tickWorking(unit, dt, building) {
    unit.order = 'work';
    unit.state = 'working';
    const workCell = this.findWorkCell(unit, building);
    const standoff = workCell
      ? Math.hypot(unit.x - (workCell.x + 0.5), unit.y - (workCell.y + 0.5))
      : this.rectDistance(unit, building.rect);
    // A worker who cannot reach the ideal cell (boxed-in hut, a wall raised over
    // the approach) still works from wherever it can stand, rather than pacing
    // forever and silently stalling the castle's economy.
    const stuckAllowed = !workCell || (unit.stuckTimer > 6 && standoff <= 4.5);
    if (standoff > 1.2 && !stuckAllowed) {
      if (!unit.path.length && unit.repathTimer <= 0) {
        this.assignPath(unit, workCell);
        unit.repathTimer = 1.5;
      }
      unit.repathTimer -= dt;
      unit.stuckTimer += dt;
      return;
    }
    unit.stuckTimer = 0;
    unit.workTimer += dt;
    unit.bob += dt * 6;
    if (building.stored.amount > 0 && building.stored.amount >= building.stored.capacity / 2) {
      const carry = Math.min(Economy.CarryCapacity, building.stored.amount);
      unit.carry = building.stored.type;
      unit.carryAmount = carry;
      building.stored.amount -= carry;
      if (building.stored.amount <= 0) building.stored.type = null;
    }
  }

  tickHauling(unit, dt, jobBuilding) {
    unit.order = 'work';
    unit.state = 'hauling';
    const dropOff = this.findDropOff(unit);
    if (!dropOff) { unit.state = 'working'; return; }

    const center = this.rectCenter(dropOff.rect);
    if (Math.hypot(unit.x - center.x, unit.y - center.y) > 1.8) {
      if (!unit.path.length && unit.repathTimer <= 0) {
        const spot = this.nav.findWalkableNear(Math.floor(center.x), Math.floor(center.y), NAV.GROUND, 5);
        if (spot) this.assignPath(unit, spot);
        unit.repathTimer = 1.5;
      }
      unit.repathTimer -= dt;
      return;
    }

    const stored = this.addResource(unit.carry, unit.carryAmount, TEAM.PLAYER);
    const lost = unit.carryAmount - stored;
    if (stored > 0) this.score.deliveries++;
    if (lost > 0) this.toast(`Stockpile full — ${lost} ${unit.carry} lost`, 'warning');
    unit.carry = null;
    unit.carryAmount = 0;
    unit.path = [];
    if (jobBuilding && !jobBuilding.rubble) this.assignPath(unit, this.findWorkCell(unit, jobBuilding));
  }

  findDropOff(unit) {
    let best = null, bestDist = Infinity;
    for (const b of this.buildings) {
      if (b.team !== TEAM.PLAYER || b.site || b.rubble || !b.def.isStorage) continue;
      const c = this.rectCenter(b.rect);
      const d = Math.hypot(c.x - unit.x, c.y - unit.y);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  // ---------------------------------------------------------------- units
  stepUnits(dt) {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      if (unit.flash > 0) unit.flash = Math.max(0, unit.flash - dt * 3);
      if (unit.cooldown > 0) unit.cooldown = Math.max(0, unit.cooldown - dt);
      if (unit.scanTimer > 0) unit.scanTimer -= dt;
      if (unit.combatTimer > 0) unit.combatTimer -= dt;
      if (unit.repathTimer > 0) unit.repathTimer -= dt;
      if (unit.garrisoned) { unit.state = 'garrisoned'; continue; }
      this.moveUnit(unit, dt);
    }
  }

  moveUnit(unit, dt) {
    if (unit.windup > 0) { /* holding a swing */ }

    if (!unit.path.length || unit.pathIndex >= unit.path.length) {
      if (unit.order === 'move') unit.order = 'idle';
      unit.state = unit.order === 'guard' ? 'guard' : 'idle';
      return;
    }

    const waypoint = unit.path[unit.pathIndex];
    const tx = waypoint.x + 0.5, ty = waypoint.y + 0.5;
    let dx = tx - unit.x, dy = ty - unit.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 0.22) {
      unit.pathIndex++;
      if (unit.pathIndex >= unit.path.length) {
        unit.path = [];
        if (unit.order === 'move') unit.order = 'idle';
      }
      return;
    }

    dx /= distance; dy /= distance;

    // Separation: push away from crowded neighbours (cheap, O(neighbours)).
    let pushX = 0, pushY = 0;
    for (const other of this.units) {
      if (other === unit || !other.alive || other.garrisoned) continue;
      const ox = unit.x - other.x, oy = unit.y - other.y;
      const d2 = ox * ox + oy * oy;
      if (d2 > 0.44 || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      pushX += ox / (d * d); pushY += oy / (d * d);
    }
    let steerX = dx + pushX * 0.35, steerY = dy + pushY * 0.35;
    const steerLen = Math.hypot(steerX, steerY) || 1;

    const speed = unit.def.speed * (unit.team === TEAM.ENEMY ? 1 : 1);
    const nx = unit.x + (steerX / steerLen) * speed * dt;
    const ny = unit.y + (steerY / steerLen) * speed * dt;

    const profile = unit.def.clearance === 2 ? NAV.WIDE : NAV.GROUND;
    if (this.nav.walkable(Math.floor(nx), Math.floor(ny), profile)) {
      unit.x = nx; unit.y = ny;
    } else if (this.nav.walkable(Math.floor(nx), Math.floor(unit.y), profile)) {
      unit.x = nx;
    } else if (this.nav.walkable(Math.floor(unit.x), Math.floor(ny), profile)) {
      unit.y = ny;
    } else {
      unit.path = [];
      unit.repathTimer = 0.4;
    }

    unit.facing = (Math.atan2(steerX, -steerY) * 180) / Math.PI;
    unit.bob += dt * 9;
    unit.state = unit.order === 'attackMove' ? 'attackMove' : 'moving';
  }

  // ---------------------------------------------------------------- combat
  stepCombat(dt) {
    for (const unit of this.units) {
      if (!unit.alive) continue;
      if (unit.garrisoned) { this.garrisonFire(unit, dt); continue; }
      if (unit.def.worker) continue;
      this.combatUnit(unit, dt);
    }
    this.towerFire(dt);
  }

  combatUnit(unit, dt) {
    if (unit.scanTimer <= 0) {
      unit.scanTimer = 0.35 + this.rng.range(0, 0.25);
      const reach = unit.order === 'guard' ? unit.def.vision : (unit.def.aggro || unit.def.vision);
      const target = this.findEnemyUnit(unit, reach);
      unit.target = target ? target.handle : -1;
      if (!target) {
        // Siege and melee press on to structures when ordered to attack-move.
        if (unit.order === 'attackMove' || unit.team === TEAM.ENEMY) {
          const building = this.findEnemyBuilding(unit, unit.def.role === 'siege' ? 18 : 8);
          unit.targetBuilding = building ? building.handle : -1;
        } else {
          unit.targetBuilding = -1;
        }
      } else {
        unit.targetBuilding = -1;
      }
    }

    const target = this.unitByHandle(unit.target);
    if (target && target.alive) {
      const dist = Math.hypot(target.x - unit.x, target.y - unit.y);
      if (dist > unit.def.range) {
        if (!unit.path.length && unit.repathTimer <= 0) {
          this.assignPath(unit, { x: Math.floor(target.x), y: Math.floor(target.y) });
          unit.repathTimer = 0.8;
        }
        return;
      }
      unit.facing = (Math.atan2(target.x - unit.x, -(target.y - unit.y)) * 180) / Math.PI;
      if (unit.cooldown > 0) return;
      unit.cooldown = unit.def.interval;
      unit.state = 'engage';
      unit.combatTimer = 3;
      if (unit.def.projectile) {
        this.spawnProjectile(unit, target, null);
      } else {
        this.applyMelee(unit, target);
      }
      return;
    }

    const building = this.buildings.find((b) => b.handle === unit.targetBuilding);
    if (building && !building.rubble) {
      const center = this.rectCenter(building.rect);
      const dist = Math.hypot(center.x - unit.x, center.y - unit.y);
      const reach = Math.max(unit.def.range, Math.max(building.rect.w, building.rect.h) * 0.6 + 0.8);
      if (dist > reach) {
        if (!unit.path.length && unit.repathTimer <= 0) {
          const profile = unit.def.clearance === 2 ? NAV.WIDE : (unit.def.bypassWalls ? NAV.BYPASS : NAV.GROUND);
          this.assignPath(unit, { x: Math.floor(center.x), y: Math.floor(center.y) }, profile);
          unit.repathTimer = 1.0;
        }
        return;
      }
      if (unit.cooldown > 0) return;
      unit.cooldown = unit.def.interval;
      unit.state = 'engage';
      if (unit.def.projectile) this.spawnProjectile(unit, null, building);
      else this.damageBuilding(building, unit.def.damage * (unit.def.buildingMultiplier || 1), unit.def.damageType, unit.team);
    }
  }

  findEnemyUnit(unit, radius) {
    let best = null, bestScore = Infinity;
    for (const other of this.units) {
      if (!other.alive || other.team === unit.team || other.garrisoned) continue;
      const dist = Math.hypot(other.x - unit.x, other.y - unit.y);
      if (dist > radius) continue;
      let score = dist;
      if (unit.def.role === 'ranged') {
        if (other.def.role === 'ranged') score -= 3;
        if (other.def.worker) score -= 2;
        if (other.def.role === 'siege') score -= 4;
      }
      if (score < bestScore) { bestScore = score; best = other; }
    }
    return best;
  }

  findEnemyBuilding(unit, radius) {
    const enemyTeam = unit.team === TEAM.PLAYER ? TEAM.ENEMY : TEAM.PLAYER;
    let best = null, bestScore = Infinity;
    for (const b of this.buildings) {
      if (b.team !== enemyTeam || b.rubble) continue;
      const center = this.rectCenter(b.rect);
      const dist = Math.hypot(center.x - unit.x, center.y - unit.y);
      if (dist > radius) continue;
      let score = dist;
      if (unit.def.role === 'siege') {
        if (b.def.isGate) score -= 6;
        if (b.def.isWall) score -= 3;
      } else if (b.def.isKeep) score += 8;
      if (score < bestScore) { bestScore = score; best = b; }
    }
    return best;
  }

  applyMelee(attacker, target) {
    let damage = attacker.def.damage * Combat.MeleeScale;
    // Rear-attack bonus: hitting from outside the target's facing cone.
    const toAttacker = (Math.atan2(attacker.x - target.x, -(attacker.y - target.y)) * 180) / Math.PI;
    let delta = Math.abs(((toAttacker - target.facing + 540) % 360) - 180);
    delta = 180 - delta;
    if (delta > 120) damage *= Combat.RearAttackBonus;

    const applied = damage * damageMultiplier(attacker.def.damageType, target.def.armor);
    target.hp -= applied;
    target.flash = 1;
    target.combatTimer = 3;
    if (target.hp <= 0) {
      const byPlayer = attacker.team === TEAM.PLAYER;
      this.killUnit(target, byPlayer);
      if (byPlayer) this.toast(`${target.def.name} slain`, 'success');
    }
  }

  damageBuilding(building, amount, damageType, team) {
    if (building.rubble) return;
    const applied = amount * damageMultiplier(damageType, building.def.armor);
    building.hp -= applied;
    building.flash = 1;
    if (building.team === TEAM.PLAYER) {
      this.kingdom.player.underAttack = 6;
      this.events.push({ type: 'underAttack', building });
    }
    if (building.hp <= 0) this.removeBuilding(building, true);
  }

  garrisonFire(unit, dt) {
    if (!unit.def.projectile) return;
    if (unit.cooldown > 0) return;
    unit.cooldown = unit.def.interval;
    const building = this.buildings.find((b) => b.handle === unit.building);
    const range = unit.def.range + (building && (building.def.isWall || building.def.isTower) ? Combat.WallArcherRangeBonus : 0);
    const target = this.findEnemyUnit(unit, range);
    if (target) this.spawnProjectile(unit, target, null);
  }

  towerFire(dt) {
    for (const b of this.buildings) {
      if (b.site || b.rubble || !b.def.defense) continue;
      b.defenseCooldown = Math.max(0, (b.defenseCooldown || 0) - dt);
      if (b.defenseCooldown > 0) continue;
      const center = this.rectCenter(b.rect);
      const range = b.def.defense.range + b.garrison.length * 0.6;
      let target = null, bestDist = Infinity;
      for (const u of this.units) {
        if (!u.alive || u.team === b.team || u.garrisoned) continue;
        const d = Math.hypot(u.x - center.x, u.y - center.y);
        if (d < range && d < bestDist) { bestDist = d; target = u; }
      }
      if (!target) continue;
      b.defenseCooldown = b.def.defense.interval;
      this.projectiles.push({
        id: this.projectileSeq++,
        x: center.x, y: center.y, z: b.def.height || 3,
        sx: center.x, sy: center.y, tx: target.x, ty: target.y,
        targetUnit: target.handle, targetBuilding: -1,
        progress: 0, speed: 22, damage: b.def.defense.damage, damageType: 'pierce',
        team: b.team, arc: 0.4, splash: 0, hitChance: 1,
      });
    }
  }

  spawnProjectile(attacker, targetUnit, targetBuilding) {
    const sx = attacker.x, sy = attacker.y;
    const tx = targetUnit ? targetUnit.x : this.rectCenter(targetBuilding.rect).x;
    const ty = targetUnit ? targetUnit.y : this.rectCenter(targetBuilding.rect).y;
    const distance = Math.hypot(tx - sx, ty - sy);
    const chance = attacker.def.projectile
      ? Math.max(Combat.MinHitChance, (attacker.def.accuracy || 1) * (distance / Math.max(0.5, attacker.def.range) > 0.4 ? 0.6 : 1))
      : 1;
    this.projectiles.push({
      id: this.projectileSeq++,
      x: sx, y: sy, z: 0.6, sx, sy, tx, ty,
      targetUnit: targetUnit ? targetUnit.handle : -1,
      targetBuilding: targetBuilding ? targetBuilding.handle : -1,
      progress: 0,
      speed: Math.max(4, attacker.def.projectile),
      damage: attacker.def.damage * Combat.RangedScale,
      damageType: targetBuilding ? 'siege' : attacker.def.damageType,
      team: attacker.team,
      arc: distance * Combat.ProjectileArcHeightPerCell * (attacker.def.role === 'siege' ? 2.4 : 1),
      splash: attacker.def.splash || 0,
      hitChance: chance,
      buildingMultiplier: targetBuilding ? (attacker.def.buildingMultiplier || 1) : 1,
    });
  }

  stepProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const targetUnit = p.targetUnit >= 0 ? this.unitByHandle(p.targetUnit) : null;
      if (targetUnit && targetUnit.alive) { p.tx = targetUnit.x; p.ty = targetUnit.y; }
      const distance = Math.hypot(p.tx - p.sx, p.ty - p.sy) || 0.001;
      p.progress += (p.speed * dt) / distance;
      if (p.progress < 1) {
        p.x = p.sx + (p.tx - p.sx) * p.progress;
        p.y = p.sy + (p.ty - p.sy) * p.progress;
        p.z = 0.6 + p.arc * 4 * p.progress * (1 - p.progress);
        continue;
      }

      // Impact.
      if (p.splash > 0) {
        for (const u of this.units) {
          if (!u.alive || u.team === p.team) continue;
          if (Math.hypot(u.x - p.tx, u.y - p.ty) > p.splash) continue;
          this.hurtUnit(u, p.damage * 0.6, p.damageType, p.team);
        }
        for (const b of this.buildings) {
          if (b.rubble || b.team === p.team) continue;
          const c = this.rectCenter(b.rect);
          if (Math.hypot(c.x - p.tx, c.y - p.ty) > p.splash + 0.5) continue;
          this.damageBuilding(b, p.damage * 0.8, p.damageType, p.team);
        }
        this.events.push({ type: 'impact', x: p.tx, y: p.ty });
      } else if (targetUnit && targetUnit.alive) {
        if (this.rng.chance(p.hitChance)) {
          this.hurtUnit(targetUnit, p.damage, p.damageType, p.team);
          this.events.push({ type: 'hit', x: p.tx, y: p.ty });
        } else {
          this.events.push({ type: 'miss', x: p.tx, y: p.ty });
        }
      } else {
        const building = this.buildings.find((b) => b.handle === p.targetBuilding);
        if (building && !building.rubble) this.damageBuilding(building, p.damage * (p.buildingMultiplier || 1), p.damageType, p.team);
      }

      this.projectiles.splice(i, 1);
    }
  }

  hurtUnit(unit, amount, damageType, team) {
    if (!unit.alive) return;
    unit.hp -= amount * damageMultiplier(damageType, unit.def.armor);
    unit.flash = 1;
    unit.combatTimer = 3;
    if (unit.hp <= 0) this.killUnit(unit, team === TEAM.PLAYER);
  }

  // ---------------------------------------------------------------- AI
  stepCommander(dt) {
    this.commanderTimer -= dt;
    const think = this.commanderTimer <= 0;
    if (think) this.commanderTimer = Ai.RepathInterval;

    const objective = this.chooseObjective();
    if (!objective) return;
    const target = this.rectCenter(objective.rect);

    const ground = this.flowFields.field(NAV.GROUND, { x: Math.floor(target.x), y: Math.floor(target.y) });
    const bypass = this.flowFields.field(NAV.BYPASS, { x: Math.floor(target.x), y: Math.floor(target.y) });
    const wide = this.flowFields.field(NAV.WIDE, { x: Math.floor(target.x), y: Math.floor(target.y) });
    ground.step(300); bypass.step(120); wide.step(120);
    this.flowFields.step(600);

    for (const unit of this.units) {
      if (!unit.alive || unit.team !== TEAM.ENEMY) continue;
      this.commandEnemy(unit, dt, think, objective, ground, bypass, wide);
    }
  }

  chooseObjective() {
    let current = this.buildings.find((b) => b.handle === this.focusTargetHandle);
    if (current && !current.rubble) return current;

    let bestGate = null, bestWall = null, bestGateDist = Infinity, bestWallDist = Infinity;
    let keep = null;
    for (const b of this.buildings) {
      if (b.team !== TEAM.PLAYER || b.rubble || b.site) continue;
      const c = this.rectCenter(b.rect);
      const d = Math.hypot(c.x - this.enemyCamp.x, c.y - this.enemyCamp.y);
      if (b.def.isKeep) keep = b;
      if (b.def.isGate && d < bestGateDist) { bestGateDist = d; bestGate = b; }
      if (b.def.isWall && d < bestWallDist) { bestWallDist = d; bestWall = b; }
    }
    const objective = bestGate || bestWall || keep;
    this.focusTargetHandle = objective ? objective.handle : -1;
    return objective;
  }

  commandEnemy(unit, dt, think, objective, ground, bypass, wide) {
    // Retreat when badly hurt: broken units fall back to the camp, patch
    // themselves up behind the tents, then rejoin the next push.
    const campDistance = Math.hypot(unit.x - (this.enemyCamp.x + 0.5), unit.y - (this.enemyCamp.y + 0.5));
    const atCamp = campDistance <= Ai.CampHealRadius;

    if (unit.hp / unit.maxHp < Ai.FleeThresholdPct && !unit.retreating) {
      unit.retreating = true;
      unit.retreatCount++;
      const camp = this.nav.findWalkableNear(this.enemyCamp.x, this.enemyCamp.y, NAV.GROUND, 6);
      if (camp) this.assignPath(unit, camp);
      return;
    }
    if (unit.retreating) {
      unit.regroupTimer += dt;
      if (atCamp) unit.hp = Math.min(unit.maxHp, unit.hp + Ai.CampHealPerSecond * dt);
      const deserting = unit.retreatCount > Ai.MaxRetreats && unit.regroupTimer >= Ai.DesertSeconds;
      if (deserting || unit.regroupTimer >= Ai.DesertSeconds * 2) {
        unit.retreating = false;
        this.killUnit(unit, false);
        this.toast('A broken raider slips away from the camp');
        return;
      }
      if (unit.hp / unit.maxHp > 0.55) {
        unit.retreating = false;
        unit.regroupTimer = 0;
      } else {
        if (!unit.path.length || think) {
          const camp = this.nav.findWalkableNear(this.enemyCamp.x, this.enemyCamp.y, NAV.GROUND, 6);
          if (camp) this.assignPath(unit, camp);
        }
        return;
      }
    }

    const center = this.rectCenter(objective.rect);

    // Siege engines: advance to standoff range, then bombard.
    if (unit.def.role === 'siege') {
      const distance = Math.hypot(center.x - unit.x, center.y - unit.y);
      const tower = this.nearestDefensiveTower(objective);
      let standoff = Math.max(2, unit.def.range * (unit.def.id === 'catapult' ? 0.95 : Ai.RangedStandoffFactor));
      if (tower) standoff = Math.max(standoff, tower.def.defense.range + 1.5);
      if (distance > standoff) {
        this.followField(unit, wide, think);
        return;
      }
      unit.targetBuilding = objective.handle;
      return;
    }

    // Laddermen head for a wall stretch away from towers, using wall-bypass
    // navigation so their path crosses the rampart instead of walking around it.
    if (unit.def.bypassWalls) {
      const breach = this.findWallSectionAwayFromTowers() || center;
      const distance = Math.hypot(breach.x - unit.x, breach.y - unit.y);
      if (distance > 1.6) {
        if (think || !unit.path.length) {
          this.assignPath(unit, { x: Math.floor(breach.x), y: Math.floor(breach.y) }, NAV.BYPASS);
        }
        return;
      }
      unit.targetBuilding = objective.handle;
      return;
    }

    // Everything else: follow the cheapest flow toward the objective.
    this.followField(unit, ground, think);
  }

  followField(unit, field, think) {
    if (!think && unit.path.length) return;
    const cellX = Math.floor(unit.x), cellY = Math.floor(unit.y);
    // Standing on a blocked cell (a tent grew around the unit, a wall collapsed
    // into its footprint): step back out onto the nav surface first.
    if (!this.nav.walkable(cellX, cellY, field.profile)) {
      const escape = this.nav.findWalkableNear(cellX, cellY, field.profile, 8);
      if (escape) this.assignPath(unit, escape);
      return;
    }
    const next = field.nextStep(cellX, cellY);
    if (!next) return;
    if (next.x === Math.floor(unit.x) && next.y === Math.floor(unit.y)) return;
    this.assignPath(unit, next);
    unit.order = 'attackMove';
  }

  nearestDefensiveTower(objective) {
    let best = null, bestDist = Infinity;
    const center = this.rectCenter(objective.rect);
    for (const b of this.buildings) {
      if (b.team !== TEAM.PLAYER || b.rubble || b.site || !b.def.defense) continue;
      const c = this.rectCenter(b.rect);
      const d = Math.hypot(c.x - center.x, c.y - center.y);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  findWallSectionAwayFromTowers() {
    let best = null, bestScore = -Infinity;
    for (const b of this.buildings) {
      if (b.team !== TEAM.PLAYER || b.rubble || !b.def.isWall) continue;
      const c = this.rectCenter(b.rect);
      const tower = this.nearestDefensiveTower(b);
      const towerDist = tower ? Math.hypot(this.rectCenter(tower.rect).x - c.x, this.rectCenter(tower.rect).y - c.y) : 99;
      const toCamp = Math.hypot(c.x - this.enemyCamp.x, c.y - this.enemyCamp.y);
      const score = towerDist * 2 - toCamp * 0.4;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // ---------------------------------------------------------------- waves
  stepWaves(dt) {
    if (this.waveIndex >= WAVES.length) return;

    if (!this.waveActive) {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave();
      return;
    }

    const alive = this.activeWaveUnits.some((u) => u.alive);
    if (!alive) this.completeWave();
  }

  startWave() {
    const wave = WAVES[this.waveIndex];
    this.activeWaveUnits = [];
    let index = 0;
    for (const [unitId, count] of wave.squads) {
      const def = UNITS[unitId];
      for (let i = 0; i < count; i++) {
        const ring = 1 + Math.floor(index / 8);
        const angles = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];
        const [ox, oy] = angles[index % 8];
        const spot = this.nav.findWalkableNear(this.enemyCamp.x + ox * ring, this.enemyCamp.y + oy * ring,
                                               def.clearance === 2 ? NAV.WIDE : NAV.GROUND, 8) ||
                     this.nav.findWalkableNear(this.enemyCamp.x, this.enemyCamp.y, NAV.GROUND, 10);
        const unit = this.spawnUnit(def, TEAM.ENEMY, (spot ? spot.x : this.enemyCamp.x) + 0.5,
                                     (spot ? spot.y : this.enemyCamp.y) + 0.5);
        if (unit) {
          unit.order = 'attackMove';
          this.activeWaveUnits.push(unit);
        }
        index++;
      }
    }
    this.waveActive = true;
    this.toast(`Wave ${this.waveIndex + 1}: ${wave.title} is marching on your castle!`, 'danger');
    this.events.push({ type: 'waveStarted', waveIndex: this.waveIndex, title: wave.title });
  }

  completeWave() {
    const wave = WAVES[this.waveIndex];
    this.waveActive = false;
    this.wavesCleared++;
    this.addResource('gold', wave.gold, TEAM.PLAYER);
    this.toast(`Wave ${this.waveIndex + 1} repelled! +${wave.gold} gold`, 'success');
    this.waveIndex++;
    if (this.waveIndex >= WAVES.length) {
      this.triggerVictory('The Castle Stands!',
        `You repelled all six sieges. Enemies slain: ${this.score.enemiesKilled}`);
      return;
    }
    this.waveTimer = WAVES[this.waveIndex].delay;
  }

  stepCorpses(dt) {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const unit = this.units[i];
      if (unit.alive) continue;
      unit.deathTimer -= dt;
      if (unit.deathTimer > 0) continue;
      for (const b of this.buildings) {
        if (b.garrison.length) b.garrison = b.garrison.filter((h) => h !== unit.handle);
      }
      this.units.splice(i, 1);
    }
  }

  stepObjectives() {
    if (this.objectives.enemyCampDestroyed &&
        !this.buildings.some((b) => b.team === TEAM.ENEMY && !b.rubble)) {
      if (this.state === STATE.PLAYING) {
        this.triggerVictory('Counter-Attack Victorious!', 'You burned the raider camp to the ground.');
      }
    }
  }

  secondsUntilWave() {
    return this.waveActive ? 0 : Math.max(0, this.waveTimer);
  }
}
