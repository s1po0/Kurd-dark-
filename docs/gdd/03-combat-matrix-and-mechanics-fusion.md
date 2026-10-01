# VOLUME 3 — COMBAT MATRIX & MECHANICS FUSION

> **Design owner:** Lead Combat Architect
> **Depends on:** Vol. 0 (A.1 damage, A.2 poise, A.6 frame conventions), Vol. 2 (stat budgets) · **Feeds:** Vol. 4 (casting), Vol. 6 (boss design), Vol. 9 (HUD)

---

## 3.0 — The Fusion Contract

Three combat systems are being merged. Each one has a failure mode that another one fixes. The contract below is the entire design of *Convergence*'s combat in one table, and every subsequent section is an elaboration of a cell.

| Import | What it gives us | What it breaks | What fixes it |
|---|---|---|---|
| **DS3 movement & tempo** | Responsive, readable, omnidirectional evasion; 60 fps clarity; a combat *rhythm* players can feel | Stamina becomes nearly free; heavies lose identity; combat flattens toward action-game spam | **DS1 true poise** (weight is rewarded) + **DS2 ADP cap** (i-frames cannot be bought infinitely) |
| **DS3 Weapon Arts & FP** | Per-weapon identity; a second resource that creates rotation decisions; stance as expression | Two-resource management overwhelms new players; FP becomes a fourth health bar | **FP is a small, coarse budget** (70–240 typical) + Weapon Arts are *optional* (every weapon has a full moveset without them) |
| **DS2 Power Stance** | Dual-wielding with real movesets instead of two independent R1s; combo depth; posture play | Stat-gating confusion; incompatible pairings feel arbitrary | **Explicit compatibility matrix surfaced in UI** (§3.6.2, Vol. 9 §9.5) + 1.5× rule stated on the equipment screen |
| **DS1 true poise & equip load tiers** | Armor weight as a real decision; the "one hit absorbed per swing" mastery curve | Feels invisible/unfair to modern players who never learned it | **The Poise Diamond HUD element** (§9.4) makes the absorb state literally visible |
| **DS1 tail-cuts & severance** | Boss fights that change shape; a reason to reposition during a fight; unique boss weapons | Feels like a hidden checklist; players miss it and blame the game | **Severance is diegetically visible** (wounds, limps, sparks) + **the Sever Tracker HUD** (§9.4) + explicit item text hinting at parts |

**The non-negotiable combat rule:** *Every action must have a visible cost, a readable wind-up, and a recoverable mistake.* No system in this volume is permitted to violate it.

---

## 3.1 — Movement & Tempo Model (DS3 lineage)

### 3.1.1 Speed Table

| State | Speed (u/s) | Stamina drain | Notes |
|---|---|---|---|
| Walk | 118 | 0 | Silent footsteps; reduces enemy detection radius by 40% |
| Run (default) | 300 | 0 | Free-running is unlimited — DS3 rule retained |
| Sprint (held) | 420 | 14/s | Sprint drains stamina; at 0 stamina you decelerate to run over 18f |
| Backstep | 240 (14f) | 22 | 6f i-frames; the *only* evasion with a short recovery |
| Strafe (lock-on) | 168 | 0 | Lock-on strafing is 44% slower than free run — this is the real cost of locking on |
| Jump | apex 196 u | 30 on landing | Landing within 12f of an attack input = **jump attack** (Grade 3 poise dmg) |
| Fall damage threshold | > 12 m | — | Reduced by DEX (§2.3.5) and by mid/fat roll load (+5%/+12% taken) |

### 3.1.2 Omnidirectional Rolling

Rolls are **fully omnidirectional** (DS3), with a 360° analog input read. However, roll *distance and i-frames* vary by direction:

| Direction | Distance multiplier | i-frame modifier | Recovery modifier |
|---|---|---|---|
| Forward | ×1.00 | ±0f | ±0f |
| Backward | ×0.85 | +1f | −3f |
| Left/Right | ×0.92 | ±0f | +2f |
| **Toward the attacker** (within 25° of the incoming hit vector) | ×0.95 | **+3f** | +5f |

> **The "roll into it" bonus (+3f i-frames)** is the single most important micro-mechanic in the game and it is *never explained in text.* It is discovered. It rewards the DS-series' core literacy — that aggression is defensive — and it is the reason high-level play looks like players are throwing themselves at attacks rather than away from them. It appears in the tutorial only as a visual: the Ashen Barrens' second enemy is designed so that rolling *away* always gets hit and rolling *into* always survives. Players learn it in 40 seconds without a tooltip.

### 3.1.3 Roll Frame Data (at ADP 16, Agility 95)

| Tier | Total | Startup | i-frames | Recovery | Stamina | Cancel window |
|---|---|---|---|---|---|---|
| **Fast (<30%)** | 34f | 6f | **16f** (f7–22) | 12f | 26 | C@f23–30 into attack/guard |
| **Mid (30–70%)** | 38f | 8f | **13f** (f9–21) | 17f | 30 | C@f26–34 |
| **Fat (70–100%)** | 48f | 12f | **9f** (f13–21) | 27f | 40 | C@f36–48 |
| **Overburdened (≥100%)** | 22f | — | **0f** | 22f | 30 | *Stagger-step, not a roll. Cannot be canceled.* |

**Vulnerable windows:** fast roll leaves **18f** exposed; mid **25f**; fat **39f**. This spread — 18 vs 39 frames — is the entire mechanical argument for Vitality/Adaptability investment, and it is a **2.2× difference in the size of your mistake window.** That is a large enough number to feel, and small enough that no tier is unusable.

### 3.1.4 Stamina Regeneration

```
BASE_REGEN       = 46 / s  (at END 10)
END_BONUS        = +0.4 / s per END point     →  END 24 = +5.6
ADP_DELAY        = recovery delay after any spend:  1.30 s (ADP10) → 0.90 s (ADP40)
RING_MODS        = Chloranthy +2 (×1.20), Green Turtle +2 (×1.35, but −20% move speed)
GUARD_MOD        = while guarding: ×0.35
CASTING_MOD      = during any cast: ×0.00 (regen fully suspended)
OVERBURDEN_MOD   = ≥100% load: ×0.55
FROST_MOD        = frosted: ×0.82
```

**Worked example (Build A, END 24, Chloranthy +2, ADP 16):**
`base 46 + END 5.6 = 51.6 → ×1.20 = 61.9/s`; delay 1.18 s. After a 32-stamina Posture Break: `1.18 s delay + (32 / 61.9) = 1.70 s` to full recovery from that spend. **This is the number that sets the game's pacing** — roughly 1.7 seconds between committed actions.

---

## 3.2 — The Two-Resource Model: Stamina & FP

| | **Stamina** | **Focus Points (FP)** |
|---|---|---|
| Grants | Attacks, rolls, sprints, guards, blocks | Weapon Arts, spell casts, special guards |
| Refills | Automatically, fast (46–62/s) | **Only** via Estus (Ashen) allocation, FP-restoring items, or bonfire rest |
| Typical pool | 84–187 | 63–408 |
| Design role | The **tempo** resource — governs *when* you act | The **identity** resource — governs *what* you act with |
| Failure state | Out of stamina = can't roll = usually death | Out of FP = lose your Weapon Art and spells, keep your moveset |

**The critical rule: running out of FP is never lethal.** A build with 0 FP is still a fully functional melee character. This prevents the DS3 problem where a caster who mismanaged FP was functionally dead. FP is a *luxury budget*, stamina is a *survival budget*.

### 3.2.1 Stamina Cost Table (reference weapon classes)

| Action | Dagger | Sword | Greatsword | Ultra | Spear | Fist | Bow | Cast |
|---|---|---|---|---|---|---|---|---|
| R1 | 12 | 18 | 26 | 32 | 16 | 10 | 14 | 12 |
| R2 | 16 | 24 | 38 | 52 | 22 | 14 | — | — |
| Running R1 | 18 | 26 | 40 | 58 | 24 | 16 | — | — |
| Rolling R1 | 20 | 30 | 46 | 66 | 28 | 18 | — | — |
| Jump R1 | 22 | 32 | 48 | 70 | 30 | 20 | — | — |
| Guard (per hit absorbed) | — | 8 + (dmg×0.06) | 10 + (dmg×0.07) | — | 9 + … | — | — | — |
| Parry attempt | 14 | 14 | — | — | — | — | — | — |
| Backstep | 22 | 22 | 22 | 22 | 22 | 22 | 22 | 22 |
| Power Stance L1 | — | 32 | 44 | — | 36 | 28 | — | — |
| Power Stance L2 | — | 44 | 62 | — | 48 | 36 | — | — |

**Guard-break:** if a blocked hit's stamina cost exceeds your *current* stamina, you are **guard-broken** — 54f stagger, weapon lowered, and you take 40% of the hit's damage. Guard-break is the tank's real failure state, not HP.

---

## 3.3 — Weapon Arts (DS3 lineage, expanded)

Every one of the 21 weapon classes has **at least one** Weapon Art; 14 classes have **three ranks** of the same Art (unlocked with Embers of Ash), and 7 have **branching** Arts (choose one of two at rank 2 — a permanent choice per weapon, reversible only at Vhenn).

### 3.3.1 Art Structure

```
STANCE (hold L2/RT)  →  enters a modified idle pose with unique movement (0.6 s to enter, 12 FP flat)
   ├─ R1 in stance  →  Art follow-up A  (variable FP)
   └─ R2 in stance  →  Art follow-up B  (variable FP)
Weapon Arts do NOT require stance for one-shot use: tap L2 = Art A directly.
```

**FP budgeting rule:** a Weapon Art costs **8–26 FP**. With Build A's 154 FP, that's ~8 Art uses per rest. With Build C's 70 FP, that's ~3. The Art economy is therefore *tightly* bound to Attunement — which is why ATT is in the Intent budget and not the Action budget.

### 3.3.2 Weapon Art Reference Table (all 21 classes)

| # | Class | Art name | FP | Frames (S/A/R) | Damage | Poise dmg / Grade | Effect |
|---|---|---|---|---|---|---|---|
| 1 | **Dagger** | *Quickstep* | 8 | 4/—/18 | 0 | — | 22f of movement + **14f i-frames**; the caster's escape |
| 2 | **Dagger (rank 2)** | *Mercy's Edge* | 14 | 12/4/22 | ×1.4 | 18 / 2 | +80% critical on the next 6 s |
| 3 | **Straight Sword** | *Stance: Piercing Sweep* | 12 | 18/6/20 | ×1.15 | 32 / 3 | Guard-piercing thrust; ignores 100% of shield block |
| 4 | **Straight Sword (rank 2)** | *Stance: Rising Riposte* | 14 | 14/6/26 | ×1.05 | 26 / 3 | Counter-hit window: 60% bonus if struck during startup |
| 5 | **Greatsword** | *Stance: Cleave* | 20 | 26/8/30 | ×1.60 | 58 / 4 | Two-handed overhead; knocks down Grade ≤3 enemies |
| 6 | **Ultra Greatsword** | *Stance: Iron Verdict* | 22 | 34/10/34 | ×1.85 | **95 / 5** | **Grade 5 — staggers anything, including bosses.** 78f total. The tank's answer to poise-immune enemies |
| 7 | **Curved Sword** | *Spin Sweep* | 14 | 8/26/18 | ×0.55 ×3 hits | 16 / 1 each | 360° coverage; hits up to 5 targets |
| 8 | **Curved Greatsword** | *Stance: Falling Moon* | 20 | 22/8/28 | ×1.55 | 54 / 4 | Jumping arc; crosses gaps up to 6 m |
| 9 | **Katana** | *Iai: Held Edge* | 16 | 30/4/24 | ×1.30 | 40 / 3 | Sheathed draw; **hold** to charge up to ×2.10 (max 60f) |
| 10 | **Thrusting Sword** | *Stance: Needle Waltz* | 12 | 10/18/16 | ×0.45 ×4 | 12 / 1 each | Rapid 4-hit; **highest bleed/dark buildup application rate in game** |
| 11 | **Axe** | *Stance: Warcry* | 18 | 24/—/— | — | — | Self-buff: +18% physical damage, +12 poise, 30 s. **Stacks with Oath.** |
| 12 | **Greataxe** | *Stance: Anchor Drop* | 24 | 32/10/36 | ×1.95 | 82 / 4 | Ground-slam; 3 m shockwave, knocks down |
| 13 | **Hammer** | *Stance: Bell-Ring* | 12 | 16/4/20 | ×1.10 | 34 / 3 | Applies **Frost buildup 30** even on non-frost weapons |
| 14 | **Great Hammer** | *Stance: Molten Core* | 22 | 30/12/32 | ×1.75 | 76 / 4 | Fire AoE 2.5 m; applies Burn (12 dmg/s, 5 s) |
| 15 | **Spear** | *Stance: Long Reach* | 14 | 12/8/18 | ×1.05 | 28 / 2 | Extends hitbox range 35% for one thrust; **hits through other enemies** |
| 16 | **Pike** | *Phalanx Brace* | 16 | 20/—/— | — | +45 poise, 8 s | Cannot move; **blocks all charge attacks**; reflects 20% damage |
| 17 | **Halberd** | *Stance: Reaping Arc* | 18 | 20/10/26 | ×1.35 | 48 / 3 | 220° horizontal arc; **severance-capable** (§3.9) |
| 18 | **Reaper** | *Stance: Harvest* | 20 | 24/8/28 | ×1.45 | 44 / 3 | Applies Bleed 45 + drains 6 FP from target |
| 19 | **Whip** | *Stance: Lash Coil* | 12 | 14/12/20 | ×0.70 | 20 / 2 | **Disarms** humanoid targets for 3 s (they drop their weapon) |
| 20 | **Fist / Claw** | *Stance: Flurry* | 14 | 6/22/14 | ×0.32 ×6 | 8 / 1 each | Highest hit count; best status-application build in the game |
| 21 | **Bow** | *Steady Aim* | 10 | 40/—/— | — | — | Zoom ×2.4, arrow velocity +40%, **no gravity drop** for the next shot |
| 22 | **Greatbow** | *Siege Volley* | 26 | 52/—/— | ×2.20 | 60 / 4 | Fires 3 arrows in a spread; knocks down at ≤Grade 3 |
| 23 | **Crossbow** | *Rapid Load* | 12 | 18/—/— | — | — | Reload 3 bolts in 18f (normally 46f per bolt) |
| 24 | **Catalyst (staff)** | *Spellblade Edge* | 10 | 12/4/18 | ×0.85 magic | 18 / 2 | Melee swing that applies **Magic buildup** instead of physical |
| 25 | **Catalyst (chime/talisman)** | *Toll* | 8 | 20/—/12 | 0 | — | 6 m bell wave; applies **Hollow-Blight 40**; silences enemy casts for 1.5 s |
| 26 | **Shield (small/parry)** | *Parry* | 0 | 6/8/22 | — | — | Stamina-free; see §3.10 |
| 27 | **Shield (medium)** | *Stance: Shield Bash* | 12 | 16/4/24 | ×0.55 | 42 / 3 | **Guaranteed posture damage** on blocked enemies |
| 28 | **Greatshield** | *Stance: Bulwark* | 20 | 24/—/— | — | **+60 poise, 6 s** | Block stamina cost → 0 for the duration |
| 29 | **Torch** | *Stance: Kindle* | 14 | 18/—/— | — | — | Applies Burn to self weapon (+65 fire AR, 45 s) |
| 30 | **Twinblade** | *Stance: Whirl* | 18 | 10/32/20 | ×0.48 ×5 | 14 / 1 each | Advancing spin; **travels 4.5 m** — a movement Art |

### 3.3.3 Weapon Art Ranks (Ashen infusion interaction)

| Rank | Unlock cost | Effect |
|---|---|---|
| **I** | Free (weapon default) | Base Art |
| **II** | Ember of Ash ×2 + 4,000 souls | −15% FP cost, +10% damage, +6f cancel window |
| **III** | Ember of Ash ×4 + 12,000 souls + Vhenn rank 3 | −30% FP, +20% damage, **and one new property** unique to that Art (e.g. *Iron Verdict III* gains a shockwave; *Quickstep III* gains 4 more i-frames) |
| **Ashen infusion** | Ember ×3 + Vhenn rank 4 | Removes weapon stat scaling, **+1 Art rank**, **−50% Art FP cost** — the "Art-purist" build (§2.4.3) |

---

## 3.4 — Guard, Parry, Block & Riposte

### 3.4.1 Guard

```
BLOCK_STAMINA = WEAPON_STAM_BASE × (1 − STABILITY/100) + DAMAGE × SHIELD_ABSORB_FACTOR
GUARD_BREAK when BLOCK_STAMINA > CURRENT_STAMINA
   → 54f stagger, take 40% damage, weapon lowered
STABILITY: small shield 45–60 · medium 60–78 · greatshield 78–100
100% PHYSICAL ABSORB shields exist (8 in game) — but NO shield absorbs 100% of all five types.
```

**Design rule:** every shield in the game has at least one damage type below 60% absorption. There is no "hold block and win" shield. Lightning is universally the weakest absorption on physical shields (typically 30–45%), which makes faith-based enemies the natural answer to turtling — this is a deliberate PvP ecosystem regulator.

### 3.4.2 Parry (frame data)

| Phase | Frames | Notes |
|---|---|---|
| Startup | **6f** | Input lock begins |
| **Active** | **8f** (f7–14) | Successful parry window |
| Recovery | **22f** | Punishable if whiffed |
| Post-parry riposte window | **42f** | Target is staggered; press R1 for critical |
| **Total commitment** | **36f** | Whiffing a parry is a **0.6 s** mistake |

Parry-able: all humanoid enemies, all Grade ≤3 attacks, all one-handed weapon swings. **Not** parry-able: Grade 4/5 attacks, whips, greatshields, most boss attacks, projectiles (except arrows/bolts from humanoid archers).

**New in Convergence — the *Ashen Parry*.** With the **Ashen infusion** applied to a small shield or parry-capable weapon, the active window extends to **12f** but a successful parry deals **no riposte opportunity** — instead it applies **Hollow-Blight 60** and refunds **18 FP**. This creates a second parry archetype: not "parry for damage" but "parry for tempo."

### 3.4.3 Critical / Riposte Damage

| Situation | Multiplier | Notes |
|---|---|---|
| Backstab (humanoid) | ×2.20 | Requires the target's back arc (±60°) and no guard |
| Backstab (large/boss) | Not possible | Except during POSTURE BREAK |
| Riposte after parry | ×2.80 | Dagger gets ×3.20 |
| Riposte after guard-break | ×2.40 | |
| **Riposte after POSTURE BREAK** | **×3.20** | The Power Stance payoff (§3.6.4) |
| Riposte after a boss's stagger | ×2.60 | Bosses have a dedicated stagger state |

---

## 3.5 — Poise Damage Table (the shared vocabulary)

Every damaging action in the game carries a **Poise Damage** value and a **Poise Grade**. This table is the single source of truth for §3.7, §3.8, and Vol. 6.

| Grade | Poise damage range | Sources | Stagger effect |
|---|---|---|---|
| **1 — Light** | 1–19 | Daggers, fists, most R1s, light projectiles, small enemy swipes | Never staggers a Grade ≥1 true-poise target mid-attack |
| **2 — Medium** | 20–39 | Straight sword R1s, spears, most enemy melee, medium projectiles | Staggers unarmored; absorbed by Grade 2+ true poise |
| **3 — Heavy** | 40–59 | Greatsword R1/R2, Weapon Arts, most boss light attacks, running attacks | Absorbed only by Grade 3 true poise (90+) |
| **4 — Crushing** | 60–89 | Greataxe/great hammer, boss heavies, most Weapon Arts, guard-break | **Always staggers the player.** Bosses resist. |
| **5 — Sovereign** | 90+ | Boss signature moves, *Iron Verdict*, *Anchor Drop*, phase transitions | **Always staggers everything, including bosses** (bosses get one 4-second stagger per phase) |

**Boss poise budgets** (Vol. 6): each boss has a **Poise pool** that depletes only from Grade 5 sources and from **POSTURE BREAK** accumulation. When depleted → one 4 s stagger → free critical. This replaces the invisible "boss stagger meter" of prior games with a *visible, legible* system.

---

## 3.6 — POWER STANCE (DS2 lineage)

### 3.6.1 The Rule

**Power Stance** activates when the character is **two-handing a right-hand weapon while a compatible weapon occupies the left hand**, and the character meets **1.5× the higher of the two weapons' requirements**.

```
PS_REQ_STR = ceil( 1.5 × max(STR_req_R, STR_req_L) )
PS_REQ_DEX = ceil( 1.5 × max(DEX_req_R, DEX_req_L) )
Two-handing still grants ×1.5 effective STR for the check.
Example: Longsword (STR 12 / DEX 12) + Estoc (STR 11 / DEX 18)
   PS_REQ_STR = ceil(1.5 × 12) = 18
   PS_REQ_DEX = ceil(1.5 × 18) = 27
   A character with STR 27 one-handed-equivalent (i.e. STR 18 two-handed) and DEX 27 qualifies.
```

**Activation input:** press and hold `L1/LB` while two-handing (i.e., `△/Y` then `□/X`). The character shifts into a distinct **stance pose** and the moveset is replaced. Releasing returns to normal two-handing.

### 3.6.2 Compatibility Matrix

Power Stance requires **class-family compatibility**. This is the DS2 rule made explicit and *visible in the UI* (Vol. 9 §9.5) so that players never have to guess.

| Right-hand class ↓ / Left-hand class → | Sword | Greatsword | Curved | Thrust | Axe | Hammer | Spear | Halberd | Fist | Whip | Reaper |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Sword** | ✔ Cross-Draw | ✖ | ✔ Needle Waltz | ✔ Twin Point | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ |
| **Greatsword** | ✖ | ✔ Twin Cleave | ✖ | ✖ | ✔ Heavy Pair | ✔ | ✖ | ✔ | ✖ | ✖ | ✖ |
| **Curved Sword** | ✔ | ✖ | ✔ Twin Spin | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ |
| **Thrusting Sword** | ✔ | ✖ | ✖ | ✔ Double Needle | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Axe** | ✖ | ✔ | ✖ | ✖ | ✔ Twin Axe | ✖ | ✖ | ✔ | ✖ | ✖ | ✖ |
| **Hammer** | ✖ | ✔ | ✖ | ✖ | ✖ | ✔ Twin Crush | ✖ | ✖ | ✔ | ✖ | ✖ |
| **Spear** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ Twin Spear | ✔ Halberd-Spear | ✖ | ✖ | ✖ |
| **Halberd** | ✖ | ✔ | ✖ | ✖ | ✔ | ✖ | ✔ | ✔ Twin Reap | ✖ | ✖ | ✔ |
| **Fist / Claw** | ✔ | ✖ | ✔ | ✖ | ✖ | ✔ | ✖ | ✖ | ✔ Twin Flurry | ✖ | ✖ |
| **Whip** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ Twin Lash | ✖ |
| **Reaper** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ | ✔ Twin Harvest |
| **Catalyst / Chime / Talisman** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Shield (any)** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Bow / Crossbow** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |
| **Ultra Greatsword / Great Hammer / Greatshield** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ |

**Exclusions and why:**

- **Catalysts and shields never Power Stance.** They are the *reason* you have a left hand; combining them with a second weapon would delete the entire defensive and magical identity of the left slot.
- **Ultra-tier weapons never Power Stance.** A character holding two Ultra Greatswords is a different game. Their identity is single, enormous, committed swings, and Power Stance's rapid dual-input grammar contradicts that. (Players will ask for this. The answer is no, and the answer is documented here so it stays no.)
- **Bows never Power Stance** — but **two bows can be equipped and fired alternately** without a stance; this is a *speed-load* trick, not a moveset.
- **Cross-class pairs that DO work** (Sword+Curved, Sword+Thrust, Sword+Fist, Axe+Halberd, Spear+Halberd, Hammer+Fist, Halberd+Reaper) are the game's "hybrid" identities and each has a bespoke moveset — 11 named stances in total.

### 3.6.3 Named Power Stances (full movesets)

| Stance | Pairing | L1 (light chain) | L2 (heavy finisher) | Signature property |
|---|---|---|---|---|
| **Cross-Draw** | Sword + Thrust | X-slash, 2 hits @14f/22f, ×0.72 each, poise 28/3 | Double thrust, ×1.55, **poise 74 / Grade 4** | Highest posture damage per second in game |
| **Needle Waltz** | Sword + Curved | 5-hit alternating flurry, ×0.38 each, poise 9/1 | Spinning double-slash, ×1.20, poise 44/3 | Best status application (bleed/dark) |
| **Twin Point** | Sword + Thrust | Two simultaneous thrusts, ×0.90 each, poise 32/3 | Lunging double-pierce, ×1.70, poise 68/4 | **Longest reach of any sword stance**; pierces shields |
| **Twin Cleave** | Greatsword + Greatsword | Alternating vertical cleaves, ×1.05 each, poise 52/4 | Simultaneous overhead, ×2.10, **poise 88/4** | Slowest stance; highest per-hit poise |
| **Heavy Pair** | Greatsword + Axe | Cleave → chop, ×0.95 / ×0.85, poise 46/3 | Spinning double-arc, ×1.65, poise 70/4 | Best vs. armored (mixed slash/strike) |
| **Twin Axe** | Axe + Axe | Two rapid chops, ×0.80 each, poise 34/3 | Overhead slam, ×1.60, poise 62/4 | Cheapest stamina of any heavy stance |
| **Twin Crush** | Hammer + Hammer | Two bell-rings, ×0.85, poise 38/3, **+Frost 20** | Ground pound, ×1.75, poise 78/4, 2 m shockwave | Only stance that applies Frost natively |
| **Twin Spear** | Spear + Spear | Two rapid jabs, ×0.70 each, poise 22/2 | Advancing double-thrust, ×1.45, poise 54/3 | **Safe-range stance** — full damage at 4.2 m |
| **Halberd-Spear** | Halberd + Spear | Jab → arc, ×0.75 / ×0.90, poise 26/2 & 44/3 | Sweeping double-arc, ×1.50, poise 66/4 | Best crowd-control stance |
| **Twin Reap** | Halberd + Halberd | Two 220° arcs, ×0.95 each, poise 46/3 | Cross-reap, ×1.80, poise 80/4 | **Severance-capable stance** (§3.9) |
| **Twin Flurry** | Fist + Fist | 8-hit chain, ×0.28 each, poise 7/1 | Rising double-uppercut, ×1.10, poise 40/3, **launches** | Highest hit count; best for status/Resonance triggers |
| **Twin Lash** | Whip + Whip | Two crossing lashes, ×0.65 each, poise 18/2 | Coiling double-lash, ×1.30, poise 48/3, **disarms** | Longest reach of any stance (6.8 m) |
| **Twin Harvest** | Reaper + Reaper | Two sweeps, ×0.90, poise 40/3, **+Bleed 30** | Cross-harvest, ×1.70, poise 72/4, **+Bleed 60** | Only stance that builds Bleed on every hit |
| **Twin Spin** | Curved + Curved | Advancing spin, ×0.50 ×3, poise 14/1 | Full 720° spin, ×1.35, poise 50/3 | Movement + damage combined |

### 3.6.4 POSTURE BREAK (the Power Stance payoff)

Power Stance exists in DS2 as a moveset. In *Convergence* it becomes a **system**, by giving it a resource the player can see.

```
POSTURE METER (per enemy, not per player)
  MAX_POSTURE = 100 + (enemy_poise × 1.5)   // humanoids: 100–180 · elites: 220–400 · bosses: see Vol 6
  ACCRUAL:
     only Grade ≥3 poise damage contributes
     contribution = poise_damage × STANCE_MULT
        STANCE_MULT = 1.00 (normal attacks) · 1.60 (Power Stance L1) · 2.40 (Power Stance L2)
     non-Power-Stance sources contribute at 0.40× rate  ← POWER STANCE IS THE KEY, NOT AN OPTION
  DECAY: 14 posture/s after 3.0 s without accrual
  AT ZERO: POSTURE BREAK
     → 2.4 s stagger (bosses: 4.0 s, once per phase)
     → guaranteed critical available: ×3.20 damage
     → HUD: the enemy's posture bar flashes white and their model drops to one knee
```

**Why the 0.40× rate for non-stance attacks?** Because otherwise every build breaks posture equally and Power Stance becomes cosmetic. This coefficient is the entire mechanical justification for the DS2 import, and it is **design-locked** (Vol. 2 §2.11 pattern).

**Balance guardrail:** POSTURE BREAK on a *player* also exists — invaders and co-op phantoms have a posture meter, and it can be broken. But the meter is 2.2× larger for players than for equivalent-level NPCs, so player posture-break is a rare, earned event (roughly once per 40 s of sustained pressure) rather than a stun-lock. **Stun-locking a player is impossible: after any POSTURE BREAK, the target gains 8 seconds of posture immunity.**

---

## 3.7 — TRUE POISE & EQUIPMENT LOAD (DS1 lineage)

### 3.7.1 The Unified Poise Model

(Repeat of Vol. 0 A.2, because this is the section engineers will read.)

```
POISE_TOTAL      = 12 (base) + Σ ARMOR_POISE + Σ RING_POISE − MIXED_SET_PENALTY(4)
POISE_THRESHOLD  = 20 + (POISE_TOTAL × 2)
POISE_MITIGATION = min(0.70, POISE_TOTAL × 0.005)
TRUE_POISE_GRADE = 0 (<30) | 1 (30–59) | 2 (60–89) | 3 (90–99+)
ABSORBS_PER_ACTION = 1   ← THE HYPER ARMOR LOCK. NEVER 2.
```

### 3.7.2 True Poise in Practice

| Poise | Grade | Absorbs during attack animations | Threshold | Mitigation |
|---|---|---|---|---|
| 12 (naked) | 0 | Nothing | 44 | 6% |
| 19 | 0 | Nothing | 58 | 9% |
| 34 | **1** | Grade 1 (light) | 88 | 17% |
| 60 | **2** | Grade 1 + 2 (light, medium) | 140 | 30% |
| 88 | **2** | Grade 1 + 2 | 196 | 44% |
| 90 | **3** | Grade 1 + 2 + 3 (light, medium, heavy) | 200 | 45% |
| 99+ | 3 | Grade 1 + 2 + 3 | 218 | 50% |
| **Cap** | — | **Never Grade 4 or 5** | — | **70%** (requires 140 poise — unreachable; the effective cap is ~50%) |

**Reachability analysis (important).** The highest *permanent* poise in the game is **116**: Remnant Dragon set (96) + base 12 + Ring of Blades +3 (8). That is Grade 3, threshold 252, mitigation 58% — and it requires **VIT 60** to equip at all (78.5 units against a 112.0 cap = 70.1%, fat roll). The highest *temporary* poise is **176** for 6 seconds, by adding the Iron Eclipse set's *Bulwark* Weapon Art (+60) — mitigation clamps at the 70% ceiling there, which is the only place in the game the cap is reachable.

**Grade 4 and Grade 5 attacks always stagger you, at any poise value.** There is no build in this game that is immune to a boss, and the 70% mitigation ceiling exists so that the poise math can never produce one.

### 3.7.3 What True Poise Actually Does (the readable version)

```
WHILE you are in an attack animation, cast animation, or item-use animation:
   an incoming hit with POISE_GRADE ≤ TRUE_POISE_GRADE and
   ACCUMULATED_POISE_DAMAGE < POISE_THRESHOLD
   ⇒ you do NOT get interrupted. You take FULL DAMAGE. Your swing completes.
   ⇒ The Poise Diamond on the HUD (§9.4) flashes once and empties.
   ⇒ The NEXT hit during the same action interrupts you normally. (Hyper Armor Lock)

WHENEVER (including outside animations):
   accumulated poise damage ≥ POISE_THRESHOLD ⇒ stagger (F2 or F3 flinch by grade)
   poise damage accumulation resets 2.0 s after the last hit
```

> **This is the exact DS1 behavior, and the exact thing DS1 never told you.** The Poise Diamond makes the hidden visible: it is a small diamond above the stamina bar that fills as poise damage accumulates and *flashes white when an absorb fires*. Players will understand true poise within one region without a single line of tutorial text.

### 3.7.4 Equipment Load Tier Detail

| Tier | Range | Roll | i-frames | Total | Stamina | Walk speed | Run speed | Sprint | Fall dmg |
|---|---|---|---|---|---|---|---|---|---|
| **Fast** | <30% | Quick | 16f | 34f | 26 | ×1.00 | ×1.00 | ✔ | ×0.95 |
| **Mid** | 30–<70% | Standard | 13f | 38f | 30 | ×0.96 | ×0.96 | ✔ | ×1.00 |
| **Fat** | 70–<100% | Heavy | 9f | 48f | 40 | ×0.90 | ×0.88 | ✔ (drains 1.4×) | ×1.12 |
| **Overburdened** | ≥100% | **Stagger-step** | 0f | 22f | 30 | ×0.72 | ×0.68 | ✖ | ×1.35 |

**Overburdened is not forbidden.** It is a legitimate (if miserable) state, and there is exactly one item in the game — the **Havel's Ring (Ashen)** — that lets a player dip to 101% deliberately. The stagger-step has **zero i-frames** and cannot be canceled. We keep it because "I can't roll" is the most legible punishment in the genre, and because a player who chooses it has made an informed decision.

### 3.7.5 Armor Weight & Poise Reference (selected)

| Set | Head | Body | Hands | Legs | Total wt | Total poise | Absorb (phys/mag/fire/ltn/dark) | Set bonus (4 pc) |
|---|---|---|---|---|---|---|---|---|
| Tattered Ash | 0.9 | 3.1 | 1.0 | 2.2 | 7.2 | 6 | 4/2/2/2/3 | −5% Hollowing accrual |
| Hexwife Rags | 1.4 | 3.6 | 1.1 | 2.5 | 8.6 | 7 | 3/6/3/3/8 | +6% Hex damage |
| Acolyte Robes | 1.2 | 3.4 | 1.0 | 2.4 | 8.0 | 5 | 3/7/3/4/5 | +1 spell use per rest |
| Ashen Knight | 3.4 | 8.2 | 2.4 | 3.0 | **17.0** | 22 | 14/6/8/9/7 | +8% physical absorption while guarding |
| Warden's Leathers | 2.6 | 6.4 | 2.0 | 3.2 | 14.2 | 14 | 10/5/6/6/9 | +12% backstab damage |
| Warden's Greaves *(legs only)* | — | — | — | **4.5** | 4.5 | **13** | 6/3/4/4/5 | — (the poise-per-weight outlier; Build C mixes it in, §2.9.4) |
| Drowned Mail | 4.2 | 11.0 | 3.4 | 4.4 | 23.0 | 26 | 17/8/6/12/8 | Immune to water slow (Sunken Cathedral) |
| Drake Scale | 5.6 | 15.4 | 4.2 | 6.0 | 31.2 | 34 | 20/14/22/14/12 | +25% fire absorb; **cannot be infused** |
| Sentinel Plate | 6.8 | 19.5 | 9.4 | 15.2 | 50.9 | 46 | 26/10/12/22/10 | +15 poise (set bonus) |
| **Iron Eclipse** | **8.5** | **30.0** | **13.0** | **15.0** | **66.5** | **80** | **32/12/14/18/12** | **Bulwark Art costs 0 FP** |
| Remnant Dragon | 11.0 | 34.0 | 15.5 | 18.0 | **78.5** | 96 | 36/20/34/26/20 | **+1 true poise grade** (Grade 3 at only 96 poise) — requires **VIT 60** to fat-roll in, and 36/20/34 fire/lightning absorb is the best in game |
| Vessel of Want *(ending reward)* | 3.0 | 7.0 | 2.2 | 3.4 | 15.6 | 18 | 8/18/8/8/24 | Want regen ×2; face permanently hidden |

> **The Remnant Dragon set is the game's honesty test.** It grants Grade 3 true poise at a poise value that would normally only give Grade 2 — genuinely the best defensive set in the game — and it weighs 78.5. At **VIT 60** it is 70.1%: a fat roll by 0.1 of a percentage point. At **VIT 99** it is 61.5%: a mid roll, and the only way to get one. **Nobody reaches VIT 99 in a SL125 build.** It exists for NG+7 players, for the screenshot, and for the 0.1% who will do the arithmetic and discover that the fat roll was avoidable all along. This is a legitimate design function: **the game must contain unreachable things, and it must be honest about exactly how unreachable they are.**

---

## 3.8 — Attack Frame Data Reference (per weapon class, R1 chain)

Notation: `startup / active / recovery` in frames; MV = motion value (damage multiplier).

| Class | R1 #1 | R1 #2 | R1 #3 | R2 | Running R1 | Rolling R1 | Backstep R1 |
|---|---|---|---|---|---|---|---|
| Dagger | 8/3/12 · MV 0.85 | 9/3/13 · 0.90 | — | 14/4/20 · 1.25 | 10/4/16 · 1.10 | 12/4/16 · 1.30 | 9/3/14 · 1.05 |
| Straight Sword | 12/4/16 · 1.00 | 13/4/17 · 1.05 | 16/5/20 · 1.20 | 22/6/26 · 1.45 | 16/5/20 · 1.30 | 18/5/22 · 1.50 | 14/4/18 · 1.25 |
| Greatsword | 18/6/24 · 1.30 | 20/6/26 · 1.40 | 24/8/30 · 1.65 | 32/8/38 · 1.95 | 24/8/28 · 1.70 | 26/8/30 · 1.90 | 20/6/26 · 1.55 |
| Ultra Greatsword | 26/10/34 · 1.75 | 30/10/38 · 1.85 | — | 44/12/50 · 2.40 | 34/12/40 · 2.10 | 36/12/42 · 2.30 | 28/10/36 · 1.95 |
| Curved Sword | 10/4/14 · 0.92 | 11/4/15 · 0.96 | 12/6/16 · 1.05 | 20/8/24 · 1.35 | 14/6/18 · 1.20 | 16/6/20 · 1.35 | 12/4/16 · 1.10 |
| Katana | 13/4/17 · 1.05 | 14/4/18 · 1.10 | 18/5/22 · 1.30 | 26/6/30 · 1.60 | 18/5/22 · 1.40 | 20/5/24 · 1.55 | 15/4/19 · 1.25 |
| Thrusting Sword | 9/3/13 · 0.88 | 10/3/14 · 0.92 | 11/3/15 · 0.98 | 18/4/22 · 1.30 | 12/4/16 · 1.15 | 14/4/18 · 1.28 | 10/3/14 · 1.05 |
| Spear | 14/4/18 · 1.02 | 15/4/19 · 1.06 | 18/5/22 · 1.22 | 26/6/30 · 1.50 | 18/5/22 · 1.32 | 20/5/24 · 1.45 | 15/4/19 · 1.20 |
| Halberd | 18/6/24 · 1.28 | 20/6/26 · 1.34 | 24/8/28 · 1.55 | 32/8/38 · 1.85 | 24/8/28 · 1.65 | 26/8/30 · 1.80 | 20/6/26 · 1.50 |
| Axe | 16/5/22 · 1.20 | 18/5/24 · 1.26 | 22/6/28 · 1.48 | 30/8/36 · 1.80 | 22/6/26 · 1.55 | 24/6/28 · 1.70 | 18/5/24 · 1.40 |
| Hammer | 17/5/23 · 1.22 | 19/5/25 · 1.28 | 23/7/29 · 1.50 | 31/9/37 · 1.82 | 23/7/27 · 1.58 | 25/7/29 · 1.72 | 19/5/25 · 1.42 |
| Reaper | 20/6/26 · 1.32 | 22/6/28 · 1.38 | 26/8/32 · 1.60 | 34/8/40 · 1.90 | 26/8/30 · 1.70 | 28/8/32 · 1.85 | 22/6/28 · 1.55 |
| Whip | 16/8/20 · 0.95 | 18/8/22 · 1.00 | — | 26/10/30 · 1.35 | 20/8/24 · 1.20 | 22/8/26 · 1.30 | 17/8/21 · 1.10 |
| Fist/Claw | 7/3/11 · 0.68 | 8/3/12 · 0.72 | 9/3/13 · 0.78 | 16/4/20 · 1.10 | 10/3/14 · 0.95 | 12/4/15 · 1.05 | 8/3/12 · 0.85 |
| Twinblade | 12/6/16 · 0.55×2 | 13/6/17 · 0.58×2 | 16/8/20 · 0.70×2 | 24/10/28 · 0.95×2 | 16/8/20 · 0.80×2 | 18/8/22 · 0.88×2 | 13/6/17 · 0.72×2 |

**Cancel rules (universal):**
- Any R1 can cancel into the next R1 during its **recovery** window (listed per class in the `C@` notation, Vol. 0 A.6).
- Any attack can cancel into a **roll** from frame `recovery_start + 6`.
- Any attack can cancel into **guard** from frame `recovery_start + 2` (if a shield/guard-capable weapon is in the left hand).
- **No attack can cancel into another attack after the 3rd chain link.** This is the anti-infinite rule and it is design-locked.

---

## 3.9 — SEVERANCE: Tail-Cuts & Part Destruction (DS1 lineage, mechanized)

### 3.9.1 The System

Certain enemies and bosses have **Severable Parts**. Each part is an independent entity with its own HP pool, its own hitbox, its own damage multiplier, and its own consequence.

```
PART = {
   id, bone_attachment, hitbox,
   hp:                PART_HP = BOSS_MAX_HP × part_fraction
   damage_mult:       incoming damage to this part × mult  (tails typically 1.2×, armor plates 0.6×)
   required_type:     SLASH | STRIKE | PIERCE | ANY | FIRE | SPECIFIC_WEAPON_CLASS
   required_grade:    minimum poise grade of the finishing hit (usually 3+)
   on_sever:          { moveset_change, animation_change, arena_change, reward, vfx, sfx }
   regrows:           bool  (only in NG+ for certain parts)
}
```

### 3.9.2 Damage Type Requirements

| Required type | Weapons that qualify | Design purpose |
|---|---|---|
| **SLASH** | Swords, curved swords, katanas, reapers, halberds, whips, axes | The default; most players have one |
| **STRIKE** | Hammers, great hammers, maces, clubs, fists | Forces heavy builds to participate; rewards carrying a second weapon |
| **PIERCE** | Thrusting swords, spears, pikes, arrows, bolts | Rewards reach and precision; the *only* way to hit some parts (small, fast-moving tails) |
| **FIRE** | Fire/Chaos-infused weapons, pyromancies, torches | Regional gating — several fire-parts are only breakable in regions where fire is available |
| **ANY** | Everything | Used for cosmetic parts (helmets, capes) |

> **Why require a damage type at all?** Because in DS1, tail-cutting was a *sword* activity and hammer/cleric builds simply did not participate in one of the game's most rewarding systems. Requiring STRIKE on 9 of the game's 31 parts means **every build has a severance job.** This is the single most inclusive change we make to the DS1 import.

### 3.9.3 The 31 Severable Parts (full roster)

| # | Owner | Part | HP fraction | Type req | Grade req | Consequence | Reward |
|---|---|---|---|---|---|---|---|
| 1 | Ashen Baron (R01) | Tail | 8% | SLASH | 2 | Loses sweep attack; −15% move speed | **Baron's Tail Axe** |
| 2 | The Nameless Grave (R03) | Right arm | 12% | STRIKE | 3 | Cannot grab; drops its shield | **Gravewarden's Fist** |
| 3 | The Nameless Grave | Helm | 5% | ANY | 2 | Cosmetic; reveals the face (lore) | *Nameless Face* (head) |
| 4 | **Vharos, the Drowned Warden** (R04) | **Harpoon arm** | 14% | SLASH | 3 | **Phase 2 moveset loses all ranged attacks** | **Warden's Anchor** (great hammer) |
| 5 | Vharos | Crown | 6% | STRIKE | 4 | Triggers **early Phase 3** (skips 20% of Phase 2 HP) | **Crown of the Deep** (head) |
| 6 | Vharos | Tail-fin | 9% | PIERCE | 3 | −25% swim speed in flooded phase | **Warden's Fin** (dagger) |
| 7 | **Karrag, the Ember Sovereign** (R05) | **Furnace tail** | 16% | STRIKE | 4 | **Drains the arena lava → Phase 2 on dry ground** | **Ember Sovereign's Hammer** |
| 8 | Karrag | Left pauldron | 8% | STRIKE | 3 | −30% damage on its charge attack | **Sovereign Pauldron** |
| 9 | Karrag | Molten core | 10% | FIRE | 5 | Forces **Phase 3 immediately**; core exposed → +40% damage taken | **Heart of Want** *(story item)* |
| 10 | The Winter Queen (R06) | Ice crown | 7% | STRIKE | 4 | Ends the arena blizzard | **Queen's Frost Crown** |
| 11 | The Winter Queen | Frozen wings | 11% | SLASH | 3 | Cannot fly; grounded permanently | **Veil of Winter** (greatsword) |
| 12 | **Remnant of the Old Dragons** (R07) | **Tail** | 18% | SLASH | 4 | Loses tail-sweep (its highest-damage move) | **Dragon Remnant Tail** (reaper) |
| 13 | Remnant | Right wing | 12% | PIERCE | 4 | Cannot take flight in Phase 3 | **Remnant Wing Shield** |
| 14 | Remnant | Left wing | 12% | PIERCE | 4 | Cannot take flight in Phase 3 | **Remnant Wing Shield** |
| 15 | Remnant | **Crown-horn** | 6% | STRIKE | **5** | Reveals the true head; unlocks **hidden ending condition 3** | **Ouroboros Spine** *(hidden ending)* |
| 16 | Rotmother (R08) | Bloom | 9% | FIRE | 3 | Stops spore cloud | **Rotmother's Bloom** (catalyst) |
| 17 | Sentinel Commander (R09) | Banner | 5% | SLASH | 2 | Rally buff removed from adds | **Sentinel's Standard** (spear) |
| 18 | The Forge Warden (R10) | Anvil arm | 13% | STRIKE | 4 | Cannot forge adds | **Forge Warden's Hammer** |
| 19 | King of Grey Kings (R11) | Sceptre | 8% | SLASH | 3 | Disables curse beam | **Grey King's Sceptre** (chime) |
| 20 | The Beached Leviathan (R12) | Harpoon | 10% | STRIKE | 3 | Cannot impale the ground | **Leviathan Harpoon** (pike) |
| 21 | Abyss Watcher Echo (R13) | Cloak | 6% | SLASH | 2 | Reveals the face (it is yours) | *Watcher's Cloak* |
| 22 | **Nihilanthos** (R14) | **Right essence-arm (Souls)** | 10% | PIERCE | 4 | Phase 2 loses the Souls-form | *see Vol. 6* |
| 23 | Nihilanthos | **Left essence-arm (Want)** | 10% | SLASH | 4 | Phase 2 loses the Want-form | *see Vol. 6* |
| 24 | Nihilanthos | **Core seam (Ash)** | 8% | **Ashen Brand only** | **5** | **Unlocks the hidden ending** | **Severance** *(hidden ending)* |
| **25** | Ash Lurker Matriarch (R01, elite) | Tail | 6% | SLASH | 2 | Loses its burrow-ambush | *Lurker's Barb* (dagger) |
| **26** | Terrace Revenant (R03, elite) | Right arm | 8% | STRIKE | 3 | Cannot throw headstones | *Revenant's Knuckle* (fist) |
| **27** | Choir Husk Cantor (R04, elite) | Throat-sac | 5% | PIERCE | 2 | Stops the rally shriek | *Cantor's Reed* (whip) |
| **28** | Bellows Ogre (R05, elite) | Furnace belly | 9% | FIRE | 3 | Cannot self-immolate | *Ogre's Slag Axe* |
| **29** | Ice-Revenant Bride (R06, elite) | Veil | 4% | ANY | 2 | Cosmetic; −20% frost buildup | *Bride's Veil* (head) |
| **30** | Rot-Knight (R08, elite) | Bloom-shoulder | 7% | FIRE | 3 | Stops spore trail | *Rot-Knight's Spore* (hammer) |
| **31** | Forge Automaton (R10, elite) | Drive-wheel | 10% | STRIKE | 3 | Movement −50% | *Automaton's Cog* (shield) |

**Rule: 3 parts on the final boss, 1 of which is only breakable with a specific story item.** This is the hidden ending's mechanical lock (Vol. 1 §1.7.4) and it is the reason severance is not merely a loot system — it is a *narrative* system.

### 3.9.4 Severance Feedback (legibility)

| Stage | Visual | Audio | HUD |
|---|---|---|---|
| Part at 66% HP | Faint crack/spark texture on the part | Subtle material stress tick | Sever Tracker pip ⅓ filled (§9.4) |
| Part at 33% HP | Visible wound, leaking (blood/ember/ichor) | Louder stress; a distinct "give" sound | Pip ⅔ |
| **Severed** | Part detaches with a physics-driven fall; the boss **recoils in a unique animation** | A single heavy *crack* + a 400 ms mix duck (all other audio drops) | **Pip fills, flashes, and the part name appears in the top-right ribbon for 3 s** |
| Moveset change | The boss's idle pose permanently changes (a limp, a dropped arm, a hunch) | Its roar pitch drops a minor third | Boss health bar gains a small **severance notch** |

> **The 400 ms audio duck is the most important piece of feedback in the entire combat system.** In DS1, players cut tails and often did not notice. Here, the game *stops* for a third of a second and tells you that you changed the fight.

### 3.9.5 Severance Rewards Path

Severing a part does **not** drop the weapon. It drops a **Severance Token** (a physical object in the arena that must be picked up — it despawns on death, which creates a genuine risk/reward decision mid-fight). Tokens are transposed at **Vhenn** into the unique weapon (Vol. 7 §7.6).

*Rationale:* DS1's tail-cut dropped the weapon immediately, which meant players often died *after* the cut and lost it, or grabbed it mid-fight and got punished. Making it a physical pickup object gives the player agency over when to collect.

---

## 3.10 — Status Effects in Combat

| Status | Buildup source | Threshold (reference NG enemy) | Proc effect | Duration | Player-facing counter |
|---|---|---|---|---|---|
| **Bleed** | Blood/Hollow infusion, reapers, katanas, Twin Harvest stance | 180 | **30% max HP burst** + 4% HP/s DoT | 4 s DoT | Bleeding Serum; roll does NOT reset it |
| **Poison** | Poison infusion, rot enemies, Verdant Rot region | 220 | 2% max HP/s; **blocks all HP regen (incl. Blessed)** | 45 s | Purple Moss Clump |
| **Toxic** | Toxic infusion, deep enemies, The Want Beneath | 260 | 5% max HP/s; **halves all healing received** | 30 s | Blooming Purple Moss |
| **Frost** | Frost weapons, Twin Crush stance, Winter's Veil | 200 | −18% stamina regen, **+12% damage taken**; any physical hit **shatters** for +180 flat damage | 12 s | Warmth pyromancy, fire damage |
| **Hollow-Blight** *(new)* | Hexes, Toll Art, Ashen Parry, dark infusion | 240 | **−60% FP and Want regen for 20 s**; on players, also −25% Weapon Art damage | 20 s | Sacred Oath, Blessed infusion, *Pilgrim's Salt* |
| **Burn** | Fire/Chaos, Molten Core Art, torches, Ember Keep lava | 150 | 3% max HP/s; **spreads to adjacent enemies within 1.5 m** | 6 s | Roll (extinguishes), water terrain |
| **Curse** *(rare)* | Only 3 sources in game | n/a | **Instant death at ≤30% HP; otherwise −50% max HP for 60 s** | 60 s | Divine Blessing; **cannot be cured by items mid-fight** |

**Design rule on Curse:** it appears exactly three times in the whole game (Grave of Kings, one optional boss, one NPC invasion). It is never a random enemy property. In DS2, curse-spreading enemies made entire regions feel unfair; here Curse is a *set piece*, not a hazard.

---

## 3.11 — Enemy Combat Archetypes

Every enemy in the game is built from one of seven archetypes. This is the combat-design grammar that keeps 300+ enemy variants readable.

| Archetype | Behavior | Player answer | Example |
|---|---|---|---|
| **Swarm** | 4–8 units, Grade 1 attacks, no coordination | AoE, Spin Sweep, frost | Hollow Dead |
| **Duelist** | 1 unit, Grade 2–3, spaced attacks, punishes greed | Parry, posture break | Sanctuary Knight |
| **Brute** | 1 unit, Grade 4, slow, huge commitment | Roll into, true poise trade | Ember Ogre |
| **Sniper** | Ranged, repositions, Grade 2 projectiles | Cover, closing, *Toll* silence | Grave Archer |
| **Caster** | Ranged, buffs allies, interruptible | Priority target, Grade 3 interrupt | Rotmother Acolyte |
| **Support** | Heals/buffs others, flees, low HP | Kill first | Winter Acolyte |
| **Ambush** | Hidden until proximity, first strike Grade 3 | Walk (silent), listening | Ash Lurker |

**Rule:** no encounter may contain more than **one Brute + one Caster + one Support** simultaneously, plus any number of Swarm. This caps cognitive load and is the reason *Convergence* fights feel hard but never *noisy*.

---

## 3.12 — Boss Combat Grammar

Bosses follow a strict structural template (elaborated per-boss in Vol. 6):

```
PHASE STRUCTURE
  Phase 1: 100% → 60% HP.  Base moveset. 8–14 moves. Grade ≤4.
  TRANSITION: a 3–6 s animation, invulnerable, changes the arena or the body.
  Phase 2: 60% → 25% HP.  Base moveset + 4–8 new moves. Grade ≤5 appears.
  TRANSITION (optional): only on 3-phase bosses.
  Phase 3: 25% → 0%.       Full moveset, +15% attack speed, +25% damage, arena fully transformed.

INVULNERABILITY RULES
  A boss is invulnerable ONLY during: transition animations, phase-change roars, and arena transformations.
  NEVER during a normal attack recovery. This is a hard rule — the DS2 habit of bosses vanishing mid-fight is banned.

STAGGER RULES
  Bosses have a POSTURE meter (Vol 3 §3.6.4). Breaking it grants ONE 4.0 s stagger per phase.
  Grade 5 attacks stagger the player always. Grade 5 player attacks (Iron Verdict, Anchor Drop) stagger the boss ONLY if its posture is broken.
  ⇒ The tank build's Grade 5 Weapon Art is not a boss-stunlock. It is a posture accelerator.

FAIRNESS RULES (design-locked, enforced in review)
  1. Every boss attack has ≥12f of visual telegraph before the hitbox.
  2. No boss attack may have a hitbox that persists >20f without a visible model.
  3. No boss may have more than 2 unblockable attacks per phase.
  4. No boss may chase the player more than 3 consecutive times without an attack.
  5. No boss attack may cover >70% of the arena floor in a single unblockable AoE without a 40f+ telegraph.
  6. Every boss has at least one part that is severable (13 of 22 do; the other 9 have a documented reason).
  7. Every boss must be killable by Build C (zero magic) — QA gate.
```

---

## 3.13 — Lock-On, Camera & Aim

| Feature | Spec |
|---|---|
| Lock-on range | 22 m (melee), 60 m (bows), unlimited (magic target selection) |
| Lock-on retarget | Analog flick = nearest enemy in flick direction within 40° |
| Max simultaneous lock candidates | 12 |
| Camera FOV | 55° default; 45–70° slider |
| Camera collision | Soft-collides with geometry; **never** clips into the player model |
| Auto-aim assist (arrows) | **Off by default.** Optional 4° magnetism within 8 m. No hitbox expansion. |
| Lock-on and Power Stance | Lock-on **restricts** Power Stance L2 to a 60° frontal cone (unlocked: 360°). This is the stance's real advantage and it is not documented anywhere — it is discovered. |
| Motion blur | Off by default; optional |
| Frame rate target | 60 fps (120 fps optional on PC/PS5 Pro with reduced effects) |
| Input latency budget | ≤48 ms from button to first animation frame |

---

## 3.14 — The Combat Fusion Test Matrix (QA)

Every combat feature must pass all seven gates before it ships. This is the operationalization of Pillar P2.

| Gate | Test | Pass condition |
|---|---|---|
| **G1 — Legibility** | A player who has never seen the feature watches a 30 s clip | ≥80% correctly describe what happened and what it cost |
| **G2 — Cost** | Instrumented log | Every action has a non-zero stamina, FP, or recovery cost |
| **G3 — Counterplay** | Build A vs. Build C, 100 duels | Neither wins >62% |
| **G4 — No immunity** | Any build vs. any boss | No build takes zero stagger in a full fight |
| **G5 — Magic parity** | Build B clears all 14 mandatory bosses | ✔ and within the 18% spread |
| **G6 — Severance participation** | All 40 archetypes | Each can sever ≥20 of the 31 parts |
| **G7 — Poise honesty** | Poise Diamond HUD observed | ≥90% of players can predict when their absorb will fire after 2 regions |

---

*End of Volume 3. Continue to Volume 4: Magic & Spell Schools.*
