/* =====================================================================
   const.js — DATA. Every number here is lifted from the GDD.
   Vol 2 (stats) · Vol 3 (combat) · Vol 4 (magic) · Vol 7 (progression)
   ===================================================================== */
'use strict';
const FPS = 60, TS = 32;                 // frame rate, tile size

/* ---------- Vol 2 §2.1 · the nine attributes ---------- */
const ATTRS = [
  {k:'VIG', n:'Vigor',        d:'Hit points. The first and last stat.'},
  {k:'ATT', n:'Attunement',   d:'FP, spell slots, and cast speed.'},
  {k:'END', n:'Endurance',    d:'Stamina pool and recovery rate.'},
  {k:'STR', n:'Strength',     d:'Heavy weapon damage and requirement.'},
  {k:'DEX', n:'Dexterity',    d:'Fast weapon damage, cast speed, bow draw.'},
  {k:'VIT', n:'Vitality',     d:'Equip load capacity. The roll-tier stat.'},
  {k:'INT', n:'Intelligence', d:'Sorcery and dark scaling.'},
  {k:'FTH', n:'Faith',        d:'Miracle and pyromancy scaling.'},
  {k:'ADP', n:'Adaptability', d:'Roll i-frames and Estus drinking speed. (DS2)'},
];
const LVL_BASE = 90;                     // Level = Σ(9 attrs) − 90
const BASE_POISE = 0;                    // poise comes only from armour, greatshields and rings (Vol 3 §3.7.5)
const CAPS = [27, 40, 60, 80, 99];       // Vol 2 §2.4 — the unified ladder
const CAP_GAIN = [0.22, 0.12, 0.06, 0.025, 0];

/* ---------- Vol 2 §2.2 · the ten starting classes ---------- */
const CLASSES = [
  {id:'hollow', n:'Ashen Hollow',       s:[10,10,10,10,10,10,10,10,10], lvl:3,  gear:{rh:'Broken Straight Sword',lh:'Cracked Kite Shield',arm:'Tattered Rags',ring:null},
   gift:'Bare Hands', blurb:'No name, no lineage, no advantage. The designer\u2019s honest baseline.'},
  {id:'knight', n:'Ashen Knight',       s:[12,11,11,13,13,11, 9,10,10], lvl:6,  gear:{rh:'Longsword',lh:'Shield of Parry',arm:'Ashen Knight Set',ring:null},
   gift:'Ember', blurb:'Balanced, well-armoured, parry-capable. The reference for Build A.'},
  {id:'sells', n:'Drowned Sellsword',   s:[11,12,11,11,12,13, 8, 8,14], lvl:5,  gear:{rh:'Sellsword Twinblades',lh:'Sellsword Twinblades',arm:'Sellsword Set',ring:null},
   gift:'Charcoal Pine Resin', blurb:'Twinblades in both hands: Power Stance from the first minute.'},
  {id:'acol', n:'Sanctuary Acolyte',    s:[ 9,15,10, 9,10, 8,12,10,17], lvl:10, gear:{rh:'Cleric\u2019s Mace',lh:'Saint\u2019s Talisman',arm:'Acolyte Robes',ring:null},
   gift:'Healing Aid', blurb:'Miracles, fast roll, fragile. ADP 17 is the highest in the game.'},
  {id:'ember', n:'Ember Pyromancer',    s:[10,13,10,10,10, 9,12,12,14], lvl:8,  gear:{rh:'Pyromancy Flame',lh:'Pyromancy Flame',arm:'Pyromancer Wraps',ring:null},
   gift:'Firebomb', blurb:'Hybrid INT/FTH scaling on a flame that needs neither.'},
  {id:'hex', n:'Hexwife Initiate',      s:[ 8,15, 9, 9, 9,10,14,13,13], lvl:11, gear:{rh:'Witch\u2019s Locks',lh:'Witch\u2019s Locks',arm:'Hexwife Set',ring:null},
   gift:'Dark Orb', blurb:'The Pure Hexer (Build B) as she is meant to start.'},
  {id:'drag', n:'Remnant Dragonkin',    s:[14, 9,10,14,11, 9, 8, 8,17], lvl:6,  gear:{rh:'Drakekeeper Greatsword',lh:null,arm:'Drakeblood Set',ring:null},
   gift:'Dragon Head', blurb:'STR 14, ADP 17, and a greatsword you cannot yet swing properly.'},
  {id:'arti', n:'Iron Eclipse Artificer',s:[11,13,10,12,11,11,11,11,10],lvl:7,  gear:{rh:'Artificer\u2019s Hammer',lh:'Iron Eclipse Shield',arm:'Artificer Set',ring:null},
   gift:'Titanite Shard ×3', blurb:'Starts with upgrade material. Levels are cheaper than souls here.'},
  {id:'grave',n:'Grave Warden',         s:[13,10,11,12,14,10, 9, 9,12], lvl:5,  gear:{rh:'Warden\u2019s Twinblades',lh:'Warden\u2019s Twinblades',arm:'Warden Set',ring:null},
   gift:'Alluring Skull', blurb:'DEX 14 twinblades and the poise greaves Build C wants.'},
  {id:'pilg', n:'Ashen Pilgrim',         s:[ 7,12,12, 8, 9,11,11,13,17], lvl:12, gear:{rh:'Pilgrim\u2019s Staff',lh:null,arm:'Pilgrim Rags',ring:null},
   gift:'Estus Shard', blurb:'Highest starting level, weakest body, four spell slots and a flask.'},
];

/* ---------- Vol 2 §2.9 · the three reference builds (targets) ---------- */
const REF_BUILDS = [
  {n:'A · Quality Power-Stance Knight', s:{VIG:34,ATT:22,END:24,STR:40,DEX:40,VIT:20,INT:9,FTH:10,ADP:16},
   hp:1214, fp:154, sta:112, load:'39.4% MID', poise:'34 (G1)', dps:512},
  {n:'B · Pure Hexer', s:{VIG:22,ATT:30,END:11,STR:10,DEX:12,VIT:12,INT:60,FTH:50,ADP:10},
   hp:852, fp:210, sta:86, load:'25.0% FAST', poise:'19 (G0)', dps:119},
  {n:'C · Heavy Poise Tank', s:{VIG:44,ATT:10,END:18,STR:50,DEX:12,VIT:53,INT:8,FTH:8,ADP:12},
   hp:1432, fp:70, sta:100, load:'89.3% FAT', poise:'106 (G3)', dps:318},
];

/* ---------- Vol 3 §3.2 · movement & roll tiers ---------- */
const WALK = 118, RUN = 196, TURN = 12;                 // px/s
const LOAD_TIERS = [
  {n:'FAST',         max:30,  iframe:16, total:34, cost:26, dist:104, stam:14},
  {n:'MID',          max:70,  iframe:13, total:38, cost:30, dist: 92, stam:16},
  {n:'FAT',          max:100, iframe: 9, total:48, cost:40, dist: 72, stam:20},
  {n:'OVERBURDENED', max:999, iframe: 0, total:22, cost:40, dist: 34, stam:26},
];
const STA_REGEN_BASE = 46, STA_REGEN_PER_END = 0.4;      // Vol 3 §3.2.4
const GUARD_REGEN_MULT = 0.35, CAST_REGEN_MULT = 0;
const STA_DELAY = 0.55, GUARD_DELAY = 0.75;
const ADP_DELAY = {min:1.30, max:0.90, at:16};           // seconds of post-roll lockout shrink
const PARRY = {startup:6, active:8, total:36, window:[7,14], sta:12, riposte:3.20};
const BACKSTEP = {iframe:12, total:30, cost:22, dist:78};

/* ---------- Vol 3 §3.7 · true poise ---------- */
const POISE_GRADES = [ {g:0,min:0},{g:1,min:20},{g:2,min:40},{g:3,min:60},{g:4,min:90} ];
const poiseGrade = p => p>=90?4 : p>=60?3 : p>=40?2 : p>=20?1 : 0;
const poiseThreshold = p => 20 + p*2;                    // Vol 3 §3.7.4
const poiseMitigation = p => Math.min(0.70, p*0.005);    // cap 70%, needs temp poise 140+

/* ---------- Vol 3 §3.6 · Power Stance & Posture Break ---------- */
const PS_REQ_MULT = 1.5;                                 // 1.5× max(STR,DEX) requirement
const PS_POSTURE_MULT = 1.6;                             // ×1.6 while the stance is open
const PS_FINISHER_MULT = 2.4;                            // ×2.4 on the finisher (Vol 3 §3.6.3)
const NON_STANCE_POSTURE = 0.40;
const POSTURE_DECAY = 14, POSTURE_DECAY_DELAY = 3, POSTURE_STAGGER = 2.4, POSTURE_IMMUNE = 8;
const MAX_POISE = 116, TEMP_POISE_BULWARK = 60;          // Vol 3 §3.7.2

/* ---------- Vol 2 §2.6 · infusions ---------- */
const INFUSIONS = [
  {id:'raw',     n:'Raw',      dmg:1.00, sc:{},                 note:'No scaling. Flat damage for low-stat builds.'},
  {id:'refined', n:'Refined',  dmg:0.95, sc:{STR:0.7,DEX:0.7},  note:'Splits scaling evenly. The Quality path.'},
  {id:'heavy',   n:'Heavy',    dmg:0.95, sc:{STR:1.45},         note:'All weight into Strength.'},
  {id:'sharp',   n:'Sharp',    dmg:0.95, sc:{DEX:1.45},         note:'All weight into Dexterity.'},
  {id:'fire',    n:'Fire',     dmg:1.00, sc:{}, fire:0.55,      note:'+fire damage, −10% physical, no scaling.'},
  {id:'dark',    n:'Dark',     dmg:1.00, sc:{}, dark:0.55,      note:'+dark damage. Feeds the WANT meter.'},
  {id:'ashen',   n:'Ashen',    dmg:0.85, sc:{}, art:1, fp:0.5,  note:'No scaling, +1 Weapon Art rank, −50% art FP.'},
  {id:'blessed', n:'Blessed',  dmg:0.95, sc:{FTH:1.0}, regen:0.7, note:'Slow HP regen (0.7/s) plus Faith scaling.'},
];
const UPG_DMG = i => 1 + 0.10*i;                         // +10 → ×2.0 (Vol 2 §2.6.3)
const UPG_COST = i => 200 + i*260;                       // souls; titanite handled narratively

/* ---------- Vol 2 §2.5 · weapons ----------
   fr = [startup, active, recovery] in frames @60fps
   art = weapon art  {n, fp, fr, dmg, range, spread, posture, note}   */
const WEAPONS = {
'Broken Straight Sword':{c:'straight',dmg:62, sc:{STR:'D',DEX:'E'}, w:2.0, req:{STR:6,DEX:6},  fr:[9,4,17],  poise:10, art:{n:'Stance',fp:8,dmg:1.15,posture:26}},
'Longsword':            {c:'straight',dmg:92, sc:{STR:'C',DEX:'D'}, w:3.0, req:{STR:10,DEX:10},fr:[11,4,19], poise:16, art:{n:'Stance',fp:10,dmg:1.25,posture:30}},
'Sellsword Twinblades': {c:'twinblade',dmg:74,sc:{DEX:'C',STR:'E'}, w:2.5, req:{STR:8,DEX:12}, fr:[8,3,15],  poise:12, dual:true, art:{n:'Stance',fp:12,dmg:1.20,posture:34}},
'Warden\u2019s Twinblades':{c:'twinblade',dmg:86,sc:{DEX:'B',STR:'E'},w:3.0, req:{STR:10,DEX:14},fr:[8,3,15],poise:14, dual:true, art:{n:'Stance',fp:12,dmg:1.25,posture:38}},
'Uchigatana':           {c:'katana',   dmg:96, sc:{DEX:'C',STR:'E'}, w:3.0, req:{STR:11,DEX:14},fr:[10,4,18], poise:16, bleed:22, art:{n:'Iai',fp:14,dmg:1.55,posture:40}},
'Cleric\u2019s Mace':   {c:'strike',   dmg:88, sc:{STR:'C',FTH:'E'}, w:3.0, req:{STR:10,FTH:8},fr:[13,4,21], poise:20, art:{n:'Blessed Stroke',fp:9,dmg:1.20,posture:34}},
'Artificer\u2019s Hammer':{c:'strike', dmg:104,sc:{STR:'C',INT:'D'}, w:4.0, req:{STR:12,INT:10},fr:[15,4,23],poise:24, art:{n:'Forge Strike',fp:11,dmg:1.30,posture:44}},
'Drakekeeper Greatsword':{c:'great',   dmg:138,sc:{STR:'B',DEX:'E'}, w:7.0, req:{STR:20,DEX:10},fr:[18,5,28], poise:34, art:{n:'Stomp',fp:16,dmg:1.45,posture:56}},
'Ashen Greatsword':     {c:'great',    dmg:146,sc:{STR:'B',DEX:'E'}, w:7.5, req:{STR:22,DEX:10},fr:[19,5,29], poise:36, art:{n:'Stomp',fp:16,dmg:1.50,posture:58}},
'Herald\u2019s Ash Pike':{c:'pike',    dmg:118,sc:{STR:'C',DEX:'D'}, w:5.5, req:{STR:14,DEX:14},fr:[14,4,24], poise:26, pierce:true, art:{n:'Pierce the Ash',fp:14,dmg:1.60,posture:48}},
'Shortbow':             {c:'bow',      dmg:76, sc:{DEX:'C'},         w:2.0, req:{STR:7,DEX:12}, fr:[10,0,20], poise:6, ranged:true, art:{n:'Volley',fp:15,dmg:0.9,posture:10}},
'Longbow':              {c:'bow',      dmg:104,sc:{DEX:'B'},         w:3.5, req:{STR:12,DEX:16},fr:[14,0,24], poise:8, ranged:true, art:{n:'Piercing Shot',fp:18,dmg:1.7,posture:22}},
'Pyromancy Flame':      {c:'catalyst', dmg:0,  sc:{}, w:1.0, req:{}, fr:[10,0,10], poise:0, cat:{school:'pyro',mult:1.00,speed:1.00}},
'Witch\u2019s Locks':   {c:'catalyst', dmg:0,  sc:{}, w:1.0, req:{}, fr:[10,0,10], poise:0, cat:{school:'hex', mult:1.05,speed:1.05}},
'Izalith Staff':        {c:'catalyst', dmg:0,  sc:{}, w:1.5, req:{INT:16},fr:[10,0,10],poise:0, cat:{school:'sorc',mult:1.15,speed:0.92}},
'Saint\u2019s Talisman':{c:'catalyst', dmg:0,  sc:{}, w:1.0, req:{FTH:14},fr:[10,0,10],poise:0, cat:{school:'mira',mult:1.05,speed:1.00}},
'Sunlight Talisman':    {c:'catalyst', dmg:0,  sc:{}, w:1.5, req:{FTH:24},fr:[10,0,10],poise:0, cat:{school:'mira',mult:1.30,speed:0.90}},
};
const GRADE = {S:1.00,A:0.86,B:0.72,C:0.58,D:0.44,E:0.30,'—':0};

/* ---------- Vol 2 §2.6 · shields ---------- */
const SHIELDS = {
'Cracked Kite Shield':   {w:2.0, def:34, parry:true,  sta:100, poise:0},
'Shield of Parry':       {w:2.5, def:42, parry:true,  sta:100, poise:0},
'Iron Eclipse Shield':   {w:4.0, def:58, parry:true,  sta:100, poise:4},
'Silver Eagle Kite':     {w:3.5, def:52, parry:true,  sta:100, poise:3},
'Warden\u2019s Greaves Shield':{w:3.0,def:48,parry:true,sta:100,poise:3},
'Havel\u2019s Greatshield':{w:14.0,def:88,parry:false, sta:70, poise:17},
'Drakeblood Greatshield':{w:11.0,def:82,parry:false, sta:75, poise:14},
'Warden\u2019s Greatshield':{w: 9.0,def:74,parry:false, sta:80, poise:11},
};

/* ---------- Vol 2 §2.6 / Vol 3 §3.7.5 · armour sets ----------
   poise is split h/c/a/l; mixed sets cost −4 total (Vol 3 §3.7.6) */
const ARMOR = {
'Tattered Rags':      {set:'Rags',      w: 3.0, def: 8,  poise:[0,1,1,0],  res:{fire:0,dark:0}},
'Pilgrim Rags':       {set:'Pilgrim',   w: 3.5, def:10,  poise:[0,1,1,1],  res:{dark:4}},
'Acolyte Robes':      {set:'Acolyte',   w: 4.5, def:12,  poise:[0,2,2,1],  res:{lightning:8}},
'Pyromancer Wraps':   {set:'Pyromancer',w: 4.0, def:11,  poise:[0,2,1,1],  res:{fire:14}},
'Hexwife Set':        {set:'Hexwife',   w: 7.0, def:16,  poise:[4,5,7,3],  res:{dark:18}},   // 19 = Build B
'Sellsword Set':      {set:'Sellsword', w: 8.0, def:22,  poise:[2,4,4,2],  res:{bleed:10}},
'Warden Set':         {set:'Warden',    w:11.0, def:30,  poise:[4,6,5,3],  res:{poison:12}},   // 18
'Artificer Set':      {set:'Artificer', w:13.0, def:34,  poise:[3,7,7,3],  res:{fire:10,lightning:6}},
'Ashen Knight Set':   {set:'Ashen Knight',w:17.0,def:44, poise:[6,9,12,7], res:{fire:12,dark:8}}, // 34 = Build A (Vol 3 §3.7.5)
'Drakeblood Set':     {set:'Drakeblood',w:21.0, def:52,  poise:[10,14,16,10],res:{fire:22}},  // 50
'Warden\u2019s Greaves':  {set:'Warden',    w: 4.5, def:13,  poise:[0,0,0,4],  res:{poison:4},  piece:'legs'},
'Remnant Dragon Set': {set:'Remnant Dragon',w:78.5,def:96,poise:[26,26,24,20],res:{fire:34,dark:22}},  // 96 = Vol 3 §3.7.2
};

/* ---------- Vol 2 §2.7 · rings (Ring Rule: max 4) ---------- */
const RINGS = {
'Ring of Blades':        {poise:3,   n:'+3 poise (the Build C off-set piece)'},
'Havel\u2019s Ring':      {load:0.15, n:'+15% equip load capacity'},
'Ring of Favor':         {hp:0.08, sta:0.15, end:0.12, n:'+8% HP, +15% stamina, +12% END regen'},
'Chloranthy Ring':       {regen:1.0, n:'Stamina recovery +100% of base'},
'Ring of the Evil Eye':  {fp:0.12,   n:'+12% FP'},
'Covetous Silver Serpent':{souls:0.15,n:'+15% souls from kills'},
'Covetous Gold Serpent': {disc:1.4,  n:'+40% item discovery'},
'Dark Stone Ring':       {darkRes:20,n:'+20 dark defence'},
'Flame Stone Ring':      {fireRes:20,n:'+20 fire defence'},
'Ashen Ring':            {estus:1,   n:'+1 Estus charge'},
'Ring of Steel Protection':{physRes:0.12,n:'−12% physical damage taken'},
'Bellowing Dragoncrest': {spellDmg:0.15,n:'+15% spell damage'},
};

/* ---------- Vol 4 · spells (12 of the 130, with the real casting formula) ---------- */
const SPELLS = {
'Soul Arrow':      {sch:'sorc',fp:12,want:0,req:{INT:12},fr:34,dmg:170,t:'phys',rng:520,kind:'bolt',spd:640,note:'The first sorcery. Fast, cheap, reliable.'},
'Great Soul Arrow':{sch:'sorc',fp:20,want:0,req:{INT:22},fr:38,dmg:290,t:'phys',rng:560,kind:'bolt',spd:680,note:'Soul Arrow at the top of its scaling curve.'},
'Homing Soulmass': {sch:'sorc',fp:26,want:0,req:{INT:26},fr:46,dmg:95,t:'phys',rng:460,kind:'homing',count:5,spd:420,note:'Five masses that seek. Punishes rolling on a timer.'},
'Crystal Soul Spear':{sch:'sorc',fp:44,want:0,req:{INT:44},fr:56,dmg:640,t:'phys',rng:620,kind:'bolt',spd:760,note:'The sorcery capstone. 640 base at 60 INT.'},
'Heal':            {sch:'mira',fp:18,want:0,req:{FTH:14},fr:40,heal:340,kind:'self',note:'340 HP over the cast. The Miracle that keeps Faith alive.'},
'Med Heal':        {sch:'mira',fp:34,want:0,req:{FTH:26},fr:56,heal:640,kind:'self',note:'Slower, larger, and it heals allies in co-op.'},
'Lightning Spear': {sch:'mira',fp:30,want:0,req:{FTH:30},fr:44,dmg:380,t:'lightning',rng:560,kind:'bolt',spd:700,note:'High posture damage. Opens Sunlight guards.'},
'Sunlight Spear':  {sch:'mira',fp:52,want:0,req:{FTH:40},fr:62,dmg:720,t:'lightning',rng:600,kind:'bolt',spd:740,posture:70,note:'The covenant reward. 70 posture damage.'},
'Fireball':        {sch:'pyro',fp:14,want:0,req:{},fr:30,dmg:230,t:'fire',rng:460,kind:'bolt',spd:520,burn:26,note:'Scales on max(INT,FTH). No requirement at all.'},
'Great Chaos Fireball':{sch:'pyro',fp:46,want:0,req:{},fr:58,dmg:640,t:'fire',rng:520,kind:'blast',spd:440,burn:70,radius:70,note:'Detonates on impact. The pyromancy capstone.'},
'Fire Surge':      {sch:'pyro',fp:8, want:0,req:{},fr:6, dmg:95, t:'fire',rng:300,kind:'beam',hold:true,note:'Hold to pour flame. 8 FP per tick — the DPS-per-FP king.'},
'Dark Orb':        {sch:'hex', fp:20,want:1,req:{INT:14,FTH:14},fr:38,dmg:280,t:'dark',rng:480,kind:'bolt',spd:560,note:'The first Hex. Each cast feeds WANT.'},
'Dark Bead':       {sch:'hex', fp:56,want:3,req:{INT:40,FTH:40},fr:64,dmg:900,t:'dark',rng:420,kind:'blast',spd:420,radius:60,note:'The strongest spell in the game. Three WANT.'},
'Lifehunt Scythe': {sch:'hex', fp:66,want:2,req:{INT:30,FTH:45},fr:52,dmg:520,t:'dark',rng:150,kind:'arc',drain:0.30,cost:0.08,
                     note:'Heals the caster for 30% of damage dealt; costs 8% max HP to cast. The only Hex with a Faith requirement.'},
};
const WANT_MAX = 7, WANT_REGEN_OUT = 9, WANT_REGEN_IN = 24;   // Vol 4 §4.5 (seconds per point)
const RES_LADDER = [ {r:0,bonus:0},{r:1,bonus:0.08},{r:2,bonus:0.18},{r:3,bonus:0.32} ];
const CAST_FRAMES = (base,catSpd,adpMod,dexMod,movMod,loadMod)=>
  Math.round(base*catSpd*adpMod*dexMod*movMod*loadMod);

/* ---------- Vol 7 §7.1 · healing ---------- */
const ESTUS_HEAL = i => 300 + i*59;                 // +0 300 → +10 890
const ESTUS_MAX = 15, ESTUS_COOP = 16;
const ESTUS_FRAMES = adp => Math.round(60 * (1.25 - 0.021*Math.min(adp,20)));  // ADP shortens the drink
const GEM_HEAL = 360, GEM_TIME = 13.5, GEM_PENALTY = 0.06, GEM_FLOOR = 0.40, GEM_CARRY = 12;
const SOUL_LEVEL_COST = lvl => Math.round(100*Math.pow(lvl,1.32));

/* ---------- Vol 7 §7.3 · Bonfire Ascetics ---------- */
const NG_PLUS_MAX = 7;                   // Vol 7 §7.3.5 — the journey ends at NG+7
const ASCETIC = [
  {a:0,hp:1.00,dmg:1.00,souls:1.00,n:'None'},
  {a:1,hp:1.25,dmg:1.12,souls:1.40,n:'A1'},
  {a:2,hp:1.56,dmg:1.25,souls:1.96,n:'A2'},
  {a:3,hp:1.95,dmg:1.40,souls:2.74,n:'A3'},
  {a:4,hp:2.44,dmg:1.57,souls:3.84,n:'A4'},
];
const ECHOES = ['Ember Watcher','Nameless Pilgrim','The Small Sun','Queen of the Forty-One',
  'Admiral Vesh','The Rotmother','Iron Eclipse','Sentinel Kaedwyn','The Silent King',
  'Frampt\u2019s Mouth','The Ninth Landing','Herald\u2019s Choir','Warden of Names','The Upside Shore'];

/* ---------- Vol 8 §8.4 · the five covenants ---------- */
const COVENANTS = {
'None':{n:'None', perk:'No oath. Free to wander.', col:'#8d8271'},
'Warriors of Sunlight':{n:'Warriors of Sunlight', rank:0,
  perk:'+20% stamina regen, +8% Lightning Spear damage. Co-op phantoms heal you on kill.',
  req:'Defeat a boss as a summoned phantom, or FTH 25.', col:'#e8cf94', bonus:{staRegen:0.20,spellDmg:0.08}},
'Darkwraith':{n:'Darkwraith', rank:0,
  perk:'Invasions never end. WANT regen doubles while invading; +1 WANT max at rank 2.',
  req:'Offer a Cracked Red Eye Orb to the Darkwraith altar.', col:'#9a6fd0', bonus:{wantRegen:2.0}},
'Blue Sentinels':{n:'Blue Sentinels', rank:0,
  perk:'Auto-summoned to defend Embered players in thy region. +12% guard stability.',
  req:'Show the Sentinel Badge at the Bastion.', col:'#5f9ad6', bonus:{guard:0.12}},
'Dragon Remnants':{n:'Dragon Remnants', rank:0,
  perk:'+30% fire resistance, dragonscale armour weighs 10% less, never hollows.',
  req:'Take the Dragon Head from the Shrine corpse.', col:'#e2703a', bonus:{fireRes:30,load:0.10}},
'Forest Guardians':{n:'Forest Guardians', rank:0,
  perk:'Ambush invaders in the Verdant Rot. +25% damage from stealth (Hidden Body).',
  req:'Touch the Moved Tree without being seen.', col:'#6fae63', bonus:{stealth:0.25}},
};

/* ---------- Vol 3 §3.9 · severance ---------- */
const SEVERANCE = {parts:31, bosses:22};

/* ---------- Vol 1 · endings ---------- */
const ENDINGS = [
  {id:'relink', n:'Relinking the Flame', kick:'Ending I of VI',
   req:'FTH 30 or Warriors of Sunlight rank 2',
   body:['Thou givest thy name to the fire, and the fire takes it gladly.',
     'The First Flame swells — not with thy soul, but with the memory of one who offered it without asking why. The kiln fills with a light that has no colour, because it has consumed every colour there was.',
     'Somewhere below, Want stirs in its sleep and does not wake. It has learned patience from thee.',
     'The Age of Fire is extended. It is not saved. Nobody has ever saved it; they have only ever delayed it, one Hollow at a time, and thou art the most recent delay.'],
   col:'#e8cf94'},
  {id:'throne', n:'Throne of Want', kick:'Ending II of VI',
   req:'WANT ≥ 4 at the moment of choice',
   body:['Thou sittest upon the throne that was always empty, and the emptiness recognises thee.',
     'Want is not hunger. Hunger ends. Want is the shape the dark makes when it has learned to want a shape — and thou hast fed it every Hex, every Orb, every Bead until it wore thy face.',
     'The Flame gutters. It is not extinguished; it is simply no longer the most interesting thing in the room.',
     'Thou art the Lord of Want now. Thy kingdom is every unlit bonfire, every hollow who still reaches, every soul spent on a level that did not help. There is a great deal of it. There will always be a great deal of it.'],
   col:'#9a6fd0'},
  {id:'usurper', n:'Usurper of the Abyss', kick:'Ending VI of VI — hidden',
   req:'Five Dark Sigils, rank 2+ in two covenants, and all fourteen Kindled Echoes alive',
   body:['Thou takest the Flame — not to link it, not to throne it, but to carry it out of the kiln like a coal in a closed fist.',
     'The Abyss does not swallow thee. It steps aside. It has been waiting eight hundred years for somebody to arrive who wanted nothing from it, and thou art that Hollow, and thy wanting-nothing is the loudest thing it has ever heard.',
     'Fire and Dark walk out of Lothranor together, in thy hands, and the world behind thee goes grey and free.',
     'No Age begins. No Age ends. For the first time since the Everlasting Dragons drew breath, the world is merely old — and mortal — and thine.'],
   col:'#c8453f'},
];

/* ---------- Vol 6 · boss grammar (§6.0) ---------- */
const BOSS_RULES = [
  'No move may be unreactable: every attack telegraphs for ≥ 12 frames.',
  'Input reading is a mechanic, not a cheat — reads fire a DELAYED response, never a guaranteed punish.',
  'Healing is punished by a read, not by a timer.',
  'One arena transformation, tied to the phase gate.',
  'One severable part per boss, with an exclusive reward.',
  'Phase gates are HP thresholds; the transition is invulnerable and moves the fight.',
];

/* ---------- Vol 5 · regions ---------- */
const REGIONS = [
  {id:'R01',n:'Ashen Barrens',       sl:'12–28', age:'Souls',  cov:'—',                     bonfires:4},
  {id:'R02',n:'Eclipse Sanctuary',   sl:'1–99',  age:'Neutral',cov:'all',                    bonfires:4},
  {id:'R05',n:'Ember Keep',          sl:'44–62', age:'Fire/Ash',cov:'Warriors of Sunlight',  bonfires:8},
  {id:'R04',n:'Sunken Cathedral',    sl:'28–48', age:'Want',   cov:'Darkwraith',             bonfires:8},
];

/* ---------- Vol 6 · the three bosses, with their real move lists ---------- */
const BOSSES = {
  vharos:{n:'Vharos, the Ashen Herald', region:'R04 Sunken Cathedral', sl:'40–55', hp:3800,
    grade:4, poise:96, posture:240, souls:24000, part:{n:'Herald\u2019s Tail', dmgType:'SLASH', hp:420,
      reward:'Herald\u2019s Ash Pike + Vharos Soul'},
    music:'§6.1.6 — 62 BPM, D minor. Low strings and a single off-stage voice that stops at the phase gate.',
    phases:[{at:1.0,n:'I — The Herald Announces'},{at:0.55,n:'II — The Ash Answers'}]},
  karrag:{n:'Karrag, the Ember-Forged', region:'R05 Ember Keep', sl:'50–65', hp:3200,
    grade:5, poise:120, posture:300, souls:19000, part:{n:'Forge Crown', dmgType:'STRIKE', hp:380,
      reward:'Ember-Forged Crown + Karrag Soul'},
    music:'§6.2.6 — 96 BPM, anvil ostinato in 7/8. The percussion is diegetic: he is still working.',
    phases:[{at:1.0,n:'I — The Sovereign\u2019s Anvil'},{at:0.5,n:'II — Molten'}]},
  sovereign:{n:'The Hollow Sovereign', region:'R01 Ashen Barrens', sl:'18–26', hp:1400,
    grade:3, poise:60, posture:150, souls:6000, part:null,
    music:'§6.0.4 — the tutorial boss. 54 BPM, solo cello, no percussion until phase II.',
    phases:[{at:1.0,n:'I — The Empty Throne'},{at:0.5,n:'II — What Wears the Crown'}]},
};

/* ---------- Vol 3 §3.10 · enemy archetypes ---------- */
const ENEMY_TYPES = {
  wretch:  {n:'Ashen Wretch',    hp:60,   dmg:[26,34],  poise:0,  posture:20,  souls:55,   spd:118, r:10, grade:0, aggro:230, col:'#6d6357',
            moves:[{n:'Lunge',w:60,fr:[16,4,26],dmg:1.0,pd:12,rng:34},{n:'Claw Flurry',w:40,fr:[12,8,22],dmg:0.55,pd:6,rng:30,hits:3}]},
  hollow:  {n:'Hollow Soldier',  hp:110,  dmg:[38,48],  poise:6,  posture:34,  souls:120,  spd:104, r:12, grade:1, aggro:260, col:'#7b6a52',
            moves:[{n:'Slash',w:50,fr:[18,4,26],dmg:1.0,pd:18,rng:42},{n:'Overhead',w:30,fr:[26,5,34],dmg:1.5,pd:34,rng:44},{n:'Shield Bash',w:20,fr:[14,4,24],dmg:0.6,pd:26,rng:34,guard:true}]},
  hound:   {n:'Barrow Hound',    hp:80,   dmg:[30,38],  poise:2,  posture:26,  souls:90,   spd:196, r:11, grade:1, aggro:340, col:'#5d5347',
            moves:[{n:'Pounce',w:55,fr:[12,6,20],dmg:1.0,pd:16,rng:56,dash:true},{n:'Bite',w:45,fr:[10,4,16],dmg:0.8,pd:10,rng:30}]},
  archer:  {n:'Cathedral Archer',hp:95,   dmg:[46,58],  poise:4,  posture:30,  souls:150,  spd:96,  r:12, grade:1, aggro:460, col:'#6a5f4e',
            moves:[{n:'Arrow',w:70,fr:[22,0,26],dmg:1.0,pd:14,rng:420,proj:{spd:420,t:'phys'}},{n:'Retreat Shot',w:30,fr:[18,0,22],dmg:0.8,pd:12,rng:380,proj:{spd:440,t:'phys'},flee:true}]},
  knight:  {n:'Ashen Knight',    hp:260,  dmg:[62,78],  poise:30, posture:70,  souls:380,  spd:88,  r:14, grade:2, aggro:300, col:'#8a8272',
            moves:[{n:'Slash',w:40,fr:[20,5,28],dmg:1.0,pd:30,rng:50},{n:'Thrust',w:30,fr:[22,4,30],dmg:1.15,pd:36,rng:58},{n:'Greatshield Slam',w:30,fr:[30,6,40],dmg:1.5,pd:60,rng:46,guard:true}]},
  hollowk: {n:'Hollow Knight',   hp:240,  dmg:[58,72],  poise:26, posture:64,  souls:340,  spd:92,  r:14, grade:2, aggro:300, col:'#7f7a6a',
            moves:[{n:'Slash',w:45,fr:[19,5,27],dmg:1.0,pd:28,rng:48},{n:'Overhead',w:30,fr:[28,5,36],dmg:1.45,pd:52,rng:50},{n:'Riposte Stab',w:25,fr:[16,4,26],dmg:1.2,pd:34,rng:54,counter:true}]},
  pyro:    {n:'Ember Acolyte',   hp:150,  dmg:[68,84],  poise:8,  posture:40,  souls:280,  spd:92,  r:12, grade:1, aggro:420, col:'#a4632f',
            moves:[{n:'Fireball',w:55,fr:[26,0,30],dmg:1.0,pd:18,rng:400,proj:{spd:340,t:'fire',burn:20}},{n:'Fire Surge',w:30,fr:[8,0,10],dmg:0.45,pd:8,rng:260,proj:{spd:520,t:'fire'}},{n:'Retreat',w:15,fr:[10,0,20],dmg:0,pd:0,rng:0,flee:true}]},
  sentinel:{n:'Blue Sentinel',   hp:300,  dmg:[70,86],  poise:34, posture:80,  souls:520,  spd:100, r:14, grade:2, aggro:320, col:'#4f7fae',
            moves:[{n:'Judicial Slash',w:45,fr:[20,5,28],dmg:1.0,pd:34,rng:52},{n:'Sentinel\u2019s Riposte',w:25,fr:[14,4,26],dmg:1.3,pd:44,rng:56,counter:true},{n:'Shield of the Oath',w:30,fr:[24,6,34],dmg:0.8,pd:56,rng:44,guard:true}]},
  rotbeast:{n:'Verdant Rotbeast',hp:420,  dmg:[80,96],  poise:40, posture:96,  souls:700,  spd:78,  r:17, grade:3, aggro:280, col:'#4c6b3a',
            moves:[{n:'Bloom Swipe',w:45,fr:[24,6,34],dmg:1.0,pd:44,rng:58,poison:true},{n:'Spore Burst',w:30,fr:[28,8,38],dmg:0.8,pd:30,rng:110,aoe:true,poison:true},{n:'Root Grab',w:25,fr:[22,6,30],dmg:1.2,pd:60,rng:50,grab:true}]},
};
const ELITES = {
  matriarch:{n:'Ash Lurker Matriarch', base:'rotbeast', hp:0.55, dmg:0.72, souls:2.4, spd:1.25, r:0.78, part:25,
    partName:'Tail', partReward:'Lurker\u2019s Barb'},
};

/* ---------- Vol 3 §3.8 · status effects ---------- */
const STATUS = {
  bleed:   {n:'Bleed',   build:100, col:'#c8453f', effect:'burst 30% max HP'},
  poison:  {n:'Poison',  build:100, col:'#6fae63', effect:'1.5% HP/s for 30 s'},
  toxic:   {n:'Toxic',   build:100, col:'#9ac87f', effect:'4% HP/s for 40 s'},
  frost:   {n:'Frostbite',build:100,col:'#9fd8ee', effect:'−18% stamina regen, +8% damage taken'},
  burn:    {n:'Burn',    build:100, col:'#e2703a', effect:'2.5% HP/s for 6 s'},
  curse:   {n:'Curse',   build:100, col:'#9a6fd0', effect:'halves max HP until absolved'},
  hollow:  {n:'Hollowing',build:8,  col:'#7d7263', effect:'sigils gained; unlocks the hidden ending'},
};

/* ---------- item / consumable catalogue ---------- */
const CONSUMABLES = {
'Ember':            {n:'Ember',            use:'ember',   note:'Kindles the Flame within. Required to be invaded (Vol 8 §8.3).'},
'Human Effigy':     {n:'Human Effigy',     use:'ember',   cost:800, note:'Ember without the flame. 800 souls at the Shrine.'},
'Life Gem':         {n:'Life Gem',         use:'gem',     note:'360 HP over 13.5 s. −6% move speed per use, floor 40% (Vol 7 §7.2).'},
'Charcoal Pine Resin':{n:'Charcoal Pine Resin',use:'resin',t:'fire',note:'+30% fire damage, 60 s.'},
'Gold Pine Resin':  {n:'Gold Pine Resin',  use:'resin',   t:'lightning',note:'+30% lightning damage, 60 s.'},
'Dark Pine Resin':  {n:'Dark Pine Resin',  use:'resin',   t:'dark',note:'+30% dark damage, 60 s. Feeds WANT.'},
'Alluring Skull':   {n:'Alluring Skull',   use:'lure',    note:'Draws enemy attention. Vol 3 §3.10.4 — the archetype-breaker.'},
'Firebomb':         {n:'Firebomb',         use:'throw',   dmg:180,t:'fire',note:'180 fire damage in a 3 m burst.'},
'Titanite Shard':   {n:'Titanite Shard',   use:'none',    note:'Upgrade material. Vol 2 §2.6.3.'},
'Titanite Chunk':   {n:'Titanite Chunk',   use:'none',    note:'+6 to +8 upgrades.'},
'Titanite Slab':    {n:'Titanite Slab',    use:'none',    note:'The +10 upgrade. Eight exist per cycle (Vol 7 §7.4).'},
'Estus Shard':      {n:'Estus Shard',      use:'shard',   note:'+1 to the Estus allocation pool (Vol 7 §7.1.3).'},
'Ashen Estus Shard':{n:'Ashen Estus Shard',use:'ashard',  note:'+2 to the pool, as Ashen Estus (FP).'},
'Bonfire Ascetic':  {n:'Bonfire Ascetic',  use:'ascetic', note:'Burn at a bonfire: local NG+, better loot, more aggression (Vol 7 §7.3).'},
'Cracked Red Eye Orb':{n:'Cracked Red Eye Orb',use:'none',note:'Three uses. The Darkwraith\u2019s door.'},
'White Sign Soapstone':{n:'White Sign Soapstone',use:'none',note:'Write a co-op summon sign. Vol 8 §8.2.'},
'Small Sun':        {n:'The Small Sun',    use:'none',    note:'A child in Ember Keep gave thee this. It is warm.'},
'Herald\u2019s Tail':{n:'Herald\u2019s Tail',use:'none',note:'Severed from Vharos. Vhenn will transpose it (Vol 7 §7.5).'},
'Ember-Forged Crown':{n:'Ember-Forged Crown',use:'none',note:'Severed from Karrag. STRIKE-type severance, part 2 of 31.'},
'Vharos Soul':      {n:'Soul of Vharos',   use:'none',    note:'Consumable for 24,000 souls, or traded to Vhenn for a unique weapon.'},
'Karrag Soul':      {n:'Soul of Karrag',   use:'none',    note:'Consumable for 19,000 souls, or traded for the Ember Crown.'},
'Sovereign Soul':   {n:'Soul of the Hollow Sovereign',use:'none',note:'Consumable for 6,000 souls.'},
};
const START_GIFTS = {
'Bare Hands':[], 'Ember':['Ember'], 'Charcoal Pine Resin':['Charcoal Pine Resin'],
'Healing Aid':['Life Gem','Life Gem'], 'Firebomb':['Firebomb','Firebomb'], 'Dark Orb':['Dark Orb'],
'Dragon Head':[], 'Titanite Shard ×3':['Titanite Shard','Titanite Shard','Titanite Shard'],
'Alluring Skull':['Alluring Skull'], 'Estus Shard':['Estus Shard'],
};

/* ---------- Vol 7 §7.9 · the 82-hour timeline, compressed ---------- */
const TIPS = [
'Roll i-frames are a number, not a feeling: 16 frames FAST, 13 MID, 9 FAT. Vitality buys you frames.',
'Poise is not armour. It is a budget: every hit spends it, and when the budget empties you stagger.',
'A Power Stance combo deals 1.6× posture damage, and 2.4× on the finisher. Guards break. Shields do not stop that.',
'Life Gems heal while you walk. Estus heals while you stand still and hope. Carry both.',
'Bonfire Ascetics raise the local NG+ of one region only. The rest of the world does not care.',
'Burn an Ascetic four times in one region and its boss Echo appears. There are fourteen of them.',
'WANT is spent by dark magic and never fully returns. Resonance 3 gives +32% dark damage and immunity below poise grade 2.',
'Death is a transaction: your souls fall where you died. Die again before reaching them and they are gone.',
'A parry is 8 active frames starting on frame 7. A riposte is ×3.20. Learning this is the whole game.',
'Severance needs the right damage type. Vharos\u2019s tail only parts to SLASH.',
'Mixed armour sets cost you 4 poise. Matching sets cost you nothing.',
'Fat rolls have 9 i-frames and 48 total frames. Heavy armour is a choice about trading, not about surviving.',
];
