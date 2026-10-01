# VOLUME 2 — STAT SYSTEM & BUILD ARCHITECTURE

> **Design owner:** Lead Systems Designer / Build Balance
> **Depends on:** Vol. 0 (A.1 damage formula, A.2 poise model) · **Feeds:** Vol. 3 (combat budgets), Vol. 4 (casting), Vol. 9 (stat screen)

---

## 2.1 — Design Philosophy: Nine Attributes, Three Budgets

The Souls stat screen has always been a lie of omission: it presents ten numbers and implies they are equivalent. They are not. *Convergence* keeps nine attributes, but organizes them explicitly into **three budgets** that the player is always, visibly trading between.

| Budget | Attributes | Question it answers |
|---|---|---|
| **SURVIVAL** | Vigor, Vitality, Adaptability | *How much can I get wrong?* |
| **ACTION** | Endurance, Strength, Dexterity | *How much can I do?* |
| **INTENT** | Attunement, Intelligence, Faith | *What kind of thing am I doing?* |

**The hard rule of the build system:** no attribute may serve two budgets. (In DS3, Attunement granted both FP *and* cast speed, and Vigor granted HP *and* soft-poise — the coupling hid real tradeoffs.) Here, every attribute has exactly one job and one job's worth of caps.

**Level = Σ(all nine attributes) − 90.** A "blank" character has 10 in every attribute and is Soul Level 0. This is the single most important number in the document, because it makes the classic PvP metas (SL125, SL150) exactly arithmetic: **SL125 = 215 total attribute points; SL150 = 240.**

### 2.1.1 The Soft Cap Doctrine

Every attribute uses a **four-breakpoint diminishing-returns curve** at **27 / 40 / 60 / 80**, with a **hard cap at 99**. This unified cadence is deliberate:

- **27** is where the "cheap" gains end — this is the value-for-money floor for off-stats.
- **40** is the commitment threshold — investing to 40 declares an attribute as *yours*.
- **60** is the specialist threshold — past 60 you are paying a premium for identity, not power.
- **80** is the vanity threshold — it exists so that NG+7 min-maxers have somewhere to go and so that the stat screen never looks "finished."
- **99** is a wall. Nothing scales past 99. No item, buff, or ring may raise a *base* attribute above 99 (rings add *derived* stats only — see 2.1.2).

This replaces the DS1 approach (wildly inconsistent per-stat curves) and the DS2 approach (ADP with a hidden 25-frame cliff) with one learnable shape. Players internalize the cadence once and can then evaluate any new build in seconds.

### 2.1.2 The Ring Rule

**Rings never modify base attributes.** They modify *derived* stats, thresholds, or behaviors.

*Rationale:* in DS2/DS3, rings like the Chloranthy Ring and Ring of Blades effectively acted as hidden stat points, which corrupted cap math and made "true" build levels ambiguous. Under this rule, a SL125 character is *always* a SL125 character, and ring choice becomes a horizontal decision (what do I do?) rather than a vertical one (how strong am I?).

| Allowed ring effects | Forbidden ring effects |
|---|---|
| +HP, +FP, +Stamina (flat derived) | +STR, +DEX, +INT, +FTH, +VIG, etc. |
| +Poise, +Equip Load capacity | +Spell slots (slots come only from ATT) |
| +Absorption %, +damage type % | Lowering a soft cap / raising a hard cap |
| Regen rates, roll distance, cast speed | Granting a Weapon Art or Power Stance |

---

## 2.2 — Starting Classes

Ten classes. Each is **flavor-locked to one of the three ages** (Vol. 1 §1.2.1), which is the game's first silent narrative choice — and each has a genuinely different level, so that "which class" and "how much do I want to spend" are the same decision.

| Class | Age | SL | VIG | ATT | END | STR | DEX | VIT | INT | FTH | ADP | HP | FP | STA | Slots | Load cap | Starting kit |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Ashen Hollow** | — (blank slate) | **0** | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 10 | 420 | 70 | 84 | 3 | 52.0 | Rusted Shortsword, Tattered Ash Set, Cracked Red Eye (×1) |
| **Ashen Knight** | Lordran | **10** | 12 | 11 | 11 | 13 | 13 | 11 | 9 | 10 | 10 | 492 | 77 | 86 | 3 | 54.0 | Knight's Longsword, Kite Shield, Ashen Knight Set, Heal (Miracle) |
| **Drowned Sellsword** | Drangleic | **10** | 11 | 12 | 11 | 11 | 12 | 13 | 8 | 8 | 14 | 456 | 84 | 86 | 4 | 58.0 | Sellsword Twinblades, Drowned Mail, Life Gem (×3) |
| **Sanctuary Acolyte** | Lothric | **10** | 9 | 15 | 10 | 9 | 10 | 8 | 12 | 10 | 17 | 384 | 105 | 84 | 4 | 48.0 | Acolyte's Staff, Cleric's Mace, Acolyte Robes, Soul Arrow |
| **Ember Pyromancer** | Lordran/Drangleic | **10** | 10 | 13 | 10 | 10 | 10 | 9 | 12 | 12 | 14 | 420 | 91 | 84 | 4 | 50.0 | Pyromancy Flame, Hand Axe, Ember Set, Fireball, Flash Sweat |
| **Hexwife Initiate** | Drangleic | **10** | 8 | 15 | 9 | 9 | 9 | 10 | 14 | 13 | 13 | 348 | 105 | 82 | 4 | 52.0 | Dark Chime, Dark Hand Blade, Hexwife Rags, Dark Orb, Lifedrain Patch |
| **Remnant Dragonkin** | Lordran | **10** | 14 | 9 | 10 | 14 | 11 | 9 | 8 | 8 | 17 | 564 | 63 | 84 | 3 | 50.0 | Dragon Greatclaw (unusable — STR req 34), Drake Scale Set, Dragonhead Stone |
| **Iron Eclipse Artificer** | Lothric | **10** | 11 | 13 | 10 | 12 | 11 | 11 | 11 | 11 | 10 | 456 | 91 | 84 | 4 | 54.0 | Artificer's Warpick, Cog Shield, Artificer Set, Repair (Sorcery), Ember Powder |
| **Grave Warden** | Drangleic | **10** | 13 | 10 | 11 | 12 | 14 | 10 | 9 | 9 | 12 | 528 | 70 | 86 | 3 | 52.0 | Warden's Twinblade, Warden's Leathers, Grave Key, Life Hunt (Hex) |
| **Ashen Pilgrim** | Lothric | **10** | 7 | 12 | 12 | 8 | 9 | 11 | 11 | 13 | 17 | 312 | 84 | 88 | 4 | 54.0 | Pilgrim's Staff, Short Bow, Pilgrim Rags, Great Heal, Homeward |

**Notes on class balance**

- **Remnant Dragonkin** ships with a weapon it cannot use for ~14 levels. This is intentional: it is the game's "delayed gratification" class and its first real reward is a *feeling*, not an item. The Dragonhead Stone (grants one free Dragon-form charge per bonfire) keeps it viable in the interim.
- **Ashen Pilgrim** is the highest-ADP, lowest-VIG class: a deliberate glass-eel build for players who want DS2 agility with DS3 mobility and are comfortable being killed by anything.
- **Ashen Hollow** at SL0 is the *recommended* class for the hidden ending route (§1.7.4) because its 90 total points leave the most freedom for the covenant-ranking requirement.
- No class starts with a **Shield of Parry** except Ashen Knight. Parrying must be *learned and bought* — it is not a default literacy.

---

## 2.3 — The Nine Attributes, In Full

### 2.3.1 VIGOR (Survival)

| Property | Value |
|---|---|
| **Primary derived stat** | Maximum HP |
| **Secondary** | Bleed/Poison/Toxic resistance (+0.4/point, cap +40 at 99); Frost resistance (+0.3/point) |
| **Does NOT affect** | Poise, defense, roll speed, recovery |

**HP curve:**

| VIG range | HP per point | HP at breakpoint |
|---|---|---|
| 10 → 27 | **+36** | 420 → 1032 |
| 27 → 40 | **+26** | 1032 → 1368 |
| 40 → 60 | **+16** | 1368 → 1688 |
| 60 → 80 | **+7** | 1688 → 1828 |
| 80 → 99 | **+1** | 1828 → 1847 |

**Design note.** The 40-VIG breakpoint (1368 HP) is tuned so that a level-125 character with 34 VIG (1214 HP) survives **exactly two** hits from a reference NG boss's heavy attack (590 each) and dies to a three-hit combo. This is the single most important number in PvE balance: it makes fights about *not getting hit twice*, not about having a big enough bar.

### 2.3.2 ATTUNEMENT (Intent)

| Property | Value |
|---|---|
| **Primary derived stats** | Maximum FP, Spell Slots |
| **Secondary** | +1 Weapon Art rank capacity per 15 ATT (ranks I–IV) |
| **Does NOT affect** | Cast speed (that is ADP + catalyst), spell damage (that is INT/FTH) |

**FP curve:** `10→30: +7/pt (70→210)` · `30→60: +4/pt (210→330)` · `60→99: +2/pt (330→408)`

**Slots:** `Slots = 2 + floor(ATT / 6)`, maximum 10.

| ATT | 6 | 12 | 18 | 24 | 30 | 36 | 42 | 48 | 54 | 60+ |
|---|---|---|---|---|---|---|---|---|---|---|
| Slots | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 10 | 10 |
| FP | 98 | 140 | 182 | 210 | 234 | 258 | 282 | 306 | 330 | 330+ |

**Design note.** ATT is the game's most *honest* stat: it buys nothing but options. A 10-slot caster and a 3-slot caster do the same damage per cast — the difference is how long they can keep making choices before they must retreat. This makes ATT the correct stat for players who want to express identity rather than optimize output.

### 2.3.3 ENDURANCE (Action)

| Property | Value |
|---|---|
| **Primary derived stat** | Maximum Stamina |
| **Secondary** | Stamina regen **+0.4/pt** (stacks with ADP, see below); +0.3 Bleed resist |
| **Does NOT affect** | Equip Load (that is VIT — a deliberate decoupling from DS1/DS3) |

**Stamina curve:** `10→40: +2/pt (84→144)` · `40→60: +1.2/pt (144→168)` · `60→99: +0.5/pt (168→187.5 → displayed 187)`

**Design note — the decoupling.** In DS1/DS3, Endurance granted both Stamina and Equip Load, which forced every heavy-armor build into a stat it did not want and every fast-roll build into a stat it did not need. Here, **END = how often you act, VIT = how much you can wear.** This one change is responsible for more build diversity in *Convergence* than any other single systems decision, because it decouples "tank" from "slow" and "caster" from "fragile."

### 2.3.4 STRENGTH (Action)

| Property | Value |
|---|---|
| **Primary** | Meets weapon requirements; drives STR scaling on Heavy/Refined/Quality weapons |
| **Secondary** | Two-handing grants a **×1.5 effective STR** for requirement checks only (classic rule retained) |
| **Does NOT affect** | Poise damage (that is weapon-specific), stagger resistance |

**Scaling curve (weapon scaling multiplier, applied to the letter-grade coefficient):**

| STR | 10 | 18 | 27 | 40 | 60 | 80 | 99 |
|---|---|---|---|---|---|---|---|
| Multiplier | 0.00 | 0.52 | 0.78 | **1.00** | 1.14 | 1.21 | 1.25 |

> At STR 40 a weapon achieves **100% of its scaling letter value**. Above 40 you are buying the last 25% at roughly 4× the cost per point. This is the "40 is the honest number" rule and applies identically to DEX, INT, and FTH.

**Requirements:** every weapon lists a STR requirement. **Two-handing multiplies effective STR by 1.5** (so a 34-STR greatsword is usable one-handed at 34 STR or two-handed at 23 STR). *Convergence* adds one new rule: **Power Stance multiplies effective STR/DEX by 1.5 for requirement checks as well** (Vol. 3 §3.6) — the DS2 rule, preserved exactly.

### 2.3.5 DEXTERITY (Action)

| Property | Value |
|---|---|
| **Primary** | Meets weapon requirements; drives DEX scaling on Sharp/Refined/Quality weapons |
| **Secondary** | **Cast speed** for Sorceries and Hexes (+0.35 frames faster per point, capped at 40 DEX); Bow/Bolt reload speed; **Fall damage reduction** (−0.8% per point up to 60) |
| **Tertiary** | Bleed buildup on Bleed weapons (+0.5% per point up to 50) |

**Scaling curve:** identical shape to STR (1.00 at 40, 1.25 at 99).

**Design note.** DEX's cast-speed bonus is *capped at 40* and is smaller than ADP's. This prevents the DS1 problem where Dexterity was secretly the best caster stat, while still rewarding the classic battle-mage.

### 2.3.6 VITALITY (Survival)

| Property | Value |
|---|---|
| **Primary derived stat** | Maximum Equip Load |
| **Secondary** | Physical defense (**+0.15/pt**, cap +15 — small by design), +0.2 Poison/Toxic resist |
| **Does NOT affect** | HP, poise, stamina |

**Equip Load curve:**

| VIT | 10 | 27 | 40 | 60 | 99 |
|---|---|---|---|---|---|
| Capacity | 52.0 | 86.0 | 99.0 | 112.0 | 127.6 |
| Per point | +2.0 | +1.0 | +0.65 | +0.40 | — |

**Roll tiers** (full spec in Vol. 3 §3.2):

| Load % | Tier | Roll | i-frames |
|---|---|---|---|
| **< 30%** | Fast Roll | Quick, short recovery | 16f / 34f |
| **30 – <70%** | Mid Roll | Standard | 13f / 38f |
| **70 – <100%** | Fat Roll | Long, committal | 10f / 48f |
| **≥ 100%** | Overburdened | **No roll** — a stagger-step; attacks cost +30% stamina | 0f |

**Design note.** Vitality is the most *political* stat in the game: it is the only attribute that determines whether you can wear the armor you found. The 70% Fat Roll breakpoint is placed so that the heaviest armor set in the game (Iron Eclipse Plate, 76.5 units) requires **VIT 53** to fat-roll and **VIT 99+** to mid-roll — i.e. **it is mathematically impossible to fast-roll in the best armor.** That impossibility is a design pillar: heavy armor must feel like a *decision*, not an upgrade.

### 2.3.7 INTELLIGENCE (Intent)

| Property | Value |
|---|---|
| **Primary** | Sorcery Spell Buff (via catalyst); Hex potency (jointly with FTH) |
| **Secondary** | Magic damage absorption (+0.12/pt, cap +12); unlocks catalysts/talismans by requirement |
| **Does NOT affect** | FP, slots, cast speed |

**Scaling curve:** 1.00 at 40, 1.25 at 99 (same shape as STR/DEX/FTH).

**Soft caps differ by school:**

| School | INT soft-cap behavior |
|---|---|
| Sorceries | Clean 27/40/60 curve. **60 INT is the hard practical cap** — Sorcery Spell Buff gains only +4% from 60→99. |
| Pyromancies | INT contributes at **½ rate** (see FTH). Practical cap 40. |
| Hexes | **Joint INT/FTH scaling: potency = f(min(INT,FTH)) + 0.4·f(\|INT−FTH\|)**. Practical cap 50/50 or 60/40. |

### 2.3.8 FAITH (Intent)

| Property | Value |
|---|---|
| **Primary** | Miracle Spell Buff (via talisman); Hex potency (jointly with INT) |
| **Secondary** | Lightning and Dark absorption (+0.10/pt each, cap +10 each); +0.2% Hollow-Blight resist |
| **Does NOT affect** | HP, FP, slots |

**Scaling curve:** 1.00 at 40, 1.25 at 99.

**Faith's unique property — *Conviction*.** At FTH ≥ 30, Miracles that heal gain **+8% healing**; at ≥ 50, **+15%** and *Tears of Denial*-class miracles gain one additional charge. This is the only attribute in the game with a named threshold behavior, and it exists to give pure-Faith clerics an identity that is not "INT but for lightning."

### 2.3.9 ADAPTABILITY (Survival)

The DS2 import, and the most carefully bounded one. ADP is **not** a god stat. It has exactly four effects, all of them survival-tempo, and it is hard-capped at 40 for gameplay purposes (values above 40 exist on the sheet but do nothing except grant flavor resistances).

| ADP | Agility (derived) | Roll i-frames | Stamina recovery delay | Effect |
|---|---|---|---|---|
| 10 | 88 | 11f (fast) / 9f (mid) / 7f (fat) | 1.30 s | Baseline |
| 15 | 94 | 12f / 10f / 8f | 1.22 s | |
| 19 | 99 | 13f / 11f / 9f | 1.15 s | **Agility 99 milestone** |
| 24 | 105 | 14f / 12f / 10f | 1.08 s | |
| 30 | 112 | 15f / 13f / 11f | 1.00 s | |
| **40** | **120** | **16f / 14f / 12f** | **0.90 s** | **Functional cap** |
| 60 | 128 | 16f / 14f / 12f | 0.88 s | No further i-frame gain |
| 99 | 140 | 16f / 14f / 12f | 0.85 s | No further i-frame gain |

**ADP's four effects, exhaustively:**

1. **Roll i-frames** — as tabled. Maximum gain over baseline: **+5f on a fast roll** (11f → 16f), a 45% increase in invulnerability window. Significant, but not the difference between life and death.
2. **Stamina recovery delay** — the pause after spending stamina before regen resumes. 1.30 s → 0.90 s at cap. This is ADP's *real* power, and it is why it lives in the Survival budget: it determines how quickly you can act again after a mistake.
3. **Item consumption speed** — Estus drinking animation shortens by up to 14% (from 51f to 44f); Life Gem application animation shortens by up to 10%. Capped at ADP 40.
4. **Status resist accrual** — +0.5 per point to Bleed/Poison/Toxic/Frost/Hollow-Blight *resistance build rate* (not the meter size), capped at ADP 40.

**ADP explicitly does NOT affect:** cast speed (that is DEX + catalyst + ATT Weapon Art rank), attack speed, movement speed, Equip Load, poise, or damage.

> **Why the cap?** In DS2, ADP's uncapped i-frame scaling produced builds where 40% of a roll was invulnerable and the correct answer to every attack was "roll through it." Capping i-frames at 16f means the fast roll retains a **18f vulnerable window**, which preserves the read-and-punish core of Souls combat. ADP is a *comfort* stat, not a *solution* stat.

---

## 2.4 — Consolidated Cap Tables

### 2.4.1 Master Soft/Hard Cap Table

| Attribute | Derived | Break 1 | Break 2 | Break 3 | Break 4 | Hard Cap | Practical Meta Value |
|---|---|---|---|---|---|---|---|
| **VIG** | HP | 27 (+36→+26) | 40 (+26→+16) | 60 (+16→+7) | 80 (+7→+1) | 99 (1847 HP) | 34–40 (PvP) · 44–50 (PvE tank) |
| **ATT** | FP, Slots | 30 (FP +7→+4) | 60 (FP +4→+2) | — | — | 99 (408 FP, 10 slots) | 18–24 (melee) · 30–44 (caster) |
| **END** | Stamina | 40 (+2→+1.2) | 60 (+1.2→+0.5) | — | — | 99 (187 STA) | 20–24 |
| **STR** | Weapon scaling | 18 (soft) | **27** | **40** (=1.00×) | 60 (=1.14×) | 99 (=1.25×) | 40 (one-hand) · 27 (two-hand, ×1.5 = 40.5) |
| **DEX** | Weapon scaling, cast speed | 18 | 27 | **40** (=1.00×; cast-speed cap) | 60 | 99 | 40 · casters 20–27 |
| **VIT** | Equip Load | 27 (+2.0→+1.0) | 40 (+1.0→+0.65) | 60 (+0.65→+0.40) | 80 | 99 (127.6 load) | 20 (mid) · 40 (fat) · 53+ (heavy plate) |
| **INT** | Sorcery/Hex potency | 18 | 27 | **40** | **60** (school hard cap for Sorcery) | 99 | 60 (sorcerer) · 50 (hexer) · 20–27 (buff-only) |
| **FTH** | Miracle/Hex potency | 18 | 27 | **40** | **60** | 99 | 60 (cleric) · 50 (hexer) · 30 (Conviction threshold) |
| **ADP** | Agility, i-frames | 15 | 19 (Agility 99) | 30 | **40** (functional cap) | 99 (no effect past 40) | 16–20 (melee) · 24–30 (fast rollers) |

### 2.4.2 Weapon Scaling Letter Coefficients

Applied to the weapon's base AR for the scaling portion: `STAT_BONUS = AR_base × letter_coeff × attribute_multiplier(from 2.3.4 table)`

| Letter | Coefficient | AR at 40-stat, +10 weapon, 200 base |
|---|---|---|
| **S** | 0.90 | 380 |
| **A** | 0.72 | 344 |
| **B** | 0.55 | 310 |
| **C** | 0.40 | 280 |
| **D** | 0.26 | 252 |
| **E** | 0.14 | 228 |
| **—** | 0.00 | 200 |

### 2.4.3 Infusion Matrix

Infusions are applied by **Vhenn, the Ash-Smith** (Vol. 1 §1.4.3) using Infusion Stones. Each infusion **reallocates** the weapon's scaling budget; none adds raw power for free.

| Infusion | Requires | Effect on scaling | Effect on base | Damage type | Notes |
|---|---|---|---|---|---|
| **Raw** | none | Removes ALL stat scaling | **+22% base AR** | Physical | The low-level carry; the "no-stats" build enabler |
| **Refined** | Ember of Ash ×1 | STR & DEX equalized to the *lower* of the two, then **+8% both** | +0% | Physical | The Quality build's answer to split scaling |
| **Heavy** | Ember of Ash ×1 | STR coefficient **+2 letters**, DEX **−3 letters** | −4% | Physical | STR 40 → 60-equivalent on this weapon |
| **Sharp** | Ember of Ash ×1 | DEX **+2 letters**, STR **−3 letters** | −4% | Physical | DEX mirror of Heavy |
| **Quality** | Ember ×2 + Vhenn rank 2 | STR & DEX **+1 letter each**, capped at B | −6% | Physical | The 40/40 build's home |
| **Fire** | Ember of Ash ×2 | Removes STR/DEX scaling; adds **FIRE AR** scaling off *nothing* (flat) | +0% phys, +65% of phys as fire | Physical + Fire | Split damage; strong vs. low-absorb, weak vs. armor |
| **Chaos** | Want Shard ×2 | Fire AR scales with **INT+FTH average** | — | Physical + Fire | Pyromancer's endgame |
| **Lightning** | Ember ×2 | Adds LIGHTNING AR scaling with **FTH** | −8% phys | Physical + Lightning | Faith melee; strongest vs. dragons, weakest vs. stone |
| **Magic** | Ember ×2 | Adds MAGIC AR scaling with **INT** | −8% phys | Physical + Magic | Sorcerer melee |
| **Crystal** | Ember ×3 + Vhenn rank 3 | Magic AR scaling INT **+1 letter**, but the weapon **cannot be repaired normally** (needs Crystal Repair) | −12% phys | Physical + Magic | Highest magic AR in the game, with a maintenance cost |
| **Dark** | Want Shard ×3 | Adds DARK AR scaling with **min(INT,FTH)** | −10% phys | Physical + Dark | The Hexer's melee answer |
| **Blessed** | Ember ×2 | FTH scaling; **passive HP regen 0.4%/s**; **−25% Hollowing accrual on death** | −10% phys | Physical + (heal) | The tank/cleric hybrid's identity infusion |
| **Hollow** | Want Shard ×1 | STR/DEX **−1 letter**; **scales with Hollowing**: at 15+ Hollowing gain +1 letter, at 60+ gain +2 and a bleed proc | −6% | Physical + Bleed | The only infusion that gets *better* as you decay (Vol. 1 §1.5.2) |
| **Poison / Toxic** | Want Shard ×2 | Applies status buildup; −2 letters physical | −10% | Physical + status | Utility/attrition |
| **Blood** | Want Shard ×2 | Bleed buildup **+60%**; −1 letter | −6% | Physical + Bleed | DEX/bleed builds |
| **Ashen** | Ember of Ash ×3, Vhenn rank 4 | Removes all scaling; **Weapon Art FP cost −50%**; +1 Weapon Art rank | +8% base | Physical | The Weapon-Art-purist infusion — a build archetype unto itself |

**Rule:** a weapon holds **one** infusion. Infusion is reversible at Vhenn for 800 souls + the original stone is *not* returned (deliberate friction; infusion is a commitment, not a toggle).

### 2.4.4 Upgrade Paths

| Path | Material | Max | Notes |
|---|---|---|---|
| **Standard** | Titanite Shard → Large → Chunk → Slab | +10 | Baseline |
| **Ashen** | Ember of Ash | +5 | Boss/transposed weapons only; each level is worth ~2 standard |
| **Drake** | Dragon Scale (from Dragon Remnant Shrine / Remnant bosses) | +5 | Non-scaling dragon weapons |
| **Twinkling** | Want Shard | +5 | Unique cursed/hexed weapons |

---

## 2.5 — Level-Up Economy

### 2.5.1 Soul Cost Curve

```
cost(next_level) = floor( 0.021 × SL^3 + 3.10 × SL^2 + 108 × SL + 895 )
```

| From SL | Cost | Cumulative from SL1 |
|---|---|---|
| 1 → 2 | 1,027 | 1,027 |
| 10 → 11 | 2,318 | 12,704 |
| 30 → 31 | 5,927 | 74,318 |
| 50 → 51 | 12,884 | 231,470 |
| 80 → 81 | 28,437 | 706,120 |
| 100 → 101 | 45,213 | 1,392,600 |
| 124 → 125 | 71,406 | 2,884,300 |
| 149 → 150 | 103,780 | 5,113,900 |
| 200 → 201 | 224,900 | 15,872,000 |

**Design intent:** reaching SL125 requires ~2.88 M souls, which is approximately **1.15× the total souls available from all mandatory content in NG** (2.50 M). The remaining ~15% must come from optional areas, repeat farming, or NG+. This is tuned so that a completionist first playthrough lands at SL110–130 naturally, without grinding, and so that "SL125 by the final boss" is achievable but *not* guaranteed.

### 2.5.2 Level-Up Rules

- Levels are only purchased at **bonfires** (never in the field), preserving the bonfire as the sole safe space.
- **No respec is available in NG.** A single **Ashen Effigy of Regret** (one per playthrough, from Vhenn at rank 4, requires all 5 Kindled Echoes alive) permits a full respec at SL cost 0. *Rationale:* one respec per 80 hours is enough to correct a mistake and not enough to make builds meaningless.
- Level-up is instant and cannot be interrupted by damage (the menu is diegetically "the bonfire's memory of you").

---

## 2.6 — Build Archetype Space (40 viable archetypes)

Per Pillar P5, the following archetypes must all be completable through NG+3. This is the QA matrix, not marketing copy.

| # | Archetype | Primary stats | Key mechanic |
|---|---|---|---|
| 1 | Quality Power-Stance Knight | STR 40 / DEX 40 | Power Stance + Quality infusion |
| 2 | Strength Colossus | STR 60+ | Two-hand ×1.5, Heavy infusion, poise |
| 3 | Dexterity Duelist | DEX 60+ | Sharp infusion, fast roll, parry |
| 4 | Heavy Armor Poise Tank | VIT 50+ / STR 40 | True poise grade 2–3, fat roll |
| 5 | Shield Guardian | STR 27 / VIT 40 | 100% physical shield + Weapon Art guard |
| 6 | Greatshield Phalanx | STR 40 / VIT 53 | Greatshield Weapon Art + Blessed infusion |
| 7 | Pure Sorcerer | INT 60 / ATT 36 | Crystal Soul Spear, Magic infusion backup |
| 8 | Battle Sorcerer | INT 40 / DEX 27 | Magic-infused sword + sorcery mix |
| 9 | Pure Cleric | FTH 60 / ATT 36 | Lightning Spear, Conviction heal bonus |
| 10 | Paladin | FTH 40 / STR 40 | Lightning infusion + heal miracles |
| 11 | Blessed Warden | FTH 30 / VIT 53 | Blessed infusion regen tank |
| 12 | Pure Pyromancer | INT 40 / FTH 40 | Chaos infusion, AoE control |
| 13 | Flame Knight | FTH 30 / STR 27 | Power Within + Fire infusion |
| 14 | **Pure Hexer** | INT 60 / FTH 50 | Resonance, Want drain (Build B) |
| 15 | Dark Blade | INT 50 / FTH 50 / DEX 27 | Dark infusion + Dark Weapon buff |
| 16 | Life-Hunt Duelist | INT 40 / FTH 40 / DEX 40 | Lifedrain Patch sustain |
| 17 | Bleed Assassin | DEX 40 / Hollowing 60+ | Hollow/Blood infusion |
| 18 | Toxic Attritioner | INT 27 / FTH 27 | Toxic + Poison stacking |
| 19 | Frost Shatterer | DEX 40 / INT 27 | Frost buildup + physical follow-up |
| 20 | Bow Sniper | DEX 60 | Bow-only, no melee |
| 21 | Crossbow Artificer | DEX 40 / STR 27 | Heavy crossbow + Weapon Art |
| 22 | Greatbow Siege | STR 50 / DEX 20 | Greatbow, arena-control |
| 23 | Catalyst Fist (Sorcery melee) | STR 27 / INT 60 | Beats/Idris staff melee |
| 24 | Chime Knight | STR 40 / FTH 60 | Caitha's Chime one-hand + greatsword |
| 25 | Unarmed Monk | STR 20 / DEX 30 / ADP 40 | Claws/fists, highest roll i-frames |
| 26 | Whip Dancer | DEX 45 | Whip Weapon Arts, spacing |
| 27 | Dual Curved Sword | DEX 40 / STR 27 | Power Stance spin pressure |
| 28 | Dual Greatsword | STR 50 | Power Stance heavy posture-break |
| 29 | Axe/Berserker | STR 50 / END 30 | Weapon Art sustain, no shield |
| 30 | Halberd Reach | STR 40 / DEX 27 | Range control, guard-poke |
| 31 | Spear Phalanx | STR 27 / DEX 27 | Shield + spear, poke-through-guard |
| 32 | Ultra Greatsword | STR 60 (two-hand 40) | Highest per-hit damage |
| 33 | Reaper | STR 40 / DEX 20 | Bleed + sweep coverage |
| 34 | Katana Iai | DEX 45 | Weapon Art counter-draw |
| 35 | Raw Low-Stat Brute | STR 20 / DEX 20, Raw infusion | The "no-stats" challenge build |
| 36 | ADP Eel | ADP 40 / VIG 27 | Maximum i-frames, minimum armor |
| 37 | Ascetic Farmer | VIT 40 / all-round | Optimized for A4 regions |
| 38 | Covenant Hunter (Blue) | STR 40 / FTH 30 | Auto-summon defense build |
| 39 | Invader (Darkwraith) | INT 50 / DEX 40 | Hex + backstab pressure |
| 40 | Severance Specialist | DEX 60 / STR 40 | Optimized part-damage for tail cuts |

---

## 2.7 — REFERENCE BUILD A: Quality Power-Stance Knight (STR/DEX)

### 2.7.1 Identity

The knight who fights with two swords as though they were one weapon. Highest sustained DPS in the game, lowest tolerance for mistakes, and the build that makes **Power Stance** (Vol. 3 §3.6) sing. Starts as **Ashen Knight (SL10)**; finishes at **SL125**.

### 2.7.2 Final Stat Block — Soul Level 125

| Stat | Value | Δ from base | Rationale |
|---|---|---|---|
| **VIG** | **34** | +24 | 1214 HP — survives two 590-dmg boss heavies, dies to three. Exactly the design target. |
| **ATT** | **22** | +12 | 154 FP / 5 slots. Enough for 2 buff spells + 3 utility casts per rest. |
| **END** | **24** | +14 | 112 Stamina. Power Stance R1-R1-R2 chain costs 54; this permits two full chains + a roll. |
| **STR** | **40** | +30 | 1.00× scaling multiplier — the honest number. Longsword (STR 12) and Estoc (STR 11) both trivially met; 1.5× Power Stance req (18) also met. |
| **DEX** | **40** | +30 | 1.00× scaling. Longsword (DEX 12), Estoc (DEX 18). Power Stance req 27 met. |
| **VIT** | **20** | +10 | 72.0 load cap. |
| **INT** | **9** | −1 | Dumped **below base** to free one point — legal, because rings may never raise a base attribute (§2.1.2), so nothing can ever buy it back. **Cost: every Sorcery in the game is locked out** (the lowest requirement in the school is INT 8, and 22 of 34 need INT 14+). This is the honest price of 40/40. |
| **FTH** | **10** | 0 | Base. Only **four** Miracles in the game have a FTH requirement of 10 or lower — *Heal*, *Force*, *Homeward* and *Oath of the Eclipse* — and those four are exactly this build's loadout (§2.7.6). Deliberate: the knight keeps one heal, one knockback, one buff and one way home, and nothing else. |
| **ADP** | **16** | +6 | Agility 95, 13f mid-roll i-frames, 1.18 s stamina delay, −12% item anim. |
| **TOTAL** | **215** | | **SL 125** |

### 2.7.3 Derived Stats

| Derived | Value |
|---|---|
| Max HP | **1214** |
| Max FP | **154** |
| Max Stamina | **112** |
| Spell slots | **5** |
| Equip Load capacity | **72.0** |
| Actual equipment weight | **28.4** (weapons 10.0 + armor 17.0 + rings 1.4) |
| **Load %** | **39.4% → MID ROLL** (13f i-frames, 38f total) |
| Poise | **34** → stagger threshold **88**, mitigation **17%**, **True Poise Grade 1** (absorbs light hits during attacks) |
| Status resist | Bleed 103 · Poison 96 · Toxic 92 · Frost 88 · Hollow-Blight 81 |

### 2.7.4 Equipment

| Slot | Item | Weight | Notes |
|---|---|---|---|
| Right 1 | **Ashen Longsword +10 (Quality)** | 4.0 | AR 268 → 322 w/ Quality at 40/40. Weapon Art: ***Stance: Piercing Sweep*** (12 FP, 42f startup, guard-piercing thrust, poise dmg 32, Grade 3) |
| Right 2 | **Estoc +10 (Sharp)** | 3.5 | AR 251 → 297. Weapon Art: ***Stance: Rising Riposte*** (14 FP, 60% crit bonus on counter-hit) |
| Left 1 | **Lothric Knight Shield** *(spells only)* | 2.5 | **Not equipped in Power Stance** — see below |
| Left 2 | **Empty** | 0 | Power Stance requires the left hand hold a *compatible weapon* |
| Head | **Ashen Knight Helm** | 3.4 | 4 poise |
| Body | **Ashen Knight Armor** | 8.2 | 10 poise |
| Hands | **Ashen Knight Gauntlets** | 2.4 | 3 poise |
| Legs | **Ashen Knight Leggings** | 3.0 | 5 poise (set total **22** + base 12 = **34**; full-set match, so no mixed penalty) |
| Ring 1 | **Ring of Steel Protection +2** | 0.8 | +12% physical absorption |
| Ring 2 | **Chloranthy Ring +2** | 0.4 | +20% stamina regen |
| Ring 3 | **Ring of Blades +2** | 0.2 | +4 poise |
| Ring 4 | **Havel's Ring (Ashen)** | 0.0 | +8% equip load capacity |
| Ammunition | — | — | — |

> **Power Stance note:** to enter Power Stance the player must **two-hand the right weapon while a compatible left weapon is equipped** (Vol. 3 §3.6). The shield therefore lives in a *spells-only* configuration: the knight runs **two swords and no shield**, which is the entire risk profile of the build.

### 2.7.5 Power Stance Configuration

| Pairing | Compatible? | 1.5× Requirement | Met? | Unlocked moveset |
|---|---|---|---|---|
| Longsword (R) + Estoc (L) | ✔ both **Sword** class | STR 18 / DEX 27 | ✔ 40/40 | **Stance: Cross-Draw** — see below |
| Longsword + Longsword | ✔ | STR 18 / DEX 18 | ✔ | **Stance: Twin Sweep** |
| Estoc + Curved Sword | ✔ both Sword | STR 17 / DEX 27 | ✔ | **Stance: Needle Waltz** |

**Stance: Cross-Draw** (the build's signature)
- Input: `L1/LB` while two-handing.
- `L1` → **Cross-Draw Slash**: both blades trace an X; 2 hitboxes at 14f and 22f; AR ×0.72 each (total 1.44×); **poise damage 28 each**, Grade 3; 32 stamina.
- `L2/RT` → **Posture Break**: a committed double thrust; AR ×1.55; **poise damage 74, Grade 4**; 44 stamina; **60f total (22 startup / 6 active / 32 recovery)**. On hit against a target whose poise threshold is exceeded, applies **POSTURE BREAK** (Vol. 3 §3.6.4) → 2.4 s stagger → guaranteed critical for 3.2× damage.

**The loop that defines the build:**
```
R1 → R1 → Cross-Draw (L1) → Posture Break (L2) → critical
costs: 18 + 18 + 32 + 44 = 112 stamina  |  budget: 112  |  = EXACTLY ONE CHAIN
```
This is not an accident. The build is tuned so that a full posture-break chain consumes **precisely all stamina**, meaning a whiffed Posture Break leaves you with zero resources and a 32f recovery. The build's entire skill expression is *"do I commit to the fifth button?"*

### 2.7.6 Spell Loadout (5 slots)

| Slot | Spell | School | Uses | FP | Purpose |
|---|---|---|---|---|---|
| 1 | **Heal** | Miracle (FTH 10 ✔) | 3 | 35 | Emergency self-heal; the build's only sustain |
| 2 | **Magic Weapon** | Sorcery — **blocked** (INT 9) | — | — | *Not available. This is the cost of dumping INT.* |
| 2 | **Oath of the Eclipse** | Miracle (FTH 10 ✔) | 2 | 40 | +12% physical damage for 60 s; +8 poise |
| 3 | **Force** | Miracle (FTH 10 ✔) | 4 | 18 | Knockback panic button; breaks posture at close range |
| 4 | **Homeward** | Miracle (FTH 10 ✔) | 3 | 15 | Fast travel |
| 5 | **Repair** | Sorcery — **blocked** | — | — | Slot intentionally left empty early; filled with **Tears of Denial** (FTH 12) after 2 points of FTH from the *Pilgrim's Blessing* ring if the player chooses to buy it |

**Design note:** the STR/DEX quality build is **deliberately spell-poor**. It has 154 FP and 5 slots but can only access the FTH-10 tier of miracles. This is the honest cost of a 40/40 weapon build, and it is why Build A is not strictly better than Build C despite higher DPS.

### 2.7.7 Leveling Route

| Stage | SL | Priority | Reason |
|---|---|---|---|
| Ashen Barrens → Sanctuary | 10 → 28 | VIG to 20, END to 16 | Survive the tutorial; the first two bosses punish greed, not damage |
| Grave of Names → Sunken Cathedral | 28 → 55 | STR/DEX to 27/27 | Unlock **Power Stance** (req 1.5× = STR 18 / DEX 27 on the Estoc pair) — the build's identity moment, gated at SL55 |
| Sunken → Ember Keep | 55 → 85 | VIG to 27, STR/DEX to 34 | Ember Keep enemies deal 620+ damage; the 27-VIG HP jump (1032) is mandatory |
| Winter's Veil → Dragon Shrine | 85 → 105 | STR/DEX to 40/40, ADP to 16 | The 1.00× scaling plateau; the build's DPS peak |
| Grave of Kings → Convergence | 105 → 125 | VIG to 34, ATT to 22, END to 24, VIT to 20 | Comfort and options |

### 2.7.8 Balance Assessment

| Metric | Value | vs. reference optimum |
|---|---|---|
| Sustained DPS (10 s window, no buffs) | **512** | **0.98×** (reference) |
| Burst DPS (posture-break chain + critical) | **940** | 1.35× |
| Effective HP (HP × absorption × mitigation) | **1684** | 0.86× |
| Boss TTK (Vharos, NG) | 78 s | reference |
| Archetype clear-time spread | **0%** | — (this IS the reference optimum) |
| Skill floor | **High** — no shield, no roll-through-everything, exact stamina accounting | |
| Skill ceiling | **Highest in game** — Posture Break chains can theoretically stun-lock any non-boss | |

---

## 2.8 — REFERENCE BUILD B: Pure Hexer / Dark Caster (INT/FTH)

### 2.8.1 Identity

The DS2 hexer, restored to full power and given the DS3 tempo to use it. A caster who does not shoot projectiles so much as **subtract** from the target: HP, stamina, FP, and the Want meter. Starts as **Hexwife Initiate (SL10)**; finishes at **SL125**.

### 2.8.2 Final Stat Block — Soul Level 125

| Stat | Value | Δ | Rationale |
|---|---|---|---|
| **VIG** | **22** | +12 | 852 HP. Deliberately below the 27 breakpoint — the hexer is *not* meant to trade. Dies to two boss heavies. |
| **ATT** | **30** | +20 | 210 FP, **7 slots**. The single most important stat in the build. |
| **END** | **11** | +1 | 86 Stamina. Enough for 2 fast rolls (2×26) + 1 backstep (22) + 1 cast (12). Casting is FP-bound, not stamina-bound. |
| **STR** | **10** | 0 | Base. Exactly the **Dark Hand Blade** requirement (STR 10) — no headroom, so any heavier backup weapon is out of reach. |
| **DEX** | **12** | +2 | Cast-speed contribution (−4f on Hex casts at 12 DEX); also meets the Idris Staff's handling requirement. |
| **VIT** | **12** | +2 | 56.0 load cap. |
| **INT** | **60** | +50 | **Hex joint-scaling hard cap.** |
| **FTH** | **50** | +40 | **Hex joint-scaling second term.** |
| **ADP** | **10** | 0 | **Base.** The hexer's answer to pressure is *range and drain*, not rolling. Zero ADP is a statement. |
| **TOTAL** | **215** | | **SL 125** |

### 2.8.3 Hex Potency Math (the core of the build)

```
HEX_POTENCY = SPELL_BUFF(catalyst) × [ J(min(INT,FTH)) + 0.40 × J(|INT − FTH|) ]
where J(x) is the standard scaling multiplier: 1.00 at 40, 1.14 at 60, 1.25 at 99

At INT 60 / FTH 50:
  min = 50 → J(50) = 1.070
  |Δ| = 10 → J(10) = 0.000  (below the 18 soft floor, contributes nothing)
  POTENCY = SPELL_BUFF × 1.070

At INT 50 / FTH 50 (the alternative):
  min = 50 → 1.070 ; |Δ| = 0 → 0
  POTENCY = SPELL_BUFF × 1.070   ← IDENTICAL

At INT 60 / FTH 40:
  min = 40 → 1.000 ; |Δ| = 20 → J(20) = 0.586 × 0.40 = 0.234
  POTENCY = SPELL_BUFF × 1.234   ← BETTER
```

> **This is the most important balance discovery in the document.** The DS2 hex formula rewards **asymmetry**, not symmetry. INT 60 / FTH 40 out-damages INT 60 / FTH 50 by 15%. We are *keeping* this property because it makes the hexer a build that must be *thought about* rather than poured into. **Build B's stated 60/50 is therefore the "comfortable" hexer; the optimized hexer is 60 INT / 40 FTH, which frees 10 points for VIG (→ 27, giving 1032 HP) or ADP (→ 20, giving 14f i-frames).** Both variants are documented in the QA matrix; we ship the 60/50 version as the "Pure Hexer" because it is the one that reads as a fantasy.

### 2.8.4 Derived Stats

| Derived | Value |
|---|---|
| Max HP | **852** |
| Max FP | **210** |
| Max Stamina | **86** |
| Spell slots | **7** |
| Equip Load | **14.0 / 56.0 = 25.0% → FAST ROLL** (16f i-frames, 34f total) |
| Poise | **19** → threshold 58, mitigation 9%, **True Poise Grade 0** (never absorbs) |
| Want capacity | **3 + Dark Sigils** |
| Resonance max | **3** (requires Greymouthe rank 3) |

### 2.8.5 Equipment

| Slot | Item | Weight | Notes |
|---|---|---|---|
| Right 1 | **Greymouthe's Dark Chime +5 (Ashen)** | 1.2 | **Spell Buff 236**; catalyst for Hexes and Miracles; Weapon Art: ***Stance: Toll*** (8 FP, emits a 6 m bell-wave that applies Hollow-Blight buildup 40) |
| Right 2 | **Dark Hand Blade +10 (Dark)** | 2.4 | AR 168 phys + 96 dark at INT/FTH. For finishing drains and backstabs (120% crit) |
| Left 1 | **Idris Staff (Dark)** | 1.8 | Spell Buff 224; secondary catalyst so Hexes and Sorceries can both be attuned without swapping |
| Left 2 | **Empty** | — | Fast-roll preservation |
| Head | **Hexwife Hood** | 1.4 | 2 poise; +6% Hex damage |
| Body | **Hexwife Robes** | 3.6 | 2 poise; −4% Hollowing accrual |
| Hands | **Hexwife Wraps** | 1.1 | 1 poise; +1 Want capacity |
| Legs | **Hexwife Skirt** | 2.5 | 2 poise (set total **7** + base 12 = **19**) |
| Ring 1 | **Ring of the Evil Eye +2** | 0.0 | +18% max HP → **1005 HP effective** (this is why the build survives at all) |
| Ring 2 | **Sage Ring +2** | 0.0 | −8% cast time |
| Ring 3 | **Ring of Focus +1** | 0.0 | +30 max FP → 240 |
| Ring 4 | **Dark Clutch Ring** | 0.0 | +12% dark damage, **−10% damage taken → this is a trap ring** (see note) |
| Ammunition | **Life Gem ×6** | — | The hexer's *real* healing; casting is too slow to Estus safely |

> **The Dark Clutch trap.** `+12% dark damage / −10% damage taken` sounds excellent for a caster who stands at range. It is placed in the game specifically so that experienced players *feel* the decision. At 852 HP, −10% taken is worth more than +12% dark in every boss fight where the boss closes distance at least once. We ship it because a build guide that says "never take this ring" is a build guide that has stopped being interesting.

### 2.8.6 Spell Loadout (7 slots)

| Slot | Spell | School | Cost | Uses | FP | Effect |
|---|---|---|---|---|---|---|
| 1 | **Dark Orb** | Hex | Want 1 | 6 | 28 | 340 dark damage projectile, 48f startup, tracks 12° |
| 2 | **Dark Weapon** | Hex | Want 1 | 2 | 34 | +95 dark AR to right-hand weapon, 90 s |
| 3 | **Affinity** | Hex | Want 2 | 3 | 52 | 6 homing dark orbs, 42 damage each (252 total); **the build's highest single-cast DPS** |
| 4 | **Lifedrain Patch** | Hex | Want 1 | 4 | 40 | Places a 4 m draining field; heals caster 9/s while any enemy is inside; drains target HP 14/s |
| 5 | **Twisted Barrage** | Hex | Want 2 | 2 | 60 | 4 dark tendrils in a cone; each applies **−22 stamina** to targets |
| 6 | **Vow of Silence** | Miracle | Want 0 | 1 | 80 | 12 m radius, 15 s: **no spellcasting by anyone, including you.** The anti-caster nuke |
| 7 | **Great Soul Arrow** | Sorcery | Want 0 | 8 | 20 | Cheap ranged poke for when Want is empty — the build's fallback |

**Total FP commitment:** 314 FP for one full rotation of everything. Carrying 240 FP means the hexer must **manage a rotation, not a spam.** Want capacity of 3 (base) + 1 (wraps) = **4** permits at most: Dark Orb → Affinity → Lifedrain → Dark Orb before going empty. Resonance (Vol. 4 §4.5) then converts that sequence into escalating damage.

### 2.8.7 Resonance Interaction (Build-Defining)

The hexer's damage does not come from any single spell. It comes from the **Resonance ladder** (Vol. 4 §4.5):

```
Cast Hex #1 within 8 s → Resonance 1  (+8% dark dmg, −1 Want regen delay)
Cast Hex #2 within 8 s → Resonance 2  (+18%, −2, and next Hex applies Hollow-Blight 25)
Cast Hex #3 within 8 s → Resonance 3  (+32%, −3, and next Hex CANNOT be interrupted by Grade ≤2 poise damage)
Chain breaks after 8 s of no Hex cast → Resonance resets to 0
```

Optimal rotation (measured against a training dummy, NG, 60/50 stats):

| Step | Cast | Want | FP | Damage | Resonance |
|---|---|---|---|---|---|
| 1 | Dark Orb | 1→3 | 28 | 340 × 1.00 = 340 | 0→1 |
| 2 | Twisted Barrage | 2→1 | 60 | 4 × 118 × 1.08 = 510 (−88 target stamina) | 1→2 |
| 3 | Affinity | 2→0 (wait) | 52 | 252 × 1.18 = 297 | 2→3 |
| 4 | Dark Orb | 1→0 | 28 | 340 × 1.32 = 449 | 3→1 (reset) |
| **Total** | | | **168 FP** | **1596 damage** | ~13.4 s |

**Sustained DPS = 119 per FP spent; 1596 damage per 13.4 s rotation ≈ 119 dps while standing still.** This is *lower* than Build A's 512 dps. That is correct: the hexer's value is not DPS, it is **subtraction** — it removes the enemy's stamina, FP, healing, and casting ability, which makes every other build in the party stronger. In co-op, a hexer is worth more than a second knight (Vol. 8 §8.2).

### 2.8.8 Leveling Route

| Stage | SL | Priority |
|---|---|---|
| Barrens → Sanctuary | 10 → 25 | ATT to 18 (5 slots), INT to 20 |
| Grave of Names → Sunken | 25 → 50 | INT to 30, FTH to 30 → unlocks **Dark Orb**, **Lifedrain Patch** |
| Sunken → Ember Keep | 50 → 78 | INT to 40, FTH to 40 → **1.00× joint scaling**; ATT to 24 |
| Winter's → Dragon Shrine | 78 → 100 | INT to 50, FTH to 50; ATT to 30 (7 slots) |
| Grave of Kings → Convergence | 100 → 125 | INT to 60 (hard practical cap); FTH to 50; ATT to 30 (7 slots); VIG 22; VIT 12 |

### 2.8.9 Balance Assessment

| Metric | Value | vs. optimum |
|---|---|---|
| Sustained DPS (rotation) | **119** | 0.23× |
| Burst (single Affinity, R3) | **297** | — |
| Effective HP | **1005** (w/ Evil Eye) | 0.60× |
| Boss TTK (Vharos, NG) | **168 s** | 2.15× slower |
| **Utility contribution** | Removes 88 stamina, applies Hollow-Blight, blocks enemy casting | **not measured by DPS — this is the point** |
| Co-op value index | **1.42×** (highest in game) | — |
| Archetype clear-time spread | **15.8% slower** than Build A | ✔ within the 18% P5 gate |
| Skill floor | Low (range is forgiving) | |
| Skill ceiling | Very high (Resonance maintenance under pressure) | |

---

## 2.9 — REFERENCE BUILD C: Heavy Armor Poise Tank (VIT/STR, DS1 True Poise)

### 2.9.1 Identity

The build that DS3 removed and this game restores. A character who walks through light attacks because the armor says so, swings a weapon that costs more than their entire outfit, and treats stamina as the only real resource. Starts as **Remnant Dragonkin (SL10)**; finishes at **SL125**.

### 2.9.2 Final Stat Block — Soul Level 125

| Stat | Value | Δ | Rationale |
|---|---|---|---|
| **VIG** | **44** | +34 | **1432 HP.** Past the 40 breakpoint. Combined with 44% poise mitigation and high absorption, this is the highest effective HP in the game. |
| **ATT** | **10** | 0 | 70 FP, **3 slots.** Base. The tank casts nothing except a buff and a heal. |
| **END** | **18** | +8 | 100 Stamina. Enough for two heavy R1s (2×30) + one roll (40). |
| **STR** | **50** | +40 | 1.07× multiplier; two-handed (×1.5 = 75 effective) trivially meets any requirement in the game, including the 60-STR *Iron Eclipse Greatsword*. |
| **DEX** | **12** | +2 | Minimum for the Greatsword (DEX 10). |
| **VIT** | **53** | +43 | **107.5 load cap — the number that defines the build.** |
| **INT** | **8** | −2 | Dumped for 2 free points. Blocks all sorceries. |
| **FTH** | **8** | −2 | Dumped. Blocks all miracles — **the tank cannot heal with magic.** It heals with Estus and Blessed regen. |
| **ADP** | **12** | +2 | Agility 91, 9f fat-roll i-frames, 1.27 s stamina delay. |
| **TOTAL** | **215** | | **SL 125** |

### 2.9.3 Derived Stats

| Derived | Value |
|---|---|
| Max HP | **1432** |
| Max FP | **70** |
| Max Stamina | **100** |
| Spell slots | **3** |
| Equip Load capacity | **107.5** |
| Actual weight | **96.0** (weapons 40.0 — greatsword 28.0 **plus** greatshield 12.0 — + armor 56.0 + rings 0.0) |
| **Load %** | **89.3% → FAT ROLL** (9f i-frames at ADP 12, 48f total, 40 stamina) |
| **Poise (as equipped)** | **106** → stagger threshold **232**, mitigation **50%**, **True Poise Grade 3** (absorbs light, medium **and heavy** hits during attacks) |
| Poise without the greatshield | 88 → threshold 196, mitigation 44%, Grade 2 |
| Physical absorption | 32.4% (armor) + Blessed infusion regen |
| Effective HP (HP ÷ (1 − absorption) × (1 + mitigation contribution)) | **≈ 2410** |

### 2.9.4 Equipment

| Slot | Item | Weight | Poise | Notes |
|---|---|---|---|---|
| Right 1 | **Iron Eclipse Greatsword +10 (Blessed)** | 28.0 | — | AR 356 phys at STR 50. **Blessed**: +0.4%/s HP regen (5.7 HP/s), −25% Hollowing accrual. Weapon Art: ***Stance: Iron Verdict*** (22 FP, 78f startup, an overhead that deals **Grade 5 poise damage — staggers through ANYTHING including bosses**) |
| Right 2 | **Drakekeeper's Great Hammer +5** | 4.0 | — | Swap option for stone-armored targets; strike damage |
| Left 1 | **Iron Eclipse Greatshield** | **12.0** | **+18** | 100% physical, 62 stability; Weapon Art: ***Stance: Bulwark*** (20 FP, 6 s of +60 poise and 0 stamina cost on block). **Its 12.0 weight is carried at all times — this is why the build sits at 89.3% rather than 78%.** |
| Left 2 | *(empty — reserved for the Drakekeeper's Great Hammer)* | — | — | The greatshield lives in L1 and **is** equipped: its 12.0 weight and +18 poise are both counted in the totals above. See the doctrine below for when to raise it and when not to |
| Head | **Iron Eclipse Helm** | 8.5 | 11 | |
| Body | **Iron Eclipse Plate** | 30.0 | 34 | The heaviest body armor in the game |
| Hands | **Iron Eclipse Gauntlets** | 13.0 | 22 | |
| Legs | **Warden's Greaves** *(mixed set)* | 4.5 | 13 | **Mixing sets is optimal here** — Warden's Greaves give 13 poise at 4.5 weight vs. Iron Eclipse Leggings' 11 poise at 14.5. The tank build *is* a weight-optimization puzzle. |
| Ring 1 | **Havel's Ring +3** | 0.0 | — | +15% equip load → capacity becomes **123.6**, load becomes **78.1% — still FAT** |
| Ring 2 | **Ring of Steel Protection +3** | 0.0 | — | +16% physical absorption → 48.4% total |
| Ring 3 | **Covetous Gold Serpent Ring +2** | 0.0 | — | +110 item discovery (the tank farms; it has time) |
| Ring 4 | **Ring of Favor +3** | 0.0 | — | +8% HP/STA/Equip Load |

> **Total poise derivation:** armor 11 + 34 + 22 + 13 = **80**; + base **12** = 92; − **4** mixed-set penalty (§2.9.6 — Warden's Greaves are off-set) = **88**; + **18** from the equipped Iron Eclipse Greatshield = **106 → Grade 3, threshold 232, mitigation 50%.** Stow the shield and you drop a full grade — which is the tank's real equipment decision.

### 2.9.5 True Poise Doctrine — How The Tank Actually Fights

This is the DS1 mechanic, restored exactly and made legible for the first time.

```
AS EQUIPPED (greatshield raised in L1):
  TRUE_POISE_GRADE(106) = 3   // absorbs Grade 1, 2 AND 3 hits during attack animations
  STAGGER_THRESHOLD(106)      = 20 + (106 × 2) = 232 poise damage
  INCOMING POISE MITIGATION   = min(0.70, 106 × 0.005) = 50%
  ⇒ A Grade 3 attack (50 poise dmg) → 25 effective. Does NOT stagger you mid-swing.
  ⇒ Two of them (50 total) still do not.
  ⇒ A Grade 4 boss attack (80 poise dmg) → 40 effective. Still absorbed at Grade 3.
  ⇒ A Grade 5 boss attack (95+ poise dmg) ALWAYS staggers. There is no immunity.

SHIELD STOWED (two-handing the greatsword):
  TRUE_POISE_GRADE(88) = 2 · THRESHOLD 196 · MITIGATION 44%
  ⇒ Grade 3 hits now stagger you. Two-handing costs you a full armor grade.

HYPER ARMOR LOCK: only ONE absorb per player action. The hit after the absorb lands normally.
```

**The tank's actual gameplay loop:**

1. **Walk into range.** Not roll. *Walk.* Fat rolls cost 40 stamina of a 100 pool and have 9f i-frames — they are a last resort, not a movement option.
2. **Start the R1 chain.** During the animation you are armored against Grades 1–3 with the shield up, Grades 1–2 with it stowed. Only Grade 4+ (shield up) or Grade 5 (always) interrupts you.
3. **Accept one hit.** The absorb fires. You take damage but your swing completes.
4. **Do NOT accept a second hit.** The hyper-armor lock has expired; the next attack staggers you.
5. **Retreat behind the greatshield** to reset — but only against *enemies*, never against bosses: at 62 stability, blocking a 620-damage boss hit costs `10 + 620×0.07 ≈ 53` of your 100 stamina, so two blocked boss hits guard-break you. The shield is for adds, for repositioning, and for the **Bulwark** Weapon Art (20 FP, 6 s of +60 poise → **166 poise, threshold 352, mitigation 70% — the cap**).
6. **Regen.** Blessed infusion at 5.7 HP/s + Estus.

**The critical design property:** the tank is *not* immune. It is **armored once per action.** Every heavy-armor player in DS1 knew this instinctively and could not explain it; *Convergence* makes it a number on the HUD (Vol. 9 §9.4, the **Poise Diamond**) so that it can be learned.

### 2.9.6 The Mixed-Set Penalty

Wearing a non-matching armor set applies **−4 total poise** (not −4 per piece). This is a small tax on optimization that keeps set identities meaningful without forbidding the weight-puzzle play that makes VIT interesting.

| Set state | Poise modifier |
|---|---|
| Full matching 4-piece | **+0** (and the set's unique bonus applies) |
| 3-piece match + 1 off | **−4** |
| 2+2 or worse | **−4** (does not stack further) |
| Naked | Poise = base 12, Grade 0 |

### 2.9.7 Spell Loadout (3 slots)

| Slot | Spell | Availability | Effect |
|---|---|---|---|
| 1 | **Empty** | — | The build has FTH 8. It cannot cast a single miracle or sorcery. |
| 2 | **Empty** | — | |
| 3 | **Empty** | — | |

> **This is the tank's cost, stated plainly: zero magic.** No heals, no buffs, no utility, no Homeward. It must walk back to bonfires. It must drink Estus in the open. It has 70 FP that it will never spend, and 3 slots that will stay dark for 80 hours. Players who choose this build are choosing to give up the entire magic system — and the game must therefore guarantee that **armor, poise, and STR scaling are enough to carry the whole campaign.** QA gate: Build C must clear all 14 mandatory bosses in NG with zero magic. (It does; see 2.9.8.)

### 2.9.8 Leveling Route

| Stage | SL | Priority | Note |
|---|---|---|---|
| Barrens → Sanctuary | 10 → 30 | VIT to 27, STR to 20 | VIT 27 unlocks the 86.0 load cap — enough for the full Iron Eclipse set at FAT roll by SL30. The build's identity arrives **very early**, which is deliberate: heavy armor should be discoverable, not endgame. |
| Grave of Names → Sunken | 30 → 58 | STR to 34, VIG to 27 | STR 34 = the Iron Eclipse Greatsword requirement (one-handed) |
| Sunken → Ember Keep | 58 → 85 | VIT to 40, VIG to 34 | Ember Keep's fire damage ignores physical absorption — the tank's first real wall. Requires the **Ashen Ward** ring (fire absorb +18%) from the region. |
| Winter's → Dragon Shrine | 85 → 108 | STR to 50, VIG to 40 | Poise 88 achieved when the full set + Warden's Greaves are collected |
| Grave of Kings → Convergence | 108 → 125 | VIT to 53 (107.5 load cap — the number that makes 89.3% possible), VIG 44, END 18, ADP 12 | |

### 2.9.9 Balance Assessment

| Metric | Value | vs. optimum |
|---|---|---|
| Sustained DPS | **318** | 0.62× |
| Burst (*Iron Verdict* Weapon Art) | **702** | 0.75× |
| Effective HP | **≈ 2410** | **1.43×** (highest in game) |
| Boss TTK (Vharos, NG) | **124 s** | 1.59× slower |
| Deaths per boss (median QA playthrough) | **1.4** vs. Build A's **3.1** | — |
| **Total time per boss including retries** | **≈ 297 s** | **0.98× — statistically identical to Build A** |
| Archetype clear-time spread | **16.4% slower** in raw TTK, **2% slower** in total elapsed | ✔ within P5 |
| Skill floor | **Lowest in game** — mistakes are absorbed | |
| Skill ceiling | Moderate — the hyper-armor lock and the stamina economy are the mastery curve | |

> **The balance insight worth stating out loud:** the tank is *slower per attempt* and *needs fewer attempts*. Across a full boss roster, the two builds take the same amount of real time. This is the property we tune every archetype toward, and it is the operational definition of Pillar P5. DPS is not power; **elapsed time to completion is power.**

---

## 2.10 — Cross-Build Comparison Summary

| | **A · Quality Power-Stance Knight** | **B · Pure Hexer** | **C · Heavy Poise Tank** |
|---|---|---|---|
| SL | 125 | 125 | 125 |
| HP | 1214 | 852 (1005 w/ ring) | 1432 |
| FP | 154 | 210 (240 w/ ring) | 70 |
| Stamina | 112 | 86 | 100 |
| Slots | 5 | 7 | 3 (all empty) |
| Load % | 39.4% (MID) | 25.0% (FAST) | 89.3% (FAT) |
| Roll i-frames | 13f | 16f | 9f |
| Poise | 34 (Grade 1) | 19 (Grade 0) | **106 (Grade 3)** — 88 (Grade 2) with the shield stowed |
| Sustained DPS | **512** | 119 | 318 |
| Effective HP | 1684 | 1005 | **2410** |
| Boss TTK | **78 s** | 168 s | 124 s |
| Deaths/boss | 3.1 | 2.4 | **1.4** |
| Co-op value index | 1.00 | **1.42** | 1.18 |
| Invasion value index | **1.31** | 0.94 | 1.05 |
| Signature mechanic | Power Stance Posture Break | Resonance ladder | True Poise + hyper-armor lock |
| Primary weakness | No shield; exact stamina math | 852 HP; zero ADP | Zero magic; fat roll; guard-breaks in 2 boss hits |
| Fantasy | "Two swords, one blade." | "I subtract you." | "I am the wall." |

---

## 2.11 — Balance Levers & Tuning Knobs (Engineering Handoff)

Every number in this volume is exposed as a live-tunable in the `balance.toml` config. QA has authority to change any value within the stated band without a design sign-off.

| Knob | Path | Default | Band | Owner |
|---|---|---|---|---|
| HP per point, VIG break 1 | `stats.vigor.hp_t1` | 36 | 32–40 | Systems |
| HP break points | `stats.vigor.breaks` | [27,40,60,80] | fixed | Systems (design-locked) |
| FP per point | `stats.attunement.fp_t1` | 7 | 6–8 | Systems |
| Slot formula divisor | `stats.attunement.slot_div` | 6 | 5–7 | Systems |
| Stamina per point | `stats.endurance.sta_t1` | 2.0 | 1.8–2.2 | Systems |
| Equip load per point | `stats.vitality.load_t1` | 2.0 | 1.8–2.2 | Systems |
| Roll tier boundaries | `combat.equip.tiers` | [0.30, 0.70, 1.00] | fixed | Combat (design-locked) |
| i-frames per roll tier | `combat.roll.iframes` | [16,13,10] | ±2f | Combat |
| ADP i-frame cap | `stats.adp.iframe_cap` | 16f | 14–18f | Combat |
| True poise grade thresholds | `combat.poise.grade_thresholds` | [30,60,90] | fixed | Combat (design-locked) |
| Poise mitigation cap | `combat.poise.mitigation_cap` | 0.70 | 0.60–0.75 | Combat |
| Hyper-armor lock count | `combat.poise.absorbs_per_action` | 1 | 1 (never 2) | Combat (design-locked) |
| Hex joint-scale Δ weight | `magic.hex.delta_weight` | 0.40 | 0.30–0.50 | Magic |
| Scaling multiplier at 40 | `stats.scaling.plateau_40` | 1.00 | fixed | Systems (design-locked) |
| Level cost cubic coefficient | `economy.levelup.cubic` | 0.021 | 0.018–0.024 | Economy |
| Archetype spread gate | `balance.archetype_spread_max` | 0.18 | hard gate | Balance (blocks ship) |

**Design-locked** values are the load-bearing walls of the build system. Changing any of them invalidates the reference builds above and requires a full archetype re-sweep (40 builds × 14 bosses × 4 NG cycles = 2,240 timed runs).

---

*End of Volume 2. Continue to Volume 3: Combat Matrix & Mechanics Fusion.*
