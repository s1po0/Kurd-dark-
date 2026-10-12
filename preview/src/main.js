// -----------------------------------------------------------------------------
//  Kurd Castle — browser preview
//  File: main.js
//  Purpose: Boot, fixed-step game loop and every input path: drag-pan,
//           edge-drag, pinch zoom, two-finger twist, tap select/place,
//           double-tap focus, long-press attack-move, desktop shortcuts.
// -----------------------------------------------------------------------------

import { World, STATE, TEAM } from './sim.js';
import { IsoView, TILE_W } from './render.js';
import { Hud } from './ui.js';
import { Camera, Ui, GameName } from './balance.js';

const TICK = 0.1;

class App {
  constructor() {
    this.canvas = document.getElementById('game');
    // A fixed seed can be injected for reproducible test runs.
    this.seed = (Number(globalThis.__KURD_SEED__) | 0) || ((Math.random() * 0x7fffffff) | 0);
    this.world = new World(this.seed);
    this.view = new IsoView(this.canvas, this.world);
    this.camera = this.view.camera;
    this.camera.zoom = 1.15;
    this.hud = new Hud(this);
    this.view.bakeTerrain();

    this.placing = null;
    this.pointers = new Map();
    this.dragPointer = null;
    this.pinch = null;
    this.longPress = null;
    this.lastTap = { time: -10, x: 0, y: 0 };
    this.hoverCell = null;
    this.camera.focus(this.world.playerStart.x, this.world.playerStart.y, true);

    this.bindInput();
    this.lockLandscape();
    this.hud.showOverlay('menu');

    this.last = performance.now();
    this.accumulator = 0;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  /**
   * The Android build is locked to landscape-left; browsers only allow the same
   * lock from a full-screen or installed context, so failure is expected and
   * harmless — the CSS portrait hint covers the rest.
   */
  lockLandscape() {
    try {
      const so = typeof screen !== 'undefined' && screen.orientation;
      if (so && typeof so.lock === 'function') {
        const p = so.lock('landscape');
        if (p && p.catch) p.catch(() => {});
      }
    } catch (err) {
      /* ignore: not supported in this browser */
    }
  }

  // ===========================================================================
  //  Game loop
  // ===========================================================================
  frame(now) {
    let frameDt = (now - this.last) / 1000;
    this.last = now;
    if (!(frameDt > 0)) frameDt = 1 / 60;
    frameDt = Math.min(0.25, frameDt);

    this.accumulator += frameDt;
    let steps = 0;
    while (this.accumulator >= TICK && steps < 5) {
      this.world.update(TICK);
      this.accumulator -= TICK;
      steps++;
    }
    if (steps >= 5) this.accumulator = 0;

    this.updateCamera(frameDt);
    this.updateLongPress(now);
    this.updateHudState();

    this.view.ghost = this.placing && this.hoverCell
      ? { def: this.placing, cellX: this.hoverCell.x, cellY: this.hoverCell.y, valid: this.ghostValid, team: TEAM.PLAYER }
      : null;
    this.view.draw(frameDt);
    this.hud.update(frameDt);

    requestAnimationFrame(this.frame);
  }

  updateCamera(dt) {
    // Edge drag while a pointer is held near the screen border.
    const pointer = this.dragPointer !== null ? this.pointers.get(this.dragPointer) : null;
    if (pointer && this.pointers.size === 1) {
      const margin = Camera.EdgeDragMargin;
      let dx = 0, dy = 0;
      if (pointer.x < margin) dx = -1;
      else if (pointer.x > this.view.viewWidth - margin) dx = 1;
      if (pointer.y < margin) dy = -1;
      else if (pointer.y > this.view.viewHeight - margin) dy = 1;
      if (dx !== 0 || dy !== 0) {
        const amount = Camera.EdgeDragSpeed * dt;
        const before = this.view.screenToWorld(pointer.x, pointer.y);
        const after = this.view.screenToWorld(pointer.x + dx * amount, pointer.y + dy * amount);
        this.camera.panBy(before.x - after.x, before.y - after.y);
      }
    }
  }

  updateLongPress(now) {
    if (!this.longPress) return;
    if (this.longPress.fired) return;
    if (this.pointers.size !== 1) { this.longPress = null; return; }
    if ((now - this.longPress.started) / 1000 < Ui.LongPressDuration) return;
    this.longPress.fired = true;
    if (this.placing) return;
    if (this.world.selected.some((u) => u.alive && !u.def.worker)) {
      this.world.attackMove = true;
      this.hud.showToast('Attack-move armed — tap a target', 'info');
      this.hud.refresh(true);
    }
  }

  updateHudState() {
    const world = this.world;
    const want = world.state === STATE.MENU ? 'menu'
      : world.state === STATE.PAUSED ? 'paused'
        : world.state === STATE.VICTORY ? 'victory'
          : world.state === STATE.DEFEAT ? 'defeat' : null;
    if (this.overlayState === want) return;
    this.overlayState = want;
    if (want) this.hud.showOverlay(want);
    else this.hud.hideOverlay();
  }

  // ===========================================================================
  //  Placement / selection API used by the HUD
  // ===========================================================================
  beginPlacement(def) {
    this.placing = def;
    this.world.selectedBuilding = null;
    this.world.selected = [];
    this.world.selected.forEach((u) => { u.selected = false; });
    this.hud.showToast(`Placing ${def.name} — tap the map`, 'info');
    this.hud.refresh(true);
  }

  cancelPlacement() {
    if (!this.placing) return;
    this.placing = null;
    this.hoverCell = null;
    this.view.ghost = null;
    this.hud.refresh(true);
  }

  get ghostValid() {
    if (!this.placing || !this.hoverCell) return false;
    return this.world.validatePlacement(this.placing, this.hoverCell.x, this.hoverCell.y, TEAM.PLAYER) === null;
  }

  tryPlace(cellX, cellY) {
    const def = this.placing;
    if (!def) return false;
    const error = this.world.validatePlacement(def, cellX, cellY, TEAM.PLAYER);
    if (error) { this.hud.showToast(error, 'warning'); return false; }
    const placed = this.world.place(def, cellX, cellY, TEAM.PLAYER, false);
    if (!placed) return false;
    // Stay in placement mode so wall lines can be drawn in one pass.
    if (!this.world.canAfford(def.cost, TEAM.PLAYER)) {
      this.hud.showToast('Out of resources — placement cancelled', 'warning');
      this.cancelPlacement();
    } else {
      this.hud.refreshBuildMenu(true);
    }
    this.hud.refresh(true);
    return true;
  }

  selectAllMilitary() {
    const world = this.world;
    world.selectedBuilding = null;
    world.selected = world.units.filter((u) => u.alive && u.team === TEAM.PLAYER && !u.def.worker && !u.garrisoned);
    for (const u of world.units) u.selected = world.selected.includes(u);
    this.hud.showToast(`${world.selected.length} troops selected`, 'info');
  }

  selectIdlePeasants() {
    const world = this.world;
    world.selectedBuilding = null;
    world.selected = world.units.filter((u) => u.alive && u.team === TEAM.PLAYER && u.def.worker &&
                                            !u.garrisoned && u.job === 'idle');
    for (const u of world.units) u.selected = world.selected.includes(u);
    this.hud.showToast(`${world.selected.length} idle peasants selected`, 'info');
  }

  ping(x, y) {
    this.world.pings.push({ x, y, color: '#5fd67a', life: 1 });
  }

  startMatch() {
    this.world.state = STATE.PLAYING;
    this.hud.hideOverlay();
    this.hud.showToast('Your castle awaits. Build, feed, and fortify.', 'success');
    this.hud.showToast('Tip: build a Woodcutter\'s Hut near trees to start your economy.', 'info');
  }

  restart() {
    // A pinned seed stays pinned across restarts: that is what makes a failing
    // headless run reproducible from the command line (SEED=… node test/headless.mjs).
    const pinned = Number(globalThis.__KURD_SEED__);
    const seed = pinned ? (pinned | 0) : ((Math.random() * 0x7fffffff) | 0);
    this.seed = seed;
    this.world = new World(seed);
    this.view.world = this.world;
    this.view.terrainSignature = -1;
    this.view.buildingSprites.clear();
    this.hud.world = this.world;
    this.camera.focus(this.world.playerStart.x, this.world.playerStart.y, true);
    this.placing = null;
    this.hoverCell = null;
    this.view.bakeTerrain();
    this.view.camera.zoom = 1.15;
    this.hud.showOverlay('menu');
    this.hud.buildSignature = null;
  }

  // ===========================================================================
  //  Input
  // ===========================================================================
  bindInput() {
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      const point = this.pointerPoint(e);
      this.pointers.set(e.pointerId, { ...point, downTime: performance.now() });
      if (this.pointers.size === 1) {
        this.dragPointer = e.pointerId;
        this.longPress = { started: performance.now(), x: point.x, y: point.y, fired: false };
        this.moved = 0;
      } else if (this.pointers.size === 2) {
        this.longPress = null;
        this.pinch = this.pinchState();
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      const point = this.pointerPoint(e);
      const previous = this.pointers.get(e.pointerId);
      if (!previous) {
        // Hover (desktop) drives the placement ghost.
        this.hoverCell = this.view.screenToCell(point.x, point.y);
        return;
      }

      if (this.pointers.size === 1) {
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        this.moved += Math.hypot(dx, dy);
        if (this.moved > Ui.DragThresholdPixels) {
          this.longPress = null;
          const before = this.view.screenToWorld(previous.x, previous.y);
          const after = this.view.screenToWorld(point.x, point.y);
          this.camera.panBy(before.x - after.x, before.y - after.y);
          if (this.moved > Ui.DragThresholdPixels * 2) this.dragging = true;
        }
        this.pointers.set(e.pointerId, { ...previous, x: point.x, y: point.y });
        this.hoverCell = this.view.screenToCell(point.x, point.y);
        return;
      }

      this.pointers.set(e.pointerId, { ...previous, x: point.x, y: point.y });
      const pinch = this.pinchState();
      if (this.pinch && pinch.distance > 0 && this.pinch.distance > 0) {
        this.camera.zoomBy(pinch.distance / this.pinch.distance);
        let delta = pinch.angle - this.pinch.angle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;
        this.camera.angle += delta * 0.9;
      }
      this.pinch = pinch;
    });

    const release = (e) => {
      const pointer = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.dragPointer === e.pointerId) this.dragPointer = null;
      if (!pointer) return;

      const point = this.pointerPoint(e);
      const distance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
      const duration = (performance.now() - pointer.downTime) / 1000;
      const wasDrag = this.moved > Ui.DragThresholdPixels || this.dragging;
      const wasLongPress = this.longPress && this.longPress.fired;
      this.dragging = false;
      if (wasDrag || wasLongPress || distance > Ui.TapMaxMovementPixels || duration > 0.6) return;
      this.onTap(point.x, point.y);
    };

    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', (e) => { this.pointers.delete(e.pointerId); this.pinch = null; this.dragging = false; });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.camera.zoomBy(e.deltaY > 0 ? 0.9 : 1.1);
    }, { passive: false });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => this.view.resize());
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  pointerPoint(e) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  pinchState() {
    const points = [...this.pointers.values()];
    if (points.length < 2) return null;
    const [a, b] = points;
    return {
      distance: Math.hypot(b.x - a.x, b.y - a.y),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  }

  onTap(x, y) {
    const world = this.world;
    const now = performance.now() / 1000;
    const doubleTap = now - this.lastTap.time < Ui.DoubleTapWindow &&
                      Math.hypot(x - this.lastTap.x, y - this.lastTap.y) < 26;
    this.lastTap = { time: now, x, y };

    const cell = this.view.screenToCell(x, y);
    this.hoverCell = cell;

    if (doubleTap) {
      this.camera.focus(cell.x + 0.5, cell.y + 0.5);
      this.ping(cell.x + 0.5, cell.y + 0.5);
      return;
    }

    if (this.placing) {
      this.tryPlace(cell.x, cell.y);
      return;
    }

    const enemy = world.unitAt(cell.x + 0.5, cell.y + 0.5, 1.2);
    const building = world.buildingAt(cell.x, cell.y);
    const hasSelection = world.selected.some((u) => u.alive && !u.def.worker);

    if (hasSelection) {
      if (enemy && enemy.team === TEAM.ENEMY && enemy.alive) {
        this.orderAttack(enemy);
        return;
      }
      if (building && building.team === TEAM.ENEMY) {
        this.orderAttackBuilding(building);
        return;
      }
      if (building && building.team === TEAM.PLAYER) {
        this.selectBuilding(building);
        return;
      }
      world.issueOrder(cell.x, cell.y, world.attackMove);
      world.attackMove = false;
      this.hud.refresh(true);
      return;
    }

    if (enemy && enemy.team === TEAM.PLAYER && enemy.alive) {
      this.selectUnit(enemy);
      return;
    }
    if (building) {
      this.selectBuilding(building);
      return;
    }
    world.selectedBuilding = null;
    world.selected = [];
    for (const u of world.units) u.selected = false;
    this.hud.refresh(true);
  }

  orderAttack(target) {
    const world = this.world;
    let count = 0;
    for (const unit of world.selected) {
      if (!unit.alive || unit.def.worker) continue;
      unit.target = target.handle;
      unit.order = 'attackTarget';
      unit.path = [];
      count++;
    }
    if (count > 0) this.world.pings.push({ x: target.x, y: target.y, color: '#e04a3c', life: 1 });
  }

  orderAttackBuilding(building) {
    const world = this.world;
    const center = world.rectCenter(building.rect);
    for (const unit of world.selected) {
      if (!unit.alive || unit.def.worker) continue;
      unit.targetBuilding = building.handle;
      unit.target = -1;
      unit.order = 'attackTarget';
      unit.path = [];
    }
    this.world.pings.push({ x: center.x, y: center.y, color: '#e04a3c', life: 1 });
  }

  selectUnit(unit) {
    const world = this.world;
    world.selectedBuilding = null;
    for (const u of world.units) u.selected = false;
    unit.selected = true;
    world.selected = [unit];
    this.hud.refresh(true);
  }

  selectBuilding(building) {
    const world = this.world;
    world.selected = [];
    for (const u of world.units) u.selected = false;
    world.selectedBuilding = building;
    this.hud.refresh(true);
  }

  onKey(e) {
    const key = e.key.toLowerCase();
    const pan = 12 / Math.max(0.4, this.camera.zoom);
    if (key === 'w' || key === 'arrowup') this.camera.y -= pan;
    else if (key === 's' || key === 'arrowdown') this.camera.y += pan;
    else if (key === 'a' || key === 'arrowleft') this.camera.x -= pan;
    else if (key === 'd' || key === 'arrowright') this.camera.x += pan;
    else if (key === 'q') this.camera.angle -= 0.12;
    else if (key === 'e') this.camera.angle += 0.12;
    else if (key === '+' || key === '=') this.camera.zoomBy(1.12);
    else if (key === '-') this.camera.zoomBy(0.89);
    else if (key === ' ') { e.preventDefault(); this.world.togglePause(); this.hud.refresh(true); }
    else if (key === '1') this.world.speed = 1;
    else if (key === '2') this.world.speed = 2;
    else if (key === '3') this.world.speed = 4;
    else if (key === 'g') this.world.setAllGates(this.world.buildings.some((b) => b.def.isGate && !b.gateOpen));
    else if (key === 'r') { this.world.cycleRations(); this.hud.refresh(true); }
    else if (key === 't') { this.world.cycleTaxes(); this.hud.refresh(true); }
    else if (key === 'x') this.selectAllMilitary();
    else if (key === 'z') this.selectIdlePeasants();
    else if (key === 'escape') {
      if (this.placing) this.cancelPlacement();
      else if (this.world.selectedBuilding) { this.world.selectedBuilding = null; this.hud.refresh(true); }
      else if (this.world.selected.length) { this.world.selected = []; for (const u of this.world.units) u.selected = false; this.hud.refresh(true); }
      else if (this.world.state === STATE.PLAYING) { this.world.togglePause(); this.hud.refresh(true); }
    }
    void TILE_W;
  }
}

const app = new App();
window.kurdCastle = app;
void GameName;
