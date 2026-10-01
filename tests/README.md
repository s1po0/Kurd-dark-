# Tests

One harness, no framework, no dependencies:

```bash
node tests/smoke.js        # 337 passed, 0 failed   (~13 s)
```

`shim.js` fakes the browser — DOM nodes, `classList`, a `Proxy` 2D context that swallows every draw
call, `localStorage`, `requestAnimationFrame`, `navigator.getGamepads`, and a deliberately `undefined`
`AudioContext` so the audio layer takes its silent path.

`smoke.js` is the hard part, for a reason specific to this codebase: the game ships as eleven plain
browser scripts, so every module-level `const` lives in *script* scope, and `eval`-ing the files
separately would leave each one unable to see the others. The harness therefore **concatenates all
eleven sources into one string, `eval`s it once, and injects the test body into that same scope**:

```js
const src = FILES.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('\n');
eval(src + '\n;(' + run.toString() + ')()');
```

`run` is a real function whose source is inlined, so the assertions execute against the genuine
`Game`, `Player`, `World`, `derive` and `weaponDamage` — nothing is mocked except the DOM.

The simulation is driven by hand: `frames(n)` calls `Game.update(1/60)` *n* times and `Input.endFrame()`
after each, exactly as the real loop does; `key(code)` and `hold(code, n)` set `Input.pressed` /
`Input.down` for the right action. `sleep(ms)` yields to the macrotask queue so the game's real
`setTimeout` beats land — the 1.7 s death screen and the 2.6 s boss-kill reward pause are asserted as
timed behaviour, not skipped.

---

## What it covers

| § | System | Asserted |
|---|---|---|
| 1 | Boot & new game | SL = Σ − 90, all nine attributes, derived pools, zone population |
| 2 | **Formula regression** | the three GDD reference builds end to end: HP/FP/stamina ordering, poise grades, mitigation, attunement slots, weapon anchors (A Longsword +5 Refined = 210), catalysts deal no melee, Heavy > native at STR 50, Raw +10 = flat ×2.0, hex > fire at equal spell rank, SL 125 = 58,603 souls, Estus 300 → 890 |
| 3 | **Equip-load tiers** | FAST / MID / FAT / OVERBURDENED resolved from real gear weights; each heavier tier has fewer i-frames, a longer roll and less distance; overburdened loses the roll entirely; ADP buys i-frames, shortens recovery and shortens the Estus drink |
| 4 | Idle & render | 120 frames, `Game.render`, `UI.hud` |
| 5 | Movement | walk ≤ 118 px/s, sprint > walk, roll stamina cost, `STA_DELAY` regen gate, empty stamina refuses the roll |
| 6 | Attacks | light/heavy states, recovery, heavy ×1.55, two-hand, swap hands |
| 7 | Roll & backstep | i-frames live mid-roll and are cut at 86 % of the animation, roll length, stamina, guard + roll = backstep with its own numbers |
| 8 | Guard / parry / riposte | shield attach on `recalc`, guard state while held, guard drops on release, ×0.35 regen while guarding, 6f/8f parry with window f7–14, riposte ×3.20 kills |
| 9 | Healing | Estus is instant and spends a charge; Life Gem heals over 13.5 s and applies the movement penalty |
| 9b | Consumables | Ember, resins (+30 % elemental for 60 s), Firebomb as a real 60 px blast projectile, Alluring Skull breaking aggro, Estus Shard raising the pool to the 15 cap, allocation split, boss souls consuming for 6,000, quickslot select-then-F, Titanite refusing to be "used" |
| 10 | **Power Stance** | twinblades enable it, below 1.5× it is refused with the exact missing stat, class mismatch returns `null`, two-handing one weapon works at 1.5× STR and fails at STR 14, heavy opens it, the chain reaches the finisher, posture ×1.6 / ×2.4 / ×0.40 |
| 11 | Weapon arts | FP spent, art refused at 0 FP |
| 12 | Magic | slot counts from ATT, attunement gated on requirements and on slots, a sorcery staff refuses a hex, `CAST_FRAMES` composing catalyst × ADP × DEX × load, FP committed at cast start, the projectile's damage/type/school/lifetime, all four schools on their own catalyst, self miracles heal and spawn nothing, WANT full refuses the cast, re-attuning unattunes |
| 13 | WANT / Resonance | the full ladder +0 / +8 / +18 / +32 %, rank 3 at WANT 7, back to 0 when emptied |
| 14 | **Death loop** | stain records zone/position/full purse, souls go to 0, slow-mo beat, the 1.7 s screen, respawn at the last bonfire with full HP and Estus, the stain survives respawn, prompts at 30 px (radius 34) but only collects inside 26 px, a penniless death leaves nothing, the next death drops the new purse |
| 15 | Menus | all nine tabs render |
| 16 | Levelling | cost, Vigor → HP, Vitality → capacity and tier change, Endurance → stamina, ADP → i-frames, Level = Σ − 90 invariant |
| 17 | Gear | cycling, armour poise, **mixed-set −4 on the off-set piece**, ring rule |
| 18 | Smithing | upgrade refused without titanite, shard consumed, +10 cap, ×2.0 at +10, all eight infusions producing distinct numbers, infusion cleared back to native |
| 19 | Covenants | exactly five, each refusing an unmet requirement with its reason, each accepting once met, rank 2 in two of them for the hidden ending, betrayal sin |
| 20 | Bonfire | rest heals/refills/respawns the region, kindle +5 Estus, **Bonfire Ascetic A1 → A4 with the multiplier table**, A4 cap, Kindled Echo at A4, warp across zones |
| 21 | Zones | all five load with their room/bonfire/encounter/NPC counts, NPC talk menu |
| 22–24 | **The three bosses** | fog-gate prompt, arena entry, introduction, move counts 16/24/22, **every move telegraphs ≥ 12 frames** (boss grammar rule 1), AI cycling distinct moves under a godmode player, phase gates at 50 %/40 % with a 3.3 s invulnerable transition, arena transform and tint, severable parts with the correct damage type (`WRONG TYPE` on a mismatch), severance rewards, flags, the 2.6 s reward pause, boss souls granted, HP scaled by the ascetic |
| 25 | Enemies | nine archetypes with their HP/damage/souls, elite overlays as `elite_<id>`, an unknown type **throws instead of spawning a broken enemy**, the 2-attacker token limit, input reading a heal, death drops |
| 26 | **Endings** | R13 reachable and flagged as the expansion, the Serpent, the Threshold prompt in the nave, all three endings **locked** when unmet and the game refusing to end, each unlock path (FTH 30 *or* Sunlight rank 2; WANT exactly ≥ 4; 5 sigils + 2 covenants at rank 2 + **all 14** Echoes), taking Throne of Want wipes the save |
| 27 | New Game+ | cycle counter, every region raised but capped at A4, bosses revived and tougher and paying more, **the ladder stops at NG+7** |
| 28 | Save / load | round-trip of SL, souls, stats, smithing state, zone and cycle; `Save.exists()` gates Continue |
| 29 | Stability | 3,600 frames across all five zones with attacks, rolls, guards and Estus, plus render and HUD every lap; particle pool under its cap |

---

## Bugs the harness caught

These were real defects in the game, found by running it rather than reading it:

- **Rolls were free.** `tickRoll` ended with `staDelay = max(staDelay, 0.05)`, overwriting the 0.55 s
  penalty set at roll startup, so 50/s regen refilled the whole cost within a few frames.
- **Your own bloodstain was collected the frame you died.** `collectBloodstain()` had no dead-player
  guard and `Game.update` calls it unconditionally, so the death→recovery loop never existed.
- **Two-handing a single weapon could never Power Stance.** `get powerStance()` bailed on `!b` (empty
  left hand) before reaching the two-hand branch.
- **A stale death timer could strand the game in `state='dead'`** long after the player had respawned,
  which in turn silently cancelled every boss-kill reward. Death beats are now token-guarded and
  `respawn()` / `loadGame()` cancel the pending one.
- **`chooseEnding()` did not enforce its own requirements** — only the menu markup did. The gate is now
  `Game.endingUnlocked(id)` and both paths use it.
- **There was no NG+ cycle counter**, so the NG+7 cap in Vol 7 §7.3.5 was unenforceable. Added,
  persisted, and capped.
- **Weapon scaling was wildly overtuned.** The first coefficient produced a 496-damage quality
  Longsword +5 against the GDD's ~207 anchor. Re-derived to 0.112 and pinned by an assertion.
- **Infusion stat keys did not match.** `INFUSIONS` uses `STR`/`DEX`; weapon scaling uses the same
  keys but the lookup fell through to a 0 weight, silently deleting all scaling under any infusion.
- **`Enemy` dereferenced `undefined`** for any non-`elite_` type because `ELITES[type.slice(6)]` was
  evaluated unconditionally. It now throws a clear error on an unknown archetype.
- **The interaction prompt evaluated `fmt(n.o.souls)` for every kind at once**, so an object literal
  crashed the whole update loop on the first frame of play. Labels are now lazy per kind.
