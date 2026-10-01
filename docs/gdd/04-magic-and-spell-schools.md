# VOLUME 4 — MAGIC & SPELL SCHOOLS

> **Design owner:** Lead Systems Designer (Magic) / Lead Combat Architect
> **Depends on:** Vol. 2 (INT/FTH/ATT curves), Vol. 3 (frame data, poise grades) · **Feeds:** Vol. 6 (boss spell interactions), Vol. 8 (covenant rewards), Vol. 9 (spell HUD)

---

## 4.0 — The Unified Magic Architecture

Four schools, one casting pipeline. The schools differ in **what they cost** and **what they do to the target**, not in how they are executed. This is the fusion rule: DS3's single FP pool, DS2's dual-attribute scaling, and DS1's clear school identities, running through one animation and one input grammar.

| | **Sorceries** | **Miracles** | **Pyromancies** | **Hexes** |
|---|---|---|---|---|
| **Origin age** | Lordran (Vinheim) | Lordran/Lothric (Churches) | Lordran (Izalith) | Drangleic (Dark Chasm) |
| **Scaling attribute(s)** | **INT** | **FTH** | **INT + FTH (hybrid)** | **min(INT,FTH) + 0.4·Δ** |
| **Catalyst** | Staff | Talisman / Chime | Pyromancy Flame | Dark Chime / Hex Talisman |
| **Secondary resource** | FP only | FP only | FP only | **FP + WANT charges** |
| **Damage types** | Magic | Lightning, (Dark for a few) | Fire, Chaos | Dark |
| **Signature verb** | *Pierce* | *Sustain / Smite* | *Consume* | *Subtract* |
| **Effect on target** | HP | HP + ally HP | HP + Burn | HP, **Stamina, FP, Want, healing** |
| **Cast time band** | Fast (34–56f) | Medium (44–72f) | Medium (40–68f) | Slow (48–92f) |
| **Interrupt resistance** | None | Grade 2 at FTH ≥40 | None | **Resonance 3 = Grade 3 immunity** |
| **Spell count** | 34 | 32 | 30 | 34 |
| **Hard practical cap** | INT 60 | FTH 60 | INT 40 / FTH 40 | INT 60 / FTH 40 (asymmetric!) |
| **Reference build** | — | — | — | Build B (§2.8) |

**The four verbs are the design.** If a new spell does not clearly *pierce*, *sustain/smite*, *consume*, or *subtract*, it does not ship. This single sentence is the filter that keeps 130 spells coherent.

---

## 4.1 — Attunement, Slots & Uses

### 4.1.1 Slots

```
SLOTS = 2 + floor(ATT / 6),  maximum 10
```

| ATT | 10 | 12 | 18 | 24 | 30 | 36 | 42 | 48 | 54 | 60 | 72 | 99 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Slots | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 10 | 10 | 10 | 10 |

### 4.1.2 Uses (casts per rest)

Each spell has a **base use count**. Uses scale with the governing attribute(s):

```
USES = base_uses × USE_MULT
USE_MULT (Sorcery)      = 1 + max(0, INT − 10) × 0.014       → INT 60 = ×1.70
USE_MULT (Miracle)      = 1 + max(0, FTH − 10) × 0.014       → FTH 60 = ×1.70
USE_MULT (Pyromancy)    = 1 + max(0, avg(INT,FTH) − 10) × 0.012
USE_MULT (Hex)          = 1 + max(0, min(INT,FTH) − 10) × 0.016   → min 50 = ×1.64
Rings: Sage Ring (+1 use per 3 slots), Deep Ring (+2 uses to Hexes only)
```

**Example:** *Dark Orb* (base 6 uses) at INT 60 / FTH 50 → `6 × (1 + 40×0.016) = 6 × 1.64 = 9.8 → 9 uses per rest.`

### 4.1.3 Attuning & Swapping

- Spells are attuned **only at bonfires** (same discipline as level-ups — the bonfire is the sole safe space).
- **Two "memory pages"** of attunement can be saved and swapped at a bonfire (e.g. *PvE page* / *Invasion page*). Swapping pages in the field is impossible.
- A spell may be attuned to **multiple slots** to double its uses — at a −10% damage penalty per duplicate slot. This is the DS2 "stack the same spell" behavior, taxed so it stays a choice rather than a default.

---

## 4.2 — Casting Mechanics

### 4.2.1 Cast Formula

```
CAST_FRAMES = SPELL_BASE_FRAMES × CATALYST_SPEED × ADP_MOD × DEX_MOD × MOVEMENT_MOD × LOAD_MOD
  CATALYST_SPEED  = 1.00 − (catalyst_speed_bonus)        // 0.90 – 1.15
  ADP_MOD         = 1.00 − min(0.14, (ADP − 10) × 0.0047) // ADP 40 → 0.86
  DEX_MOD         = 1.00 − min(0.105, (DEX − 10) × 0.0035)// DEX 40 → 0.895  [Sorceries & Hexes only]
  MOVEMENT_MOD    = ×1.30 while walking · ×1.55 while running · ×2.20 while sprinting
  LOAD_MOD        = ×1.15 at Fat Roll tier · ×1.35 at Overburdened
```

**Worked example (Build B, *Dark Orb*):**
`base 48f × catalyst 0.95 (Dark Chime +5) × ADP 1.00 (ADP 10) × DEX 0.993 (DEX 12) × 1.00 × 1.00 = **45.3 → 45f** (0.75 s)`

**Worked example (Build B, *Affinity* while walking):**
`base 74f × 0.95 × 1.00 × 0.993 × 1.30 = **91.1 → 91f** (1.52 s)`

> **The movement penalty is the game's most important casting rule.** A hexer who walks casts in 1.5 s; a hexer who stands still casts in 0.75 s but is a stationary target. Every caster decision in *Convergence* is this trade, and it is why casters are interesting rather than merely strong.

### 4.2.2 Casting States

| State | Can move? | Can roll? | Cast time | Interruptible by |
|---|---|---|---|---|
| **Stationary cast** | No | No (until f+6 of recovery) | ×1.00 | Any poise damage (except at Resonance 3) |
| **Walking cast** | Yes (118 u/s) | No | ×1.30 | Any poise damage |
| **Running cast** | Yes (300 u/s) | No | ×1.55 | Any poise damage |
| **Rolling cast** *(Ashen infusion, staff only)* | — | **Yes** | ×1.85 | Any poise damage |
| **Guarded cast** *(chime/talisman in left hand + small shield)* | No | No | ×1.45 | **Only Grade ≥3** |

### 4.2.3 Casting Poise

Casters have **no true poise by default** — casting is interrupted by any hit. Three exceptions, all earned:

1. **Resonance 3** (Hexes only, §4.5.4) — Grade ≤2 immunity for the next cast.
2. **FTH ≥ 40** — Miracles gain **Grade 2 interrupt immunity** (the *Conviction* property, §2.3.8). This is what makes the Paladin archetype real.
3. **Guarded cast** — as tabled above; the DS2 "cast behind a shield" behavior, formalized.

### 4.2.4 Catalyst Table

| Catalyst | School | Req | Wt | Spell Buff @+0 / @+5 / @+10 | Speed | Special |
|---|---|---|---|---|---|---|
| **Acolyte's Staff** | Sorcery | INT 10 | 2.0 | 118 / 176 / 224 | 1.00 | Starting staff |
| **Sage's Crystal Staff** | Sorcery | INT 34 | 2.4 | 152 / 214 / 268 | 0.95 | +1 slot at INT 50 |
| **Idris Staff** | Sorcery | INT 45 | 2.2 | 168 / 232 / **286** | 1.00 | Highest sorcery buff; melee-capable (AR 96) |
| **Beats of the Eclipse** | Sorcery | INT 50 / FTH 20 | 2.8 | 174 / 240 / 292 | 1.05 | **Hybrid**: also casts Miracles at 80% buff |
| **Court Sorcerer's Staff** | Sorcery | INT 27 | 1.8 | 138 / 196 / 248 | **0.90** | Fastest sorcery catalyst in game |
| **Cleric's Talisman** | Miracle | FTH 10 | 1.6 | 112 / 168 / 216 | 1.00 | Starting |
| **Sunlight Talisman** | Miracle | FTH 30 | 2.0 | 146 / 208 / 262 | 1.00 | +12% Lightning damage |
| **Caitha's Chime** | Miracle | FTH 24 | 1.4 | 132 / 190 / 240 | 0.95 | **Usable one-handed with a greatsword** (Paladin enabler) |
| **Saint's Talisman** | Miracle | FTH 45 | 2.2 | 160 / 224 / **278** | 1.00 | Highest miracle buff |
| **Pyromancy Flame** | Pyromancy | INT 10 / FTH 10 | 0.0 | 108 / 160 / 208 | 1.00 | **Weightless**; scales off avg(INT,FTH) |
| **Chaos Flame** | Pyromancy | INT 24 / FTH 24 | 0.0 | 126 / 182 / 234 | 1.05 | +20% Chaos damage; applies Burn 20 |
| **Demons' Scar** | Pyromancy | INT 30 / FTH 30 | 0.0 | 140 / 198 / **252** | 1.00 | Highest pyromancy buff |
| **Dark Chime (Greymouthe's)** | Hex | INT 20 / FTH 20 | 1.2 | 148 / 206 / **236** @+5 (max +5) | **0.95** | **Catalyst for Hexes AND Miracles**; *Toll* Weapon Art |
| **Hex Talisman of the Deep** | Hex | INT 30 / FTH 30 | 1.6 | 164 / 228 / **282** | 1.00 | Highest hex buff; −1 Want regen |
| **Vessel of Want** | Hex | INT 50 / FTH 50 | 2.0 | 190 / 258 / **312** | 1.10 | **Best catalyst in game, slowest, and only obtainable after the Throne ending in NG+** |
| **Pyromancer's Wraps** *(fist-catalyst)* | Pyromancy | STR 12 / INT 14 / FTH 14 | 0.4 | 96 / 148 / 196 | 0.92 | Casts while punching; the "flame monk" build |

**Design note on catalyst ceilings.** The **Vessel of Want** is strictly better than every other catalyst and is **only obtainable in NG+ after taking the Throne ending**. This is the game's single deliberate "power gated behind a narrative choice," and it exists so that the endings have mechanical weight without any of them being *required*.

---

## 4.3 — SCHOOL I: SORCERY (INT — *Pierce*)

**Identity.** Precision, geometry, and the coldest damage in the game. Sorcery is the school of *single-target, high-velocity, magic-damage* output, plus the game's best utility (invisibility, silence-of-self, repair, homing).

**Weakness.** Magic absorption is the most common absorption in the late game (stone, crystal, and constructed enemies), and sorceries have **zero interrupt resistance**. Sorcery is a school of *positioning*, not of pressure.

### 4.3.1 Offensive Sorceries

| Spell | Req | Slots | FP | Uses | Dmg @ SB 224 | Frames (S/A/R) | Range | Notes | Location |
|---|---|---|---|---|---|---|---|---|---|
| **Soul Arrow** | INT 10 | 1 | 8 | 12 | 180 | 34/4/14 | 24 m | Baseline. Fastest projectile in game. | Starting (Acolyte) |
| **Great Soul Arrow** | INT 16 | 1 | 12 | 10 | 262 | 40/4/16 | 26 m | | Grave of Names |
| **Heavy Soul Arrow** | INT 20 | 1 | 16 | 8 | 348 | 52/5/20 | 24 m | **Grade 3 poise dmg — interrupts casters** | Grave of Names |
| **Great Heavy Soul Arrow** | INT 28 | 1 | 22 | 6 | 452 | 62/5/24 | 26 m | Grade 3 | Sunken Cathedral |
| **Soul Spear** | INT 36 | 1 | 26 | 5 | **420** | 56/4/18 | 32 m | Pierces one target | Iron Eclipse Foundry |
| **Crystal Soul Spear** | INT 48 | 1 | 34 | 4 | **560** | 68/5/22 | 34 m | **Highest single-projectile damage**; shatters on impact (Grade 4) | Grave of Kings |
| **Homing Soulmass** | INT 28 | 2 | 40 | 3 | 6 × 78 = 468 | 74/—/20 | 20 m | 6 orbiting masses, fire on next attack input, 40 s | Sunken Cathedral |
| **Homing Crystal Soulmass** | INT 44 | 2 | 54 | 2 | 6 × 124 = **744** | 84/—/24 | 22 m | Highest total-damage sorcery; 45 s duration | Grave of Kings |
| **Soul Greatsword** | INT 22 | 1 | 20 | 6 | 310 | 44/6/18 | 6 m | Melee-range magic blade; **Grade 3** | Ember Keep |
| **Farron Greatsword** | INT 34 | 2 | 30 | 4 | 428 | 50/8/22 | 7 m | Wide arc, hits up to 3 | Grave of Kings |
| **Soul Stream** | INT 54 | 3 | 90 | 1 | 34/s × 3.2 s = **918** | 40/channel/30 | 30 m | Channeled beam; drains FP continuously; **cannot be interrupted while channeling** | Convergence |
| **White Dragon Breath** | INT 60 | 2 | 68 | 2 | 620 + Burn | 62/14/28 | 12 m cone | Cone AoE; applies Magic buildup | Remnant Shrine |
| **Soul Vortex** | INT 50 | 2 | 58 | 2 | 8 × 52 = 416 | 70/24/24 | 8 m | Pulls enemies to center, then detonates | The Want Beneath |

### 4.3.2 Utility & Support Sorceries

| Spell | Req | Slots | FP | Uses | Duration | Effect | Location |
|---|---|---|---|---|---|---|---|
| **Magic Weapon** | INT 14 | 1 | 18 | 3 | 120 s | +60 magic AR to right weapon | Acolyte start |
| **Great Magic Weapon** | INT 24 | 1 | 26 | 2 | 120 s | +95 magic AR | Iron Eclipse |
| **Crystal Magic Weapon** | INT 40 | 1 | 36 | 1 | 90 s | **+140 magic AR**; the melee-sorcerer's peak | Grave of Kings |
| **Hidden Body** | INT 16 | 1 | 20 | 3 | 40 s | Near-invisibility while stationary/walking; breaks on attack | Grave of Names |
| **Hush** | INT 20 | 1 | 16 | 4 | 60 s | Silent footsteps; −70% enemy detection radius | Sunken Cathedral |
| **Repair** | INT 12 | 1 | 22 | 2 | instant | Restores 30% durability to all equipment | Artificer start |
| **Cast Light** | INT 8 | 1 | 10 | 6 | 240 s | Light source on weapon; **no combat effect** | Starting |
| **Aural Decoy** | INT 14 | 1 | 18 | 3 | until triggered | Places a lure that draws enemy aggro | Grave of Names |
| **Spook** | INT 18 | 1 | 24 | 3 | 40 s | **Immune to fall damage**; silent landing | Winter's Veil |
| **Twisted Wall of Light** | INT 30 | 2 | 44 | 2 | 20 s | A 6 m magic barrier that **negates one projectile** | Iron Eclipse |
| **Magic Shield** | INT 22 | 1 | 26 | 3 | 90 s | +40% magic absorption to equipped shield | Ember Keep |
| **Strong Magic Shield** | INT 40 | 1 | 40 | 2 | 90 s | +70% magic absorption; **costs 8 stamina/s to maintain** | Grave of Kings |
| **Soul Mass Sentinel** | INT 34 | 2 | 46 | 2 | 60 s | One orbiting mass that auto-fires at Grade ≤2 attackers | The Want Beneath |
| **Crystal Hail** | INT 46 | 2 | 52 | 2 | — | 14 crystal shards in an arc, 42 each (588 total) | Convergence |

*(Sorcery total: 13 offensive + 14 utility/support + 7 blade-projectile & specialist = **34**.)*

### 4.3.3 Remaining Sorceries (blade-projectile & specialist line)

| Spell | Req | Slots | FP | Dmg | Notes |
|---|---|---|---|---|---|
| **Soul Blade** | INT 26 | 1 | 24 | 330 | Throws a conjured blade; **PIERCE damage type** — severs parts |
| **Great Soul Blade** | INT 40 | 1 | 34 | 486 | As above, Grade 3 |
| **Soul Arrow Barrage** | INT 32 | 2 | 42 | 5 × 96 = 480 | 5 rapid arrows, 8f apart |
| **Crystal Blade of the Eclipse** | INT 52 | 2 | 60 | 610 | Homing crystal blade; shatters for AoE 180 |
| **Soul of the Nameless** | INT 58 | 3 | 80 | 700 | Summons a spectral knight that fights for 30 s (AI: Duelist archetype) |
| **Mass Soul Arrow** | INT 20 | 2 | 30 | 3 × 168 = 504 | Three arrows in a spread |
| **Soul Lantern** | INT 12 | 1 | 14 | — | Reveals hidden walls/illusions in a 12 m radius; **required for 4 optional areas** |

---

## 4.4 — SCHOOL II: MIRACLES (FTH — *Sustain / Smite*)

**Identity.** The only school that heals. Lightning damage (the second-rarest absorption in the game, and universally weak against stone/dragons/constructed), plus the strongest **party** utility in the game.

**Weakness.** Slowest casts of the four schools; lightning is fully resisted by a handful of late enemies; and the school's power is *distributed* — it is strongest in co-op and weakest solo.

**Unique property — Conviction (§2.3.8):** at FTH ≥30, healing Miracles gain +8%; at FTH ≥50, +15% and charge-type Miracles gain one extra use. At FTH ≥40, all Miracles gain Grade 2 interrupt immunity.

### 4.4.1 Healing & Sustain

| Spell | Req | Slots | FP | Uses | Heal | Frames | Notes |
|---|---|---|---|---|---|---|---|
| **Heal** | FTH 10 | 1 | 20 | 4 | 300 | 48 | Baseline. Available to Build A. |
| **Med Heal** | FTH 18 | 1 | 28 | 3 | 460 | 56 | |
| **Great Heal** | FTH 28 | 1 | 40 | 2 | 720 | 68 | Pilgrim start |
| **Heal Aid** | FTH 14 | 1 | 24 | 3 | 260 | 40 | **Fastest heal; can be cast while walking at ×1.30** |
| **Caressing Tears** | FTH 22 | 1 | 32 | 2 | 12/s for 30 s | 52 | Regeneration; stacks with Blessed infusion |
| **Bountiful Sunlight** | FTH 40 | 2 | 58 | 1 | 90/s in a 5 m field, 6 s | 76 | **Heals allies too** — the co-op Miracle |
| **Tears of Denial** | FTH 24 | 1 | 36 | 2 | — | 50 | Survive one lethal hit at 1 HP; lasts 90 s. +1 use at FTH 50 |
| **Second Chance** | FTH 34 | 2 | 52 | 1 | — | 62 | Auto-revive at 40% HP once per rest; **only Miracle that works in death's animation** |
| **Replenishment** | FTH 30 | 1 | 44 | 2 | 8% max HP/s for 20 s | 58 | Strongest single-target sustain |
| **Divine Blessing** | FTH 26 | 1 | 38 | 2 | 620 + cures ALL status | 60 | The only status-cure in the game that also heals |
| **Homeward** | FTH 8 | 1 | 12 | 5 | — | 44 | Fast travel to last bonfire. Available to Build A. |
| **Seek Guidance** | FTH 12 | 1 | 16 | 3 | — | 40 | Reveals player messages in a 40 m radius for 120 s |

### 4.4.2 Lightning (Offensive)

| Spell | Req | Slots | FP | Uses | Dmg @ SB 262 | Frames | Range | Notes |
|---|---|---|---|---|---|---|---|---|
| **Lightning Spear** | FTH 20 | 1 | 22 | 8 | 240 | 46/4/16 | 26 m | Baseline |
| **Great Lightning Spear** | FTH 30 | 1 | 30 | 6 | 348 | 54/4/18 | 28 m | |
| **Sunlight Spear** | FTH 45 | 2 | 48 | 3 | **520** | 66/6/22 | 32 m | **Grade 4 poise dmg** |
| **Lightning Storm** | FTH 50 | 3 | 80 | 1 | 12 × 128 = **1536** | 92/180/30 | 14 m radius | **Highest total damage of any spell in the game.** 12 bolts over 3 s; you are rooted; cannot be interrupted while channeling |
| **Wrath of the Gods** | FTH 36 | 2 | 44 | 3 | 380 | 40/8/18 | **6 m AoE around caster** | Fastest AoE Miracle; the Paladin's panic button |
| **Lightning Blade** | FTH 30 | 1 | 34 | 2 | +85 lightning AR | 52 | 120 s | Weapon buff |
| **Darkmoon Blade** | FTH 45 / Blue Sentinel rank 2 | 2 | 50 | 1 | **+135 lightning AR** | 60 | 90 s | Best weapon buff in game; **covenant-gated** |
| **Force** | FTH 10 | 1 | 14 | 6 | 0 | 32/6/14 | 3 m pulse | **Knockback only; Grade 3 poise dmg.** Available to Build A. Best posture tool per FP in game |
| **Great Force** | FTH 28 | 1 | 28 | 4 | 0 | 44/8/20 | 5 m pulse | Grade 4 knockback; knocks down |
| **Wrath of Heaven** | FTH 55 | 3 | 70 | 1 | 900 | 88/24/32 | 10 m column | Single massive strike from above; **unblockable** |

### 4.4.3 Support & Oath Miracles

| Spell | Req | Slots | FP | Duration | Effect |
|---|---|---|---|---|---|
| **Oath of the Eclipse** | FTH 10 | 1 | 30 | 60 s | +12% physical damage, **+8 poise** |
| **Sacred Oath** | FTH 30 / Warrior of Sunlight rank 1 | 2 | 44 | 60 s | **+20% damage, +20% defense**; cures Hollow-Blight |
| **Vow of Silence** | FTH 40 | 2 | 80 | 15 s | **12 m radius: no spellcasting by anyone, including the caster.** The anti-caster nuke. Cannot be resisted. |
| **Blessed Weapon** | FTH 26 | 1 | 32 | 120 s | +55 lightning AR **and** 0.3%/s HP regen **and** −25% Hollowing accrual |
| **Dark Blade** | FTH 20 / INT 20 | 1 | 34 | 90 s | +80 **dark** AR. The only cross-school buff — a Miracle that deals dark damage. |
| **Magic Barrier** | FTH 22 | 1 | 26 | 90 s | +40% magic/dark absorption to self |
| **Great Magic Barrier** | FTH 40 | 1 | 42 | 90 s | +70% magic/dark absorption |
| **Bountiful Light** | FTH 34 | 2 | 48 | 30 s | Emits light; reveals illusions; **damages Abyssal enemies 14/s in 6 m** |
| **Soothing Sunlight** | FTH 44 / Sunlight rank 2 | 2 | 60 | 20 s | Heals ALL allies in 12 m for 40/s |
| **Sunlight Blade** | FTH 50 | 2 | 56 | 90 s | +110 lightning AR + Burn 20 on hit |

*(Miracle total: 12 healing/sustain + 10 lightning/offensive + 10 support/oath = **32**.)*

---

## 4.5 — SCHOOL III: PYROMANCY (INT+FTH hybrid — *Consume*)

**Identity.** Fire, area denial, and self-buffs. Pyromancy is the **only school that scales off both INT and FTH simultaneously**, and the only one whose catalyst is **weightless** — which makes it the school that every melee build can dip into without a weight cost.

**Weakness.** Fire absorption is the second-most-common resistance in the game (Ember Keep is nearly immune). Short range. No interrupt resistance.

### 4.5.1 Hybrid Scaling Formula

```
PYROMANCY_SPELL_BUFF = CATALYST_BUFF × PYRO_MULT
PYRO_MULT = 1 + 0.011 × max(0, INT − 10) + 0.011 × max(0, FTH − 10)
   INT 40 / FTH 40 → 1 + 0.33 + 0.33 = ×1.66
   INT 60 / FTH 60 → 1 + 0.55 + 0.55 = ×2.10   (but see the diminishing note)
   INT 40 / FTH 10 → 1 + 0.33 + 0.00 = ×1.33
DIMINISHING OVERRIDE: above avg(INT,FTH) = 40, the coefficient drops from 0.011 to 0.0055 per point.
   INT 60 / FTH 60 → 1 + 0.33 + 0.33 + (20 × 0.0055 × 2) = ×1.88
```

> **The practical cap for pyromancy is 40/40.** Beyond that, you are paying 2× the level cost for 13% more damage. This is deliberate: pyromancy is the *dip* school, and its math should push players to stop at 40/40 and spend the rest on VIG or STR. The **Pyromancer-Fighter** (40/40 pyro, 40 STR) is one of the strongest hybrid archetypes in the game precisely because of this ceiling.

### 4.5.2 Offensive Pyromancies

| Spell | Req | Slots | FP | Uses | Dmg @ 40/40, SB 208×1.66 | Frames | Range | Notes |
|---|---|---|---|---|---|---|---|---|
| **Fireball** | INT/FTH 8 | 1 | 12 | 12 | 260 | 40/6/16 | 18 m | Baseline; applies Burn 15 |
| **Great Fireball** | 16 | 1 | 20 | 8 | 420 | 52/8/20 | 20 m | |
| **Fire Orb** | 22 | 1 | 26 | 6 | 520 | 58/8/22 | 22 m | |
| **Great Chaos Fireball** | 40 | 2 | 56 | 3 | **820** + 3 m AoE | 72/12/28 | 26 m | Leaves a **chaos flame pool** (48 dmg/s, 8 s) |
| **Firestorm** | 34 | 2 | 48 | 2 | 14 × 62 = 868 | 64/40/24 | **self-centered 8 m** | The classic "get off me"; you are rooted |
| **Fire Surge** | 20 | 1 | 8/s | channel | 78/s | 20/channel/18 | 14 m | **Channeled stream**; cheap, sustained, interruptible |
| **Fire Whip** | 28 | 1 | 32 | 4 | 3 × 148 = 444 | 44/18/20 | 7 m | 3 lashing hits; **Grade 3**; the melee pyromancer's tool |
| **Flame Fan** | 24 | 1 | 28 | 5 | 5 × 88 = 440 | 38/10/18 | 6 m cone | Fastest AoE pyromancy |
| **Black Flame** | 36 | 2 | 44 | 3 | 640 **Dark+Fire split** | 62/10/24 | 20 m | The only dark-damage pyromancy; requires INT+FTH 36 |
| **Chaos Storm** | 44 | 3 | 78 | 1 | 22 × 58 = **1276** | 84/120/30 | 9 m field | Field persists 4 s; you may move during it |
| **Burning Chaos** | 50 | 3 | 88 | 1 | 1080 + Burn 60 | 90/14/32 | 24 m | Largest fire projectile; knocks down Grade ≤3 |
| **Acid Surge** | 26 | 1 | 34 | 3 | 60 | 50/20/22 | 8 m cone | **Destroys 45% of target equipment durability** (players: halves their absorption for 30 s) |
| **Fire Spit** | 14 | 1 | 16 | 8 | 190 | 30/4/14 | 12 m | Fastest pyromancy; **castable while running at ×1.55** |
| **Combustion** | 12 | 1 | 14 | 10 | 210 | 26/4/12 | **2.5 m** | Melee-range instant; the flame-monk's R1 replacement |
| **Great Combustion** | 24 | 1 | 24 | 6 | 400 | 34/6/16 | 3 m | Grade 3 |

### 4.5.3 Support Pyromancies

| Spell | Req | Slots | FP | Duration | Effect |
|---|---|---|---|---|---|
| **Power Within** | INT/FTH 18 | 1 | 26 | 60 s | **+25% damage, +25% attack speed, −20% defense**; drains 0.6% max HP/s. *The pyromancer's identity buff.* |
| **Flash Sweat** | 14 | 1 | 18 | 30 s | +50% fire absorption; extinguishes Burn |
| **Profuse Sweat** | 22 | 1 | 26 | 45 s | +70% fire absorption; **slows your movement 12%** |
| **Iron Flesh** | 26 | 1 | 34 | 45 s | **+30 poise, +25% physical absorption, −45% movement speed, cannot roll.** The DS1 classic, restored exactly. |
| **Warmth** | 30 | 1 | 40 | 30 s | Places a healing flame: 42 HP/s to anyone in 4 m; cures Frost |
| **Rapport** | 20 | 1 | 30 | 20 s | **Charms a humanoid enemy to fight for you.** Cannot charm bosses or elites. |
| **Undying Ember** | 34 | 2 | 50 | 90 s | +18% fire AR to right weapon + Burn 25 on hit |
| **Chaos Blade Blessing** | 40 | 2 | 56 | 90 s | +95 fire AR + Grade 2 interrupt immunity on your next 3 casts |
| **Black Serpent** | 46 | 2 | 62 | — | Summons a dark-fire serpent that pursues for 12 s; 6 × 140 |
| **Flame of the Ember Keep** | 50 / Ember Keep covenant | 3 | 74 | permanent aura | 6 m aura, 22 dmg/s to enemies; **+15% fire resist to allies** |
| **Great Chaos Flame** | 55 | 3 | 96 | 8 s pool | Creates a 6 m chaos pool that persists 12 s (64 dmg/s) |
| **Smoke of the Ashen Coast** | 28 | 1 | 22 | 60 s | Emits smoke: enemies lose lock-on and detection within 8 m |
| **Kindle** | 16 | 1 | 20 | instant | **Lights an unlit brazier** (world interaction; opens 3 optional areas) |
| **Extinguish** | 16 | 1 | 18 | instant | Extinguishes lava/fire terrain in a 4 m radius for 20 s (Ember Keep traversal tool) |
| **Cinder Walk** | 22 | 1 | 24 | 60 s | Immune to lava/floor-fire damage; leaves burning footprints (18 dmg/s) |

*(Pyromancy total: 15 offensive + 15 support = **30**.)*

---

## 4.6 — SCHOOL IV: HEXES / DARK MAGIC (DS2 INT+FTH — *Subtract*)

**Identity.** The DS2 import, and the school that most distinguishes *Convergence* from any prior Souls game. Hexes do not primarily deal damage — they **remove resources from the target**: HP, stamina, FP, Want, healing, and the ability to cast. A hexer wins by making the enemy unable to fight, then finishes them with a knife.

**Cost.** Hexes are the only school with a **second resource (Want charges)**, the slowest casts, the lowest HP pools, and the highest attribute floor (INT+FTH). They are a specialist school with no casual entry point.

### 4.6.1 The WANT Resource

```
WANT_MAX   = 3 (base) + 1 (Hexwife Wraps) + 1 (Dark Sigil ×2) + 1 (Greymouthe rank 2) + 1 (Vessel of Want)
             practical maximum: 7
WANT_REGEN = 1 charge per 9.0 s, only while OUT OF COMBAT (no damage dealt/taken for 4 s)
             in combat: 1 per 24 s
ACQUISITION:
   +1 Want per enemy killed (capped at WANT_MAX)
   +2 Want per boss phase transition witnessed
   +1 Want per Severance performed
   +WANT_MAX (full refill) per bonfire rest
   +1 Want per Soul consumed via the DARK ORB OF CONSUMPTION item (max 3/rest)
CONSUMPTION: most Hexes cost 1 Want; the strongest cost 2–3
OVERDRAFT: at Want = 0, Hexes may still be cast by paying HP instead:
             HP_COST = FP_COST × 1.8  (e.g. Dark Orb at 0 Want = 50 HP)
             ⇒ A hexer is never helpless. This is the DS2 lesson learned.
```

> **Why Want exists separately from FP.** FP is a *rest-scoped* budget — you run out over an area. Want is a *combat-scoped* budget — you run out over eight seconds. Two clocks at different scales force two different kinds of planning, and together they produce the hexer's defining experience: **you are always one decision away from being empty, and there is always a way to keep going if you will pay in blood.**

### 4.6.2 Hex Scaling & Resonance

```
HEX_SPELL_BUFF = CATALYST_BUFF × [ J(min(INT,FTH)) + 0.40 × J(|INT − FTH|) ]
   J(x): 0.00 (x<18) · 0.52 (18) · 0.78 (27) · 1.00 (40) · 1.14 (60) · 1.25 (99)   [interpolated]
```

**Asymmetry table** (this is the build-defining discovery from §2.8.3):

| INT | FTH | min | \|Δ\| | Multiplier | vs. 60/50 |
|---|---|---|---|---|---|
| 60 | 50 | 50 → 1.070 | 10 → 0.00 | **1.070** | baseline |
| 50 | 50 | 50 → 1.070 | 0 → 0.00 | **1.070** | 1.00× |
| **60** | **40** | 40 → 1.000 | 20 → 0.586×0.40 = 0.234 | **1.234** | **1.15×** |
| **60** | **30** | 30 → 0.852 | 30 → 0.868×0.40 = 0.347 | **1.199** | 1.12× |
| **60** | **27** | 27 → 0.780 | 33 → 0.921×0.40 = 0.368 | **1.148** | 1.07× |
| **99** | **40** | 40 → 1.000 | 59 → 1.139×0.40 = 0.456 | **1.456** | **1.36×** |

**Conclusion, stated for the balance team:** the optimum hexer is **INT 99 / FTH 40** — an absurd, unbalanced-looking allocation that produces 1.36× the damage of the "sensible" 60/50 build, at the cost of 24 attribute points that could have been VIG. **We ship this.** A build that is only reachable by understanding the formula deeply is exactly the reward structure the Hex school should have. QA must, however, verify that INT 99 / FTH 40 does not exceed the 18% archetype-spread gate in *reverse* (i.e. become more than 18% **faster** than Build A). Current estimate: 1.36× hexer DPS = 162 dps sustained → still 3.2× slower than Build A. **Safe.**

### 4.6.3 RESONANCE (the Hex chaining mechanic)

```
Resonance is a hidden 0–3 ladder that tracks consecutive Hex casts.
  Cast a Hex → check time since last Hex cast:
     ≤ 8.0 s  → Resonance += 1 (max 3)
     > 8.0 s  → Resonance = 1
  Resonance decays to 0 after 8.0 s with no Hex cast.

  RES 1: +8%  dark damage · Want regen delay −1.0 s
  RES 2: +18% dark damage · Want regen delay −2.0 s · next Hex applies Hollow-Blight 25
  RES 3: +32% dark damage · Want regen delay −3.0 s · next Hex CANNOT be interrupted by Grade ≤2
         · next Hex's FP cost is refunded on kill

  GREYMOUTHE rank 2 unlocks RES 3 (otherwise caps at 2)
  GREYMOUTHE rank 3 unlocks the ABYSSAL RESONANCE variant: RES 3 becomes +44% and grants
     one free Want refund per chain.
  VESSEL OF WANT catalyst: start every chain at RES 1.
  ABYSSAL CROWN (ending reward): start every chain at RES 3.
```

**HUD representation (§9.4):** three small black knots beneath the FP bar that fill left-to-right and *thrum* audibly (a low, detuned third) as they fill. The sound is the reward. There is no text.

### 4.6.4 Offensive Hexes

| Spell | Req | Slots | FP | Want | Uses | Dmg @ 236 SB, 60/50, RES 0 | Frames | Range | Effect beyond damage |
|---|---|---|---|---|---|---|---|---|---|
| **Dark Orb** | INT/FTH 14 | 1 | 28 | 1 | 6 | **340** | 48/5/18 | 26 m | Baseline; tracks 12° |
| **Dark Hand Blade** | 18 | 1 | 22 | 1 | 8 | 288 | 36/4/14 | **3 m** | Melee-range hex; **120% crit**; fastest hex |
| **Dark Edge** | 22 | 1 | 30 | 1 | 6 | 372 | 44/6/16 | 8 m | Short-range dark wave; Grade 3 |
| **Dark Weapon** | 20 | 1 | 34 | 1 | 2 | +95 dark AR | 50 | self | Weapon buff, 90 s |
| **Dark Storm** | 30 | 2 | 48 | 2 | 3 | 9 × 84 = 756 | 66/60/24 | 9 m self-field | You are rooted; hits everything around you |
| **Affinity** | 36 | 2 | 52 | 2 | 3 | 6 × 42 = **252** (homing) | 74/—/22 | 24 m | **6 tracking orbs**; highest hit-count hex; best Resonance trigger |
| **Great Affinity** | 48 | 2 | 68 | 3 | 2 | 8 × 78 = **624** | 86/—/26 | 26 m | 8 tracking orbs |
| **Dark Dance** | 40 | 2 | 56 | 2 | 2 | 12 × 46 = 552 | 70/90/24 | 7 m orbit | 12 dark blades orbit you for 6 s, damaging anything inside |
| **Promised Walk of Peace** | 44 | 2 | 62 | 2 | 2 | 0 | 80/—/28 | 12 m field | **Halves enemy movement and attack speed for 12 s.** Does not affect bosses' speed, only their *recovery frames* (+20%) |
| **Life Drain** | 24 | 1 | 38 | 1 | 4 | 190 | 56/channel | 14 m beam | **Heals caster for 100% of damage dealt**; channeled |
| **Lifedrain Patch** | 28 | 1 | 40 | 1 | 4 | 14/s | 52 | **4 m placed field** | Field lasts 20 s; heals caster 9/s while any enemy is inside |
| **Twisted Barrage** | 32 | 2 | 60 | 2 | 2 | 4 × 118 = 472 | 62/16/22 | 10 m cone | **−22 stamina per tendril** (up to −88) |
| **Vow of the Deep** | 38 | 2 | 54 | 2 | 2 | 0 | 58 | self | +30% dark damage, −25% physical defense, 60 s. *The hexer's Power Within.* |
| **Effigy of Want** | 42 | 2 | 66 | 2 | 2 | 640 | 78/10/28 | placed | Summons a dark effigy that detonates when an enemy nears |
| **Consuming Dark** | 50 | 3 | 84 | 3 | 1 | 880 | 92/12/34 | 22 m | **Consumes the target's Want/FP pool entirely** (players: −100% FP; enemies: removes their buff) |
| **Dark Flood** | 46 | 2 | 70 | 3 | 1 | 520 | 84/40/26 | 12 m ground wave | Travels along the floor; **ignores elevation**; knocks down Grade ≤3 |
| **Abyssal Reach** | 54 | 2 | 74 | 3 | 1 | 700 | 88/8/30 | **18 m grab** | Grabs and pulls the target 6 m toward you; **cannot be blocked** |
| **Night's Hand** | 58 | 3 | 92 | 3 | 1 | 1040 | 100/14/36 | 6 m | Highest single-hit hex; **Grade 5 poise dmg** |
| **Thronebreaker** *(ending reward)* | 60 | 3 | 100 | 4 | 1 | 1200 | 110/16/40 | 20 m | **Consumes the target's entire Want meter for ×3 damage if full** |
| **Lifehunt Scythe** | INT 30 / FTH 45 | 2 | 66 | 2 | 3 | **520** | 76/10/28 | 5 m arc | **Heals the caster for 30% of all damage dealt**; costs 8% max HP to cast. *The only Hex with a Faith requirement — a Miracle that fell into the dark.* |

### 4.6.5 Utility & Debuff Hexes

| Spell | Req | Slots | FP | Want | Duration | Effect |
|---|---|---|---|---|---|---|
| **Hollow Infusion** | INT/FTH 16 | 1 | 24 | 1 | 90 s | Weapon applies **Hollow-Blight 30** on hit |
| **Soul Sink** | 20 | 1 | 26 | 1 | instant | **Reduces target's maximum HP by 12% for 45 s** (stacks ×2) |
| **Want Leech** | 26 | 1 | 32 | 1 | 30 s | Target's Want/FP regen is redirected to you at 50% |
| **Silence of the Deep** | 34 | 2 | 50 | 2 | 8 s | 8 m: **enemy spells fizzle**; unlike *Vow of Silence* it does not affect you |
| **Curse of the Nameless** | 40 | 2 | 58 | 2 | 60 s | Target forgets its own moveset: **−2 moves from its pool**, chosen randomly |
| **Sigil of Want** | 44 | 2 | 64 | 2 | permanent until rest | Places a sigil; any enemy that crosses it takes 300 dark damage and is revealed |
| **Ashen Veil** | 22 | 1 | 28 | 1 | 45 s | Self-invisibility (breaks on attack); **does not break on Hex cast** — the hexer's Hidden Body |
| **Grasp of the Deep** | 30 | 1 | 36 | 1 | 6 s | Roots a target in place (cannot move or roll); **bosses: −40% move speed instead** |
| **Dark Remedy** | 24 | 1 | 30 | 1 | instant | Heals 380 HP **and applies Toxic to self for 8 s**. The hexer's heal: it always costs something. |
| **Effigy of Ash** | 36 | 2 | 46 | 2 | 30 s | Summons a decoy that draws aggro and explodes for 300 on death |
| **Blight of the Frampt** | 48 | 2 | 70 | 3 | 90 s | Aura: all enemies in 8 m accrue Hollow-Blight 8/s |
| **Memory Theft** | 52 | 3 | 78 | 3 | instant | **Steals one attuned spell** from a player target for 60 s (PvP-only; unusable on NPCs) |
| **Nihil's Whisper** | 56 | 3 | 86 | 3 | 20 s | 15 m: enemies take +25% damage from ALL sources. **The hexer's co-op value.** |
| **Want Incarnate** *(expansion)* | 60 | 3 | 96 | 4 | 45 s | Transforms you into a dark form: +40% dark dmg, no weapons, hexes cost 0 Want, −50% max HP |

*(Hex total: 20 offensive + 14 utility/debuff = **34**, of which 33 ship in 1.0 and *Want Incarnate* arrives with the expansion.)*

---

## 4.7 — School Interaction Matrix (PvP & Co-op Ecology)

This table is the reason all four schools ship. Each school hard-counters one and is hard-countered by one.

| Attacker ↓ / Defender → | Melee (A/C) | Sorcerer | Cleric | Pyromancer | Hexer |
|---|---|---|---|---|---|
| **Melee** | Even | **Wins** (closes gap, interrupts) | Even | Loses (burn + Power Within) | **Wins** (closes gap) |
| **Sorcerer** | Loses | Even | Loses (lightning > magic absorb) | Loses (fire closes) | **Wins** (out-ranges) |
| **Cleric** | Even | **Wins** | Even | **Wins** (Wrath of Gods AoE) | Loses (Vow of Silence is mutual) |
| **Pyromancer** | **Wins** (AoE denies closing) | **Wins** | Loses | Even | Loses (hexes debuff the buff) |
| **Hexer** | Loses | Loses | **Wins** (Silence of the Deep) | **Wins** (Want Leech drains the buff) | Even |

**Design goal achieved:** no school wins more than 3 of 5 matchups, and every school loses at least 2. There is no dominant caster.

**The Vow of Silence problem, solved.** *Vow of Silence* (Miracle, FTH 40) stops all casting in 12 m — including the caster's. In DS2/DS3 this was a hard counter to entire builds. Here it is retained exactly, with two additions: (1) **Silence of the Deep** (Hex, INT/FTH 34) does the same thing *without* affecting the caster, at half the duration and higher Want cost — so the Hex school has an answer that costs more; (2) Vow of Silence's 15 s duration and 80 FP mean a cleric can cast it **twice per rest**. It is a *round-winning* tool, not a *build-winning* tool.

---

## 4.8 — Spell Acquisition & Progression Curve

| Progression point | Schools available | Spell count | Design intent |
|---|---|---|---|
| SL10 (Ashen Barrens) | 1 (your class's) | 1–2 | Teach casting with one spell |
| SL30 (Sanctuary) | 2 | 4–6 | Second school becomes buyable from Vhenn/Ysolde |
| SL55 (Sunken Cathedral) | 3 | 10–14 | Hexes unlock via Greymouthe; **the Resonance tutorial happens here** |
| SL80 (Ember Keep / Winter's) | 4 | 18–24 | Full school access; hybrid builds become real |
| SL110 (Grave of Kings) | 4 | 28–34 | Endgame spells; catalyst upgrades |
| SL125 (Convergence) | 4 | 34–40 | Soul Stream, Lightning Storm, Great Affinity |
| Post-ending (NG+) | 4 | 44+ | Ending-reward spells: Thronebreaker, Vessel of Want, Ouroboros Spine |

**Distribution across regions:** 36 spells in R01–R05, 44 in R06–R10, 41 in R11–R14, 9 covenant/ending-gated (total 130). **No spell is missable** — every missable-looking spell has a vendor fallback at Ysolde after the region's boss dies (at 3× the soul cost). This is a deliberate departure from the series' tradition of missable magic, and it is justified by Pillar P5: build fantasy must not be gated by exploration luck.

---

## 4.9 — Magic Balance Targets

| Metric | Sorcery | Miracle | Pyromancy | Hex |
|---|---|---|---|---|
| Peak single-hit damage | 560 (Crystal Soul Spear) | 900 (Wrath of Heaven) | 1080 (Burning Chaos) | **1200** (Thronebreaker) |
| Peak sustained DPS (10 s, stationary) | 486 | 402 | **512** | 348 |
| Peak AoE total damage | 918 (Soul Stream) | **1536** (Lightning Storm) | 1276 (Chaos Storm) | 756 (Dark Storm) |
| Time-to-first-damage from rest | **1.1 s** | 1.4 s | 1.2 s | 1.9 s |
| Resource exhaustion point (FP) | 8 casts | 6 casts | 11 casts | 6 casts + Want empty at 4 |
| Utility score (0–10) | **8** | 7 | 6 | 9 |
| Solo viability (boss clear) | ✔ | ✔ | ✔ | ✔ (slowest) |
| Co-op value index | 1.05 | **1.34** | 0.98 | **1.42** |
| Invasion value index | 0.92 | 1.08 | **1.26** | 1.19 |
| Attribute floor to be functional | INT 20 | FTH 20 | 14/14 | **28/28** |
| Attribute ceiling | INT 60 | FTH 60 | 40/40 | INT 99 / FTH 40 |

---

## 4.10 — Technical Implementation Notes

| Concern | Spec |
|---|---|
| **Spell data format** | Each spell is a data asset (`spell_*.json`) with: `req`, `school`, `slots`, `fp`, `want`, `uses`, `frames{startup,active,recovery}`, `damage`, `poise_damage`, `poise_grade`, `range`, `aoe{shape,radius}`, `status_applied[]`, `vfx`, `sfx`, `interrupt_grade`, `location`, `vendor_fallback` |
| **Projectile pooling** | All projectiles are pooled objects; max 64 live projectiles per session (covers *Lightning Storm* 12 + *Crystal Hail* 14 + *Affinity* 8 + 4-player co-op) |
| **Homing implementation** | Homing projectiles re-target at most every 8f and only within a 12° cone from their current velocity vector — prevents the "orbits the player forever" degenerate case |
| **AoE resolution** | All AoEs are resolved server-side in multiplayer with a 3-frame rollback window; visual AoE is 8% *larger* than the actual hitbox (a deliberate generosity margin, applied uniformly) |
| **Field effects** | Chaos pools, Lifedrain Patches, and Sigils of Want are **persistent world entities** with their own netcode channel, max 8 live per session |
| **Cast interruption** | Resolved on the poise system (§3.7) — a cast is an animation like any other, with `TRUE_POISE_GRADE = 0` unless Resonance 3 / Conviction / Guarded cast applies |
| **Determinism** | Spell damage uses the same seeded stream as item drops (Vol. 0 A.8). No spell has random damage variance. **Every hit is exactly reproducible** — this matters for speedrunning and for QA |
| **Audio mix** | Each cast has a 3-layer sound: *intent* (mouth/hand), *release* (projectile), *impact*. The intent layer plays at cast-start and is the audio telegraph for PvP |

---

*End of Volume 4. Continue to Volume 5: World Map & Interconnectivity.*
