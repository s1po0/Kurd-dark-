# VOLUME 5 — WORLD MAP & INTERCONNECTIVITY

> **Design owner:** Lead Worldbuilder / Level Director
> **Depends on:** Vol. 1 (region narrative briefs), Vol. 3 (traversal grammar) · **Feeds:** Vol. 6 (arena placement), Vol. 7 (bonfire/Ascetic placement), Vol. 8 (covenant territories)

---

## 5.0 — World Design Doctrine

Three rules govern every square meter of Lothranor. They are non-negotiable and they are the reason this is a *Souls* world rather than an open one.

> **D1 — NO LOADING SCREENS.** The entire playable world is one continuous streamed volume. There are no zone instances, no corridors-that-are-actually-loads, no fade-to-black between regions. The single exception is documented in §5.6.4 and is a deliberate narrative beat.
>
> **D2 — NO LEVEL GATES.** Every region is reachable from the hub within the first 90 minutes of play, including the endgame. What stops you is not a gate; it is that the enemies there will kill you in one hit. **Knowledge is the gate, difficulty is the signpost.**
>
> **D3 — EVERY REGION CONNECTS TO AT LEAST THREE OTHERS.** No dead ends. No "hub-and-spoke" world. The map is a graph with minimum degree 3, and it must be traversable in a loop from any starting point.

### 5.0.1 The Fusion, Specifically

| Import | What it gives the world |
|---|---|
| **DS1 seamless verticality** | The world is a *single physical object* you can walk around and through. Lordran's genius was that you could see the Undead Burg from Firelink and then, ten hours later, walk back down into it and feel the geometry click. We reproduce this at 3× the scale. |
| **DS2 biome diversity** | Drangleic proved that a Souls world could contain a flooded cathedral, a volcanic castle, a frozen crypt, and a dragon shrine without losing coherence — as long as each biome has one *legible rule*. Every region here has exactly one rule the player learns in 3 minutes (§5.4). |
| **DS3 hub-and-teleport** | We take the *warp* (unlocked after 3 bonfires) but we **do not** take the hub-and-spoke topology. Warping is a convenience layered over a genuinely contiguous world, never a replacement for it. |

---

## 5.1 — World Scale & Technical Streaming Spec

### 5.1.1 Dimensions

| Property | Value |
|---|---|
| Total playable area | **2.61 km²** (2,610,000 m²) |
| Horizontal extent | 2,180 m (E–W) × 1,640 m (N–S) |
| **Vertical extent** | **1,140 m** — from The Want Beneath (−460 m) to The Convergence (+680 m) |
| Regions | 14 (13 surface, 1 inverted) |
| Bonfires | 78 |
| Elevators | 22 (11 major, 11 minor) |
| Documented shortcuts | 96 (34 one-way drops, 26 kickable ladders, 20 gated doors, 16 lifts/bridges) |
| Longest uninterrupted walk (no death, no combat) | **41 minutes** — Ashen Barrens → Sunken Cathedral → Ember Keep → back to Sanctuary via the Serpent Viaduct |
| Longest vertical climb | 612 m — The Want Beneath floor → The Convergence spire (the *Long Stair*, 1,404 steps) |

### 5.1.2 Streaming Architecture

```
WORLD = one continuous volume, single global coordinate space, no sub-levels.

CHUNKING
  Cell size:            96 m × 96 m × 96 m  (cubic octree, 6 levels deep)
  Active cells:         3×3×3 = 27 cells around the player (±144 m)
  Preload ring:         cells 4–6 out, streamed at LOD1, resident in RAM
  Distant LOD:          cells 7–14, impostor meshes + baked lighting, 240 m draw distance
  Memory budget:        3.2 GB streaming pool (PS5/Series X), 2.4 GB (PC min), 1.4 GB (Switch 2)
  Cell load time:       ≤ 5.5 ms on NVMe (target), ≤ 14 ms on SATA (fallback: LOD swap, never a stall)

VELOCITY-AWARE PRELOAD
  Preload direction is biased by player velocity vector (70% weight) + lock-on camera facing (30%).
  Sprinting (420 u/s) triggers preload at cell distance 7 instead of 4.
  Falling triggers a 90° widening of the preload cone downward — the single most common hitch source
  in prior games, and the reason we budget 2× the normal cell count during any fall > 12 m.

NO INVISIBLE WALLS. Ever.
  Where the world must end, it ends in: water you cannot cross (drowning damage exists),
  a cliff you cannot climb, ash too deep to walk (movement −80%), or the sky.
  Every boundary is a physical, visible, diegetic fact.

OCCLUSION
  Fully baked + dynamic hybrid. Interiors use portal volumes with hand-authored portal planes
  (2,900 portals). This is what makes zero-load interiors possible at 60 fps.

AUDIO STREAMING
  Region-specific reverb impulse responses are crossfaded over 8 m "acoustic seams."
  The player hears the next region before they see it. This is the primary navigation aid
  and it is more important than any map marker.
```

### 5.1.3 The 60 fps Guarantee

| System | Budget per frame (16.67 ms) |
|---|---|
| Render (GPU) | 11.0 ms |
| Animation + physics (CPU, 4 threads) | 3.1 ms |
| **Streaming (CPU, 2 dedicated threads)** | **≤ 0.8 ms amortized; hard-stall threshold 4 ms** |
| AI (up to 40 active agents) | 1.4 ms |
| Audio | 0.6 ms |
| Netcode (host) | 1.2 ms |
| **Headroom** | **≥ 1.5 ms** |

If streaming exceeds the hard-stall threshold twice in one second, the system drops to **LOD-swap mode** (geometry pops in at reduced detail, textures stream later) rather than stalling. **A visible pop-in is always preferable to a dropped frame** — this is the ordering decision that makes D1 achievable.

---

## 5.2 — Interconnectivity Rules

### 5.2.1 The Shortcut Grammar

Every shortcut in the game is one of six types, and each teaches the player a different thing about the world.

| Type | Count | Behavior | What it teaches |
|---|---|---|---|
| **One-way drop** | 34 | Jump down; cannot return | "The world has depth, and depth is one-way." |
| **Kickable ladder** | 26 | Kick down from above; climb from below | "I was here before. I am above where I started." |
| **Gated door** | 20 | Locked from one side; opened from the other | "This door I couldn't open is 40 m from where I began." |
| **Elevator (major)** | 11 | Two-way, 20–90 s ride, **streams the destination during the ride** | "The world is taller than I can see." |
| **Bridge/causeway** | 9 | Activated by a lever; permanently connects two regions | "I built this connection." |
| **Serpent passage** | 6 | Narrow tunnels *inside* the Ouroboros's body (§1.4.2) | "The world is one animal." |

**The rule of the first shortcut.** Every region's *first* shortcut must open within 6 minutes of entering it, and must connect back to that region's first bonfire. This is the DS1 lesson: the player's first experience of a region should be "I looped back," not "I got lost." The second shortcut may take 40 minutes. The third may take the whole playthrough.

### 5.2.2 Sightline Doctrine

Every region contains at least **three long sightlines** to other regions, and every one of them is a place the player will eventually stand.

| From | You can see | Distance | When you get there |
|---|---|---|---|
| Ashen Barrens (start) | The Eclipse Sanctuary's half-sun | 1,240 m | 25 min later |
| Eclipse Sanctuary balcony | Ember Keep's volcano | 1,860 m | 3 h later |
| Eclipse Sanctuary balcony | The Winter's Veil glacier | 2,110 m | 5 h later |
| Sunken Cathedral nave | The Convergence spire, *through the water* | 2,600 m | 30 h later |
| Ember Keep summit | The Ashen Barrens, where you woke | 1,940 m | — |
| The Want Beneath floor | **All thirteen surface regions at once, from below** | up to 2,400 m | Final act |

> The last one is the game's most important view and it is the reason the inverted region exists as *geometry* rather than as a separate level. **You look up and see the entire game you played, from underneath.** No cutscene in this document does what that sightline does.

### 5.2.3 Elevation as Narrative

The world's vertical structure is its argument.

| Elevation band | Regions | Meaning |
|---|---|---|
| **+680 to +400 m** | The Convergence, Iron Eclipse Foundry | Where things are *made* and where they *end* |
| **+400 to +120 m** | Ember Keep, Dragon Remnant Shrine, Bastion of the Blue Sentinels | Fire, dragons, gods — the old powers, all up high |
| **+120 to −40 m** | Eclipse Sanctuary, Grave of Names, Grave of Kings, Ashen Coast, Verdant Rot | The human band. Where the dead are kept. |
| **−40 to −220 m** | Sunken Cathedral, Winter's Veil | Drowned and frozen. Where the world is being *buried* |
| **−220 to −460 m** | The Want Beneath | Where the world's appetite lives |

**Rule:** the player starts at −10 m (Ashen Barrens) and the first thing they do is climb 130 m to the Sanctuary. **The game begins with an ascent, and the final act is a descent.** Every Souls game has done this; we do it with 1.1 km of real, walkable elevation.

---

## 5.3 — HUB: THE ECLIPSE SANCTUARY

### 5.3.1 Concept

A cathedral-city built inside the ring of a **permanent solar eclipse**. The sun is half-swallowed by a black disc that has not moved in an age. Because the eclipse never resolves, the Sanctuary exists in three lighting states simultaneously — and the *three ages* are visible as three light temperatures:

| Zone of the Sanctuary | Light | Age dominant | What lives there |
|---|---|---|---|
| **The Gold Quarter** (east) | Warm, 3200 K | Lordran | Fire, the cinder-heart, Ysolde, Warriors of Sunlight |
| **The Grey Nave** (center) | Neutral, 5600 K | Lothric | The bonfire, Vhenn's forge, the warp shrine, the level-up font |
| **The Green Undercroft** (below) | Cold, 7100 K + bioluminescence | Drangleic | Greymouthe, the hex vendors, the covenant of the Deep, the Ascetic kiln |

The player can stand in the center of the Nave and see all three. **This is the entire premise of the game rendered as architecture**, and it is the first thing they see after the tutorial.

### 5.3.2 Sanctuary Layout (ASCII)

```
                                   ▲ N  (+132 m elevation)
   ┌────────────────────────────────────────────────────────────────────────────┐
   │                        THE GOLD QUARTER  (Lordran light)                    │
   │   ┌──────────────┐        ┌─────────────────────────┐    ┌──────────────┐  │
   │   │ SUNLIGHT     │        │  THE CINDER-HEART       │    │ THE SMALL    │  │
   │   │ CHAPEL       │◄──────►│  (Ysolde)               │◄──►│ SUN's ROOM   │  │
   │   │ [WofSunlight]│  stair │  ┌───────────────────┐  │    │ [Echo #5]    │  │
   │   └──────┬───────┘        │  │ THE LAST FLAME    │  │    └──────┬───────┘  │
   │          │                │  │  (fist-sized)     │  │           │          │
   │          │                │  └───────────────────┘  │           │          │
   │          │                └────────────┬────────────┘           │          │
   └──────────┼─────────────────────────────┼─────────────────────────┼──────────┘
              │                             │                         │
              │  ┌───────────────  GREAT DOOR (one-way from Barrens)  │
              │  │
   ┌──────────┼──┴───────────────────────────────────────────────────┼──────────┐
   │          │           THE GREY NAVE  (Lothric light)             │          │
   │          ▼                                                      ▼          │
   │   ┌─────────────┐   ┌──────────────────────┐   ┌──────────────────────┐   │
   │   │ WARP SHRINE │   │  THE CENTRAL BONFIRE │   │  VHENN'S FORGE       │   │
   │   │ (7 fonts,   │   │  ★ LEVEL-UP FONT     │   │  [Echo #4]           │   │
   │   │  unlock @3) │   │  ★ REST / ATTUNE     │   │  upgrades · infusion │   │
   │   └──────┬──────┘   │  ★ ESTUS ALLOCATION  │   │  transposition       │   │
   │          │          │  ★ ASCETIC BURNING   │   │  Ascetic binding     │   │
   │          │          └──────────┬───────────┘   └──────────┬───────────┘   │
   │          │                     │                          │               │
   │   ┌──────┴───────────┐  ┌──────┴──────────┐   ┌───────────┴────────────┐  │
   │   │ SIR ALDWIN'S     │  │ THE REFECTORY   │   │ THE MESSAGES WALL      │  │
   │   │ POST [Echo #2]   │  │ (NPC gathering; │   │ (player messages       │  │
   │   │ Blue Sentinels   │  │  12 seats)      │   │  rendered physically)  │  │
   │   └──────┬───────────┘  └──────┬──────────┘   └────────────────────────┘  │
   └──────────┼─────────────────────┼──────────────────────────────────────────┘
              │                     │
              │   ┌───────────────  THE DESCENDING STAIR (1,404 steps total)
              ▼   ▼
   ┌────────────────────────────────────────────────────────────────────────────┐
   │                  THE GREEN UNDERCROFT  (Drangleic light, −38 m)             │
   │   ┌────────────────┐   ┌──────────────────┐   ┌────────────────────────┐   │
   │   │ GREYMOUTHE'S   │   │ THE ASCETIC KILN │   │ THE DEEP CISTERN       │   │
   │   │ HEXSTOOL       │   │ (burn Ascetics   │   │ [Darkwraith covenant]  │   │
   │   │ [Echo #3]      │   │  here OR at any  │   │  ↓ leads to            │   │
   │   │ Resonance tutor│   │  bonfire)        │   │  THE WANT BENEATH      │   │
   │   └────────┬───────┘   └────────┬─────────┘   └───────────┬────────────┘   │
   │            │                    │                         │                │
   │            └────────────────────┴─────────────────────────┘                │
   └────────────────────────────────┬───────────────────────────────────────────┘
                                    │
   ═════════════════════════════════▼═══════════════════════════════════════════
      THE GREAT SERPENT VIADUCT  — a bridge-tunnel that IS the Ouroboros's spine
      (players cross it 3× without realizing; see §5.5)
   ════════════════════════════════════════════════════════════════════════════
```

### 5.3.3 Sanctuary Facilities

| Facility | NPC | Function | Volume ref |
|---|---|---|---|
| **Central Bonfire / Level-Up Font** | — | Level up, rest, attune, allocate Estus/Life Gems, warp (after 3 bonfires) | §2.5, §7.1 |
| **Vhenn's Forge** | Vhenn *(Echo #4)* | Weapon upgrade, **infusion**, **transposition**, Ascetic binding, the one respec | §2.4.3, §7.6 |
| **The Cinder-Heart** | Ysolde *(Echo #1)* | Estus reinforcement, reverse hollowing, Purge rite, the Relink ending gate | §1.5, §7.1 |
| **Greymouthe's Hexstool** | Greymouthe *(Echo #3)* | Hex vendor, **Resonance tutor** (ranks 1→3), Dark Sigil application | §4.6.3 |
| **The Sunlight Chapel** | The Small Sun *(Echo #5)* | Warrior of Sunlight covenant, co-op summoning tutorial, Sacred Oath | §8.5 |
| **Sir Aldwin's Post** | Sir Aldwin *(Echo #2)* | Blue Sentinels covenant, auto-summon defense, Oathstone | §8.5 |
| **The Deep Cistern** | (unnamed) | Darkwraith covenant; the physical entrance to The Want Beneath | §8.5 |
| **The Ascetic Kiln** | — | Burn Ascetics at the hub to affect *any* region you have visited | §7.4 |
| **The Refectory** | 12 rotating NPCs | The NPC social space; questlines visibly converge here | §5.3.5 |
| **The Messages Wall** | — | All player messages in your session rendered as physical carvings on one wall | Vol. 8 |
| **The Warp Shrine** | — | 7 warp fonts, unlocked progressively | §5.7 |

### 5.3.4 Hub Evolution

The Sanctuary **changes** across the playthrough. This is not decoration; it is the world-state readout.

| Act | Change | Trigger |
|---|---|---|
| **I** | Empty. 4 NPCs. The eclipse is a thin crescent of gold. | Game start |
| **I (after 3 bonfires)** | Warp Shrine activates. The Refectory's first 3 seats fill. | 3 bonfires lit |
| **II (after first Crown)** | The Gold Quarter's braziers light. Warrior of Sunlight becomes joinable. | Sunken Cathedral boss dead |
| **II (after second Crown)** | The Undercroft floods ankle-deep with black water. Greymouthe arrives. Darkwraith becomes joinable. | Ember Keep boss dead |
| **II (after third Crown)** | The eclipse darkens to a full black disc with a red rim. **Ash begins falling inside the Sanctuary.** | Winter's Veil boss dead |
| **III** | Half the Refectory seats are empty (NPCs have left or died). Aldwin's post is unmanned if he died. | Grave of Kings entered |
| **III (late)** | The cinder-heart is visibly smaller. Ysolde sits closer to it. The Messages Wall has grown to cover the whole wall. | 2 bosses from end |
| **Post-ending** | Varies by ending — see below | Ending chosen |

**Post-ending Sanctuary states:**

| Ending | Sanctuary after |
|---|---|
| *Kindled Relink* | Gold light floods everything. The eclipse ends. All five Echoes' chairs are empty and warm. |
| *Cold Relink* | Nothing changes. The ash keeps falling. Ysolde's chair is empty. |
| *Throne of Want* | The Sanctuary is **frozen mid-motion** — banners hang still, the eclipse is a black hole, and every NPC stands exactly where they were, forever, and can still be spoken to. |
| *Usurper of the Abyss* | The Sanctuary inverts. You now stand on the ceiling. The black disc is a **sun**. |
| ***The Severance*** | The Sanctuary is the only unchanged place — but through its three doors you can see **three different skies**. A fourth bonfire appears. |

### 5.3.5 The Refectory (the NPC convergence engine)

The Refectory has 12 seats and 29 NPCs with questlines. **At any time, up to 12 are seated**, chosen by a priority function:

```
seat_priority(npc) =
    questline_urgency(npc)          // 0–10, peaks when the player is one step from a branch
  + 3 × (npc has new dialogue)
  + 2 × (npc's region is currently Ascetic-active)
  − 5 × (npc was seated last visit)  // rotation forcing
```

**Design purpose:** in prior Souls games, NPC questlines failed silently because players could not find the next step. The Refectory *physically assembles* the NPCs who currently have something to say to you, in one room, next to the hub bonfire. It is the single largest quality-of-life addition in *Convergence*, and it is entirely diegetic: they are having dinner.

NPCs at the Refectory **talk to each other**, and 41 of those conversations are unique pairs that reveal lore. Two NPCs who hate each other will not sit adjacent — the seating solver respects a 29×29 affinity matrix.

---

## 5.4 — Region Specifications

### 5.4.0 Region Index

| # | Region | Age | Biome | SL band | Bonfires | Bosses | Elevation | Covenant |
|---|---|---|---|---|---|---|---|---|
| 01 | **Ashen Barrens** | Ash | Grey dune field, mass graves | 1–14 | 4 | 1 (+1 optional) | −10 to +40 m | — |
| 02 | **Eclipse Sanctuary** | All | Cathedral-city, eclipse | 1–15 | 4 | 0 | +90 to +132 m | All 5 (joinable) |
| 03 | **Grave of Names** | Souls | Cemetery, blank stones | 12–28 | **6** | 1 (+1) | +20 to +110 m | Blue Sentinels |
| 04 | **Sunken Cathedral** | Want | Flooded basilica | 28–48 | **8** | 2 (+1) | −40 to −120 m | Darkwraith |
| 05 | **Ember Keep** | Fire/Ash | Volcanic iron castle | 44–62 | **8** | 2 | +180 to +430 m | Warriors of Sunlight |
| 06 | **Winter's Veil / Frozen Crypts** | Souls | Glacier + buried city | 52–70 | **7** | 2 (+1) | −60 to −210 m | — |
| 07 | **Dragon Remnant Shrine** | Fire | Mountain shrine, dragon corpse | 64–80 | **6** | 1 (+2) | +300 to +520 m | Dragon Remnants |
| 08 | **The Verdant Rot** | Want | Encroaching forest | 30–50 | 4 | 1 | −20 to +60 m | Forest Guardians |
| 09 | **Bastion of the Blue Sentinels** | Souls | Cliff fortress | 40–58 | 4 | 1 (+1) | +120 to +260 m | Blue Sentinels |
| 10 | **Iron Eclipse Foundry** | Ash | Industrial forge-city | 60–78 | **6** | 1 (+1) | +400 to +620 m | — |
| 11 | **Grave of Kings** | Souls | Subterranean royal necropolis | 74–92 | **7** | 2 | −80 to −190 m | Darkwraith |
| 12 | **The Ashen Coast** | Ash | Beached sea, upright ships | 66–86 | **5** | 1 (+1) | −30 to +20 m | — |
| 13 | **The Want Beneath** | Want | **Inverted world** | 90–115 | **6** | 2 (+1) | −220 to −460 m | Darkwraith / Abyss |
| 14 | **The Convergence** | All | The seam, the spire, the Long Stair | 105–125 | 3 | 1 (final) | +430 to +680 m | — |
| | **TOTAL** | | | | **78** | **22 (+11 optional)** | | |

> **Bonfire accounting:** R02 Eclipse Sanctuary's 4 fires are specified in §5.3.2 (Central Nave, Gold Quarter, Undercroft, Rampart) rather than on a region card. Card total 74 + hub 4 = **78**. Average 5.6 per region.

### 5.4.1 REGION 01 — ASHEN BARRENS

| Field | Spec |
|---|---|
| **Age dominant** | Ash (Lothric) |
| **Biome** | A grey dune field of compacted ash, 640 × 480 m, with a mass-grave trench system and the ribs of something enormous arcing out of the ground |
| **The one rule** | *Ash is deep.* Movement in deep ash is −40%; rolling in deep ash is −25% distance. The player learns within 90 seconds to walk the hard-packed ridges. Every enemy in the region is faster in ash than you are. |
| **SL band** | 1–14 · Enemy HP ×1.0 · Souls/kill 180–620 |
| **Bonfires (4)** | *The Waking Pit* (start) · *Ridge of Ribs* · *Barrow Gate* · *Ashen Watchtower* |
| **Boss** | **The Ashen Baron** (mandatory) — a knight fused to a burial mound; **tail-cut** (part #1) · **optional:** *The First Hollow* (an unarmed, harmless-looking enemy in a pit that is a Grade 5 ambush — the game's first "you should have walked away" lesson) |
| **Key items** | Estus Flask (5 charges), Coiled Sword, Rusted Key, 2× Ember of Ash |
| **NPCs** | Ysolde (found at *Barrow Gate*, wounded; escorting her to the Sanctuary is the game's first errand and unlocks the hub) |
| **Shortcuts (7)** | 3 one-way drops into the trench · 2 kickable ladders to the ridge · 1 gated door (Barrow Gate → Watchtower) · **the Great Door to the Sanctuary** (one-way *in*; you cannot return to the Barrens except by warp) |
| **Connections** | → R02 (Great Door, north-east, +130 m climb) · → R12 Ashen Coast (a hidden beach path behind the ribs, west) · → R03 Grave of Names (via the Watchtower's far side, north-west) |
| **Sightline** | From *Ashen Watchtower* you can see the Sanctuary's eclipse (1,240 m) and — if you know where to look — the Ember Keep volcano (1,900 m) |
| **Ashfall** | Light, continuous. Fire +5%, Dark −5% |
| **Music** | None. Only wind and the sound of distant paper (Vol. 1 §1.9). The first music in the game is the Ashen Baron's, and it begins 4 seconds before you see him. |

### 5.4.2 REGION 02 — ECLIPSE SANCTUARY
*See §5.3 in full.* 4 bonfires (Central Nave, Gold Quarter, Undercroft, Rampart). No bosses. All 5 covenants joinable here except Forest Guardians (R08) and Dragon Remnants (R07).

### 5.4.3 REGION 03 — GRAVE OF NAMES

| Field | Spec |
|---|---|
| **Age** | Souls (Lordran) |
| **Biome** | A cemetery of 11,000 blank headstones on a terraced hillside, with a mausoleum-city beneath |
| **The one rule** | *Names are currency.* Every headstone can be **read** (interact) and gives 40–120 souls — but reading a stone **summons its Hollow** 8 seconds later. The player is taught that information costs, and that the world's lore is literally guarded by its dead. 1,000 of the 11,000 stones have unique names; the rest are procedurally drawn from a 60,000-name table seeded per save. |
| **SL band** | 12–28 |
| **Bonfires (6)** | *Nameless Gate* · *The Reading Stone* · *Terrace of Widows* · *Mausoleum Mouth* · *The Blank Field* · *Sentinel's Walk* (leads to R09) |
| **Boss** | **The Nameless Grave** (mandatory) — a giant knight assembled from headstones; **2 severance parts** (#2 right arm STRIKE, #3 helm ANY) |
| **Key items** | *Soul of Memory* is NOT here (it is in R11); this region holds the **Gravewarden's Fist** token, Homeward, Spook |
| **NPCs** | Sir Aldwin (patrols *Sentinel's Walk*; Blue Sentinels recruitment) |
| **Shortcuts (9)** | 5 one-way drops down the terraces · 2 ladders · 1 gated mausoleum door · 1 elevator (Terrace → Mausoleum, 22 s) |
| **Connections** | → R01 (Watchtower) · → R02 (Sanctuary west gate) · → R09 Bastion (elevator, up) · → R11 Grave of Kings (mausoleum descent, −180 m) · → R06 Winter's Veil (a frozen pass, north) |
| **Ascetic note** | The most-Ascetic'd region in QA testing. At A4, every headstone summons a **named** Hollow with a unique moveset. |

### 5.4.4 REGION 04 — SUNKEN CATHEDRAL

| Field | Spec |
|---|---|
| **Age** | Want (Drangleic), drowning in Lothric water |
| **Biome** | A 400 m basilica standing in 4–14 m of black water. Water level **changes** as the player drains/floods three sluice gates. |
| **The one rule** | *The water is the level design.* At high water you traverse by swimming and the 40 chairs are underwater; at low water you walk the nave floor and reach 3 areas that are unreachable when flooded. **Two sluice configurations are required for 100% completion** — the region cannot be finished in one state. |
| **SL band** | 28–48 |
| **Bonfires (8)** | *Sluice House* · *The Nave (low)* · *The Nave (high)* — two separate bonfires at the same location, only one lit at a time · *Choir Loft* · *Forty Chairs* · *The Drowned Crypt* · *Warden's Walk* · *The Bricked Door* (lights only after Vharos dies, from the far side) |
| **Bosses** | **Vharos, the Drowned Warden** (mandatory — Vol. 6 §6.2) · **The Choir of Forty** (optional, requires low water) |
| **Severance** | Vharos has **3 parts** (#4 harpoon arm SLASH, #5 crown STRIKE, #6 tail-fin PIERCE) — the most severable boss in Act II |
| **Key items** | Drowned Mail set, *Hush*, *Grasp of the Deep*, Greymouthe's Dark Chime |
| **NPCs** | Greymouthe (at *Forty Chairs*, initially hostile — she must be spoken to three times across three visits) |
| **Shortcuts (11)** | 4 one-way drops · 3 ladders · 2 sluice gates (permanent world changes) · 1 elevator (Nave → Choir Loft, 38 s) · 1 swim-through tunnel to R11 |
| **Connections** | → R02 (Sanctuary, via the Serpent Viaduct) · → R05 Ember Keep (a dry aqueduct, east, +300 m climb) · → R08 Verdant Rot (flooded outflow, south) · → R11 Grave of Kings (swim tunnel) |
| **Environmental** | Water applies −30% movement and −25% roll distance unless wearing Drowned Mail (set bonus: immunity). Lightning damage is **+35% while standing in water** — a rule the player learns from one enemy and then exploits for 40 hours. |

### 5.4.5 REGION 05 — EMBER KEEP

| Field | Spec |
|---|---|
| **Age** | Fire (Lordran) collapsing into Ash (Lothric) |
| **Biome** | An iron castle built **inside the ribcage of a dead volcano-dragon**, 250 m tall, with active lava flows that rise and fall on a 4-minute cycle |
| **The one rule** | *The lava is a clock.* Every 4 minutes the lava rises 8 m for 90 seconds. 14 platforms are only reachable at low lava; 6 are only reachable at high lava. The player learns to fight on a schedule. |
| **SL band** | 44–62 |
| **Bonfires (8)** | *Cinder Gate* · *The Bellows Floor* · *Furnace Stair* · *Sovereign's Antechamber* · *Rib Walk* · *The High Forge* · *Molten Core Approach* · *The Small Sun's Rest* (a landing where the child sits; lights on your fourth meeting with them) |
| **Bosses** | **Karrag, the Ember Sovereign** (mandatory — Vol. 6 §6.3) · **The Bellows Twins** (optional) |
| **Severance** | Karrag has **3 parts** (#7 furnace tail STRIKE, #8 left pauldron STRIKE, #9 molten core FIRE) — the core is the **Heart of Want** story item |
| **Key items** | **Heart of Want** (Crown #2), Warrior of Sunlight covenant (The Small Sun is here), *Power Within*, *Molten Core* Art rank III, Drake Scale set |
| **NPCs** | The Small Sun (carrying a shard of sunlight up 250 m of stairs; you meet them four times at different points on the climb) |
| **Shortcuts (12)** | 3 one-way drops into the lava (lethal) · 4 ladders · 2 gated portcullises · 2 elevators (Cinder Gate → Furnace Stair, 44 s; Rib Walk → High Forge, 61 s) · 1 retractable bridge |
| **Connections** | → R04 Sunken (aqueduct) · → R02 Sanctuary (Serpent Viaduct, the *second* crossing) · → R07 Dragon Remnant Shrine (the Rib Walk continues up into the mountain, +280 m) · → R10 Iron Eclipse Foundry (a chimney climb, +190 m) |
| **Ascetic note** | At A2+, the lava cycle shortens to 3 minutes. At A4, it is 2 minutes and the lava rises 14 m. |

### 5.4.6 REGION 06 — WINTER'S VEIL / FROZEN CRYPTS

| Field | Spec |
|---|---|
| **Age** | Souls (Lordran), preserved |
| **Biome** | A glacier with a city frozen 40 m beneath the ice, mid-evacuation. You walk on the ice and see the streets below. |
| **The one rule** | *Ice is transparent.* The city beneath is fully visible at all times and serves as the map. Three ice-thickness tiers: **thick** (walkable, opaque), **thin** (walkable, transparent, breaks under Grade ≥3 impacts), **hole** (fall through to the city). Combat on thin ice is a positional game — a Greataxe Art can drop you both into the crypt. |
| **SL band** | 52–70 |
| **Bonfires (7)** | *Veil Edge* · *The Thin Field* · *Sunken Market* · *The Nursery* · *Eleven Beds* · *Queen's Stair* · *Crypt Mouth* |
| **Bosses** | **The Winter Queen** (mandatory) · **The Nursery Keeper** (optional — the game's most emotionally manipulative fight, and it is entirely optional) |
| **Severance** | Queen has 2 parts (#10 ice crown STRIKE, #11 frozen wings SLASH) |
| **Key items** | **Ashen Cinder** (Crown #3), Sentinel Plate set, *Spook*, *Profuse Sweat* |
| **The readable room** | **The Nursery** — a frozen children's room with 11 beds, 11 pairs of shoes by the door, and one bed made. Zero text. Zero item. Players who find it never forget it, and 62% of QA testers reported it as their strongest memory of the region in playtests of the greybox. |
| **Shortcuts (8)** | 4 ice-hole drops (one-way, to the crypt) · 2 ladders · 1 gated door · 1 elevator (Sunken Market → Veil Edge, 51 s) |
| **Connections** | → R03 Grave of Names (frozen pass) · → R09 Bastion (a cliff traverse) · → R12 Ashen Coast (the glacier's melt river, −180 m) · → R11 Grave of Kings (Crypt Mouth descent) |

### 5.4.7 REGION 07 — DRAGON REMNANT SHRINE

| Field | Spec |
|---|---|
| **Age** | Fire (Lordran) |
| **Biome** | A mountain shrine built around and *inside* the surviving third of an ancient dragon. Its body is the architecture: you walk along its spine, through its ribs, into its skull. |
| **The one rule** | *The dragon is alive, slowly.* Every 90 seconds it **breathes** — a 6-second exhalation that changes airflow, opens 4 membrane doors, and extinguishes all fire damage in the region for its duration. Pyromancers are useless for 6 seconds every 90 seconds. Timing is the region. |
| **SL band** | 64–80 |
| **Bonfires (6)** | *Shrine Approach* · *The Spine* · *Rib Nave* · *The Exhalation* · *Skull Antechamber* · *The Last Breath* |
| **Bosses** | **Remnant of the Old Dragons** (mandatory — the last dragon) · **optional:** *The Cult's Three Heads* · *Scale-Warden Vesh* |
| **Severance** | **4 parts** — the most in the game: #12 tail (SLASH), #13/#14 both wings (PIERCE), #15 **crown-horn (STRIKE, Grade 5)** which is a **hidden ending condition** |
| **Key items** | Dragon Remnants covenant, Dragon Scales (upgrade path), Dragonhead Stone, **Ouroboros Spine** (from part #15) |
| **NPCs** | The Dragon Remnant covenant master, **Vesh**, who is the dragon's own scale and does not know it |
| **Shortcuts (6)** | 2 drops through the ribs · 2 ladders · 1 membrane door (only opens during exhalation) · 1 elevator (Spine → Skull, 33 s) |
| **Connections** | → R05 Ember Keep (Rib Walk) · → R10 Iron Eclipse Foundry (a descent through the dragon's gullet) · → R02 Sanctuary (**the third and final Serpent Viaduct crossing — where Ouroboros realizes what it is**) |

### 5.4.8 REGION 08 — THE VERDANT ROT

| Field | Spec |
|---|---|
| **Age** | Want (Drangleic) |
| **Biome** | A forest that grows toward *desire* rather than light. Trees bend toward whatever the player most recently rested at. Canopy is 60 m; the floor is permanently twilight. |
| **The one rule** | *The forest moves when you are not looking.* 22 landmark trees relocate whenever the player is more than 80 m away and out of line of sight. The region's geography is **not stable**, and navigation must be done by sound (the Rotmother's heartbeat, audible everywhere) and by the direction the trees lean. This is the DS2 "world that doesn't make sense" idea made into a *system* rather than an incoherence. |
| **SL band** | 30–50 |
| **Bonfires (4)** | *Root Gate* · *The Leaning Wood* · *Heartbeat Clearing* · *Rotmother's Mouth* — the sparsest spacing in the game, because the forest relocates its landmarks and a fifth fire would make it navigable |
| **Boss** | **The Rotmother** (mandatory) · part #16 bloom (FIRE) |
| **Key items** | **Forest Guardians covenant** (the only place it can be joined), *Acid Surge*, *Rapport*, Verdant Ring |
| **Shortcuts (5)** | 2 root drops · 2 ladders · 1 gated hollow |
| **Connections** | → R04 Sunken (flooded outflow) · → R02 Sanctuary (Root Gate) · → R11 Grave of Kings (the roots descend into it) |

### 5.4.9 REGION 09 — BASTION OF THE BLUE SENTINELS

| Field | Spec |
|---|---|
| **Age** | Souls |
| **Biome** | A cliff fortress whose defenders died defending a door **from the inside**. Every corpse faces inward. |
| **The one rule** | *The door is the objective.* The Bastion is a single 260 m vertical climb around one enormous sealed door. Nothing inside is reachable until the door opens, and the door opens only when the player brings it the **Oathstone** (from Sir Aldwin, or from his corpse). The region can be entered at SL12 and the door will still be sealed at SL120 if you never spoke to Aldwin. |
| **SL band** | 40–58 |
| **Bonfires (4)** | *Bastion Foot* · *The Inward Dead* · *Oathstone Alcove* · *Behind the Door* — no fire on this side of the sealed door, by design |
| **Boss** | **Sentinel Commander Aurel** (mandatory) · part #17 banner (SLASH) · optional: *The Last Defender* (an immortal NPC-duel you can never kill, only exhaust — he yields after 6 minutes) |
| **Key items** | Blue Sentinels rank 2 & 3 items, Sentinel Plate, *Darkmoon Blade* |
| **Shortcuts (7)** | 4 drops · 2 ladders · 1 gate (the Door) |
| **Connections** | → R03 Grave of Names (elevator) · → R06 Winter's Veil (cliff traverse) · → R10 Iron Eclipse Foundry (a rope bridge, +220 m) |

### 5.4.10 REGION 10 — IRON ECLIPSE FOUNDRY

| Field | Spec |
|---|---|
| **Age** | Ash (Lothric) |
| **Biome** | An industrial forge-city at the world's highest habitable point, where the gods' weapons were melted down and recast as the Convergence's. Endless conveyor chains, quench tanks, and a **600 m drop at the center with no railing**. |
| **The one rule** | *The machines run whether you are there or not.* 34 moving platforms, 12 crushers, and 8 conveyor belts operate on fixed cycles independent of the player. The region is a **timing puzzle with combat in it**. Every hazard has a visible cycle counter (a rotating cog) so that timing can be *learned*, not guessed. |
| **SL band** | 60–78 |
| **Bonfires (6)** | *Foundry Gate* · *Quench Floor* · *The Great Chain* · *Cog Counter Landing* · *Forge Warden's Hall* · *Eclipse Rim* |
| **Boss** | **The Forge Warden** (mandatory) · part #18 anvil arm (STRIKE) |
| **Key items** | Iron Eclipse armor set, **Ashen infusion** (Vhenn rank 4 requires this region's boss soul), Ember of Ash ×6 |
| **Shortcuts (10)** | 3 drops (one is 600 m and lethal) · 4 ladders · 2 gates · 1 elevator (Quench → Great Chain, 72 s — the longest ride in the game, and it streams 4 regions during the ascent) |
| **Connections** | → R05 Ember Keep (chimney) · → R07 Dragon Shrine (gullet) · → R09 Bastion (rope bridge) · → R14 The Convergence (**the Eclipse Rim is the base of the Long Stair**) |

### 5.4.11 REGION 11 — GRAVE OF KINGS

| Field | Spec |
|---|---|
| **Age** | Souls |
| **Biome** | A subterranean necropolis where every king of every age is buried in the **same tomb**, because the Convergence collapsed their separate graves into one. 41 sarcophagi, and 41 ghosts who all claim to be the true king. |
| **The one rule** | *Everyone is lying.* All 41 kings speak, and no two agree. One of them has the **Soul of Memory**. Finding which requires cross-referencing item descriptions — the region is the game's lore puzzle, and it is solvable by pure deduction. (The correct answer is the one who says nothing: sarcophagus 0, unmarked, at the center.) |
| **SL band** | 74–92 |
| **Bonfires (7)** | *Mausoleum Descent* · *Hall of Forty-One* · *Sarcophagus Zero* · *The Silent King* · *Curse Gallery* · *Deep Stair* · *Want's Threshold* |
| **Bosses** | **The King of Grey Kings** (mandatory — a composite of all 41) · part #19 sceptre · **The Curse Gallery Warden** (optional) |
| **Key items** | **Soul of Memory** (Crown #1 — from sarcophagus 0, not from the boss), *Curse* sources (1 of only 3 in game) |
| **Shortcuts (9)** | 5 drops · 2 ladders · 1 gate · 1 elevator (Hall → Deep Stair, 40 s, descends 190 m) |
| **Connections** | → R03 Grave of Names (mausoleum) · → R04 Sunken (swim tunnel) · → R06 Winter's Veil (Crypt Mouth) · → R08 Verdant Rot (roots) · → **R13 The Want Beneath** (Deep Stair, −270 m) |
| **Note** | This region has **5 connections**, the highest in the game — it is the world's true center, not the Sanctuary. |

### 5.4.12 REGION 12 — THE ASHEN COAST

| Field | Spec |
|---|---|
| **Age** | Ash |
| **Biome** | The sea has gone out and not returned. 900 m of grey sand, 34 ships standing upright, and a horizon that is *too close* — you can see where the world's texture stops. |
| **The one rule** | *There is nothing out there.* The Coast is the game's largest open space (900 × 380 m, no cover) and its most dangerous, because there is nowhere to break line of sight. Four **Leviathan Snipers** patrol it with 200 m-range harpoons. Crossing it is a routing exercise. |
| **SL band** | 66–86 |
| **Bonfires (5)** | *Beached Gate* · *The Upright Fleet* · *The Admiral's Post* · *Leviathan's Rib* · *Horizon's End* |
| **Boss** | **The Beached Leviathan** (mandatory) · part #20 harpoon (STRIKE) · optional: *The Admiral, Still At His Post* |
| **Key items** | Leviathan Harpoon, Ashen Coast set, **Horizon's End** reveals the world's edge and is one of the four pieces of foreshadowing for the hidden ending |
| **Shortcuts (4)** | 2 ship-hull drops · 1 ladder · 1 sand-collapse |
| **Connections** | → R01 Ashen Barrens (hidden beach path — **this is a backdoor into the tutorial region at SL66+, and it is how speedrunners skip Act I**) · → R06 Winter's Veil (melt river) · → R02 Sanctuary (a long ash-dune walk) |

### 5.4.13 REGION 13 — THE WANT BENEATH

| Field | Spec |
|---|---|
| **Age** | Want (Drangleic) + Abyss (Lordran) + Deep (Lothric), fully merged |
| **Biome** | **The inverted world.** You descend 270 m through the Deep Stair and emerge on the *underside of the sky*. Gravity is normal for you; the world above is upside down. All 13 surface regions are visible overhead as a grey relief map. |
| **The one rule** | *Want is a physical substance here.* The floor is 0.3 m of black liquid that **responds to your Want meter**: at Want 0 it is solid; at Want 7 you sink to your waist and movement is −60%. **Hexers are punished in their own homeland** unless they manage their resource. This is the game's most aggressive piece of systems-as-level-design. |
| **SL band** | 90–115 |
| **Bonfires (6)** | *Deep Stair Landing* · *The Upside Shore* · *Chasm of Kaathe* · *Frampt's Mouth* · *The Black Lens* · *The Wound* |
| **Bosses** | **Abyss Watcher Echo** (mandatory — it wears your face) · part #21 cloak · **The Frampt-Kaathe, Revealed** (mandatory — a boss fight *against* Ouroboros, during which it argues with itself) |
| **Key items** | Darkwraith rank 3, Vessel of Want catalyst, **The Ashen Brand** (from Vhenn, requires all 5 Echoes), *Want Incarnate* |
| **Shortcuts (6)** | 3 chasm drops · 2 serpent-passage tunnels · 1 gate |
| **Connections** | → R11 Grave of Kings (Deep Stair, up) · → R04 Sunken (a black-water rise) · → **R14 The Convergence** (the Long Stair begins here and climbs 1,140 m) |
| **The single loading exception (§5.6.4)** | Entering The Want Beneath from the Deep Stair triggers a **3-second fade to black**. This is the only loading screen in the game and it is *not* a technical necessity — the region streams fine. It exists because crossing into the underside of the world must feel like crossing. The fade is 3 s, and on the other side the audio is inverted. |

### 5.4.14 REGION 14 — THE CONVERGENCE

| Field | Spec |
|---|---|
| **Age** | All three, superimposed |
| **Biome** | The seam. A 680 m spire of fused architecture — Lordran stone, Drangleic green copper, Lothric gold — with the **Long Stair** (1,404 steps) climbing its exterior. At the top: three doors and a room with no door. |
| **The one rule** | *Everything you did is visible from here.* The spire's exterior is lined with **physical representations of the player's own save state**: one stone per boss killed, one extinguished brazier per Ascetic burned, one black knot per Dark Sigil, one seat per surviving Echo. The final climb is a walk through your own playthrough. |
| **SL band** | 105–125 |
| **Bonfires (3)** | *Stair Foot* · *The Ninth Landing* · *The Threshold* |
| **Boss** | **Nihilanthos, the Want Incarnate** (final — Vol. 6 §6.4). **3 severance parts** including the Ashen Brand seam (#24). |
| **The three doors** | Cinder Door · Hollow Door · Dark Door (§1.6.2) — plus the **doorless room** behind the throne, which only exists if hidden-ending conditions are met |
| **Key items** | All three essences converge; ending selection |
| **Connections** | → R13 Want Beneath (Long Stair, down) · → R10 Iron Eclipse Foundry (Eclipse Rim) · → R02 Sanctuary (a single, final Serpent passage) |

---

## 5.5 — The Great Serpent Viaduct (world spine)

The Ouroboros's body **is** a 2.4 km bridge-tunnel that the player crosses three times:

| Crossing | From → To | When | What the player sees |
|---|---|---|---|
| **1st** | R01 Ashen Barrens → R02 Sanctuary | ~40 min in | A stone viaduct with scale-like masonry. Frampt's head at the far end. Nothing strange. |
| **2nd** | R02 Sanctuary → R05 Ember Keep | ~8 h in | The same viaduct. The masonry is **breathing**. Kaathe's head at the far end. The player does not connect these facts. |
| **3rd** | R07 Dragon Shrine → R02 Sanctuary | ~25 h in | You walk *inside* it. The walls are ribs. Both heads are present, at opposite ends, and they are the same head. |

**No text ever states this.** The three crossings are separated by 24 hours of play on average, and the discovery is entirely the player's. In playtesting, 31% of testers made the connection without prompting; 100% made it when shown. This ratio is the target for all of the game's deep lore: **a third of players should find it themselves, and all of them should feel it was fair.**

---

## 5.6 — Critical Path & Routing

### 5.6.1 Mandatory Path

```
R01 Ashen Barrens ──► R02 Eclipse Sanctuary ──► R03 Grave of Names
                                                        │
                    ┌───────────────────────────────────┼──────────────────────────┐
                    ▼                                   ▼                          ▼
           R04 Sunken Cathedral                 R05 Ember Keep            R06 Winter's Veil
           (Crown: none — path)                 ★ HEART OF WANT           ★ ASHEN CINDER
                    │                                   │                          │
                    └──────────────┬────────────────────┴──────────┬───────────────┘
                                   ▼                               ▼
                          R07 Dragon Remnant Shrine        R11 Grave of Kings
                          (optional but recommended)       ★ SOUL OF MEMORY
                                   │                               │
                                   └───────────────┬───────────────┘
                                                   ▼
                                          R13 The Want Beneath
                                          (Ouroboros revealed)
                                                   │
                                                   ▼
                                    R14 THE CONVERGENCE — Long Stair
                                                   │
                                                   ▼
                                        NIHILANTHOS · THREE DOORS
```

### 5.6.2 Optional Regions

R08 Verdant Rot, R09 Bastion, R10 Iron Eclipse Foundry, R12 Ashen Coast — all four are off the critical path, all four contain at least one covenant or ending-adjacent item, and all four are reachable from the hub within the first 2 hours.

### 5.6.3 Three Canonical Routes

| Route | Order | Length | SL at final boss | Character |
|---|---|---|---|---|
| **The Pilgrim** (completionist) | 01→02→03→04→05→06→07→08→09→10→11→12→13→14 | 92 h | 138 | Sees everything; over-leveled; the intended first playthrough |
| **The Three Crowns** (efficient) | 01→02→03→{04,05,06 in any order}→11→13→14 | 64 h | 118 | The design's intended pace |
| **The Coast Run** (speedrun) | 01→12 (backdoor)→02→03→05→06→11→13→14 | 38 h | 104 | Uses the Ashen Coast backdoor into Act I; skips R04 and R07; **cannot get the hidden ending** (no crown-horn severance) |

### 5.6.4 The One Loading Screen

Documented for completeness: **one 3-second fade**, entering R13 from R11's Deep Stair. Technical justification: none required. Narrative justification: absolute. **This is the only place in the game where the player is not permitted to see the transition**, because the transition is the point.

---

## 5.7 — Warp Network

| Property | Spec |
|---|---|
| Unlock | After lighting **3 bonfires** (mirrors DS3's early warp unlock; DS1's late unlock produced excessive backtracking fatigue) |
| Fonts | 7 in the Sanctuary Warp Shrine + all 78 bonfires become warp targets once the shrine unlocks |
| Warp animation | 1.4 s: the player is drawn into the bonfire and *out* of the destination. No loading. The destination streams during the animation. |
| Warp restrictions | **Cannot warp during combat** (any enemy within 30 m with aggro). Cannot warp from R13 The Want Beneath except from its 5 bonfires (the black liquid interferes — diegetic justification for a real design need: you should not be able to escape the Want mid-fight). |
| Warp and Ascetics | Warping into an Ascetic-active region plays a distinct sound and shows the Ascetic rank on the destination label (§9.6) so the player is never surprised. |
| **No warp** in the final region R14 below *The Ninth Landing* | The Long Stair must be walked. It is 1,404 steps and it takes 6 minutes. It is the game's credits sequence before the credits. |

---

## 5.8 — World State & The Convergence Clock

Every region carries a **Convergence Clock** (0–100) that advances the world's decay. This is Vol. 0 §A.5 and Vol. 7 §7.5's world-side expression.

```
CLOCK advances by:
   +1  per player death in the region
   +3  per boss killed in the region
   +8  per Ascetic rank burned in the region
   +1  per 30 minutes of real time spent in the region
   −5  per boss severed part collected (severance STABILIZES the world)
   −10 per Kindled Echo escorted through the region

CLOCK thresholds (per region):
   0–24    Normal
   25–49   DECAYING: ashfall intensifies; 2 new enemy spawns; one shortcut collapses (permanent)
   50–74   BLEEDING: chronal eddies — dead enemies respawn WITHOUT resting; ambient audio gains a second layer
   75–99   CONVERGED: the region's age shifts to a different one (biome variant swap — 14 regions × 2 variants = 28 authored biome states)
   100     COLLAPSED: the region becomes permanently hostile; one NPC leaves forever; the boss respawns at Ascetic A2 for free
```

**Design purpose.** The Clock makes exploration have a cost and makes **severance a stabilizing act** — cutting parts off bosses is not just loot, it is *repairing the world*. This retroactively gives the DS1 tail-cut system a narrative justification it never had, and it makes the hidden ending's severance requirement feel inevitable rather than arbitrary.

---

## 5.9 — Environmental Hazards & Traversal

| Hazard | Regions | Effect | Counter |
|---|---|---|---|
| **Deep ash** | R01, R12 | −40% move, −25% roll distance | Walk the ridges; Cinder Walk pyromancy |
| **Deep water** | R04 | −30% move, −25% roll, +35% lightning taken | Drowned Mail set bonus; drain the sluices |
| **Black liquid (Want)** | R13 | Sink depth = Want meter; up to −60% move | Spend Want before entering; want 0 |
| **Lava** | R05, R07 | 420 dmg/s + Burn | Cinder Walk; Extinguish; timing |
| **Thin ice** | R06 | Breaks under Grade ≥3 impacts | Fight on thick ice; bait enemies onto thin |
| **Toxic spores** | R08 | Toxic buildup 12/s | Purple Moss; kill the Rotmother |
| **Curse fog** | R11 | −50% max HP on entry; 3 sources only | Divine Blessing; routing |
| **Machine cycles** | R10 | Crushers/conveyors, 4–22 s cycles | Watch the cog counters |
| **Ashfall** | Global (weather) | Fire +10%, Dark −10%; reduces visibility 20% | — |
| **Eclipse dimming** | R02, R14 | Progressive light loss across Acts | Torch, Cast Light |
| **Fall damage** | All | >12 m; scales with load tier | Spook; mid/fat roll landing |
| **Drowning** | R04, R13 | 90 s breath; then 40 HP/s | Surface; *Hush* extends breath to 150 s |

---

## 5.10 — World Blueprint: Full ASCII Structural Map

### 5.10.1 Vertical Section (elevation true to scale, ×1:200 compressed vertically)

```
 +680m  ╔══════════════════════════════════════════════════════════════╗
        ║                    R14 · THE CONVERGENCE                     ║
 +620m  ║        ▲ THE THRESHOLD (bonfire)   ▲ THREE DOORS             ║
        ║        │                            │                        ║
 +560m  ║   ┌────┴────────────────────────────┴─────┐                  ║
        ║   │        T H E   L O N G   S T A I R     │  1,404 steps    ║
 +520m  ║   │  ▲ R07 DRAGON REMNANT SHRINE (skull)   │  6 min climb    ║
        ║   │  │  ╔═══════════════════╗              │                 ║
 +460m  ║   │  └──┤ the dragon's body ├──┐           │                 ║
        ║   │     ╚═════════╤═════════╝  │           │                 ║
 +430m  ║   │  R10 IRON     │            │           │                 ║
        ║   │  ECLIPSE      │ R05 EMBER  │           │                 ║
 +400m  ║   │  FOUNDRY ◄────┼── KEEP ────┘           │                 ║
        ║   │   ▲          │   ▲  ▲                  │                 ║
 +340m  ║   │   │          │   │  └── lava cycle ────┼──► R07 spine    ║
        ║   │   │          │   │                     │                 ║
 +260m  ║   │ R09 BASTION  │   │                     │                 ║
        ║   │  ▲  (cliff)  │   │                     │                 ║
 +180m  ║   │  │           │   │                     │                 ║
        ║   │  │           │   │                     │                 ║
 +132m  ║ ══╪══╪═══════════╪═══╪═════════════════════╪════════════════ ║
        ║   │  │  R02 · ECLIPSE SANCTUARY  (HUB)     │                 ║
 +90m   ║   │  │   [GOLD]──[GREY NAVE]──[UNDERCROFT]│                 ║
        ║   │  │        ▲         ▲          │       │                 ║
 +40m   ║   │  │        │         │          ▼       │                 ║
        ║   │  │        │    ┌────┴──────────────┐   │                 ║
  ±0m ──╫───┼──┼────────┼────┤ GREAT SERPENT     ├───┼──────────────── ║
        ║   │  │        │    │ VIADUCT (spine)   │   │                 ║
 −40m   ║   │  │  R08   │    └────┬──────────────┘   │                 ║
        ║   │  │ VERDANT│         │                  │                 ║
 −80m   ║   │  │  ROT   │    R04 SUNKEN CATHEDRAL    │                 ║
        ║   │  │   │    │      (water level varies)  │                 ║
−120m   ║   │  └───┼────┼───────►│                   │                 ║
        ║   │      │    │        │                   │                 ║
−160m   ║ R01 ASHEN BARRENS      │                   │                 ║
        ║  (start, −10m)         │                   │                 ║
−200m   ║   │      R11 GRAVE OF KINGS ◄──────────────┤                 ║
        ║   │       (41 sarcophagi)     R06 WINTER'S VEIL              ║
−260m   ║   │            │                ▲ (glacier surface −60m)     ║
        ║   │       DEEP STAIR            │                            ║
−320m   ║   │            │           R12 ASHEN COAST                   ║
        ║   │            ▼                (sea level −30m)             ║
−400m   ║   │   ╔══════════════════════════════════════╗               ║
        ║   └──►║      R13 · THE WANT BENEATH          ║               ║
−460m   ║       ║   (INVERTED — the sky is the floor)  ║               ║
        ║       ║   ▲ all 13 surface regions visible ▲ ║               ║
        ║       ╚══════════════╤═══════════════════════╝               ║
        ╚══════════════════════╪═══════════════════════════════════════╝
                               │
                     THE LONG STAIR (ascending 1,140 m
                     from −460 m to +680 m — the game's
                     final traversal, and its only one-way
                     climb with no warp)
```

### 5.10.2 Plan View (top-down connectivity graph)

```
                              ┌─────────────────────┐
                              │   R14 CONVERGENCE   │
                              │   (+430…+680 m)     │
                              └───────┬─────┬───────┘
                                      │     │
                        ┌─────────────┘     └─────────────┐
                        ▼                                 ▼
              ┌───────────────────┐             ┌────────────────────┐
              │ R10 IRON ECLIPSE  │             │  R07 DRAGON        │
              │     FOUNDRY       │◄───────────►│  REMNANT SHRINE    │
              └──┬─────────────┬──┘   gullet    └───┬────────────┬───┘
                 │             │                    │            │
        rope br. │             │ chimney            │ rib walk   │ 3rd crossing
                 ▼             ▼                    ▼            ▼
     ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
     │ R09 BASTION OF   │  │  R05 EMBER KEEP  │  │  R02 ECLIPSE SANCTUARY   │
     │  BLUE SENTINELS  │  │  (+180…+430 m)   │  │      ★ HUB ★             │
     └───┬──────────┬───┘  └───┬──────────┬───┘  │  [GOLD][NAVE][UNDERCROFT]│
         │          │          │          │      └─┬────┬────┬────┬────┬────┘
  elev.  │          │ traverse │ aqueduct │        │    │    │    │    │
         ▼          ▼          ▼          │   1st  │    │    │    │    │ 2nd
   ┌────────────┐ ┌───────────────┐ ┌─────────────┴┐   │    │    │    │ crossing
   │ R03 GRAVE  │ │ R06 WINTER'S  │ │ R04 SUNKEN   │◄──┘    │    │    ▼
   │  OF NAMES  │ │ VEIL / CRYPTS │ │  CATHEDRAL   │        │    │  (viaduct)
   └─┬───────┬──┘ └──┬────┬────┬──┘ └──┬───┬───┬───┘        │    │
     │       │        │    │    │        │   │   │           │    │
     │       │  pass  │    │    │ cliff  │   │   │ outflow   │    │
     │       └────────┘    │    └────────┘   │   ▼           │    │
     │                     │                 │ ┌───────────┐ │    │
     │ mausoleum           │ melt river      │ │ R08 VERDANT│ │    │
     ▼                     ▼                 │ │   ROT     │ │    │
   ┌──────────────────────────────┐          │ └─────┬─────┘ │    │
   │ R11 GRAVE OF KINGS  (5 links)│◄─────────┘       │ roots │    │
   │   ★ the world's true center  │◄─────────────────┘       │    │
   └───────┬──────────────┬───────┘                          │    │
           │ Deep Stair   │ black-water rise                 │    │
           ▼              ▼                                  │    │
   ┌──────────────────────────────────┐                      │    │
   │      R13 THE WANT BENEATH        │◄─────────────────────┘    │
   │   (INVERTED · −220…−460 m)       │                           │
   │   ▲ ALL 13 REGIONS VISIBLE ABOVE │◄──────────────────────────┘
   └───────────────┬──────────────────┘
                   │ Long Stair (1,140 m ascent)
                   └──────────────► R14

   ┌───────────────────┐
   │ R01 ASHEN BARRENS │──► R02 (Great Door, one-way in)
   │   (start region)  │──► R03 (Watchtower)
   └─────────┬─────────┘──► R12 (hidden beach path)
             ▲
             │ BACKDOOR (speedrun route)
   ┌─────────┴─────────┐
   │  R12 ASHEN COAST  │──► R06 (melt river)
   │   (open sand)     │──► R02 (dune walk)
   └───────────────────┘

   LEGEND:  ──► directed shortcut/path   ◄──► bidirectional
            ★ hub    ▲ elevation gain    ▼ elevation loss
```

### 5.10.3 Connectivity Degree Audit (D3 compliance)

| Region | Direct links | Degree | Compliant with D3 (≥3)? |
|---|---|---|---|
| R01 Ashen Barrens | R02, R03, R12 | 3 | ✔ |
| R02 Sanctuary | R01, R03, R04, R05, R07, R08, R12, R14 | **8** | ✔ |
| R03 Grave of Names | R01, R02, R06, R09, R11 | 5 | ✔ |
| R04 Sunken Cathedral | R02, R05, R08, R11, R13 | 5 | ✔ |
| R05 Ember Keep | R02, R04, R07, R10 | 4 | ✔ |
| R06 Winter's Veil | R03, R09, R11, R12 | 4 | ✔ |
| R07 Dragon Shrine | R02, R05, R10 | 3 | ✔ |
| R08 Verdant Rot | R02, R04, R11 | 3 | ✔ |
| R09 Bastion | R03, R06, R10 | 3 | ✔ |
| R10 Iron Eclipse | R05, R07, R09, R14 | 4 | ✔ |
| R11 Grave of Kings | R03, R04, R06, R08, R13 | **5** | ✔ |
| R12 Ashen Coast | R01, R02, R06 | 3 | ✔ |
| R13 Want Beneath | R04, R11, R14 | 3 | ✔ |
| R14 Convergence | R10, R13, R02 | 3 | ✔ |
| **Graph** | 40 unique undirected edges | avg degree 4.0 | **✔ No dead ends. Multiple Hamiltonian cycles exist.** |

---

## 5.11 — Level Design Production Standards

| Standard | Requirement |
|---|---|
| **Corridor width** | Minimum 4 m for combat spaces; 2.2 m for traversal-only; never below 1.8 m |
| **Combat space** | Every boss arena ≥ 28 m diameter; every elite encounter ≥ 18 m; open-field regions have ≥1 "safe corner" per 40 m |
| **Vertical step** | Max climbable step 0.9 m without animation; 1.8 m with mantle animation; above that requires a ladder/elevator |
| **Bonfire spacing** | 90–240 s of traversal between bonfires in Act I; 180–420 s in Act III |
| **Enemy density** | ≤ 6 active hostiles within any 30 m radius (except Swarm-archetype zones, ≤ 12) |
| **Readability** | Every interactive object has a unique silhouette readable at 12 m in the region's darkest lighting state |
| **Return loops** | Every region must be completable as a loop returning to its entry bonfire without backtracking >60 m |
| **Greybox gate** | No region enters art production until its greybox passes G1–G7 (§3.14 pattern) with 5 external testers |
| **Naming** | Region names use the pattern *[Adjective/Noun] of [Noun]* or a single evocative proper noun. Never a number, never "Part 2." |

---

*End of Volume 5. Continue to Volume 6: Three Fully Realized Boss Encounters.*
