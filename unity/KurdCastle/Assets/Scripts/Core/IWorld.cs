// -----------------------------------------------------------------------------
//  File: Core/IWorld.cs
//  Purpose: The contract every simulation system programs against. Systems take
//           IWorld instead of the concrete GameWorld, which keeps them
//           unit-testable (tests supply a headless world) and stops systems from
//           reaching into each other's guts.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.World;
using KurdCastle.Economy;
using KurdCastle.Population;
using KurdCastle.Construction;
using KurdCastle.Combat;
using KurdCastle.AI;

namespace KurdCastle.Core
{
    public interface IWorld
    {
        // --- map & terrain ------------------------------------------------
        MapGrid Grid { get; }
        TerrainMap Terrain { get; }

        // --- navigation ----------------------------------------------------
        PathfindingService Pathfinding { get; }
        FlowFieldService FlowFields { get; }

        // --- entities ------------------------------------------------------
        BuildingRegistry Buildings { get; }
        UnitRegistry Units { get; }

        // --- economy & population -----------------------------------------
        ResourceLedger Resources { get; }
        PopulationSystem Population { get; }
        EconomySystem Economy { get; }

        // --- construction ---------------------------------------------------
        ConstructionSystem Construction { get; }

        // --- military --------------------------------------------------------
        CombatSystem Combat { get; }
        ProjectileSystem Projectiles { get; }
        WaveDirector Waves { get; }
        EnemyCommander Commander { get; }

        // --- services --------------------------------------------------------
        GameStateManager State { get; }
        SimulationClock Clock { get; }
        DeterministicRandom Rng { get; }
        KingdomStats PlayerKingdom { get; }
        KingdomStats EnemyKingdom { get; }

        /// <summary>The cell that must be defended to win (player keep).</summary>
        Vector2Int KeepCell { get; }
        /// <summary>Enemy staging area centre (edge of the map).</summary>
        Vector2Int EnemyCampCell { get; }
        /// <summary>Cells-per-second conversion helper: 1 world unit == 1 cell.</summary>
        float DeltaTime { get; }
    }

    /// <summary>Aggregated per-kingdom economy + military state.</summary>
    public sealed class KingdomStats
    {
        public Team Team;

        // resources are stored in the ledger; these are the cached headline numbers
        public int Peasants;
        public int Military;
        public int Housing;
        public int HousingUsed;
        public float Popularity = Balance.Population.PopularityStart;
        public float FoodRatePerMinute;
        public float GoldRatePerMinute;
        public int BuildingsOwned;
        public int UnitsLost;
        public int UnitsKilled;
        public int BuildingsLost;
        public bool KeepAlive = true;
        public bool IsUnderAttack;
        public float TimeSinceAttacked = 999f;

        // ---- policy levers ----
        public RationPolicy Rations = RationPolicy.Full;
        public TaxPolicy Taxes = TaxPolicy.Normal;
        /// <summary>Player toggle: allow the market to auto-import food when starving.</summary>
        public bool AutoBuyFood = true;
        public bool AutoRecruitHousing = true;

        public float HousingFree { get { return Housing - HousingUsed; } }
        public float TotalPopulation { get { return Peasants + Military; } }
        public float FoodLeftMinutes
        {
            get
            {
                float per = FoodRatePerMinute / 60f;
                if (per >= -0.0001f) return 999f;
                return -1f; // computed by EconomySystem against real stocks
            }
        }
    }
}
