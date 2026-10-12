// -----------------------------------------------------------------------------
//  File: Population/WorkerJobSystem.cs
//  Purpose: The peasant AI. Peasants are the only units that do economy work and
//           they behave like Stronghold's villagers:
//
//     1. builders are assigned to construction sites first (a castle under
//        construction is always the highest priority)
//     2. then production buildings are staffed, nearest worker first
//     3. a worker whose building store is full becomes a hauler: it picks the
//        goods up, walks them to the nearest stockpile and comes back
//     4. with nothing to do, peasants loiter around the keep so the player can
//        see how many idle hands are available for drafting
//
//  Every idle worker is re-evaluated on a slow timer, never per tick.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;
using KurdCastle.Construction;
using KurdCastle.Economy;
using KurdCastle.World;

namespace KurdCastle.Population
{
    public sealed class WorkerJobSystem
    {
        readonly IWorld _world;
        readonly UnitRegistry _units;
        readonly BuildingRegistry _buildings;
        readonly UnitSystem _unitMover;
        readonly EconomySystem _economy;
        readonly PathfindingService _pathfinding;
        readonly NavigationGrid _nav;
        readonly MapGrid _grid;

        readonly List<BuildingInstance> _constructionSites = new List<BuildingInstance>(32);
        readonly List<BuildingInstance> _staffableBuildings = new List<BuildingInstance>(64);
        readonly List<UnitInstance> _idleWorkers = new List<UnitInstance>(64);

        float _assignTimer;
        const float AssignInterval = 0.75f;

        public int BuildersAssigned { get; private set; }
        public int WorkersStaffed { get; private set; }
        public int HaulTripsCompleted { get; private set; }

        public WorkerJobSystem(IWorld world, UnitRegistry units, BuildingRegistry buildings,
                               UnitSystem unitMover, EconomySystem economy,
                               PathfindingService pathfinding, NavigationGrid nav,
                               MapGrid grid)
        {
            _world = world;
            _units = units;
            _buildings = buildings;
            _unitMover = unitMover;
            _economy = economy;
            _pathfinding = pathfinding;
            _nav = nav;
            _grid = grid;
        }

        public void Tick(float dt)
        {
            TickWorkers(dt);

            _assignTimer += dt;
            if (_assignTimer < AssignInterval) return;
            _assignTimer = 0f;
            AssignJobs();
        }

        // =====================================================================
        //  Per-worker behaviour
        // =====================================================================
        void TickWorkers(float dt)
        {
            for (int i = 0; i < _units.All.Count; i++)
            {
                var u = _units.All[i];
                if (u == null || !u.IsAlive || u.Team != Team.Player) continue;
                if (!u.IsWorker || u.IsGarrisoned) continue;

                var building = u.JobBuilding != Handle.Invalid ? _buildings.Resolve(u.JobBuilding) : null;

                // Job vanished (demolished/destroyed) → go idle.
                if (building == null && u.JobBuilding != Handle.Invalid)
                {
                    ClearJob(u);
                    continue;
                }

                if (u.Order == UnitOrder.Flee)
                {
                    // Recover from panic once the danger is gone.
                    if (u.State != UnitState.Fleeing) { u.Order = UnitOrder.Work; }
                    else continue;
                }

                if (building == null)
                {
                    Loiter(u, dt);
                    continue;
                }

                if (u.CarryAmount > 0) { TickHauling(u, dt, building); continue; }

                // Haul when the building is holding goods and nobody else is.
                if (building.StoredAmount > 0 && building.StoredAmount >= building.StoredCapacity / 2)
                {
                    StartHaul(u, building);
                    continue;
                }

                TickWorking(u, dt, building);
            }
        }

        void TickWorking(UnitInstance u, float dt, BuildingInstance building)
        {
            u.Order = UnitOrder.Work;
            u.State = UnitState.Working;

            // Stand on (or beside) a work cell: adjacent to the building for most
            // jobs, at the deposit for gatherers whose resource is a little away.
            Int2 workCell = FindWorkCell(building, u, out bool hasCell);
            float distance = hasCell
                ? Vector2.Distance(u.Position2D, workCell.ToVector2Center())
                : RectDistance(u.Position2D, building.Rect);

            // A worker who cannot stand on the ideal cell (a hut wedged into a
            // thicket, a wall raised across the approach) still works from where
            // it can stand instead of pacing forever and stalling the economy.
            bool worksInPlace = !hasCell || (u.StuckTimer > 6f && distance <= 4.5f);

            if (distance > 1.2f && !worksInPlace)
            {
                u.State = UnitState.Working;
                if (!u.HasPath && u.PendingJob == null && u.RepathTimer <= 0f)
                {
                    u.RepathTimer = 1.5f;
                    if (hasCell) _unitMover.RequestPath(u, workCell);
                }
                if (u.RepathTimer > 0f) u.RepathTimer -= dt;
                u.StuckTimer += dt;
                return;
            }

            u.StuckTimer = 0f;
            u.Velocity = Vector2.zero;
            u.WorkTimer += dt;
            u.BobPhase += dt * 6f;

            // Make sure the building still counts this peasant as staff.
            if (u.Job != JobType.Builder && !HasSlot(building, u.Handle))
                building.TryAddWorker(u.Handle);
        }

        static bool HasSlot(BuildingInstance b, int handle)
        {
            for (int i = 0; i < b.WorkerSlots.Length; i++)
                if (b.WorkerSlots[i] == handle) return true;
            return false;
        }

        /// <summary>
        /// The cell a peasant stands on to use a building. Ring by ring so a hut
        /// against a thicket still finds reachable ground; HasCell is false when
        /// the building is completely boxed in.
        /// </summary>
        Int2 FindWorkCell(BuildingInstance building, UnitInstance u, out bool HasCell)
        {
            IntRect rect = building.Rect;
            for (int radius = 1; radius <= 4; radius++)
            {
                Int2 best = Int2.Zero;
                float bestDist = float.MaxValue;
                for (int y = rect.y - radius; y < rect.yMax + radius; y++)
                {
                    for (int x = rect.x - radius; x < rect.xMax + radius; x++)
                    {
                        var c = new Int2(x, y);
                        if (rect.Contains(c)) continue;
                        if (radius > 1 &&
                            x >= rect.x - radius + 1 && x < rect.xMax + radius - 1 &&
                            y >= rect.y - radius + 1 && y < rect.yMax + radius - 1) continue; // inner rings already tried
                        if (!_nav.IsWalkable(c, NavProfile.Ground, Team.Player)) continue;
                        if (_grid.IsOccupied(c)) continue;
                        float d = c.DistanceTo(u.Cell);
                        if (d < bestDist) { bestDist = d; best = c; }
                    }
                }
                if (bestDist < float.MaxValue) { HasCell = true; return best; }
            }
            HasCell = false;
            return rect.Center;
        }

        static float RectDistance(Vector2 p, IntRect rect)
        {
            float dx = Mathf.Max(rect.x - p.x, 0f, p.x - rect.xMax);
            float dy = Mathf.Max(rect.y - p.y, 0f, p.y - rect.yMax);
            return Mathf.Sqrt(dx * dx + dy * dy);
        }

        void StartHaul(UnitInstance u, BuildingInstance building)
        {
            int carry = Mathf.Min(Balance.Economy.CarryCapacity, building.StoredAmount);
            if (carry <= 0) return;

            u.CarryType = building.StoredType;
            u.CarryAmount = carry;
            building.StoredAmount -= carry;
            if (building.StoredAmount <= 0) building.StoredType = ResourceType.None;

            u.Order = UnitOrder.Work;
            u.State = UnitState.Hauling;
            u.WorkTimer = 0f;
        }

        void TickHauling(UnitInstance u, float dt, BuildingInstance jobBuilding)
        {
            u.Order = UnitOrder.Work;
            u.State = UnitState.Hauling;

            var dropOff = _economy.FindDropOff(u.Cell, Team.Player);
            if (dropOff == null)
            {
                // Nowhere to put it: hold the goods (and warn the player once).
                u.State = UnitState.Working;
                return;
            }

            float distance = Vector2.Distance(u.Position2D, dropOff.Rect.Center.ToVector2Center());
            if (distance > 1.6f)
            {
                if (!u.HasPath && u.PendingJob == null && u.RepathTimer <= 0f)
                {
                    u.RepathTimer = 1.5f;
                    Int2 goal = dropOff.Rect.Center;
                    if (!_nav.IsWalkable(goal, NavProfile.Ground, Team.Player))
                    {
                        Int2 adjusted;
                        if (_pathfinding.TryFindWalkableNear(goal, NavProfile.Ground, Team.Player, 5, out adjusted))
                            goal = adjusted;
                    }
                    _unitMover.RequestPath(u, goal);
                }
                if (u.RepathTimer > 0f) u.RepathTimer -= dt;
                return;
            }

            // Deliver.
            int stored = _economy.Deposit(Team.Player, u.CarryType, u.CarryAmount);
            int lost = u.CarryAmount - stored;
            HaulTripsCompleted++;

            EventBus.Publish(new ResourceDeliveredEvent
            {
                Type = u.CarryType, Amount = stored, WorldPosition = u.Position,
            });
            if (lost > 0)
            {
                EventBus.Publish(ToastEvent.Warn(
                    "Stockpile full — " + lost + " " + ResourceUtil.Label(u.CarryType) + " lost"));
            }

            u.CarryAmount = 0;
            u.CarryType = ResourceType.None;
            u.ClearPath();
            u.HasDestination = false;

            // Head back to the job.
            if (jobBuilding != null && !jobBuilding.IsDestroyed)
            {
                Int2 home = FindWorkCell(jobBuilding, u, out bool reachable);
                if (reachable) _unitMover.RequestPath(u, home);
            }
        }

        void Loiter(UnitInstance u, float dt)
        {
            u.Order = UnitOrder.Idle;
            u.State = UnitState.Idle;

            // Wander a little near the keep so the castle looks inhabited.
            if (!u.HasDestination && u.RepathTimer <= 0f)
            {
                u.RepathTimer = _world.Rng.Range(4f, 11f);
                Int2 around = new Int2(_world.KeepCell.x + _world.Rng.Range(-6, 7),
                                       _world.KeepCell.y + _world.Rng.Range(-6, 7));
                Int2 walkable;
                if (_pathfinding.TryFindWalkableNear(around, NavProfile.Ground, Team.Player, 5, out walkable))
                    _unitMover.RequestPath(u, walkable);
            }
            if (u.RepathTimer > 0f) u.RepathTimer -= dt;
        }

        void ClearJob(UnitInstance u)
        {
            var building = _buildings.Resolve(u.JobBuilding);
            if (building != null) building.RemoveWorker(u.Handle);
            u.JobBuilding = Handle.Invalid;
            u.Job = JobType.Idle;
            u.Order = UnitOrder.Idle;
            u.ClearPath();
            u.HasDestination = false;
        }

        // =====================================================================
        //  Assignment pass
        // =====================================================================
        void AssignJobs()
        {
            BuildersAssigned = 0;
            WorkersStaffed = 0;

            _constructionSites.Clear();
            _staffableBuildings.Clear();
            _idleWorkers.Clear();

            for (int i = 0; i < _buildings.All.Count; i++)
            {
                var b = _buildings.All[i];
                if (b == null || b.Team != Team.Player) continue;
                if (b.IsConstructionSite && b.Definition.Id != BuildingId.Keep) _constructionSites.Add(b);
                else if (b.IsOperational && b.Definition.WorkerSlots > 0 && b.HasFreeWorkerSlot)
                    _staffableBuildings.Add(b);
            }

            for (int i = 0; i < _units.All.Count; i++)
            {
                var u = _units.All[i];
                if (u == null || !u.IsAlive || u.Team != Team.Player || !u.IsWorker) continue;
                if (u.IsGarrisoned || u.CarryAmount > 0) continue;
                if (u.JobBuilding != Handle.Invalid && _buildings.Resolve(u.JobBuilding) != null) continue;
                _idleWorkers.Add(u);
            }

            if (_idleWorkers.Count == 0) return;

            // 1. Builders -------------------------------------------------------
            for (int s = 0; s < _constructionSites.Count && _idleWorkers.Count > 0; s++)
            {
                var site = _constructionSites[s];
                while (site.HasFreeWorkerSlot && _idleWorkers.Count > 0)
                {
                    var worker = TakeNearest(site.Rect.Center, _idleWorkers);
                    if (worker == null) break;
                    if (!site.TryAddWorker(worker.Handle)) break;

                    worker.Job = JobType.Builder;
                    worker.JobBuilding = site.Handle;
                    worker.State = UnitState.Working;
                    worker.Order = UnitOrder.Work;
                    Int2 siteCell = FindWorkCell(site, worker, out bool siteReachable);
                    if (siteReachable) _unitMover.RequestPath(worker, siteCell);
                    BuildersAssigned++;
                }
            }

            // 2. Staff production buildings -------------------------------------
            for (int s = 0; s < _staffableBuildings.Count && _idleWorkers.Count > 0; s++)
            {
                var building = _staffableBuildings[s];
                while (building.HasFreeWorkerSlot && _idleWorkers.Count > 0)
                {
                    var worker = TakeNearest(building.Rect.Center, _idleWorkers);
                    if (worker == null) break;
                    if (!building.TryAddWorker(worker.Handle)) break;

                    worker.Job = building.Definition.Recipe.Job;
                    worker.JobBuilding = building.Handle;
                    worker.State = UnitState.Working;
                    worker.Order = UnitOrder.Work;
                    Int2 jobCell = FindWorkCell(building, worker, out bool jobReachable);
                    if (jobReachable) _unitMover.RequestPath(worker, jobCell);
                    WorkersStaffed++;
                }
            }

            // 3. Leftovers loiter; the next pass will pick them up if a job opens.
            for (int i = 0; i < _idleWorkers.Count; i++)
            {
                var worker = _idleWorkers[i];
                if (worker.JobBuilding == Handle.Invalid) Loiter(worker, 0f);
            }
        }

        UnitInstance TakeNearest(Int2 target, List<UnitInstance> pool)
        {
            int bestIndex = -1;
            int bestDist = int.MaxValue;
            for (int i = 0; i < pool.Count; i++)
            {
                int d = pool[i].Cell.ChebyshevTo(target);
                if (d < bestDist) { bestDist = d; bestIndex = i; }
            }
            if (bestIndex < 0) return null;
            var chosen = pool[bestIndex];
            pool.RemoveAt(bestIndex);
            return chosen;
        }

        /// <summary>Frees a worker from its job (used when drafting into the army).</summary>
        public void ReleaseWorker(UnitInstance worker)
        {
            if (worker == null) return;
            ClearJob(worker);
        }
    }
}
