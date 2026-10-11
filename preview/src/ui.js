// -----------------------------------------------------------------------------
//  Kurd Castle — browser preview
//  File: ui.js
//  Purpose: HUD (resources, popularity, minimap, speed, build menu, selection
//           panel, overlays) plus every input path the mobile game needs:
//           edge-drag panning, pinch zoom, tap select, drag placement, long
//           press attack-move, keyboard shortcuts on desktop.
// -----------------------------------------------------------------------------

import { BUILDINGS, buildingsInCategory, UNITS, RESOURCE_LABEL, RESOURCE_COLOR, PRIMARY_RESOURCES, Popularity, Ui, GameName, Version } from './balance.js';
import { TEAM, STATE } from './sim.js';
import { NAV } from './map.js';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function costString(cost) {
  return Object.entries(cost || {}).map(([key, value]) => `${value} ${RESOURCE_LABEL[key] || key}`).join(' · ');
}

export class Hud {
  constructor(app) {
    this.app = app;
    this.world = app.world;
    this.buildCategory = 'castle';
    this.selectedTab = null;
    this.toastNodes = [];
    this.pointer = { x: -1, y: -1, inside: false };
    this.dragging = false;
    this.build();
    this.refreshBuildMenu(true);
  }

  // ===========================================================================
  //  DOM construction
  // ===========================================================================
  build() {
    const root = document.getElementById('hud');

    // ---- resource strip (top-left)
    this.resourceStrip = el('div', 'panel resource-strip');
    this.resourceNodes = {};
    for (const key of ['wood', 'stone', 'iron', 'gold', 'food', 'weapons', 'ale']) {
      const cell = el('div', 'resource');
      const dot = el('span', 'dot');
      dot.style.background = RESOURCE_COLOR[key];
      const value = el('span', 'value', '0');
      cell.append(dot, value);
      cell.title = RESOURCE_LABEL[key];
      this.resourceStrip.append(cell);
      this.resourceNodes[key] = value;
    }
    root.append(this.resourceStrip);

    // ---- kingdom strip (top-centre)
    this.kingdomStrip = el('div', 'panel kingdom-strip');
    this.popularityNode = el('div', 'pop-value', '50');
    const popWrap = el('div', 'pop-wrap');
    popWrap.append(el('span', 'pop-label', 'Popularity'), this.popularityNode);
    this.popBar = el('div', 'pop-bar');
    this.popBarFill = el('div', 'pop-bar-fill');
    this.popBar.append(this.popBarFill);
    popWrap.append(this.popBar);

    this.kingdomInfo = el('div', 'kingdom-info');
    this.drawer = el('div', 'drawer');
    this.drawer.hidden = true;

    this.rationsButton = el('button', 'chip', 'Rations: Full');
    this.rationsButton.onclick = () => { this.world.cycleRations(); this.refresh(true); };
    this.taxesButton = el('button', 'chip', 'Taxes: Normal');
    this.taxesButton.onclick = () => { this.world.cycleTaxes(); this.refresh(true); };
    const detailsButton = el('button', 'chip ghost', 'Details ▾');
    detailsButton.onclick = () => { this.drawer.hidden = !this.drawer.hidden; this.refreshPopularity(); };

    const chips = el('div', 'chip-row');
    chips.append(this.rationsButton, this.taxesButton, detailsButton);
    this.kingdomStrip.append(popWrap, this.kingdomInfo, chips);
    this.kingdomStrip.append(this.drawer);
    root.append(this.kingdomStrip);

    // ---- minimap + speed (top-right)
    const rightPanel = el('div', 'panel top-right');
    this.minimap = el('canvas', 'minimap');
    this.minimap.width = 132;
    this.minimap.height = 132;
    this.minimap.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      const rect = this.minimap.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * this.world.map.width;
      const y = ((e.clientY - rect.top) / rect.height) * this.world.map.height;
      this.app.camera.focus(x, y);
      this.app.ping(x, y);
    });

    const speedRow = el('div', 'row');
    this.speedButtons = [];
    const speeds = [['⏸', 0], ['1×', 1], ['2×', 2], ['4×', 4]];
    for (const [label, value] of speeds) {
      const button = el('button', 'chip', label);
      button.onclick = () => {
        if (value === 0) this.world.togglePause();
        else { this.world.speed = value; if (this.world.state === STATE.PAUSED) this.world.togglePause(); }
        this.refresh(true);
      };
      speedRow.append(button);
      this.speedButtons.push({ button, value });
    }

    const gateRow = el('div', 'row');
    const openGates = el('button', 'chip', 'Open Gates');
    openGates.onclick = () => { this.world.setAllGates(true); this.refresh(true); };
    const closeGates = el('button', 'chip', 'Seal Gates');
    closeGates.onclick = () => { this.world.setAllGates(false); this.refresh(true); };
    gateRow.append(openGates, closeGates);

    rightPanel.append(this.minimap, speedRow, gateRow);
    root.append(rightPanel);

    // ---- wave banner (top-centre under kingdom strip)
    this.waveBanner = el('div', 'wave-banner');
    this.waveBanner.hidden = true;
    root.append(this.waveBanner);

    // ---- build menu (bottom-right)
    const buildPanel = el('div', 'panel build-panel');
    this.tabRow = el('div', 'row tabs');
    this.buildGrid = el('div', 'build-grid');
    buildPanel.append(this.tabRow, this.buildGrid);
    root.append(buildPanel);

    // ---- selection panel (bottom-left)
    this.selectionPanel = el('div', 'panel selection-panel');
    root.append(this.selectionPanel);

    // ---- hint / command row (bottom-centre)
    this.hintRow = el('div', 'hint-row');
    root.append(this.hintRow);

    // ---- toasts (bottom-centre, above hint)
    this.toastHost = el('div', 'toast-host');
    root.append(this.toastHost);

    // ---- overlays
    this.overlay = el('div', 'overlay');
    this.overlay.hidden = true;
    root.append(this.overlay);
  }

  // ===========================================================================
  //  Refresh
  // ===========================================================================
  refresh(force = false) {
    const world = this.world;
    const ledger = world.ledger.player;

    for (const [key, node] of Object.entries(this.resourceNodes)) {
      const value = Math.floor(ledger[key] || 0);
      const rate = world.rates[key] || 0;
      const rateText = Math.abs(rate) > 0.05 ? ` ${rate > 0 ? '+' : ''}${rate.toFixed(1)}/m` : '';
      node.textContent = `${value}${rateText}`;
      const cell = node.parentElement;
      if (cell) cell.classList.toggle('warn', value <= 5);
      node.title = `${RESOURCE_LABEL[key]}: ${value}${rateText}`;
    }
    void force;

    const stats = world.kingdom.player;
    const popularity = Math.round(stats.popularity);
    this.popularityNode.textContent = String(popularity);
    this.popularityNode.className = 'pop-value ' + (popularity >= 50 ? 'good' : popularity >= 25 ? 'ok' : 'bad');
    const pct = Math.max(0, Math.min(100, ((stats.popularity + 10) / 110) * 100));
    this.popBarFill.style.width = `${pct}%`;
    this.popBarFill.style.background = popularity >= 50 ? '#5fd67a' : popularity >= 25 ? '#e8c65a' : '#e04a3c';

    this.kingdomInfo.textContent =
      `Peasants ${stats.peasants} · Soldiers ${stats.military} · Housing ${stats.housingUsed}/${stats.housing}` +
      (this.world.popSpawnCountdown ? ` · Next arrival ${this.world.popSpawnCountdown.toFixed(0)}s` : '');

    this.rationsButton.textContent = `Rations: ${stats.rations[0].toUpperCase()}${stats.rations.slice(1)}`;
    this.taxesButton.textContent = `Taxes: ${stats.taxes[0].toUpperCase()}${stats.taxes.slice(1)}`;

    for (const { button, value } of this.speedButtons) {
      const active = value === 0 ? world.state === STATE.PAUSED : (world.speed === value && world.state === STATE.PLAYING);
      button.classList.toggle('active', active);
    }

    this.refreshPopularity();
    this.refreshBuildMenu();
    this.refreshSelection();
    this.refreshWaveBanner();
  }

  refreshPopularity() {
    if (this.drawer.hidden) return;
    const stats = this.world.kingdom.player;
    this.drawer.innerHTML = '';
    for (const factor of stats.factors) {
      const row = el('div', 'drawer-row');
      row.append(el('span', null, factor.label));
      const value = el('span', factor.value >= 0 ? 'pos' : 'neg',
        `${factor.value >= 0 ? '+' : ''}${factor.value.toFixed(1)}`);
      row.append(value);
      this.drawer.append(row);
    }
    const total = stats.factors.reduce((sum, f) => sum + f.value, 0);
    const row = el('div', 'drawer-row total');
    row.append(el('span', null, 'Target popularity'), el('span', null, total.toFixed(1)));
    this.drawer.append(row);
  }

  refreshWaveBanner() {
    const world = this.world;
    if (world.state !== STATE.PLAYING) { this.waveBanner.hidden = true; return; }
    if (world.waveActive) {
      this.waveBanner.hidden = false;
      const alive = world.activeWaveUnits.filter((u) => u.alive).length;
      this.waveBanner.textContent = `WAVE ${world.waveIndex + 1} — UNDER ATTACK · ${alive} hostiles remain`;
      this.waveBanner.className = 'wave-banner danger';
    } else if (world.waveIndex < world.wavesTotal) {
      this.waveBanner.hidden = false;
      const seconds = Math.ceil(world.secondsUntilWave());
      this.waveBanner.textContent = `Next assault in ${seconds}s — wave ${world.waveIndex + 1} of ${world.wavesTotal}`;
      this.waveBanner.className = 'wave-banner';
    } else {
      this.waveBanner.hidden = true;
    }
  }

  refreshBuildMenu(rebuildTabs = false) {
    if (rebuildTabs) {
      this.tabRow.innerHTML = '';
      const categories = [['castle', 'Castle'], ['economy', 'Economy'], ['housing', 'Housing'], ['military', 'Military']];
      for (const [id, label] of categories) {
        const button = el('button', 'chip', label);
        button.onclick = () => { this.buildCategory = id; this.refreshBuildMenu(true); };
        button.classList.toggle('active', this.buildCategory === id);
        this.tabRow.append(button);
      }
    }

    const list = buildingsInCategory(this.buildCategory).filter((def) => def.id !== 'keep');
    // Rebuild only when the set of affordable buildings changes (or the placement
    // mode changes) — recreating two dozen buttons every frame would tank the
    // frame rate on a phone.
    const signature = `${this.buildCategory}:` +
      list.map((def) => (this.world.canAfford(def.cost, TEAM.PLAYER) ? '1' : '0')).join('') +
      (this.app.placing ? `:${this.app.placing.id}` : '');
    if (this.buildSignature === signature && !rebuildTabs) return;
    this.buildSignature = signature;

    this.buildGrid.innerHTML = '';
    for (const def of list) {
      const affordable = this.world.canAfford(def.cost, TEAM.PLAYER);
      const button = el('button', 'build-button' + (affordable ? '' : ' disabled'));
      button.innerHTML = `<span class="bname">${def.name}</span><span class="bcost">${costString(def.cost)}</span>`;
      button.title = def.desc;
      button.onclick = () => { this.app.beginPlacement(def); };
      button.disabled = !affordable;
      this.buildGrid.append(button);
    }

    if (this.app.placing) {
      const cancel = el('button', 'chip ghost wide', `Cancel ${this.app.placing.name} (Esc)`);
      cancel.onclick = () => this.app.cancelPlacement();
      this.buildGrid.append(cancel);
    }
  }

  refreshSelection() {
    const world = this.world;
    const panel = this.selectionPanel;
    const b = world.selectedBuilding;
    const signature = b
      ? `b:${b.handle}:${Math.round(b.hp)}:${b.stored.amount}:${b.garrison.length}:${b.gateOpen ? 1 : 0}:${b.repairQueued ? 1 : 0}:${b.site ? 1 : 0}`
      : `u:${world.selected.map((u) => `${u.handle}.${Math.round(u.hp)}.${u.state}`).join(',')}:${world.attackMove ? 1 : 0}`;
    if (this.selectionSignature === signature) return;
    this.selectionSignature = signature;

    panel.innerHTML = '';
    panel.hidden = world.selected.length === 0 && !world.selectedBuilding;
    if (panel.hidden) { this.hintRow.innerHTML = ''; return; }

    if (world.selectedBuilding) {
      const b = world.selectedBuilding;
      const title = el('div', 'sel-title', b.label);
      const info = el('div', 'sel-sub',
        `HP ${Math.max(0, Math.round(b.hp))}/${Math.round(b.maxHp)}` +
        (b.site ? ' · under construction' : b.stored.type ? ` · ${b.stored.amount} ${RESOURCE_LABEL[b.stored.type]} stored` : '') +
        (b.def.garrison ? ` · garrison ${b.garrison.length}/${b.def.garrison}` : ''));
      panel.append(title, info);

      const row = el('div', 'row');
      if (!b.def.isKeep) {
        const demolish = el('button', 'chip danger', 'Demolish');
        demolish.onclick = () => { if (this.world.demolish(b)) { this.world.selectedBuilding = null; this.refresh(true); } };
        row.append(demolish);
      }
      if (b.hp < b.maxHp) {
        const repair = el('button', 'chip', b.repairQueued ? 'Repairing…' : 'Repair');
        repair.onclick = () => { b.repairQueued = !b.repairQueued; this.refresh(true); };
        row.append(repair);
      }
      if (b.def.isGate) {
        const gate = el('button', 'chip', b.gateOpen ? 'Seal Gate' : 'Open Gate');
        gate.onclick = () => { this.world.toggleGate(b); this.refresh(true); };
        row.append(gate);
      }
      if (Array.isArray(b.def.trains)) {
        for (const unitId of b.def.trains) {
          const def = UNITS[unitId];
          const queued = b.trainingQueue.filter((q) => q === unitId).length;
          const waiting = b.awaitingPeasant && queued > 0;
          const label = waiting
            ? `${def.name} ready — needs an idle peasant`
            : `Train ${def.name} (${costString(def.train)})${queued ? ` ×${queued}` : ''}`;
          const train = el('button', 'chip', label);
          train.disabled = !this.world.canAfford(def.train, TEAM.PLAYER);
          train.onclick = () => { this.world.trainUnit(unitId); this.refresh(true); };
          row.append(train);
        }
      }
      if (b.def.garrison) {
        const garrison = el('button', 'chip', 'Garrison Archers');
        garrison.onclick = () => {
          this.world.garrisonSelected(b);
          this.refresh(true);
        };
        row.append(garrison);
      }
      panel.append(row);
      this.hintRow.innerHTML = '';
      return;
    }

    const selected = world.selected.filter((u) => u.alive);
    if (selected.length === 0) { panel.hidden = true; return; }

    if (selected.length === 1) {
      const u = selected[0];
      panel.append(el('div', 'sel-title', u.def.name));
      panel.append(el('div', 'sel-sub', `HP ${Math.round(u.hp)}/${u.maxHp} · ${u.state}`));
    } else {
      const workers = selected.filter((u) => u.def.worker).length;
      panel.append(el('div', 'sel-title', `${selected.length} units`));
      panel.append(el('div', 'sel-sub', `${workers} peasants · ${selected.length - workers} soldiers`));
    }

    const row = el('div', 'row');
    const allMilitary = el('button', 'chip', 'All Troops');
    allMilitary.onclick = () => { this.app.selectAllMilitary(); this.refresh(true); };
    const idle = el('button', 'chip', 'Idle Peasants');
    idle.onclick = () => { this.app.selectIdlePeasants(); this.refresh(true); };
    const attackMove = el('button', 'chip' + (world.attackMove ? ' active' : ''), 'Attack-Move');
    attackMove.title = 'Long-press the map (or use this) and tap a target to attack-move.';
    attackMove.onclick = () => { world.attackMove = !world.attackMove; this.refresh(true); };
    const stop = el('button', 'chip', 'Stop');
    stop.onclick = () => { for (const u of selected) { u.path = []; u.order = 'idle'; u.target = -1; u.targetBuilding = -1; } };
    row.append(allMilitary, idle, attackMove, stop);
    panel.append(row);

    if (world.selectedBuilding === null && selected.some((u) => u.def.worker)) {
      panel.append(el('div', 'sel-sub hint', 'Peasants automatically take jobs at new buildings.'));
    }
  }

  showToast(message, severity = 'info') {
    const node = el('div', `toast ${severity}`, message);
    this.toastHost.append(node);
    this.toastNodes.push({ node, life: Ui.ToastDuration });
    while (this.toastNodes.length > 4) {
      const oldest = this.toastNodes.shift();
      oldest.node.remove();
    }
  }

  updateToasts(dt) {
    for (let i = this.toastNodes.length - 1; i >= 0; i--) {
      const entry = this.toastNodes[i];
      entry.life -= dt;
      entry.node.style.opacity = String(Math.max(0, Math.min(1, entry.life / 0.6)));
      if (entry.life <= 0) { entry.node.remove(); this.toastNodes.splice(i, 1); }
    }
  }

  // ===========================================================================
  //  Overlays
  // ===========================================================================
  showOverlay(kind) {
    const world = this.world;
    this.overlay.hidden = false;
    this.overlay.innerHTML = '';
    const card = el('div', 'overlay-card');

    if (kind === 'menu') {
      card.append(el('h1', null, GameName));
      card.append(el('p', 'sub', 'Build a castle. Feed your people. Hold the walls.'));
      card.append(el('p', 'sub small', `Isometric siege survival prototype · ${Version}`));
      const play = el('button', 'primary', 'Begin the Siege');
      play.onclick = () => this.app.startMatch();
      card.append(play);
      card.append(el('p', 'sub small', 'Drag to pan · pinch or scroll to zoom · tap a building then tap the map to place it.'));
    } else if (kind === 'paused') {
      card.append(el('h1', null, 'Paused'));
      const resume = el('button', 'primary', 'Resume');
      resume.onclick = () => { world.togglePause(); this.refresh(true); };
      const restart = el('button', 'ghost', 'Restart');
      restart.onclick = () => this.app.restart();
      card.append(resume, restart);
    } else if (kind === 'victory' || kind === 'defeat') {
      card.append(el('h1', null, world.victoryTitle || (kind === 'victory' ? 'Victory' : 'Defeat')));
      card.append(el('p', 'sub', world.victorySummary || ''));
      card.append(el('p', 'sub small',
        `Waves cleared ${world.wavesCleared}/${world.wavesTotal} · Enemies slain ${world.score.enemiesKilled} · ` +
        `Peasants arrived ${world.score.peasantsArrived}`));
      const again = el('button', 'primary', 'Play Again');
      again.onclick = () => this.app.restart();
      card.append(again);
    }

    this.overlay.append(card);
  }

  hideOverlay() { this.overlay.hidden = true; }

  // ===========================================================================
  //  Per-frame
  // ===========================================================================
  update(dt) {
    this.updateToasts(dt);
    this.refresh(false);
    // The minimap repaints 4096 tiles; 10-12 Hz is plenty and keeps the main
    // canvas thread free for the isometric view.
    this.minimapTimer = (this.minimapTimer || 0) + dt;
    if (this.minimapTimer < 0.085) return;
    this.minimapTimer = 0;
    const ctx = this.minimap.getContext('2d');
    this.app.view.drawMinimap(ctx, this.minimap.width, this.minimap.height);
  }
}
