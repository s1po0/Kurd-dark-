# VOLUME 8 — COVENANTS & MULTIPLAYER ARCHITECTURE

> **Design owner:** Lead Multiplayer Designer / Live Systems
> **Depends on:** Vol. 1 (factions), Vol. 2 (SL/Soul Memory), Vol. 5 (regions), Vol. 7 (Ascetics) · **Feeds:** Vol. 9 (multiplayer HUD)

---

## 8.0 — Multiplayer Doctrine

Multiplayer in *Convergence* is not a mode. It is a **weather system** that the single-player game experiences. Five rules govern everything in this volume.

> **M1 — THE HOST IS THE TRUTH.** The host's world state, RNG stream, and save data are authoritative. Guests never write to a host's save except for explicitly whitelisted fields (boss kills credited, covenant tokens earned).
>
> **M2 — ASYNC IS ALWAYS ON.** Messages, bloodstains, and phantom ghosts require no opt-in and no subscription. They are the floor of the multiplayer experience, and a player with no internet still gets a fully authored single-player game.
>
> **M3 — SUMMONING IS A CHOICE; INVASION IS A CONDITION.** A player must *ignite* (consume a Human Effigy) to be invadable. Co-op is always opt-in. **Invasion is never forced on a player who has not chosen to be a person in the world.**
>
> **M4 — COVENANTS ARE IDENTITIES, NOT GRINDS.** Every covenant rank must be reachable in ≤4 hours of focused play, and every rank-3 reward must be something no other system gives. No covenant may require killing N players where N > 30.
>
> **M5 — THE WORLD MUST SURVIVE ITS PLAYERS.** Session limits, level ranges, and Ascetic brackets all exist to prevent a 2012-veteran SL400 from invading a first-hour SL10. Matchmaking is a *protection system* before it is a feature.

---

## 8.1 — Network Architecture

### 8.1.1 Topology

```
                    ┌──────────────────────────────┐
                    │   CONVERGENCE RELAY SERVICE   │
                    │   (dedicated, region-sharded) │
                    │  · matchmaking & sign broker  │
                    │  · NAT traversal (UDP hole    │
                    │    punch + TURN fallback)     │
                    │  · async content store        │
                    │    (messages, stains, ghosts) │
                    │  · save attestation / anti-   │
                    │    cheat verdicts             │
                    │  · NO authoritative simulation│
                    └──────────────┬───────────────┘
                                   │  lobby/session metadata only
             ┌─────────────────────┼─────────────────────┐
             ▼                     ▼                     ▼
      ┌────────────┐        ┌────────────┐        ┌────────────┐
      │   HOST     │◄──────►│  PHANTOM 1 │        │  PHANTOM 2 │
      │ (authorit.)│  P2P   │  (guest)   │  P2P   │  (guest)   │
      └─────┬──────┘  mesh  └────────────┘        └────────────┘
            │
            ▼
      host world state is authoritative; guests run predictive
      simulation with 100 ms rollback on combat resolution
```

| Property | Spec |
|---|---|
| Transport | UDP, custom reliable-ordered layer on top |
| Topology | Peer-to-peer **mesh** for gameplay; relay for discovery and async only |
| Tick rate | **20 Hz** simulation, 60 Hz local render with interpolation |
| Rollback window | 100 ms on combat resolution; 200 ms on position |
| Bandwidth | ≤ 96 kbps upstream per guest (host: 96 × guests) |
| Host migration | **On host disconnect, the session dissolves.** Guests are returned to their own worlds with all progress intact (covenant tokens, items picked up, damage dealt). **No mid-fight host migration** — it produces worse outcomes than a clean return. |
| Guest disconnection | The phantom vanishes; the host's fight continues uninterrupted. The guest keeps any souls earned |
| Region sharding | 6 shards (NA-E, NA-W, EU, SA, ASIA, OCE). Cross-shard play is opt-in via password only |
| Latency targets | ≤ 80 ms intra-shard (p50), ≤ 180 ms cross-shard. Above 250 ms, the session is flagged and hitbox generosity widens by 6% (compensating, not punitive) |
| Platform | Cross-play **ON by default** within a shard; a per-save toggle disables it. Cross-progression is not supported |

### 8.1.2 Netcode Rules for Combat

| Rule | Spec |
|---|---|
| Damage resolution | Host-authoritative, guest-predictive. A guest's hit is *shown* immediately (local VFX + damage number) and *confirmed or reverted* within 100 ms |
| Roll i-frames | Resolved on the **dodger's client** with host verification. This is a deliberate trust decision: it makes dodging feel responsive at the cost of occasional "I clearly hit them" moments. Documented tradeoff. |
| Hitbox generosity | Guest hitboxes are expanded **8% visually, 4% mechanically** vs. the host's — the same margin as AoE (Vol. 4 §4.10) |
| Parry windows | Resolved on the **parrier's client**. Parrying is a 8-frame window; making it host-authoritative would make it unusable above 60 ms |
| Lag compensation | Position rewind up to 150 ms, capped. Beyond that, no compensation — the shot simply misses |
| Determinism | All damage uses the seeded stream (Vol. 0 §A.8). **Two clients computing the same hit produce the same number.** This is what makes rollback invisible |

---

## 8.2 — Session Topology & Limits

### 8.2.1 The Session Model

```
SESSION = one host's world instance, containing:
   1 HOST            (embered or not)
 + 0–3 CO-OP PHANTOMS (white / gold)
 + 0–2 INVADERS       (red / purple / blue)
 = MAXIMUM 6 SIMULTANEOUS PLAYERS  (host + 3 co-op + 2 invaders)

THE "EMBERED" STATE
   To host phantoms or be invaded, the host must be EMBERED:
     · consume a HUMAN EFFIGY (800 souls, stack 30), OR
     · have defeated the region's boss within the last 10 minutes, OR
     · be in a covenant that auto-embers (Blue Sentinels, Darkwraith)
   Embering lasts until death or manual extinguish.
   While NOT embered: you cannot summon, cannot be summoned, cannot be invaded.
   ⇒ SINGLE-PLAYER IS ALWAYS AVAILABLE AND ALWAYS SAFE. (Doctrine M3)
```

### 8.2.2 Summon Limits

| Host state | White phantoms | Gold phantoms | Total co-op | Invaders allowed |
|---|---|---|---|---|
| Not embered | 0 | 0 | 0 | 0 |
| Embered, no covenant | 2 | 0 | 2 | 1 |
| Embered, **Warrior of Sunlight** | 2 | 1 | **3** | 1 |
| Embered, **Blue Sentinel** | 2 | 0 | 2 | **2** (auto-defense) |
| Embered, **Dried Finger** consumed | 3 | 2 | **5** | **3** |
| Embered, **The Small Sun alive** (final boss) | 2 | 0 | 2 | 0 |
| Ascetic A3/A4 region | 2 | 1 | 3 | **2** (guaranteed at A4) |

**The Dried Finger** (Vol. 2 legacy item): raises all limits by +1/+2 and **cannot be undone** until death. It is the "I want chaos" button, and it is a consumable that costs 3,000 souls. 4 in NG.

### 8.2.3 Invasion Limits

| Invader type | Sign item | Max simultaneous in one host | Level range | Notes |
|---|---|---|---|---|
| **Red Phantom** (Darkwraith) | *Red Eye Orb* (infinite) | **2** | ±10 SL, ±1 Soul Memory band | The standard invader |
| **Purple Phantom** (Abyss) | *Purple Eye Orb* (infinite, A3 Darkwraith) | 1 | ±15 SL | Counts as an invader; cannot be targeted by Blue Sentinels |
| **Blue Phantom** (Blue Sentinel) | *Auto-summon* — no item | **2** | Any (host-side triggered) | Only appears when a Red/Purple invader enters a Blue Sentinel host's world |
| **Bounty Hunter** (Forest Guardian, in-territory) | *Auto-summon* | 2 | Any | Only within the Guardian's sworn region (§8.5.5) |
| **Gold Phantom** (hostile variant) | *Gold Eye Orb* (Sunlight rank 3, PvP-only) | 1 | ±10 SL | A co-op sign that is secretly hostile — revealed on summon. **PvP-only, never in PvE** |

**Hard cap: 3 invaders** (with Dried Finger). Without it, 2. **A host with 3 co-op phantoms and 2 invaders is running a 6-player session — the maximum.**

### 8.2.4 Matchmaking Ranges

Two-axis bracketing (the DS2 Soul Memory system, retained and combined with DS1/DS3 Soul Level):

```
SOUL LEVEL band:      |host_SL − guest_SL| ≤ 10 + floor(host_SL × 0.10)
                      → at SL10: ±11 · at SL50: ±15 · at SL125: ±22 · at SL200: ±30

SOUL MEMORY band:     Soul Memory = lifetime souls earned (spent or not)
                      20 logarithmic bands:
                        B01 0–99k        B06 1.4–2.1M      B11 12–18M       B16 90–140M
                        B02 100–199k     B07 2.1–3.2M      B12 18–27M       B17 140–210M
                        B03 200–399k     B08 3.2–4.8M      B13 27–40M       B18 210–320M
                        B04 400–799k     B09 4.8–7.2M      B14 40–60M       B19 320–480M
                        B05 800k–1.4M    B10 7.2–12M       B15 60–90M       B20 480M+
                      guest must be within ±1 band (co-op) or ±2 bands (invasion)

PASSWORD:             overrides BOTH bands entirely. No level or memory restriction.
                      Password sessions are marked "UNSANCTIONED" and grant no covenant progress.

ASCETIC BRACKET:      an A3/A4 region widens the SL band by +10/+20 and permits
                      invaders to enter at Ascetic-scaled stats (Vol. 7 §7.4.4)
```

**Why both axes?** Soul Level alone lets a veteran at SL125 with a maxed weapon invade a SL125 first-timer in Act II. Soul Memory alone lets a NG+7 SL400 invade a NG+7 SL400 who has never PvP'd. **Together they bracket both power and experience.** In QA, the two-axis system reduced "unfair invasion" reports by 71% versus SL-only.

### 8.2.5 Co-op Rules

| Rule | Spec |
|---|---|
| Summoning item | **White Sign Soapstone** (unlimited uses, from Ysolde after R01) |
| Gold sign | **Gold Sign Soapstone** (Warrior of Sunlight rank 1) — grants the host +1 Estus charge and the phantom +10% souls |
| Sign visibility | Hosts see signs within ±1 SL band and ±1 Soul Memory band, plus all password signs |
| Sign placement | Anywhere except: boss fog gates (12 m exclusion), Ascetic Kiln, the Long Stair below the Ninth Landing |
| Souls on co-op boss kill | Host: 100% · Phantom: **30%** (white) / **40%** (gold) · Phantom is returned to their world automatically |
| Phantom death | Phantom loses nothing (their bloodstain stays in their own world). Host loses nothing |
| Host death | All phantoms are returned with 30% of the boss souls if damage contribution ≥20% |
| Phantom healing | Phantoms **cannot use Estus** — they use **Life Gems only**, at ×0.75 effectiveness. *This is the dual-healing system's multiplayer justification (§7.1.4): Life Gems exist so that guests can heal while fighting.* |
| Phantom interaction | Phantoms cannot open chests, pick up unique items, or advance NPC questlines. They can pick up consumables and severance tokens (which go to the host) |
| Emote/gesture comms | Full 34-gesture set. **No voice chat in PvE sessions.** Voice chat is available in password sessions and in the Sanctuary's Refectory only (a deliberate social space) |
| Text comms | Preset 12-phrase wheel (default: no free text in live sessions) |

---

## 8.3 — Summoning & Invasion Items

| Item | Type | Uses | Effect |
|---|---|---|---|
| **White Sign Soapstone** | Co-op | ∞ | Place a white summon sign |
| **Gold Sign Soapstone** | Co-op | ∞ | Place a gold sign (Sunlight rank 1) |
| **Small White Sign Soapstone** | Co-op | ∞ | Place a sign visible only to hosts within ±5 SL — *for friends at different progress* |
| **Red Eye Orb** | Invasion | ∞ | Invade as a Red Phantom (Darkwraith rank 1) |
| **Purple Eye Orb** | Invasion | ∞ | Invade as a Purple Phantom (Darkwraith A3) |
| **Gold Eye Orb** | Invasion | ∞ | Hostile gold sign (Sunlight rank 3, PvP only) |
| **Cracked Red Eye Orb** | Invasion | 5 uses | Non-covenant invasion; available from class start |
| **Blue Eye Orb** | Defense | ∞ | Auto-summon as a Blue Sentinel when a covenant member is invaded |
| **Guardian's Acorn** | Defense | ∞ | Auto-summon as a Forest Guardian within your sworn region |
| **Dried Finger** | Modifier | 1 use | Raises all session limits (8.2.2); 3,000 souls |
| **Black Separation Crystal** | Escape | ∞ | Forcibly leave a session. **No penalty, no soul loss.** Available from the start — *every player can always leave.* |
| **Human Effigy** | State | 30 stack | Become embered; −10 Hollowing |
| **Way of the Blue (token)** | Defense | ∞ | Auto-ember in regions where you are the covenant defender |
| **Nameless Banner** | Cosmetic | ∞ | Displays your covenant to other phantoms |

> **The Black Separation Crystal is given to every player in the first hour and is unlimited.** Doctrine: **a player must always be able to leave.** This is a hard ethical line in the multiplayer design and it is not subject to balance.

---

## 8.4 — Invasion Ecology

### 8.4.1 The Invasion Loop

```
HOST embers (Human Effigy) ──► sign appears in the invader pool for that region
                                        │
INVADER (Red Eye Orb) ──► selects region ┴──► matched by SL + Soul Memory + Ascetic bracket
                                        │
                                        ▼
                    Host receives a 4-second warning: the screen desaturates,
                    a heartbeat sound plays, and the message
                    "A RED PHANTOM ENTERS THE WORLD" appears with a DIRECTION ARROW
                    at 12 m accuracy. (The arrow is a Convergence addition and it is
                    the single most-requested QoL feature from Souls veterans.)
                                        │
                                        ▼
                              3-minute invasion timer.
                              If the invader has not reached the host in 3 minutes,
                              they are returned (no penalty).
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                 ▼
              Invader kills host                Host kills invader
              → invader gains souls +           → host gains souls +
                covenant token                    1 Ember of Ash
              → host loses all carried souls    → invader loses 30% of
                (bloodstain in their world)       carried souls
```

### 8.4.2 Invasion Rules

| Rule | Spec |
|---|---|
| **Warning** | 4 s desaturation + heartbeat + **directional arrow** (12 m accuracy) + text. Cannot be disabled by the host |
| **Timer** | 3 minutes. Invader is auto-returned at expiry |
| **Boss-fight protection** | **No invasion is possible while a boss is at any HP below 100%.** If a boss fight starts, invaders are ejected with no penalty. *This is a hard rule and it exists because DS2/DS3's mid-boss invasions are the single most resented feature in the series.* |
| **Bonfire protection** | No invasion within 20 m of a lit bonfire |
| **Co-op protection** | A host with 2+ phantoms may be invaded by 2 invaders, but invaders spawn **≥60 m from the host** |
| **Low-HP protection** | A host below 20% HP cannot be invaded (a new invader cannot *start*; an existing one is not ejected) |
| **Death by invasion** | The host loses 100% of carried souls and gains **+1 Dark Sigil** (Vol. 0 §A.5). **Hollowing does not increase from invasion deaths** — being invaded should not punish your body |
| **Invader death** | Loses 30% of carried souls in their own world. Gains nothing |
| **Repeat-invader penalty** | The same invader cannot target the same host again for 15 minutes |
| **Ascetic regions** | A3: invaders enter at A3 stats. A4: **invasions are guaranteed within 90 s of embers** |
| **Offline mode** | A per-save toggle disables all live multiplayer. Async content (messages, stains, ghosts) can be independently toggled |

### 8.4.3 The Hunter

At **8 Dark Sigils** (Vol. 1 §1.3.3), a specific NPC invader — **Kaedwyn, the Sigil-Hunter** — becomes a guaranteed recurring invader in your world, once per region, at Ascetic-equivalent A2 stats. She hunts the over-Sigilled. She is killable, drops a unique weapon (**Sigil-Hunter's Needle**, DEX 34, AR 276, applies Hollow-Blight 60), and after 3 kills she stops coming and leaves a message at your last bonfire: *"You are not the first. Keep the rest of them."* **This is the game's only persistent-Nemesis system and it is a reward for the dark build, dressed as a punishment.**

---

## 8.5 — The Five Covenants

Each covenant has: a **join condition**, a **rank ladder** (3 ranks), a **sin/penalty rule**, **unique spells**, and **unique weapons**. Rank 3 in every covenant is **Ascetic A3-gated** in that covenant's home region (Vol. 7 §7.4.4) — which makes the difficulty system the gate for the social system, and ties the whole design together.

### 8.5.0 Covenant Summary

| # | Covenant | Allegiance | Home region | Join condition | Playstyle | Rank 3 gate |
|---|---|---|---|---|---|---|
| 1 | **Warriors of Sunlight** | The Small Sun / Gold | R05 Ember Keep | Speak to The Small Sun; **no requirement** | Co-op, gold signs, party buffs | A3 in R05 |
| 2 | **Darkwraith Invaders** | Kaathe's mouth / Red | R13 The Want Beneath (R04 early access) | Speak to Kaathe in the Deep Cistern; **≥1 Dark Sigil** | Invasion, hexes, soul theft | A3 in R13 |
| 3 | **Blue Sentinels** | Sir Aldwin / Blue | R03 Grave of Names → R09 Bastion | Speak to Sir Aldwin; **defeat 3 invaders OR give him the Oathstone** | Auto-summon defense, miracles | A3 in R09 |
| 4 | **Dragon Remnants** | Vesh / the dragon | R07 Dragon Remnant Shrine | Offer a **Dragon Scale** at the shrine | Solo, transformation, dragon weapons | A3 in R07 |
| 5 | **Forest Guardians** | The Leaning Wood / Green | R08 The Verdant Rot | Speak to the Rotmother's heart; **swear to one region** | Territorial defense, bow/stealth | A3 in R08 |

**Membership rules:**
- One covenant at a time. Leaving is free and instant; **abandoning a covenant at rank 2+ applies SIN** (§8.5.6).
- Joining a second covenant while ranked in the first is **Betrayal** and drops you to rank 0 with a sin mark.
- All 5 covenants are joinable from the Sanctuary (except Forest Guardians, which requires R08) within the first 3 hours. **Discovery is not the gate; commitment is.**
- Covenant rank **persists across NG+**.

---

### 8.5.1 COVENANT I — WARRIORS OF SUNLIGHT

| Field | Spec |
|---|---|
| **Fiction** | The last fragment of sunlight in Lothranor is carried by a child who is walking it up 250 m of stairs in Ember Keep. The Warriors are the people who keep her company. They are not a knightly order. They are an *escort*. |
| **Master** | **The Small Sun** (Kindled Echo #5) — met four times on the Ember Keep climb (§5.4.5) |
| **Join** | Speak to The Small Sun at any of the four meeting points. **No requirement, no cost, no level.** The most accessible covenant in the game, deliberately |
| **Emblem** | A small gold sun worn at the collar |
| **Territory** | R05 Ember Keep (Sunlight Chapel in the Sanctuary is the meeting hall) |

**Rank ladder:**

| Rank | Requirement | Rewards |
|---|---|---|
| **0 — Companion** | Join | **Gold Sign Soapstone** · *Praise the Eclipse* gesture · +1 Estus charge while in co-op as a phantom |
| **1 — Sunbearer** | Earn **10 Sunlight Medals** (1 per co-op boss kill as a phantom; 3 if the host was below 50% HP when you joined) | **Sacred Oath** (Miracle, FTH 30) · *Sunlight Spear* if FTH 45 · Sunlight Shield (medium, 100% phys, +12% lightning absorb) |
| **2 — Radiant** | Earn **20 Medals** (30 cumulative) | **Soothing Sunlight** (Miracle, FTH 44) · **Sunlight Talisman +2** (Spell Buff 262) · *Sunblessed* gesture · +1 gold sign slot for hosts you've helped |
| **3 — The Small Sun's Escort** | Earn **30 Medals** (60 cumulative) **+ Ascetic A3 in R05** + The Small Sun alive | **Sunlight Spear** (Miracle, FTH 45) · **Sunlight Blade** (FTH 50) · *Sovereign of the Gold Quarter* title · +1 Estus charge permanently in co-op · the **Gold Eye Orb** (hostile gold sign, PvP only) |

**Unique spells:** *Sacred Oath* (rank 1) · *Soothing Sunlight* (rank 2) · *Sunlight Spear*, *Sunlight Blade* (rank 3). All are FTH-gated as well as rank-gated — a non-cleric can hold rank 3 and still not cast them, which is a deliberate "identity is not power" statement.

**Unique weapons:** **Sunlight Shield** (rank 1) · **Sunlight Straight Sword** (rank 2; STR 14/DEX 12, AR 264, Art: *Stance: Radiant Sweep* — emits a 5 m light burst that cures Hollow-Blight and deals 180 lightning) · **The Small Sun's Lantern** (rank 3; a torch-catalyst, Pyromancy + Miracle hybrid, Spell Buff 210, and it lights dark areas permanently while carried).

**Sin rule:** killing a co-op partner or a host while a Sunlight member = **Grievous Sin**; drops to rank 0 and the covenant refuses you for 3 in-game deaths. *The Small Sun will not speak to you again until you offer a Sunlight Medal at the chapel as penance.*

**Design intent.** The Sunlight covenant is the game's **on-ramp to multiplayer**. It has no join requirement, its rank 1 is achievable in 2 co-op sessions, and its reward (*Sacred Oath*) is the strongest party buff in the game. Every co-op player in *Convergence* is, statistically, a Sunlight member first.

---

### 8.5.2 COVENANT II — DARKWRAITH INVADERS

| Field | Spec |
|---|---|
| **Fiction** | Kaathe's mouth is the Deep Cistern under the Sanctuary, and the Darkwraiths are what crawls out of it. They do not serve the Dark. They serve **hunger** — the Want Beneath's appetite, which must be fed souls or it feeds on the world. A Darkwraith is a person who has volunteered to be the world's digestive system. |
| **Master** | **Kaathe's mouth** (the Ouroboros's second aspect, §1.4.2) — in the Deep Cistern, R02 Undercroft; advanced rites in R13 |
| **Join** | Speak to Kaathe in the Deep Cistern. **Requires ≥1 Dark Sigil.** Kaathe gives you the first one if you ask, which is the game's most consequential "yes." |
| **Emblem** | A black knot worn over the sternum, directly on the Sigil |
| **Territory** | R13 The Want Beneath; R04 Sunken Cathedral (early access) |

**Rank ladder:**

| Rank | Requirement | Rewards |
|---|---|---|
| **0 — Mouthfed** | Join (≥1 Sigil) | **Red Eye Orb** (infinite invasion) · *Darkwraith Set* (armor) · **Dark Hand Blade** (STR 10/DEX 12, AR 168 dark, 120% crit) |
| **1 — Red Hand** | Deliver **10 Souls of the Invaded** (1 per successful invasion; 2 if the host was embered with 2+ phantoms) | **Life Drain** (Hex) · **Dark Weapon** (Hex) · **Dark Clutch Ring** · *Maniacal Laugh* gesture |
| **2 — Wraith** | Deliver **20 Souls** (30 cumulative) | **Purple Eye Orb** (Purple Phantom invasion) · **Dark Storm** (Hex) · **Darkwraith Greatsword** · **Want Leech** (Hex) · +1 Want capacity |
| **3 — The Deep's Own** | Deliver **30 Souls** (60 cumulative) **+ Ascetic A3 in R13** + Greymouthe rank 3 | **Abyssal Greatsword** · **Consuming Dark** (Hex) · **Nihil's Whisper** (Hex) · **Vessel of Want** catalyst *(if Throne ending taken)* · *Kaathe's Blessing* title · **guaranteed invasion within 90 s in A4 regions** |

**Unique spells:** *Life Drain*, *Dark Weapon* (rank 1) · *Dark Storm*, *Want Leech* (rank 2) · *Consuming Dark*, *Nihil's Whisper* (rank 3). **The Darkwraith covenant is the Hex school's progression spine** — 6 of the 36 hexes are covenant-gated.

**Unique weapons:** **Dark Hand Blade** (rank 0) · **Darkwraith Greatsword** (rank 2; STR 24/DEX 18, AR 322 dark, Art: *Stance: Red Reach* — a 9 m lunging grab that pulls the target to you) · **Abyssal Greatsword** (rank 3; STR 32/DEX 22, AR 388 dark + 96 physical, Art: *Stance: The Deep Opens* — a 6 m AoE that applies Hollow-Blight 80 and drains 60 FP from all targets).

**Sin rule:** Darkwraiths **accrue sin by design** — invasion is sin. Sin is *spent* at Kaathe's mouth for rank progress. The covenant's entire loop is: commit sin → convert sin → rank up. **But:** killing an NPC (any of the 29) while a Darkwraith costs **double sin** and, if the NPC is a Kindled Echo, immediately drops you to rank 0 and locks rank 3 for the playthrough.

**Design intent.** The Darkwraith covenant is the game's **villain on-ramp**, and it must be *attractive*. Its rewards are the strongest single-target Hexes, the best invasion weapons, and a +1 Want capacity. It is also the covenant that pushes you toward the **Usurper of the Abyss** ending. We do not warn you. We make it good.

---

### 8.5.3 COVENANT III — BLUE SENTINELS

| Field | Spec |
|---|---|
| **Fiction** | The Bastion of the Blue Sentinels is a fortress whose defenders died defending a door **from the inside** (§5.4.9). The Sentinels are not gone. They are an *automatic response*: when a member of the Way of the Blue is invaded, a Sentinel is pulled out of wherever they are and dropped into the fight. They have been doing this for four hundred years and they have never once asked why the door was sealed. |
| **Master** | **Sir Aldwin of the Empty Shield** (Kindled Echo #2) — R03 Grave of Names, *Sentinel's Walk*; later R09 |
| **Join** | Speak to Sir Aldwin. **Either** defeat 3 invaders **or** give him the **Oathstone** (found in R09's Oathstone Alcove). Two paths, because a new player cannot be required to have been invaded. |
| **Emblem** | A blue shield-shaped pin, worn on the left shoulder |
| **Territory** | R09 Bastion of the Blue Sentinels |

**Rank ladder:**

| Rank | Requirement | Rewards |
|---|---|---|
| **0 — Sworn** | Join | **Blue Eye Orb** (auto-summon defense) · *Sentinel's Oath* gesture · Sentinel Shield (medium, 100% phys, +22% lightning) |
| **1 — Warden** | Defeat **10 invaders** as an auto-summoned Blue Phantom | **Darkmoon Blade** (Miracle, FTH 45) · **Sentinel Plate** set pieces · *Bountiful Light* |
| **2 — Sentinel** | Defeat **20 invaders** (30 cumulative) | **Sentinel Greatshield** (STR 36, 100% phys / 62% lightning, stability 92, Art: *Stance: Bulwark III*) · **Great Magic Barrier** (Miracle) · *Oathstone's Weight* ring (+20 poise while guarding) |
| **3 — The Empty Shield** | Defeat **30 invaders** (60 cumulative) **+ Ascetic A3 in R09** + Sir Aldwin alive | **Aurel's Sentinel Spear** (Spear, STR 24/DEX 24, AR 336, Art: *Stance: Phalanx Brace III*) · **Sentinel Plate** full set + 15 poise bonus · *Aurel's Judgment* title · **Oathstone** (a key item that opens R09's sealed door — see below) |

**The Oathstone loop.** The Oathstone is both a **join alternative** and a **rank 3 reward**, and it is the same physical item. A player who joins by giving Aldwin the Oathstone (found in R09) receives it back at rank 3, now *named*. A player who joins by killing 3 invaders must reach rank 3 to obtain it at all. **Either way, R09's sealed door cannot be opened without covenant rank 3.** This is the game's clearest example of a social system gating a world system.

**Unique spells:** *Darkmoon Blade* (rank 1 — the strongest weapon buff in the game) · *Bountiful Light* (rank 1) · *Great Magic Barrier* (rank 2).

**Unique weapons:** **Sentinel Shield** (rank 0) · **Sentinel Greatshield** (rank 2) · **Aurel's Sentinel Spear** (rank 3).

**Sin rule:** killing a Way of the Blue member or a fellow Sentinel = **Grievous Sin**, rank 0, locked for the playthrough. Blue Sentinels are also **automatically at war with Darkwraiths**: a Darkwraith who invades a Sentinel's world is marked, and the Sentinel gains +50% souls from killing them.

**Design intent.** The Blue Sentinel covenant is the **defensive counterpart** to Darkwraith, and it is the only covenant whose rank progression does not require initiating aggression. It is auto-summoned, which means **its members are always playing their own game until they are needed** — the covenant never interrupts you, it *arrives*. This is a materially different multiplayer fantasy from anything in the prior games.

---

### 8.5.4 COVENANT IV — DRAGON REMNANTS

| Field | Spec |
|---|---|
| **Fiction** | The dragon at R07 is one third of a dragon, and its cult is one third of a cult. **Vesh**, the covenant master, is the dragon's own scale, grown into a person, and does not know it. The Remnants do not worship the dragon. They are *trying to finish it.* Every Dragon Scale they offer is a piece of the animal returned to itself. |
| **Master** | **Vesh** — R07 Dragon Remnant Shrine, *Rib Nave* |
| **Join** | Offer **1 Dragon Scale** at the shrine. Dragon Scales drop from dragon-adjacent enemies (14 in NG before R07), so the covenant is joinable from ~SL30 |
| **Emblem** | A grey scale fused to the back of the hand (it does not come off) |
| **Territory** | R07 Dragon Remnant Shrine |

**Rank ladder:**

| Rank | Requirement | Rewards |
|---|---|---|
| **0 — Scaled** | Offer 1 Dragon Scale | **Dragonhead Stone** (1 free Dragon-form charge per bonfire) · *Dragon's Roar* gesture · **Drake Scale upgrade path unlocked** at Vhenn |
| **1 — Remnant** | Offer **10 Dragon Scales** | **Dragonscale Ring** (+25% fire absorb, +12 poise) · **Dragon Remnant Tail** weapon *(if part #12 severed)* · *Dragon Form* rank 1 |
| **2 — Winged** | Offer **20 Scales** (30 cumulative) | ***Sever*** gesture (**hidden ending foreshadow**, §1.7.4) · **Remnant Wing Shield** *(if parts #13/#14 severed)* · *Dragon Form* rank 2 · **White Dragon Breath** (Sorcery, INT 60) |
| **3 — The Whole Animal** | Offer **30 Scales** (60 cumulative) **+ Ascetic A3 in R07** + **Vesh told the truth** | **Dragon Form rank 3** · **Remnant Dragon armor set** (96 poise, §2.9.5) · **Dragon Greatclaw** (STR 34, AR 412, Art: *Stance: Old Fire*) · *Vesh's Name* title |

**DRAGON FORM — the covenant's signature mechanic.**

```
Dragon Form (transform ability, charges per bonfire = rank)
  Activation: 74f transformation animation, invulnerable from f20
  Duration:   45 s (rank 1) · 60 s (rank 2) · 90 s (rank 3)
  In form:
    · Your equipped weapons are replaced by DRAGON CLAW (R1) and DRAGON TAIL (R2)
    · AR = 280 + (30 × rank) + (STR scaling, unchanged)
    · Poise = 120 (Grade 3 true poise, always)
    · All damage becomes FIRE
    · Move speed ×1.15, roll becomes a 4-legged lunge (18f i-frames, any load tier)
    · You CANNOT cast spells, use items, guard, or parry
    · You are immune to Burn and Frost
    · You take ×1.5 damage from PIERCE (dragon hide)
  On expiry: 40f revert animation, vulnerable
```

> **Dragon Form is the game's only transformation mechanic and it is deliberately over-tuned at rank 3.** 90 seconds of Grade 3 poise, 370 fire AR, and 18f i-frames regardless of load is, on paper, the strongest state in the game. It is available once per bonfire to a covenant that requires 60 Dragon Scales and an A3 Ascetic. **We ship it because a game with no unreachable power has no horizon.**

**Unique spells:** *White Dragon Breath* (rank 2, Sorcery — the only covenant Sorcery in the game, which makes the Dragon Remnants the sole covenant that a pure sorcerer wants to join).

**Unique weapons:** **Dragon Greatclaw** (rank 3) · **Dragon Remnant Tail** (rank 1 + severance #12) · **Remnant Wing Shield** (rank 2 + severance #13/14).

**"Vesh told the truth"** (rank 3 condition): at any point after rank 2, the player may tell Vesh that they are the dragon's scale. Vesh has three responses depending on the player's Hollowing (0–19 / 20–59 / 60+). Only the middle one (20–59 Hollowing) counts as "told the truth," because only then does Vesh believe you. **This is the game's only covenant condition that depends on a narrative state, and it is the reason the hidden ending requires Hollowing management.**

**Sin rule:** killing Vesh = rank 0, covenant locked for the playthrough, and the Dragon Remnant Shrine's boss becomes permanently un-severable (part #15, the crown-horn, is Vesh). **This is the single most self-destructive action available to a player and it is entirely their choice.**

---

### 8.5.5 COVENANT V — FOREST GUARDIANS (Area Guardians)

| Field | Spec |
|---|---|
| **Fiction** | The Verdant Rot grows toward desire (§5.4.8). The Guardians are the people who let it grow *through* them — hunters who swore to one specific piece of ground that they would rather be a tree than leave. They are not protectors of nature. They are **property**. |
| **Master** | **The Rotmother's heart** — R08, *Heartbeat Clearing* |
| **Join** | Speak to the heart, then **swear to one region** from a list of 12 (all except R02 Sanctuary and R14 Convergence). The choice is permanent for the playthrough |
| **Emblem** | A living twig that grows 1 cm per rank (visible on the character model) |
| **Territory** | **Your sworn region only** |

**Rank ladder:**

| Rank | Requirement | Rewards |
|---|---|---|
| **0 — Rooted** | Swear | **Guardian's Acorn** (auto-summon defense *within your sworn region*) · *Listening* gesture (reveals enemy positions within 20 m for 6 s, once per 60 s) |
| **1 — Thorned** | Defeat **10 intruders** in your region | **Rotmother's Bloom** catalyst *(if part #16 severed)* · **Verdant Set** (armor, 18 poise, immune to Toxic spores) · *Thorned Bow* (Bow, DEX 22, AR 196, applies Poison 30) |
| **2 — Grown** | Defeat **20 intruders** (30 cumulative) | **Acid Surge** (Pyromancy) · **Rapport** (Pyromancy — charm an enemy) · **Guardian's Greatbow** (STR 34/DEX 20, AR 428, Art: *Stance: Siege Volley III*) · +20% damage within your region |
| **3 — The Leaning Wood** | Defeat **30 intruders** (60 cumulative) **+ Ascetic A3 in R08** | **Rotmother's Heart** (a living shield, STR 20, 100% phys / 70% poison, **regenerates 40 stability/s**) · **Verdant Crown** (head, +24 poise, immune to Toxic and Poison) · *Heartbeat* title · **+40% damage within your region, and the region's trees lean toward you when you enter** |

**The Sworn-Region Mechanic (the covenant's whole identity).**

```
A Forest Guardian is a REGIONAL boss. Within their sworn region:
  · They are auto-summoned to defend against ANY invader (red, purple, or hostile gold)
  · They may place HUNTER SNARES (5 per rest): 2 m floor traps that root an
    invader for 2.4 s. Invaders see them only within 3 m
  · They gain +20%/+40% damage at rank 2/3
  · Their bow range is +25% (the trees do not block their shots)
  · They cannot be invaded BY their own region's covenant members
Outside their sworn region: they are an ordinary player with a twig on their shoulder.
```

**Design intent.** The Forest Guardians are the game's answer to "what if a covenant were *territorial*?" They convert the DS1 Forest Hunters concept into a genuine asymmetric-defense role, and their sworn-region choice is the most consequential non-ending decision in the game — because **you can only defend one place, and you must choose which.** In QA, the most-sworn regions were R04 Sunken Cathedral (28%), R03 Grave of Names (19%), and R07 Dragon Shrine (14%). The least-sworn was R12 Ashen Coast (2%) — because it has no cover, and Guardians understood immediately that their covenant needs trees.

**Sin rule:** killing a Guardian in their own sworn region = **Grievous Sin** for the killer regardless of covenant. Guardians are the only covenant whose members are protected by *everyone's* sin rules — the world respects property.

---

### 8.5.6 Covenant Sin, Penalties & Absolution

| Act | Sin | Penalty |
|---|---|---|
| Killing any of the 29 NPCs | +1 Sin | NPCs refuse service at ≥3 Sin; **Ysolde will not reverse your hollowing** |
| Killing a Kindled Echo | +5 Sin | Covenant rank 0; the associated ending variant locks |
| Attacking a co-op phantom | +2 Sin | Ejected from the session; covenant refusal at ≥3 |
| Attacking your host | +3 Sin | Immediate ejection, no souls, +1 Sin per covenant |
| Leaving a covenant at rank 2+ | +1 Sin | Rank drops to 0 on rejoining |
| Betrayal (joining a new covenant while ranked) | +2 Sin | Old covenant locked for 3 deaths |
| Invading while a Sunlight/Sentinel/Guardian | Not permitted | The sign item does not function |
| **Absolution** | — | **Ysolde** clears all Sin for `1,000 × (SL + Sin×500)` souls. Hollowing is *not* cleared (that is the Purge Stone) |

---

## 8.6 — Async Multiplayer

| System | Spec |
|---|---|
| **Messages** | Templated (phrase + gesture + rating). Placed on the ground, rated by other players. **Top-rated messages persist for 30 days.** 8 message slots per player. The Sanctuary's **Messages Wall** (§5.3.3) renders all messages in your session as physical carvings |
| **Message ratings** | Rating a message restores **10% of the rater's HP** (DS1 rule, retained — it makes reading a mechanical act). Rating your own message does nothing |
| **Bloodstains** | Show the last 6 s of another player's death as a phantom replay, once per stain. Touch to view |
| **Phantom ghosts** | Live-ish: other players in your SL/Soul Memory band appear as grey ghosts for 3–8 s at a time, in your world, doing what they are doing. Density: 1 ghost per 90 s of play, up to 4 concurrent |
| **Devious messages** | A message may be **marked deceptive** by 5+ raters, after which it renders in red. The game does not censor them. It labels them |
| **The Messages Wall** | All messages currently in your session, physically carved into a 40 m wall in the Sanctuary. It grows across Acts (§5.3.4). At Act III it covers the entire wall and players must crane their neck to read the top. **This is the game's monument to its own community and it costs nothing to build** |

---

## 8.7 — Multiplayer Progression & Rewards

| Activity | Souls | Covenant token | Item | Notes |
|---|---|---|---|---|
| Co-op boss kill (white phantom) | 30% of boss souls | 1 Sunlight Medal (if Sunlight) | — | Returned to own world |
| Co-op boss kill (gold phantom) | 40% | 1 Medal + host gets +1 Estus | — | |
| Successful invasion (invader) | 100% of host's carried souls (capped at 60,000) | 1 Soul of the Invaded (Darkwraith) | 1 Ember of Ash (host side) | |
| Repelled invasion (host) | 15,000 × region SL factor | — | **1 Ember of Ash** | The best Ember source in the game |
| Blue Sentinel kill | 12,000 × factor | 1 Sentinel's Favor | — | |
| Forest Guardian kill (in-region) | 14,000 × factor | 1 Guardian's Thorn | — | |
| Host death to invasion | −100% souls | — | +1 Dark Sigil | |
| Invader death | −30% souls | — | — | |
| Rating a message | +10% HP | — | — | |

**Ember of Ash economy check:** 61 in NG (Vol. 7 §7.6.2). Sources: 22 boss drops, 14 world placements, 4 Vhenn crafts, **~21 from repelled invasions**. A player who never plays online has 40 Embers — enough for full infusion on two weapons and Art rank III on one. A player who repels 21 invasions has 61 — enough for everything. **The multiplayer ceiling is +52% on the upgrade economy, which is meaningful and not mandatory.** ✔

---

## 8.8 — Anti-Cheat, Fairness & Moderation

| Concern | Measure |
|---|---|
| **Stat hacking** | All attribute values are server-attested at session join. A guest whose stats exceed the SL-appropriate envelope (derived from Vol. 2's cap tables) is **silently excluded from matchmaking** and shown "UNSANCTIONED SESSION" |
| **Item injection** | Every unique item has an acquisition flag in the save (`item.source`). Items present without a valid source flag are quarantined: they function in offline play only and are stripped in sanctioned sessions |
| **Damage hacking** | Host validates every guest damage event against the guest's own AR + buffs. Events exceeding 1.35× the theoretical maximum (computed from Vol. 0 §A.1) are rejected and logged |
| **Speed hacking** | Position delta per tick is validated against the load-tier speed table (§3.1.1). 3 violations → session ejection |
| **Griefing (spawn-camping)** | The 3-minute invasion timer, the 60 m spawn distance, and the boss-fight protection rule (§8.4.2) together make most griefing structurally impossible |
| **Cheater pools** | Players with 3+ confirmed violations are moved to a **separate matchmaking pool** permanently (soft ban). They can play with each other. This is more effective than a hard ban because it is invisible and irreversible |
| **Report flow** | In-session report → automatic 60 s replay capture (the same system that powers bloodstains) → server-side review against the deterministic damage model. **Because all damage is deterministic (Vol. 0 §A.8), a replay can be re-simulated and verified exactly.** This is the single largest anti-cheat advantage of the no-randomness rule |
| **Moderation of messages** | Templated messages cannot contain free text. The only free-text surface is the player's *character name*, which passes a profanity filter and a report flow |
| **Privacy** | No telemetry leaves the client except: session metadata, violation logs, and opt-in balance telemetry (§8.9). No IP is exposed to other players (relay-mediated P2P) |

---

## 8.9 — Multiplayer Telemetry & Balance Gates

| Metric | Target | Action if breached |
|---|---|---|
| Median time-to-first-co-op | ≤ 90 min | Improve sign visibility; relax SL band |
| Median summon wait time | ≤ 45 s | Widen Soul Memory band |
| Invasion success rate (invader) | **38–48%** | Tune invader stats; adjust spawn distance |
| % of embered players invaded at least once | 55–75% | Tune pool density |
| Repeat-invader rate (same host, <15 min) | <1% | The 15-minute rule is working |
| Co-op participation rate (any co-op by end of Act II) | ≥ 45% | Sunlight on-ramp is working |
| Covenant distribution at SL125 | No covenant >38% of players | Rebalance rank rewards |
| **% of players who use the Black Separation Crystal** | **≤ 12%** | Above 12% means sessions are unpleasant — investigate |
| Session drop rate (guest leaves voluntarily) | ≤ 20% | Investigate latency or griefing |
| Cheater pool population | ≤ 0.4% of MAU | Above this, the detection threshold is too loose |

---

## 8.10 — Covenant × Ending Interaction Matrix

| Covenant at ending | Relink (Kindled) | Relink (Cold) | Throne (Reign) | Throne (Devour) | Usurper | **Severance** |
|---|---|---|---|---|---|---|
| **None** | ✔ | ✔ | ✔ | ✔ | ✖ (needs 5 Sigils, which come from Kaathe) | ✔ |
| **Warriors of Sunlight** | ✔ *The Small Sun joins the burn (Kindled variant requires it)* | ✔ | ✔ | ✔ | ✖ | ✔ (rank 3 needed for condition 4) |
| **Darkwraith** | ✖ *a Darkwraith cannot link the Flame — the cinder-heart refuses* | ✖ | ✔ | ✔ **best fit** | ✔ **best fit** | ✔ |
| **Blue Sentinels** | ✔ | ✔ | ✔ | ✖ *a Sentinel cannot devour a throne* | ✖ | ✔ (rank 3 needed) |
| **Dragon Remnants** | ✔ | ✔ | ✔ | ✔ | ✖ | ✔ **(rank 3 + Vesh told = required for condition 4)** |
| **Forest Guardians** | ✔ | ✔ | ✔ | ✖ | ✖ | ✔ |

> **The hidden ending requires rank 3 in at least two covenants.** The only *achievable* pairs are: **Sunlight + Dragon Remnants**, **Sunlight + Blue Sentinels**, **Blue Sentinels + Dragon Remnants**, **Sunlight + Forest Guardians**, **Blue Sentinels + Forest Guardians**, or **Forest Guardians + Dragon Remnants**. **Darkwraith is excluded from every viable pair**, because a Darkwraith cannot reach the "all 5 Echoes alive" condition (rank 3 Darkwraith requires Greymouthe rank 3, and the A3 Ascetic in R13 locks one Echo's questline per Vol. 7 §7.4.4). This is intentional: **the villain covenant cannot reach the redemption ending.** It can reach everything else.

---

*End of Volume 8. Continue to Volume 9: User Interface (UI) & HUD Design.*
