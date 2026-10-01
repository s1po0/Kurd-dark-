# VOLUME 7 — PROGRESSION & BONFIRE ASCETICS

> **Design owner:** Lead Systems Designer (Progression) / Economy Designer
> **Depends on:** Vol. 2 (level curve, infusions), Vol. 3 (severance), Vol. 5 (regions, Convergence Clock), Vol. 6 (bosses) · **Feeds:** Vol. 8 (multiplayer ranges), Vol. 9 (menus)

---

## 7.0 — Progression Philosophy

Three clocks run simultaneously in *Convergence*, and the player manages all three whether they know it or not.

| Clock | Scale | Resource | What it measures |
|---|---|---|---|
| **The Soul Clock** | Per area | Souls | *How much have I grown?* — the classic level curve |
| **The Flask Clock** | Per boss attempt | Estus charges, Life Gems | *How long can I stay in a fight?* — the encounter budget |
| **The Convergence Clock** | Per region, permanent | Ascetics, deaths, time | *How much of the world is left?* — the decay state (§5.8) |

**The design rule:** these three clocks must never be aligned. Growing stronger (Soul Clock) must always cost world stability (Convergence Clock advances on every boss kill, §5.8). Winning a fight (Flask Clock) must always be a *choice about* growing stronger (Estus vs. Life Gem allocation competes with upgrade materials). **A Souls game where progress is free is a Souls game with no tension.**

---

## 7.1 — The Dual Healing System

*Convergence* ships two healing systems that operate on completely different timescales, and the player must decide, at every bonfire, how to divide a **single shared pool** between them.

### 7.1.1 ESTUS FLASKS (the rechargeable, fast, committed heal)

| Property | Value |
|---|---|
| **Type** | Rechargeable at bonfires. Never consumed permanently |
| **Use time** | **51f** (0.85 s) at ADP 10 → **44f** (0.73 s) at ADP 40 |
| **Movement during use** | **Cannot move, cannot roll, cannot guard.** Full commitment |
| **Interruption** | Any poise damage interrupts and **wastes the charge** (the drink is lost) |
| **Restores** | HP (Estus) or FP (Ashen Estus) |
| **Input-read risk** | Every boss in the game reads Estus (§6.1.8, §6.2.7, §6.3.8). Drinking in front of a boss is a calculated risk |

**Charge acquisition:**

| Source | Charges | Total possible |
|---|---|---|
| Base | 5 | 5 |
| **Estus Shards** (24 in the world; 4 per region avg.) | +1 per 3 shards → +8 | 13 |
| **Vhenn's Flask Frame** (rank 3) | +1 | 14 |
| **Kindled Echo bonus** (all 5 alive at Act III) | +1 | **15** |
| **Warrior of Sunlight rank 3** | +1 (co-op only) | 16 in co-op |

**Reinforcement (healing amount) — Ember Fragments:**

| Level | Material | Souls | HP restored | FP restored (Ashen) | Total materials to max |
|---|---|---|---|---|---|
| +0 | — | — | **300** | 60 | — |
| +1 | Ember Fragment ×1 | 900 | 350 | 70 | 1 |
| +2 | ×2 | 1,500 | 400 | 80 | 3 |
| +3 | ×3 | 2,400 | 455 | 90 | 6 |
| +4 | ×4 | 3,600 | 510 | 100 | 10 |
| +5 | ×5 | 5,200 | 570 | 112 | 15 |
| +6 | ×6 | 7,200 | 635 | 124 | 21 |
| +7 | ×7 | 9,800 | 700 | 136 | 28 |
| +8 | Ember Fragment ×8 + **Soul Slag** ×1 | 13,000 | 770 | 150 | 36 + 1 Slag |
| +9 | ×9 + Slag ×1 | 17,000 | 840 | 164 | 45 + 2 |
| +10 | ×10 + Slag ×2 | 22,000 | **890** | 178 | 55 + 4 |
| +11 | ×12 + Slag ×3 + **Ascetic A3 in any region** | 30,000 | **960** | 192 | 67 + 7 + an Ascetic |

> **+11 requires a rank-3 Ascetic.** This is the game's clearest statement that difficulty is *optional content*: the strongest heal in the game is gated behind voluntarily making a region harder. There are 47 Ember Fragments in NG (so +10 is achievable without Ascetics) and 67 available if you Ascetic four regions to A2. **The max flask is a challenge-reward, not a completion-reward.**

### 7.1.2 The Shared Flask Allocation Pool

At any bonfire, the player distributes **FLASK POINTS** between two flasks:

```
FLASK_POINTS = total_charges (max 15, or 16 in Sunlight co-op)
  Estus Flask      : 1 point  per charge  → restores HP
  Ashen Estus Flask: 2 points per charge  → restores FP
```

| Configuration | Estus (HP) | Ashen (FP) | Points used | Who this is for |
|---|---|---|---|---|
| **Pure Estus** | 15 | 0 | 15 | Build C (zero magic), pure melee |
| **Knight's split** | 11 | 2 | 15 | Build A (5 slots, 154 FP, needs ~2 FP refills) |
| **Caster's split** | 7 | 4 | 15 | Build B (7 slots, 218 FP, 4 refills = 872 FP total) |
| **Art-purist** | 5 | 5 | 15 | Ashen-infusion builds (§2.4.3) |
| **Hexer max** | 3 | 6 | 15 | Resonance-chain builds that never stop casting |

**Design intent.** This is the DS3 allocation system, retained exactly, because it is one of the best decisions in the series: it converts a *stat* (Attunement) into a *per-area tactical choice*. A player entering a boss fight can re-allocate on the arena-side bonfire. **The allocation is free and instant, and it is the game's most-used menu.**

### 7.1.3 LIFE GEMS (the slow, mobile, attritional heal)

The DS2 import. Life Gems are **consumables** — used once, gone forever — but they heal *while you keep fighting*.

| Property | Value |
|---|---|
| **Type** | Consumable. Crafted (3 for 300 souls at Vhenn), dropped, found |
| **Use time** | **34f** to apply (0.57 s) — faster than Estus |
| **Heal duration** | **13.5 s** (HoT tick every 27f = 30 ticks) |
| **Movement during use** | **CAN walk, run, sprint, guard, attack, and roll.** Full mobility |
| **Interruption** | **Cannot be interrupted.** Once applied, the heal runs to completion |
| **Stacking** | **Cannot stack.** Applying a second gem while one is active wastes it |
| **Diminishing returns** | −6% heal per gem used since last bonfire rest, floor **40%** |
| **Carry limit** | **12** (increased to 16 by the *Apothecary's Satchel* ring) |

**Life Gem variants:**

| Item | Heal total | Ticks | Duration | Notes |
|---|---|---|---|---|
| **Life Gem** | 360 | 30 × 12 | 13.5 s | Baseline. 300 souls to craft |
| **Radiant Life Gem** | 540 | 30 × 18 | 13.5 s | 900 souls to craft; found in Act II+ |
| **Divine Blessing** | 780 + cures all status | 30 × 26 | 13.5 s | Rare; 3 in NG; Vhenn cannot craft it |
| **Hexwife's Black Gem** | 420 + applies Toxic to self (8 s) | 30 × 14 | 13.5 s | **The hexer's heal: it always costs something** (§4.6.5) |
| **Ashen Gem** | 240 HP + 60 FP | 30 × 8 HP | 13.5 s | Hybrid; 600 souls to craft; the caster's Life Gem |
| **Ember Gem** | 300 + cures Frost/Burn | 30 × 10 | 13.5 s | Ember Keep regional drop |

**Diminishing returns table (Build A, 15 Estus / 0 Ashen, Life Gem 360 base):**

| Gems used since rest | Multiplier | Heal per gem | Cumulative healed |
|---|---|---|---|
| 1 | ×1.00 | 360 | 360 |
| 2 | ×0.94 | 338 | 698 |
| 3 | ×0.88 | 317 | 1,015 |
| 4 | ×0.82 | 295 | 1,310 |
| 6 | ×0.70 | 252 | 1,814 |
| 8 | ×0.58 | 209 | 2,232 |
| 10 | ×0.46 | 166 | 2,564 |
| **12 (max)** | **×0.40** | **144** | **2,824** |

### 7.1.4 The Balance Contract — Estus vs. Life Gem

This is the most important table in the volume. It defines the dual-healing economy.

| | **Estus** | **Life Gem** |
|---|---|---|
| Heal per use | 300–960 (scaling with investment) | 144–360 (decaying with use) |
| Total heal per rest (fully invested) | 15 × 960 = **14,400** | 12 × 2,824 = **2,824** |
| Time to full heal | 0.85 s (committed) | 13.5 s (mobile) |
| Vulnerable during use | **Yes, entirely** | **No** |
| Interruptible | Yes (charge wasted) | No |
| Input-read by bosses | **Yes, all 22** | No |
| Consumed permanently | No | **Yes** |
| Rechargeable | At any bonfire | Never |
| Cost | Free (a bonfire resource) | 300 souls each, or found |
| **Correct use case** | Between fights; after creating distance; at a boss's RECOVER state | **During** fights; during chases; during a boss's transition; as a bridge to the next safe Estus window |

**The rule the balance team tunes to:**

> **Estus is 5.1× the total healing per rest. Life Gems are 100% usable during combat.**
> A player who uses only Estus has 14,400 healing and 0.85-second windows of total vulnerability, fifteen times.
> A player who uses only Life Gems has 2,824 healing and zero vulnerability.
> **A player who uses both correctly has roughly 11,000 healing and near-zero vulnerability.**
> That is the entire design of the dual system: **the optimum is a mix, and the mix is a skill.**

### 7.1.5 Healing Balance Targets

| Metric | Target | Measured (Build A, NG, all bosses) |
|---|---|---|
| Full heals per boss attempt | 4–7 | **5.2** (Estus) + 1.8 gem-equivalents = 6.1 |
| Deaths per boss, median | 2.4 | 2.4 ✔ |
| % of Estus uses interrupted by bosses | 8–14% | 11% ✔ |
| % of total healing from Life Gems | 18–28% | **23%** ✔ |
| Soul cost of a full gem restock | ≤ 3,600 | 3,600 ✔ |
| Gem carry at final boss, median | 6–9 | 7 ✔ |

**Anti-pattern guard:** if telemetry shows >45% of healing coming from Life Gems in any region, that region's enemy aggression is too high and the *enemy* is retuned — **never the gems.** Life Gems are the player's safety valve; if the valve is doing all the work, the pressure is wrong.

---

## 7.2 — Other Consumables & The Full Recovery Economy

| Item | Effect | Cost | Carry | Notes |
|---|---|---|---|---|
| **Estus Flask** | HP (see 7.1.1) | free | 15 charges | |
| **Ashen Estus** | FP | free | allocation-shared | |
| **Life Gem** | 360 HP over 13.5 s | 300 | 12 | |
| **Radiant Life Gem** | 540 HP | 900 | 12 (shared) | |
| **Divine Blessing** | 780 HP + cure all | found | 12 (shared) | |
| **Homeward Bone** | Warp to last bonfire | 300 | 99 | The panic button. Never removed |
| **Purge Stone** | Hollowing → 0 (Sigils remain) | 3,000 | 20 | Also cures Curse |
| **Human Effigy** | Reverse hollowing (−10 Hollowing); enables co-op ignition | 800 | 30 | DS2 import; the multiplayer gate |
| **White Sign Soapstone** | Place co-op sign | item | — | Vol. 8 |
| **Bleeding Serum / Purple Moss / Blooming Moss** | Cure Bleed / Poison / Toxic | 400 / 500 / 1,200 | 20 each | |
| **Warmth Stone** | Cure Frost | 600 | 20 | |
| **Pilgrim's Salt** | Cure Hollow-Blight | 900 | 20 | The hexer counter |
| **Sacred Chalice** | Cure all + 400 HP | 4,000 | 10 | |
| **Ember Powder** | +15% fire damage, 60 s | 500 | 20 | Cheap buff consumable |
| **Rotten Resin** | +20% dark damage, 60 s | 900 | 20 | |
| **Gold Pine Resin** | +25% lightning damage, 60 s | 800 | 20 | |
| **Charcoal Pine Resin** | +25% fire damage, 60 s | 800 | 20 | |
| **Pale Pine Resin** | +25% magic damage, 60 s | 800 | 20 | |
| **Poison/Toxic/Bleed Resin** | Applies that status to weapon, 60 s | 700–1,400 | 20 | |
| **Alluring Skull** | Draws enemy aggro | 200 | 30 | |
| **Repair Powder** | Restores 20% durability | 400 | 30 | *Repair* sorcery is better if you have INT 12 |
| **Hidden Blessing** | Removes a bloodstain's decay timer | 5,000 | 3 | The mercy item (§7.3) |

**Durability.** Equipment durability returns (DS2), reduced in scope: weapons and shields only, at **0.35% per hit landed / 1.1% per hit blocked / 4% per Grade-5 impact**. A standard Longsword has 120 durability and lasts ~340 hits. **Broken equipment does not vanish** — it deals 35% damage and cannot use Weapon Arts until repaired. No boss fight can break a fully-repaired weapon. *Rationale: durability exists to make Repair a real spell and to give the Artificer class an identity; it must never be a punishment for playing.*

---

## 7.3 — Death Economy & The Bloodstain Mercy

| Rule | Spec |
|---|---|
| Souls dropped on death | **100%** of carried souls |
| Embers dropped | **5%** (rounded down) — Embers are the *safe* currency (Vol. 0 §A.4) |
| Recovery | Touch the bloodstain. One recovery attempt. Dying again consumes the prior stain |
| Stain persistence | Until the next death, or until the save is closed (**stains persist across sessions** — DS1 rule, retained) |
| Hollowing on death | `+2 × (1 + SigilCount)` |
| Dark Sigil on death | +1 if the player never damaged the killer; +1 if in an Ascetic region; else 0 |
| Convergence Clock on death | +1 in that region |
| **The Mercy Item** | **Hidden Blessing** (5,000 souls, max 3 carried, 2 in NG): removes the "second death consumes it" rule for **one** bloodstain. This is the game's only anti-frustration item and it is expensive on purpose |
| **Offline mercy** | If a player dies 3× to the same boss in one session, the *next* bloodstain is marked **persistent** (survives one additional death). Once per boss per playthrough. Not communicated. |

> **Design note on the offline mercy.** This is the only place in the entire game where the difficulty adapts to the player, and it is invisible, one-shot, and per-boss. It exists because the single most common quit-point in Souls-likes is the third consecutive death with a large soul load — and because a game that never bends breaks players rather than teaching them. It bends exactly once.

---

## 7.4 — BONFIRE ASCETICS

### 7.4.1 The Concept

**Bonfire Ascetics** are the DS2 mechanic, restored, expanded, and made the game's central *optional* difficulty system. An Ascetic is a consumable that you **burn at a bonfire** to shift that bonfire's entire region into a higher local New Game+ rank.

The fiction: an Ascetic is a compressed knot of Convergence — a piece of the world's own decay, distilled. Burning it at a bonfire **feeds the bonfire more than it should**, and the region around it advances further toward collapse. You are not making the game harder. **You are accelerating the apocalypse in one place, on purpose, to see what falls out.**

### 7.4.2 The Ascetic Item

| Property | Value |
|---|---|
| **Item** | *Bonfire Ascetic* — a fist-sized knot of grey fibre that is warm and slightly damp |
| **Weight / stack** | 0.0 · stack limit 9 |
| **Use** | **Burn at a bonfire** (menu → Bonfire → *Burn Ascetic*) or at the Sanctuary's Ascetic Kiln (which can target any visited region) |
| **Requirement** | The region's boss must be dead. You cannot Ascetic a region you have not finished |
| **Irreversibility** | **Permanent for the playthrough**, except via *Ashen Absolution* (§7.4.7) |
| **Sources (NG)** | Guaranteed boss drop ×1 (22 bosses) · World placements ×14 · Vhenn crafts 1 per rank he reaches (4) · Darkwraith rank 2 reward ×2 · Ascetic Kiln conversion: 1 per 3 boss souls surrendered |
| **Total available in NG** | **47** |
| **Total available NG+7** | ~200 (bosses respawn and re-drop) |

### 7.4.3 Rank Ladder & Costs

| Rank | Name | Cost to burn | Requires | Enemy HP | Enemy dmg | Enemy poise dmg | Souls | Item discovery | New content |
|---|---|---|---|---|---|---|---|---|---|
| **A0** | — | — | — | ×1.00 | ×1.00 | ×1.00 | ×1.00 | 100 | Base game |
| **A1** | *Kindled* | Ascetic ×1 | Region boss dead | ×1.25 | ×1.12 | ×1.08 | ×1.40 | 130 | Boss respawns at A1; +2 enemy spawns per zone |
| **A2** | *Ascendant* | Ascetic ×2 + Ember of Ash ×1 | A1 complete, boss dead again | ×1.56 | ×1.25 | ×1.17 | ×1.96 | 170 | Boss gains **+2 new moves**; new elite enemy variant; 1 new item in the loot table |
| **A3** | *Converged* | Ascetic ×3 + Want Shard ×1 | A2 complete | ×1.95 | ×1.40 | ×1.26 | ×2.74 | 220 | Boss gains a **new phase behavior**; **region biome variant swap** (Convergence Clock 75+, §5.8); 2 new items; **covenant rank 3 unlocks** |
| **A4** | *Collapsed* | Ascetic ×4 + Ember ×2 + **Vhenn's Binding** | A3 complete, Vhenn rank 4 | ×2.44 | ×1.57 | ×1.36 | ×3.84 | 290 | **Boss "Echo" variant** (a different boss using the same arena — 14 authored Echoes); 3 exclusive items; **Estus +11 unlock condition** |

**Stacking with global NG+:** Ascetic ranks **multiply** with the global cycle multiplier (Vol. 0 §A.7).

| | NG | NG+1 | NG+2 | NG+3 |
|---|---|---|---|---|
| **A0** | ×1.00 HP | ×1.55 | ×1.95 | ×2.30 |
| **A2** | ×1.56 | ×2.42 | ×3.04 | ×3.59 |
| **A4** | ×2.44 | ×3.78 | ×4.76 | ×5.61 |

> **NG+3 / A4 is the game's ceiling:** enemy HP at 5.61×, damage at 2.36×. This is the "impossible" content, and it is entirely opt-in per region. A player can be NG+3 and leave four regions at A0 to keep them farmable.

### 7.4.4 What An Ascetic Actually Changes (full effect list)

| Category | A1 | A2 | A3 | A4 |
|---|---|---|---|---|
| **Enemy stats** | +25% HP / +12% dmg / +8% poise dmg | cumulative | cumulative | cumulative (×2.44 HP total) |
| **Enemy aggression** | Attack chains +1; recovery frames −10% | +2 chains; −15% recovery; chase speed +8% | +3 chains; −20% recovery; **input-read reaction delay −4f** | +4; −25%; **−8f reaction; bosses use unblockables 30% more often** |
| **Enemy spawns** | +2 per zone | +2 more, and 1 elite | +2 more, elites ×2 | **All Swarm archetypes become Duelist archetypes** (the region's trash becomes dangerous) |
| **Boss** | Respawns, same moveset, +25% HP | Respawns with **+2 authored moves** | Respawns with **new phase behavior** | **Replaced by its Echo variant** |
| **Loot** | +40% souls; discovery 130 | +96% souls; discovery 170; 1 new item | +174% souls; discovery 220; 2 new items; **infusion stones ×2** | +284% souls; discovery 290; **3 exclusive items**; **Ring +3 tier** |
| **World state** | Convergence Clock +8 | +8 more | **+8 more, biome variant swap** | **+8 more, region permanently COLLAPSED** |
| **NPCs** | Dialogue changes | 1 NPC leaves the region | **1 NPC's questline branch locks permanently** | The region's NPCs are gone |
| **Multiplayer** | Region's co-op SL range widens +10 | +20 | +30, and **invaders may enter at A-rank stats** | +40, **Darkwraith invasions become guaranteed** |
| **Covenants** | — | — | **Rank 3 unlocks in this region's covenant** | Covenant-specific A4 reward |
| **Bonfire** | Visual: the flame burns 20% higher and grey | 40% higher, ash falls from it | 60%, the flame is **black with a red rim** | 80%, **the bonfire screams** (an audio asset used nowhere else) |

### 7.4.5 Boss Echo Variants (A4 exclusive)

At A4, the region's boss is replaced by an **Echo** — a different character fighting in the same arena with a new moveset. 14 are authored.

| Region | Normal boss | **A4 Echo** | Design change |
|---|---|---|---|
| R01 | Ashen Baron | **The Baron's Widow** | Duelist archetype, dual daggers, 2.4× speed, 0.6× HP. The tutorial region becomes a knife fight |
| R03 | The Nameless Grave | **The Name Itself** | A caster. Uses your own attuned spells. 0.4× HP |
| R04 | Vharos | **The Door** | Vharos is gone. You fight the bricked-up doorway, which is a **stationary** boss with 14 attacks in a 200° arc. 3.2× HP |
| R05 | Karrag | **The Dragon, Briefly** | The ribcage wakes. Arena is the whole keep. 4× HP, 8-minute fight |
| R06 | The Winter Queen | **The Thaw** | A liquid boss. No hitbox you can see; you fight the rising water |
| R07 | Remnant of the Old Dragons | **The Whole Dragon** | All three pieces reassembled. The largest boss in the game (34 m) |
| R08 | The Rotmother | **The Seed** | Tiny, fast, 0.2× HP, but summons 40 Swarm units |
| R09 | Sentinel Commander Aurel | **The Door's Defender** | The Last Defender, now killable, now Grade 5 |
| R10 | The Forge Warden | **What Was Forged** | A weapon. It has no body; it is a floating greatsword with 11 moves |
| R11 | King of Grey Kings | **The Forty-First** | All 41 kings at once, 12 alive at any moment |
| R12 | The Beached Leviathan | **The Sea, Returned** | The water comes back. You fight underwater |
| R13 | Abyss Watcher Echo | **The First Ashen Hollow** | Your character, at your exact build, ×3.1 stats. **It has your face and your kit** |
| R14 | *(final boss — no Echo)* | — | **The final boss never Echoes.** A4 in R14 instead applies +2.44× stats to all four phases |
| R02 | *(hub — no boss)* | — | **The Sanctuary cannot be Ascetic'd at all.** It is the one safe place and it stays safe |

### 7.4.6 The Ascetic Decision Space

The system's design value is that it creates **48 real decisions** (14 regions × up to 4 ranks, minus the 2 un-Ascetic-able), each with a cost and a specific reward. Reference decision table:

| Player goal | Optimal Ascetic strategy | Why |
|---|---|---|
| Max Estus (+11) | A3 in **one** region | Cheapest path to the unlock condition |
| Max souls / fast leveling | A2 in R03 (Grave of Names — highest enemy density) | 11,000 headstones × ×1.96 souls = the game's best farm |
| Covenant rank 3 (needed for hidden ending) | A3 in **two** regions with the target covenants | Rank 3 is A3-gated (§8.5) |
| Best infusion stones | A3+ in R10 (Iron Eclipse Foundry) | Stones only drop at A3+ there |
| All 34 boss weapons | A4 in all 13 boss regions | Echo bosses drop unique tokens |
| Hidden ending | A3 in R07 (Dragon Shrine, for the crown-horn severance at higher HP) + rank 3 in 2 covenants | Conditions 2 & 4 |
| Speedrun | **Zero Ascetics** | They are pure cost |
| Completionist / achievement | All 14 to A4 | The *Collapsed World* achievement |
| New player, first run | **Zero** — the game will offer one at R04's boss and the player should decline | Ascetics are Act III content in disguise |

### 7.4.7 Descent & Safety Valves

| Item / Rule | Effect | Availability |
|---|---|---|
| **Ashen Absolution** | Removes **one** Ascetic rank from one region | 1 per playthrough; from Ysolde after the R11 boss |
| **NG+ reset** | Ascetic ranks **persist into NG+** and stack with the cycle multiplier. They never reset | — |
| **New character** | A new save slot starts at A0 everywhere | The real reset |
| **Sanctuary** | Cannot be Ascetic'd | Permanent |
| **R14 Convergence** | Can be Ascetic'd to A3 but not A4 | The final boss never Echoes |
| **UI warning** | Burning an Ascetic shows a **two-stage confirmation**: first *"The world will not recover from this. Region: Sunken Cathedral. Rank: A3. Continue?"*, then a 3-second hold-to-confirm | Vol. 9 §9.8 |

---

## 7.5 — The Convergence Clock (World Decay Progression)

Full spec in §5.8. Progression-side summary:

```
The Clock is the ONLY progression system in the game the player cannot opt out of.
   +1 per death        (you cannot stop dying)
   +3 per boss killed  (you cannot progress without killing)
   +8 per Ascetic rank (you choose this)
   +1 per 30 min       (you cannot stop time)
   −5 per severance    (you CAN slow it — this is the reward for the DS1 import)
   −10 per Echo escorted (you CAN slow it — this is the reward for NPC loyalty)
```

**Progression consequence:** by the time a completionist reaches R14, most regions are at Clock 50–74 (**BLEEDING**) — dead enemies respawn without resting, and the ambient audio has a second layer. This is why the late game *feels* like the world is ending: it is, measurably, and the player caused it by succeeding.

**The Clock is the reason severance matters beyond loot.** 31 parts × −5 = −155 Clock across the world. A player who severs everything leaves a world roughly 15% less decayed than one who does not. **The tail-cut system is a world-repair mechanic.** Nobody is told this. Everybody feels it.

---

## 7.6 — Crafting, Upgrading & Transposition

### 7.6.1 Vhenn, the Ash-Smith — Service Table

| Service | Cost | Unlocks at | Notes |
|---|---|---|---|
| **Weapon upgrade (Standard)** | Titanite + souls (see 7.6.2) | Immediately | +0 → +10 |
| **Weapon upgrade (Ashen)** | Ember of Ash + souls | Vhenn rank 1 | +0 → +5 (boss weapons) |
| **Weapon upgrade (Drake)** | Dragon Scale | Vhenn rank 1 | +0 → +5 |
| **Weapon upgrade (Twinkling)** | Want Shard | Vhenn rank 2 | +0 → +5 |
| **Infusion** | Infusion Stone + 800–6,000 souls | Vhenn rank 1 (7 infusions), rank 2 (+6), rank 3 (+3), rank 4 (+1 Ashen) | §2.4.3. **Reversible; the stone is not returned** |
| **Transposition** | Boss soul + Ember of Ash + souls | Vhenn rank 2 | Converts boss souls and **Severance Tokens** into unique weapons |
| **Life Gem crafting** | 300 souls → 3 Life Gems | Vhenn rank 1 | Also Radiant (900), Ashen (600), Ember (700) |
| **Ascetic binding** | Ember ×2 + Want Shard | Vhenn rank 3 | Crafts *Vhenn's Binding* — required for A4 |
| **Flask Frame** | Ember Fragment ×20 | Vhenn rank 3 | +1 Flask charge permanently |
| **The one respec** | 0 souls | Vhenn rank 4 + all 5 Echoes alive | *Ashen Effigy of Regret* — once per playthrough |
| **The Ashen Brand** | Ouroboros Spine token + Ember ×6 + Want ×4 + all 5 Echoes alive | Vhenn rank 4 | **Hidden ending item** |

**Vhenn's rank ladder:** rank 1 (meet him) → rank 2 (give him 3 boss souls) → rank 3 (give him 6 boss souls + 4 Embers) → rank 4 (give him 10 boss souls + complete R10 + all 5 Echoes alive). **Vhenn is the single most progression-critical NPC in the game** and his rank gates 17 infusions, transposition, the +1 flask, the A4 rank, the respec, and the hidden ending. QA must verify he cannot be soft-locked (fallback: if Vhenn dies, Ysolde inherits ranks 1–3 only).

### 7.6.2 Upgrade Material Economy

| Material | NG total | Needed for | Surplus |
|---|---|---|---|
| Titanite Shard | 118 | 60 (one weapon to +6) | +58 |
| Large Titanite | 46 | 30 (one weapon to +8) | +16 |
| Titanite Chunk | 14 | 12 (one weapon to +9) | +2 |
| **Titanite Slab** | **8** | 7 (one weapon to +10) | **+1** |
| Ember of Ash | 61 | ~34 for full infusion + Art ranks | +27 |
| Want Shard | 39 | ~26 for dark/hollow/blood infusions | +13 |
| Ember Fragment | 47 | 55 for Estus +10 | **−8** (requires Ascetics) |
| Soul Slag | 7 | 7 for Estus +10/+11 | 0 |
| Dragon Scale | 22 | 15 (three Drake weapons to +5) | +7 |
| Infusion Stones (14 types) | 3–9 each | 1 per infusion | Varies; **Chaos and Crystal stones are the tightest at 3** |

> **The Titanite Slab economy is the tightest in the game: 8 available, 7 needed for one +10 weapon.** A player who wants two +10 weapons must Ascetic. This is intentional and it is the game's quietest difficulty gate: **the second fully-upgraded weapon is challenge content.**

### 7.6.3 Transposition Table (selected)

| Input | Output | Additional cost |
|---|---|---|
| Soul of Vharos | **Warden's Harpoon** (Spear, STR 24/DEX 20, AR 318, Art: *Harpoon Throw*) | Ember ×1 + 5,000 |
| Warden's Anchor Token *(severance #4)* | **Warden's Anchor** (Great Hammer, STR 40, AR 372, Art: *Anchor Drop*) | Ember ×2 + 8,000 |
| Warden's Fin Token *(#6)* | **Warden's Fin** (Dagger, DEX 14, AR 168) | Ember ×1 + 4,000 |
| Soul of Karrag | **Ember Sovereign's Greatsword** (Greatsword, STR 34, AR 386, Fire) | Ember ×2 + 9,000 |
| Furnace Flue Token *(#7)* | **Ember Sovereign's Hammer** (Great Hammer, STR 46, AR 402) | Ember ×3 + 12,000 |
| Sovereign's Core Token *(#9)* | **Molten Core Ring** | Want ×2 + 6,000 |
| Remnant Tail Token *(#12)* | **Dragon Remnant Tail** (Reaper, STR 36, AR 344, Drake path) | Dragon Scale ×3 + 10,000 |
| Crown-Horn Token *(#15)* | **Ouroboros Spine** (Whip-Sword, DEX 30, AR 288) | Ember ×4 + 14,000 |
| Soul of Nihilanthos | **Nihilanthos's Three Crowns** (head, 24 poise, +15% all absorb, **−1 spell slot**) | Ember ×6 + 40,000 |
| Soul of Nihilanthos *(alt)* | **Want Incarnate Chime** (catalyst, Spell Buff 298, Hex+Miracle) | Want ×6 + 40,000 |
| **Severance** *(#24)* | ***Not transposable.*** It is the ending | — |

---

## 7.7 — Rings

96 rings. Four slots. **Rings never modify base attributes** (§2.1.2). Full categorization:

| Category | Count | Examples |
|---|---|---|
| **Derived-stat** | 22 | Ring of Favor (+8% HP/STA/load), Ring of the Evil Eye (+18% HP / −8% STA regen), Ring of Steel Protection (+12–16% phys absorb) |
| **Poise / defense** | 14 | Ring of Blades (+4/+6/+8 poise), Havel's Ring (+8/+12/+15% load), Ashen Ward (+18% fire absorb) |
| **Damage amplification** | 18 | Ring of Flames (+12% fire), Dark Clutch (+12% dark / **−10% taken**), Fly Ring (+12% phys / −15% stamina max) |
| **Regen / sustain** | 12 | Chloranthy (+20/+25/+30% STA regen), Green Turtle (+35% regen / −20% move), Blessed Ring (0.2%/s HP) |
| **Casting** | 9 | Sage Ring (−8% cast time), Deep Ring (+2 Hex uses), Ring of Focus (+30 FP) |
| **Utility / economy** | 11 | Covetous Gold Serpent (+110/+140/+170 discovery), Slumbering Dragoncrest (−40% fall damage), Ring of Whispers (silent footsteps) |
| **Covenant** | 5 | One per covenant; occupying a slot is the cost of membership |
| **Ascetic-exclusive (A3/A4)** | 12 | +3 tiers of the above; 4 unique to A4 (Ring of Collapse: +30% damage in COLLAPSED regions / −20% max HP) |
| **Ending-reward** | 5 | Vendrick's Patience, Cinderbrand Sigil, Abyssal Crown *(head, not ring)*, Warden's Fourth Eye, Ouroboros Loop |

**Balance rule:** no ring may grant more than **+20% to any single derived stat**, and every amplification ring must carry a cost. The 12 amplification rings with no downside are all ≤+8%.

---

## 7.8 — NPC & Questline Progression

| System | Spec |
|---|---|
| **Questline count** | 29 NPCs, 5 of them Kindled Echoes |
| **Tracking** | **No quest log.** Ever. Tracked via: the Refectory seating (§5.3.5), NPC dialogue state, and the **Sigil Board / Echo Board** in the character menu (§9.6) |
| **Failure** | 14 questlines can fail permanently. **All 14 are announced** by a world event (a bell, a darkening, an ashfall) — Vol. 1 §1.4.3 rule |
| **Recovery** | 9 of 14 have a recovery path via a second NPC. 5 are hard-fail |
| **Order dependence** | 6 questlines are order-dependent across regions. The Refectory priority function (§5.3.5) surfaces the urgent ones |
| **Killable** | All 29 are killable. Killing an Echo is a deliberate act with an announced consequence |
| **Gestures** | 34 gestures: 12 from NPCs, 8 from covenants, 6 from bosses (learned by watching them), 5 from achievements, 3 hidden. ***Sever*** is a hidden-ending foreshadow (Dragon Remnants rank 2) |

---

## 7.9 — New Game+ Progression

| Property | Spec |
|---|---|
| Cycle cap | NG+7 (8 total playthroughs) |
| Carry-over | Level, stats, inventory, weapons, armor, spells, rings, gestures, covenant rank, **Ascetic ranks**, endings seen, Hollowing, **Dark Sigils** |
| Reset | World state, boss kills, NPC questlines, severance parts, Convergence Clock, Estus shards collected, items picked up |
| Persisting severance | **Boss parts regrow in NG+** — but a player who severed a part in NG has that weapon forever |
| New content per cycle | NG+1: +1 ring tier · NG+2: 6 new NPC invasions · NG+3: boss Echo variants available at A0 · NG+4–7: cosmetic (armor recolors, a title, the *Collapsed World* achievement) |
| Multiplayer bracket | NG+ does **not** affect matchmaking (Soul Level + Soul Memory only, Vol. 8) |

---

## 7.10 — Progression Timeline (reference playthrough)

| Hour | SL | Region | Key unlocks | Estus | Healing available |
|---|---|---|---|---|---|
| 0.0 | 10 | R01 | Estus Flask (5 charges, +0 = 300 HP) | 5 | Estus only |
| 1.5 | 16 | R01 → R02 | Hub, Ysolde, level-up | 5 | Estus |
| 3.0 | 24 | R02 | Vhenn (rank 1), infusions ×7, Life Gem crafting | 6 (2 shards) | Estus + 3 gems |
| 6.0 | 34 | R03 | Blue Sentinels, warp unlock (3 bonfires) | 8 | Estus + gems |
| 11.0 | 46 | R04 | **Power Stance unlock** (27/27 req), Greymouthe, Hexes, Resonance rank 1 | 10, +2 (500 HP) | Estus + Radiant gems |
| 18.0 | 60 | R05 | Warriors of Sunlight, **Heart of Want**, Vhenn rank 2 (transposition) | 11, +4 (635 HP) | + Divine Blessing ×1 |
| 26.0 | 72 | R06 | **Ashen Cinder**, Sentinel Plate | 12, +5 (700 HP) | |
| 34.0 | 82 | R07 | Dragon Remnants, crown-horn severance possible, Vhenn rank 3 | 13, +6 (770 HP) | Estus +8 possible |
| 42.0 | 90 | R08/R09/R10 | Forest Guardians, Iron Eclipse set, **Ashen infusion** | 13, +7 (840 HP) | |
| 52.0 | 98 | R11 | **Soul of Memory**, Kaathe, first Dark Sigils offered | 14, +8 (890 HP) | |
| 60.0 | 106 | R12 | Ashen Coast backdoor discovered (retroactively) | 14 | |
| 68.0 | 114 | R13 | Ouroboros revealed, Vessel of Want, **Ashen Brand possible** | 15, +9 (960 HP if A3) | |
| 78.0 | 122 | R14 | Long Stair, three doors, final boss | 15 | Full economy |
| 82.0 | 125 | Ending | — | — | — |

**Balance check:** the player reaches SL125 at hour ~78 with ~2.9 M souls spent (Vol. 2 §2.5.1 target: 2.88 M). ✔ Within 1% of the design target.

---

## 7.11 — Progression Balance Levers

| Knob | Path | Default | Band |
|---|---|---|---|
| Estus base charges | `progression.estus.base` | 5 | 4–6 |
| Estus shard ratio | `progression.estus.shards_per_charge` | 3 | 2–4 |
| Estus +0 heal | `progression.estus.heal_base` | 300 | 260–340 |
| Estus +10 heal | `progression.estus.heal_max` | 890 | 820–960 |
| Flask allocation cost, Ashen | `progression.flask.ashen_cost` | 2 | 2 (locked) |
| Life Gem base heal | `progression.gem.heal` | 360 | 320–400 |
| Gem diminishing step | `progression.gem.dimin_step` | 0.06 | 0.04–0.08 |
| Gem diminishing floor | `progression.gem.dimin_floor` | 0.40 | 0.30–0.50 |
| Gem carry limit | `progression.gem.carry` | 12 | 10–16 |
| Ascetic A1 HP mult | `progression.ascetic.hp[1]` | 1.25 | 1.20–1.30 |
| Ascetic A4 HP mult | `progression.ascetic.hp[4]` | 2.44 | 2.20–2.60 |
| Ascetic A4 dmg mult | `progression.ascetic.dmg[4]` | 1.57 | 1.45–1.70 |
| Ascetic soul mult | `progression.ascetic.souls[]` | [1.40, 1.96, 2.74, 3.84] | ±10% |
| Convergence Clock per death | `world.clock.per_death` | 1 | 0–2 |
| Convergence Clock per severance | `world.clock.per_sever` | −5 | −3 to −8 |
| Slab count in NG | `economy.slab.ng` | 8 | 7–10 (**never >10**) |
| Offline mercy threshold | `progression.mercy.deaths` | 3 | 2–5 |

---

*End of Volume 7. Continue to Volume 8: Covenants & Multiplayer Architecture.*
