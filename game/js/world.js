/* =====================================================================
   world.js — zones, geometry, bonfires, encounters, interactables
   Vol 5 (world architecture & interconnectivity), Vol 7 (bonfires)
   Geometry is rect-union floors: fast to collide, easy to light, and
   every shortcut in Vol 5 §5.2 is a door that opens from one side only.
   ===================================================================== */
'use strict';
const R=(x,y,w,h,extra={})=>Object.assign({x:x*TS,y:y*TS,w:w*TS,h:h*TS},extra);

/* ---------- zone blueprints ---------- */
const ZONES = {

/* ============ R01 · ASHEN BARRENS (SL 12–28, Vol 5 §5.5.1) ============ */
R01:{ id:'R01', n:'Ashen Barrens', age:'Souls', sl:'12–28', biome:'barrens',
  tint:'#2a241d', fog:'#12100c', accent:'#8a7f70',
  desc:'A beach of grey ash where the sea went away and never came back. Vol 5 §5.5.1: four bonfires, one main boss, one optional, and a door that only opens from the Cathedral side.',
  rooms:[
    R(10,86,22,16,{n:'The Waking Pit'}),
    R(18,66, 6,22,{corr:true}),
    R( 8,46,44,24,{n:'Ridge of Ribs'}),
    R(46,54,18, 7,{corr:true}),
    R(58,42,28,26,{n:'The Barrens'}),
    R(66,34, 7,10,{corr:true}),
    R(54,18,34,18,{n:'Barrow Gate'}),
    R(14,36, 6,12,{corr:true}),                      // the Watchtower stair — Vol 5 §5.5.1, degree-3 region
    R( 4,16,26,22,{n:'Ashen Watchtower'}),
    R(66, 4, 8,16,{corr:true}),
    R(50,-16,44,22,{n:'Cathedral Nave'}),
    R(84,50,22, 6,{corr:true,locked:'cathedralKey',lockMsg:'A gate of fused ash. Something on the far side opened it once.'}),
    R(104,40,20,18,{n:'Serpent Viaduct'}),
  ],
  hazards:[ R(20,52,14,4,{t:'ashdrift',dmg:0,slow:0.55,n:'Ash drift — waist-deep, halves movement'}) ],
  bonfires:[
    {id:'bf_waking', x:20*TS,y:94*TS, n:'The Waking Pit',  estus:5, ascetic:true, warp:true, first:true},
    {id:'bf_ridge',  x:14*TS,y:50*TS, n:'Ridge of Ribs',   estus:0},
    {id:'bf_barrow', x:60*TS,y:24*TS, n:'Barrow Gate',     estus:0},
    {id:'bf_watch',  x:10*TS,y:20*TS, n:'Ashen Watchtower',estus:0, warp:true},
  ],
  links:[
    {x:69*TS,y:57*TS,w:3*TS,h:3*TS,to:'R05',at:'gate', n:'Ember Keep Gate', req:'sovereignDead',
     msg:'The Hollow Sovereign still sits across the only road north.'},
    {x:19*TS,y:67*TS,w:4*TS,h:3*TS,to:'R02',at:'south', n:'Eclipse Sanctuary'},   // sits in the stair corridor
    {x:66*TS,y:-12*TS,w:6*TS,h:4*TS,to:'R04',at:'approach', n:'Sunken Cathedral', req:'karragDead',
     msg:'The Cathedral door is barred from within. Vol 5 §5.2.3 — find another way in.'},
  ],
  encounters:[
    // The Waking Pit: the tutorial grammar, one enemy at a time (Vol 3 §3.10)
    {t:'wretch',x:24*TS,y:90*TS},{t:'wretch',x:16*TS,y:92*TS},
    // Ridge of Ribs: first grouped fight + first archer
    {t:'hollow',x:20*TS,y:56*TS},{t:'hollow',x:26*TS,y:52*TS},{t:'hound',x:34*TS,y:60*TS},
    {t:'wretch',x:40*TS,y:50*TS},{t:'archer',x:44*TS,y:48*TS,elite:false},
    // The Barrens: the open field, three-way aggro
    {t:'hollow',x:64*TS,y:48*TS},{t:'hollow',x:70*TS,y:56*TS},{t:'hound',x:76*TS,y:46*TS},
    {t:'hollowk',x:80*TS,y:58*TS},{t:'archer',x:62*TS,y:44*TS},
    // Barrow Gate: the Sovereign's honour guard
    {t:'hollowk',x:60*TS,y:26*TS},{t:'hollowk',x:74*TS,y:22*TS},{t:'archer',x:82*TS,y:30*TS},
    {t:'hound',x:66*TS,y:32*TS},{t:'hound',x:78*TS,y:26*TS},
    // Ashen Watchtower: the optional elite (severance part 25 of 31)
    {t:'elite_matriarch',x:14*TS,y:24*TS},
    {t:'archer',x:8*TS,y:30*TS},{t:'hollow',x:22*TS,y:32*TS},
  ],
  items:[
    {x:26*TS,y:96*TS,give:{souls:400},n:'Soul of a Lost Undead',once:true},
    {x:12*TS,y:88*TS,give:{item:'Life Gem',n:3},n:'Life Gems ×3',once:true},
    {x:48*TS,y:64*TS,give:{item:'Ember',n:1},n:'Ember',once:true},
    {x:82*TS,y:46*TS,give:{w:'Longsword'},n:'Longsword',once:true},
    {x:38*TS,y:56*TS,give:{souls:900},n:'Soul of a Nameless Soldier',once:true},
    {x:84*TS,y:20*TS,give:{item:'Titanite Shard',n:2},n:'Titanite Shards ×2',once:true},
    {x:60*TS,y:32*TS,give:{a:'Ashen Knight Set'},n:'Ashen Knight Set',once:true},
    {x:22*TS,y:20*TS,give:{item:'Charcoal Pine Resin',n:2},n:'Charcoal Pine Resin ×2',once:true,guard:'elite'},
    {x:8*TS, y:26*TS,give:{w:'Shortbow',ammo:true},n:'Shortbow + arrows',once:true},
    {x:118*TS,y:46*TS,give:{item:'Estus Shard',n:1},n:'Estus Shard',once:true},
    {x:112*TS,y:52*TS,give:{r:'Ring of Favor'},n:'Ring of Favor',once:true},
  ],
  fog:{x:104*TS,y:40*TS,w:20*TS,h:18*TS,n:'Serpent Viaduct',msg:'A viaduct of fossilised serpent, spanning nothing. Vol 5 §5.6.'},
  boss:{id:'sovereign',x:71*TS,y:-6*TS,r:16*TS,arena:R(50,-16,44,22),fogGate:{x:66*TS,y:2*TS,w:8*TS,h:2*TS}},
},

/* ============ R02 · ECLIPSE SANCTUARY (hub, Vol 5 §5.3) ============ */
R02:{ id:'R02', n:'Eclipse Sanctuary', age:'Neutral', sl:'1–99', biome:'sanctuary',
  tint:'#241f2a', fog:'#100e14', accent:'#c8a35a', hub:true,
  desc:'The hub. Vol 5 §5.3: four bonfires, the Shrine Maiden, the Blacksmith, Vhenn the transposer, and the covenant altars. Nothing here can hurt you, which is why it feels like it might.',
  rooms:[
    R(24,58,10,14,{corr:true}),
    R(14,34,40,28,{n:'Central Nave'}),
    R(54,40,18,16,{n:'The Gold Quarter'}),
    R(18,20,26,14,{n:'The Undercroft'}),
    R( 2,38,12,14,{n:'Rampart Walk'}),
    R(54,32,14,10,{corr:true}),                // Undercroft stair
  ],
  hazards:[],
  bonfires:[
    {id:'bf_nave',  x:34*TS,y:48*TS, n:'Eclipse Sanctuary — Central Nave', estus:0, ascetic:false, warp:true, hub:true},
    {id:'bf_gold',  x:62*TS,y:48*TS, n:'The Gold Quarter', warp:true},
    {id:'bf_under', x:24*TS,y:26*TS, n:'The Undercroft',   warp:true},
    {id:'bf_ramp',  x:6*TS, y:44*TS, n:'Rampart Walk',     warp:true},
  ],
  links:[ {x:27*TS,y:68*TS,w:4*TS,h:4*TS,to:'R01',at:'pit', n:'Ashen Barrens'} ],
  npcs:[
    {id:'maiden',  x:30*TS,y:42*TS, n:'The Shrine Maiden', col:'#c8a35a', r:11,
     acts:['level','allocate','talk'], talk:[
      '"Thou art the Ashen Hollow. The one the fire could not name."',
      '"Give me thy souls and I will give them back as strength. It is not a kindness — it is arithmetic."',
      '"Nine attributes. Vigor, Attunement, Endurance, Strength, Dexterity, Vitality, Intelligence, Faith, Adaptability."',
      '"Adaptability is the one nobody buys and everybody needs. It is thy roll. It is thy i-frames. It is thy life."',
      '"When thou art Embered, they can come for thee. I would not recommend it. I would also not stop thee."']},
    {id:'vhenn',   x:24*TS,y:26*TS, n:'Vhenn of the Transposition', col:'#9a6fd0', r:11,
     acts:['transpose','talk'], talk:[
      '"Bring me a soul that is still shaped like its owner and I will make thee a weapon out of the shape."',
      '"Twenty-two bosses. Thirty-one severable parts. Vol 3 §3.9 keeps count so that I do not have to."',
      '"A tail is not a trophy. It is an argument the beast lost."']},
    {id:'blacksmith',x:62*TS,y:46*TS,n:'The Eclipse Blacksmith', col:'#e2703a', r:12,
     acts:['smith','talk'], talk:[
      '"Titanite and souls. That is the whole trade. Everybody thinks there is a third thing. There is not."',
      '"Infusion is a decision about which number thou art lying to thyself about."',
      '"Heavy says Strength matters. Sharp says Dexterity does. Raw says neither, and thou art strong enough already."',
      '"Ashen infusion takes the scaling away and gives the Weapon Art a rank. Some call that a downgrade. Those people have not fought a guard."']},
    {id:'kaedwyn', x:6*TS,y:44*TS,  n:'Sentinel Kaedwyn', col:'#5f9ad6', r:11,
     acts:['covenant','talk'], talk:[
      '"Five oaths are open to thee, Hollow. Vol 8 §8.4 counts them; I enforce them."',
      '"Warriors of Sunlight: co-op, and the lightning that rewards it."',
      '"Darkwraith: invasion without end. WANT without limit. Thou wilt not enjoy it."',
      '"Blue Sentinels: automatic defence of the Embered. Thou wilt be summoned mid-meal."',
      '"Dragon Remnants: fireproof, weightless, and never hollow. The oldest oath."',
      '"Forest Guardians: ambush. The Verdant Rot is thine to defend and it does not thank thee."',
      '"Rank three of any oath requires a Bonfire Ascetic burned in that oath\u2019s home region. That is the whole trick."']},
    {id:'child',   x:38*TS,y:56*TS, n:'A Small Child', col:'#ffd08a', r:8,
     acts:['talk','gift'], talk:[
      '"Art thou going to the Keep? My father is in the Keep. He is the noise."',
      '"I made thee something. It is a sun. It is small because I am small."',
      '"Do not tell him I gave it to thee. He is working."'],
     gift:{item:'The Small Sun',n:1, once:'smallSun'}},
  ],
  altars:[
    {x:56*TS,y:30*TS,n:'Darkwraith Altar',cov:'Darkwraith',req:{item:'Cracked Red Eye Orb'}},
    {x:20*TS,y:22*TS,n:'Sunlight Altar',cov:'Warriors of Sunlight',req:{stat:'FTH',v:25}},
    {x:8*TS, y:50*TS,n:'Sentinel Oathstone',cov:'Blue Sentinels',req:{npc:'kaedwyn'}},
  ],
  encounters:[], items:[
    {x:44*TS,y:38*TS,give:{item:'Human Effigy',n:1},n:'Human Effigy',once:true},
    {x:20*TS,y:30*TS,give:{item:'Life Gem',n:4},n:'Life Gems ×4',once:true},
    {x:68*TS,y:52*TS,give:{item:'Titanite Shard',n:2},n:'Titanite Shards ×2',once:true},
  ],
},

/* ============ R05 · EMBER KEEP (SL 44–62, Vol 5 §5.5.5) ============ */
R05:{ id:'R05', n:'Ember Keep', age:'Fire/Ash', sl:'44–62', biome:'keep',
  tint:'#2e1d14', fog:'#170d08', accent:'#e2703a',
  desc:'A volcanic iron castle that is still being worked. Vol 5 §5.5.5: eight bonfires, a vertical climb of 250 m, molten floors, and Karrag at the top of the furnace.',
  rooms:[
    R(60,74,14,10,{n:'Cinder Gate'}),
    R(64,62, 6,14,{corr:true}),
    R(44,48,44,18,{n:'The Bellows Floor'}),
    R(50,40, 6,10,{corr:true}),
    R(34,26,36,16,{n:'Furnace Stair'}),
    R(68,28, 6,14,{corr:true}),
    R(70,14,26,16,{n:'Rib Walk'}),
    R(78,28, 6,12,{corr:true}),
    R(58,-4,34,20,{n:'Sovereign\u2019s Antechamber'}),
    R(30,16, 6,12,{corr:true}),
    R(14, 4,22,16,{n:'The High Forge'}),
    R(58,-22,34,20,{n:'Molten Core'}),
    R(68,-6,10,10,{corr:true,locked:'karragDead',lockMsg:'The furnace floor collapsed inward. Vol 5 §5.5.5 — Karrag was standing on it.'}),
  ],
  hazards:[
    R(46,52,10,4,{t:'molten',dmg:24,n:'Molten floor — 24 damage per second'}),
    R(74,50, 8,4,{t:'molten',dmg:24}),
    R(36,30, 8,4,{t:'molten',dmg:30}),
    R(60, 2,14,6,{t:'molten',dmg:38}),
    R(76,18, 6,6,{t:'embers',dmg:8,n:'Ember field — 8/s and it slows thee'}),
  ],
  bonfires:[
    {id:'bf_cinder',  x:67*TS,y:79*TS, n:'Cinder Gate',          estus:0, ascetic:true, warp:true},
    {id:'bf_bellows', x:48*TS,y:52*TS, n:'The Bellows Floor',    warp:true},
    {id:'bf_furnace', x:38*TS,y:30*TS, n:'Furnace Stair'},
    {id:'bf_rib',     x:74*TS,y:18*TS, n:'Rib Walk',             warp:true},
    {id:'bf_ante',    x:62*TS,y:0*TS,  n:'Sovereign\u2019s Antechamber'},
    {id:'bf_forge',   x:18*TS,y:8*TS,  n:'The High Forge',       warp:true},
    {id:'bf_smallsun',x:80*TS,y:36*TS, n:'The Small Sun\u2019s Rest', req:'childMet',
      msg:'A landing where a child sits. It lights on the fourth meeting. (Vol 5 §5.5.5)'},
    {id:'bf_core',    x:62*TS,y:-18*TS,n:'Molten Core Approach'},
  ],
  links:[
    {x:65*TS,y:82*TS,w:4*TS,h:4*TS,to:'R01',at:'north', n:'Ashen Barrens'},
    {x:20*TS,y:6*TS, w:4*TS,h:3*TS,to:'R04',at:'crypt', n:'Sunken Cathedral — the Undercrypt',
     req:'karragDead', msg:'The forge floor drops away into flooded stone. Karrag still stands on it.'},
  ],
  encounters:[
    {t:'pyro',x:68*TS,y:76*TS},{t:'hollow',x:62*TS,y:78*TS},
    {t:'knight',x:52*TS,y:56*TS},{t:'pyro',x:60*TS,y:50*TS},{t:'hound',x:70*TS,y:58*TS},
    {t:'hollowk',x:78*TS,y:54*TS},{t:'archer',x:84*TS,y:60*TS},
    {t:'knight',x:40*TS,y:34*TS},{t:'pyro',x:48*TS,y:30*TS},{t:'knight',x:56*TS,y:36*TS},
    {t:'archer',x:64*TS,y:32*TS},{t:'hound',x:44*TS,y:38*TS},
    {t:'knight',x:76*TS,y:20*TS},{t:'pyro',x:88*TS,y:24*TS},{t:'hollowk',x:80*TS,y:26*TS},
    {t:'sentinel',x:64*TS,y:6*TS},{t:'pyro',x:70*TS,y:10*TS},{t:'knight',x:82*TS,y:4*TS},
    {t:'sentinel',x:20*TS,y:10*TS},{t:'pyro',x:26*TS,y:14*TS},{t:'knight',x:30*TS,y:8*TS},
    {t:'archer',x:18*TS,y:16*TS},
  ],
  items:[
    {x:60*TS,y:76*TS,give:{souls:1600},n:'Soul of a Forge-Warden',once:true},
    {x:80*TS,y:56*TS,give:{item:'Firebomb',n:3},n:'Firebombs ×3',once:true},
    {x:50*TS,y:56*TS,give:{r:'Flame Stone Ring'},n:'Flame Stone Ring',once:true},
    {x:66*TS,y:34*TS,give:{w:'Ashen Greatsword'},n:'Ashen Greatsword',once:true},
    {x:88*TS,y:18*TS,give:{item:'Titanite Chunk',n:2},n:'Titanite Chunks ×2',once:true},
    {x:52*TS,y:30*TS,give:{a:'Artificer Set'},n:'Artificer Set',once:true},
    {x:26*TS,y:18*TS,give:{w:'Artificer\u2019s Hammer'},n:'Artificer\u2019s Hammer',once:true},
    {x:16*TS,y:12*TS,give:{r:'Covetous Silver Serpent'},n:'Covetous Silver Serpent Ring',once:true},
    {x:84*TS,y:8*TS, give:{item:'Estus Shard',n:1},n:'Estus Shard',once:true},
    {x:64*TS,y:-16*TS,give:{item:'Titanite Slab',n:1},n:'Titanite Slab',once:true},
    {x:86*TS,y:-14*TS,give:{a:'Drakeblood Set'},n:'Drakeblood Set',once:true},
    {x:76*TS,y:-20*TS,give:{spell:'Fire Surge'},n:'Fire Surge (pyromancy)',once:true},
  ],
  boss:{id:'karrag',x:74*TS,y:-12*TS,r:17*TS,arena:R(58,-22,34,20),fogGate:{x:68*TS,y:-4*TS,w:8*TS,h:2*TS}},
},

/* ============ R04 · SUNKEN CATHEDRAL (SL 28–48, Vol 5 §5.5.4) ============ */
R04:{ id:'R04', n:'Sunken Cathedral', age:'Want', sl:'28–48', biome:'cathedral',
  tint:'#1b2228', fog:'#0c1114', accent:'#5f9ad6',
  desc:'A flooded basilica where the water has learned to want. Vol 5 §5.5.4: eight bonfires, two of them the same bonfire at different depths. Vharos is at the end of the nave.',
  rooms:[
    R(20,74,12,10,{n:'Sluice House'}),
    R(24,64, 6,12,{corr:true}),
    R(12,46,42,20,{n:'The Nave (low)'}),
    R(52,50, 6,14,{corr:true}),
    R(56,44,30,20,{n:'Forty Chairs'}),
    R(24,32, 8,16,{corr:true}),
    R(10,18,38,16,{n:'The Nave (high)'}),
    R(44,20,10,12,{corr:true}),
    R(50,10,26,14,{n:'Choir Loft'}),
    R(20, 6, 8,14,{corr:true}),
    R( 6,-10,26,18,{n:'The Drowned Crypt'}),
    R(30,-14,40,18,{n:'Warden\u2019s Walk'}),
    R(68,-4, 8,16,{corr:true}),
    R(52,-36,44,24,{n:'Vharos\u2019 Nave'}),
    R(70,-14, 6,24,{corr:true}),
    R(12,-26,16,14,{n:'The Bricked Door'}),
    R(26,-22, 6,10,{corr:true,locked:'vharosDead',lockMsg:'Bricked from this side. Vol 5 §5.2.3 — the shortcut opens only after Vharos falls.'}),
  ],
  hazards:[
    R(14,52,18,6,{t:'water',dmg:0,slow:0.62,n:'Standing water — 62% movement, and it hides the floor'}),
    R(58,48,14,6,{t:'water',dmg:0,slow:0.62}),
    R(12,22,20,6,{t:'water',dmg:6,slow:0.62,n:'Want-touched water — 6/s'}),
    R(34,-8,16,6,{t:'water',dmg:6,slow:0.62}),
    R(56,-30,12,6,{t:'want',dmg:16,slow:0.5,n:'Liquid WANT — 16/s and it feeds the meter'}),
  ],
  bonfires:[
    {id:'bf_sluice', x:26*TS,y:79*TS, n:'Sluice House',      estus:0, ascetic:true, warp:true},
    {id:'bf_navelow',x:16*TS,y:50*TS, n:'The Nave (low)',    warp:true},
    {id:'bf_navehigh',x:40*TS,y:20*TS,n:'The Nave (high)',   warp:true,
      note:'Vol 5 §5.5.4: two bonfires at the same location, only one lit at a time.'},
    {id:'bf_chairs', x:62*TS,y:48*TS, n:'Forty Chairs'},
    {id:'bf_choir',  x:56*TS,y:14*TS, n:'Choir Loft',        warp:true},
    {id:'bf_crypt',  x:12*TS,y:-4*TS, n:'The Drowned Crypt'},
    {id:'bf_warden', x:36*TS,y:-10*TS,n:'Warden\u2019s Walk'},
    {id:'bf_brick',  x:16*TS,y:-20*TS,n:'The Bricked Door',  req:'vharosDead',
      msg:'It lights only after Vharos dies, from the far side. (Vol 5 §5.5.4)'},
  ],
  links:[
    {x:24*TS,y:82*TS,w:4*TS,h:3*TS,to:'R01',at:'cathedral', n:'Ashen Barrens — the Barrow Gate'},
    {x:22*TS,y:8*TS, w:4*TS,h:3*TS,to:'R05',at:'forge',     n:'Ember Keep — the Undercrypt'},
    {x:94*TS,y:-24*TS,w:4*TS,h:4*TS,to:'R13',at:'mouth',    n:'The Want Beneath', req:'vharosDead',
     msg:'The nave ends in a wound in the floor. Vol 5 §5.5.13 — the expansion.'},
  ],
  encounters:[
    {t:'archer',x:24*TS,y:78*TS},{t:'wretch',x:28*TS,y:70*TS},
    {t:'hollow',x:18*TS,y:56*TS},{t:'archer',x:30*TS,y:50*TS},{t:'wretch',x:40*TS,y:58*TS},
    {t:'hollowk',x:46*TS,y:52*TS},{t:'hound',x:22*TS,y:62*TS},
    {t:'knight',x:62*TS,y:54*TS},{t:'archer',x:76*TS,y:48*TS},{t:'hollow',x:70*TS,y:58*TS},
    {t:'pyro',x:80*TS,y:56*TS},
    {t:'hollowk',x:18*TS,y:26*TS},{t:'archer',x:36*TS,y:22*TS},{t:'wretch',x:26*TS,y:30*TS},
    {t:'knight',x:42*TS,y:26*TS},
    {t:'sentinel',x:56*TS,y:16*TS},{t:'pyro',x:66*TS,y:12*TS},{t:'archer',x:70*TS,y:20*TS},
    {t:'rotbeast',x:12*TS,y:-2*TS},{t:'hollow',x:22*TS,y:2*TS},{t:'wretch',x:16*TS,y:4*TS},
    {t:'rotbeast',x:38*TS,y:-8*TS},{t:'knight',x:52*TS,y:-12*TS},{t:'archer',x:60*TS,y:-6*TS},
  ],
  items:[
    {x:30*TS,y:76*TS,give:{souls:2400},n:'Soul of a Drowned Deacon',once:true},
    {x:14*TS,y:60*TS,give:{item:'Life Gem',n:5},n:'Life Gems ×5',once:true},
    {x:48*TS,y:56*TS,give:{spell:'Dark Orb'},n:'Dark Orb (hex)',once:true},
    {x:80*TS,y:52*TS,give:{w:'Uchigatana'},n:'Uchigatana',once:true},
    {x:20*TS,y:24*TS,give:{r:'Dark Stone Ring'},n:'Dark Stone Ring',once:true},
    {x:64*TS,y:16*TS,give:{w:'Herald\u2019s Ash Pike'},n:'Herald\u2019s Ash Pike',once:true},
    {x:70*TS,y:20*TS,give:{spell:'Homing Soulmass'},n:'Homing Soulmass (sorcery)',once:true},
    {x:14*TS,y:-6*TS,give:{a:'Hexwife Set'},n:'Hexwife Set',once:true},
    {x:24*TS,y:0*TS, give:{item:'Cracked Red Eye Orb',n:3},n:'Cracked Red Eye Orbs ×3',once:true},
    {x:56*TS,y:-8*TS,give:{w:'Longbow'},n:'Longbow',once:true},
    {x:44*TS,y:-12*TS,give:{item:'Bonfire Ascetic',n:1},n:'Bonfire Ascetic',once:true},
    {x:64*TS,y:-18*TS,give:{r:'Ring of Blades'},n:'Ring of Blades',once:true},
    {x:88*TS,y:-30*TS,give:{item:'Titanite Slab',n:1},n:'Titanite Slab',once:true},
    {x:20*TS,y:-24*TS,give:{spell:'Med Heal'},n:'Med Heal (miracle)',once:true},
  ],
  boss:{id:'vharos',x:74*TS,y:-24*TS,r:19*TS,arena:R(52,-36,44,24),fogGate:{x:68*TS,y:-14*TS,w:8*TS,h:2*TS}},
},
};

/* R13 is the expansion teaser — reachable only after Vharos, and it is a lie with a door in it */
ZONES.R13 = { id:'R13', n:'The Want Beneath', age:'Want', sl:'90–115', biome:'abyss',
  tint:'#140f1c', fog:'#08060c', accent:'#9a6fd0', expansion:true,
  desc:'Vol 5 §5.5.13 — the inverted world. It ships with the expansion. In this prototype it is a threshold and a sentence.',
  rooms:[ R(0,0,26,20,{n:'The Wound'}) ], hazards:[], bonfires:[], links:[
    {x:2*TS,y:8*TS,w:3*TS,h:3*TS,to:'R04',at:'vharosNave',n:'Sunken Cathedral'}],
  encounters:[], items:[{x:20*TS,y:10*TS,give:{item:'Dark Pine Resin',n:2},n:'Dark Pine Resins ×2',once:true}],
  npcs:[{id:'serpent',x:13*TS,y:10*TS,n:'A Serpent, Frampt\u2019s Mouth',col:'#9a6fd0',r:14,acts:['talk'],talk:[
    '"Thou hast come down. Everything comes down eventually."',
    '"The expansion of this document begins here. Fourteen regions were specified; four were built. That is the honest number."',
    '"Return to the Cathedral and choose an ending, Hollow. Thou hast earned the right to be wrong."']}],
};

/* ---------- biome palettes (Vol 1 §1.9) ---------- */
const BIOMES = {
  barrens:  {floor:['#2b2620','#322c24','#262119'], wall:'#3e382e', top:'#524a3c', edge:'#191510', detail:'#4a4238', light:'#c8a35a'},
  sanctuary:{floor:['#2a2733','#312d3b','#25222e'], wall:'#4a4358', top:'#6b6084', edge:'#171420', detail:'#c8a35a', light:'#e8cf94'},
  keep:     {floor:['#33221a','#3a271d','#2b1c15'], wall:'#543623', top:'#7a4c2c', edge:'#1c110b', detail:'#e2703a', light:'#ffb84a'},
  cathedral:{floor:['#1e262c','#232c33','#1a2126'], wall:'#33424c', top:'#4a5f6d', edge:'#101619', detail:'#5f9ad6', light:'#9fd8ee'},
  abyss:    {floor:['#171222','#1c1529','#13101c'], wall:'#2c2140', top:'#3f2f5c', edge:'#0a0810', detail:'#9a6fd0', light:'#c9a8f0'},
};

/* ---------- world runtime ---------- */
const World = {
  zone:null, zoneId:null, solids:[], floors:[], hazards:[],
  loaded:new Set(),                 // visited zones (Vol 5 §5.7 warp network)
  enter(id, at=null, silent=false){
    const z = ZONES[id]; if(!z) return false;
    this.zone=z; this.zoneId=id; this.loaded.add(id);
    this.floors = z.rooms;
    this.hazards = z.hazards||[];
    this.solids = [];                                   // decorative solids built by spawners
    if(!silent) Audio_.startAmbient(id);
    return true;
  },
  /* is a point inside the walkable union? */
  onFloor(x,y,pad=0){
    for(const r of this.floors){ if(x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad) return true }
    return false;
  },
  /* push an entity back inside the walkable union */
  contain(e){
    if(this.onFloor(e.x,e.y,-e.r*0.4)) { resolveSolids(e,this.solids); return false }
    // find the nearest floor rect and clamp into it
    let best=null,bd=1e9;
    for(const r of this.floors){
      const nx=clamp(e.x,r.x+e.r,r.x+r.w-e.r), ny=clamp(e.y,r.y+e.r,r.y+r.h-e.r);
      const d=(nx-e.x)**2+(ny-e.y)**2;
      if(d<bd){bd=d;best={x:nx,y:ny}}
    }
    if(best){ e.x=best.x; e.y=best.y; resolveSolids(e,this.solids); return true }
    return false;
  },
  hazardAt(x,y){ for(const h of this.hazards) if(x>h.x&&x<h.x+h.w&&y>h.y&&y<h.y+h.h) return h; return null },
  roomAt(x,y){ for(const r of this.floors) if(x>r.x&&x<r.x+r.w&&y>r.y&&y<r.y+r.h) return r; return null },
  /* ---------- rendering ----------
     Floors are rect unions; walls are drawn as 14 px segments and any segment
     whose far side belongs to another floor rect is a DOORWAY and is left open.
     That single rule is what makes Vol 5 §5.2's shortcut grammar legible. */
  inAnyRect(x,y,skip){ for(const r of this.floors){ if(r===skip) continue;
      if(x>=r.x-1&&x<=r.x+r.w+1&&y>=r.y-1&&y<=r.y+r.h+1) return true } return false },
  draw(g,cam,t){
    const z=this.zone, B=BIOMES[z.biome]||BIOMES.barrens;
    const x0=cam.x-48,y0=cam.y-48,x1=cam.x+cam.w+48,y1=cam.y+cam.h+48;
    g.fillStyle='#040302'; g.fillRect(0,0,cam.w,cam.h);

    /* floors */
    for(const r of this.floors){
      if(r.x>x1||r.y>y1||r.x+r.w<x0||r.y+r.h<y0) continue;
      const tx=Math.round(r.x/TS), ty=Math.round(r.y/TS), tw=Math.round(r.w/TS), th=Math.round(r.h/TS);
      for(let i=0;i<tw;i++) for(let j=0;j<th;j++){
        const h=hash2(tx+i,ty+j,7);
        g.fillStyle=B.floor[h<0.5?0:h<0.82?1:2];
        g.fillRect(r.x+i*TS,r.y+j*TS,TS+1,TS+1);
        if(h>0.94){ g.globalAlpha=0.14; g.fillStyle=B.detail;
          g.fillRect(r.x+i*TS+9,r.y+j*TS+9,TS-18,TS-18); g.globalAlpha=1 }
        else if(h<0.05){ g.globalAlpha=0.11; g.fillStyle='#000';
          g.fillRect(r.x+i*TS+4,r.y+j*TS+12,TS-8,TS-20); g.globalAlpha=1 }
      }
      if(!r.corr && r.n){
        g.save(); g.globalAlpha=0.16; g.fillStyle=B.light; g.textAlign='left';
        g.font='600 10px "SFMono-Regular",Menlo,monospace';
        g.fillText(r.n.toUpperCase(), r.x+15, r.y+21); g.restore();
      }
    }

    /* walls, segmented around doorways */
    const W=11, step=14;
    for(const r of this.floors){
      if(r.x>x1||r.y>y1||r.x+r.w<x0||r.y+r.h<y0) continue;
      const run=(ax,ay,bx,by,nx,ny)=>{
        const n=Math.max(1,Math.ceil(Math.hypot(bx-ax,by-ay)/step));
        for(let i=0;i<n;i++){
          const t0=i/n, px=ax+(bx-ax)*t0, py=ay+(by-ay)*t0;
          const mx=px+(bx-ax)/n/2, my=py+(by-ay)/n/2;
          if(this.inAnyRect(mx+nx*0.75,my+ny*0.75,r)) continue;      // doorway
          if(this.inAnyRect(mx+nx*1.9,my+ny*1.9,r)) continue;        // thick-wall overlap
          g.fillStyle=B.wall;
          if(ny) g.fillRect(px, py+(ny<0?-W:0), (bx-ax)/n+1, W);
          else   g.fillRect(px+(nx<0?-W:0), py, W, (by-ay)/n+1);
          g.fillStyle=B.top;                                          // cap = readable height
          if(ny) g.fillRect(px, py+(ny<0?-W:0), (bx-ax)/n+1, ny<0?3:W-3);
          else   g.fillRect(px+(nx<0?-W:0), py, nx<0?3:W-3, (by-ay)/n+1);
        }
      };
      run(r.x,r.y,r.x+r.w,r.y,0,-1);
      run(r.x,r.y+r.h,r.x+r.w,r.y+r.h,0,1);
      run(r.x,r.y,r.x,r.y+r.h,-1,0);
      run(r.x+r.w,r.y,r.x+r.w,r.y+r.h,1,0);
    }

    /* locked corridors: a barrier with a stated reason */
    for(const r of this.floors){
      if(!r.locked || Flags[r.locked]) continue;
      if(r.x>x1||r.y>y1||r.x+r.w<x0||r.y+r.h<y0) continue;
      g.fillStyle='rgba(9,7,5,.95)'; g.fillRect(r.x,r.y,r.w,r.h);
      g.strokeStyle='#5a4a2c'; g.lineWidth=2; g.strokeRect(r.x+3.5,r.y+3.5,r.w-7,r.h-7);
      g.fillStyle='#8a7f70'; g.font='9px "SFMono-Regular",Menlo,monospace'; g.textAlign='center';
      g.fillText('S E A L E D', r.x+r.w/2, r.y+r.h/2+3); g.textAlign='left';
    }

    this.drawAtmosphere(g,cam,t,B);

    /* hazards */
    for(const h of this.hazards){
      if(h.x>x1||h.y>y1||h.x+h.w<x0||h.y+h.h<y0) continue;
      if(h.t==='molten'||h.t==='embers'){
        const p=0.5+0.5*Math.sin(t*2.2+h.x*0.01);
        g.fillStyle=h.t==='molten'?`rgba(226,112,58,${0.48+0.30*p})`:`rgba(200,134,42,${0.24+0.20*p})`;
        g.fillRect(h.x,h.y,h.w,h.h);
        g.fillStyle=`rgba(255,226,176,${0.20*p})`;
        for(let i=0;i<5;i++) g.fillRect(h.x+(i*53+((t*22)|0))%Math.max(1,h.w), h.y+(i*37)%h.h, 10,2);
      } else if(h.t==='water'||h.t==='want'){
        const c=h.t==='want'?'154,111,208':'95,154,214';
        g.fillStyle=`rgba(${c},0.24)`; g.fillRect(h.x,h.y,h.w,h.h);
        for(let i=0;i<7;i++){ const yy=h.y+((t*15+i*41)%h.h);
          g.fillStyle=`rgba(${c},${0.08+0.08*Math.sin(t*3+i)})`; g.fillRect(h.x,yy,h.w,2) }
        g.strokeStyle=`rgba(${c},.40)`; g.lineWidth=1; g.strokeRect(h.x+.5,h.y+.5,h.w-1,h.h-1);
      } else if(h.t==='ashdrift'){
        g.fillStyle='rgba(138,127,112,0.20)'; g.fillRect(h.x,h.y,h.w,h.h);
        for(let i=0;i<8;i++){ const xx=h.x+((i*61+((t*8)|0))%h.w);
          g.fillStyle='rgba(186,176,158,.15)'; g.fillRect(xx,h.y+(i*29)%h.h,15,2) }
      }
    }
  },
  drawAtmosphere(g,cam,t,B){
    const z=this.zone;
    if(z.biome==='barrens'||z.biome==='abyss'){
      for(let i=0;i<70;i++){
        const sx=(hash2(i,3,11)*cam.w + t*(6+i%5*3))%cam.w;
        const sy=(hash2(i,7,13)*cam.h + t*(3+i%3*2))%cam.h;
        g.globalAlpha=0.10+0.16*hash2(i,9,17); g.fillStyle=B.accent; g.fillRect(sx,sy,1.6,1.6);
      }
      g.globalAlpha=1;
    } else if(z.biome==='keep'){
      for(let i=0;i<44;i++){
        const sx=(hash2(i,5,19)*cam.w);
        const sy=(cam.h - ((t*(24+i%7*9)+hash2(i,2,23)*cam.h)%cam.h));
        g.globalAlpha=0.16+0.3*hash2(i,8,29); g.fillStyle=i%3?'#e2703a':'#ffd08a'; g.fillRect(sx,sy,1.8,1.8);
      }
      g.globalAlpha=1;
    } else if(z.biome==='cathedral'){
      for(let i=0;i<26;i++){
        const sx=(hash2(i,11,31)*cam.w), sy=(hash2(i,13,37)*cam.h);
        g.globalAlpha=0.05+0.05*Math.sin(t*1.6+i); g.fillStyle='#9fd8ee';
        g.fillRect(sx,sy,2,2);
      }
      g.globalAlpha=1;
    } else {
      for(let i=0;i<40;i++){
        const sx=(hash2(i,17,41)*cam.w + Math.sin(t*0.4+i)*18);
        const sy=(cam.h-((t*11+hash2(i,19,43)*cam.h)%cam.h));
        g.globalAlpha=0.14+0.2*hash2(i,23,47); g.fillStyle='#e8cf94'; g.fillRect(sx,sy,1.5,1.5);
      }
      g.globalAlpha=1;
    }
  },
};
