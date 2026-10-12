// -----------------------------------------------------------------------------
//  Kurd Castle — browser preview
//  File: balance.js
//  Purpose: The exact same numbers as unity/KurdCastle/Assets/Scripts/Config/
//           Balance.cs. Keeping the mirror honest is the point: this preview is
//           the "can I actually play it?" half of the prototype, and the Unity
//           project is the "ship it to Android" half.
// -----------------------------------------------------------------------------

export const GameName = 'Kurd Castle';
export const Version = '0.9.0-prototype';

export const Sim = {
  TickRate: 10,
  TickDelta: 0.1,
  MaxCatchUpTicks: 4,
  EconomyIntervalSeconds: 5,
  CommanderThinkInterval: 2.5,
};

export const Map = {
  Width: 64,
  Height: 64,
};

export const Economy = {
  StartingResources: { wood: 260, stone: 160, iron: 40, gold: 220, food: 180 },
  BaseStorage: { wood: 400, stone: 300, iron: 150, gold: 99999, food: 250, weapons: 60, armor: 60, ale: 80 },
  CarryCapacity: 12,
  SalvageRatio: 0.35,
  RepairCostPerHp: 0.12,
  RepairHpPerSecond: 14,
};

export const Population = {
  StartingPeasants: 14,
  BaseHousing: 8,
  MaxPopulation: 220,
  MinSpawnInterval: 4,
  MaxSpawnInterval: 40,
  PeasantLeavesAbove: 30,
  MaxPeasantHealth: 40,
  WorkerMoveSpeed: 3.1,
  FoodPerPeasantPerMinute: 1.2,
  PopularityStart: 65,
  PopularityMin: -10,
  PopularityMax: 100,
};

export const Popularity = {
  // Popularity is a ledger of deltas on top of a neutral baseline, exactly like
  // Stronghold's monthly popularity review.
  Baseline: 50,
  DriftPerSecond: 0.6,
  FoodNone: -8, FoodHalf: -4, FoodFull: 0, FoodExtra: 5,
  TaxGenerous: -6, TaxLow: -2, TaxNormal: 0, TaxHigh: -4, TaxBrutal: -9,
  AleBonusPerInn: 3, AleBonusMax: 12, ChurchBonus: 4,
  OvercrowdPenalty: 2.5, SpareHousingBonus: 1.5,
  FearPerEnemyNearKeep: 0.6, FearMax: 25,
  KeepUnderAttackPenalty: 6,
};

export const Combat = {
  GlobalHealthScale: 1,
  GlobalDamageScale: 1,
  MeleeScale: 1,
  RangedScale: 1,
  RearAttackBonus: 1.35,
  WallArcherRangeBonus: 2.5,
  MinHitChance: 0.08,
  ProjectileArcHeightPerCell: 0.16,
};

export const Pathfinding = {
  MaxExpandedNodesPerRequest: 9000,
  RequestsPerTick: 12,
  WorkerRepathCooldown: 1.5,
  FlowFieldRefreshInterval: 0.75,
  FlowFieldNodesPerTick: 900,
};

export const Camera = {
  OrthoMin: 7, OrthoMax: 46, OrthoDefault: 20,
  PanSpeedBase: 26, EdgeDragSpeed: 22, EdgeDragMargin: 40,
  DoubleTapZoomDelta: 6,
};

export const Progression = {
  TotalWaves: 6,
  FirstWaveDelay: 75,
  WaveSurvivalGold: 40,
};

export const Ai = {
  AggroRadius: 13,
  CampHealRadius: 9,
  CampHealPerSecond: 4,
  MaxRetreats: 2,
  DesertSeconds: 10,
  SiegeWeaponAggroRadius: 16,
  RepathInterval: 1.2,
  RangedStandoffFactor: 0.85,
  FleeThresholdPct: 0.18,
  BreachSearchRadius: 14,
};

export const Ui = {
  ToastDuration: 3.2,
  LongPressDuration: 0.45,
  TapMaxMovementPixels: 18,
  DragThresholdPixels: 14,
  DoubleTapWindow: 0.28,
  PanelColor: 'rgba(26,23,20,0.9)',
  TextColor: '#f0ebdc',
  ValidColor: 'rgba(77,242,97,0.55)',
  InvalidColor: 'rgba(242,64,51,0.55)',
};

// -----------------------------------------------------------------------------
//  Damage matrix — rows: damage type, columns: armour type. Percent multipliers.
// -----------------------------------------------------------------------------
export const DAMAGE_TYPES = ['slash', 'pierce', 'blunt', 'fire', 'siege'];
export const ARMOR_TYPES = ['none', 'leather', 'mail', 'plate', 'wood', 'stone'];

const DAMAGE_TABLE = [
  [120, 105, 70, 60, 140, 35],   // slash
  [100, 95, 85, 50, 110, 30],    // pierce
  [110, 100, 105, 90, 160, 75],  // blunt
  [130, 120, 100, 70, 260, 25],  // fire
  [100, 90, 80, 70, 220, 150],   // siege
];

export function damageMultiplier(damageType, armorType) {
  const d = Math.max(0, DAMAGE_TYPES.indexOf(damageType));
  const a = Math.max(0, ARMOR_TYPES.indexOf(armorType));
  return DAMAGE_TABLE[d][a] / 100;
}

export function applyDamage(amount, damageType, armorType) {
  return amount * damageMultiplier(damageType, armorType) * Combat.GlobalDamageScale;
}

// -----------------------------------------------------------------------------
//  Buildings. A trimmed-but-faithful subset of BuildingCatalog.cs covering every
//  system the preview exercises: walls, towers, gates, keep, economy, military.
//  fp = footprint [x, y]; work = worker slots; garrison = archer slots.
// -----------------------------------------------------------------------------
export const BUILDINGS = {
  keep: {
    id: 'keep', name: 'Keep', category: 'castle', fp: [4, 4], height: 4.4,
    cost: { stone: 90, wood: 40, iron: 10 }, hp: 1600, armor: 'stone', buildTime: 20,
    isKeep: true, blocks: true, garrison: 8, defense: { range: 9, damage: 14, interval: 1.4 },
    pop: 4, desc: 'Your lord\'s seat. If the keep falls, you fall.',
  },
  wall: {
    id: 'wall', name: 'Stone Wall', category: 'castle', fp: [1, 1], height: 2.6,
    cost: { stone: 14 }, hp: 420, armor: 'stone', buildTime: 3,
    isWall: true, blocks: true, garrison: 1, desc: 'Archers on the parapet shoot 2.5 tiles further.',
  },
  palisade: {
    id: 'palisade', name: 'Palisade', category: 'castle', fp: [1, 1], height: 2.2,
    cost: { wood: 12 }, hp: 150, armor: 'wood', buildTime: 2,
    isWall: true, blocks: true, garrison: 1, desc: 'Cheap timber wall to buy you time.',
  },
  stairs: {
    id: 'stairs', name: 'Wall Stairs', category: 'castle', fp: [1, 1], height: 1.6,
    cost: { stone: 8 }, hp: 240, armor: 'stone', buildTime: 2,
    isWall: true, blocks: true, garrison: 2, isStairs: true, desc: 'Your troops mount the ramparts here.',
  },
  gate: {
    id: 'gate', name: 'Gatehouse', category: 'castle', fp: [2, 1], height: 4.2,
    cost: { stone: 50, wood: 20 }, hp: 900, armor: 'stone', buildTime: 9,
    isGate: true, blocks: true, garrison: 3, defense: { range: 7.5, damage: 8, interval: 1.8 },
    desc: 'Open it for your own troops, seal it against the ram.',
  },
  tower: {
    id: 'tower', name: 'Lookout Tower', category: 'castle', fp: [1, 1], height: 4.6,
    cost: { wood: 15, stone: 20 }, hp: 320, armor: 'stone', buildTime: 5,
    isTower: true, blocks: true, garrison: 2, defense: { range: 8, damage: 7, interval: 1.7 },
    desc: 'Two archers, a commanding view, a very long reach.',
  },
  squareTower: {
    id: 'squareTower', name: 'Square Tower', category: 'castle', fp: [2, 2], height: 5.6,
    cost: { stone: 45 }, hp: 620, armor: 'stone', buildTime: 8,
    isTower: true, blocks: true, garrison: 4, defense: { range: 8.5, damage: 10, interval: 1.6 },
    desc: 'A solid masonry bastion.',
  },
  moat: {
    id: 'moat', name: 'Moat', category: 'castle', fp: [1, 1], height: 0.3,
    cost: { gold: 2 }, hp: 60, armor: 'none', buildTime: 1,
    isMoat: true, blocks: true, desc: 'Enemies must go around — unless you leave a bridge.',
  },
  stockpile: {
    id: 'stockpile', name: 'Stockpile', category: 'economy', fp: [3, 3], height: 0.9,
    cost: { wood: 20 }, hp: 240, armor: 'wood', buildTime: 4,
    isStorage: true, storage: { wood: 250, stone: 200, iron: 100, food: 60, weapons: 40, armor: 40, ale: 40 },
    desc: 'Peasants haul every delivery here.',
  },
  hut: {
    id: 'hut', name: 'Woodcutter\'s Hut', category: 'economy', fp: [1, 1], height: 1.7,
    cost: { wood: 10 }, hp: 120, armor: 'wood', buildTime: 3, work: 1, needsForest: true,
    recipe: { out: 'wood', amount: 5, seconds: 6.5, job: 'woodcutter', depletes: true },
    desc: 'Fells adjacent trees. The backbone of your early economy.',
  },
  sawmill: {
    id: 'sawmill', name: 'Sawmill', category: 'economy', fp: [2, 2], height: 2.8,
    cost: { wood: 40, stone: 20 }, hp: 260, armor: 'wood', buildTime: 7, work: 2, needsForest: true,
    recipe: { out: 'wood', amount: 6, seconds: 6, job: 'woodcutter', depletes: true },
    desc: 'Industrial timber yard.',
  },
  forester: {
    id: 'forester', name: 'Forester\'s Hut', category: 'economy', fp: [2, 2], height: 2.2,
    cost: { wood: 15 }, hp: 160, armor: 'wood', buildTime: 5, work: 1, needsForest: true,
    recipe: { out: null, amount: 0, seconds: 7, job: 'forester' },
    desc: 'Plants saplings so the woodlot never runs dry.',
  },
  quarry: {
    id: 'quarry', name: 'Quarry', category: 'economy', fp: [2, 2], height: 2.2,
    cost: { wood: 25 }, hp: 240, armor: 'wood', buildTime: 6, work: 2, needsRock: true,
    recipe: { out: 'stone', amount: 4, seconds: 7.5, job: 'quarryman', depletes: true },
    desc: 'Cuts stone blocks from a rock deposit.',
  },
  mine: {
    id: 'mine', name: 'Iron Mine', category: 'economy', fp: [2, 2], height: 2.4,
    cost: { wood: 30, stone: 20 }, hp: 260, armor: 'wood', buildTime: 7, work: 2, needsIron: true,
    recipe: { out: 'iron', amount: 3, seconds: 9, job: 'miner', depletes: true },
    desc: 'Digs iron ore to arm your smiths.',
  },
  farm: {
    id: 'farm', name: 'Farm', category: 'economy', fp: [3, 3], height: 0.6,
    cost: { wood: 20 }, hp: 140, armor: 'wood', buildTime: 5, work: 3, needsFertile: true,
    recipe: { out: 'food', amount: 5, seconds: 9, job: 'farmer' },
    desc: 'Tills fertile soil. Mills nearby boost the yield.',
  },
  mill: {
    id: 'mill', name: 'Windmill', category: 'economy', fp: [2, 2], height: 5.2,
    cost: { wood: 30, stone: 20 }, hp: 200, armor: 'wood', buildTime: 8, work: 1,
    recipe: { out: null, amount: 0, seconds: 6, job: 'miller' },
    aura: 1, desc: 'Grinds grain and lifts nearby farms by 50%.',
  },
  bakery: {
    id: 'bakery', name: 'Bakery', category: 'economy', fp: [2, 2], height: 2.4,
    cost: { wood: 30, stone: 15 }, hp: 200, armor: 'wood', buildTime: 6, work: 2, aura: 1,
    recipe: { out: 'food', amount: 9, seconds: 8, job: 'baker', in: 'food', inAmount: 3 },
    desc: 'Bread feeds more mouths than raw grain.',
  },
  brewery: {
    id: 'brewery', name: 'Brewery', category: 'economy', fp: [2, 2], height: 2.6,
    cost: { wood: 35, stone: 10 }, hp: 200, armor: 'wood', buildTime: 7, work: 2,
    recipe: { out: 'ale', amount: 2, seconds: 12, job: 'brewer', in: 'food', inAmount: 2 },
    desc: 'Brews ale; inns turn ale into popularity.',
  },
  inn: {
    id: 'inn', name: 'Inn', category: 'economy', fp: [2, 2], height: 2.8,
    cost: { wood: 40, stone: 10 }, hp: 220, armor: 'wood', buildTime: 7,
    aura: Popularity.AleBonusPerInn, desc: '+3 popularity per inn while ale lasts.',
  },
  blacksmith: {
    id: 'blacksmith', name: 'Blacksmith', category: 'economy', fp: [2, 2], height: 2.6,
    cost: { wood: 30, stone: 20, iron: 5 }, hp: 220, armor: 'wood', buildTime: 8, work: 2,
    recipe: { out: 'weapons', amount: 1, seconds: 9, job: 'blacksmith', in: 'iron', inAmount: 2 },
    desc: 'Forges iron into weapons for your barracks.',
  },
  hovel: {
    id: 'hovel', name: 'Hovel', category: 'housing', fp: [1, 1], height: 1.5,
    cost: { wood: 8 }, hp: 100, armor: 'wood', buildTime: 2, housing: 2, desc: 'Housing for two peasants.',
  },
  house: {
    id: 'house', name: 'House', category: 'housing', fp: [2, 2], height: 2.6,
    cost: { wood: 25, stone: 10 }, hp: 180, armor: 'wood', buildTime: 5, housing: 6, aura: 0.5,
    desc: 'Solid housing for six.',
  },
  barracks: {
    id: 'barracks', name: 'Barracks', category: 'military', fp: [3, 3], height: 3.4,
    cost: { wood: 60, stone: 40, gold: 30 }, hp: 420, armor: 'wood', buildTime: 12,
    trains: ['spearman', 'swordsman'], desc: 'Drafts idle peasants into spearmen and swordsmen.',
  },
  range: {
    id: 'range', name: 'Archery Range', category: 'military', fp: [3, 2], height: 3,
    cost: { wood: 50, stone: 20, gold: 25 }, hp: 360, armor: 'wood', buildTime: 10,
    trains: ['archer'], desc: 'Trains archers — the cheapest way to man your walls.',
  },
};

export function buildingsInCategory(category) {
  return Object.values(BUILDINGS).filter((b) => b.category === category);
}

// -----------------------------------------------------------------------------
//  Units
// -----------------------------------------------------------------------------
export const UNITS = {
  peasant: {
    id: 'peasant', name: 'Peasant', role: 'worker', worker: true, hp: 40, armor: 'none',
    speed: Population.WorkerMoveSpeed, damage: 4, damageType: 'slash', range: 1.2, interval: 1.6,
    radius: 0.24, vision: 7, color: '#c8b98a', train: {}, trainTime: 0,
  },
  archer: {
    id: 'archer', name: 'Archer', role: 'ranged', hp: 58, armor: 'leather',
    speed: 3.7, damage: 7, damageType: 'pierce', range: 8.5, interval: 1.5,
    projectile: 17, accuracy: 0.85, radius: 0.26, vision: 11, aggro: 8.5, preferred: 7.5,
    color: '#7d9457', train: { gold: 20, weapons: 1 }, trainTime: 11,
  },
  spearman: {
    id: 'spearman', name: 'Spearman', role: 'melee', hp: 95, armor: 'mail',
    speed: 3.3, damage: 10, damageType: 'pierce', range: 1.9, interval: 1.35,
    radius: 0.28, vision: 9, aggro: 7.5, color: '#8f8669', train: { gold: 18, weapons: 1 }, trainTime: 10,
  },
  swordsman: {
    id: 'swordsman', name: 'Swordsman', role: 'melee', hp: 125, armor: 'plate',
    speed: 3.2, damage: 13, damageType: 'slash', range: 1.45, interval: 1.1,
    radius: 0.29, vision: 9, aggro: 8, color: '#9e9a93', train: { gold: 30, weapons: 1, armor: 1 }, trainTime: 16,
  },
  raider: {
    id: 'raider', name: 'Raider', role: 'melee', enemy: true, hp: 60, armor: 'none',
    speed: 3.9, damage: 8, damageType: 'slash', range: 1.4, interval: 1.2,
    radius: 0.27, vision: 10, aggro: 9, color: '#8a4a45',
  },
  enemyArcher: {
    id: 'enemyArcher', name: 'Raider Archer', role: 'ranged', enemy: true, hp: 52, armor: 'none',
    speed: 3.5, damage: 6, damageType: 'pierce', range: 8, interval: 1.7,
    projectile: 15, accuracy: 0.75, radius: 0.26, vision: 10, aggro: 8, preferred: 7, color: '#7a5148',
  },
  brute: {
    id: 'brute', name: 'Brute', role: 'melee', enemy: true, hp: 170, armor: 'mail',
    speed: 2.9, damage: 17, damageType: 'slash', range: 1.5, interval: 1.35,
    radius: 0.32, vision: 9, aggro: 8, color: '#6d4a45',
  },
  ladderman: {
    id: 'ladderman', name: 'Ladderman', role: 'ladder', enemy: true, hp: 80, armor: 'leather',
    speed: 3.4, damage: 9, damageType: 'pierce', range: 1.5, interval: 1.3,
    bypassWalls: true, radius: 0.28, vision: 9, aggro: 7, color: '#8c7040',
  },
  ram: {
    id: 'ram', name: 'Battering Ram', role: 'siege', enemy: true, hp: 340, armor: 'wood',
    speed: 1.9, damage: 55, damageType: 'siege', range: 2.0, interval: 3,
    buildingMultiplier: 2.2, radius: 0.55, clearance: 2, vision: 8, aggro: 6, color: '#7a5a38',
  },
  catapult: {
    id: 'catapult', name: 'Catapult', role: 'siege', enemy: true, hp: 280, armor: 'wood',
    speed: 1.6, damage: 65, damageType: 'siege', range: 13, interval: 5.5,
    projectile: 11, accuracy: 0.62, splash: 1.6, buildingMultiplier: 2.5,
    radius: 0.6, clearance: 2, vision: 14, aggro: 11, preferred: 12, color: '#6b5540',
  },
};

export const WAVES = [
  { index: 0, delay: Progression.FirstWaveDelay, title: 'Scouting Party', hasSiege: false, gold: 25,
    squads: [['raider', 4], ['enemyArcher', 2]] },
  { index: 1, delay: 105, title: 'Marauders', hasSiege: false, gold: 35,
    squads: [['raider', 7], ['enemyArcher', 3]] },
  { index: 2, delay: 115, title: 'The First Ram', hasSiege: true, gold: 50,
    squads: [['raider', 8], ['enemyArcher', 4], ['ram', 1], ['ladderman', 2]] },
  { index: 3, delay: 120, title: 'Brute Column', hasSiege: true, gold: 60,
    squads: [['brute', 6], ['raider', 6], ['enemyArcher', 5], ['ram', 1], ['ladderman', 4]] },
  { index: 4, delay: 135, title: 'Catapult Train', hasSiege: true, gold: 75,
    squads: [['brute', 8], ['enemyArcher', 6], ['catapult', 2], ['ram', 2], ['ladderman', 5]] },
  { index: 5, delay: 150, title: "The Warlord's Host", hasSiege: true, gold: 120,
    squads: [['brute', 10], ['enemyArcher', 8], ['catapult', 2], ['ram', 2], ['ladderman', 6]] },
];

export function waveSize(index) {
  if (index < 0 || index >= WAVES.length) return 0;
  return WAVES[index].squads.reduce((sum, [, count]) => sum + count, 0);
}

export const RESOURCE_LABEL = {
  wood: 'Wood', stone: 'Stone', iron: 'Iron', gold: 'Gold', food: 'Food',
  weapons: 'Weapons', armor: 'Armour', ale: 'Ale',
};

export const RESOURCE_COLOR = {
  wood: '#8c5c2e', stone: '#9e9ea8', iron: '#7380a0', gold: '#f2c738',
  food: '#70b84d', weapons: '#cc5147', armor: '#599ed9', ale: '#d99e26',
};

export const PRIMARY_RESOURCES = ['wood', 'stone', 'iron', 'gold', 'food'];

export function rationMultiplier(policy) {
  return { none: 0, half: 0.5, full: 1, extra: 2 }[policy] ?? 1;
}

export function taxGoldPerMinute(policy) {
  return { generous: -0.06, low: 0.02, normal: 0.05, high: 0.09, brutal: 0.16 }[policy] ?? 0.05;
}

export const RATION_POPULARITY = { none: Popularity.FoodNone, half: Popularity.FoodHalf, full: 0, extra: Popularity.FoodExtra };
export const TAX_POPULARITY = {
  generous: Popularity.TaxGenerous, low: Popularity.TaxLow, normal: 0,
  high: Popularity.TaxHigh, brutal: Popularity.TaxBrutal,
};
