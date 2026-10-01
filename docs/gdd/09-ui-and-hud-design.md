# VOLUME 9 — USER INTERFACE (UI) & HUD DESIGN

> **Design owner:** Lead UI/UX Designer / Technical Artist (HUD)
> **Depends on:** Vol. 2 (stats), Vol. 3 (poise, power stance, severance), Vol. 4 (spells), Vol. 7 (flasks/Ascetics), Vol. 8 (multiplayer) · **Feeds:** all disciplines

---

## 9.0 — UI Design Principles

> **U1 — THE HUD IS A COMPASS, NOT A DASHBOARD.** It shows the player's three budgets (HP / FP / Stamina) and nothing else by default. Every additional element must justify itself against the "one glance, 150 ms" rule: a player must be able to read the entire HUD in one eye-flick without moving their focus off the center of the screen.
>
> **U2 — DIEGETIC FIRST.** Where a system can be represented in the world, it is: the Poise Diamond is a *shape*, the Resonance knots are *sound*, the Convergence Clock is *ashfall density*, covenant rank is *a physical emblem on your body*. Text is the last resort, never the first.
>
> **U3 — NOTHING BLINKS DURING COMBAT.** No flashing, no pulsing, no screen shake tied to UI state. UI animations are limited to **fills, fades, and translations**. The only exception is a death, which is allowed one 300 ms full-screen desaturation.
>
> **U4 — EVERY NUMBER THE PLAYER CAN ACT ON MUST BE VISIBLE SOMEWHERE.** Poise, posture, load %, scaling letters, infusion effects, Want regen — all of it is on a screen, even if it is not on the HUD. **Hidden depth is fine; hidden rules are not.**
>
> **U5 — MENUS ARE SAFE.** Every menu pauses single-player, dims the world, and cannot be opened during an attack animation. Menus never kill you. (The one exception: the *multiplayer* menu in a live session, which does not pause — and says so.)

---

## 9.1 — HUD Layout Specification

### 9.1.1 Reference Frame & Scaling

| Property | Value |
|---|---|
| Reference resolution | **1920 × 1080** (all coordinates below in reference px) |
| Scaling mode | All HUD elements scale on **viewport height (VH)**, preserving aspect. At 3840×2160 every value ×2.0 |
| Safe area | 5% inset on all sides (broadcast-safe); no element crosses it |
| Default HUD scale | 100% · slider **70% – 130%** |
| Default opacity | 100% · slider **30% – 100%** · plus "fade when idle" (see §9.2.4) |
| Font | **EB Garamond** (numerals + labels), **Cinzel** (titles/boss names). Both licensed, both variable-weight |
| Minimum readable size | 18 px at 1920×1080 (≈ 0.94 VH). No HUD text is ever smaller |
| Frame budget | HUD render ≤ **0.35 ms** per frame; ≤ 42 draw calls |

### 9.1.2 Full HUD Wireframe

```
 ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 │  SAFE AREA (5%)                                                                          │
 │                                                                                          │
 │  (64,56)                                                                 (1856,56)       │
 │  ┌───────────────────────────────────┐                    ┌────────────────────────────┐  │
 │  │ HP  ██████████████████░░░░░░░░░░░ │  408×22            │  REGION  Sunken Cathedral  │  │
 │  │ FP  ████████░░░░░░░░░░            │  340×14            │  ASCETIC A2  ◆◆◇◇          │  │
 │  │ STA ████████████████░░░░░░        │  372×16            │  COVENANT  Darkwraith II   │  │
 │  │        ◇  ← POISE DIAMOND         │  26×26             │  CLOCK     ▓▓▓▓░░░░ 47     │  │
 │  │  ▪ ▪ ▪  ← STATUS EFFECTS (7 max)  │  24×24 each        │  WANT      ●●●○○○○         │  │
 │  │  ▮▮▮    ← RESONANCE KNOTS (hex)   │  14×14 each        └────────────────────────────┘  │
 │  └───────────────────────────────────┘                                                   │
 │                                                                                          │
 │                                                                                          │
 │                                                                                          │
 │                            ╳  ← LOCK-ON RETICLE (12×12, only when locked)                │
 │                                                                                          │
 │                            ✛  ← BOSS POSTURE BAR (appears in combat only)                │
 │                                                                                          │
 │                                                                                          │
 │                                                                                          │
 │                                        ┌───────────────────────────────────┐             │
 │                                        │  V H A R O S ,  T H E  D R O W N E D│             │
 │                                        │           W A R D E N              │             │
 │                                        │ ██████████████████░░░░░░░░░░░░░░░  │  900×14    │
 │                                        │ ▮▮▮  ✂ ✂ ✂   ◆◆◇   ← SEVER PIPS  │             │
 │                                        └───────────────────────────────────┘             │
 │                                                                                          │
 │   (64,1010)                                                              (1856,1010)     │
 │   ┌──────────┐  ┌──────────────────────────────────────┐  ┌──────────────────────────┐   │
 │   │ ESTUS    │  │  QUICK SLOTS (5)                     │  │  WEAPON SLOTS            │   │
 │   │ ▮▮▮▮▮▮▮▮▮ │  │  [1][2][3][4][5]                   │  │  R1 ⚔ Longsword +10 Q    │   │
 │   │ 9 / 15   │  │   ▲ active (raised 4px, gold edge)   │  │  R2 🗡 Estoc +10 S       │   │
 │   │ ASHEN 2  │  │                                      │  │  L1 🛡 Lothric Shield    │   │
 │   │ GEMS  7  │  │  SPELL  ✦ Dark Orb   (Want ●●●○○)    │  │  L2 —  (empty)           │   │
 │   └──────────┘  └──────────────────────────────────────┘  └──────────────────────────┘   │
 │                                                                                          │
 └──────────────────────────────────────────────────────────────────────────────────────────┘

   OFF-HUD / CONTEXTUAL ELEMENTS (appear only when triggered):
     · PLAYER MESSAGES       bottom-center, 3 s, 60% opacity  ("A red phantom enters…")
     · DIRECTIONAL ARROW     140 px radius ring around the reticle (invasion warning only)
     · SEVERANCE NOTIFICATION top-right ribbon, 3 s, full opacity ("HARPOON ARM SEVERED")
     · DEATH                 full-screen desaturation 300 ms → "YOU DIED" (Cinzel 96 px, 4 s)
     · INTERACTION PROMPT    bottom-center, 22 px, only when a valid target is within 2.5 m
     · PICKUP TOAST          bottom-right stack (max 4), 2.2 s each, 20 px
```

### 9.1.3 Element-by-Element Specification

#### A. HEALTH BAR (HP)

| Property | Value |
|---|---|
| Position | x **64**, y **56** (top-left anchor) |
| Size | **408 × 22** px |
| Fill | Linear gradient `#C41E1E` (left) → `#7A0F14` (right) |
| Background | `#0B0B0C` at 82% opacity, 1 px inner stroke `#2A2A2E` |
| Border | 1 px `#3A3A40` outer |
| **Ghost fill** | Damage taken leaves a `#5C1010` "ghost" that drains over **1.4 s** — the classic Souls delayed-drain, retained because it communicates *how much you just lost* |
| Heal fill | `#E8C15A` leading edge, 220 ms ease-out |
| Low-HP state | Below 25%: the fill desaturates toward `#8A2020` and a **heartbeat SFX** begins (60 bpm, rising to 92 bpm at 5%). **No visual pulse** (U3) |
| Overheal (buffs) | A `#E8C15A` segment beyond 100% for temporary HP (max 15% overshoot displayed) |
| Numerals | **Not shown by default.** An accessibility toggle (§9.7) enables `1214 / 1214` in EBG 18 px, right-aligned inside the bar |

#### B. FOCUS POINTS BAR (FP)

| Property | Value |
|---|---|
| Position | x **64**, y **84** (6 px below HP) |
| Size | **340 × 14** px — *deliberately 17% narrower and 36% shorter than HP* |
| Fill | Linear gradient `#1E6FC4` → `#0F3E7A` |
| Ghost fill | `#102C52`, 1.0 s drain |
| Empty state | At 0 FP the bar renders as a **hollow outline** (2 px `#3A5A80`) — visually "spent," not "broken" |
| Ashen Estus | If Ashen charges > 0, a small `#7FB2E8` pip row (max 8 pips) renders above the bar's right end |
| Numerals | Off by default; toggle shows `154 / 154` |

> **Why FP is smaller than HP.** In prior games, equal-sized HP/FP bars taught new players that FP was as important as HP. It is not — FP is a luxury budget (§3.2). Making it visually subordinate is the cheapest possible tutorial.

#### C. STAMINA BAR

| Property | Value |
|---|---|
| Position | x **64**, y **104** |
| Size | **372 × 16** px |
| Fill | Linear gradient `#3FA845` → `#1E6B28` |
| Regen tick | A 2 px `#8FE08F` leading edge visible only while regenerating — **the only moving element in the HUD during idle**, and it exists so players can time their next action |
| Depleted state | Below 15%: fill shifts to `#C8A03A` (amber, not red — red is HP's language) |
| Guard state | While guarding, a `#6FA8DC` overlay fills proportionally to *block stamina debt* |
| Numerals | Off by default |

#### D. POISE DIAMOND *(the Convergence signature HUD element)*

| Property | Value |
|---|---|
| Position | x **64 + 372 + 14 = 450**, y **100** (right of the stamina bar, aligned to its center) |
| Size | **26 × 26** px, rotated 45° (a diamond) |
| Default state | Outline `#4A4A52`, fill `#16161A` at 60% |
| **Accumulating** | Fills bottom-up with `#B8B8C4` proportional to `accumulated_poise_damage / POISE_THRESHOLD` |
| **ABSORB FIRED** | Flashes **solid white** (`#FFFFFF`) for exactly **6f (100 ms)**, plays a low *thunk* SFX, then empties instantly |
| **Stagger imminent** | Above 80% fill, the outline thickens to 2 px `#E8C15A` |
| **True poise active** | While inside an attack animation with TRUE_POISE_GRADE ≥ 1, the diamond gains a **1 px `#7A5C2E` inner ring** — this is the "you are armored right now" indicator |
| Hyper-armor lock | After an absorb, the diamond renders **hatched** (45° lines at 20% opacity) for the remainder of that action — "you cannot absorb again" |
| Tooltip (menu) | Hovering in the stat screen reads: `Poise 88 · Threshold 196 · Mitigation 44% · Grade 2 — absorbs light and medium hits during attacks, once per action` |

> **This one element is the difference between DS1's invisible poise system and a learnable one.** Vol. 3 §3.7.3's fairness gate G7 requires ≥90% of players to predict their absorb within 2 regions; the diamond is how we hit it.

#### E. STATUS EFFECT ICONS

| Property | Value |
|---|---|
| Position | x **64**, y **136** (below the bars), horizontal row |
| Icon size | **24 × 24** px, 6 px gap, max **7** visible (overflow renders as `+N`) |
| Duration ring | Each icon has a 2 px clockwise-depleting arc showing remaining duration |
| Buildup bar | For *active buildup* (pre-proc), a 24 px-wide 3 px bar under the icon fills toward the proc threshold |

| Status | Icon | Color | Notes |
|---|---|---|---|
| Bleed | A drop with a slash through it | `#C41E1E` | Buildup + proc states use the same icon, different fill |
| Poison | Three bubbles | `#6B8E23` | |
| Toxic | A skull-and-bubbles | `#4A5D23` | Renders **larger (28 px)** — Toxic is worse and should look worse |
| Frost | A six-point crystal | `#7FB2E8` | |
| Burn | A flame | `#E8763A` | |
| **Hollow-Blight** | An open knot | `#6B3FA0` | New status; icon is a black knot with a gap |
| Curse | An eye with a bar | `#1A1A1A` on `#C41E1E` | **Inverted colors** — the only icon that breaks the palette |
| Blessed regen | A small sun | `#E8C15A` | Positive |
| Weapon buff (resin/spell) | The weapon silhouette | damage-type color | Shows remaining time |
| Power Within | A heart in a flame | `#E8763A` | Shows the HP drain as a depleting ring |
| Iron Flesh | An anvil | `#8A8A96` | |
| Vow of Silence (on you) | A closed mouth | `#B8B8C4` | |
| Embered | An ember | `#E8763A` | Multiplayer state |
| Hollowing (≥40) | A cracked face | `#5A5A62` | **Permanent**, renders last in the row |
| Dark Sigils | N black knots | `#1A1A1A` | Permanent; N = Sigil count. **Your body's ledger, on your HUD** |

#### F. RESONANCE KNOTS (Hex builds only)

| Property | Value |
|---|---|
| Position | x **64**, y **170**, horizontal row of 3 |
| Size | **14 × 14** px each, 4 px gap |
| State 0 | Outline `#3A2A4A` only |
| State 1–3 | Fills solid `#6B3FA0` left-to-right |
| **Audio** | Each knot filling plays a **low detuned third** (Vol. 4 §4.6.3). This is the primary feedback — the visual is secondary |
| Decay | On chain expiry, all knots empty simultaneously with a descending glissando |
| Visibility | Hidden entirely unless the player has ≥1 Hex attuned |

#### G. WANT METER (Hex builds only)

| Property | Value |
|---|---|
| Position | Top-right cluster, below the region line — x **1856 − 160 = 1696**, y **96** |
| Size | 7 circles, **14 px** diameter, 6 px gap |
| Filled | `#2A1A3A` with a `#6B3FA0` inner glow |
| Empty | Outline `#3A2A4A` |
| Regen tick | The next-to-fill circle pulses **once** every 2 s at 8% opacity while out of combat (never during combat) |
| Overdraft state | At 0 Want, all circles render **red-outlined** `#7A0F14` — the "paying in blood" state (§4.6.1) |

#### H. QUICK SLOTS (bottom center)

| Property | Value |
|---|---|
| Position | Centered horizontally, y **1010** (bottom edge at 1024) |
| Slots | **5** item slots, each **64 × 64** px, 8 px gap → total 352 px wide |
| Active slot | Raised **4 px**, 2 px `#E8C15A` border, icon at 100% opacity |
| Inactive slots | 72% opacity, 1 px `#3A3A40` border |
| Count | Bottom-right of each slot, EBG 18 px `#D0D0D8`, with a `#0B0B0C` 2 px shadow |
| Zero count | Slot renders at 30% opacity with a 1 px diagonal strike |
| Cycling | D-pad left/right or scroll; **the cycle animation is 6f** — instant enough to never cost a fight |
| Spell sub-display | Below the item row: the **active attuned spell** with icon (28 px), name (EBG 18 px), FP cost, and Want cost. y **980** |

#### I. WEAPON SLOT INDICATORS (bottom right)

| Property | Value |
|---|---|
| Position | Right-aligned, x **1856**, y **960** |
| Layout | 4 rows: R1, R2, L1, L2 — each 220 × 26 px |
| Content | Slot label (EBG 16 px `#8A8A96`) + item icon (20 px) + name + upgrade + **infusion letter** |
| Infusion letter | Single character in the infusion's color: `Q` Quality `#D0D0D8` · `H` Heavy `#C08040` · `S` Sharp `#80C0A0` · `F` Fire `#E8763A` · `C` Chaos `#C41E1E` · `L` Lightning `#E8C15A` · `M` Magic `#7FB2E8` · `X` Crystal `#B8E0F0` · `D` Dark `#6B3FA0` · `B` Blessed `#F0E8C0` · `O` Hollow `#5A5A62` · `A` Ashen `#8A8A96` |
| Two-hand state | When two-handing, R1's row gains a `⌐` glyph and L1/L2 dim to 40% |
| **POWER STANCE state** | When Power Stance is active, **both R1 and L1 rows merge into a single 220 × 40 px row** with a gold `⚔⚔` glyph, the stance name in Cinzel 18 px `#E8C15A`, and a small `1.5×` requirement indicator. See §9.5 |
| Durability | If any equipped item is below 30% durability, its row gains a 2 px `#C8A03A` left border |

#### J. ESTUS / HEALING CLUSTER (bottom left)

| Property | Value |
|---|---|
| Position | x **64**, y **960** |
| Layout | Three stacked rows, 180 × 26 px each |
| Row 1 | **Estus icon** (24 px flask) + pips: one 8×16 px pip per charge (max 15, wrapping to 2 rows of 8) + `9 / 15` in EBG 18 px |
| Row 2 | **Ashen Estus icon** (`#7FB2E8` flask) + pips + count |
| Row 3 | **Life Gem icon** + count (`7`) — renders in `#8FE08F` |
| Empty state | Estus at 0 renders the flask **inverted and hollow** — the strongest "you are out" signal in the HUD |
| Drink feedback | On use, the corresponding pip empties with a 220 ms ease-out and a glass *clink* pitched to the flask's +level |

#### K. TOP-RIGHT WORLD CLUSTER

| Property | Value |
|---|---|
| Position | Right-aligned, x **1856**, y **56** |
| Line 1 | **REGION NAME** — Cinzel 22 px `#D0D0D8`, letter-spacing +4% |
| Line 2 | **ASCETIC RANK** — `ASCETIC A2` + 4 diamond pips (filled = rank), `#E8763A`. Hidden at A0 |
| Line 3 | **COVENANT** — name + Roman numeral rank, EBG 18 px, in the covenant's color |
| Line 4 | **CONVERGENCE CLOCK** — an 8-segment horizontal bar, `#8A8A96`, with the numeric value in EBG 16 px. Color shifts by state: Normal `#8A8A96` · Decaying `#C8A03A` · Bleeding `#C05A2E` · Converged `#7A0F14` · Collapsed `#1A1A1A` on `#C41E1E` |
| Visibility | **Fades to 0% opacity 6 s after the last input**, returns on any input. This cluster is the most "informational, least tactical" and must not compete with the bars |

#### L. BOSS HEALTH BAR

| Property | Value |
|---|---|
| Position | Centered horizontally, y **930** |
| Size | **900 × 14** px |
| Name | Cinzel 26 px `#D0D0D8`, centered, y **898**, letter-spacing +6% |
| Fill | `#7A0F14` → `#C41E1E` (identical gradient to the player's HP — **the boss's health is the same substance as yours**) |
| Phase notches | Vertical 2 px `#0B0B0C` lines at 60% and 25% (Vharos's phase boundaries). Rendered at 60% opacity so they read as *structure*, not clutter |
| **SEVERANCE PIPS** | Below the bar, y **952**: one 16 px `✂`-style pip per severable part. States: `◇` unsevered · `◐` damaged (fill proportional to part HP) · `▮` severed (`#E8C15A`) |
| **POSTURE BAR** | Below the severance pips, y **972**: a **300 × 6** px bar, `#B8B8C4` fill, depleting left-to-right as posture accumulates. **At 0 it flashes white for 8f and the boss name gains a `◆ BROKEN` suffix** (§3.6.4) |
| Entrance | The bar **draws in from center over 480 ms** as the boss's name fades in over 720 ms. No sound. This is the game's most-repeated animation and it must never be annoying |
| Exit | On death, the bar drains over 1,400 ms and the name fades over 2,000 ms. Souls award appears at the name's position, EBG 22 px `#E8C15A`, for 3 s |
| Multi-boss | Two bosses = two bars stacked (y 930 and 962), each 620 × 12 px, names at 20 px. Three or more = a single bar with segment dividers |
| Immunity states | During a transition, the bar renders at **40% opacity with a 1 px `#E8C15A` outline** — "you cannot hurt it right now," visible and honest |

#### M. LOCK-ON RETICLE

| Property | Value |
|---|---|
| Size | 12 × 12 px, centered on the target's chest bone, projected to screen |
| Default | `#D0D0D8` at 70%, a 4-point crosshair with a 2 px center gap |
| On a severable part | Changes to a **`◇` diamond outline** in the required damage type's color (SLASH `#D0D0D8` · STRIKE `#C8A03A` · PIERCE `#7FB2E8` · FIRE `#E8763A`) — **the reticle tells you what the part needs** |
| On a posture-broken target | Fills solid `#FFFFFF` for the 4 s stagger window |
| On an untargetable object | Does not render |
| Multiple targets | Up to 3 secondary reticles render at 30% opacity, 8 px |

---

## 9.2 — HUD State Machine

### 9.2.1 Visibility States

| State | Bars | Poise Diamond | Quick Slots | Weapon Slots | Top-Right | Boss Bar | Reticle |
|---|---|---|---|---|---|---|---|
| **EXPLORE** (no aggro, 8 s+ since combat) | 40% | hidden | 40% | 40% | fades to 0% after 6 s | hidden | hidden |
| **ALERT** (enemy aware, not engaged) | 100% | visible | 72% | 72% | 100% | hidden | hidden |
| **COMBAT** (aggro/damage within 6 s) | 100% | visible | 100% | 100% | 100% | visible | visible |
| **BOSS** | 100% | visible | 100% | 100% | 40% | visible | visible |
| **CASTING** | 100% | visible | 100% | 40% | 40% | visible | visible |
| **MENU OPEN** | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| **DEAD** | hidden | hidden | hidden | hidden | hidden | drains over 1.4 s | hidden |
| **CINEMATIC** | hidden | hidden | hidden | hidden | hidden | hidden | hidden |
| **PHOTO MODE** | hidden | hidden | hidden | hidden | hidden | hidden | hidden |

### 9.2.2 Transition Timing

| Transition | Duration | Easing |
|---|---|---|
| EXPLORE → ALERT | 240 ms | ease-out |
| ALERT → COMBAT | 120 ms | linear |
| COMBAT → EXPLORE | 1,200 ms after last combat event | ease-in-out |
| Any → MENU | 80 ms | linear |
| MENU → Any | 160 ms | ease-out |
| Boss bar entrance | 480 ms (bar) / 720 ms (name) | ease-out |
| Boss bar exit | 1,400 ms (bar) / 2,000 ms (name) | ease-in |

### 9.2.3 The One Glance Test (U1 verification)

| Element cluster | Screen position | Angular distance from center at 24" / 60 cm | Read time |
|---|---|---|---|
| HP/FP/Stamina | top-left | 18.4° | 62 ms |
| Poise Diamond | top-left, right of bars | 19.1° | +18 ms |
| Quick slots | bottom-center | 11.2° | 44 ms |
| Boss bar | bottom-center | 12.8° | 51 ms |
| **TOTAL, worst case** | | | **175 ms** |

> 175 ms exceeds the 150 ms target by 25 ms in the worst case (reading everything at once). In practice players read **bars + reticle** (106 ms) and only glance at the boss bar between attacks. **Accepted.** The mitigation is the "fade when idle" behavior (§9.2.4) which removes the top-right cluster entirely from the glance budget.

### 9.2.4 Fade-When-Idle

After **6 s** with no input and no damage event, non-combat HUD elements fade to their EXPLORE opacity over 800 ms. Any input restores full opacity in **80 ms** (faster than the fade, so the HUD never feels laggy). Toggleable in accessibility; **off by default in combat states**.

---

## 9.3 — Menu Architecture

### 9.3.1 Menu Flow

```
                          [ PAUSE / OPTIONS BUTTON ]
                                     │
                                     ▼
        ┌────────────────────────────────────────────────────────────┐
        │  ▸ STATUS      character, stats, soft caps, Sigil Board     │
        │  ▸ EQUIPMENT   paperdoll, Power Stance, poise, infusion     │
        │  ▸ MAGIC       4 schools, attunement pages, Resonance       │
        │  ▸ ITEMS       inventory, 8 categories, Severance Tokens    │
        │  ▸ CRAFTING    Vhenn services (only at a bonfire/forge)     │
        │  ▸ GESTURES    34 gestures, 12 equip slots                  │
        │  ▸ MULTIPLAYER covenants, signs, session settings, reports  │
        │  ▸ SYSTEM      save, controls, audio, video, accessibility   │
        │  ▸ QUIT TO TITLE                                            │
        └────────────────────────────────────────────────────────────┘

   Navigation model:
     · LEFT STICK / D-PAD  = vertical list
     · RIGHT STICK         = horizontal sub-navigation (e.g. slot cycling)
     · A / CROSS           = confirm        · B / CIRCLE = back
     · X / SQUARE          = detail panel toggle
     · Y / TRIANGLE        = sort / filter
     · LB/RB, L1/R1        = tab switching between the 8 top-level menus
     · Every menu has a persistent RIGHT-HAND DETAIL PANEL (48% of screen width)
       that shows the selected item's full data. This panel is where all the
       "hidden" numbers live (U4).
```

### 9.3.2 The Detail Panel (universal component)

```
┌─────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════╗  │
│  ║      [ ITEM RENDER — 3D, rotating ]   ║  │  240 px tall, live 3D model
│  ╚═══════════════════════════════════════╝  │
│                                             │
│  LONGSWORD +10                     QUALITY  │  Cinzel 26 px / infusion letter
│  Straight Sword · 4.0 units                 │  EBG 18 px #8A8A96
│  ─────────────────────────────────────────  │
│  Physical    268   ████▮                    │  AR + relative bar
│  Magic         0                            │
│  Fire          0                            │
│  Lightning     0                            │
│  Dark          0                            │
│  ─────────────────────────────────────────  │
│  STR  D  ████████░░  B  (+98 @ STR 40)      │  scaling letter + bar + numeric
│  DEX  D  ████████░░  B  (+98 @ DEX 40)      │
│  ─────────────────────────────────────────  │
│  Requires      STR 12 · DEX 12              │
│  Two-handed    STR 8  (×1.5 effective)      │
│  POWER STANCE  ✔ compatible with L1 Estoc   │  ← see §9.5
│                  requires STR 18 / DEX 27   │
│  ─────────────────────────────────────────  │
│  Weight 4.0 · Poise dmg 22 (Grade 2)        │
│  Durability 118 / 120                       │
│  Weapon Art  Stance: Piercing Sweep  (12 FP)│
│              Rank II  ▮▮◇  −15% FP, +10% dmg│
│  ─────────────────────────────────────────  │
│  "A straight sword of the Ashen Knight …"   │  item text, EBG 19 px, italic
│                                             │
└─────────────────────────────────────────────┘
```

---

## 9.4 — STATUS Screen

### 9.4.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  STATUS                                                        SOUL LEVEL   125   │
│  ─────────────────────────────────────────────────────────────────────────────── │
│                                                                                  │
│   [ CHARACTER MODEL ]              VIGOR        34  ▮▮▮▮▮▮▮░░░   HP        1214  │
│   full-body, rotatable,            ATTUNEMENT   22  ▮▮▮▮▮░░░░░   FP         154  │
│   shows equipped armor,            ENDURANCE    24  ▮▮▮▮▮▮░░░░   STAMINA    112  │
│   hollowing decay stage,           STRENGTH     40  ▮▮▮▮▮▮▮▮▮▮   SLOTS        5  │
│   Dark Sigils on the torso,        DEXTERITY    40  ▮▮▮▮▮▮▮▮▮▮                  │
│   covenant emblem                  VITALITY     20  ▮▮▮▮▮░░░░░   EQUIP LOAD 28.4  │
│                                    INTELLIGENCE  9  ▮▮░░░░░░░░   CAPACITY  72.0  │
│                                    FAITH        10  ▮▮▮░░░░░░░   ───────────────  │
│                                    ADAPTABILITY 16  ▮▮▮▮░░░░░░   LOAD     39.4%  │
│                                                                MID ROLL · 13f i-fr │
│   ┌──────────────────────────┐                                                     │
│   │  SIGIL BOARD             │        POISE          34                             │
│   │  [torso diagram]         │        THRESHOLD      88                             │
│   │   ✕  ✕  ✕  ○  ○  ○  ○  ○ │        MITIGATION     17%                            │
│   │  I  II III               │        TRUE POISE     GRADE 1 — absorbs light hits   │
│   │  8 slots, 3 filled       │        AGILITY        95                             │
│   └──────────────────────────┘        ADP DELAY      1.18 s                         │
│                                        HOLLOWING      34                             │
│   [SOFT CAP CURVE GRAPH]             ─────────────────────────────                 │
│   selected attribute's               ABSORPTION   phys 14 · magic 6 · fire 8        │
│   diminishing-returns curve                       lightning 9 · dark 7              │
│   with the 27/40/60/80 breaks      RESIST     bleed 103 · poison 96 · toxic 92     │
│   marked as vertical hairlines                frost 88 · hollow-blight 81           │
│                                              SOUL MEMORY   BAND 08 (2.1–3.2M)       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.4.2 The Soft-Cap Curve Graph

Selecting any attribute (X/SQUARE) replaces the derived-stat column with a **live line graph** of that attribute's diminishing-returns curve:

- X axis: attribute 10 → 99
- Y axis: derived stat (HP, FP, load, scaling multiplier…)
- **Four vertical hairlines at 27 / 40 / 60 / 80** in `#E8C15A` at 40% opacity, each labeled
- A **dot** at the player's current value
- A **ghost dot** at value+1 with the delta shown: `+26 HP per point`
- The area under the curve beyond the current value renders at 12% opacity — *"what you have not bought"*

> **This graph is the single most important UI addition in the document.** It makes Vol. 2's cap doctrine *visible* and turns every level-up into an informed economic decision. In usability testing of the greybox UI, players who saw the graph made 34% fewer respec requests.

### 9.4.3 The Sigil Board

An 8-slot torso diagram (§1.5.3). Each filled slot is a black knot; hovering shows provenance text and mechanical effects. Empty slots render as faint scars. **The board is always visible on the Status screen, even at 0 Sigils** — so the player knows it exists before they ever take one.

---

## 9.5 — EQUIPMENT Screen

### 9.5.1 Layout

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  EQUIPMENT                                    WEIGHT 28.4 / 72.0   ▮▮▮▮▮░░ 39.4%  │
│  ────────────────────────────────────────────────────────── MID ROLL · 13f i-frames│
│                                                                                  │
│          ┌─ RIGHT HAND ─────────┐         [ CHARACTER ]        ┌─ LEFT HAND ────┐ │
│          │ R1  ⚔ Longsword +10 Q│         paperdoll with       │ L1  🛡 Lothric │ │
│          │ R2  🗡 Estoc +10 S    │         12 equipment slots   │     Shield     │ │
│          └──────────────────────┘         arranged anatomically │ L2  — empty —  │ │
│                                           (head, body, hands,  └────────────────┘ │
│          ┌─ POWER STANCE ────────────────────────────────┐       legs, R1, R2,     │
│          │  ⚔⚔  CROSS-DRAW                        ✔ READY │       L1, L2, arrows,  │
│          │  Longsword (Sword) + Estoc (Thrusting Sword)  │       bolts, 4 rings)   │
│          │  Requires  STR 18  ✔ 40     DEX 27  ✔ 40      │                        │
│          │  L1 Cross-Draw Slash   32 sta · ×1.44 · P28/3 │                        │
│          │  L2 Posture Break      44 sta · ×1.55 · P74/4 │                        │
│          │  Full chain cost: 112 / 112 stamina           │                        │
│          └───────────────────────────────────────────────┘                        │
│                                                                                  │
│   ARMOR                        WT     POISE   ABSORB (P/M/F/L/D)   DURABILITY     │
│   ────────────────────────────────────────────────────────────────────────────   │
│   Head   Ashen Knight Helm     3.4       4      6 / 3 / 4 / 4 / 3    ▮▮▮▮▮ 100%   │
│   Body   Ashen Knight Armor    8.2      10     18 / 7 / 9 /11 / 8    ▮▮▮▮▮ 100%   │
│   Hands  Ashen Knight Gauntl.  2.4       3      8 / 3 / 4 / 5 / 4    ▮▮▮▮░  84%   │
│   Legs   Ashen Knight Leggings 3.0       5     10 / 4 / 5 / 6 / 5    ▮▮▮▮▮ 100%   │
│   ────────────────────────────────────────────────────────────────────────────   │
│   SET BONUS (4/4)  +8% physical absorption while guarding                        │
│   SET STATE        ✔ MATCHED — no poise penalty                                  │
│   TOTAL ARMOR      17.0 wt  ·  22 poise  ·  +12 base = 34   (full set, no penalty) │
│                                                                                  │
│   RINGS                        WT     EFFECT                                     │
│   ────────────────────────────────────────────────────────────────────────────   │
│   1  Ring of Steel Protection +2  0.8   +12% physical absorption                 │
│   2  Chloranthy Ring +2           0.4   +25% stamina regeneration                │
│   3  Ring of Blades +2            0.2   +4 poise                                 │
│   4  Havel's Ring (Ashen)         0.0   +8% equip load capacity                  │
│                                                                                  │
│   AMMUNITION   Arrows —  ·  Bolts —                                              │
│                                                                                  │
│   ────────────────────────────────────────────────────────────────────────────   │
│   DERIVED    POISE 34 (Grade 1)  ·  THRESHOLD 88  ·  MITIGATION 17%              │
│              ROLL 13f i-frames / 38f total / 30 stamina                          │
│              SPRINT ✔  ·  FALL DAMAGE ×1.00                                      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.5.2 POWER STANCE Indicator — the full specification

This is the single most complex UI component in the game and it exists to solve the DS2 problem: **players could not tell why their dual-wield was or was not working.**

| Element | Position | Content | States |
|---|---|---|---|
| **Compatibility glyph** | On each R-slot and L-slot row, a 14 px glyph at the row's right edge | `⚔⚔` | **Gold `#E8C15A`** = compatible & requirements met · **Grey `#5A5A62`** = compatible but requirements NOT met · **Absent** = incompatible |
| **Compatibility line** | Detail panel, under "Requires" | `POWER STANCE ✔ compatible with L1 Estoc (Thrusting Sword)` or `✖ incompatible with L1 Lothric Knight Shield (Shield)` | 2 states + a "not applicable" state for catalysts/bows |
| **Requirement readout** | Detail panel | `Requires STR 18 ✔ 40 · DEX 27 ✔ 40` — each requirement rendered **green-check when met, amber-cross when not** | The `1.5×` multiplier is shown explicitly as `1.5× of max(12, 11) = 18` on hover |
| **Stance panel** | A dedicated 5-row block, always present on the Equipment screen when a compatible pair is equipped | Stance name (Cinzel 22 px gold), the pairing, both requirements, **both moves with stamina/motion-value/poise-grade**, and the **full-chain stamina cost vs. the player's stamina pool** | Hidden entirely if no compatible pair exists |
| **Active-stance HUD** | In-world, bottom-right weapon slot cluster | R1 and L1 rows **merge** into one 220×40 px row with `⚔⚔` and the stance name | See §9.1.3-I |
| **Stance-enter animation** | In-world | A **240 ms** gold edge-sweep across the merged slot row + a distinct metallic *shing* SFX | Fires once per stance entry; suppressed if entered/exited within 1 s (anti-spam) |
| **Class-family tooltip** | Hovering any weapon's class name | Shows the full compatibility row from Vol. 3 §3.6.2 as a 15×11 matrix with ✔/✖ | **This is where the compatibility matrix lives.** It is discoverable from any weapon in the game |

**Why the full-chain stamina cost is displayed.** Vol. 2 §2.7.5 established that Build A's posture-break chain costs *exactly* 112 stamina of a 112 pool. Showing `112 / 112` on the Equipment screen is the moment a player understands that their build is a precision instrument. **The UI is where the build fantasy becomes arithmetic, and arithmetic becomes mastery.**

### 9.5.3 Poise Display Specification

| Surface | Display |
|---|---|
| **Per armor piece** | `POISE` column, integer, EBG 20 px `#D0D0D8` |
| **Armor total** | `TOTAL ARMOR` row: `17.0 wt · 22 poise · +12 base = 34` — **the full derivation is shown, never just the result** |
| **Set state** | `✔ MATCHED — no poise penalty` or `✖ MIXED SET — −4 poise` in `#C8A03A` |
| **Derived block** | `POISE 34 (Grade 1) · THRESHOLD 88 · MITIGATION 17%` |
| **Grade explanation** | On hover: `Grade 1 — absorbs light (Grade 1) hits during attack animations, once per action. Grade 4 and 5 attacks always stagger you.` |
| **In-combat** | The **Poise Diamond** (§9.1.3-D) |
| **On the boss** | The boss's **posture bar** (§9.1.3-L) |

### 9.5.4 Infusion Status Specification

| Surface | Display |
|---|---|
| **Weapon slot row (HUD)** | Name + upgrade + **single-letter infusion code** in the infusion's color |
| **Weapon slot row (Equipment menu)** | Full infusion name in Cinzel 18 px, right-aligned: `QUALITY`, `HEAVY`, `DARK`, `ASHEN`… |
| **Detail panel header** | Infusion name at 26 px next to the weapon name |
| **Detail panel — scaling block** | **The scaling letters shown are POST-infusion**, and the pre-infusion letters render struck-through in `#5A5A62` beside them: `STR ~~C~~ → B` |
| **Detail panel — infusion effect** | A dedicated 2-line block: `QUALITY — STR and DEX each +1 letter, capped at B. Base AR −6%.` |
| **Detail panel — damage type** | If the infusion adds a damage type, the corresponding AR row lights up and gains a `+` prefix: `Fire  +174` |
| **Color code** | The 12 infusion colors from §9.1.3-I, used **identically** in HUD, menus, item renders' rim light, and the world's infusion VFX. **One color per infusion, everywhere, forever.** |

### 9.5.5 Equipment Slot Rules

| Slot | Count | Notes |
|---|---|---|
| Right hand | **2** (R1, R2) | Swap with D-pad up/down |
| Left hand | **2** (L1, L2) | Swap with D-pad up/down (independent axis) |
| Head / Body / Hands / Legs | 1 each | |
| Rings | **4** | 3 at start; the 4th unlocks at SL 60 or via the *Ring of Many Fingers* item |
| Arrows / Bolts | 1 each | 99 max stack per type, 2 types per slot |
| Quick items | **5** | §9.1.3-H |
| Gestures | **12** | §9.3 |
| Spells | 3–10 | From ATT (§4.1.1); **2 attunement pages** |

---

## 9.6 — MAGIC Screen

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  MAGIC                          ATTUNEMENT 22 · SLOTS 5 · FP 154   PAGE 1 / 2     │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  ATTONED SLOTS                                                                   │
│   ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                             │
│   │ 1  │ │ 2  │ │ 3  │ │ 4  │ │ 5  │   ← drag-and-drop or select-and-assign       │
│   │ ✦  │ │ ☀  │ │ ⌇  │ │ ⌂  │ │ —  │                                             │
│   │Heal│ │Oath│ │Forc│ │Home│ │empt│                                             │
│   │3/3 │ │2/2 │ │4/4 │ │3/3 │ │    │                                             │
│   └────┘ └────┘ └────┘ └────┘ └────┘                                             │
│                                                                                  │
│  SCHOOL FILTER   [ ALL ] [ SORCERY ] [ MIRACLE ] [ PYROMANCY ] [ HEX ]           │
│  ─────────────────────────────────────────────────────────────────────────────── │
│  KNOWN SPELLS (34)                          │  DETAIL                            │
│  ✦ Soul Arrow          SORC  INT 10  1 sl   │  DARK ORB                  HEX     │
│  ✦ Hidden Body         SORC  INT 16  1 sl   │  ─────────────────────────────     │
│  ☀ Heal                MIR   FTH 10  1 sl   │  [3D cast animation loop]          │
│  ☀ Oath of the Eclipse MIR   FTH 10  1 sl   │                                    │
│  ☀ Force               MIR   FTH 10  1 sl   │  Req      INT 14 · FTH 14          │
│  ⌇ Fireball            PYRO  8/8     1 sl   │  Slots    1                        │
│  ⌇ Power Within        PYRO  18/18   1 sl   │  FP       28                       │
│  ⬛ Dark Orb            HEX   14/14   1 sl   │  WANT     1 charge                 │
│  ⬛ Dark Weapon         HEX   20/20   1 sl   │  Uses     6 × 1.64 = 9 per rest    │
│  ⬛ Lifedrain Patch     HEX   28/28   1 sl   │  Damage   340 dark                 │
│  ⬛ Twisted Barrage     HEX   32/32   2 sl   │  Frames   48 / 5 / 18  (0.80 s)    │
│  ⬛ Affinity            HEX   36/36   2 sl   │  Cast     45f stationary           │
│  ⬛ Vow of Silence      MIR   FTH 40  2 sl   │           59f walking (×1.30)      │
│  …                                          │  Range    26 m · tracks 12°        │
│                                             │  Poise    —                        │
│  RESONANCE  ▮▮▮   rank 3 (Greymouthe II)    │  Effect   Dark projectile          │
│   1: +8% dark dmg · regen −1.0 s            │  Catalyst Dark Chime +5  SB 236     │
│   2: +18% · regen −2.0 s · Blight 25        │                                    │
│   3: +32% · regen −3.0 s · Grade ≤2 immune  │  POTENCY  236 × 1.070 = 253        │
│                                             │           (min 50 → J=1.070)       │
│  WANT CAPACITY  ●●●●○○○  4 / 7              │           (Δ 10 → contributes 0)   │
│   regen: 9.0 s out of combat · 24 s in      │                                    │
│                                             │  "A dark orb conjured from the      │
│                                             │   Want itself. It does not so       │
│                                             │   much strike as subtract."        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Key features:**
- **The potency derivation is shown in full.** `236 × 1.070 = 253` with the sub-terms labeled. Vol. 4's hex formula is not hidden.
- **Cast time is shown for both stationary and walking**, because that is the real decision (§4.2.1).
- **Uses are shown as `base × multiplier = result`**, so the player sees exactly what their INT/FTH bought.
- **The Resonance ladder is rendered as three knots** matching the HUD (§9.1.3-F), with each rank's full effect listed.
- **Page 1 / Page 2** toggle at the top right; each page holds a full attunement set (§4.1.3).

---

## 9.7 — Accessibility

| Category | Feature | Default |
|---|---|---|
| **Vision** | HUD scale 70–130% | 100% |
| | HUD opacity 30–100% | 100% |
| | Numerals on all bars (HP/FP/STA) | Off |
| | **Colorblind modes**: Deuteranopia / Protanopia / Tritanopia — full palette remap of the 5 damage types, 12 infusion colors, and 15 status icons | Off |
| | Damage-type icon shapes (in addition to color): SLASH `/` · STRIKE `●` · PIERCE `→` · FIRE `▲` · DARK `◆` — **on all reticles, part indicators, and infusion codes** | **On** |
| | High-contrast mode (all HUD elements gain a 2 px black outline) | Off |
| | Text size 100–160% (affects menus only, not HUD) | 100% |
| | **Screen reader** for all menus (full TTS navigation) | Off |
| **Hearing** | Subtitles (all dialogue, all item text on request) | On |
| | Subtitle speaker names + background captions | On |
| | **Visual audio cues**: every SFX-reliant telegraph (Vharos's choir inhale, Karrag's lava groan, Nihilanthos's stone scrape) gains an optional screen-edge directional flash | Off |
| | Mono audio, per-channel volume sliders (music / SFX / voice / ambient — 4 channels) | — |
| **Motor** | Full button remap (all 4 platforms) | — |
| | Hold-to-press and press-to-hold toggles for every button | Off |
| | **Toggle sprint, toggle guard, toggle lock-on** | Off |
| | Roll on a dedicated button (frees the dodge from the stick click) | Off |
| | Input buffering window 0–8 frames (default 4) | 4f |
| | **One-handed preset** (all actions mapped to a single controller half) | Off |
| **Cognitive** | **Region objective hints** — a single line at the top-right after 20 minutes without a bonfire: *"The sluice wheels in the north nave change the water level."* | Off |
| | Boss move names displayed on the boss bar after 3 deaths to that boss | Off |
| | **Death recap** — a 4 s replay of the killing blow with the move name and damage breakdown | Off |
| | Map with player-authored waypoints | Off |
| | Item text always visible in the world (no interaction required) | Off |
| **Difficulty-adjacent** *(not a difficulty slider — these are targeted, and each is documented as such)* | **Ashen Absolution** (§7.4.7) — removes one Ascetic rank | 1 per playthrough |
| | **Hidden Blessing** (§7.3) — protects a bloodstain from a second death | 3 max |
| | **Offline mercy** (§7.3) — invisible, one-shot per boss | Automatic |
| | Severed boss parts persist across attempts | **On** (toggle to revert) |
| | **No toggle exists for**: boss damage, player HP, i-frames, poise thresholds, cap curves. *These are the game.* | Locked |

> **Position statement.** *Convergence* does not ship a difficulty slider. It ships **47 accessibility options and one opt-in difficulty system (Ascetics)**. The distinction is deliberate: a slider changes the game's numbers and therefore its design; accessibility options change how the game *communicates* its numbers, and Ascetics change the numbers only where the player explicitly asks. **The game must be beatable by anyone who can hold a controller. It must not be beatable by anyone who has not learned it.**

---

## 9.8 — Confirmation Dialogs & Destructive Actions

| Action | Confirmation | Type |
|---|---|---|
| Level up | None | Instant |
| Equip / unequip | None | Instant |
| Attune spell | None | Instant (bonfire only) |
| Flask allocation | None | Instant, freely reversible |
| Drop item | Single confirm | Modal |
| **Infuse a weapon** | Single confirm: *"Infusion consumes the stone and cannot be undone without a second stone. Quality → Heavy?"* | Modal |
| **Weapon Art rank purchase** | Single confirm | Modal |
| **Burn an Ascetic** | **Two-stage**: (1) *"The world will not recover from this. Region: Sunken Cathedral. Rank: A3. Effects: enemy HP ×1.95, damage ×1.40, boss gains new phase behavior, biome variant swap, one NPC questline locks permanently. Continue?"* (2) **3-second hold-to-confirm** with a filling ring | Hold |
| **Sit on the Throne of Want** | **The only confirmation in the game with narrative text**: *"The world will not end. Nothing in it will ever change again. Sit?"* (§1.7.2) | Hold, 5 s |
| **Kill a Kindled Echo** | Two-stage with the world-event warning (§1.4.3) | Hold |
| **Use the Ashen Brand** | None. **It is the ending. It should not ask.** | Instant |
| Delete save | Triple confirm with the character name typed | Type |

---

## 9.9 — Iconography Standards

| Domain | Rule |
|---|---|
| **Damage types** | 5 types, 5 shapes, 5 colors — never conflated. Physical `□ #D0D0D8` · Magic `△ #7FB2E8` · Fire `▲ #E8763A` · Lightning `◇ #E8C15A` · Dark `◆ #6B3FA0` |
| **Severance damage requirements** | SLASH `/` · STRIKE `●` · PIERCE `→` · FIRE `▲` — rendered on the lock-on reticle (§9.1.3-M) and in the boss bar's severance pips |
| **Poise grades** | 1–5 as pip counts: `▪ ▪▪ ▪▪▪ ▪▪▪▪ ▪▪▪▪▪` in `#8A8A96`, with Grade 5 always in `#E8C15A` |
| **Weapon classes** | 21 silhouettes, all drawn on a 24×24 grid with a 2 px stroke, all recognizable at 16 px. **No class may share a silhouette family with another** — a greatsword and an ultra greatsword differ by blade-to-grip ratio, which is visible at 16 px |
| **Status icons** | 24×24, single-color on transparent, with a 1 px darker outline. Curse is the only inverted-color icon |
| **Infusion codes** | Single uppercase letter, always in the infusion's color (§9.5.4) |
| **Covenant colors** | Sunlight `#E8C15A` · Darkwraith `#6B3FA0` (with `#1A1A1A` shadow) · Blue Sentinels `#4A7FC4` · Dragon Remnants `#8A8A96` · Forest Guardians `#5A8E4A` |
| **Region icons** | 14 glyphs, each derived from the region's dominant geometry (a chair, an anvil, a crown, a rib…) |
| **Grid** | All icons drawn on a 24 px grid, 2 px stroke, 2 px corner radius, exported at 1×/1.5×/2×/3× |
| **Motion** | Icon animations are limited to **opacity, scale (≤1.08×), and translation (≤4 px)**. No rotation, no particle effects, no color cycling |

---

## 9.10 — Technical Implementation

| Concern | Spec |
|---|---|
| **Framework** | Immediate-mode HUD layer on top of the retained-mode menu framework. HUD is 100% data-driven (`hud_layout.json`); no HUD element is hardcoded |
| **Resolution independence** | All positions/sizes in **VH-relative units** (1 VH = 1% of viewport height), authored at the 1920×1080 reference and converted at build time |
| **Ultra-wide** | 21:9 and 32:9 supported. HUD anchors to the corners of a **16:9 safe box centered on screen**, not to the physical screen edges — so a 32:9 player's HUD is not 800 px from the action |
| **Draw calls** | ≤ 42 for the full HUD; batched into 3 atlases (bars, icons, text) |
| **Frame budget** | ≤ 0.35 ms |
| **Localization** | 12 languages. All HUD text is in the string table; **no text is baked into textures**. Longest-string growth budget: **+38%** (German/Russian), with auto-shrink from 100% → 88% → 76% before truncation |
| **Color pipeline** | All HUD colors are authored in **sRGB and converted to linear at runtime**; the colorblind remap is a 3×3 LUT applied post-authoring so it never breaks the design palette |
| **Accessibility** | All 47 options are first-class settings, persisted per-save, and **testable in CI** (an automated suite runs every accessibility combination against a reference playthrough) |
| **Telemetry hooks** | Every HUD state transition is logged (opt-in balance telemetry) — specifically: glance duration (eye-tracking on PC dev builds), menu depth per session, and time-in-equipment-screen. The Equipment screen's dwell time is the primary indicator of whether §9.5's Power Stance panel is being used |
| **Input model** | A single `UIInputAction` abstraction over keyboard/mouse, DualSense (with adaptive trigger feedback on the Poise Diamond absorb), Xbox controller, and Switch Pro. Adaptive triggers: L2 resistance increases proportionally to stamina debt |

---

## 9.11 — UI Verification Checklist (ship gate)

| # | Check | Pass condition |
|---|---|---|
| 1 | One-glance test (§9.2.3) | ≤175 ms worst case, ≤120 ms typical |
| 2 | Poise Diamond comprehension (§3.7.3, G7) | ≥90% of players predict their absorb within 2 regions |
| 3 | Power Stance comprehension | ≥85% of players can explain the 1.5× rule after one Equipment-screen visit |
| 4 | Infusion comprehension | ≥80% can state what their infusion changed, unprompted |
| 5 | Soft-cap graph utility | ≥70% consult it before a level-up by Act II |
| 6 | Colorblind pass | All 5 damage types and 12 infusions distinguishable in all 3 modes **and** in grayscale (via shape codes) |
| 7 | Screen-reader pass | 100% of menu functions reachable and describable |
| 8 | One-handed preset pass | The first region completable with the preset |
| 9 | Localization overflow | No truncation at +38% string growth in any of 12 languages |
| 10 | Ultra-wide pass | HUD within the 16:9 safe box at 32:9; no element off-screen |
| 11 | Frame budget | ≤0.35 ms HUD, ≤42 draw calls, at 4K |
| 12 | No-blink rule (U3) | Zero flashing elements during any combat state |
| 13 | Confirmation coverage | All 8 destructive actions confirmed; the two narrative ones hold-to-confirm |
| 14 | Menus-are-safe (U5) | No menu can be opened mid-attack; no menu causes damage |

---

# APPENDIX — END OF DOCUMENT

## Cross-Volume Consistency Register

Every number that appears in more than one volume, with its canonical source. Any change must be applied to all listed locations.

| Value | Canonical source | Also appears in |
|---|---|---|
| Level = Σ attributes − 90 | Vol. 2 §2.1 | Vol. 0 §0.6, Vol. 8 §8.2.4 |
| SL125 = 215 attribute points | Vol. 2 §2.1 | Vol. 2 §2.7–2.9, Vol. 8 |
| Soft-cap breakpoints 27/40/60/80 | Vol. 2 §2.1.1 | Vol. 2 §2.4.1, Vol. 9 §9.4.2 |
| Roll tiers 30% / 70% / 100% | Vol. 3 §3.7.4 | Vol. 0 §0.5, Vol. 2 §2.3.6, Vol. 9 §9.5 |
| Roll i-frames 16 / 14 / 12 (at ADP 16, per roll tier) | Vol. 3 §3.1.3 | Vol. 2 §2.3.9, Vol. 9 §9.5.1 |
| ADP functional cap = 40, i-frame ceiling 16f | Vol. 2 §2.3.9 | Vol. 3 §3.1.3, Vol. 0 §A.6 |
| True poise grades at 30 / 60 / 90 | Vol. 3 §3.7.2 | Vol. 0 §A.2, Vol. 2 §2.9.5, Vol. 9 §9.5.3 |
| Hyper-armor lock = 1 absorb per action | Vol. 3 §3.7.1 | Vol. 0 §A.2, Vol. 9 §9.1.3-D |
| Poise mitigation cap 0.70 | Vol. 3 §3.7.2 | Vol. 0 §A.2, Vol. 2 §2.4.1 |
| Poise grades 1–5 damage bands | Vol. 3 §3.5 | Vol. 0 §A.2, Vol. 6 (all bosses), Vol. 9 §9.9 |
| Power Stance 1.5× requirement | Vol. 3 §3.6.1 | Vol. 2 §2.3.4, Vol. 2 §2.7.5, Vol. 9 §9.5.2 |
| Posture non-stance accrual rate 0.40× | Vol. 3 §3.6.4 | Vol. 6 §6.1.4 (move 9) |
| Hex formula `J(min) + 0.4·J(Δ)` | Vol. 4 §4.6.2 | Vol. 2 §2.8.3, Vol. 9 §9.6 |
| Resonance 1/2/3 = +8%/+18%/+32% | Vol. 4 §4.6.3 | Vol. 2 §2.8.7, Vol. 9 §9.1.3-F |
| Want capacity base 3, max 7 | Vol. 4 §4.6.1 | Vol. 2 §2.8.4, Vol. 9 §9.1.3-G |
| Spell slots = 2 + floor(ATT/6), max 10 | Vol. 4 §4.1.1 | Vol. 2 §2.3.2, Vol. 9 §9.6 |
| Estus charges max 15 (16 in Sunlight co-op) | Vol. 7 §7.1.1 | Vol. 2 §2.9, Vol. 8 §8.2.2, Vol. 9 §9.1.3-J |
| Life Gem diminishing −6%/use, floor 40% | Vol. 7 §7.1.3 | Vol. 9 §9.6 |
| Ascetic multipliers ×1.25/1.56/1.95/2.44 HP | Vol. 7 §7.4.3 | Vol. 0 §A.7, Vol. 6 §6.2.7, Vol. 8 §8.5 |
| Convergence Clock deltas (+1/−5/−10) | Vol. 5 §5.8 | Vol. 0 §A.5, Vol. 7 §7.5, Vol. 9 §9.1.3-K |
| 31 severable parts, 13 bosses | Vol. 3 §3.9.3 | Vol. 0 §0.5, Vol. 6 §6.1.9/6.2.8/6.3.9 |
| Session max = host + 3 co-op + 2 invaders | Vol. 8 §8.2.1 | Vol. 9 (multiplayer menu) |
| Invasion reaction delays 10–18f | Vol. 6 (per boss) | Vol. 3 §3.12 |
| 78 bonfires, 14 regions, 22 bosses | Vol. 5 §5.4.0 | Vol. 0 §0.5, Vol. 7 §7.10 |
| 40 viable archetypes, ≤18% spread | Vol. 2 §2.6 | Vol. 0 §A.9, Vol. 6 (all fairness audits) |

---

## Document Control

| | |
|---|---|
| **Title** | Dark Souls: Convergence of Ash & Want — Master Game Design Document |
| **Version** | 1.0 (publication-grade) |
| **Volumes** | 10 (0–9) |
| **Total specified systems** | 9 major, 47 subsystems |
| **Data tables** | 261 (plus 54 fenced specification blocks) |
| **Named content** | 186 weapons · 71 armor sets · 130 spells · 96 rings · 22 bosses · 29 NPCs · 5 covenants · 14 regions · 78 bonfires · 31 severance parts · 34 gestures · 6 endings |
| **Design-locked values** | 14 (enumerated in Vol. 2 §2.11 and Vol. 3 §3.6.4) |
| **Balance knobs** | 47 live-tunable |
| **Ship gates** | G1–G7 (combat) + 14 UI checks + 5 multiplayer telemetry gates |
| **Owner** | Principal Game Designer / Lead Combat Architect / Lead Worldbuilder |
| **Review cycle** | Vertical Slice → Combat Alpha → Content Complete → Beta → Ship. Each volume re-reviewed at every gate. |

---

*End of the Master Game Design Document.*
*"And so the Flame was neither linked, nor throned, nor taken. It was divided."*
