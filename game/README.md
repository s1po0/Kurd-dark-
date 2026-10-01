# The Playable Build

A browser prototype of **DARK SOULS: CONVERGENCE OF ASH & WANT**, built to exercise the numbers in
[`docs/gdd/`](../docs/gdd/) rather than to approximate them. Where the document states a value, this
code reads that value out of a table — it does not hard-code a feel.

**No build step. No dependencies. No network calls. No asset files.** Eleven scripts, one stylesheet,
one HTML page. Open `index.html` and it runs; the audio is synthesised at runtime with WebAudio and
every sprite is drawn with canvas primitives.

```bash
cd game && python3 -m http.server 8080     # → http://localhost:8080
```

---

## Module map

Loading order matters — each script relies on the `const`s declared above it, exactly as browser
scripts do.

| Order | File | Lines | Responsibility |
|---|---|---|---|
| 1 | `js/const.js` | 381 | Every data table from the GDD: `ATTRS`, `CLASSES`, `REF_BUILDS`, `LOAD_TIERS`, `CAPS`/`CAP_GAIN`, `INFUSIONS`, `UPG_DMG`/`UPG_COST`, `WEAPONS`, `SHIELDS`, `ARMOR`, `RINGS`, `SPELLS`, `WANT_*`/`RES_LADDER`, `CAST_FRAMES`, `ESTUS_*`, `GEM_*`, `SOUL_LEVEL_COST`, `NG_PLUS_MAX`, `ASCETIC`, `ECHOES`, `COVENANTS`, `SEVERANCE`, `ENDINGS`, `BOSS_RULES`, `REGIONS`, `BOSSES`, `ENEMY_TYPES`, `ELITES`, `STATUS`, `CONSUMABLES`, `START_GIFTS`, `TIPS` |
| 2 | `js/util.js` | 207 | The maths: `capCurve`, `derive`, `spellSlots`, `weaponDamage`, `spellDamage`, `clamp`/`angDiff`/`rnd`, AABB-circle collision, `Save` |
| 3 | `js/input.js` | 107 | Keyboard + mouse + gamepad collapsed into **design-language actions** (`light`, `heavy`, `guard`, `parry`, `roll`, `sprint`, `art`, `estus`, `gem`, `interact`, …) so no gameplay code ever names a key |
| 4 | `js/audio.js` | 182 | Procedural WebAudio: swings, hits, rolls, bonfires, resonance, phase shifts, per-boss music layers |
| 5 | `js/particles.js` | 120 | `FX` pool (900-particle cap), `Cam` (shake/kick/lead), `HitStop` |
| 6 | `js/world.js` | 473 | Zone blueprints as rect unions, doorway-aware renderer, `onFloor`/`contain`/`roomAt`/`hazardAt`, biome palettes |
| 7 | `js/player.js` | 797 | `Actor` base (damage intake, guard, parry, mitigation, poise budget, posture, status) and the player state machine |
| 8 | `js/enemies.js` | 452 | `Enemy` plus `Bonfire`, `ItemDrop`, `FogGate`, `ZoneLink`, `NPC` |
| 9 | `js/bosses.js` | 958 | `Boss` base and the three encounters: `Sovereign`, `Karrag`, `Vharos` |
| 10 | `js/ui.js` | 815 | The nine menu tabs, bonfire menu, NPC menus, HUD, ending screen, codex |
| 11 | `js/main.js` | 1137 | `Game`: state machine, zone spawning, combat resolution, tokens, severance, endings, NG+, save |

`index.html` is the canvas (960×540), the HUD, and the overlay stack. `css/style.css` is the whole
visual language — no images.

---

## How the numbers stay honest

**One curve for everything.** `capCurve(v)` walks the Vol 2 §2.4 ladder (`CAPS = [27,40,60,80,99]`,
`CAP_GAIN = [0.22,0.12,0.06,0.025,0]`) and is used for HP/FP/stamina pools *and* for weapon scaling,
so a stat soft-caps the same way everywhere it appears.

**Derivation, not storage.** `Player.recalc()` calls `derive(stats, gear, opts)` and every displayed
number is a pure function of the nine attributes plus what you are wearing. Nothing is cached that
could drift.

**Weapon damage** is `round(base × upgrade × infusion) + round(Σ capCurve(stat) × grade × infusion_weight × 0.112 × base)`.
The 0.112 coefficient is not arbitrary — it is pinned so Build A's Refined Longsword +5 lands on
**210**, matching the GDD anchor, and Build C's Heavy Ashen Greatsword +5 lands on **405** against its
318-DPS budget at the greatsword's slower swing. An infusion re-weights the ladder (`Heavy` = STR×1.45
and every other stat ×0); `Raw` names nothing and therefore silences all scaling.

**Equip load** resolves to a tier object, and the tier carries its own roll i-frames, total frames,
distance and stamina cost. Adaptability multiplies i-frames by `clamp(1+(ADP−10)×0.010, 0.90, 1.25)`
and shortens the Estus drink and every recovery.

**Poise** sums the armour set, adds a greatshield's and a ring's poise, and applies **−4 to the total
when the legs are off-set** — the penalty is exactly the price of the mixed piece, per Vol 3 §3.7.6.
Grade, break threshold (`20 + poise×2`) and mitigation (`min(0.70, poise×0.005)`) all derive from the
one total.

**Posture damage** is routed through `poiseDamageOf()` and multiplied by `PS_POSTURE_MULT` (×1.6) in a
stance, `PS_FINISHER_MULT` (×2.4) on the finisher, and `NON_STANCE_POSTURE` (×0.40) otherwise. The
1.5× requirement in `get powerStance()` is `Math.ceil(max(req.STR, req.DEX) × PS_REQ_MULT)`, and it
handles all three legal shapes: twinblades in both hands, two of the same weapon class, and
two-handing a single weapon with an empty left hand.

---

## Zones

Five of the fourteen specified regions are built, plus the expansion teaser.

| ID | Name | Rooms | Bonfires | Encounters | NPCs | Boss |
|---|---|---|---|---|---|---|
| R01 | Ashen Barrens | 13 | 4 | 20 | — | The Hollow Sovereign |
| R02 | Eclipse Sanctuary | 6 | 4 | — | 5 | hub |
| R05 | Ember Keep | 13 | 8 | 22 | — | Karrag, the Ember-King |
| R04 | Sunken Cathedral | 17 | 8 | 24 | — | Vharos, the Ashen Herald |
| R13 | The Want Beneath | 1 | — | — | 1 | expansion teaser |
| | **Totals** | **50** | **24** | **66** | **6** | **3** |

Zone links are requirement-gated: the road to Ember Keep is sealed until the Sovereign dies, the
Undercrypt until Karrag, and the wound in the nave until Vharos. The ending Threshold is in the
Cathedral nave at `90,−32` tiles and only prompts once Vharos is down.

---

## Known gaps between this slice and the document

Stated plainly, because the document is the deliverable and the prototype is evidence:

- **Content counts.** 17 of 186 weapons, 14 of 130 spells, 12 of 71 armour sets, 12 of 96 rings,
  9 of ~60 enemy archetypes, 3 of 22 bosses, 5 of 14 regions, 3 of 6 endings.
- **No multiplayer.** Vol 8 is entirely unimplemented: covenants grant their single-player bonuses and
  rank ladders, but there are no phantoms, signs, invasions or matchmaking. `p.ember` gates nothing
  yet beyond the toast.
- **No save migration.** `Save.v` is `1`; a schema change will not migrate an old slot.
- **Boss souls** are consumable for souls or transposable, but the transposition table is a stub.

---

*See [`../tests/`](../tests/) for the 337-assertion harness that keeps all of the above true.*
