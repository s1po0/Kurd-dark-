# Kurd Castle

A Stronghold-inspired isometric castle-builder / RTS built for Android touch screens.

You start with a keep, a handful of peasants and a stockpile. You fell trees, cut
stone, farm and brew; your people are fed, taxed and housed, and their happiness
decides how fast new peasants walk to your gate. You raise walls, towers and a
gatehouse, draft peasants into spearmen, archers and swordsmen, and then you hold
the walls while six escalating siege waves come for your keep.

Everything in this repository is **code and text**. There is no imported art: buildings,
units, projectiles and the entire HUD are generated procedurally at runtime (Unity) or
drawn on a canvas (browser preview). There are no prefabs, no `.meta` files to merge and
no binary assets at all.

---

## Two halves of the same game

| | `unity/KurdCastle/` | `preview/` |
| --- | --- | --- |
| What it is | The shippable game: Unity 6 project targeting an Android APK | The same game as plain ES modules, playable in a browser and under Node |
| Why it exists | APK output, real touch input, phone performance | Verifies the simulation runs, and lets anyone play it without installing anything |
| Physics / rules | `Assets/Scripts/**` (13.7k lines of C#) | `preview/src/**` (~4.9k lines of JS, same numbers, same tick order) |
| Verification | `python3 tools/check_csharp.py` + EditMode tests | `node preview/test/headless.mjs` (60 checks) |

The preview is not a mock-up: it implements the same balance tables, the same
popularity ledger, the same pathfinding surfaces and the same wave director. It is
how the game was verified in an environment with no Unity install — and it earned
its keep, because running it exposed four genuine simulation bugs that were then
fixed on the Unity side too:

* popularity was a ledger of deltas with no neutral baseline, so a well-run castle
  drifted to zero and bled peasants;
* retreating raiders never healed, so a broken wave could stall forever;
* map generation could produce a world with no stone at all;
* a woodcutter's hut placed inside a thicket had nowhere for its lumberjack to stand
  and the castle never saw a log — a stuck-worker bug that only appeared on certain
  seeds (`SEED=2014803555` still reproduces it against the old code).

**Play it now:**

```bash
python3 -m http.server 8080 --bind 0.0.0.0 --directory preview
# open http://localhost:8080  (landscape phone, tablet or desktop browser)
```

It also installs: open the published URL on an Android phone and use
*Add to Home screen* (or the in-game **Install** pill). It launches full-screen
in landscape with its own icon and works offline, because `preview/sw.js`
precaches the whole (tiny) app shell.

---

## Repository layout

```
unity/KurdCastle/                 Unity 6 project (6000.0.32f1)
  Assets/Scripts/Config/          Balance tables, 38 building definitions (34 player
                                  buildable + enemy camp), 16 unit definitions,
                                  resource cost/resource enums
  Assets/Scripts/Core/            Event bus, simulation clock, game state machine,
                                  GameWorld (the composition root), perf monitor
  Assets/Scripts/World/           Terrain, occupancy, three nav surfaces, A* with a
                                  binary heap, flow fields, spatial hash, map gen
  Assets/Scripts/Construction/    Building instances/registry, placement validation,
                                  building sites, rubble, auras, gates
  Assets/Scripts/Economy/         Resource ledger (capacity, rates) and production
  Assets/Scripts/Combat/          Damage matrix, unit registry, movement, projectiles,
                                  garrison/tower fire
  Assets/Scripts/Population/      Popularity ledger, arrivals/departures, job board
  Assets/Scripts/AI/              Six-wave director and the enemy commander
  Assets/Scripts/View/            Procedural meshes, iso camera, world view
  Assets/Scripts/Input/           Touch/mouse gesture router and all player commands
  Assets/Scripts/UI/              Runtime HUD: resources, minimap, build menu, panels
  Assets/Scripts/GameBootstrap.cs One entry point that builds the game in an empty scene
  Assets/Editor/                  Menu + batch tooling: settings, scene, APK/AAB builds
  Assets/Tests/EditMode/          EditMode tests for the rules that must not regress
preview/                          Playable browser mirror (see preview/README.md):
                                  index.html, style.css, src/*.js, test/headless.mjs,
                                  manifest.webmanifest + sw.js + icons/ (installable
                                  PWA), pwa.js
android-app/                      Android packaging (see android-app/README.md):
                                  Bubblewrap Trusted Web Activity config, store icon
                                  and feature graphic, Digital Asset Links template
.github/workflows/pages.yml       Publishes preview/ to GitHub Pages, after running
                                  the headless test suite
tools/check_csharp.py             Static checker used because this repo has no CI
tools/make_icons.py               Regenerates every icon from code (Pillow)
tools/configure_twa.py            Writes the TWA manifest + assetlinks.json for your host
```

Run the two verification gates from the repository root:

```bash
python3 tools/check_csharp.py      # C# : braces, enums, Balance refs, namespaces
node preview/test/headless.mjs     # JS : 60 behavioural checks, random seed
```

---

## How it works

### Simulation

Logic runs at a fixed **10 Hz** (`Balance.Sim.TickRate`) with render interpolation
between ticks, so a slow phone frame never changes the outcome of a fight. The only
sanctioned tick order lives in `Core/GameWorld.cs`:

```
pathfinding → flow fields → game state → construction → training → economy →
population → unit movement → worker jobs → combat → projectiles → enemy commander →
waves → spatial index → corpses → objectives
```

Systems are plain C# classes owned by `GameWorld`; nothing is a `MonoBehaviour`, so
the simulation can be stepped headlessly (and is, by the preview's test suite). A
300-building castle costs no game objects.

### Economy and population

Five primary resources (wood, stone, iron, gold, food) plus weapons, armour and ale.
Producers fill a small local store which peasants **carry by hand** to the nearest
stockpile; gathering buildings consume the actual terrain tile they stand next to, and
foresters replant the woodlot so the castle cannot starve itself.

Popularity is an itemised ledger around a neutral **50**: rations (none/half/full/extra),
taxes (generous → brutal), ale from inns, housing headroom or overcrowding, pleasing
buildings, and fear from enemies near the keep. It drifts toward the target at 0.6 per
second and drives the peasant arrival interval from 40 s (unhappy) down to 4 s (ecstatic);
below 30 your peasants start leaving.

### Castle building

Placement is validated against real rules — terrain, occupancy, forest/rock/iron/fertile
requirements, territory and cost — and the UI explains exactly which rule failed. Walls,
palisades, stairs, towers, a gatehouse, a moat and a drawbridge snap to the grid; sites are
raised by builders who walk to the site (more builders work faster, up to 2.4×). Buildings
can be demolished for salvage, repaired with stone, and rubble has to be cleared.

### Combat

A damage-type × armour-type matrix decides everything: swords beat unarmoured flesh but
bounce off plate, blunt weapons crush armour, fire devours wood and does almost nothing to
stone, and siege engines exist to break masonry. Archers fire real projectiles with
accuracy falloff and can garrison walls for extra range; melee attacks from behind get a
flanking bonus; towers and the keep shoot on their own unless you garrison them with troops.

### The enemy

Six waves, the first at 75 s, then 95–150 s apart, growing from a scouting party into a
catapult train and finally the Warlord's host. The commander picks the nearest gate, a wall
stretch away from your towers, or the keep; laddermen climb the parapet using a dedicated
wall-bypass navigation profile; siege engines stop at standoff range behind a covering tower
and bombard from there; broken raiders fall back to the camp, patch themselves up and rejoin
the next push — or desert if they keep losing.

### Performance

Object pools for units, projectiles and damage numbers; instanced trees and walls; a single
baked terrain mesh; no per-frame allocations in the hot paths; culling distances for unit
views and health bars; and an adaptive quality monitor that thins effects when the frame
time slips. The preview applies the same discipline to the canvas renderer (cached building
sprites, throttled minimap, signature-guarded HUD rebuilds).

---

## Building the Android APK — step by step

> **In a hurry, or no Unity install handy?** `android-app/README.md` has a second,
> fully scriptable route: the browser build wrapped into a real signed **APK and
> Play-Store AAB** with Bubblewrap (a Trusted Web Activity). It needs only Node,
> a JDK and the Android SDK — all of which install themselves — and takes about
> fifteen minutes end to end. Store icon and feature graphic are already
> generated in `android-app/twa/`.

For the native Unity build, the project ships its own build tooling, so packaging
is five menu clicks plus a keystore.

### 0. Prerequisites (once per machine)

1. **Unity Hub** — <https://unity.com/download>.
2. **Unity 6** (this project pins `6000.0.32f1`; any newer 6000.0.x works). In Unity Hub
   ▸ *Installs* ▸ *Add modules*, tick:
   * **Android Build Support**
   * **Android SDK & NDK Tools**
   * **OpenJDK**
   Unity installs a working JDK 17, SDK and NDK — you do **not** need Android Studio.
3. **A phone with USB debugging enabled** (Settings ▸ About ▸ tap Build number 7×, then
   Developer options ▸ USB debugging), or an emulator.
4. Optional but recommended: `adb` on your PATH (`~/Android/Sdk/platform-tools`).

### 1. Open the project

1. Unity Hub ▸ *Add* ▸ select `unity/KurdCastle` ▸ open it with Unity 6.
2. Let Unity import (there is nothing binary to import — it compiles the scripts and
   generates `.meta` files on first open; those are yours to commit or ignore).
3. No input configuration is required: the game routes touch and mouse gestures itself,
   so neither the legacy `Input` axes nor an *Input Actions* asset has to exist.

### 2. Switch to Android and apply the project settings

1. *File ▸ Build Profiles* (Unity 6) or *File ▸ Build Settings* ▸ **Android** ▸
   *Switch Platform*. This takes a minute the first time.
2. Run the menu item **Kurd Castle ▸ 1. Apply Android Project Settings**. It sets:
   landscape-left orientation, IL2CPP, ARM64 + ARMv7, min SDK 24 (Android 7.0),
   target SDK automatic, .NET Standard 2.0, managed stripping *Medium*, 60 fps target,
   and the package identifier `com.kurdcastle.prototype` — change the last one in
   *Edit ▸ Project Settings ▸ Player ▸ Other Settings* before you ship anything.

### 3. Create the boot scene (already in the repository)

`Assets/Scenes/Main.unity` is a deliberately **empty** scene: the entire game is built at
runtime by `GameBootstrap` via `[RuntimeInitializeOnLoadMethod]`, which is why the project
carries no prefabs. If the file is ever missing, **Kurd Castle ▸ 2. Create Empty Boot
Scene** regenerates it and adds it to the build list as scene 0.

> Playing in the editor also works: press **Play** in the empty scene and the game
> assembles itself. WASD pans, the mouse wheel zooms, left click selects, right click
> orders — the touch gestures are mapped onto the mouse so gameplay can be tested on a
> desktop.

### 4. Build a debug APK and put it on the phone

1. Menu **Kurd Castle ▸ 3. Build Debug APK** → output `Builds/Android/KurdCastle-debug.apk`.
2. Install it:

   ```bash
   adb install -r Builds/Android/KurdCastle-debug.apk
   ```

   or copy the APK to the phone and tap it (allow "install unknown apps").
3. Watch the log while you play:

   ```bash
   adb logcat -s Unity
   ```

   The in-game **performance overlay** (top-left, built by `GameBootstrap`) shows the
   simulated tick, frame time and the unit/projectile counts.

### 5. Make a release build

1. **Create a keystore** (once, from the command line — keep this file safe, it is the
   identity of your app):

   ```bash
   keytool -genkeypair -v -keystore kurdcastle.keystore \
           -alias kurdcastle -keyalg RSA -keysize 2048 -validity 10000
   ```

2. In Unity: *Edit ▸ Project Settings ▸ Player ▸ Publishing Settings*, enable
   **Custom Keystore**, point it at `kurdcastle.keystore` and type the alias and passwords.
   (Never commit a keystore to a public repository.)
3. Menu **Kurd Castle ▸ 4. Build Release APK** → `Builds/Android/KurdCastle-release.apk`
   for direct distribution, or **Kurd Castle ▸ 5. Build Release AAB** →
   `Builds/Android/KurdCastle-release.aab` for Google Play (Play requires an `.aab`).

### 6. Automate it (CI / no IDE)

The same tooling is callable from the command line, which is how a build server should do it:

```bash
Unity -batchmode -quit -nographics -projectPath unity/KurdCastle \
      -executeMethod KurdCastle.EditorTools.KurdCastleBuilder.ApplySettingsFromCommandLine \
      -logFile -

Unity -batchmode -quit -nographics -projectPath unity/KurdCastle \
      -executeMethod KurdCastle.EditorTools.KurdCastleBuilder.BuildAndroidReleaseFromCommandLine \
      -logFile -
```

The batch entry points are `ApplySettingsFromCommandLine`, `BuildAndroidDebugFromCommandLine`,
`BuildAndroidReleaseApkFromCommandLine` and `BuildAndroidReleaseFromCommandLine` (AAB). They
exit non-zero (and print the build report) when a build fails, so a pipeline can gate on them.

### 7. Pre-flight checklist before you show it to anyone

* Install on a real phone, not just an emulator: pinch zoom, two-finger rotate, edge drag,
  long-press attack-move and drag placement all need fingers.
* Rotate the device — the game locks to landscape and reflows the HUD.
* Play two waves at 1× and 4× speed; watch the performance overlay stay inside the frame
  budget, and let the adaptive-quality monitor drop effects on a weak device.
* Check the Android back gesture: it pauses rather than quits, and the pause overlay has
  Resume and Restart.

### Troubleshooting

| Symptom | Fix |
| --- | --- |
| "Android SDK not found" when building | Install **Android SDK & NDK Tools** + **OpenJDK** from Unity Hub for that exact editor version, then re-open the project. |
| IL2CPP build fails with a C++ toolchain error | The NDK bundled by Hub is required; do not point Unity at a random NDK. Re-install the module. |
| APK installs but shows a black screen | The boot scene is not scene 0 — run **Kurd Castle ▸ 2. Create Empty Boot Scene**, or check *Build Profiles ▸ Scene List*. |
| Build succeeds, app crashes on start | Run `adb logcat -s Unity` and look for the first exception; it is almost always a stripped-away type (raise *Managed Stripping Level* to *Low*). |
| Touch does nothing on device | Make sure nothing is consuming the input: the HUD uses `UnityEngine.UI` with an `EventSystem` created by `UiFactory`; do not add an Input System package that switches the active input backend. |
| Play Store rejects the upload | It needs an `.aab`, a version code that increases every upload (*Player ▸ Other Settings ▸ Version*), and target SDK 34+. |

---

## Gameplay reference

**Resources** — Wood, Stone, Iron, Gold, Food, plus Weapons and Armour (from the
blacksmith) and Ale (from the brewery). Storage caps grow with every stockpile and granary;
peasants physically carry loads to the store, so a castle that is cut off by walls will
starve its own economy.

**Popularity levers**

| Lever | Effect |
| --- | --- |
| Rations: none / half / full / extra | −8 / −4 / 0 / +5 |
| Taxes: generous / low / normal / high / brutal | −6 / −2 / 0 / −4 / −9 (and gold per minute) |
| Ale in inns | +3 per inn, up to +12 while ale is in store |
| Church / pleasing buildings | up to +6 |
| Housing headroom / crowding | up to +1.5 / −2.5 per missing slot |
| Enemies at the gates | down to −25, plus −6 while the keep is attacked |

**Waves** — 1 Scouting Party (75 s) · 2 Marauders · 3 The First Ram · 4 Brute Column ·
5 Catapult Train · 6 The Warlord's Host. Clear all six to win; lose the keep and the
match ends.

**Controls (touch)** — drag to pan (hold near an edge to edge-drag), pinch to zoom,
twist two fingers to rotate, tap to select, long-press with troops selected to arm
attack-move, tap the minimap to jump the camera, double-tap to focus, pick a building
from the bottom-right menu and tap the map to place it (green pass, red fail with a
reason), and use the top-right cluster for pause and 1× / 2× / 4× speed.

---

## Testing

```bash
python3 tools/check_csharp.py        # static C# checks (no toolchain needed)
node preview/test/headless.mjs       # 60 behavioural checks against the live simulation
SEED=1234 node preview/test/headless.mjs
DEBUG=1 node preview/test/headless.mjs
```

`tools/check_csharp.py` catches the failure modes of writing C# without a compiler:
unbalanced braces, references to enum members or `Balance.*` constants that do not exist,
object-initialiser fields that are not declared, duplicate types, and — the one that
actually bit — using a type from another namespace without the matching `using` directive.
It scans the gameplay sources, the editor tooling and the EditMode tests.

The EditMode tests (Unity ▸ *Window ▸ General ▸ Test Runner ▸ EditMode*) cover the same
rules from the C# side: resource capacity, ration/tax maths, the damage matrix, terrain and
navigation rules, A* around a wall, catalog integrity, the wave table and the game state
machine.

---

## What this prototype deliberately leaves out

Honest scope note, so nothing here is mistaken for finished work:

* **No imported art or audio.** Everything is unlit-coloured procedural geometry; there are
  no textures, animations, sounds or music yet.
* **No save/load.** A match is a session; restart is instant because the world is generated.
* **No campaign or economy between matches** — no mission scripting, no persistent gold.
* **No multiplayer**, and the AI is deliberately simple: one commander, six scripted waves.
* **Godot compatibility** is structural, not literal: the simulation classes under
  `Core/`, `World/`, `Economy/`, `Combat/`, `Population/`, `AI/` and `Config/` are
  engine-agnostic C# with no `MonoBehaviour` dependency (they only use `Vector3`/`Mathf`
  style helpers), so a Godot port would replace `View/`, `Input/` and `UI/` and reuse the
  rest. The browser preview is proof that the rules survive being moved to another
  runtime.
