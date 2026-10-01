# DARK SOULS
# CONVERGENCE OF ASH & WANT

### Master Game Design Document

*"Three ages remembered the world. Only one of them was right."*

---

| | |
|---|---|
| **Genre** | Dark Fantasy Action-RPG / Third-Person Deliberate Combat |
| **Platforms** | PC (Steam) · PlayStation 5 · Xbox Series X\|S · Switch 2 |
| **Engine** | `EmberCore 4` (DS3 pipeline fork) + seamless-streaming middleware |
| **Campaign** | 70–95 h first clear · 200 h+ all endings/covenants/NG+3 |
| **Multiplayer** | 1–5 concurrent phantoms · persistent asynchronous messaging & bloodstains |
| **Monetization** | Premium single SKU + one expansion (*The Want Beneath*). No MTX. |
| **Document** | Version 1.0 — publication-grade · 10 volumes · 6,090 lines · 261 data tables · 54 specification blocks |

---

## Contents

### [VOLUME 0 — Front Matter, Design Pillars & Global Systems](00-INDEX-and-front-matter.md)
How to read this document · the high concept · **the five design pillars** (Readable Weight / Three Grammars One Language / The World Is The Puzzle / Death Is A Transaction / Build Fantasy Over Build Optimum) · core fantasy & experience goals · scope and feature budget · **Global Systems Appendix** (master damage formula, unified poise model, status build, four-currency economy, death & bloodstain, frame-data conventions, NG+/Ascetic multipliers, RNG determinism, balance reference targets, save persistence) · glossary of 15 terms.

### [VOLUME 1 — Title & Narrative Mythos](01-title-and-narrative-mythos.md)
**1.1** Title, tagline & positioning · **1.2** World premise: the Convergence — the cosmological failure, bleed-through phenomena, the metaphysics of the **Essence Triad (Souls / Want / Ash)**, the world's name · **1.3** Player identity: **The Ashen Hollow** — origin, opening crawl, the double curse, motivation loop · **1.4** Factions & pantheon — the six remaining powers, **the Serpent Problem (Ouroboros, the Frampt-Kaathe)**, the five **Kindled Echoes** · **1.5** Hollowing: the body as a ledger · **1.6** Narrative structure — three acts, the Three Keys/Three Doors throughline, six lore-delivery rules · **1.7 ENDINGS** — *Relinking the Flame* (Kindled & Cold sub-variants), *The Throne of Want* (Reign & Devour variants), *Usurper of the Abyss*, and the hidden **Severance** ending, with a full ending matrix · **1.8** Region narrative briefs · **1.9** Tone, language & audio-narrative direction.

### [VOLUME 2 — Stat System & Build Architecture](02-stat-system-and-build-architecture.md)
**2.1** Design philosophy — nine attributes, three budgets (Survival / Action / Intent), the soft-cap doctrine, the ring rule · **2.2** Ten starting classes with full stat blocks · **2.3** All nine attributes in exhaustive detail: **Vigor · Attunement · Endurance · Strength · Dexterity · Vitality · Intelligence · Faith · Adaptability** · **2.4** Consolidated cap tables — master soft/hard cap table, scaling letter coefficients, the **17-infusion matrix**, four upgrade paths · **2.5** Level-up economy & soul cost curve · **2.6** The 40-archetype viability space · **2.7 REFERENCE BUILD A — Quality Power-Stance Knight** (SL125, 40/40, full equipment, Power Stance config, spell loadout, leveling route, balance assessment) · **2.8 REFERENCE BUILD B — Pure Hexer / Dark Caster** (INT/FTH joint scaling math, Resonance interaction, rotation DPS) · **2.9 REFERENCE BUILD C — Heavy Armor Poise Tank** (VIT/STR, DS1 true poise doctrine, zero-magic cost, mixed-set penalty) · **2.10** Cross-build comparison · **2.11** Balance levers & engineering handoff.

### [VOLUME 3 — Combat Matrix & Mechanics Fusion](03-combat-matrix-and-mechanics-fusion.md)
**3.0** The Fusion Contract — what each import gives, breaks, and is fixed by · **3.1** Movement & tempo (**DS3 speed & i-frames**: omnidirectional rolling, the "roll into it" bonus, roll frame data, stamina regeneration) · **3.2** The two-resource model: Stamina & **FP** · **3.3 Weapon Arts** — 30 authored Arts across 21 weapon classes, Art structure, four ranks, the Ashen infusion · **3.4** Guard, parry, block & riposte frame data · **3.5** The Poise Damage table (Grades 1–5) · **3.6 POWER STANCE (DS2)** — the 1.5× rule, the full 15×11 compatibility matrix, **14 named stances with movesets**, and **POSTURE BREAK** · **3.7 TRUE POISE & EQUIPMENT LOAD (DS1)** — the unified model, true poise in practice, reachability analysis, the four load tiers, 11 reference armor sets · **3.8** Attack frame data for 15 weapon classes · **3.9 SEVERANCE (DS1 tail-cuts)** — the system, damage-type requirements, **all 31 severable parts**, feedback design, the token reward path · **3.10** Status effects · **3.11** Seven enemy combat archetypes · **3.12** Boss combat grammar & seven fairness rules · **3.13** Lock-on, camera & aim · **3.14** The combat fusion test matrix (G1–G7).

### [VOLUME 4 — Magic & Spell Schools](04-magic-and-spell-schools.md)
**4.0** The unified magic architecture — four schools, four verbs (*pierce / sustain-smite / consume / subtract*) · **4.1** Attunement, slots & uses · **4.2** Casting mechanics — the cast formula, six casting states, casting poise, **15 catalysts** · **4.3 SCHOOL I — SORCERY (INT)**: 34 spells across offensive, utility and blade-projectile lines · **4.4 SCHOOL II — MIRACLES (FTH)**: 32 spells across healing, lightning and support/oath lines, plus the *Conviction* property · **4.5 SCHOOL III — PYROMANCY (INT+FTH hybrid)**: 30 spells, the hybrid scaling formula and its deliberate 40/40 ceiling · **4.6 SCHOOL IV — HEXES (DS2 INT/FTH)**: 34 spells, **the WANT resource**, the asymmetry-rewarding scaling formula, and **RESONANCE** · **4.7** School interaction matrix (PvP/co-op ecology) · **4.8** Spell acquisition curve · **4.9** Magic balance targets · **4.10** Technical implementation.

### [VOLUME 5 — World Map & Interconnectivity](05-world-map-and-interconnectivity.md)
**5.0** World design doctrine — **D1 no loading screens, D2 no level gates, D3 every region connects to ≥3 others** · **5.1** World scale & **technical streaming spec** (2.61 km², 1,140 m vertical, chunking, velocity-aware preload, no invisible walls, the 60 fps frame budget) · **5.2** Interconnectivity rules — the six-type shortcut grammar, sightline doctrine, elevation as narrative · **5.3 HUB: THE ECLIPSE SANCTUARY** — three-light architecture, **full ASCII layout**, 11 facilities, hub evolution across three acts + five post-ending states, the Refectory NPC convergence engine · **5.4** All **14 region specifications** (biome, the one rule, SL band, bonfires, bosses, severance, key items, NPCs, shortcuts, connections, sightlines) · **5.5** The Great Serpent Viaduct · **5.6** Critical path, three canonical routes, the one loading screen · **5.7** Warp network · **5.8** World state & **the Convergence Clock** · **5.9** Environmental hazards · **5.10 WORLD BLUEPRINT** — ASCII vertical section + plan-view connectivity graph + degree audit · **5.11** Level design production standards.

### [VOLUME 6 — Three Fully Realized Boss Encounters](06-boss-encounters.md)
**6.0** Boss design template & ten global rules · **6.1 VHAROS, THE DROWNED WARDEN** — lore, the Nave of Forty Chairs arena (ASCII), 3 phases, **22-move set with full frame data**, the timed Flood transition, 10-rule input-reading table, **3 severance parts**, 6-layer music design, fairness audit · **6.2 KARRAG, THE EMBER SOVEREIGN** — lore, the Sovereign's Furnace arena with its **4-minute lava clock**, 3 phases + quadrupedal form change, **24-move set**, the anvil-attrition AI, **3 severance parts** (one fire-gated), 7-layer music design, fairness audit · **6.3 NIHILANTHOS, THE WANT INCARNATE** (final boss) — lore, the Chamber of Three Doors, **4 phases** (Souls / Want / Ash / Converged), a **Phase 2 that wears the player's own build**, the Phase 3 weeping-statue observation rule, the Phase 4 triptych arena and build-reading Aspect Selector, **30-move set**, **3 severance parts including the hidden-ending seam**, 7-layer music design, fairness audit · **6.4** Cross-boss comparison.

### [VOLUME 7 — Progression & Bonfire Ascetics](07-progression-and-bonfire-ascetics.md)
**7.0** Progression philosophy — three clocks · **7.1 THE DUAL HEALING SYSTEM** — Estus Flasks (charge acquisition, 12 reinforcement levels, the shared allocation pool) and **Life Gems** (6 variants, diminishing returns), plus **the balance contract** that makes the optimum a mix · **7.2** Consumables & durability · **7.3** Death economy & the bloodstain mercy · **7.4 BONFIRE ASCETICS** — the concept, the item, the **A1–A4 rank ladder** with costs, the full effect list across 10 categories, **14 boss Echo variants**, the decision space, descent & safety valves · **7.5** The Convergence Clock as progression · **7.6** Crafting, upgrading & **transposition** (Vhenn's service table, material economy, transposition table) · **7.7** 96 rings across 9 categories · **7.8** NPC & questline progression · **7.9** New Game+ · **7.10** The 82-hour progression timeline · **7.11** Balance levers.

### [VOLUME 8 — Covenants & Multiplayer Architecture](08-covenants-and-multiplayer.md)
**8.0** Multiplayer doctrine (M1–M5) · **8.1** Network architecture — topology, netcode rules for combat · **8.2** Session topology & limits — the embered state, **summon limits (white/gold, up to host + 3)**, **invasion limits (red/purple/blue, up to 2–3)**, two-axis SL + Soul Memory matchmaking, co-op rules · **8.3** All summoning & invasion items · **8.4** Invasion ecology — the loop, 10 protection rules, **the Sigil-Hunter nemesis system** · **8.5 THE FIVE COVENANTS** — **Warriors of Sunlight**, **Darkwraith Invaders**, **Blue Sentinels**, **Dragon Remnants**, **Forest / Area Guardians** — each with fiction, master, join condition, a 3-rank ladder with requirements and rewards, unique spells, unique weapons, and sin rules · **8.6** Async multiplayer · **8.7** Multiplayer progression & rewards · **8.8** Anti-cheat & moderation · **8.9** Telemetry & balance gates · **8.10** Covenant × ending interaction matrix.

### [VOLUME 9 — User Interface (UI) & HUD Design](09-ui-and-hud-design.md)
**9.0** UI principles (U1–U5) · **9.1 HUD LAYOUT SPECIFICATION** — reference frame & scaling, the **full ASCII wireframe**, and element-by-element specs for HP / FP / Stamina bars, the **Poise Diamond**, status effect icons, Resonance knots, the Want meter, quick slots, **weapon slots**, the Estus cluster, the world cluster, the **boss health bar with severance pips and posture bar**, and the lock-on reticle · **9.2** HUD state machine, transitions, the one-glance test · **9.3** Menu architecture & the universal detail panel · **9.4** STATUS screen with the **soft-cap curve graph** and the Sigil Board · **9.5 EQUIPMENT screen** — full ASCII layout, **the Power Stance indicator specification**, **poise display**, **infusion status**, slot rules · **9.6** MAGIC screen · **9.7** Accessibility (47 options + position statement) · **9.8** Confirmation dialogs · **9.9** Iconography standards · **9.10** Technical implementation · **9.11** Ship-gate checklist · **APPENDIX** — the cross-volume consistency register (25 shared values with canonical sources) and document control.

---

## The Three Reference Builds (Vol. 2)

| | **A · Quality Power-Stance Knight** | **B · Pure Hexer** | **C · Heavy Poise Tank** |
|---|---|---|---|
| SL | 125 | 125 | 125 |
| Spread | VIG 34 · ATT 22 · END 24 · STR 40 · DEX 40 · VIT 20 · INT 9 · FTH 10 · ADP 16 | VIG 22 · ATT 30 · END 11 · STR 10 · DEX 12 · VIT 12 · INT 60 · FTH 50 · ADP 10 | VIG 44 · ATT 10 · END 18 · STR 50 · DEX 12 · VIT 53 · INT 8 · FTH 8 · ADP 12 |
| HP / FP / STA | 1214 / 154 / 112 | 852 / 210 / 86 | 1432 / 70 / 100 |
| Load | 39.4% — MID | 25.0% — FAST | 89.3% — FAT |
| Poise | 34 (Grade 1) | 19 (Grade 0) | **106 (Grade 3)** — 88 with the shield stowed |
| Sustained DPS | **512** | 119 | 318 |
| Effective HP | 1684 | 1005 | **2410** |
| Boss TTK / deaths per boss | 78 s / 3.1 | 168 s / 2.4 | 124 s / **1.4** |
| Signature mechanic | Power Stance Posture Break | Resonance ladder | True poise + hyper-armor lock |

---

*"And so the Flame was neither linked, nor throned, nor taken. It was divided. And you were left to watch all three of them fade — slowly, and in order."*
