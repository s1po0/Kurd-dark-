// -----------------------------------------------------------------------------
//  File: Core/GameWorld.cs
//  Purpose: The composition root. Creates every system in dependency order, owns
//           them, and defines the single authoritative tick order:
//
//    pathfinding service (frame budget)
//      → construction (sites, repair, rubble)
//        → economy (production, consumption)
//          → population (popularity, arrivals/departures)
//            → worker jobs (staffing, hauling)
//              → units (movement + FSM)
//                → combat (targeting, melee, towers)
//                  → projectiles
//                    → enemy AI (commander + wave director)
//                      → objective checks (victory / defeat)
//
//  Nothing else in the codebase is allowed to invent a tick order.
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
    public sealed class GameWorld : IWorld
    {
        // ---- simulation services ----
        public TerrainMap Terrain { get; private set; }
        public MapGrid Grid { get; private set; }
        public NavigationGrid Navigation { get; private set; }
        public AStarPathfinder AStar { get; private set; }
        public PathfindingService Pathfinding { get; private set; }
        public FlowFieldService FlowFields { get; private set; }

        // ---- entities ----
        public BuildingRegistry Buildings { get; } = new BuildingRegistry();
        public UnitRegistry Units { get; private set; }

        // ---- domain systems ----
        public ResourceLedger Resources { get; private set; }
        public EconomySystem Economy { get; private set; }
        public PopulationSystem Population { get; private set; }
        public WorkerJobSystem WorkerJobs { get; private set; }
        public ConstructionSystem Construction { get; private set; }
        public UnitSystem UnitMover { get; private set; }
        public CombatSystem Combat { get; private set; }
        public ProjectileSystem Projectiles { get; private set; }
        public WaveDirector Waves { get; private set; }
        public EnemyCommander Commander { get; private set; }

        // ---- application ----
        public GameStateManager State { get; private set; }
        public SimulationClock Clock { get { return State.Clock; } }
        public DeterministicRandom Rng { get; private set; }
        public KingdomStats PlayerKingdom { get; private set; }
        public KingdomStats EnemyKingdom { get; private set; }

        public Vector2Int KeepCell { get; private set; }
        public Vector2Int EnemyCampCell { get; private set; }
        public float DeltaTime { get { return SimulationClock.TickDelta; } }

        // ---- scenario ----
        public GeneratedMap Map { get; private set; }
        public uint Seed { get; private set; }
        public bool IsReady { get; private set; }

        int _lastGridVersion;
        readonly List<UnitInstance> _selectionScratch = new List<UnitInstance>(64);

        public GameWorld(uint seed, GameStateManager state)
        {
            Seed = seed == 0 ? 1337u : seed;
            State = state;
            Rng = new DeterministicRandom(Seed);
            PlayerKingdom = new KingdomStats { Team = Team.Player };
            EnemyKingdom = new KingdomStats { Team = Team.Enemy };

            PlayerKingdom.Rations = RationPolicy.Full;
            PlayerKingdom.Taxes = TaxPolicy.Normal;
            EnemyKingdom.Rations = RationPolicy.Full;
            EnemyKingdom.Taxes = TaxPolicy.Normal;
            PlayerKingdom.Popularity = Balance.Population.PopularityStart;
            EnemyKingdom.Popularity = 50f;
        }

        // =====================================================================
        //  Setup
        // =====================================================================
        public void Build(uint seed)
        {
            Seed = seed == 0 ? Seed : seed;
            Rng = new DeterministicRandom(Seed);

            var settings = MapGenSettings.Default(Seed);
            Map = MapGenerator.Generate(settings);
            Terrain = Map.Terrain;
            Grid = new MapGrid(Terrain);
            Navigation = new NavigationGrid(Grid, Terrain);
            AStar = new AStarPathfinder(Navigation);
            Pathfinding = new PathfindingService(AStar, Navigation);
            FlowFields = new FlowFieldService(Navigation, Grid);

            Units = new UnitRegistry(Terrain.Width, Terrain.Height);
            Resources = new ResourceLedger();
            Construction = new ConstructionSystem(Grid, Terrain, Navigation, Buildings, Resources, State);
            Projectiles = new ProjectileSystem(this, Units, Buildings, Construction);
            UnitMover = new UnitSystem(this, Units, Buildings, Pathfinding, Navigation);
            Combat = new CombatSystem(this, Units, Buildings, Construction, Projectiles, UnitMover);
            Economy = new EconomySystem(this, Resources, Buildings, Terrain, Grid);
            Population = new PopulationSystem(this, Units, Buildings, Resources, Construction);
            WorkerJobs = new WorkerJobSystem(this, Units, Buildings, UnitMover, Economy, Pathfinding, Navigation, Grid);
            Commander = new EnemyCommander(this, Units, Buildings, UnitMover, Combat, FlowFields);
            Waves = new WaveDirector(this, Units);

            KeepCell = new Vector2Int(Map.PlayerStart.x, Map.PlayerStart.y);
            EnemyCampCell = new Vector2Int(Map.EnemyCamp.x, Map.EnemyCamp.y);
            Construction.KeepCell = new Int2(Map.PlayerStart.x, Map.PlayerStart.y);
            Construction.EnemyCampCell = new Int2(Map.EnemyCamp.x, Map.EnemyCamp.y);
            Construction.TerritoryRadius = Map.PlayerTerritoryRadius;

            Construction.PlayerKeepLost = () => Waves.NotifyKeepLost();

            GiveStartingResources();
            PlacePlayerStart();
            PlaceEnemyCamp();
            SpawnStartingPeasants();

            Construction.RecalculateStorageCaps();
            Construction.RecalculateAuras();

            State.Tick += OnSimulationTick;
            IsReady = true;
        }

        void GiveStartingResources()
        {
            var start = Balance.Economy.StartingResources;
            for (int i = 0; i < ResourceUtil.Count; i++)
            {
                var type = (ResourceType)i;
                if (start[type] > 0) Resources.Set(Team.Player, type, start[type]);
            }
        }

        void PlacePlayerStart()
        {
            // The keep is the anchor of everything the player builds.
            BuildingInstance keep;
            PlacementError error;
            var keepCell = new Int2(Map.PlayerStart.x, Map.PlayerStart.y);
            if (!Construction.TryPlace(BuildingId.Keep, keepCell, Team.Player, true, out keep, out error))
            {
                Debug.LogWarning("[GameWorld] Keep placement failed: " + error + " — retrying nearby");
                Int2 free;
                if (Grid.TryFindFreeCell(keepCell, 8, out free))
                    Construction.TryPlace(BuildingId.Keep, free, Team.Player, true, out keep, out error);
            }

            // A modest starter hamlet: storage, housing and the first woodcutters.
            var supports = new List<BuildingId> { BuildingId.Stockpile, BuildingId.Hovel, BuildingId.Hovel, BuildingId.House };
            for (int i = 0; i < supports.Count; i++) PlaceNear(supports[i], keepCell, 5 + i * 2);

            PlaceNearForest(BuildingId.WoodcutterHut, keepCell, 6);
            PlaceNearForest(BuildingId.WoodcutterHut, keepCell, 7);
            PlaceNearTerrain(BuildingId.Quarry, keepCell, TerrainType.Rock, 18);
            PlaceNearTerrain(BuildingId.Farm, keepCell, TerrainType.FertileSoil, 22);
        }

        void PlaceEnemyCamp()
        {
            var camp = new Int2(Map.EnemyCamp.x, Map.EnemyCamp.y);
            var layout = new List<BuildingId>
            {
                BuildingId.SiegeCamp, BuildingId.EnemyBanner, BuildingId.EnemyTent,
                BuildingId.EnemyTent, BuildingId.EnemyTent,
            };

            for (int i = 0; i < layout.Count; i++)
            {
                Int2 cell = new Int2(camp.x + (i % 3) * 4 - 4, camp.y + (i / 3) * 4 - 2);
                BuildingInstance placed;
                PlacementError error;
                if (Construction.TryPlace(layout[i], cell, Team.Enemy, true, out placed, out error)) continue;

                Int2 free;
                if (Grid.TryFindFreeCell(cell, 6, out free))
                    Construction.TryPlace(layout[i], free, Team.Enemy, true, out placed, out error);
            }
        }

        void PlaceNear(BuildingId id, Int2 anchor, int radius)
        {
            var def = BuildingCatalog.Get(id);
            for (int attempt = 0; attempt < 40; attempt++)
            {
                var cell = new Int2(anchor.x + Rng.Range(-radius, radius + 1),
                                    anchor.y + Rng.Range(-radius, radius + 1));
                BuildingInstance placed;
                PlacementError error;
                if (Construction.TryPlace(id, cell, Team.Player, true, out placed, out error)) return;
            }
        }

        void PlaceNearForest(BuildingId id, Int2 anchor, int radius)
        {
            Int2 fallback = Int2.Zero;
            bool hasFallback = false;

            for (int attempt = 0; attempt < 60; attempt++)
            {
                var cell = new Int2(anchor.x + Rng.Range(-radius * 2, radius * 2 + 1),
                                    anchor.y + Rng.Range(-radius * 2, radius * 2 + 1));

                // Keep the woodlot off the map edge and out of the middle of a
                // thicket: a hut whose whole ring is trees has nowhere for its
                // lumberjack to stand, and the castle never sees a log.
                var def = BuildingCatalog.Get(id);
                if (cell.x < 3 || cell.y < 3 ||
                    cell.x > Grid.Width - 4 - def.Footprint.x || cell.y > Grid.Height - 4 - def.Footprint.y) continue;
                if (OpenRing(cell, def.Footprint.x, def.Footprint.y) < 2)
                {
                    fallback = cell;
                    hasFallback = true;
                    continue;
                }

                BuildingInstance placed;
                PlacementError error;
                if (Construction.TryPlace(id, cell, Team.Player, true, out placed, out error)) return;
            }

            if (hasFallback)
            {
                BuildingInstance placed;
                PlacementError error;
                if (Construction.TryPlace(id, fallback, Team.Player, true, out placed, out error)) return;
            }
            // No forest in reach: skip it rather than stalling the opening.
        }

        /// <summary>How many of the eight cells around a footprint are open ground?</summary>
        int OpenRing(Int2 cell, int w, int h)
        {
            int open = 0;
            for (int y = cell.y - 1; y <= cell.y + h; y++)
            {
                for (int x = cell.x - 1; x <= cell.x + w; x++)
                {
                    if (x >= cell.x && x < cell.x + w && y >= cell.y && y < cell.y + h) continue;
                    var c = new Int2(x, y);
                    if (!Grid.InBounds(c)) continue;
                    if (Terrain.HasVegetation(c)) continue;
                    if (!Terrain.IsTerrainWalkable(c)) continue;
                    if (Grid.IsOccupied(c) || Grid.IsReserved(c)) continue;
                    open++;
                }
            }
            return open;
        }

        void PlaceNearTerrain(BuildingId id, Int2 anchor, TerrainType terrain, int radius)
        {
            for (int y = anchor.y - radius; y <= anchor.y + radius; y++)
            {
                for (int x = anchor.x - radius; x <= anchor.x + radius; x++)
                {
                    var c = new Int2(x, y);
                    if (!Terrain.InBounds(c)) continue;
                    if (Terrain.Get(c) != terrain) continue;

                    BuildingInstance placed;
                    PlacementError error;
                    if (Construction.TryPlace(id, c, Team.Player, true, out placed, out error)) return;
                }
            }
        }

        void SpawnStartingPeasants()
        {
            var def = UnitCatalog.Get(UnitId.Peasant);
            for (int i = 0; i < Balance.Population.StartingPeasants; i++)
            {
                Int2 cell;
                if (!Pathfinding.TryFindWalkableNear(new Int2(Map.PlayerStart.x, Map.PlayerStart.y),
                                                      NavProfile.Ground, Team.Player, 6 + i / 6, out cell))
                    cell = new Int2(Map.PlayerStart.x, Map.PlayerStart.y);

                var unit = Units.Spawn(def, Team.Player,
                                       new Vector3(cell.x + 0.5f, 0f, cell.y + 0.5f));
                if (unit != null) EventBus.Publish(new UnitSpawnedEvent
                {
                    UnitId = (int)UnitId.Peasant, Team = Team.Player, Position = unit.Position,
                });
            }
        }

        // =====================================================================
        //  Frame entry point
        // =====================================================================
        public void Tick(float unscaledDeltaTime)
        {
            if (!IsReady) return;

            // Services with their own frame budgets run once per frame.
            Pathfinding.Tick();

            if (Grid.Version != _lastGridVersion)
            {
                _lastGridVersion = Grid.Version;
                FlowFields.InvalidateAll();
            }
            FlowFields.StepCompute(2200);

            State.Tick_(unscaledDeltaTime);
        }

        void OnSimulationTick(int tickIndex)
        {
            float dt = SimulationClock.TickDelta;

            Construction.Tick(dt);
            Economy.Tick(dt);
            Population.Tick(dt);
            UnitMover.Tick(dt);
            WorkerJobs.Tick(dt);
            Combat.Tick(dt);
            Projectiles.Tick(dt);
            Commander.Tick(dt);
            Waves.Tick(dt);
            Units.RebuildSpatialIndex();
            Units.CollectCorpses(dt);

            CheckObjectives();
            UpdateKingdomFlags(dt);
        }

        void CheckObjectives()
        {
            // Enemy camp razed → early counter-attack victory.
            if (Balance.Progression.AllowCounterAttackVictory)
            {
                int enemyBuildings = Buildings.CountTeam(Team.Enemy);
                if (enemyBuildings == 0 && State.WavesCleared > 0)
                {
                    Waves.NotifyEnemyCampDestroyed();
                }
            }

            // Keep gone → defeat (handled by ConstructionSystem.PlayerKeepLost, but
            // double-check here in case the keep was demolished by a scenario edit).
            if (Buildings.CountOperational(Team.Player, BuildingId.Keep) == 0 &&
                Buildings.CountTeam(Team.Player) > 0 &&
                State.State == GameState.Playing)
            {
                // Give rubble a moment before declaring the game over.
                Waves.NotifyKeepLost();
            }
        }

        void UpdateKingdomFlags(float dt)
        {
            PlayerKingdom.TimeSinceAttacked += dt;
            if (PlayerKingdom.TimeSinceAttacked > 6f && PlayerKingdom.IsUnderAttack)
            {
                PlayerKingdom.IsUnderAttack = false;
                EventBus.Publish(new UnderAttackEvent { Active = false, AttackedTeam = Team.Player });
            }

            EnemyKingdom.Peasants = Units.CountTeam(Team.Enemy, workersOnly: true);
            EnemyKingdom.Military = Units.CountTeam(Team.Enemy, militaryOnly: true);
        }

        public void MarkUnderAttack()
        {
            PlayerKingdom.IsUnderAttack = true;
            PlayerKingdom.TimeSinceAttacked = 0f;
        }

        public void Shutdown()
        {
            if (State != null) State.Tick -= OnSimulationTick;
            Projectiles.Clear();
            Units.Clear();
            Buildings.Clear();
            EventBus.Reset();
            IsReady = false;
        }
    }
}
