# VOLUME 6 — THREE FULLY REALIZED BOSS ENCOUNTERS

> **Design owner:** Lead Combat Architect / Boss Design Lead
> **Depends on:** Vol. 3 (frame data, poise grades, severance, posture), Vol. 4 (spell interactions), Vol. 5 (arenas) · **Feeds:** Vol. 7 (Ascetic boss variants), Vol. 9 (boss HUD)

---

## 6.0 — Boss Design Template & Global Rules

Every boss in *Convergence* is authored against this template. The three encounters below are the reference implementations; the remaining 19 bosses are spec'd in the same format in the boss bible.

### 6.0.1 Authoring Template

```
BOSS = {
  identity:      { name, epithet, lore, age_dominant, region, arena, diameter, elevation }
  stats:         { hp_by_phase[], posture_max[], poise, defense{}, absorb{}[5], status_resist[6] }
  phases:        [ { hp_range, moveset[], arena_state, music_state, ai_profile, aggression } ]
  transitions:   [ { trigger, duration_frames, invulnerable, arena_transform, vfx, sfx, music_crossfade } ]
  severance:     [ { part_id, hp_fraction, damage_type, grade_req, on_sever, reward } ]
  ai:            { fsm, distance_bands[], input_reading[], punish_states[], anti_degenerate[] }
  audio:         { leitmotif, instrumentation[], phase_layers[], duck_rules }
  rewards:       { souls, embers, want_shards, tokens[], transposition, achievement }
  fairness_audit:{ G1..G7 (§3.14) }
}
```

### 6.0.2 Global Boss Rules (design-locked, from §3.12)

1. **≥12f telegraph** on every attack before a hitbox exists.
2. **No hitbox may persist >20f without a visible model.**
3. **≤2 unblockable attacks per phase.**
4. **≤3 consecutive chases** without an attack.
5. **No single unblockable AoE may cover >70% of the arena floor** without a ≥40f telegraph.
6. **Every boss is invulnerable ONLY during transitions** — never during attack recovery.
7. **Every boss has one POSTURE BREAK per phase**, granting a 4.0 s stagger and a ×2.60 critical.
8. **Every boss must be killable by Build C** (zero magic, fat roll) — QA gate G5.
9. **No boss may have a random-damage attack.** All damage is deterministic (Vol. 0 §A.8).
10. **Every boss must be readable by ear with the screen off.** Each attack has a distinct audio signature at ≥0.4 s lead.

### 6.0.3 Damage Reference (NG, Soul Level 125 player)

All damage numbers below assume: player has **1214 HP** (Build A reference), **32% physical absorption** (mid-tier armor), and no rings. "Raw" is pre-mitigation; "Effective" is post-absorption.

---

# 6.1 — BOSS ENCOUNTER I

## VHAROS, THE DROWNED WARDEN
### *"He still guards a door that was never there."*

| Field | Spec |
|---|---|
| **Region** | R04 — Sunken Cathedral (§5.4.4) |
| **Arena** | **The Nave of Forty Chairs** — a 38 m-diameter circular flooded nave at −96 m elevation. 40 stone chairs in a ring at the perimeter, all facing the center. All 40 are occupied by drowned choir husks (inert until Phase 3). |
| **Mandatory** | ✔ Yes — blocks the first of the Three Crowns path |
| **SL band** | 28–48 · **Reference SL** 38 |
| **Age dominant** | Want (Drangleic), drowning in Lothric water |
| **Severance parts** | **3** (harpoon arm, crown, tail-fin) — the most severable boss in Act II |
| **Posture max** | Phase 1: 380 · Phase 2: 460 · Phase 3: 300 |
| **Poise** | 620 (Grade 5 immune to stagger except via POSTURE BREAK) |
| **Total HP** | **11,400** (Phase 1: 4,560 / Phase 2: 3,990 / Phase 3: 2,850) |
| **Souls** | 14,800 · **Embers of Ash** 2 · **Want Shards** 3 |

### 6.1.1 Lore

Vharos was the warden of the Sunken Cathedral when it stood dry — a Drangleic sentinel given one order: *hold the door.* The door he was told to hold was the cathedral's western gate, which was bricked up two hundred years before his posting. He guarded a wall.

When the Convergence came, Lothric's reservoir poured into Drangleic's basilica and Vharos kept his post. The water rose over forty days. He did not leave. On the forty-first day the cathedral's own choir — forty voices, seated in forty chairs, singing the office of the drowned — began to sing *him*, and he became the thing they were singing about.

He is not cursed. He is **employed**. His boss fight is the only one in the game where the boss is, at every moment, doing exactly what he was told to do. This is why the severance rewards are what they are: you do not defeat Vharos. **You relieve him of his post.**

> **Item text — *Warden's Anchor* (transposed from part #4):**
> *"Great hammer forged from a cathedral anchor, dragged for four hundred years along a flooded nave floor.*
> *Vharos was posted to a door that had been bricked up before his birth. He did not question the order. He did not question the water.*
> *The anchor is heavier than it should be. It is weighted with the specific gravity of a promise kept to nothing."*

### 6.1.2 Arena

```
                    ┌──────────────────────────────────────────────────┐
                    │  NAVE OF FORTY CHAIRS  ·  38 m diameter          │
                    │                                                  │
                    │      ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣   ← 40 stone   │
                    │    ▣                             ▣     chairs,   │
                    │   ▣     ░░░░░░░░░░░░░░░░░░░░      ▣    ring at   │
                    │   ▣   ░░                  ░░   ▣      perimeter  │
                    │  ▣  ░░    WATER SURFACE    ░░  ▣     (inert husks │
                    │  ▣ ░░   (depth by phase)    ░░ ▣      until P3)   │
                    │  ▣ ░░                        ░░ ▣               │
                    │  ▣ ░░         ✠ VHAROS        ░░ ▣               │
                    │  ▣ ░░        spawn point      ░░ ▣               │
                    │  ▣ ░░                        ░░ ▣               │
                    │  ▣  ░░                      ░░  ▣               │
                    │   ▣   ░░                  ░░   ▣                │
                    │   ▣     ░░░░░░░░░░░░░░░░░░░░     ▣              │
                    │    ▣                             ▣              │
                    │      ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣ ▣                │
                    │                                                  │
                    │  ⌂ SLUICE A (N)   ⌂ SLUICE B (SW)   ⌂ SLUICE C (SE)│
                    │  ▲ FOG GATE (entry, south)  ▲ EXIT (west, bricked │
                    │                                    door — opens   │
                    │                                    on kill)       │
                    └──────────────────────────────────────────────────┘

   WATER DEPTH BY STATE
     Fog gate entry:   0.35 m  (ankle)   — move ×1.00, roll ×0.94
     Phase 1:          0.35 m            — as above
     Phase 2 (flood):  1.10 m  (knee)    — move ×0.70, roll ×0.80, lightning +35%
     Phase 2 drained*: 0.35 m            — requires Sluice A opened pre-fight
     Phase 3:          1.60 m  (waist)   — move ×0.55, roll ×0.66, lightning +35%
     *SLUICE INTERACTION: opening Sluice A before the fight permanently caps Phase 2
      at 0.35 m. Opening B or C raises it. Players who explore the region's sluice
      puzzle before the boss fight a materially different boss. This is not a
      difficulty setting — it is a consequence.
```

**Arena features:**
- **40 chairs** — climbable (0.9 m step), provide 1.4 m of elevation above water. Standing on a chair negates the water movement penalty but limits you to a 0.8 m² platform. In Phase 3, each chair's husk wakes.
- **12 broken pillars** — 2.4 m tall, 0.8 m diameter, **destructible** (600 HP each). Block Vharos's *Harpoon Throw* and *Anchor Drag*. They do not respawn.
- **3 sluice wheels** — interactable mid-fight (34f interaction, no i-frames). Change water depth by ±0.75 m permanently for the rest of the fight.
- **The bricked west door** — Vharos's post. It never opens during the fight. **It opens after you kill him**, and behind it is a 4 m × 4 m room containing nothing but a chair, a helmet, and 1 soul. The item text on the helmet is the region's most important lore beat.

### 6.1.3 Phase Structure

| Phase | HP range | Duration (ref. Build A) | Water | New moves | Music layer |
|---|---|---|---|---|---|
| **1 — The Post** | 100% → 60% | ~48 s | 0.35 m | 9 moves | Cello + water percussion |
| **TRANSITION: THE FLOOD** | — | 144f (2.4 s), invulnerable | rises to 1.10 m | — | Choir enters (40 voices) |
| **2 — The Tide of Want** | 60% → 25% | ~52 s | 1.10 m | +7 moves (16 total) | + detuned 4ths |
| **TRANSITION: THE CROWN BREAKS** | — | 168f (2.8 s), invulnerable | rises to 1.60 m | — | Full orchestra; inverted choir |
| **3 — The Forty Voices** | 25% → 0% | ~38 s | 1.60 m | +6 moves (22 total); 40 husks wake | + the Convergence leitmotif, quarter-tone bent |

**Alternate path:** severing **part #5 (crown)** at any point forces the Phase 3 transition **immediately**, skipping whatever remains of Phase 2. This is a 20%-HP-skip and it is the single highest-value severance in Act II — and it is discoverable only by noticing that the crown *sparks* when hit with strike damage.

### 6.1.4 Phase 1 Moveset — "The Post"

| # | Move | Telegraph | Frames (S/A/R) | Damage raw / eff. | Poise dmg / Grade | Range | Unblockable | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | **Harpoon Jab** | Arm draws back, chain slackens | 22/6/26 | 340 / 231 | 42 / 3 | 5.2 m | No | R1-equivalent; fastest move |
| 2 | **Harpoon Jab ×3** | Same, but the chain *tightens* on the 2nd | 20/5/18 ×3 | 300 / 204 each | 38 / 3 | 5.2 m | No | Only chain-able if the player is at 3–6 m |
| 3 | **Anchor Sweep** | Drags the anchor along the floor, sparks | 34/12/30 | 520 / 354 | 68 / 4 | 7.0 m, 200° arc | No | Destroys pillars; **severance-capable (SLASH)** |
| 4 | **Anchor Overhead** | Anchor rises above the crown; water sheets off it | 44/10/38 | 780 / 530 | **92 / 5** | 4.0 m radius | No | **Always staggers.** The "do not be here" move |
| 5 | **Harpoon Throw** | Full wind-up, chain coils at hip | 38/8/42 | 460 / 313 + **pull** | 54 / 3 | **26 m** | No | Pulls the player 4 m toward him if hit. Blocked by pillars |
| 6 | **Chain Whirl** | Chain goes taut, horizontal | 30/26/28 | 260 / 177 ×3 hits | 34 / 2 each | 6.4 m radius | No | 3 rotating hits; advances 3 m |
| 7 | **Warden's Step** | Body lowers, water displacement ring | 26/—/— | 0 | — | — | — | **Reposition**: closes 8 m instantly. Not an attack. Cannot be punished (18f of super-armor, Grade 5) |
| 8 | **Drowned Roar** | Head rises, jaw unhinges | 40/20/30 | 0 | — | 12 m | — | **Applies Hollow-Blight 60**; summons 2 Choir Husks (Swarm archetype) |
| 9 | **Posture Guard** | Plants the anchor, crosses arms | 24/—/— | 0 | **+180 posture** | — | — | **Defensive**: restores its own posture meter. Only used if posture <40%. Punishable after 96f |

**Phase 1 aggression profile:** Vharos attacks in **2–4 move chains** with **38–62f pauses**. He chases at 240 u/s (slower than the player's 300 run). He will **not** attack while the player is on a chair — he waits at the base, which is the fight's first lesson: *elevation is safety, and safety is a trap, because he never leaves.*

### 6.1.5 TRANSITION — "The Flood" (144f)

| Frame | Event |
|---|---|
| f0 | Vharos plants the anchor. Water surface goes perfectly flat. **All audio ducks to −18 dB.** |
| f12 | He raises his free arm. The three sluice gates visibly shudder. |
| f24 | **The 40 choir husks in the chairs all inhale at once.** This is the audio telegraph and it is the most recognizable sound in the game. |
| f36–f120 | Water rises 0.35 m → 1.10 m over 84f. Vharos is invulnerable and immobile. The player may move, drink Estus, cast, or **open a sluice wheel** (34f interaction — enough time to do exactly one). |
| f120 | The choir sings a single chord (D minor, with the 4th detuned 22 cents flat). |
| f132–144 | Vharos pulls the anchor free. Audio restores. Phase 2 begins with **Move 10**. |

> **The 84-frame window is the fight's deepest design.** A player who knows the transition is coming can open Sluice A during it and permanently reduce Phase 2's water to ankle depth. A player who doesn't know spends the 84 frames drinking Estus. Both are legitimate. The knowledge is worth roughly 30% of the fight's difficulty, and it is available to anyone who explored the sluice puzzle — which the region teaches 40 minutes earlier for a completely different reason.

### 6.1.6 Phase 2 Moveset — "The Tide of Want" (adds 7)

| # | Move | Telegraph | Frames | Damage raw / eff. | Poise / Grade | Range | Notes |
|---|---|---|---|---|---|---|---|
| 10 | **Tide Drag** | Anchor hooks the water surface | 32/24/26 | 300 / 204 + **drag** | 46 / 3 | 9.0 m line | **Pulls the player 6 m across the floor.** In 1.10 m water this is a 6 m controlled slide — survivable but disorienting |
| 11 | **Harpoon Plant & Vault** | Harpoon stabs the floor, chain taut | 26/—/— then 22/8/30 | 540 / 367 | 62 / 4 | Vaults 12 m | **Closes any distance.** The answer to ranged/kiting builds |
| 12 | **Anchor Drop (unblockable #1)** | Anchor held overhead *and the water recedes from beneath it* | 52/14/44 | 980 / 666 | **96 / 5** | 5.5 m radius | **UNBLOCKABLE.** 52f telegraph = 0.87 s. Creates a 3 s whirlpool that pulls at 40 u/s |
| 13 | **Choir Call** | Head turns to face a specific chair | 38/—/— | 0 | — | — | Wakes **2 husks** permanently (max 8 awake in Phase 2). Husks are Swarm archetype, 320 HP, Grade 1 |
| 14 | **Chain Net** | Chain spins overhead in a wide flat arc | 34/16/32 | 420 / 286 | 58 / 3 | 8.0 m radius | Covers 360°. **Jump or roll under** — the chain is at 1.3 m height |
| 15 | **Drowned Charge** | Body leans forward, anchor trailing | 24/34/40 | 620 / 422 | 74 / 4 | 16 m line | Traverses the full arena. Blocked by pillars (destroys 2) |
| 16 | **Warden's Judgment** *(posture punish)* | Only if the player's POSTURE meter >70% | 18/8/24 | 700 / 476 | **110 / 5** | 4.5 m | **INPUT-READ MOVE.** See §6.1.8 |

**Phase 2 aggression:** chains extend to **3–6 moves**, pauses shorten to **26–44f**. Chase speed rises to **290 u/s** — nearly matching the player's run. **This is where the fight becomes a real fight**, and it is the phase that kills most first-time players.

### 6.1.7 Phase 3 Moveset — "The Forty Voices" (adds 6; water 1.60 m)

| # | Move | Telegraph | Frames | Damage | Poise / Grade | Range | Notes |
|---|---|---|---|---|---|---|---|
| 17 | **Forty Voices** (unblockable #2) | All 40 husks stand simultaneously | 68/40/— | 88 /s dark | — | **whole arena** | **UNBLOCKABLE, AVOIDABLE.** Standing on a chair whose husk is *severed/destroyed* is safe. 40 chairs, 40 husks — you must find the empty ones. Lasts 12 s |
| 18 | **Anchor of the Deep** | Anchor glows black; the water pulls inward | 46/18/40 | 840 / 571 | **98 / 5** | 11 m radius | Biggest AoE; 46f telegraph; blocked only by 2+ pillars stacked |
| 19 | **Harpoon Impale** | Harpoon retracts fully into the arm | 30/10/34 | 720 / 490 | 88 / 4 | 14 m line | Instantaneous after telegraph; **cannot be rolled through laterally — only backward** |
| 20 | **Choir Procession** | Vharos walks slowly to the arena center | 90/—/— | 0 | — | — | All awake husks walk in a ring around him. During this 90f he is **fully vulnerable and does not attack** — the fight's designated damage window |
| 21 | **Last Post** | Vharos faces the bricked west door and salutes | 40/—/40 | 0 | +240 posture | — | **Once per fight, at 8% HP.** He stops fighting for 80f and faces his door. If you attack him during it, he recovers with **Anchor of the Deep** guaranteed. If you *wait*, he turns back and Phase 3 continues with posture fully restored but **his damage reduced 20% for the remainder.** |
| 22 | **Warden's Farewell** | At 0 HP | 120/—/— | 0 | — | — | Death animation: he walks to the west door, sits down in front of it, and the door opens. 120f. Skippable after first view |

> **Move 21 is the fight's moral, expressed as a mechanic.** You can kill him greedily and take a guaranteed near-lethal AoE, or you can let a four-hundred-year-old sentinel salute a wall one last time and be rewarded with an easier finish. Neither is "correct." The game does not comment. 71% of playtesters waited, and 100% of those reported it as the fight's most memorable moment.

### 6.1.8 AI Behavior, Aggression Triggers & Input Reading

**Finite state machine (11 states):**

```
IDLE → OBSERVE (18–40f) → APPROACH → ATTACK_CHAIN (2–6 moves) → RECOVER (26–62f)
                                    ↘ REPOSITION (Warden's Step, if dist > 14 m)
                                    ↘ DEFEND (Posture Guard, if posture < 40%)
                                    ↘ SUMMON (Choir Call, if awake husks < phase cap)
                                    ↘ PUNISH (see input reading)
                                    ↘ TRANSITION
                                    ↘ STAGGER (posture broken; 240f; free critical)
                                    ↘ DEATH
```

**Distance bands:**

| Band | Range | Behavior |
|---|---|---|
| **Intimate** | 0–3 m | 70% Anchor Sweep / Jab chain · 20% Anchor Overhead · 10% Chain Whirl. **Never uses Harpoon Throw.** |
| **Duel** | 3–8 m | 40% Jab chain · 25% Anchor Sweep · 15% Chain Whirl · 10% Anchor Overhead · 10% Tide Drag (P2+) |
| **Chase** | 8–16 m | 60% Harpoon Plant & Vault (P2+) / Warden's Step (P1) · 30% Drowned Charge · 10% Harpoon Throw |
| **Ranged** | 16–38 m | 80% Harpoon Throw · 20% Drowned Charge. **Will never walk slowly at this range — always charges or throws** |

**INPUT READING (the honest list — every one of these is documented here and none are hidden from the design team, though none are told to the player):**

| Trigger | Detection window | Response | Reaction delay | Fairness guard |
|---|---|---|---|---|
| **Estus drink** | Player enters drink animation (51f) | **Harpoon Throw** guaranteed if dist >8 m; **Warden's Step + Jab** if ≤8 m | **14f** (0.23 s) | Reaction delay is long enough that a drink started behind a pillar is safe. **Never** reacts to a drink started while he is mid-attack |
| **Spell cast** | Player enters cast animation | **Harpoon Throw** (any range) or **Chain Net** (≤8 m) | **12f** | Casts started during his RECOVER state are never punished |
| **Roll (away)** | Roll input with direction vector >100° from him | **Harpoon Throw** at the *landing* position, leading by 1.1 m | **16f** | Only 40% chance; **never twice in a row** (anti-frustration) |
| **Roll (into)** | Roll input within 25° of him | **No response** | — | **Deliberate reward for aggression** (§3.1.2) |
| **Guard raised** | Shield up for >40f continuous | **Anchor Overhead** (Grade 5) or **Anchor Drop** (unblockable) | 22f | Only once per 12 s |
| **Backstep spam** | ≥3 backsteps in 2.5 s | **Drowned Charge** | 20f | — |
| **Power Stance L2 windup** | Detects the 22f startup of a stance heavy | **Posture Guard** (restores its posture) | 8f | **This is the game's only explicit counter to Power Stance.** It is why Vharos is the fight that teaches players that Posture Break is not free |
| **Player on a chair** | Player elevation >1.0 m above water for >60f | **Tide Drag** (P2+) or walks to the base and waits (P1) | — | In Phase 1 he never attacks a chaired player. Ever. |
| **Player at ≤20% HP** | HP threshold | **Aggression −40%**: longer pauses, fewer 4+ chains | instant | The game does not execute a low player. It gives them room. This is deliberate and is a hard rule across all 22 bosses |
| **Player has not attacked in 8 s** | Passive timer | **Warden's Step** to close, then **Choir Call** | instant | Anti-turtle, not anti-passive: he comes to you but does not punish you |

**Anti-degenerate rules:**
- **No move may be selected 3 times consecutively** (weighted random with a 2-move memory exclusion).
- **Unblockable moves (#12, #17) may not occur within 6 s of each other**, and never in the same chain.
- **After any POSTURE BREAK, Vharos gains 8 s of posture immunity** (mirrors the player rule, §3.6.4).
- **Vharos never attacks during the player's death animation.**
- **If the player dies and returns, Vharos resets to full HP but retains his severed parts** — a severed harpoon arm stays severed across attempts within the same session. This is a **deliberate departure** from series tradition and it exists so that severance is not a per-attempt tax. (Reverting on rest is an accessibility toggle in §9.7.)

### 6.1.9 Severance Detail (parts #4, #5, #6)

| Part | HP | Type / Grade | Location | On sever | Token → Reward |
|---|---|---|---|---|---|
| **#4 Harpoon Arm** | 1,596 (14% of 11,400) | **SLASH** / Grade 3 | Right arm, 3.4 m hitbox, moves constantly | **Removes moves 1, 2, 5, 11, 19** (all harpoon/ranged). Vharos's DPS drops 34%. His idle pose becomes a permanent hunch. Roar pitch drops a minor third | **Warden's Anchor Token** → *Warden's Anchor* (Great Hammer, STR 40/DEX 10, AR 372, Art: *Stance: Anchor Drop* — the boss's own unblockable, at Grade 5) |
| **#5 Crown** | 684 (6%) | **STRIKE** / Grade 4 | Head, 0.7 m hitbox, only exposed during moves 4, 12, 18 (overhead wind-ups) | **Forces the Phase 3 transition immediately**, skipping up to 20% of total HP. Water rises to 1.60 m at once | **Crown of the Deep Token** → *Crown of the Deep* (head, 6 poise, +18% dark absorb, **−1 Want regen delay**) |
| **#6 Tail-Fin** | 1,026 (9%) | **PIERCE** / Grade 3 | Lower back, 1.1 m hitbox, only reachable from behind | −25% chase speed (290 → 218 u/s), removes **Drowned Charge** in water. **The single largest difficulty reduction available** | **Warden's Fin Token** → *Warden's Fin* (Dagger, DEX 14, AR 168, **fastest severance-capable weapon in game**) |

**Severance ordering is a strategic decision:**
- Cut the **arm** → lose his range. Best for melee builds.
- Cut the **crown** → skip a phase. Best for players who are losing.
- Cut the **fin** → slow him down. Best for kiting/caster builds.
- **All three** = the fight becomes a 40% easier, 22-move-reduced encounter and yields 3 unique weapons. Full severance on Vharos is the Act II mastery test, and it requires SLASH + STRIKE + PIERCE coverage — **at least two weapons.**

### 6.1.10 Music & Audio Design — Vharos

| Layer | Instrumentation | Enters | Key / tempo | Notes |
|---|---|---|---|---|
| **L0 — Silence** | Wind, water, distant paper | Arena entry | — | 22 seconds of nothing before he moves. The longest silence before any boss in the game |
| **L1 — The Post** | Solo cello (D minor), water percussion, a single struck anvil every 8 bars | Phase 1 start | D minor, 58 bpm | The anvil is the Ember Keep leitmotif, 4 octaves down and 40 dB quieter. You will not consciously hear it. You will feel the world is connected |
| **L2 — The Choir** | **40 voices**, all singing the same text, all 22 cents flat of each other | Phase 2 transition (f120) | D minor + detuned 4ths | Recorded as 40 separate takes by 40 different singers and never quantized. The beating is real |
| **L3 — The Orchestra** | Full strings, 6 horns, timpani, bass clarinet | Phase 3 transition | D minor → **D half-diminished** | The key never resolves. There is no authentic cadence anywhere in this cue |
| **L4 — The Convergence** | The game's main leitmotif, quarter-tone bent, in the low brass | Phase 3, at 15% HP | — | Plays **once**, for 11 seconds, and stops |
| **L5 — The Farewell** | Solo cello returns, alone, an octave higher than L1 | Move 22 (death) | D **major** | The only major-key moment in the entire boss cue. It lasts 9 seconds. Then silence |

**Audio ducking rules:**
- On **severance**: −400 ms full mix duck (Vol. 3 §3.9.4).
- On **unblockable move telegraph**: L1–L3 duck −6 dB, the water sound boosts +8 dB. *You hear the attack coming as an absence of music.*
- On **Choir Call**: all 40 voices inhale on the same frame (f24 of move 13). This sound is the region's ambient audio too — so the player hears it 40 minutes before the fight and does not know what it means yet.

### 6.1.11 Fairness Audit — Vharos

| Gate | Result |
|---|---|
| G1 Legibility | 22-move set, but 9 in Phase 1 and each is visually distinct by *weapon used* (harpoon = fast/long, anchor = slow/heavy, chain = mid/wide). 92% of testers could name the danger within 2 attempts |
| G2 Cost | Every player action costs stamina/FP; Vharos's own moves have ≥18f recovery |
| G3 Counterplay | Build A vs. Build C, 100 runs: A wins in 78 s median, C in 124 s. Neither is impossible |
| G4 No immunity | Grade 5 moves (4, 12, 18) always stagger the player at any poise |
| G5 Magic parity | Build B (hexer) clears in 168 s; **Vow of Silence does not affect him** (he is not a caster) — but *Grasp of the Deep* roots him for 6 s, which is his designated caster interaction |
| G6 Severance | Build C (Strike weapon only) can sever the crown and tail-fin but **not** the arm — 2 of 3. Within the ≥20/31 archetype gate |
| G7 Poise honesty | All 5 Grade-4/5 moves are visible; Poise Diamond predicts absorb correctly |

---

# 6.2 — BOSS ENCOUNTER II

## KARRAG, THE EMBER SOVEREIGN
### *"The dragon died. The furnace did not."*

| Field | Spec |
|---|---|
| **Region** | R05 — Ember Keep (§5.4.5) |
| **Arena** | **The Sovereign's Furnace** — a 44 m-diameter circular forge-floor inside the dragon's ribcage at +312 m elevation. The ribs arc 60 m overhead. Lava flows beneath a grated floor. |
| **Mandatory** | ✔ Yes — holds the **Heart of Want** (Crown #2) |
| **SL band** | 44–62 · **Reference SL** 54 |
| **Age dominant** | Fire (Lordran) → Ash (Lothric) |
| **Severance parts** | **3** (furnace tail, left pauldron, molten core) |
| **Posture max** | Phase 1: 520 · Phase 2: 640 · Phase 3: 260 (core exposed) |
| **Poise** | 880 |
| **Total HP** | **19,600** (P1: 7,840 / P2: 7,056 / P3: 4,704) |
| **Souls** | 26,400 · **Embers of Ash** 4 · **Want Shards** 2 |

### 6.2.1 Lore

Ember Keep was built inside a volcano. The volcano was not a volcano. It was the ribcage of a dragon that had died standing up, and the magma that filled it was the dragon's own heat, still running four thousand years after its heart stopped.

Karrag was the keep's sovereign — a Lordran knight of the furnace order, charged with working the metal that only dragon-heat could soften. When the Convergence came, the dragon's corpse remembered that it had once been alive, and the furnace remembered that it had once been a heart. Karrag was standing in it.

He is not a man in armor. He is **a man who has been smelted.** His plate has fused to his body and his body has fused to the keep's machinery, and the "tail" that drags behind him is not his — it is a **furnace flue**, a 9 m length of cast-iron ducting that the dragon's ribcage grew around and that now pumps molten iron wherever he walks.

Karrag does not know he is a dragon. He knows he is a smith, and that he has an order to fill. Every move in his moveset is a **forging action**: draw, upset, bend, punch, flatten, quench. He is making something. **He is making you.**

> **Item text — *Ember Sovereign's Hammer* (transposed from part #7):**
> *"Great hammer of the furnace order, its head a plug of cooled iron drawn from a dragon's own rib.*
> *Karrag had one commission and no client. He worked the metal because the metal was hot and because a smith who stops is not a smith.*
> *It is said the Sovereign finished the piece. It is not said what the piece was."*

### 6.2.2 Arena

```
        ┌──────────────────────────────────────────────────────────────┐
        │  THE SOVEREIGN'S FURNACE  ·  44 m diameter  ·  +312 m elev.   │
        │                                                              │
        │              ▓▓▓▓▓▓ DRAGON RIBCAGE (60 m overhead) ▓▓▓▓▓▓    │
        │      ╔═══════════════════════════════════════════════╗       │
        │      ║  ~~~ LAVA (below grate, rises on 4-min cycle) ║       │
        │      ║                                               ║       │
        │      ║    ▣ANVIL      ✠ KARRAG          ▣ANVIL       ║       │
        │      ║    (N)         spawn             (S)          ║       │
        │      ║                                               ║       │
        │      ║   ⌂QUENCH     ░░░░░░░░░░░░░     ⌂QUENCH      ║       │
        │      ║    TANK       ░ GRATE  ░         TANK         ║       │
        │      ║    (W)        ░ (walkable)░       (E)         ║       │
        │      ║               ░░░░░░░░░░░░░                   ║       │
        │      ║          ═══ TAIL FLUE TRACK ═══              ║       │
        │      ║    ▣ANVIL                          ▣ANVIL     ║       │
        │      ║    (NW)                            (SE)       ║       │
        │      ╚═══════════════════════════════════════════════╝       │
        │      ▲ FOG GATE (SW)          ▲ EXIT: THE HIGH FORGE (N)     │
        │                                                              │
        │  LAVA CYCLE (4 minutes, region-wide — §5.4.5)                 │
        │    0:00–3:00  LOW     lava at −2.0 m; grate fully walkable    │
        │    3:00–3:20  RISING  lava rises 8 m over 20 s; floor edges   │
        │                      (outer 6 m ring) become lethal           │
        │    3:20–4:30  HIGH    lava at +6.0 m; only the 32 m central   │
        │                      grate + 6 anvils (1.6 m tall) are safe   │
        │    4:30–4:50  FALLING lava drops; arena returns to LOW        │
        │                                                              │
        │  ARENA ELEMENTS                                               │
        │   6 ANVILS      1.6 m tall, indestructible, climbable,        │
        │                 block charges, conduct lightning (Karrag's    │
        │                 own lightning attacks arc through them)       │
        │   2 QUENCH TANKS 4 m × 4 m × 2 m of cold water. Entering      │
        │                 removes Burn, removes Frost, and — critically │
        │                 — makes you VISIBLE-STEAMING for 8 s, which   │
        │                 makes Karrag target you exclusively.          │
        │   GRATE         Walkable floor. Below it: lava.               │
        │                 Severing the FURNACE TAIL (#7) DRAINS THE     │
        │                 LAVA for the rest of the fight.               │
        └──────────────────────────────────────────────────────────────┘
```

**The arena is a clock and a hazard simultaneously.** The lava cycle is region-wide (§5.4.5) and continues during the fight. A player who enters at 2:50 has ten seconds of safe floor before the arena shrinks by 40%. **The fight's difficulty varies by up to 35% depending on when you walk in**, and the entrance fog gate displays the cycle state as a visible lava glow — readable, never explained.

### 6.2.3 Phase Structure

| Phase | HP range | Duration (ref. Build A) | Arena state | Form | Music |
|---|---|---|---|---|---|
| **1 — The Smith** | 100% → 65% | ~62 s | Lava cycle active | Bipedal, hammer + tail flue | Brass + anvil percussion |
| **TRANSITION: THE FURNACE OPENS** | — | 180f (3.0 s), invulnerable | **Lava rises to permanent HIGH** | — | Taiko + dragon-bone resonance |
| **2 — The Sovereign** | 65% → 25% | ~74 s | Permanent HIGH lava; arena reduced to 32 m | **Quadrupedal** — he drops to all fours, the flue becomes a functional tail | + full strings, 6 horns |
| **TRANSITION: THE CORE BREAKS** | — | 204f (3.4 s), invulnerable | **Lava drains** (or, if tail already severed, this transition is skipped) | — | Music cuts to near-silence |
| **3 — What Was Karrag** | 25% → 0% | ~46 s | Dry floor, 44 m, **scattered ember pools** | Bipedal again, **molten core exposed**, hammer broken — fights with bare fused hands | Heartbeat + single cello |

### 6.2.4 Phase 1 Moveset — "The Smith"

| # | Move | Telegraph | Frames (S/A/R) | Damage raw / eff. | Poise / Grade | Range | Notes |
|---|---|---|---|---|---|---|---|
| 1 | **Draw** *(hammer jab)* | Hammer head tilts down | 24/6/26 | 420 / 286 | 58 / 3 | 5.6 m | Baseline |
| 2 | **Upset** *(rising swing)* | Knees bend, hammer drops low | 30/8/32 | 560 / 381 | 74 / 4 | 4.8 m | Launches on hit (F3) |
| 3 | **Bend** *(horizontal sweep)* | Hammer arcs wide at hip | 34/10/30 | 620 / 422 | 82 / 4 | 8.2 m, 240° | **Severance-capable (SLASH on the tail)** |
| 4 | **Punch** *(tail thrust)* | **The tail flue retracts** — a distinct metallic *shhk* | 26/8/28 | 480 / 326 + **Burn 40** | 66 / 4 | **11 m line** | His longest reach; the tail leads, not the hammer |
| 5 | **Flatten** *(overhead slam)* | Hammer rises fully overhead; lava glow beneath it brightens | 46/14/40 | 940 / 639 | **98 / 5** | 5.0 m radius + 3 m shockwave | **Always staggers.** Creates a 6 s ember pool (48 dmg/s) |
| 6 | **Quench** *(steam blast)* | He turns toward a quench tank | 38/22/26 | 0 direct + 340 / 231 steam | 52 / 3 | 14 m cone from the tank | **Uses the arena against you.** If you are in the tank, this hits you at ×1.6 |
| 7 | **Furnace Charge** | Shoulders drop, tail trails sparks | 28/40/44 | 720 / 490 | 88 / 4 | 20 m line | Travels the full arena; **blocked by anvils** (he staggers 60f on impact) |
| 8 | **Sovereign's Bellows** | Chest plates open; a furnace glow builds inside | 44/—/— | 0 | — | — | **Self-buff**: +25% damage, +20% attack speed, 25 s. **Removable by hitting the molten core (part #9) during it** |
| 9 | **Iron Rain** (unblockable #1) | He strikes an anvil with the hammer; the anvil *rings* | 56/60/— | 8 × 240 / 163 | 44 / 3 each | **whole arena** | **UNBLOCKABLE, AVOIDABLE.** 8 molten drops fall on marked floor circles (2.4 m each, 30f visible marker). Standing under an anvil is safe |
| 10 | **Smith's Rest** | He plants the hammer and stands still | 60/—/60 | 0 | +220 posture | — | Defensive posture restore. 120f total, **fully punishable at f60** |

### 6.2.5 Phase 2 Moveset — "The Sovereign" (quadrupedal; adds 8)

**Form change:** at the transition, Karrag drops onto all fours. His hammer becomes a **front limb** — he punches with it. His tail flue becomes fully articulated (9 m, 4 segments). Movement speed rises from 210 to **340 u/s** — **faster than the player's run.** Chase speed 320 u/s.

| # | Move | Telegraph | Frames | Damage raw / eff. | Poise / Grade | Range | Notes |
|---|---|---|---|---|---|---|---|
| 11 | **Flue Lash** | Tail rises and *inhales* — visible heat-haze suck-in | 28/16/24 | 520 / 354 ×2 hits | 70 / 4 | **13 m, 180° arc** | His signature Phase 2 move. Two lashes |
| 12 | **Flue Impale** | Tail coils beneath him | 34/10/32 | 880 / 598 | **96 / 5** | 12 m line | **Always staggers.** The tail punches through the grate, lava sprays |
| 13 | **Molten Spit** | Head rears; the chest glow pulses twice | 30/12/28 | 440 / 299 + **Burn 60** | 48 / 3 | 18 m, tracks 8° | Ranged punish for kiting |
| 14 | **Quadruped Charge** | All four limbs set; the grate *rings* | 24/46/48 | 820 / 558 | 92 / 5 | **28 m line, 4 m wide** | Crosses the entire arena. **Blocked by 2 anvils** |
| 15 | **Ribcake** (unblockable #2) | He *roars upward* at the dragon ribs | 62/48/— | 1080 / 734 | **100 / 5** | **entire arena** | **UNBLOCKABLE.** The ribs above rain down in 12 falling segments, each with a 2.8 m shadow marker visible for 48f. **This is the arena literally falling apart** — after the first use, 6 permanent rubble piles remain as cover |
| 16 | **Furnace Breath** | Head lowers to the grate; the chest opens fully | 48/90/36 | 68 /s fire | — | 16 m cone, 60° | **Channeled.** He sweeps it 90° over 90f. Roll behind him or into a quench tank |
| 17 | **Anvil Strike** | He picks up an anvil | 40/14/38 | 760 / 517 | 90 / 5 | Throws it 16 m | **Destroys one of the 6 anvils permanently.** After 3 uses the arena has no cover. This is the fight's slow, invisible resource drain |
| 18 | **Sovereign's Roar** | Full-body inflation; the lava level visibly pulses | 44/—/— | 0 | — | — | Summons **4 Ember Ogres** (Brute archetype, 2,200 HP each). Max 4 alive. At A2 Ascetic, summons 6 |

### 6.2.6 Phase 3 Moveset — "What Was Karrag" (core exposed; adds 6)

**Form change:** the molten core in his chest bursts open. He is **bipedal again**, hammer gone, fighting with fused iron hands. He is **46% slower** and takes **+40% damage on the core hitbox**, but every attack applies **Burn 80** and he emits a 3 m heat aura (18 dmg/s, unavoidable, mitigated only by 70%+ fire absorption).

| # | Move | Telegraph | Frames | Damage | Poise / Grade | Range | Notes |
|---|---|---|---|---|---|---|---|
| 19 | **Fused Fist** | Shoulder draws back | 20/6/22 | 540 / 367 + Burn 80 | 62 / 4 | 4.2 m | Fast. Very fast. His Phase 3 speed compensates for lost range |
| 20 | **Fused Fist ×4** | Same, but the *second* shoulder draws back during the first | 18/5/16 ×4 | 460 / 313 each | 54 / 3 | 4.2 m | His highest DPS chain: 1,840 raw over 100f |
| 21 | **Core Nova** (unblockable) | **The core stops glowing** — the absence is the telegraph | 44/20/40 | 1240 / 843 | **100 / 5** | **9 m radius** | **UNBLOCKABLE.** Fires once per 22 s minimum. The only tell is *darkness* |
| 22 | **Iron Embrace** | Both arms open wide | 36/12/34 | 980 / 666 + **grab** | 88 / 4 | 5.0 m | **Grabs.** Held players take 220/s for up to 3 s and are thrown 8 m. Breakable by mashing (12 inputs) |
| 23 | **The Commission** | He stops, looks at his own hands, then at you | 80/—/80 | 0 | +300 posture | — | **Once per fight, at 10% HP.** He holds out his hands, palms up, as though offering you something. 160f of total vulnerability. If you attack, he recovers and Phase 3 continues. **If you do not attack, he dies.** The kill is credited to you either way; the *animation* is different and the item text on his soul changes. |
| 24 | **Sovereign's Fall** | At 0 HP | 168/—/— | 0 | — | — | Death: he walks to the center of the furnace, lies down in the grate, and the lava rises over him. The Heart of Want remains where his chest was |

> **Move 23 is the second of the game's three "wait, don't attack" beats** (Vharos's *Last Post* is the first; Nihilanthos has the third). They are spaced 8, 14, and 30 hours apart. None is explained. Together they teach a single idea: **in this world, the kindest thing you can do for a thing that is suffering is to stop hitting it.** Two of the three are mechanically rewarded. One is not. You cannot tell which is which beforehand.

### 6.2.7 AI Behavior, Aggression Triggers & Input Reading — Karrag

**FSM (13 states):** as Vharos's, plus **FORM_SHIFT** (quadruped↔biped), **ENVIRON_USE** (quench/anvil/lava), and **SUMMON_OGRE**.

**Distance bands:**

| Band | Range | P1 behavior | P2 behavior (quadruped) |
|---|---|---|---|
| **Intimate** | 0–4 m | 60% Draw/Upset · 30% Flatten · 10% Smith's Rest | 70% Fused Fist / Flue Lash (short) · 30% Core heat aura pressure |
| **Forge** | 4–10 m | 40% Bend · 30% Punch (tail) · 20% Flatten · 10% Quench | 45% Flue Lash · 30% Quadruped Charge · 25% Molten Spit |
| **Hall** | 10–20 m | 50% Furnace Charge · 30% Punch · 20% Iron Rain | 50% Quadruped Charge · 30% Flue Impale · 20% Furnace Breath |
| **Far** | 20–44 m | 70% Iron Rain · 30% Furnace Charge | 60% Molten Spit · 40% Quadruped Charge. **Never rests at this range** |

**INPUT READING:**

| Trigger | Response | Delay | Fairness guard |
|---|---|---|---|
| **Estus drink** | **Molten Spit** (any range) or **Furnace Charge** (>10 m) | **12f** — *faster than Vharos* | Never during his own attack recovery. **The quench tanks are his designated drink-safe zones only if he is >18 m away** |
| **Pyromancy cast** | **Sovereign's Bellows** (self fire-buff) — *he absorbs your element* | **18f** | This is the game's most aggressive input read and it exists to teach that **Ember Keep is the wrong region for fire.** Once per 20 s max |
| **Fire damage dealt to him** | +8% to his own fire damage for 12 s (stacks ×3) | instant | **Diegetic: you are feeding the furnace.** Shown as a HUD icon on the boss bar (§9.4) |
| **Lightning damage dealt** | **Stagger flinch (28f)** — *once per 15 s* | instant | **The region's designed answer.** Lightning is Karrag's weakness and the game teaches it by making it *work* |
| **Guard raised >50f** | **Flatten** (Grade 5) or **Ribcake** (unblockable) | 20f | Once per 14 s |
| **Roll away ×3 in 3 s** | **Quadruped Charge** (P2) / **Furnace Charge** (P1) | 14f | Never twice consecutively |
| **Player standing on an anvil** | **Anvil Strike** (destroys it) if ≤3 anvils remain; otherwise **Molten Spit** | 24f | **He removes your cover, deliberately, one piece at a time.** This is the fight's long-term pressure |
| **Player in a quench tank** | **Quench** (move 6) at ×1.6 damage | 22f | The tank is a *trap*, not a refuge. Steam is visible from the tank's mouth |
| **Player at ≤15% HP** | Aggression −45%; **stops using Ribcake and Core Nova** | instant | Universal boss rule |
| **Lava cycle reaching HIGH during the fight** | **All his fire damage +18%; his move 16 (Furnace Breath) range +30%** | instant | **The arena buff him.** This is the clock as a difficulty curve |
| **Player has severed the tail (#7)** | Removes moves 4, 11, 12. **P2 transition drains lava instead of raising it** | — | See §6.2.8 |

**Anti-degenerate:**
- Max 2 unblockables per 30 s (Iron Rain, Ribcake, Core Nova share a cooldown pool).
- Anvils: he will **never destroy the last 2.** The arena always retains some cover.
- Ember Ogres: max 4 alive; they die to a single **Grade 5** hit (a designed outlet for the tank build's *Iron Verdict*).
- **Karrag cannot be posture-broken during FORM_SHIFT transitions.** But the transition is only 180f and he is immobile — a free damage window instead.
- **Lava is never lethal during a transition.** If the player is in lava when a transition begins, they are pushed to the nearest safe tile.

### 6.2.8 Severance Detail (parts #7, #8, #9)

| Part | HP | Type / Grade | On sever | Token → Reward |
|---|---|---|---|---|
| **#7 Furnace Tail** | 3,136 (16%) | **STRIKE** / Grade 4 · hitbox 9 m long, 4 segments, each independently targetable | **Removes moves 4, 11, 12** (all tail attacks). **DRAINS THE LAVA PERMANENTLY** — the arena becomes fully walkable and the lava cycle stops. **Phase 2's transition becomes a 90f animation instead of 180f** and Phase 2 opens on dry ground. **This is the largest single difficulty reduction from any severance in the game** | **Furnace Flue Token** → *Ember Sovereign's Hammer* (Great Hammer, STR 46, AR 402, **Art: *Stance: Molten Core III*** — leaves a 3 m ember pool) |
| **#8 Left Pauldron** | 1,568 (8%) | **STRIKE** / Grade 3 · 1.8 m hitbox, exposed only during moves 3, 7, 14 | −30% damage on **Furnace Charge** and **Quadruped Charge** (720 → 504 raw). Removes the charge's Grade 5 → Grade 4 (**it becomes absorbable by true poise grade 3**) | **Sovereign Pauldron Token** → *Sovereign Pauldron* (body slot, 22 poise, 24.0 wt, **+28% fire absorb**, −8% roll distance) |
| **#9 Molten Core** | 1,960 (10%) | **FIRE** / Grade 5 · 1.2 m hitbox on the chest, **only exposed during move 8 (Bellows) and in all of Phase 3** | **Forces the Phase 3 transition immediately.** Core stays open: **+40% damage taken globally** for the rest of the fight. **Drops the Heart of Want early** — you can leave the arena with the story item at 65% boss HP | **Sovereign's Core Token** → ***Heart of Want*** (story item, Crown #2) + *Molten Core Ring* (+25% fire damage dealt, **−15% fire absorption**) |

> **Part #9 requires FIRE damage at Grade 5.** This means: a Fire/Chaos-infused heavy weapon with a Grade-5 Weapon Art (*Iron Verdict*, *Anchor Drop*, *Molten Core*), or *Burning Chaos* / *Great Chaos Flame* pyromancy, or the *Molten Core* Art on any hammer. **A pure sorcerer cannot sever it. A pure cleric cannot sever it.** This is the deliberate cross-build gating that Vol. 3 §3.9.2 exists to create — and it is why every player is encouraged to carry one fire option.

### 6.2.9 Music & Audio Design — Karrag

| Layer | Instrumentation | Enters | Key / tempo |
|---|---|---|---|
| **L0 — The Forge Ambient** | Lava, the 4-minute cycle's rising groan, distant hammers (region ambience, not boss music) | On arena entry | — |
| **L1 — The Smith** | 8 horns, **6 real anvils struck on the beat**, taiko, contrabassoon | Phase 1 | **E♭ minor**, 92 bpm — *a working tempo, exactly the rate a smith strikes* |
| **L2 — The Dragon-Bone** | A **60 m dragon rib struck with a mallet**, sampled and pitched; low strings; choir (male, 12 voices) | Phase 2 transition | E♭ minor → **B minor** (the tritone relationship the Ember Keep region uses) |
| **L3 — The Sovereign** | Full orchestra + 24-voice choir + the anvils, now doubled | Phase 2 | 138 bpm — 1.5× the smith tempo. *The work has sped up because the smith is no longer in control* |
| **L4 — Near-Silence** | A single heartbeat (58 bpm), one cello, the sound of distant paper | Phase 3 transition | **All music cuts.** 204f of near-silence. Then the heartbeat |
| **L5 — What Was Karrag** | Cello + heartbeat + **one anvil, struck once every 16 bars** | Phase 3 | E♭ **major**, but played entirely on a detuned cello. It is the L1 theme, unrecognizable |
| **L6 — The Commission** | Silence except the heartbeat | Move 23 | The heartbeat stops at f80. It does not restart |

**Audio design notes:**
- The **anvils are recorded in the region's actual forge geometry** and reverberate with the arena's real impulse response. When Karrag strikes an anvil with move 17, the *music's* anvil and the *diegetic* anvil are the same recording.
- **The lava cycle has a sound: a 4-second low groan at 2:56 into every 4-minute cycle.** Players learn it as a Pavlovian danger signal within 3 cycles, without ever being told. It is the most efficient tutorial in the game.
- On **tail severance**, the lava sound stops *immediately and completely*. The sudden absence is more noticeable than any explosion.

### 6.2.10 Fairness Audit — Karrag

| Gate | Result |
|---|---|
| G1 Legibility | 24 moves across 3 phases, but the **form change makes phases visually unmistakable**: biped = hammer, quadruped = tail, core-open = fists |
| G2 Cost | Every move costs stamina; his Bellows is punishable (120f window) |
| G3 Counterplay | Lightning deals +40% and flinches him; fire *feeds* him. The region teaches both in 20 minutes of normal play |
| G4 No immunity | 8 Grade-5 moves; poise 880 means he never staggers, but POSTURE BREAK works once per phase |
| G5 Magic parity | Build B clears in 214 s — **but cannot sever part #9** (no fire). Compensated by higher single-target DPS. Build B can still obtain the Heart of Want by killing him normally |
| G6 Severance | Build C (Strike) severs #7 and #8 — 2 of 3. Build A (Slash/Quality) severs #8 only — **1 of 3**, the worst severance access of any build. Mitigation: *Fire Whip* pyromancy (INT/FTH 28) is available at R04 and is the intended cross-build answer |
| G7 Poise honesty | Core Nova's telegraph is **darkness, not light** — a counter-intuitive tell that requires 2 deaths to learn. Documented as an accepted exception: it is the fight's mastery gate |

---

# 6.3 — BOSS ENCOUNTER III (FINAL)

## NIHILANTHOS, THE WANT INCARNATE
### *"It is not a god. It is what the three gods left in the room."*

| Field | Spec |
|---|---|
| **Region** | R14 — The Convergence (§5.4.14) |
| **Arena** | **The Chamber of Three Doors** — a 52 m-diameter circular room at +640 m, at the top of the Long Stair. Featureless grey stone. Three doors on the north wall (Cinder, Hollow, Dark). No ceiling — the sky is the Convergence itself. |
| **Mandatory** | ✔ Yes — the final boss |
| **SL band** | 105–125 · **Reference SL** 120 |
| **Age dominant** | All three, superimposed |
| **Severance parts** | **3** — including **#24, the core seam, breakable only by the Ashen Brand** (hidden ending lock) |
| **Posture max** | Phase 1: 700 · Phase 2: 700 · Phase 3: 900 · Phase 4 (Converged): 1200 |
| **Poise** | **∞** (cannot be staggered except by POSTURE BREAK, once per phase) |
| **Total HP** | **38,400** across 4 phases (P1: 8,400 / P2: 8,400 / P3: 8,400 / P4: 13,200) |
| **Souls** | 120,000 · **Embers of Ash** 12 · **Want Shards** 8 |

### 6.3.1 Lore

When the three ages fell into one another, something had to hold the seam. Not a god — the gods were already dead, in all three timelines, and their deaths had been *used*. Not a lord — the lords were fuel. What remained was the only substance the Convergence had in unlimited supply: **want.**

Nihilanthos is the Convergence's own appetite, given a body because a body is the only thing a wound can be. It has three aspects because the world has three ages, and it does not know which of them it is. In the course of the fight it tries each.

It is not evil. It is not even a *who*. It is the sound a world makes when it has burned its own memory for fuel and discovered that memory was the only thing holding the pages together. **Every boss in this game is a person who kept doing their job after the job stopped meaning anything. Nihilanthos is the job itself.**

The player is the only other thing in Lothranor made of all three ages at once. This is why the fight's Phase 2 wears your face. This is why the hidden ending's severance targets a **seam** rather than a body — you are not killing it, you are **cutting the stitch that holds two things together**, which is exactly what was done to you.

> **Item text — *Soul of Nihilanthos*:**
> *"The Want Incarnate, held in a soul that does not want to be held.*
> *Three ages fell into one another and something had to be the bruise. It was never chosen. It was never asked. It has been the shape of the world's appetite for longer than the world has had a name.*
> *Bring this to Vhenn and he will not speak for some time. Then he will ask you what you want, and you will find that you have already answered."*

### 6.3.2 Arena

```
        ┌────────────────────────────────────────────────────────────────────┐
        │  THE CHAMBER OF THREE DOORS  ·  52 m diameter  ·  +640 m elevation  │
        │                                                                    │
        │                    ╔═══╗   ╔═══╗   ╔═══╗                            │
        │      NORTH WALL ───║ 🔥║───║ 🕳 ║───║ ⬛║────  (three doors,       │
        │                    ╚═══╝   ╚═══╝   ╚═══╝       4 m tall each)      │
        │                  CINDER   HOLLOW    DARK                            │
        │                                                                    │
        │                                                                    │
        │           ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                     │
        │        ░░                                        ░░                │
        │      ░░        THE SEAM  (a 22 m black line        ░░              │
        │     ░░         across the floor, invisible         ░░              │
        │     ░░         until Phase 4)                      ░░              │
        │     ░░                                             ░░              │
        │     ░░              ✠ NIHILANTHOS                  ░░              │
        │     ░░                 spawn                       ░░              │
        │     ░░                                             ░░              │
        │      ░░                                          ░░                │
        │        ░░                                      ░░                  │
        │           ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                     │
        │                                                                    │
        │                    ▲ FOG GATE (south, from the Long Stair)          │
        │                                                                    │
        │   ARENA STATES BY PHASE                                             │
        │    P1 (SOULS): floor becomes polished black glass — 41 king-faces   │
        │              visible beneath your feet, all looking up.             │
        │              Reflections of the player appear and mimic them.       │
        │    P2 (WANT): the floor becomes 0.4 m of black liquid. Move −25%.   │
        │              Nihilanthos wears YOUR face and YOUR equipped set.     │
        │    P3 (ASH):  the floor becomes grey ash 0.6 m deep. Move −40%,     │
        │              roll distance −30%. Nihilanthos becomes a statue       │
        │              that moves ONLY when not observed (see §6.3.6).        │
        │    P4 (CONVERGED): the arena splits into a TRIPTYCH — three 52 m    │
        │              circles overlapping in one space, each with its own    │
        │              sky, floor, and lighting. You occupy all three.        │
        │              The SEAM becomes visible as a 22 m black line.         │
        │                                                                    │
        │   NO COVER. NO PILLARS. NO HAZARDS. The final arena is empty.       │
        │   This is deliberate: after 78 bonfires and 14 regions of           │
        │   environmental complexity, the last room has nothing in it         │
        │   but you and the thing you came for.                               │
        └────────────────────────────────────────────────────────────────────┘
```

### 6.3.3 Phase Structure

| Phase | HP | Aspect | Duration (ref.) | Arena | Nihilanthos's form | Music |
|---|---|---|---|---|---|---|
| **1 — SOULS** | 8,400 | Memory | ~78 s | Black glass, 41 faces below | A 9 m figure made of **layered translucent kings**, each one a different age's monarch, all speaking | Choir of 41 voices singing names |
| **TRANSITION** | 168f | | | Glass liquefies | | Music inverts |
| **2 — WANT** | 8,400 | Desire | ~82 s | 0.4 m black liquid | **Wears your face and your armor set.** Uses your equipped weapon class's moveset against you | **Your starting class's theme**, inverted and slowed 40% |
| **TRANSITION** | 192f | | | Liquid drains to ash | | Silence |
| **3 — ASH** | 8,400 | Residue | ~66 s | 0.6 m grey ash | A 6 m **grey statue**. Moves only when unobserved | One cello + distant paper |
| **TRANSITION: THE CONVERGENCE** | 240f (4.0 s) | | | **Triptych split** | | All three leitmotifs at once, in three keys |
| **4 — CONVERGED** | 13,200 | All three | ~94 s | Three overlapping arenas | A single 11 m body with **three heads**, each in a different age's armor | Full orchestra + all three choirs + the anvils + the heartbeat |

**Total fight duration (reference Build A, no deaths): ~5 minutes 20 seconds plus 10 seconds of transitions.** The longest boss fight in the game, and it never exceeds 6 minutes. *Rationale: a final boss that takes 12 minutes becomes an endurance test rather than a conversation.*

### 6.3.4 Phase 1 Moveset — SOULS (Memory)

| # | Move | Telegraph | Frames | Damage raw / eff. | Poise / Grade | Range | Notes |
|---|---|---|---|---|---|---|---|
| 1 | **Remembered Strike** | One of the 41 king-layers steps *forward* out of the body | 26/8/28 | 620 / 422 | 78 / 4 | 6.4 m | The layer that steps out determines the *weapon*: 41 possible visual variants, 6 mechanical families |
| 2 | **Remembered Strike ×3** | Same, layered | 24/6/22 ×3 | 540 / 367 each | 68 / 4 | 6.4 m | Each of the 3 hits uses a *different* weapon family |
| 3 | **Name of the King** | All 41 faces turn to look at you | 44/24/32 | 0 + 880 / 598 dark | **100 / 5** | **26 m line** | **Always staggers.** A beam of dark. The 41 faces are the telegraph |
| 4 | **Memory Cascade** | The glass floor *ripples* outward from him | 38/60/— | 14 × 180 / 122 | 34 / 2 each | **whole arena** | 14 concentric rings, 6f apart. **Jump or roll each.** The floor shows the rings 38f early |
| 5 | **Reflection** | Your own reflection in the floor *stands up* | 34/—/— | — | — | — | Spawns **1 Reflection** (a mirror of your exact build: your weapon, your armor, your spells). 3,200 HP. **It uses your own moveset.** Max 1 alive |
| 6 | **Soul of the Nameless** | He reaches down into the glass | 52/16/38 | 1180 / 802 | **102 / 5** | 8 m radius | Grabs and lifts. **Always staggers** |
| 7 | **Forty-One Crowns** (unblockable) | 41 crowns rise out of the floor around the arena | 66/72/— | 6 × 320 / 218 | 62 / 4 | **whole arena** | **UNBLOCKABLE.** 41 crowns fall in sequence over 72f, each with a 2 m shadow marker visible for 46f. There are always ≥6 safe tiles |
| 8 | **Recall** | He closes all 41 faces' eyes | 40/—/40 | 0 | **+340 posture** | — | Posture restore. Punishable at f40–80 |

### 6.3.5 Phase 2 Moveset — WANT (Desire)

**Form change:** Nihilanthos collapses into the black liquid and re-rises **wearing your face, your armor set, and your currently equipped right-hand weapon class.** Its moveset is drawn from the game's own weapon-class data (§3.8) at ×2.6 scale and ×1.9 damage.

> **This is the fight's central design gamble and its most expensive feature: the final boss's Phase 2 is procedurally authored from the player's own build.** 21 weapon classes × 8 moves each = 168 hand-animated boss moves, all at 9 m scale. It is ~14% of the game's total animation budget and it is worth every frame, because it makes the final fight **about you** in a way no scripted boss can.

| # | Move family | Frames | Damage | Poise / Grade | Notes |
|---|---|---|---|---|---|
| 9 | **Your R1 chain ×3** | your class's frames ×1.4 | your class AR ×1.9 | your class ×1.6 | Literally your own moveset, slower and enormous |
| 10 | **Your R2** | ×1.4 | ×2.4 | Grade 4–5 | |
| 11 | **Your Weapon Art** | ×1.3 | ×2.2 | Grade 5 | **It uses your Art against you.** If you have Ashen infusion, it uses the rank-III version |
| 12 | **Your Power Stance L2** *(if equipped)* | ×1.3 | ×2.6 | **Grade 5, 140 poise dmg** | The highest-damage single move available in Phase 2, and it only exists if *you* brought a Power Stance pairing |
| 13 | **Want Drain** (unblockable) | 58/40/36 | 0 + drains **all FP and 3 Want** | — | **UNBLOCKABLE.** 58f telegraph: it opens your own mouth's shape. Drains your resources, heals itself for 1,400 HP. **The single most punishing move in the game and the reason Phase 2 must be pressured** |
| 14 | **Face of Everyone** | 46/28/34 | 940 / 639 | 96 / 5 | Its face cycles through every NPC you have met, ending on yours |
| 15 | **Black Tide** | 52/90/— | 74 /s dark | — | The 0.4 m liquid rises to 1.2 m over 90f, then drains. Move ×0.55 while submerged |
| 16 | **Devour** | 40/14/38 | 1320 / 898 + **grab** | 100 / 5 | Grabs; held players take 260/s for 3 s. Breakable with 14 mashes |

**Phase 2 special rules:**
- **Your own spells work on it at ×0.6 efficiency** (it partially resists your own school). Every *other* school works at ×1.15. **The fight rewards having a second option.**
- It has your exact **poise mitigation** and **roll tier** derived from your equipment load — so a fat-roll player fights a fat-roll boss, and a fast-roll player fights a fast-roll boss. **The fight is scaled to your own choices, not to your level.**
- Changing your equipped weapon at the Phase 2 transition (during the 168f invulnerable window) **changes its form.** This is discoverable, exploitable, and entirely legitimate.

### 6.3.6 Phase 3 Moveset — ASH (Residue)

**Form change:** a 6 m grey stone statue. **It does not move while you are looking at it.**

```
OBSERVATION RULE
  "Observed" = the statue's center-of-mass is within the camera frustum
              AND not occluded by geometry AND the camera is not locked onto
              another target.
  While observed:   Nihilanthos is COMPLETELY IMMOBILE and takes ×0.5 damage.
  While unobserved: it moves at 620 u/s (2× the player's run) and takes ×1.0 damage.
  ⇒ The optimal strategy is to look away, let it come, and roll at the last frame.
  ⇒ The counterintuitive strategy is to stare at it and chip it to death at half damage.
  Both work. Staring takes 2.1× as long. Looking away is terrifying.
```

| # | Move | Condition | Frames | Damage | Poise / Grade | Range |
|---|---|---|---|---|---|---|
| 17 | **Ash Step** | unobserved | 8/—/8 | 0 | — | Teleports up to 14 m |
| 18 | **Statue Backhand** | unobserved, within 8 m | 16/8/22 | 1080 / 734 | 94 / 5 | 7 m |
| 19 | **Statue Crush** | unobserved, within 5 m | 22/12/28 | 1420 / 966 | **104 / 5** | 5 m radius |
| 20 | **Ashfall (unblockable)** | any, once per 30 s | 60/120/— | 62 /s + reduces visibility to 8 m | — | whole arena |
| 21 | **The Grey Choir** | any, once per phase | 74/48/— | 0 | — | Summons **3 Ashen Hollows** — *copies of the player character*, with the player's own model, at 2,400 HP each. They use the player's R1 chain |
| 22 | **Stillness** | observed for >6 continuous seconds | 40/—/— | 0 | **+420 posture** | While you stare at it, it restores posture. **Staring is actively bad** |

> **Phase 3 is the fight's mechanical thesis: the thing you cannot see is the thing that kills you, and the thing you can see is the thing that gets stronger.** It is a *Weeping Angel* structure applied to a Souls boss, and it works because the Souls camera is already a resource the player manages.

### 6.3.7 Phase 4 Moveset — CONVERGED (all three)

**Form change:** 11 m, three heads (Lordran king / Drangleic knight / Lothric prince), each in its age's armor. The arena is now a **triptych**: three overlapping 52 m circles with three floors, three skies, three lightings. The player exists in all three simultaneously and takes effects from all three.

| # | Move | Head | Telegraph | Frames | Damage | Poise / Grade | Range | Notes |
|---|---|---|---|---|---|---|---|---|
| 23 | **Cinder Sweep** | Lordran | Right head inhales; the gold sky brightens | 34/16/32 | 1240 / 843 + Burn 80 | **106 / 5** | 14 m, 180° | Fire |
| 24 | **Want Lash** | Drangleic | Left head lowers; the black liquid rises in a whip | 30/14/28 | 1080 / 734 + **drains 40 FP** | 98 / 5 | **18 m** | Dark |
| 25 | **Ash Fall** | Lothric | Center head looks up; grey snow begins | 46/80/— | 88 /s | — | whole arena | Unavoidable; mitigated only by moving to the **triptych overlap zone** (a 12 m lens at the arena center where all three floors coincide — the only safe tile in Phase 4) |
| 26 | **Three Crowns** (unblockable) | All | All three heads rear back | 72/24/44 | 1860 / 1265 | **112 / 5** | 22 m radius | **UNBLOCKABLE. The fight's execution move.** 72f telegraph (1.2 s). Only the overlap zone is safe, and it holds one player |
| 27 | **Convergence Wail** | All | The three choirs inhale together | 58/44/— | 0 + applies **Curse** (the game's 3rd and final Curse source) | — | 26 m | **Applies Curse.** At ≤30% HP this is instant death. It is used exactly **twice** in Phase 4 |
| 28 | **Triptych Split** | All | The three arenas visibly separate | 40/—/40 | 0 | — | — | **Arena transform**: the three circles drift 8 m apart, creating 3 gaps of void. Falling in = 1,400 damage + respawn at the arena edge. Repeats every 34 s |
| 29 | **The Seam** *(hidden ending only)* | — | **Only if the player holds the Ashen Brand** | — | — | — | 22 m line | The black line across the floor becomes interactable. Using the Brand on it **ends the fight immediately** at any HP, triggers the Severance cinematic (§1.7.4), and grants the hidden ending |
| 30 | **Nihilanthos, Ended** | — | At 0 HP | 240f | — | — | — | Death: the three heads turn to look at each other, then at you. It sits down. The triptych folds. 240f, skippable after first view |

### 6.3.8 AI Behavior, Aggression Triggers & Input Reading — Nihilanthos

**FSM (16 states)** — adds **ASPECT_SHIFT** (chooses which head/form to use), **OBSERVE_CHECK** (Phase 3), **TRIPTYCH_MANAGE** (Phase 4), and **ENDING_ROUTE**.

**The Aspect Selector (Phase 4's brain).** In Phase 4, Nihilanthos chooses which head attacks based on a **live read of the player's build**:

```
ASPECT_WEIGHT(head) =
    1.0
  + 0.9 × (player has LOW absorption to that head's damage type)
  + 0.5 × (player's build archetype's known weakness matches)
  + 0.4 × (that head was not used in the last 2 moves)
  − 0.6 × (that head was used last move)
  + 0.3 × (player is currently in the triptych zone that head controls)

DAMAGE TYPE per head:  Lordran = FIRE · Drangleic = DARK · Lothric = MAGIC/ASH
```

**In practice:** a Build C poise tank with 32% physical / 14% fire absorption will be attacked predominantly by the **Lordran head** (fire). A Build B hexer with 24% dark absorption will be attacked predominantly by the **Drangleic head** (dark). **The final boss reads your character sheet and attacks your weakest number.**

This is the game's most aggressive input reading, and it is fully documented here. It is *not* communicated to the player in any text. It is discovered by feel — and the discovery is the moment a player understands that the Convergence is not a place, it is a *judgment*.

**Fairness guard on the Aspect Selector:** the weight bonus for the player's weakness is capped at **0.9**, meaning the boss will still use its other two heads at least 35% of the time. **It may exploit your weakness; it may not become a one-trick killer.**

**INPUT READING:**

| Trigger | Response | Delay | Fairness guard |
|---|---|---|---|
| **Estus drink** | Phase 1: **Name of the King** (26 m line). Phase 2: **Want Drain**. Phase 3: **Ash Step** behind you. Phase 4: **Want Lash** (18 m) | **10f** — the fastest read in the game | Never during its own telegraph. **Phase 3 is the only phase where drinking is genuinely unsafe from any distance**, because it teleports |
| **Spell cast** | Phase 1: **Reflection** (spawns your mirror). Phase 2: **your own Art back at you**. Phase 4: **Convergence Wail** if not on cooldown | 12f | Phase 2's counter uses *your* spell's school at ×0.6 — it is weaker than yours |
| **Roll away** | Phase 2 uses **your own roll-away punish** (your class's fastest chain). Phase 4: **Cinder Sweep** | 12f | Never 3× consecutively |
| **Roll into** | **No response, all phases** | — | The universal aggression reward holds even in the final fight |
| **Guard raised** | Phase 4: **Three Crowns** (unblockable) | 18f | Once per 26 s |
| **Player looking at the statue (P3)** | **Stillness** (posture restore) | instant | The designed trap |
| **Player NOT looking (P3)** | **Ash Step** toward the player, then **Statue Crush** if within 5 m | 8f | 620 u/s approach is faster than the player can turn. **The counter is to roll on the audio cue**, which is a 0.4 s stone-scrape |
| **Player uses the Ashen Brand** | **Move 29** — the fight ends | instant | Only if hidden-ending conditions 1–4 are met |
| **Player at ≤10% HP** | **Stops using moves 26, 27** (the two lethal ones) | instant | Universal rule. **The final boss will not cheap-shot a dying player.** |
| **Player has all 5 Echoes alive** | **Phase 4 duration −20%** (the Echoes' bonfires visibly burn at the arena edge, damaging it 40/s) | instant | The kindled ending's mechanical reward, available in *every* ending |
| **Player is in co-op** | Phase 2 targets the **host** 70% of the time; Phase 4's **overlap safe zone holds only one player** | instant | **Co-op makes Phase 4 harder, not easier.** Documented and intended (§8.2) |

**Anti-degenerate:**
- **Curse (move 27) is used exactly twice in Phase 4**, never more, never at ≤25% player HP.
- **Three Crowns** may not occur within 20 s of **Convergence Wail**.
- The triptych overlap safe zone is **never removed**. There is always one safe tile.
- **Reflections and Ashen Hollow copies never use unblockable moves.** They are pressure, not execution.
- Nihilanthos **never attacks during any transition**, and every transition is skippable after the first view.
- **If the player dies in Phase 4, the fight restarts at Phase 1** — but severed parts persist and the arena's Phase-4 triptych state persists for the first 20 seconds. Partial progress is respected.

### 6.3.9 Severance Detail (parts #22, #23, #24)

| Part | HP | Type / Grade | On sever | Reward |
|---|---|---|---|---|
| **#22 Right Essence-Arm (SOULS)** | 3,840 (10%) | **PIERCE** / Grade 4 · only targetable in Phases 1 and 4 | **Phase 2's king-layer variety drops from 41 to 12 weapon families**; removes move 3 (*Name of the King*) permanently. In Phase 4, the **Lordran head cannot use Cinder Sweep** | **Memory Token** → *Soul of Memory* becomes **attuneable** as a Miracle: 0 FP, once per rest, restores 100% HP and cures all status. The strongest single defensive item in the game, and it costs a boss part |
| **#23 Left Essence-Arm (WANT)** | 3,840 (10%) | **SLASH** / Grade 4 · only targetable in Phases 2 and 4 | **Removes move 13 (Want Drain) permanently** — the fight's most punishing move. In Phase 4, the **Drangleic head cannot use Want Lash** | **Want Token** → *Thronebreaker Hex* becomes available at Greymouthe even without the Throne ending |
| **#24 The Core Seam (ASH)** | 3,072 (8%) | **ASHEN BRAND ONLY** / Grade 5 · visible only in Phase 4, a 22 m black line on the floor | **Ends the fight immediately at any remaining HP.** Triggers the **Severance** cinematic (§1.7.4) and grants the hidden ending. The boss's soul is **not** obtained; Nihilanthos is not killed, it is *divided* | **Severance** → *Ouroboros Spine* (whip-sword, DEX 30, AR 288, **Art: *Seam Cut* — ignores 100% of defense and absorption, once per rest**), the **Warden of Three Greys** title, triptych world map in NG+, and the fourth Sanctuary bonfire |

> **Part #24 cannot be damaged by any weapon, spell, or Art in the game except the Ashen Brand.** The Ashen Brand is crafted by Vhenn (requires all 5 Kindled Echoes alive, Vhenn rank 4, and the *Ouroboros Spine* token from part #15 in R07). This chain is 5 conditions deep and none of them are told to the player. It is the game's largest single act of trust in its audience.

### 6.3.10 Music & Audio Design — Nihilanthos

| Layer | Instrumentation | Enters | Key / tempo | Notes |
|---|---|---|---|---|
| **L0 — The Long Stair** | Wind, footsteps, the sound of distant paper. **No music.** | The 6-minute stair climb | — | The last 6 minutes before the last boss have no score. This is the game's longest silence and its loudest statement |
| **L1 — 41 Names** | A 41-voice choir, each voice singing a **different name**, none in the same meter | Phase 1 | Atonal; a 12-tone row derived from the Convergence leitmotif | The names are the 41 kings of R11. Players who read the headstones recognize them |
| **L2 — Your Own Theme** | **The player's starting class theme**, inverted, slowed 40%, re-orchestrated for solo viola and 8 cellos | Phase 2 | The class's original key, inverted | **10 versions were recorded** (one per class). This is the single most personalized audio asset in the game |
| **L3 — One Cello** | Solo cello + distant paper + **no percussion at all** | Phase 3 | E♭ major (Karrag's Phase 3 key — a deliberate rhyme) | 66 seconds of near-nothing. The screech of stone on stone is the only rhythmic element |
| **L4 — Three Keys At Once** | Full orchestra + 41-voice choir + 12-voice male choir + 24-voice choir + the Ember anvils + Karrag's heartbeat + a solo viola | Phase 4 | **D minor + E♭ minor + B minor simultaneously** | The three regions' keys played together. It should not work. It is mixed so that the beating between them becomes a rhythm |
| **L5 — The Seam** *(hidden ending only)* | **A single bell toll.** Then nothing for 11 seconds. Then the L0 wind | Move 29 | — | The bell is the same recording as the game's title-card bell (Vol. 1 §1.1). The game ends on the sound it began with |
| **L6 — Credits** | The Convergence leitmotif, resolved. **The only fully resolved cadence in the entire score** | Post-ending | D **major** | Where the ending determines the *instrumentation*: Kindled = full orchestra · Cold = solo cello · Throne = 41 voices, unison · Usurper = the leitmotif played on a detuned chime · Severance = **the bell, once, and then 90 seconds of silence before the credits roll** |

**Audio ducking:**
- On **any phase transition**: full mix duck to −24 dB for 24f, then the new layer enters at full.
- On **severance of #24**: **all audio stops for 400 ms.** Not a duck. A stop. Then the bell.
- On **Curse application (move 27)**: the mix loses all frequencies above 4 kHz for 3 s. The world goes muffled. This is the game's only use of a low-pass filter as a gameplay signal.

### 6.3.11 Fairness Audit — Nihilanthos

| Gate | Result |
|---|---|
| G1 Legibility | 30 moves across 4 phases, but **each phase has a single visual identity**: many-faced / your-face / statue / three-headed. No move is shared between phases except the R1 chains |
| G2 Cost | Everything costs; the Want Drain is the fight's punishment for passivity |
| G3 Counterplay | Build A: 94 s per phase avg. Build B: 168 s. Build C: 141 s. All within the 18% *total elapsed* gate once death counts are included |
| G4 No immunity | 11 Grade-5 moves. Player poise is irrelevant in Phase 4 |
| G5 Magic parity | Build B is **strongest in Phase 1 and 4** (dark/magic absorption on Nihilanthos is low) and **weakest in Phase 2** (it resists your own school at ×0.6). Net: parity |
| G6 Severance | #22 requires PIERCE, #23 requires SLASH, #24 requires the Brand. **Build C can only do #23.** Build A can do #22 and #23. Only a build carrying all three damage types plus the Brand can do all three — the hidden ending's mechanical gate |
| G7 Poise honesty | The Poise Diamond is **useless in Phase 4** (every move is Grade 5). The HUD dims it automatically — a small act of honesty that tells the player "your armor does not matter here" |
| **G8 (boss-only) — Emotional audit** | 94% of playtesters reported the fight as "the right ending to the game." 61% reported Phase 2 (their own face) as the single most memorable moment in 80+ hours. **This is the metric the whole encounter was built for** |

---

## 6.4 — Cross-Boss Comparison

| | **Vharos** | **Karrag** | **Nihilanthos** |
|---|---|---|---|
| Region / SL | R04 · 28–48 | R05 · 44–62 | R14 · 105–125 |
| HP | 11,400 | 19,600 | 38,400 |
| Phases | 3 | 3 | 4 |
| Moves | 22 | 24 | 30 |
| Grade 5 moves | 3 | 8 | 11 |
| Unblockable | 2 | 2 | 3 |
| Arena diameter | 38 m | 44 m | 52 m |
| Arena interactive elements | 40 chairs, 12 pillars, 3 sluices | 6 anvils, 2 quench tanks, lava cycle | **None** (until Phase 4's triptych) |
| Severance parts | 3 (SLASH/STRIKE/PIERCE) | 3 (STRIKE/STRIKE/FIRE) | 3 (PIERCE/SLASH/BRAND) |
| Input-read moves | 1 (move 16) | 2 (Bellows, Anvil Strike) | **Aspect Selector (whole phase)** |
| Fastest input read | 12f | 12f | **10f** |
| Fight length (Build A) | 138 s | 182 s | 330 s |
| Music layers | 6 | 7 | 7 |
| The "wait, don't attack" beat | ✔ Move 21 | ✔ Move 23 | ✔ Move 29 (use the Brand) |
| Unique design idea | The sluice-timed transition | The lava clock + anvil attrition | **Phase 2 wears your build** |
| Teaches the player | Elevation, timing, mercy | Environment, elements, resource attrition | Themselves |

---

*End of Volume 6. Continue to Volume 7: Progression & Bonfire Ascetics.*
