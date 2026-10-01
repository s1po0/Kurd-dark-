# Kurd-dark-

Design repository for **DARK SOULS: CONVERGENCE OF ASH & WANT** — a publication-grade Game Design Document for an ultimate Souls title unifying the mechanics, world architecture, lore, and RPG systems of *Dark Souls*, *Dark Souls II*, and *Dark Souls III*.

---

## 📖 The Document

**→ [OPEN THE MASTER GDD](docs/gdd/README.md)**

| Vol. | Section | Focus |
|---|---|---|
| **0** | [Front Matter, Design Pillars & Global Systems](docs/gdd/00-INDEX-and-front-matter.md) | High concept, 5 design pillars, scope budget, damage/poise/economy formulas, glossary |
| **1** | [Title & Narrative Mythos](docs/gdd/01-title-and-narrative-mythos.md) | The Convergence cosmology, the Ashen Hollow, Dark Sigils & Hollowing, factions, the Ouroboros, **6 ending outcomes across 3 named endings** |
| **2** | [Stat System & Build Architecture](docs/gdd/02-stat-system-and-build-architecture.md) | 9 attributes, unified 27/40/60/80 soft-cap doctrine, 10 starting classes, 17 infusions, 40 viable archetypes, **3 fully worked SL125 reference builds** |
| **3** | [Combat Matrix & Mechanics Fusion](docs/gdd/03-combat-matrix-and-mechanics-fusion.md) | DS3 movement & i-frames, FP economy, **30 Weapon Arts**, DS2 Power Stance (15×11 compatibility matrix, 14 named stances, POSTURE BREAK), DS1 true poise & load tiers, **31-part severance system**, full frame data |
| **4** | [Magic & Spell Schools](docs/gdd/04-magic-and-spell-schools.md) | **130 spells** across Sorceries, Miracles, Pyromancies and Hexes; casting math, 15 catalysts, the WANT resource, RESONANCE, school counter-matrix |
| **5** | [World Map & Interconnectivity](docs/gdd/05-world-map-and-interconnectivity.md) | Zero-load streaming spec (2.61 km², 1,140 m vertical), interconnectivity doctrine, **Eclipse Sanctuary hub**, 14 fully specified regions, ASCII vertical section + plan-view graph |
| **6** | [Three Fully Realized Boss Encounters](docs/gdd/06-boss-encounters.md) | **Vharos, the Drowned Warden** · **Karrag, the Ember Sovereign** · **Nihilanthos, the Want Incarnate** — 22/24/30-move sets with frame data, phase transitions, arena transformations, severance, input reading, music layering, fairness audits |
| **7** | [Progression & Bonfire Ascetics](docs/gdd/07-progression-and-bonfire-ascetics.md) | Dual healing (Estus + Life Gems) with the full balance contract, flask allocation pool, **Bonfire Ascetics A1–A4** with 14 boss Echo variants, Convergence Clock, crafting economy, 82-hour progression timeline |
| **8** | [Covenants & Multiplayer Architecture](docs/gdd/08-covenants-and-multiplayer.md) | Network topology, session limits (host + 3 co-op + 2 invaders), two-axis SL/Soul-Memory matchmaking, invasion ecology, **5 covenants with full rank ladders, spells and weapons**, anti-cheat, covenant × ending matrix |
| **9** | [User Interface (UI) & HUD Design](docs/gdd/09-ui-and-hud-design.md) | Full HUD wireframe and per-element spec (px positions, colors, timings), the **Poise Diamond**, **Power Stance indicators**, poise & infusion readouts, menu architecture, 47 accessibility options, ship-gate checklist |

---

## ⚔ The High Concept

> **Three dying worlds remember each other. The memory is failing. You are what crawls out of the ash of that failure.**

*Convergence* welds Lordran's seamless vertical architecture and First Flame cosmology, Drangleic's biome diversity, Adaptability, Life Gems, Bonfire Ascetics, Power Stance and the Curse of Want, and Lothric's combat tempo, FP-driven Weapon Arts and Ashen One identity into **one contiguous world, one stat system, one combat grammar, and one ending space.**

Every imported mechanic must pay rent: it deepens player expression, deepens world legibility, or it is cut.

---

## 🎮 The Playable Build

The document is now backed by a **playable browser prototype** in [`game/`](game/) — plain HTML, CSS and JavaScript with no build step, no bundler, no dependencies and no network calls. Open it and it runs.

```bash
# serve it (any static server will do)
cd game && python3 -m http.server 8080
# → http://localhost:8080
```

### Controls

| | Keyboard | Gamepad |
|---|---|---|
| Move | `W A S D` / arrows | left stick |
| Walk / Sprint | hold `C` / hold `Shift` | — |
| Light · Heavy attack | `J` · `K` | □ · △ |
| Guard · Parry | `L` · `U` | R1 · R2 |
| Dodge roll / Backstep | `Space` (while guarding = backstep) | ○ |
| Weapon Art | `I` | L2 |
| Cast attuned spell | `J` / `K` with a catalyst equipped | □ / △ |
| Estus Flask · Life Gem | `E` · `G` | L3 · touchpad |
| Interact / Riposte / use quickslot | `F` | □ |
| Two-hand · Swap hands · Lock-on | `T` · `X` · `Q` | L1 · ○ · R3 |
| Menu (nine tabs) | `Esc` or `Tab` | Options |
| Select quickslot | `1`–`4` | d-pad |

Mouse: LMB light attack, RMB guard, MMB roll. The camera aims your attacks and spells.

The nine menu tabs are **Attributes · Equipment · Inventory · Attunement · Blacksmith · Covenants · World · Codex · Settings**.

### What is actually implemented

Every number below is the document's number, not a placeholder — the prototype reads the same tables the GDD specifies.

| System | Shipped | GDD reference |
|---|---|---|
| Attributes | all **9**, including Adaptability (i-frames + Estus speed) | Vol 2 §2.2 |
| Soft-cap ladder | unified **27 / 40 / 60 / 80 / 99** across every pool *and* weapon scaling | Vol 2 §2.4 |
| Starting classes | **10**, each with its own kit and gift | Vol 2 §2.5 |
| Equip load | **FAST <30 % · MID 30–70 % · FAT >70 % · OVERBURDENED**, each with its own roll frames, distance and cost | Vol 2 §2.3.2 |
| Poise | true DS1 poise: grades G0–G4, break threshold `20 + poise×2`, mitigation capped at 70 %, **−4 for an off-set piece** | Vol 3 §3.7 |
| Power Stance | **1.5× requirement**, opened by a heavy swing, finished by light or heavy; posture damage **×1.6 / ×2.4**, and **×0.40** outside a stance | Vol 3 §3.6 |
| Parry / riposte | 6f startup, 8f active, window f7–14, **×3.20** critical | Vol 3 §3.5.5 |
| Healing | Estus (instant, 300 → 890, 15 charges) **and** Life Gems (360 HP over 13.5 s, −6 % movement per gem in flight, floor −60 %) | Vol 7 §7.1–7.2 |
| Magic | 4 schools, 5 catalysts, 14 spells, FP committed at cast start, `CAST_FRAMES` composing catalyst × ADP × DEX × load | Vol 4 §4.2 |
| WANT / Resonance | WANT 0–7 fed by dark magic, resonance ladder **+8 / +18 / +32 %** dark damage, casting refused at full WANT | Vol 4 §4.5 |
| Smithing | +0 → **+10** (×2.0 damage) gated on Titanite Shard / Chunk / Slab, plus **8 infusions** that re-weight the scaling ladder | Vol 2 §2.6 |
| Covenants | **5**, each with real join requirements, betrayal sin, and rank ladders | Vol 8 §8.4 |
| Bonfires | 24 across 5 zones: rest, kindle (+5 Estus), warp, and **Bonfire Ascetics A1–A4** with the A4 Kindled Echo | Vol 7 §7.3 |
| Death loop | bloodstain, soul drop, recovery, and a second death that erases the old stain | Vol 7 §7.8 |
| Bosses | **3** fully realized: The Hollow Sovereign (16 moves), Karrag the Ember-King (24 moves, severable Forge Crown), Vharos the Ashen Herald (22 moves, severable Herald's Tail, phase-II arena transform) | Vol 6 §6.1–6.3 |
| Severance | damage-type-gated parts — hitting a crown with a slash prints `WRONG TYPE` | Vol 3 §3.9 |
| Enemies | 9 archetypes + elite overlays, a **2-attacker token limit**, and input reading that punishes healing on a timer | Vol 6 §6.0 |
| Endings | **3** of the 6, each behind its real requirement, and the hidden one behind all three of its conditions at once | Vol 1 §1.7 |
| New Game+ | `burnAsceticGlobal` raises every region, revives the slain, and **stops at NG+7** | Vol 7 §7.3.5 |

### Tests

`tests/smoke.js` boots the real game headlessly (a DOM/canvas/WebAudio shim, all eleven modules concatenated and evaluated in one scope so the script-level `const`s behave as they do in a browser) and drives **337 assertions across 30 systems** — formula regressions against the three reference builds, every roll tier, parry frames, both healing paths, power-stance gating, all four spell schools, the death/recovery loop, all nine menu tabs, smithing, covenants, ascetics, all three boss fights including severance and phase gates, the ending conditions, NG+, save/load, and a 3,600-frame stability soak.

```bash
node tests/smoke.js          # 337 passed, 0 failed
```

---

## 🗂 Repository Layout

```
Kurd-dark-/
├── README.md                              ← you are here
├── docs/
│   └── gdd/
│       ├── README.md                      ← master document (cover + contents)
│       ├── 00-INDEX-and-front-matter.md
│       ├── 01-title-and-narrative-mythos.md
│       ├── 02-stat-system-and-build-architecture.md
│       ├── 03-combat-matrix-and-mechanics-fusion.md
│       ├── 04-magic-and-spell-schools.md
│       ├── 05-world-map-and-interconnectivity.md
│       ├── 06-boss-encounters.md
│       ├── 07-progression-and-bonfire-ascetics.md
│       ├── 08-covenants-and-multiplayer.md
│       └── 09-ui-and-hud-design.md
├── game/                                  ← the playable prototype (no build step)
│   ├── index.html                         ← 960×540 canvas, HUD, overlays
│   ├── css/style.css
│   └── js/
│       ├── const.js                       ← every GDD data table
│       ├── util.js                        ← derive(), weaponDamage(), spellDamage(), save
│       ├── input.js                       ← keyboard + mouse + gamepad → design-language actions
│       ├── audio.js                       ← procedural WebAudio (no asset files)
│       ├── particles.js                   ← FX pool, camera, hit-stop
│       ├── world.js                       ← 5 zones, doorway-aware renderer, collision
│       ├── player.js                      ← Actor base + the player state machine
│       ├── enemies.js                     ← enemies, bonfires, drops, fog gates, NPCs
│       ├── bosses.js                      ← Boss base + Sovereign / Karrag / Vharos
│       ├── ui.js                          ← the nine menu tabs and the HUD
│       └── main.js                        ← Game: state machine, combat resolution, endings, save
└── tests/
    ├── shim.js                            ← headless DOM / canvas / audio shim
    └── smoke.js                           ← 337-assertion runtime smoke test
```

---

## 📊 At a Glance

| | |
|---|---|
| Playable world | **2.61 km²**, 1,140 m of vertical extent, **zero loading screens** (one deliberate 3-second exception) |
| Regions / Bonfires | 14 / 78 |
| Bosses | 22 fully realized (13 with severance parts — **31 parts total**) |
| Weapons / Armor sets | 186 / 71 |
| Spells | 130 (34 Sorceries · 32 Miracles · 30 Pyromancies · 34 Hexes) |
| Attributes | 9, with a unified soft-cap cadence at **27 / 40 / 60 / 80** |
| Viable build archetypes | **40**, all gated to ≤18% slower than the reference optimum |
| Endings | 3 named + 1 hidden + 2 sub-variants |
| Covenants | 5, each with a 3-rank ladder and unique spells/weapons |
| Multiplayer | 1–5 phantoms per session, cross-play, deterministic replay-based anti-cheat |
| Data tables in this document | 261 (plus 54 fenced specification blocks) |
| Design-locked values | 14 · Live balance knobs: 47 |

---

*"And so the Flame was neither linked, nor throned, nor taken. It was divided."*
