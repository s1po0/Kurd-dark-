// -----------------------------------------------------------------------------
//  File: Config/Balance.cs
//  Purpose: Every tunable number in the prototype lives here. Designers can edit
//           one file to re-balance the whole game; the runtime never hard-codes
//           magic numbers (a rule enforced by code review + tests).
// -----------------------------------------------------------------------------
using UnityEngine;

namespace KurdCastle.Config
{
    public static class Balance
    {
        public const string GameName = "Kurd Castle";
        public const string Version = "0.9.0-prototype";

        /// <summary>Config bundled with every simulation system so one asset edit re-tunes all.</summary>
        public static class Sim
        {
            /// <summary>Logic updates per second. Render runs at device frame rate.</summary>
            public const int TickRate = 10;
            public const float TickDelta = 1f / TickRate;
            /// <summary>Max logic ticks consumed in one frame (spiral-of-death guard).</summary>
            public const int MaxCatchUpTicks = 4;
            /// <summary>Units interpolate their transform between ticks for smooth motion.</summary>
            public const float InterpolationSmoothing = 14f;
            /// <summary>Enemy AI commander re-evaluates its battle plan this often (seconds).</summary>
            public const float CommanderThinkInterval = 2.5f;
            /// <summary>Economy (popularity / taxes / rations) settle interval.</summary>
            public const float EconomyIntervalSeconds = 5f;
        }

        public static class Map
        {
            public const int DefaultWidth = 96;
            public const int DefaultHeight = 96;
            /// <summary>Playable terrain margin (cells) reserved for the enemy camp.</summary>
            public const int EnemyCampDepth = 12;
            public const int StartingForestBlobs = 26;
            public const int StartingRockBlobs = 14;
            public const int TreeDensityPerBlob = 14;
        }

        public static class Economy
        {
            public static readonly ResourceCost StartingResources =
                new ResourceCost(wood: 260, stone: 160, iron: 40, gold: 220, food: 180);

            /// <summary>Stockpile capacity before storage buildings are added.</summary>
            public const int BaseStorageWood = 400;
            public const int BaseStorageStone = 300;
            public const int BaseStorageIron = 150;
            public const int BaseStorageFood = 250;
            public const int BaseStorageWeapons = 60;
            public const int BaseStorageArmor = 60;
            public const int BaseStorageAle = 80;
            public const int GoldCap = 99999;

            public const float SecondsPerEconomyCycleTick = 5f;
            /// <summary>How much one peasant can carry in a single hauling trip.</summary>
            public const int CarryCapacity = 12;
            /// <summary>Returned resources when razing your own building.</summary>
            public const float SalvageRatio = 0.35f;
            /// <summary>Stone/Iron repair cost per health point restored.</summary>
            public const float RepairCostPerHp = 0.12f;
            public const float RepairHpPerSecond = 14f;
        }

        public static class Population
        {
            public const int StartingPeasants = 14;
            public const int BaseHousing = 8;
            public const int MaxPopulation = 220;
            /// <summary>Seconds between peasant arrivals at 100% popularity vs 0%.</summary>
            public const float MinSpawnInterval = 4f;
            public const float MaxSpawnInterval = 40f;
            /// <summary>Popularity below this loses a peasant every N seconds.</summary>
            public const float BoredomThreshold = 40f;
            public const float PeasantLeavesAbove = 30f;
            public const float MaxPeasantHealth = 40;
            public const float WorkerMoveSpeed = 3.1f;
            /// <summary>Food eaten by one peasant every minute.</summary>
            public const float FoodPerPeasantPerMinute = 1.2f;
            public const float TaxGoldPerPeasantPerMinute = 0.05f;
            /// <summary>Popularity is clamped to this band (Stronghold uses -10..+100).</summary>
            public const float PopularityMin = -10f;
            public const float PopularityMax = 100f;
            public const float PopularityStart = 65f;
        }

        public static class Popularity
        {
            public const float FoodNone = -8f;
            public const float FoodHalf = -4f;
            public const float FoodFull = 0f;
            public const float FoodExtra = 5f;

            public const float TaxGenerous = -6f;
            public const float TaxLow = -2f;
            public const float TaxNormal = 0f;
            public const float TaxHigh = -4f;
            public const float TaxBrutal = -9f;

            public const float AleBonusPerInn = 3f;
            public const float AleBonusMax = 12f;
            public const float ChurchBonus = 4f;
            /// <summary>Popularity per housing slot shortfall when overcrowded.</summary>
            public const float OvercrowdPenalty = 2.5f;
            /// <summary>Bonus for having spare housing encourages growth.</summary>
            public const float SpareHousingBonus = 1.5f;
            /// <summary>Fear: enemies near the keep reduce happiness.</summary>
            public const float FearPerEnemyNearKeep = 0.6f;
            public const float FearMax = 25f;
            /// <summary>Attack-impact shock while the keep is being hit.</summary>
            public const float KeepUnderAttackPenalty = 6f;
        }

        public static class Combat
        {
            /// <summary>Global melee/building damage scalars.</summary>
            public const float MeleeScale = 1f;
            public const float RangedScale = 1f;
            public const float GlobalHealthScale = 1f;
            public const float GlobalDamageScale = 1f;
            /// <summary>Ranged units lose this fraction of accuracy per cell past 40% of range.</summary>
            public const float AccuracyFalloffStart = 0.4f;
            public const float AccuracyFalloffMax = 0.55f;
            /// <summary>Arrows and boulders arc; this is the apex height scale per cell of range.</summary>
            public const float ProjectileArcHeightPerCell = 0.16f;
            public const float ProjectileGravity = 26f;
            public const float MinimumHitChance = 0.08f;
            /// <summary>Units flee below this fraction of max health (peasants only).</summary>
            public const float WorkerFleeHealthPct = 0.55f;
            /// <summary>Bonus damage when attacking a unit from outside its facing cone.</summary>
            public const float RearAttackBonus = 1.35f;
            /// <summary>Units regenerate out of combat inside friendly walls.</summary>
            public const float GarrisonHealPerSecond = 2.5f;
            /// <summary>Automated tower fire interval.</summary>
            public const float TowerFireInterval = 1.8f;
            public const float TowerRange = 8.5f;
            public const float TowerDamage = 9f;
            /// <summary>How far from the wall a garrisoned archer can shoot.</summary>
            public const float WallArcherRangeBonus = 2.5f;
        }

        public static class Pathfinding
        {
            /// <summary>Milliseconds of the main thread we may spend pathing per frame.</summary>
            public const float FrameBudgetMs = 1.6f;
            public const int MaxRequestsPerTick = 48;
            public const int MaxExpandedNodesPerRequest = 12000;
            /// <summary>Re-path throttle for idle workers (seconds).</summary>
            public const float WorkerRepathCooldown = 1.5f;
            public const float FlowFieldRefreshInterval = 0.75f;
            /// <summary>Distance at which a unit considers a waypoint reached.</summary>
            public const float WaypointTolerance = 0.22f;
        }

        public static class Camera
        {
            public const float OrthoMin = 7f;
            public const float OrthoMax = 46f;
            public const float OrthoDefault = 18f;
            public const float PitchMin = 30f;
            public const float PitchMax = 68f;
            public const float PitchDefault = 48f;
            public const float YawDefault = 45f;
            /// <summary>Cells-per-second of one-finger pan at default zoom.</summary>
            public const float PanSpeedBase = 26f;
            public const float PanFriction = 12f;
            public const float PanInertiaDamping = 6f;
            public const float ZoomLerp = 10f;
            public const float RotateSensitivity = 0.22f;
            public const float EdgeDragMarginPixels = 42f;
            public const float EdgeDragSpeed = 22f;
            public const float FocusLerp = 6f;
            public const float DoubleTapZoomDelta = 6f;
            /// <summary>Camera height above terrain plane.</summary>
            public const float CameraHeight = 42f;
        }

        public static class Performance
        {
            public const int TargetFrameRate = 60;
            public const int MaxLiveUnits = 300;
            public const int MaxProjectiles = 400;
            public const int UnitViewPoolPrewarm = 120;
            public const int ProjectilePoolPrewarm = 200;
            public const int DamageNumberPoolPrewarm = 32;
            /// <summary>Unit bodies beyond this camera distance stop being rendered.</summary>
            public const float UnitViewCullDistance = 55f;
            public const float HealthBarMaxDistance = 34f;
            public const float AmbientUnitAnimationDistance = 30f;
            public const bool UseGpuInstancingForWalls = true;
            public const int InstanceBatchSize = 1023;
            /// <summary>Adaptive quality: drop below this FPS and we start thinning effects.</summary>
            public const float AdaptiveQualityLowFps = 48f;
            public const float AdaptiveQualityHighFps = 58f;
            public const float AdaptiveCheckInterval = 3f;
        }

        public static class Progression
        {
            /// <summary>Waves to survive before the player is declared victorious.</summary>
            public const int TotalWaves = 6;
            /// <summary>Skirmish timer: seconds between waves before the table takes over.</summary>
            public const float DefaultWaveInterval = 95f;
            public const float FirstWaveDelay = 75f;
            /// <summary>Gold awarded for surviving a wave (military industry budget).</summary>
            public const int WaveSurvivalGold = 40;
            /// <summary>Player wins early if the enemy camp structure count reaches zero.</summary>
            public const bool AllowCounterAttackVictory = true;
        }

        public static class Ai
        {
            /// <summary>Enemy units within this many cells of a friendly building go hostile.</summary>
            public const float AggroRadius = 13f;
            public const float SiegeWeaponAggroRadius = 16f;
            public const float RepathInterval = 1.2f;
            public const float AttackBuildingInterval = 1.1f;
            public const float BreachSearchRadius = 14f;
            /// <summary>Ranged attackers hold this fraction of their max range from towers.</summary>
            public const float RangedStandoffFactor = 0.85f;
            public const float FleeThresholdPct = 0.18f;
            /// <summary>Seconds the AI waits at the map edge between wave spawns.</summary>
            public const float SpawnSpreadSeconds = 1.2f;
        }

        public static class Ui
        {
            public const int UiLayer = 5;
            public const int WorldLayer = 0;
            public const float ToastDuration = 3.2f;
            public const float DoubleTapWindow = 0.28f;
            public const float LongPressDuration = 0.45f;
            public const float TapMaxMovementPixels = 18f;
            public const float DragThresholdPixels = 14f;
            /// <summary>Minimum touch target size in dp (Google Play accessibility guidance).</summary>
            public const float MinimumTouchTargetDp = 48f;
            public static readonly Color PanelColor = new Color(0.10f, 0.09f, 0.08f, 0.88f);
            public static readonly Color PanelAccent = new Color(0.32f, 0.24f, 0.14f, 1f);
            public static readonly Color TextColor = new Color(0.94f, 0.92f, 0.86f, 1f);
            public static readonly Color ValidColor = new Color(0.30f, 0.95f, 0.38f, 0.55f);
            public static readonly Color InvalidColor = new Color(0.95f, 0.25f, 0.20f, 0.55f);
        }
    }
}
