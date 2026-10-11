// -----------------------------------------------------------------------------
//  Kurd Castle - Isometric Castle Building & RTS
//  File: Config/Enums.cs
//  Purpose: Shared enums. Kept in one file so the data model has a single,
//           greppable definition point for every domain vocabulary term.
// -----------------------------------------------------------------------------
namespace KurdCastle.Config
{
    /// <summary>Team / faction identifier. Also used for pathfinding pass-through rules.</summary>
    public enum Team : byte
    {
        Neutral = 0,
        Player = 1,
        Enemy = 2,
    }

    /// <summary>Stronghold-style economy resources + two military goods.</summary>
    public enum ResourceType : byte
    {
        None = 0,
        Wood = 1,
        Stone = 2,
        Iron = 3,
        Gold = 4,
        Food = 5,
        Weapons = 6,
        Armor = 7,
        Ale = 8,
    }

    /// <summary>Build-menu grouping. Drives which wheel page an item appears on.</summary>
    public enum BuildingCategory : byte
    {
        Castle = 0,   // walls, towers, gatehouse, keep
        Economy = 1,  // sawmill, quarry, farm, granary, mine...
        Military = 2, // barracks, archery range, armoury
        Housing = 3,  // hovel, house, inn
    }

    /// <summary>Damage classes used by the armour/damage resolution matrix.</summary>
    public enum DamageType : byte
    {
        Slash = 0,   // swords, rams (vs organic)
        Pierce = 1,  // arrows, spears
        Blunt = 2,   // maces, catapult boulders
        Fire = 3,    // pitch, burning oil
        Siege = 4,   // battering ram, trebuchet: massive vs structures
    }

    /// <summary>Armour classes of a target.</summary>
    public enum ArmorType : byte
    {
        None = 0,    // peasants
        Leather = 1, // archers
        Mail = 2,    // spearmen
        Plate = 3,   // swordsmen / knights
        Wood = 4,    // palisade, wooden buildings
        Stone = 5,   // stone walls, towers, gatehouse, keep
    }

    /// <summary>What a unit is currently doing. Drives the unit FSM.</summary>
    public enum UnitState : byte
    {
        Spawning = 0,
        Idle = 1,
        Moving = 2,
        Working = 3,     // producing at a job site
        Hauling = 4,     // carrying goods to the stockpile
        BuildHandling = 5,
        Guard = 6,       // hold position, auto-engage in vision
        AttackMove = 7,  // move but engage anything met on the way
        Engage = 8,      // actively fighting
        Scaling = 9,     // climbing a wall via ladder
        Fleeing = 10,
        Garrisoned = 11,
        Repairing = 12,
        Dead = 13,
    }

    /// <summary>Economy job titles (a worker unit's profession).</summary>
    public enum JobType : byte
    {
        None = 0,
        Idle = 1,
        Builder = 2,
        Hauler = 3,
        Woodcutter = 4,
        Forester = 5,
        Quarryman = 6,
        IronMiner = 7,
        Farmer = 8,
        Miller = 9,
        Baker = 10,
        Brewer = 11,
        Blacksmith = 12,
        Armorer = 13,
        Herbalist = 15,
        Miller2 = 16,
        StoneMason = 17,
    }

    /// <summary>Terrain classification of a map cell.</summary>
    public enum TerrainType : byte
    {
        Grass = 0,
        RoughGrass = 1,
        Dirt = 2,
        Sand = 3,
        Water = 4,
        Rock = 5,
        IronOre = 6,
        FertileSoil = 7,
    }

    /// <summary>Visual archetype used by the procedural mesh builder.</summary>
    public enum UnitShape : byte
    {
        Peasant = 0,
        Archer = 1,
        Spearman = 2,
        Swordsman = 3,
        Knight = 4,
        Ram = 5,
        Catapult = 6,
        Ladder = 7,
        SiegeTower = 8,
        Lord = 9,
    }

    /// <summary>Player-selectable game speed multiplier.</summary>
    public enum GameSpeed : byte
    {
        Paused = 0,
        Normal = 1,
        Fast = 2,
        VeryFast = 3,
    }

    /// <summary>Food ration policy. Stronghold's central popularity lever.</summary>
    public enum RationPolicy : byte
    {
        None = 0,     // -8 popularity, no food consumed
        Half = 1,     // -4, half rate
        Full = 2,     // 0, standard rate
        Extra = 3,    // +4, double rate
    }

    /// <summary>Tax policy. Trades gold income against popularity.</summary>
    public enum TaxPolicy : byte
    {
        Generous = 0,  // -6 popularity, negative gold
        Low = 1,       // -2 popularity, +1 gold / cycle
        Normal = 2,    // 0 / 0
        High = 3,      // -4 popularity, +3 gold
        Brutal = 4,    // -8 popularity, +6 gold
    }

    /// <summary>Result of validating a build placement.</summary>
    public enum PlacementError : byte
    {
        Ok = 0,
        OutOfBounds,
        Occupied,
        TerrainUnsuitable,
        SlopeTooSteep,
        NeedsForest,
        NeedsRock,
        NeedsIronOre,
        NeedsFertile,
        NeedsWaterAdjacent,
        MustTouchTerritory,
        CannotAfford,
        BlockedByUnit,
        TooCloseToKeep,
        Unknown,
    }
}
