// -----------------------------------------------------------------------------
//  File: Config/BuildingDefinition.cs
//  Purpose: Data model for every constructible structure. Pure C# (no
//           ScriptableObject) so the prototype boots with zero binary assets and
//           stays unit-testable; a designer-facing SO wrapper can be layered on
//           top later without touching the systems.
// -----------------------------------------------------------------------------
using System;
using UnityEngine;

namespace KurdCastle.Config
{
    /// <summary>One step of a building's production recipe.</summary>
    [Serializable]
    public struct ProductionRecipe
    {
        /// <summary>What the worker produces.</summary>
        public ResourceType Output;
        public int OutputAmount;
        /// <summary>Consumed inputs per cycle (empty for gatherers).</summary>
        public ResourceType InputA;
        public int InputAAmount;
        public ResourceType InputB;
        public int InputBAmount;
        /// <summary>Real seconds per production cycle at full staffing.</summary>
        public float CycleSeconds;
        /// <summary>Jobs this building offers (one slot per worker).</summary>
        public JobType Job;
        /// <summary>Requires standing on a depletable resource tile (forest / rock / ore).</summary>
        public bool RequiresDepletableTile;
        /// <summary>Harvested tile is consumed and downgraded after this many cycles.</summary>
        public int CyclesPerTileHarvest;
        /// <summary>Building produces faster with more workers (linear) when true.</summary>
        public bool ScalesWithWorkers;
    }

    /// <summary>Static description of a building type.</summary>
    public sealed class BuildingDefinition
    {
        // ---- identity -----------------------------------------------------
        public BuildingId Id;
        public string DisplayName = "Building";
        public string Description = "";
        public BuildingCategory Category = BuildingCategory.Economy;
        /// <summary>0 = no shortcut. Shown in the build wheel badge.</summary>
        public int Hotkey = 0;

        // ---- footprint & visuals ------------------------------------------
        public Int2 Footprint = new Int2(1, 1);
        public float Height = 2f;
        /// <summary>Procedurally drawn body colour.</summary>
        public Color PrimaryColor = new Color(0.62f, 0.55f, 0.42f);
        public Color SecondaryColor = new Color(0.36f, 0.28f, 0.20f);
        /// <summary>Silhouette archetype for the mesh builder.</summary>
        public BuildingShape Shape = BuildingShape.Block;

        // ---- economy -------------------------------------------------------
        public ResourceCost Cost = ResourceCost.Zero;
        public int MaxHealth = 200;
        public ArmorType Armor = ArmorType.Wood;
        public int WorkerSlots = 0;
        public float BuildTimeSeconds = 6f;
        public bool HasRecipe = false;
        public ProductionRecipe Recipe;
        /// <summary>True when this building accepts deliveries (stockpile / granary).</summary>
        public bool IsStoragePoint = false;
        /// <summary>Extra stockpile capacity granted while alive.</summary>
        public ResourceCost StorageBonus = ResourceCost.Zero;
        public int HousingCapacity = 0;
        /// <summary>Passive popularity contribution (inns, churches, gardens).</summary>
        public float PopularityAura = 0f;
        /// <summary>Restores health of nearby friendly buildings/units per tick.</summary>
        public float HealAura = 0f;

        // ---- military ------------------------------------------------------
        public bool IsWall = false;
        public bool IsGate = false;
        public bool IsTower = false;
        public bool IsKeep = false;
        public UnitId TrainsUnit = UnitId.None;
        public int GarrisonSlots = 0;
        /// <summary>Automated defensive fire (towers, gatehouse, keep).</summary>
        public float DefenseRange = 0f;
        public float DefenseDamage = 0f;
        public float DefenseInterval = 1.8f;
        /// <summary>Bastions block enemy pathing (walls, towers, gates when shut, keep).</summary>
        public bool BlocksPath = true;
        /// <summary>Provides vision to the fog-of-war / threat map.</summary>
        public int VisionRange = 8;

        // ---- placement rules ------------------------------------------------
        public bool NeedsFlatGround = false;
        public bool NeedsForest = false;
        public bool NeedsRockDeposit = false;
        public bool NeedsIronOre = false;
        public bool NeedsFertileSoil = false;
        public bool NeedsWaterAdjacent = false;
        public bool MustTouchOwnTerritory = true;
        public bool AllowOnWall = false;
        /// <summary>Walls/towers may be placed directly over trees (auto-cleared).</summary>
        public bool ClearsVegetation = false;

        // ---- misc ------------------------------------------------------------
        public float RepairRate = Balance.Economy.RepairHpPerSecond;
        /// <summary>Rubble remains after destruction and blocks building until cleared.</summary>
        public bool LeavesRubble = true;
        public float RuinClearSeconds = 12f;

        public bool CanBeBuiltByPlayer { get { return Id != BuildingId.None; } }

        public float CostValue { get { return Cost.Wood * 1f + Cost.Stone * 1.4f + Cost.Iron * 2.2f + Cost.Gold * 1.6f; } }

        public override string ToString() { return Id + "(" + DisplayName + ")"; }
    }

    /// <summary>Every constructible structure in the prototype.</summary>
    public enum BuildingId : byte
    {
        None = 0,

        // --- Castle / fortification ---
        WoodenPalisade = 10,
        StoneWall = 11,
        WallStairs = 12,
        LookoutTower = 13,
        SquareTower = 14,
        RoundTower = 15,
        Gatehouse = 16,
        Keep = 17,
        Moat = 18,
        Drawbridge = 19,

        // --- Economy ---
        Stockpile = 30,
        Granary = 31,
        WoodcutterHut = 32,
        Sawmill = 33,
        ForestersHut = 34,
        Quarry = 35,
        IronMine = 36,
        OxTether = 37,
        Farm = 38,
        Mill = 39,
        Bakery = 40,
        Brewery = 41,
        Inn = 42,
        Blacksmith = 43,
        Armoury = 44,
        Hovel = 45,
        House = 46,
        Well = 47,
        HealingTent = 48,
        MarketPlace = 49,

        // --- Military ---
        Barracks = 60,
        ArcheryRange = 61,
        EngineersGuild = 62,
        Stables = 63,
        WatchPost = 64,

        // --- Enemy camp / siege (AI-owned, not player-buildable) ---
        EnemyTent = 80,
        SiegeCamp = 81,
        EnemyBanner = 82,
    }

    /// <summary>Silhouette archetypes consumed by ProceduralMeshLibrary.</summary>
    public enum BuildingShape : byte
    {
        Block = 0,
        Wall = 1,
        TowerRound = 2,
        TowerSquare = 3,
        Gate = 4,
        Keep = 5,
        Hut = 6,
        Tent = 7,
        Field = 8,
        Pit = 9,
        Windmill = 10,
        Storage = 11,
        Well = 12,
        Ranch = 13,
    }
}
