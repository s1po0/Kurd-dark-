# DARK SOULS: CONVERGENCE OF ASH & WANT
## Master Game Design Document — Volume 0: Front Matter, Design Pillars & Global Systems

| Field | Value |
|---|---|
| **Project Codename** | `CONVERGENCE` (internal: `ASHWANT`) |
| **Public Title** | *Dark Souls: Convergence of Ash & Want* |
| **Genre** | Dark Fantasy Action-RPG / Third-Person Deliberate Combat |
| **Platforms** | PC (Steam), PlayStation 5, Xbox Series X\|S; Switch 2 (scaled preset) |
| **Engine** | Proprietary `EmberCore 4` (fork of the DS3 pipeline) + seamless-streaming middleware layer |
| **Target Rating** | ESRB M / PEGI 16 |
| **Session Length** | 20–180 min (short-run friendly, long-run deep) |
| **Campaign Length** | 70–95 h first clear; 200 h+ for all endings/covenants/NG+3 |
| **Multiplayer** | 1–5 concurrent phantoms per session; persistent asynchronous messaging/bloodstains |
| **Monetization** | Premium single SKU. One post-launch expansion (*The Want Beneath*). **No microtransactions, no battle pass, no consumable currency.** |
| **Document Version** | 1.0 — Publication-grade |
| **Document Owner** | Principal Game Designer / Lead Combat Architect / Lead Worldbuilder |
| **Status** | Greenlit for Vertical Slice → Production |

---

## 0.1 — How To Read This Document

The GDD is split into nine numbered volumes plus appendices. Each volume is self-contained for a discipline (design, combat, world, systems, UI) but cross-references the others by **§** notation.

| Vol. | File | Contents |
|---|---|---|
| 0 | `00-INDEX-and-front-matter.md` | Front matter, design pillars, global systems & formulas appendix, glossary |
| 1 | `01-title-and-narrative-mythos.md` | World premise, cosmology, player identity, Dark Sigil/Hollowing, factions, endings |
| 2 | `02-stat-system-and-build-architecture.md` | Nine attributes, derived stats, soft/hard caps, three reference builds |
| 3 | `03-combat-matrix-and-mechanics-fusion.md` | Movement/i-frames, stamina & FP, Weapon Arts, Power Stance, true poise, severance |
| 4 | `04-magic-and-spell-schools.md` | Sorceries, Miracles, Pyromancies, Hexes; attunement, casting, resonance |
| 5 | `05-world-map-and-interconnectivity.md` | Seamless streaming rules, Eclipse Sanctuary hub, 14 regions, ASCII blueprint |
| 6 | `06-boss-encounters.md` | Three fully realized bosses: phases, arenas, music, AI, severance, rewards |
| 7 | `07-progression-and-bonfire-ascetics.md` | Dual healing (Estus/Life Gem), reinforcement, Bonfire Ascetics, economy |
| 8 | `08-covenants-and-multiplayer.md` | Session topology, summon/invasion rules, five covenants with rank ladders |
| 9 | `09-ui-and-hud-design.md` | HUD layout spec, equipment/stat menus, iconography, accessibility |

> **Convention:** All numbers are *design targets*, expressed at 60 fps (1 frame = 16.67 ms). Frame counts use the notation `f` (e.g. `42f` = 0.70 s). Damage values assume a Level 125 reference character unless stated otherwise.

---

## 0.2 — The High Concept

> **Three dying worlds remember each other. The memory is failing. You are what crawls out of the ash of that failure.**

*Convergence of Ash & Want* is not a sequel, remaster, or anthology. It is a **single unified Souls game** in which:

- **Lordran's** seamless, vertically-stacked architecture and its **First Flame** cosmology,
- **Drangleic's** biome diversity, **Adaptability**, **Life Gems**, **Bonfire Ascetics**, **Power Stance**, and the **Curse of Want**,
- **Lothric's** combat tempo, **FP-driven Weapon Arts**, **Ember/Ash** economy, **transposition crafting**, and **Ashen One** identity

…are welded into one contiguous world, one stat system, one combat grammar, and one ending space. Every mechanic imported from a prior entry must **pay rent**: it either deepens player expression, deepens world legibility, or it is cut. Nothing is included out of nostalgia.

---

## 0.3 — The Five Design Pillars

Every design decision in this document is arbitrated against these pillars. When two features conflict, the higher-numbered pillar wins.

### P1 — *Readable Weight*
Every action has mass, cost, and consequence that the player can perceive before committing. Stamina, FP, Equip Load, poise, and casting commitment are all **visible budgets**. We never hide a cost from the player; we let them misjudge it.

### P2 — *Three Grammars, One Language*
The DS1/DS2/DS3 systems must not sit side-by-side as options; they must **interlock**. Poise (DS1) exists so that Power Stance (DS2) combos have a defensive counter-language. Weapon Arts (DS3) exist so that Hexes (DS2) have a melee answer. Ascetics (DS2) exist so that NG+ (DS1/DS3) is a *player-chosen* difficulty rather than a global gate.

### P3 — *The World Is The Puzzle*
Geometry is progression. No region is behind a level gate; every region is behind a **knowledge gate**. Shortcuts, elevators, sightlines, and one-way drops are the true skill tree. The map is a single streaming volume with zero loading screens (§5.2).

### P4 — *Death Is A Transaction, Not A Punishment*
Dying costs souls, deepens the Dark Sigil, and (uniquely) advances the world's **Convergence state** — the world decays when you fail. But every death is recoverable, and every recovery is legible. We never add friction the player cannot plan around.

### P5 — *Build Fantasy Over Build Optimum*
Stat caps, infusion variety, Weapon Arts, Power Stance compatibility, and the four spell schools must guarantee that **at least 40 distinct archetypes are viable to NG+3 completion**. Balance target: no archetype more than **18% slower** at clearing the full boss roster than the reference optimum (see Appendix A.9).

---

## 0.4 — Core Fantasy & Player Experience Goals

| Layer | Statement |
|---|---|
| **Fantasy** | "I am the last thing the world exhaled. I will decide what it becomes." |
| **Emotional arc** | Dread → Competence → Grief → Sovereignty |
| **Moment-to-moment** | Deliberate, weighty, punish- Commitment. Reads and whiffs decide fights, not reflex spam. |
| **Session-level** | A region is a knot: enter blind, learn its logic, unlock its shortcuts, kill its warden, leave changed. |
| **Meta-level** | Your build is your philosophy. Healing choice, covenant, and ending are the same decision expressed three ways. |
| **Post-credit feeling** | Not triumph. *Responsibility.* |

---

## 0.5 — Scope & Feature Budget (Production Reality)

| Bucket | Count | Notes |
|---|---|---|
| Playable regions | 14 | 3 tutorial/early, 6 mid, 4 late, 1 endgame (§5.4) |
| Bonfires | 78 | Avg. 5.6/region; hub has 4 |
| Unique bosses (fully realized) | 22 | 14 mandatory, 8 optional |
| Roster bosses w/ severance parts | 13 | 31 severable parts total |
| Weapon classes | 21 | Each with ≥1 Weapon Art; 9 classes support Power Stance |
| Unique weapons | 186 | 34 are boss/transposed weapons |
| Armor sets | 71 | Full 4-piece sets with poise values |
| Spells total | 130 | 34 Sorceries, 32 Miracles, 30 Pyromancies, 34 Hexes (§4) |
| Rings | 96 | 12 Ascetic-exclusive |
| Covenants | 5 | 3 rank ladders each, 2 with sub-pacts |
| NPCs w/ questlines | 29 | 5 are "Kindled Echoes" (ending-critical) |
| Endings | 3 core + 1 hidden variant + 2 sub-variants | §1.7 |

**Cut list (explicitly out of scope for 1.0):** open-world vehicle/traversal mounts, difficulty sliders, pausable co-op, procedurally generated dungeons, weapon transmog, dual-wielding of *incompatible* classes, ranged lock-on assist beyond §3.13.

---

## 0.6 — Global Systems Appendix

### A.1 Master Damage Formula

```
FINAL_DAMAGE =
    ( BASE_AR + Σ STAT_BONUS_i )
  × MOTION_VALUE
  × CRIT_MOD
  × (1 − DEF_FRACTION) × (1 − ABSORB_FRACTION)
  × ELEMENTAL_MOD
  × BUFF_STACK (multiplicative, capped ×2.00)
  × NG_MULT
  × COVENANT_MOD
```

Where:

- **BASE_AR** — weapon Attack Rating after infusion, upgrade level, and (for magic) catalyst Spell Buff.
- **STAT_BONUS_i** = `BASE_AR_of_scale × S_i × scaling_letter_coefficient`, with per-attribute diminishing returns applied via the cap curves in §2.3.
- **DEF_FRACTION** = `DEF / (DEF + K_dmg)`, `K_dmg = 60 + 6 × attacker_level`. This *soft* formula replaces flat subtraction so that high-defense targets never become immune, and low-level attackers never hit a wall (a common DS1 late-game failure).
- **ABSORB_FRACTION** = per-damage-type percentage (Physical / Magic / Fire / Lightning / Dark), applied after DEF.
- **ELEMENTAL_MOD** — split-damage weapons resolve each damage type separately against its own DEF+ABSORB pair, then sum. This preserves the classic "split damage is worse against armor" property.
- **NG_MULT** — see A.7.

**Worked example:** Longsword +10 Refined (AR 268: 170 base + 98 scaling), 40 STR / 40 DEX, R1 (MV 1.00) vs. a Hollow Soldier (DEF 96, 12% physical absorb, level 60 zone).
`K_dmg = 60 + 6×60 = 420`; `DEF_FRACTION = 96/516 = 0.186`; damage = `268 × 1.00 × (1 − 0.186) × (1 − 0.12)` = **192.6 → 192**.

### A.2 Poise & Stagger Model (unified)

```
POISE_TOTAL      = BASE_POISE(12) + Σ ARMOR_POISE + RING_POISE
POISE_THRESHOLD  = 20 + (POISE_TOTAL × 2)                 // damage needed to stagger
POISE_MITIGATION = min(0.70, POISE_TOTAL × 0.005)         // incoming poise dmg ×(1 − this)
TRUE_POISE_WINDOW:
    active during any attack animation whose POISE_GRADE ≤ TRUE_POISE_GRADE(POISE_TOTAL)
    TRUE_POISE_GRADE: 0–29 → 0 (none) | 30–59 → 1 (light) | 60–89 → 2 (light+medium) | 90+ → 3 (all non-boss)
    Boss-tier attacks (POISE_GRADE 4+) ALWAYS stagger.
HYPER_ARMOR LOCK: at most 1 true-poise absorb per player action; the second hit lands normally.
```

Every attack, Weapon Art, spell cast, and shield block in the game carries a **Poise Damage** value and a **Poise Grade** (1–5). Full table in §3.8.

### A.3 Status Build Table

```
status_accumulated += STATUS_BASE_of_weapon × NG_MULT × (1 + STATUS_INFUSION_BONUS)
on hit: apply bleed/poison/toxic/frost buildup to target's meter
meter decays at DECAY_RATE/s after 4.0 s without new application
threshold met → status proc, meter resets to 0, DECAY_RATE ×1.35 for that target for the rest of the encounter
```

Status procs: **Bleed** (30% max HP burst + 4 s DoT), **Poison** (2%/s for 45 s, blocks Estus regen for its duration), **Toxic** (5%/s for 30 s, halves healing received), **Frost** (−18% stamina regen, +12% damage taken, shatter-able by any physical hit for bonus damage), **Hollow-Blight** (*new*; reduces target FP/Want regeneration by 60% for 20 s — the anti-caster status).

### A.4 Soul & Currency Economy

| Currency | Source | Sink | Loss on death |
|---|---|---|---|
| **Souls** | Kills, items, bosses | Levels, weapon upgrades, consumables, covenant offerings | Yes — recoverable once from bloodstain |
| **Embers of Ash** | Boss kills, Ascetic burns, rare nodes | Flask charge/allocation, Weapon Art unlocks (ranks), transposition fuel | No |
| **Want Shards** | Hexer encounters, Abyssal nodes, covenant rank-ups | Hex upgrades, Resonance slot expansion, dark infusion | No |
| **Humanity / Effigy** | Consumable, world nodes | Reverse-hollowing, kindling, co-op ignition, resist curse | Yes (in inventory, as items) |

Design intent: **Souls are the risky currency, the other three are the safe currencies.** This prevents the DS1 problem where a single death destroys 2 hours of upgrade progress, while preserving the tension of the bloodstain run.

### A.5 Death, Bloodstain & Sigil Interaction

1. On death, drop 100% of carried Souls + 5% of carried Embers of Ash (rounded down) as a **Bloodstain**.
2. Dark Sigil count increases by 0 or 1 depending on the death context (§1.5): dying to a boss you have never damaged → +1 Sigil; dying to an invader → no Sigil; dying in an Ascetic region → +1 Sigil and the region's **Convergence Clock** advances (§7.5).
3. Hollowing increases by `2 × Sigil_Count` per death, capped at 99.
4. Touching your bloodstain restores Souls/Embers. Dying again before recovery **permanently consumes** the prior stain (classic rule retained — it is the single strongest tension generator in the series).

### A.6 Frame Data Conventions

| Term | Definition |
|---|---|
| **Startup** | Frames from input lock to first active hitbox |
| **Active** | Frames the hitbox deals damage |
| **Recovery** | Frames from last active frame to input unlock |
| **i-frames** | Frames of full invulnerability (not merely super-armor) |
| **Cancel windows** | Notated `C@f12–18` = cancelable into roll/guard on frames 12–18 |
| **Flinch** | `F0` none / `F1` light hit reaction / `F2` knockback / `F3` launch / `F4` down+getup |

### A.7 New Game+ & Ascetic Multipliers

| Cycle | Enemy HP | Enemy Dmg | Enemy Poise Dmg | Soul yield | New content |
|---|---|---|---|---|---|
| NG | ×1.00 | ×1.00 | ×1.00 | ×1.00 | — |
| NG+1 | ×1.55 | ×1.20 | ×1.10 | ×1.60 | Ring drops +1 tier |
| NG+2 | ×1.95 | ×1.35 | ×1.20 | ×2.00 | New NPC invasions |
| NG+3 | ×2.30 | ×1.50 | ×1.30 | ×2.30 | Boss "Echo" variants |
| NG+4..7 | +0.15 HP / +0.05 dmg per cycle | | | capped ×3.0 souls | Cosmetic only |
| **Ascetic A1–A4** (per-region, stacks with cycle) | +25% per rank | +12% per rank | +8% per rank | +40% per rank | Rank-specific movesets & loot (§7.4) |

### A.8 Determinism & RNG

- All drops, spawn tables, and message ratings use a **per-save seeded stream** (`seed = saveGUID ⊕ regionID ⊕ rollCount`), so that a player cannot soft-reset to reroll a boss drop. This is a deliberate anti-save-scumming stance and matches the series' identity.
- Multiplayer matchmaking uses a separate deterministic bucket hash on (Soul Level band, Soul Memory band, password).

### A.9 Balance Reference Targets

| Metric | Target | Tolerance |
|---|---|---|
| Time-to-kill, standard enemy (correct build) | 2.5–5.0 s | ±25% |
| Time-to-kill, standard enemy (wrong build) | 8–14 s | ±30% |
| Player DPS ceiling, 1v1 (L125, optimal) | 640 dps | ±8% |
| Archetype clear-time spread vs. optimum | ≤18% slower | hard gate |
| Boss TTK, phase 1 (skilled player) | 55–110 s | ±20% |
| Estus-to-boss-fight ratio | 4–7 full heals per attempt | design lever, see §7.2 |
| Roll i-frame coverage at 30% load | 16f of 34f total (47%) | ±2f |
| Input-to-pixels latency | ≤48 ms | hard gate |

### A.10 Save Data & Persistence

- Single save slot per profile per platform (**no slot-scumming**), 64 MB, checksummed and server-attested for online play.
- Persistent flags: `worldState[region].asceticRank`, `worldState[region].convergenceClock`, `npc.questStage[29]`, `severance[31]`, `covenant.rank[5]`, `endings.seen[6]`.
- Cross-save inheritance: **none.** The world must be earned per character. (Exceptions: gesture unlocks are account-level.)

---

## 0.7 — Glossary

| Term | Definition |
|---|---|
| **The Convergence** | The metaphysical collapse of three ages into one geography. Also the state machine that governs world decay. |
| **Ashen Hollow** | The player character. An Unkindled whose body is ash held in shape by a Dark Sigil. |
| **Dark Sigil** | A brand that accumulates with certain deaths; gates Hollowing, dark magic, and one ending. |
| **Hollowing** | 0–99 cosmetic/narrative/stat-light state driven by Sigils (§1.5). |
| **Want** | The Drangleic force of desire-as-hunger. Manifests as a resource, a status, a spell school, and a region. |
| **Essence Triad** | Souls (memory), Want (desire), Ash (residue). The three keys of the endgame (§1.3). |
| **Eclipse Sanctuary** | The hub. A place where the sun is permanently half-swallowed (§5.3). |
| **Kindled Echoes** | Five NPCs whose survival determines the ending variants (§1.6). |
| **Ascetic** | A consumable that raises one region's local NG+ rank (§7.4). |
| **Severance** | The part-destruction system: tails, arms, crowns, cores (§3.9). |
| **Power Stance** | Two-weapon compatible moveset unlocked at 1.5× requirements (§3.6). |
| **True Poise** | DS1-style attack-through-hit resistance derived from armor poise (§3.7). |
| **Resonance** | Hex chaining mechanic that escalates dark spell potency (§4.5). |
| **Convergence Clock** | Per-region counter that advances on failure and unlocks world decay events (§7.5). |

---

*End of Volume 0. Continue to Volume 1: Title & Narrative Mythos.*
