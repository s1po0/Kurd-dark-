// -----------------------------------------------------------------------------
//  File: Config/BuildingCatalog.cs
//  Purpose: The complete building database. This is the "design spreadsheet" of
//           the prototype expressed as C#. Everything the construction, economy
//           and combat systems need is declared here exactly once.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;

namespace KurdCastle.Config
{
    public static class BuildingCatalog
    {
        static BuildingDefinition[] _all;
        static Dictionary<BuildingId, BuildingDefinition> _byId;
        static readonly List<BuildingDefinition> _playerBuildable = new List<BuildingDefinition>();

        public static BuildingDefinition[] All { get { EnsureInit(); return _all; } }

        /// <summary>Player-constructible buildings grouped by category, in menu order.</summary>
        public static IReadOnlyList<BuildingDefinition> PlayerBuildable
        {
            get { EnsureInit(); return _playerBuildable; }
        }

        public static BuildingDefinition Get(BuildingId id)
        {
            EnsureInit();
            BuildingDefinition def;
            return _byId.TryGetValue(id, out def) ? def : _byId[BuildingId.None];
        }

        public static List<BuildingDefinition> InCategory(BuildingCategory c)
        {
            EnsureInit();
            var list = new List<BuildingDefinition>(12);
            for (int i = 0; i < _playerBuildable.Count; i++)
                if (_playerBuildable[i].Category == c) list.Add(_playerBuildable[i]);
            return list;
        }

        static void EnsureInit()
        {
            if (_all != null) return;
            var list = new List<BuildingDefinition>(64);

            // =========================== ECONOMY ============================
            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Stockpile, DisplayName = "Stockpile", Category = BuildingCategory.Economy,
                Description = "Accepts every delivery. Peasants haul gathered goods here.",
                Footprint = new Int2(3, 3), Height = 0.9f, Shape = BuildingShape.Storage,
                PrimaryColor = new Color(0.60f, 0.46f, 0.28f), SecondaryColor = new Color(0.34f, 0.26f, 0.16f),
                Cost = new ResourceCost(wood: 20), MaxHealth = 240, Armor = ArmorType.Wood, BuildTimeSeconds = 5f,
                IsStoragePoint = true,
                StorageBonus = new ResourceCost(wood: 250, stone: 200, iron: 100, weapons: 40, armor: 40, ale: 40),
                BlocksPath = false, VisionRange = 6, Hotkey = 1,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Granary, DisplayName = "Granary", Category = BuildingCategory.Economy,
                Description = "Food storehouse. Doubles as a second delivery point for bread and grain.",
                Footprint = new Int2(3, 2), Height = 3.2f, Shape = BuildingShape.Storage,
                PrimaryColor = new Color(0.72f, 0.63f, 0.42f), SecondaryColor = new Color(0.40f, 0.30f, 0.18f),
                Cost = new ResourceCost(wood: 35, stone: 10), MaxHealth = 220, Armor = ArmorType.Wood, BuildTimeSeconds = 6f,
                IsStoragePoint = true, StorageBonus = new ResourceCost(food: 250),
                BlocksPath = true, VisionRange = 6, PopularityAura = 0f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.WoodcutterHut, DisplayName = "Woodcutter's Hut", Category = BuildingCategory.Economy,
                Description = "Fells adjacent trees. The backbone of your early economy.",
                Footprint = new Int2(1, 1), Height = 1.8f, Shape = BuildingShape.Hut,
                PrimaryColor = new Color(0.63f, 0.50f, 0.33f), SecondaryColor = new Color(0.35f, 0.25f, 0.15f),
                Cost = new ResourceCost(wood: 10), MaxHealth = 120, Armor = ArmorType.Wood, BuildTimeSeconds = 3f,
                WorkerSlots = 1, NeedsForest = true, Hotkey = 2,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Wood, OutputAmount = 5, CycleSeconds = 6.5f,
                    Job = JobType.Woodcutter, RequiresDepletableTile = true, CyclesPerTileHarvest = 3,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Sawmill, DisplayName = "Sawmill", Category = BuildingCategory.Economy,
                Description = "Industrial timber yard: twice the output of a hut, needs two workers.",
                Footprint = new Int2(2, 2), Height = 3.4f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.58f, 0.44f, 0.27f), SecondaryColor = new Color(0.30f, 0.22f, 0.13f),
                Cost = new ResourceCost(wood: 40, stone: 20), MaxHealth = 260, Armor = ArmorType.Wood, BuildTimeSeconds = 8f,
                WorkerSlots = 2, NeedsForest = true, Hotkey = 3,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Wood, OutputAmount = 6, CycleSeconds = 6f,
                    Job = JobType.Woodcutter, RequiresDepletableTile = true,
                    CyclesPerTileHarvest = 3, ScalesWithWorkers = true,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.ForestersHut, DisplayName = "Forester's Hut", Category = BuildingCategory.Economy,
                Description = "Plants saplings so your forest never runs dry. Essential for sustained timber.",
                Footprint = new Int2(2, 2), Height = 2.6f, Shape = BuildingShape.Hut,
                PrimaryColor = new Color(0.42f, 0.55f, 0.30f), SecondaryColor = new Color(0.26f, 0.32f, 0.18f),
                Cost = new ResourceCost(wood: 15), MaxHealth = 160, Armor = ArmorType.Wood, BuildTimeSeconds = 5f,
                WorkerSlots = 1, Hotkey = 4,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.None, OutputAmount = 0, CycleSeconds = 7f,
                    Job = JobType.Forester,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Quarry, DisplayName = "Quarry", Category = BuildingCategory.Economy,
                Description = "Cuts stone blocks from a rock deposit. Deposits are finite.",
                Footprint = new Int2(2, 2), Height = 2.4f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.66f, 0.66f, 0.68f), SecondaryColor = new Color(0.36f, 0.36f, 0.40f),
                Cost = new ResourceCost(wood: 25), MaxHealth = 240, Armor = ArmorType.Wood, BuildTimeSeconds = 6f,
                WorkerSlots = 2, NeedsRockDeposit = true, Hotkey = 5,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Stone, OutputAmount = 4, CycleSeconds = 7.5f,
                    Job = JobType.Quarryman, RequiresDepletableTile = true,
                    CyclesPerTileHarvest = 5, ScalesWithWorkers = true,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.IronMine, DisplayName = "Iron Mine", Category = BuildingCategory.Economy,
                Description = "Digs iron ore from a mountain face to arm your smiths.",
                Footprint = new Int2(2, 2), Height = 2.6f, Shape = BuildingShape.Hut,
                PrimaryColor = new Color(0.50f, 0.52f, 0.58f), SecondaryColor = new Color(0.26f, 0.27f, 0.32f),
                Cost = new ResourceCost(wood: 30, stone: 20), MaxHealth = 260, Armor = ArmorType.Wood, BuildTimeSeconds = 8f,
                WorkerSlots = 2, NeedsIronOre = true, Hotkey = 6,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Iron, OutputAmount = 3, CycleSeconds = 9f,
                    Job = JobType.IronMiner, RequiresDepletableTile = true,
                    CyclesPerTileHarvest = 8, ScalesWithWorkers = true,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Farm, DisplayName = "Farm", Category = BuildingCategory.Economy,
                Description = "Tills fertile soil for grain. Mills nearby increase the yield.",
                Footprint = new Int2(3, 3), Height = 0.7f, Shape = BuildingShape.Field,
                PrimaryColor = new Color(0.80f, 0.72f, 0.34f), SecondaryColor = new Color(0.52f, 0.44f, 0.18f),
                Cost = new ResourceCost(wood: 20), MaxHealth = 140, Armor = ArmorType.Wood, BuildTimeSeconds = 5f,
                WorkerSlots = 3, NeedsFertileSoil = true, ClearsVegetation = true, Hotkey = 7,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Food, OutputAmount = 5, CycleSeconds = 9f,
                    Job = JobType.Farmer, ScalesWithWorkers = true,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Mill, DisplayName = "Windmill", Category = BuildingCategory.Economy,
                Description = "Grinds grain and boosts nearby farms by 50%. Purely a support building.",
                Footprint = new Int2(2, 2), Height = 6.5f, Shape = BuildingShape.Windmill,
                PrimaryColor = new Color(0.86f, 0.84f, 0.76f), SecondaryColor = new Color(0.42f, 0.34f, 0.22f),
                Cost = new ResourceCost(wood: 30, stone: 20), MaxHealth = 200, Armor = ArmorType.Wood, BuildTimeSeconds = 9f,
                WorkerSlots = 1, PopularityAura = 1f, Hotkey = 8,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.None, CycleSeconds = 6f, Job = JobType.Miller,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Bakery, DisplayName = "Bakery", Category = BuildingCategory.Economy,
                Description = "Turns grain into bread: the same food feeds more mouths.",
                Footprint = new Int2(2, 2), Height = 2.8f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.78f, 0.62f, 0.36f), SecondaryColor = new Color(0.40f, 0.28f, 0.16f),
                Cost = new ResourceCost(wood: 30, stone: 15), MaxHealth = 200, Armor = ArmorType.Wood, BuildTimeSeconds = 7f,
                WorkerSlots = 2, PopularityAura = 1f,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Food, OutputAmount = 9, CycleSeconds = 8f,
                    InputA = ResourceType.Food, InputAAmount = 3, Job = JobType.Baker,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Brewery, DisplayName = "Brewery", Category = BuildingCategory.Economy,
                Description = "Brews ale. Inns turn that ale into popularity.",
                Footprint = new Int2(2, 2), Height = 3.0f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.70f, 0.55f, 0.28f), SecondaryColor = new Color(0.34f, 0.26f, 0.14f),
                Cost = new ResourceCost(wood: 35, stone: 10), MaxHealth = 200, Armor = ArmorType.Wood, BuildTimeSeconds = 8f,
                WorkerSlots = 2,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Ale, OutputAmount = 2, CycleSeconds = 12f,
                    InputA = ResourceType.Food, InputAAmount = 2, Job = JobType.Brewer,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Inn, DisplayName = "Inn", Category = BuildingCategory.Economy,
                Description = "A pail of ale and a song: +3 popularity per inn while ale lasts.",
                Footprint = new Int2(2, 2), Height = 3.4f, Shape = BuildingShape.Hut,
                PrimaryColor = new Color(0.68f, 0.48f, 0.30f), SecondaryColor = new Color(0.32f, 0.22f, 0.14f),
                Cost = new ResourceCost(wood: 40, stone: 10), MaxHealth = 220, Armor = ArmorType.Wood, BuildTimeSeconds = 8f,
                PopularityAura = Balance.Popularity.AleBonusPerInn, Hotkey = 9,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Blacksmith, DisplayName = "Blacksmith", Category = BuildingCategory.Economy,
                Description = "Forges iron into weapons for your barracks.",
                Footprint = new Int2(2, 2), Height = 3.0f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.44f, 0.44f, 0.48f), SecondaryColor = new Color(0.24f, 0.22f, 0.22f),
                Cost = new ResourceCost(wood: 30, stone: 20, iron: 5), MaxHealth = 220, Armor = ArmorType.Wood, BuildTimeSeconds = 9f,
                WorkerSlots = 2,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Weapons, OutputAmount = 1, CycleSeconds = 9f,
                    InputA = ResourceType.Iron, InputAAmount = 2, Job = JobType.Blacksmith,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Armoury, DisplayName = "Armoury", Category = BuildingCategory.Economy,
                Description = "Hammers out mail and plate for heavier troops.",
                Footprint = new Int2(2, 2), Height = 3.0f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.40f, 0.46f, 0.56f), SecondaryColor = new Color(0.22f, 0.24f, 0.30f),
                Cost = new ResourceCost(wood: 30, stone: 25, iron: 10), MaxHealth = 240, Armor = ArmorType.Wood, BuildTimeSeconds = 10f,
                WorkerSlots = 2,
                HasRecipe = true,
                Recipe = new ProductionRecipe
                {
                    Output = ResourceType.Armor, OutputAmount = 1, CycleSeconds = 11f,
                    InputA = ResourceType.Iron, InputAAmount = 3, Job = JobType.Armorer,
                },
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Well, DisplayName = "Well", Category = BuildingCategory.Economy,
                Description = "Fresh water: +1 popularity and a place for wounded to drink.",
                Footprint = new Int2(1, 1), Height = 1.6f, Shape = BuildingShape.Well,
                PrimaryColor = new Color(0.58f, 0.56f, 0.52f), SecondaryColor = new Color(0.34f, 0.30f, 0.26f),
                Cost = new ResourceCost(wood: 10, stone: 15), MaxHealth = 120, Armor = ArmorType.Stone, BuildTimeSeconds = 4f,
                PopularityAura = 1f, HealAura = 1.2f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.HealingTent, DisplayName = "Healer's Tent", Category = BuildingCategory.Economy,
                Description = "Dresses wounds. Nearby friendly units recover health over time.",
                Footprint = new Int2(2, 2), Height = 2.2f, Shape = BuildingShape.Tent,
                PrimaryColor = new Color(0.84f, 0.82f, 0.76f), SecondaryColor = new Color(0.62f, 0.28f, 0.26f),
                Cost = new ResourceCost(wood: 20, gold: 40), MaxHealth = 150, Armor = ArmorType.Wood, BuildTimeSeconds = 6f,
                HealAura = 2.6f, PopularityAura = 1f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.MarketPlace, DisplayName = "Market Place", Category = BuildingCategory.Economy,
                Description = "Traders buy your surplus and import what you lack for gold.",
                Footprint = new Int2(3, 3), Height = 1.0f, Shape = BuildingShape.Storage,
                PrimaryColor = new Color(0.74f, 0.66f, 0.44f), SecondaryColor = new Color(0.44f, 0.36f, 0.20f),
                Cost = new ResourceCost(wood: 40, stone: 20, gold: 30), MaxHealth = 260, Armor = ArmorType.Wood,
                BuildTimeSeconds = 8f, PopularityAura = 2f, IsStoragePoint = true,
                StorageBonus = new ResourceCost(food: 60, gold: 0),
            });

            // =========================== HOUSING ============================
            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Hovel, DisplayName = "Hovel", Category = BuildingCategory.Housing,
                Description = "Cramped housing for two peasants. Cheap and quick.",
                Footprint = new Int2(1, 1), Height = 1.7f, Shape = BuildingShape.Hut,
                PrimaryColor = new Color(0.66f, 0.58f, 0.42f), SecondaryColor = new Color(0.36f, 0.28f, 0.18f),
                Cost = new ResourceCost(wood: 8), MaxHealth = 100, Armor = ArmorType.Wood, BuildTimeSeconds = 3f,
                HousingCapacity = 2, Hotkey = 0,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.House, DisplayName = "House", Category = BuildingCategory.Housing,
                Description = "Solid housing for six. Keeps peasants loyal when times are hard.",
                Footprint = new Int2(2, 2), Height = 3.2f, Shape = BuildingShape.Hut,
                PrimaryColor = new Color(0.72f, 0.64f, 0.48f), SecondaryColor = new Color(0.40f, 0.30f, 0.20f),
                Cost = new ResourceCost(wood: 25, stone: 10), MaxHealth = 180, Armor = ArmorType.Wood, BuildTimeSeconds = 6f,
                HousingCapacity = 6, PopularityAura = 0.5f,
            });

            // =========================== MILITARY ============================
            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Barracks, DisplayName = "Barracks", Category = BuildingCategory.Military,
                Description = "Drafts idle peasants into spearmen and swordsmen. Costs gold, weapons and armour.",
                Footprint = new Int2(3, 3), Height = 4.2f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.56f, 0.46f, 0.36f), SecondaryColor = new Color(0.30f, 0.24f, 0.18f),
                Cost = new ResourceCost(wood: 60, stone: 40, gold: 30), MaxHealth = 420, Armor = ArmorType.Wood, BuildTimeSeconds = 14f,
                TrainsUnit = UnitId.Spearman, GarrisonSlots = 4, VisionRange = 9, Hotkey = 0,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.ArcheryRange, DisplayName = "Archery Range", Category = BuildingCategory.Military,
                Description = "Trains archers and crossbowmen. The cheapest way to man your walls.",
                Footprint = new Int2(3, 2), Height = 3.6f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.52f, 0.48f, 0.34f), SecondaryColor = new Color(0.28f, 0.26f, 0.18f),
                Cost = new ResourceCost(wood: 50, stone: 20, gold: 25), MaxHealth = 360, Armor = ArmorType.Wood, BuildTimeSeconds = 12f,
                TrainsUnit = UnitId.Archer, GarrisonSlots = 3, VisionRange = 10,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Stables, DisplayName = "Stables", Category = BuildingCategory.Military,
                Description = "Breeds warhorses: knights are the hammer to your walls' anvil.",
                Footprint = new Int2(3, 3), Height = 3.4f, Shape = BuildingShape.Ranch,
                PrimaryColor = new Color(0.62f, 0.50f, 0.34f), SecondaryColor = new Color(0.34f, 0.26f, 0.16f),
                Cost = new ResourceCost(wood: 70, stone: 40, gold: 60), MaxHealth = 420, Armor = ArmorType.Wood, BuildTimeSeconds = 15f,
                TrainsUnit = UnitId.Knight,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.EngineersGuild, DisplayName = "Engineer's Guild", Category = BuildingCategory.Military,
                Description = "Engineers repair your walls mid-battle and crew the boiling-oil pots.",
                Footprint = new Int2(3, 3), Height = 3.8f, Shape = BuildingShape.Block,
                PrimaryColor = new Color(0.46f, 0.42f, 0.40f), SecondaryColor = new Color(0.26f, 0.22f, 0.22f),
                Cost = new ResourceCost(wood: 60, stone: 60, iron: 20, gold: 50), MaxHealth = 400, Armor = ArmorType.Wood,
                BuildTimeSeconds = 16f, TrainsUnit = UnitId.Engineer, RepairRate = 26f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.WatchPost, DisplayName = "Watch Post", Category = BuildingCategory.Military,
                Description = "Cheap early warning. Reveals enemy movements at long range.",
                Footprint = new Int2(1, 1), Height = 4.4f, Shape = BuildingShape.TowerSquare,
                PrimaryColor = new Color(0.58f, 0.50f, 0.38f), SecondaryColor = new Color(0.32f, 0.26f, 0.18f),
                Cost = new ResourceCost(wood: 15), MaxHealth = 90, Armor = ArmorType.Wood, BuildTimeSeconds = 3f,
                GarrisonSlots = 1, VisionRange = 16, IsTower = true,
                DefenseRange = 6f, DefenseDamage = 4f, DefenseInterval = 2.2f,
            });

            // =========================== CASTLE ============================
            list.Add(new BuildingDefinition
            {
                Id = BuildingId.WoodenPalisade, DisplayName = "Palisade", Category = BuildingCategory.Castle,
                Description = "Cheap timber wall. Buys you the time to quarry real stone.",
                Footprint = new Int2(1, 1), Height = 3.2f, Shape = BuildingShape.Wall,
                PrimaryColor = new Color(0.58f, 0.44f, 0.28f), SecondaryColor = new Color(0.32f, 0.24f, 0.15f),
                Cost = new ResourceCost(wood: 12), MaxHealth = 150, Armor = ArmorType.Wood, BuildTimeSeconds = 2.5f,
                IsWall = true, GarrisonSlots = 1, ClearsVegetation = true,
                DefenseDamage = 0f, VisionRange = 5, Hotkey = 0,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.StoneWall, DisplayName = "Stone Wall", Category = BuildingCategory.Castle,
                Description = "Thick masonry. Archers on the parapet shoot 2.5 tiles further.",
                Footprint = new Int2(1, 1), Height = 3.6f, Shape = BuildingShape.Wall,
                PrimaryColor = new Color(0.68f, 0.67f, 0.64f), SecondaryColor = new Color(0.38f, 0.37f, 0.36f),
                Cost = new ResourceCost(stone: 14), MaxHealth = 420, Armor = ArmorType.Stone, BuildTimeSeconds = 4f,
                IsWall = true, GarrisonSlots = 1, ClearsVegetation = true, VisionRange = 6,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.WallStairs, DisplayName = "Wall Stairs", Category = BuildingCategory.Castle,
                Description = "Lets your troops mount the ramparts. Friendly units pass through freely.",
                Footprint = new Int2(1, 1), Height = 2.2f, Shape = BuildingShape.Wall,
                PrimaryColor = new Color(0.62f, 0.60f, 0.56f), SecondaryColor = new Color(0.34f, 0.33f, 0.32f),
                Cost = new ResourceCost(stone: 8), MaxHealth = 240, Armor = ArmorType.Stone, BuildTimeSeconds = 3f,
                IsWall = true, GarrisonSlots = 2, BlocksPath = true, VisionRange = 6,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.LookoutTower, DisplayName = "Lookout Tower", Category = BuildingCategory.Castle,
                Description = "Two archers, a commanding view and a very long reach.",
                Footprint = new Int2(1, 1), Height = 5.4f, Shape = BuildingShape.TowerSquare,
                PrimaryColor = new Color(0.66f, 0.64f, 0.60f), SecondaryColor = new Color(0.36f, 0.35f, 0.33f),
                Cost = new ResourceCost(wood: 15, stone: 20), MaxHealth = 320, Armor = ArmorType.Stone, BuildTimeSeconds = 6f,
                IsTower = true, GarrisonSlots = 2, VisionRange = 14,
                DefenseRange = 8f, DefenseDamage = 7f, DefenseInterval = 1.7f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.SquareTower, DisplayName = "Square Tower", Category = BuildingCategory.Castle,
                Description = "A solid masonry bastion. Four archers, heavy arrow loop fire.",
                Footprint = new Int2(2, 2), Height = 7.0f, Shape = BuildingShape.TowerSquare,
                PrimaryColor = new Color(0.70f, 0.68f, 0.63f), SecondaryColor = new Color(0.38f, 0.36f, 0.34f),
                Cost = new ResourceCost(stone: 45), MaxHealth = 620, Armor = ArmorType.Stone, BuildTimeSeconds = 10f,
                IsTower = true, GarrisonSlots = 4, VisionRange = 16,
                DefenseRange = 8.5f, DefenseDamage = 10f, DefenseInterval = 1.6f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.RoundTower, DisplayName = "Round Tower", Category = BuildingCategory.Castle,
                Description = "Engineered curves deflect siege shot. The strongest tower you can raise.",
                Footprint = new Int2(2, 2), Height = 7.6f, Shape = BuildingShape.TowerRound,
                PrimaryColor = new Color(0.73f, 0.71f, 0.66f), SecondaryColor = new Color(0.40f, 0.38f, 0.35f),
                Cost = new ResourceCost(stone: 70, iron: 10), MaxHealth = 820, Armor = ArmorType.Stone, BuildTimeSeconds = 14f,
                IsTower = true, GarrisonSlots = 5, VisionRange = 17,
                DefenseRange = 9.5f, DefenseDamage = 13f, DefenseInterval = 1.5f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Gatehouse, DisplayName = "Gatehouse", Category = BuildingCategory.Castle,
                Description = "Your gate and killing ground in one. Close it in a siege, open it for trade.",
                Footprint = new Int2(2, 1), Height = 6.2f, Shape = BuildingShape.Gate,
                PrimaryColor = new Color(0.69f, 0.67f, 0.62f), SecondaryColor = new Color(0.36f, 0.28f, 0.18f),
                Cost = new ResourceCost(stone: 50, wood: 20, iron: 5), MaxHealth = 900, Armor = ArmorType.Stone, BuildTimeSeconds = 12f,
                IsGate = true, GarrisonSlots = 3, VisionRange = 12,
                DefenseRange = 7.5f, DefenseDamage = 8f, DefenseInterval = 1.8f,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Moat, DisplayName = "Moat", Category = BuildingCategory.Castle,
                Description = "A flooded ditch. Enemies must fill it or go around; you build a drawbridge over it.",
                Footprint = new Int2(1, 1), Height = 0.4f, Shape = BuildingShape.Pit,
                PrimaryColor = new Color(0.24f, 0.34f, 0.40f), SecondaryColor = new Color(0.16f, 0.22f, 0.26f),
                Cost = new ResourceCost(gold: 2), MaxHealth = 60, Armor = ArmorType.None, BuildTimeSeconds = 1.5f,
                BlocksPath = true, ClearsVegetation = true, VisionRange = 3,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Drawbridge, DisplayName = "Drawbridge", Category = BuildingCategory.Castle,
                Description = "The only way for troops to cross your moat. Raise it and watch the siege stall.",
                Footprint = new Int2(1, 1), Height = 0.3f, Shape = BuildingShape.Pit,
                PrimaryColor = new Color(0.46f, 0.34f, 0.20f), SecondaryColor = new Color(0.24f, 0.18f, 0.10f),
                Cost = new ResourceCost(wood: 15, iron: 5), MaxHealth = 200, Armor = ArmorType.Wood, BuildTimeSeconds = 3f,
                IsGate = true, BlocksPath = false, VisionRange = 5,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.Keep, DisplayName = "Keep", Category = BuildingCategory.Castle,
                Description = "Your lord's seat and the heart of the castle. If the keep falls, you fall.",
                Footprint = new Int2(4, 4), Height = 11f, Shape = BuildingShape.Keep,
                PrimaryColor = new Color(0.71f, 0.69f, 0.64f), SecondaryColor = new Color(0.40f, 0.36f, 0.32f),
                Cost = new ResourceCost(stone: 90, wood: 40, iron: 10), MaxHealth = 1600, Armor = ArmorType.Stone, BuildTimeSeconds = 25f,
                IsKeep = true, GarrisonSlots = 8, VisionRange = 20,
                DefenseRange = 9f, DefenseDamage = 14f, DefenseInterval = 1.4f,
                PopularityAura = 4f,
            });

            // ======================= ENEMY CAMP (AI) =======================
            list.Add(new BuildingDefinition
            {
                Id = BuildingId.EnemyTent, DisplayName = "Raider Tent", Category = BuildingCategory.Military,
                Description = "Enemy muster point. Destroy the camp to break the siege.",
                Footprint = new Int2(2, 2), Height = 2.6f, Shape = BuildingShape.Tent,
                PrimaryColor = new Color(0.34f, 0.24f, 0.26f), SecondaryColor = new Color(0.20f, 0.14f, 0.16f),
                Cost = ResourceCost.Zero, MaxHealth = 300, Armor = ArmorType.Wood, BuildTimeSeconds = 0f,
                VisionRange = 8,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.SiegeCamp, DisplayName = "Siege Camp", Category = BuildingCategory.Military,
                Description = "Where the rams and catapults are assembled.",
                Footprint = new Int2(3, 3), Height = 3.2f, Shape = BuildingShape.Tent,
                PrimaryColor = new Color(0.30f, 0.22f, 0.24f), SecondaryColor = new Color(0.18f, 0.13f, 0.15f),
                Cost = ResourceCost.Zero, MaxHealth = 600, Armor = ArmorType.Wood, BuildTimeSeconds = 0f,
                VisionRange = 10,
            });

            list.Add(new BuildingDefinition
            {
                Id = BuildingId.EnemyBanner, DisplayName = "War Banner", Category = BuildingCategory.Military,
                Description = "Rally point for the horde. Tearing it down breaks their morale.",
                Footprint = new Int2(1, 1), Height = 5.0f, Shape = BuildingShape.TowerSquare,
                PrimaryColor = new Color(0.42f, 0.20f, 0.22f), SecondaryColor = new Color(0.22f, 0.12f, 0.13f),
                Cost = ResourceCost.Zero, MaxHealth = 120, Armor = ArmorType.Wood, BuildTimeSeconds = 0f,
                VisionRange = 12,
            });

            list.Add(new BuildingDefinition { Id = BuildingId.None, DisplayName = "None" });

            _all = list.ToArray();
            _byId = new Dictionary<BuildingId, BuildingDefinition>(_all.Length);
            for (int i = 0; i < _all.Length; i++) _byId[_all[i].Id] = _all[i];

            // Menu order: the classic build wheel layout.
            AddOrdered(_playerBuildable, BuildingId.WoodenPalisade);
            AddOrdered(_playerBuildable, BuildingId.StoneWall);
            AddOrdered(_playerBuildable, BuildingId.WallStairs);
            AddOrdered(_playerBuildable, BuildingId.Gatehouse);
            AddOrdered(_playerBuildable, BuildingId.LookoutTower);
            AddOrdered(_playerBuildable, BuildingId.SquareTower);
            AddOrdered(_playerBuildable, BuildingId.RoundTower);
            AddOrdered(_playerBuildable, BuildingId.Moat);
            AddOrdered(_playerBuildable, BuildingId.Drawbridge);
            AddOrdered(_playerBuildable, BuildingId.Keep);
            AddOrdered(_playerBuildable, BuildingId.WoodcutterHut);
            AddOrdered(_playerBuildable, BuildingId.Sawmill);
            AddOrdered(_playerBuildable, BuildingId.ForestersHut);
            AddOrdered(_playerBuildable, BuildingId.Quarry);
            AddOrdered(_playerBuildable, BuildingId.IronMine);
            AddOrdered(_playerBuildable, BuildingId.Farm);
            AddOrdered(_playerBuildable, BuildingId.Mill);
            AddOrdered(_playerBuildable, BuildingId.Bakery);
            AddOrdered(_playerBuildable, BuildingId.Brewery);
            AddOrdered(_playerBuildable, BuildingId.Inn);
            AddOrdered(_playerBuildable, BuildingId.Blacksmith);
            AddOrdered(_playerBuildable, BuildingId.Armoury);
            AddOrdered(_playerBuildable, BuildingId.Stockpile);
            AddOrdered(_playerBuildable, BuildingId.Granary);
            AddOrdered(_playerBuildable, BuildingId.MarketPlace);
            AddOrdered(_playerBuildable, BuildingId.Well);
            AddOrdered(_playerBuildable, BuildingId.HealingTent);
            AddOrdered(_playerBuildable, BuildingId.Barracks);
            AddOrdered(_playerBuildable, BuildingId.ArcheryRange);
            AddOrdered(_playerBuildable, BuildingId.Stables);
            AddOrdered(_playerBuildable, BuildingId.EngineersGuild);
            AddOrdered(_playerBuildable, BuildingId.WatchPost);
            AddOrdered(_playerBuildable, BuildingId.Hovel);
            AddOrdered(_playerBuildable, BuildingId.House);
        }

        static void AddOrdered(List<BuildingDefinition> target, BuildingId id)
        {
            var def = _byId[id];
            if (def != null && def.Id != BuildingId.None) target.Add(def);
        }
    }
}
