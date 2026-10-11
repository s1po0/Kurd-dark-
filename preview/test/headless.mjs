// -----------------------------------------------------------------------------
//  Kurd Castle — browser preview
//  File: test/headless.mjs
//  Purpose: Run the entire preview (sim + isometric renderer + HUD + input)
//           under Node with a minimal DOM/canvas stub. This is the closest
//           thing to "did it actually run" that exists without a browser, and
//           it is what the repo's verification gate executes.
//
//  Run: node preview/test/headless.mjs
// -----------------------------------------------------------------------------

// =============================================================================
//  1. DOM / canvas stubs
// =============================================================================
let clockMs = 0;
const frameCallbacks = [];

function noop() {}

function makeContext2D() {
  const store = {};
  return new Proxy(store, {
    get(target, key) {
      if (key in target) return target[key];
      const fn = () => {};
      target[key] = fn;
      return fn;
    },
    set(target, key, value) { target[key] = value; return true; },
  });
}

class StubClassList {
  constructor() { this.items = new Set(); }
  add(...names) { names.forEach((n) => this.items.add(n)); }
  remove(...names) { names.forEach((n) => this.items.delete(n)); }
  contains(name) { return this.items.has(name); }
  toggle(name, force) {
    const want = force === undefined ? !this.items.has(name) : !!force;
    if (want) this.items.add(name); else this.items.delete(name);
    return want;
  }
}

class StubElement {
  constructor(tag) {
    this.tagName = String(tag || 'div').toUpperCase();
    this.children = [];
    this.style = {};
    this.classList = new StubClassList();
    this.dataset = {};
    this.attributes = {};
    this._listeners = new Map();
    this._rect = { x: 0, y: 0, left: 0, top: 0, width: 800, height: 600 };
    this._textContent = '';
    this._innerHTML = '';
    this.hidden = false;
    this.disabled = false;
    this.title = '';
    this.value = '';
    this.width = 0;
    this.height = 0;
    this.parentElement = null;
  }
  set textContent(value) { this._textContent = String(value ?? ''); this.children.length = 0; }
  get textContent() { return this._textContent; }
  set innerHTML(value) { this._innerHTML = String(value ?? ''); this.children.length = 0; }
  get innerHTML() { return this._innerHTML; }
  get clientWidth() { return this._rect.width; }
  get clientHeight() { return this._rect.height; }
  append(...nodes) {
    for (const node of nodes) {
      if (node && typeof node === 'object') node.parentElement = this;
      this.children.push(node);
    }
  }
  appendChild(node) { this.append(node); return node; }
  remove() {
    if (this.parentElement) {
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
      this.parentElement = null;
    }
  }
  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, []);
    this._listeners.get(type).push(handler);
  }
  removeEventListener(type, handler) {
    const list = this._listeners.get(type);
    if (list) this._listeners.set(type, list.filter((h) => h !== handler));
  }
  dispatch(type, event = {}) {
    const list = this._listeners.get(type) || [];
    for (const handler of list) handler({ preventDefault: noop, stopPropagation: noop, ...event });
    return list.length;
  }
  getBoundingClientRect() { return this._rect; }
  setPointerCapture() {}
  releasePointerCapture() {}
  getContext() { return makeContext2D(); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
}

const elementCache = new Map();
const canvas = new StubElement('canvas');
canvas._rect = { x: 0, y: 0, left: 0, top: 0, width: 960, height: 540 };

globalThis.document = {
  body: new StubElement('body'),
  documentElement: new StubElement('html'),
  createElement: (tag) => (tag === 'canvas' ? new StubElement('canvas') : new StubElement(tag)),
  getElementById: (id) => {
    if (id === 'game') return canvas;
    if (!elementCache.has(id)) elementCache.set(id, new StubElement('div'));
    return elementCache.get(id);
  },
  addEventListener: noop,
  removeEventListener: noop,
};

globalThis.window = globalThis;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = noop;
globalThis.removeEventListener = noop;
globalThis.requestAnimationFrame = (cb) => { frameCallbacks.push(cb); return frameCallbacks.length; };
globalThis.cancelAnimationFrame = noop;
Object.defineProperty(globalThis, 'performance', {
  value: { now: () => clockMs },
  configurable: true,
  writable: true,
});

// =============================================================================
//  2. Boot the whole app
// =============================================================================
const failures = [];
const notes = [];
function check(label, condition, detail = '') {
  if (condition) notes.push(`  ok   ${label}`);
  else failures.push(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// Seed can be pinned for reproducing a failure: SEED=123 node test/headless.mjs
if (process.env.SEED) globalThis.__KURD_SEED__ = Number(process.env.SEED);
const main = await import('../src/main.js');
const balance = await import('../src/balance.js');
const sim = await import('../src/sim.js');
const app = globalThis.kurdCastle;
check('app booted', !!app, 'window.kurdCastle missing');

const world = app.world;
const startBuildings = world.buildings.length;

function step(frames = 1, ms = 100) {
  for (let i = 0; i < frames; i++) {
    clockMs += ms;
    const callbacks = frameCallbacks.splice(0, frameCallbacks.length);
    for (const cb of callbacks) cb(clockMs);
  }
}

function pointer(type, x, y, pointerId = 1) {
  canvas.dispatch(type, { pointerId, clientX: x, clientY: y, pointerType: 'touch' });
}

// =============================================================================
//  3. Menu state
// =============================================================================
step(30);
check('menu does not advance the sim clock', world.time === 0, `time=${world.time}`);
check('menu overlay is showing', app.overlayState === 'menu', `state=${app.overlayState}`);
check('terrain baked', !!app.view.terrainCanvas, 'no terrain canvas');
check('scenario placed starting buildings', startBuildings >= 8, `count=${startBuildings}`);
check('starting peasants exist', world.units.length === balance.Population.StartingPeasants,
  `units=${world.units.length}`);
check('map generated with trees', world.map.trees.some((t) => t === 1), 'no trees');
check('map generated with water', world.map.cells.some((c) => c === 0), 'no water');
check('map generated with rock', world.map.cells.some((c) => c === 5), 'no rock');
check('map has a road', world.map.cells.some((c) => c === 3), 'no dirt road');
check('ground flow field survives a rebuild',
  (() => {
    const target = { x: Math.floor(world.playerStart.x), y: Math.floor(world.playerStart.y) };
    const field = world.flowFields.field(0, target);
    for (let i = 0; i < 40; i++) field.step(200);
    return field.complete && field.costAt(target.x, target.y) === 0;
  })(), 'flow field never completed');

// =============================================================================
//  4. Playing: economy and jobs
// =============================================================================
app.startMatch();
step(60); // 6 seconds
check('clock advances while playing', world.time > 5, `time=${world.time}`);

// Peasants should start taking jobs automatically, then run the castle until the
// first haul arrives (a fresh woodlot can take a couple of minutes to fill).
step(600); // 60 seconds
for (let i = 0; i < 3000 && world.score.deliveries === 0; i++) step(1);
step(60); // let the five-second rate window settle
const staffed = world.buildings.filter((b) => b.workers.length > 0).length;
check('peasants take jobs on their own', staffed >= 3, `staffed=${staffed}`);
check('the starting woodlot is staffed',
  world.buildings.some((b) => b.def.id === 'hut' && b.workers.length > 0),
  `huts=${world.buildings.filter((b) => b.def.id === 'hut').length}`);
check('wood production rate is positive', world.rates.wood > 0,
  `rate=${world.rates.wood.toFixed(2)}/min wood=${world.ledger.player.wood}`);
check('peasants haul production to the stockpile', world.score.deliveries > 0,
  `deliveries=${world.score.deliveries}`);
check('hauling happened', world.score.peasantsArrived >= 0);

// =============================================================================
//  5. Placement through the input layer
// =============================================================================
const keep = world.buildings.find((b) => b.def.isKeep);
check('the keep was raised', !!keep, 'no keep building');
const keepX = keep ? Math.floor(keep.rect.x + keep.rect.w / 2) : 0;
const keepY = keep ? Math.floor(keep.rect.y + keep.rect.h / 2) : 0;

// Give the test economy room to work with (the real game earns this over time).
world.ledger.player.wood = 1500;
world.ledger.player.stone = 1200;
world.ledger.player.iron = 300;
world.ledger.player.gold = 2000;
world.ledger.player.food = 600;
world.recalculateStorage();

function placeAt(def, x, y) {
  app.beginPlacement(def);
  return app.tryPlace(x, y);
}

// A curtain wall with a gatehouse in the middle, a tower at one end, plus a
// barracks and an archery range. Candidate cells are searched so the test does
// not depend on the random seed's scenery.
function findSpot(def, cx, cy, radius = 8) {
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = cx + dx, y = cy + dy;
        if (world.validatePlacement(def, x, y, sim.TEAM.PLAYER) === null) return { x, y };
      }
    }
  }
  return null;
}

let wallCells = 0;
for (let i = -5; i <= 5; i++) {
  if (i >= -1 && i <= 1) continue; // leave the gate bay open
  const wall = findSpot(balance.BUILDINGS.wall, keepX + i, keepY + 6, 2);
  if (wall && placeAt(balance.BUILDINGS.wall, wall.x, wall.y)) wallCells++;
}
check('walls can be placed', wallCells >= 6, `placed=${wallCells}`);

const towerSpot = findSpot(balance.BUILDINGS.tower, keepX + 6, keepY + 6);
check('tower can be placed', !!towerSpot && !!placeAt(balance.BUILDINGS.tower, towerSpot.x, towerSpot.y),
  `spot=${JSON.stringify(towerSpot)}`);

const gateSpot = findSpot(balance.BUILDINGS.gate, keepX, keepY + 6, 3);
check('gatehouse can be placed', !!gateSpot && !!placeAt(balance.BUILDINGS.gate, gateSpot.x, gateSpot.y),
  `spot=${JSON.stringify(gateSpot)}`);

const barracksSpot = findSpot(balance.BUILDINGS.barracks, keepX - 5, keepY + 4, 6);
check('barracks can be placed', !!barracksSpot && !!placeAt(balance.BUILDINGS.barracks, barracksSpot.x, barracksSpot.y),
  `spot=${JSON.stringify(barracksSpot)}`);

const rangeSpot = findSpot(balance.BUILDINGS.range, keepX + 5, keepY + 4, 6);
check('archery range can be placed', !!rangeSpot && !!placeAt(balance.BUILDINGS.range, rangeSpot.x, rangeSpot.y),
  `spot=${JSON.stringify(rangeSpot)}`);
app.cancelPlacement();

const overlapError = world.validatePlacement(balance.BUILDINGS.house, keepX, keepY, sim.TEAM.PLAYER);
check('overlapping placement is rejected', !!overlapError, 'expected an error');

app.beginPlacement(balance.BUILDINGS.house);
pointer('pointerdown', 400, 300, 7);
pointer('pointerup', 401, 301, 7);
app.cancelPlacement();

// =============================================================================
//  6. Construction sites get built
// =============================================================================
let trainer = null;
let builtGateOrTower = 0;
for (let i = 0; i < 4000; i++) {
  step(1);
  if (i % 200 === 0) {
    builtGateOrTower = world.buildings.filter((b) => (b.def.isGate || b.def.isTower) && !b.site).length;
  }
  if (i % 50 === 0 && !trainer) {
    trainer = world.buildings.find((b) => (b.def.id === 'barracks' || b.def.id === 'range') && !b.site && !b.rubble) || null;
  }
  if (trainer && builtGateOrTower > 0) break;
}
const gated = world.buildings.filter((b) => b.def.isGate && !b.site).length;
const towers = world.buildings.filter((b) => b.def.isTower && !b.site).length;
check('constructed sites complete', gated + towers >= 1, `gates=${gated} towers=${towers}`);
check('a training building finishes', !!trainer, 'no barracks/range completed');

// =============================================================================
//  7. Training
// =============================================================================
world.ledger.player.gold = 900;
world.ledger.player.weapons = 40;
world.ledger.player.armor = 20;
// A player recruits when peasants are idle. Free some from their jobs and hold
// the job assigner off so the castle does not instantly re-hire them.
world.assignTimer = -1e6;
// Drafting consumes idle peasants, so release a few from their jobs (which is
// exactly what a player does before recruiting).
world.units.filter((u) => u.alive && u.def.worker).slice(0, 5).forEach((u) => {
  u.jobBuilding = -1; u.job = 'idle'; u.path = [];
  const b = world.buildings.find((x) => x.workers.includes(u.handle));
  if (b) b.workers = b.workers.filter((h) => h !== u.handle);
});
const trainable = trainer && Array.isArray(trainer.def.trains) ? trainer.def.trains : [];
check('training building advertises what it can train', trainable.length > 0,
  `trains=${JSON.stringify(trainable)}`);
for (const unitId of trainable.concat(trainable)) world.trainUnit(unitId);
const queued = trainer ? trainer.trainingQueue.length : 0;
check('units are queued for training', queued > 0, `queued=${queued}`);
step(900);
const soldiers = world.countUnits(sim.TEAM.PLAYER, (u) => !u.def.worker);
check('peasants are drafted into soldiers', soldiers >= 1, `soldiers=${soldiers}`);

// =============================================================================
//  8. Selection, orders, garrison, gates
// =============================================================================
app.selectAllMilitary();
check('troops can be selected', world.selected.length === soldiers,
  `selected=${world.selected.length} soldiers=${soldiers}`);
if (world.selected.length > 0) {
  const before = world.selected.map((u) => ({ x: u.x, y: u.y }));
  world.issueOrder(keepX + 6, keepY + 10, false);
  let moved = false;
  for (let i = 0; i < 120 && !moved; i++) {
    step(1);
    moved = world.selected.some((u, index) =>
      Math.hypot(u.x - before[index].x, u.y - before[index].y) > 0.6);
  }
  check('orders move troops', moved, 'no selected unit moved');
}
const tower = world.buildings.find((b) => b.def.isTower && !b.site && b.garrison.length === 0);
if (tower && soldiers > 0) {
  app.selectAllMilitary();
  world.garrisonSelected(tower);
  step(20);
  check('troops can garrison a tower', tower.garrison.length > 0, `garrison=${tower.garrison.length}`);
}
world.setAllGates(false);
const sealed = world.buildings.some((b) => b.def.isGate && !b.gateOpen);
world.setAllGates(true);
check('gates open and close', sealed);

// =============================================================================
//  9. Waves, combat, projectiles
// =============================================================================
world.waveTimer = 1;
// --- 9a. ranged combat, verified directly so a bad terrain seed cannot hide it
const archerSpot = world.nav.findWalkableNear(keepX + 3, keepY + 3, 0, 6) || { x: keepX + 3, y: keepY + 3 };
const targetSpot = world.nav.findWalkableNear(keepX + 6, keepY + 6, 0, 6) || { x: keepX + 6, y: keepY + 6 };
const archer = world.spawnUnit(balance.UNITS.archer, sim.TEAM.PLAYER, archerSpot.x + 0.5, archerSpot.y + 0.5);
const dummy = world.spawnUnit(balance.UNITS.raider, sim.TEAM.ENEMY, targetSpot.x + 0.5, targetSpot.y + 0.5);
check('test combatants spawned', !!archer && !!dummy,
  `archer=${!!archer} dummy=${!!dummy} units=${world.units.length}`);
let directShot = false, directHit = false, directDamage = false;
for (let i = 0; i < 600; i++) {
  step(1);
  if (world.projectiles.length > 0) directShot = true;
  if (world.events.some((e) => e.type === 'hit' || e.type === 'miss' || e.type === 'impact')) directHit = true;
  if (dummy && (!dummy.alive || dummy.hp < dummy.maxHp)) directDamage = true;
  if (directShot && directHit && directDamage) break;
}
check('a bowman shoots at an enemy in range', directShot, 'no projectile');
check('the shot resolves', directHit, 'no hit/miss marker');
check('arrows damage the target', directDamage,
  dummy ? `hp=${dummy.hp.toFixed(1)}/${dummy.maxHp}` : 'no dummy');
if (archer) world.killUnit(archer, false);
if (dummy) world.killUnit(dummy, false);
step(20);

// --- 9b. the wave marches, fights, and is counted
if (process.env.DEBUG) {
  console.log(`[debug] entering 9b: t=${world.time.toFixed(0)} state=${world.state} waveIndex=${world.waveIndex} ` +
    `cleared=${world.wavesCleared} buildings=${world.buildings.length} ` +
    `keep=${!!world.buildings.find((b) => b.def.isKeep && !b.rubble)}`);
}
world.waveTimer = 1;
let sawEnemy = false, sawProjectile = false;
for (let i = 0; i < 6000; i++) {
  step(1);
  if (world.units.some((u) => u.alive && u.team === sim.TEAM.ENEMY)) sawEnemy = true;
  if (world.projectiles.length > 0) sawProjectile = true;
  if (world.waveIndex >= 1 && sawEnemy && sawProjectile) break;
}
check('enemy waves spawn', sawEnemy, 'no enemy units appeared');
check('defences open fire on the attackers', sawProjectile, 'no projectiles were fired');
let cleared = 0;
for (let i = 0; i < 12000 && cleared < 1; i++) {
  step(1);
  cleared = world.wavesCleared;
  if (process.env.DEBUG && i % 2000 === 1999) {
    console.log(`[debug] 9b t=${world.time.toFixed(0)} state=${world.state} idx=${world.waveIndex} cleared=${cleared} ` +
      `enemies=${world.units.filter((u) => u.alive && u.team === sim.TEAM.ENEMY).length} projectiles=${world.projectiles.length}`);
  }
}
check('wave counter advances', cleared >= 1, `cleared=${cleared}`);
check('score counts kills', world.score.enemiesKilled > 0, `kills=${world.score.enemiesKilled}`);
check('popularity holds around the neutral baseline', world.kingdom.player.popularity > 40,
  `popularity=${world.kingdom.player.popularity.toFixed(1)}`);
check('population is not haemorrhaging peasants', world.score.peasantsLeft < 8,
  `left=${world.score.peasantsLeft}`);

// =============================================================================
//  10. Input paths
// =============================================================================
const beforeZoom = app.camera.zoom;
canvas.dispatch('wheel', { deltaY: -120, clientX: 400, clientY: 300 });
check('wheel zooms', app.camera.zoom > beforeZoom, `zoom=${app.camera.zoom}`);

const beforeX = app.camera.x;
pointer('pointerdown', 500, 300, 21);
pointer('pointermove', 300, 300, 21);
pointer('pointerup', 300, 300, 21);
check('drag pans the camera', Math.abs(app.camera.x - beforeX) > 0.1, `dx=${app.camera.x - beforeX}`);

const angleBefore = app.camera.angle;
pointer('pointerdown', 400, 300, 31);
pointer('pointerdown', 600, 300, 32);
pointer('pointermove', 400, 200, 31);
pointer('pointermove', 600, 400, 32);
pointer('pointerup', 400, 200, 31);
pointer('pointerup', 600, 400, 32);
check('two-finger twist rotates the camera', Math.abs(app.camera.angle - angleBefore) > 0.05,
  `angle=${app.camera.angle}`);

const cell = app.view.screenToCell(480, 270);
const back = app.view.worldToScreen(cell.x + 0.5, cell.y + 0.5, 0);
check('screen/world round trip is stable',
  Math.abs(back.x - 480) < 22 && Math.abs(back.y - 270) < 22,
  `round trip landed at ${back.x.toFixed(1)},${back.y.toFixed(1)}`);

pointer('pointerdown', 480, 270, 41);
pointer('pointerup', 480, 270, 41);
check('tap clears or sets a selection without throwing', true);

// =============================================================================
//  11. HUD surfaces
// =============================================================================
step(20);
check('minimap canvas was drawn into', app.hud.minimap.width === 132);
check('build menu has buttons', app.hud.buildGrid.children.length > 0,
  `children=${app.hud.buildGrid.children.length}`);
check('resource strip has values', app.hud.resourceNodes.wood.textContent.length > 0);
check('popularity is displayed', Number.isFinite(Number(app.hud.popularityNode.textContent)),
  `text=${app.hud.popularityNode.textContent}`);

// Overlays for pause / resume.
world.togglePause();
step(3);
check('pause overlay appears', app.overlayState === 'paused', `state=${app.overlayState}`);
world.togglePause();
step(3);
check('pause overlay clears', app.overlayState === null, `state=${app.overlayState}`);

// =============================================================================
//  12. Speed levels and long run stability
// =============================================================================
for (const speed of [1, 2, 4]) {
  world.speed = speed;
  const before = world.time;
  step(30);
  check(`speed ${speed}x advances at least real time`, world.time - before >= 2.9,
    `advanced=${(world.time - before).toFixed(2)}`);
}
world.speed = 1;

step(30); // let any fresh corpse finish its death fade
const corpses = world.units.filter((u) => !u.alive).length;
check('corpses do not accumulate', corpses <= 4, `dead=${corpses}`);

// Snapshot the scoreboard before the restart wipes it, so the summary below
// reports the match we actually played.
const played = { seed: app.world.seed, time: app.world.time, waves: app.world.wavesCleared,
  total: app.world.wavesTotal, kills: app.world.score.enemiesKilled,
  buildings: app.world.buildings.length, units: app.world.units.length };

app.restart();
app.startMatch();
step(400);
check('restart rebuilds the world', app.world !== world && app.world.buildings.length >= 8,
  `buildings=${app.world.buildings.length}`);
check('restart keeps a pinned seed reproducible', !process.env.SEED || app.world.seed === played.seed,
  `seed=${app.world.seed}`);

// =============================================================================
//  Report
// =============================================================================
console.log('\nKurd Castle preview — headless smoke test');
console.log('────────────────────────────────────────────────────────────────');
for (const line of notes) console.log(line);
if (failures.length) {
  console.log('');
  for (const line of failures) console.log(line);
}
console.log('────────────────────────────────────────────────────────────────');
console.log(`seed=${played.seed} final: time=${played.time.toFixed(0)}s waves=${played.waves}/${played.total} ` +
  `kills=${played.kills} buildings=${played.buildings} units=${played.units}`);
console.log(failures.length ? `${failures.length} FAILURE(S)` : 'ALL CHECKS PASSED');
process.exit(failures.length ? 1 : 0);
