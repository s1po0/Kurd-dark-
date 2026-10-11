# Kurd Castle — runnable browser preview

This folder is the **playable half** of the prototype. It is the same game as
`unity/KurdCastle/` — same balance numbers, same systems, same tick order —
re-implemented as plain ES modules so the simulation can be played, profiled and
verified in a browser (and under Node) without a Unity install, an Android SDK or
a build step.

Nothing here is generated: there is no bundler, no `node_modules`, no
`package.json`. The browser loads the modules directly.

## Run it

Any static server works. From the repository root:

```bash
python3 -m http.server 8080 --bind 0.0.0.0 --directory preview
# then open http://localhost:8080
```

A phone on the same network can open `http://<your-ip>:8080` — the layout is
designed for landscape first, exactly like the Android build.

## Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Pan the camera | drag, or `WASD` / arrows | drag; hold a finger near a screen edge to edge-drag |
| Zoom | wheel, `+` / `-` | pinch |
| Rotate | `Q` / `E` | two-finger twist |
| Focus somewhere | double-tap | double-tap |
| Select | click a unit or building | tap |
| Move / attack-move | select troops, right idea = tap the ground | tap the ground (arm Attack-Move first for an assault) |
| Place a building | pick it from the build menu, then click the map | tap the build button, then tap the map |
| Attack-move | — | long-press (0.45 s) with troops selected |
| Pause | `Space`, or the ⏸ chip | ⏸ chip |
| Game speed | `1` `2` `3` (=1× / 2× / 4×) | 1× / 2× / 4× chips |
| Rations / taxes | `R` / `T`, or the chips | chips |
| Open / seal all gates | `G` | Open/Seal chips |
| Select all troops / idle peasants | `X` / `Z` | panel buttons |
| Cancel / deselect | `Esc` | tap empty ground |

Placement stays active after a building is placed so wall lines can be drawn in
one pass; press `Esc` or the Cancel button to stop. Green footprints are legal,
red ones are not — the toast tells you which rule failed.

## What is simulated

* **Economy** — Wood, Stone, Iron, Gold, Food (+ weapons, armour, ale). Woodcutter
  huts fell trees, quarries cut stone, mines dig iron, farms grow food, the
  windmill lifts nearby farms, the bakery and brewery convert stores, the
  blacksmith forges weapons. Producers fill a small local store which peasants
  haul to the stockpile by hand.
* **Population** — popularity is a Stronghold-style ledger (rations, taxes, ale
  from inns, housing headroom or overcrowding, pleasing buildings, and fear from
  enemies near the keep) around a neutral 50. Popularity drives how fast new
  peasants walk to your gate; below 30 they start leaving.
* **Construction** — a 25 %-health building site that peasants walk to and raise;
  more builders work faster, up to 2.4×.
* **Military** — a barracks promotes idle peasants into spearmen and swordsmen, an
  archery range trains archers (gold + weapons), towers, gatehouses and the keep
  shoot on their own, archers garrison walls for extra range, and gates can be
  opened for your own troops and sealed against a ram.
* **Enemy AI** — six escalating waves march from the raider camp using a flow
  field: they pick the nearest gate, wall or the keep as an objective, laddermen
  go over the ramparts, siege engines stop at standoff range behind a covering
  tower, and broken units fall back to the camp to patch themselves up (or desert
  if they keep losing).

## Verification

```bash
node preview/test/headless.mjs        # 53 checks, random seed
SEED=1234 node test/headless.mjs      # reproduce a specific map
DEBUG=1 node test/headless.mjs        # print state at the wave phase
```

The test stubs a minimal DOM/canvas, boots the *entire* app (simulation,
isometric renderer, HUD and input), plays it, and asserts on behaviour rather
than on internals: map generation, economy rates, placement validation,
construction, training, orders, garrisoning, gates, waves, projectiles, camera
gestures, HUD surfaces, pause overlays, speed multipliers, corpse reaping and a
full world restart.

`tools/check_csharp.py` (repo root) is the equivalent gate for the Unity C#
sources.

## Files

| File | Contents |
| --- | --- |
| `src/balance.js` | Every tunable from `Config/Balance.cs`: the damage matrix, 24 buildings, 10 units and the six wave tables |
| `src/map.js` | Seeded value noise, terrain generation, the occupancy grid, the three navigation surfaces, A* with a binary heap, and the Dijkstra flow fields the horde walks on |
| `src/sim.js` | The simulation: `World` owns the tick order, the resource ledger, popularity, jobs, combat, projectiles, the enemy commander and the wave director |
| `src/render.js` | Isometric canvas renderer: baked terrain, cached building sprites, pooled drawing of units and projectiles, the minimap, and the camera (pan / zoom / rotation, screen↔world maths) |
| `src/ui.js` | The HUD: resource strip, popularity drawer, minimap, speed controls, tabbed build menu, selection panel, toasts and overlays |
| `src/main.js` | Boot, the fixed-step game loop (10 Hz logic, render interpolation) and every input path |
| `test/headless.mjs` | The DOM-stubbed smoke test described above |
