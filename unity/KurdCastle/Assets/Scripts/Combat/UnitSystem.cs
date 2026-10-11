// -----------------------------------------------------------------------------
//  File: Combat/UnitSystem.cs
//  Purpose: Movement, steering, crowd separation and order handling for every
//           unit. Explicitly *not* a NavMeshAgent wrapper: on mobile we want a
//           single fixed-step update over flat arrays, cheap separation, and the
//           ability to run the exact same logic headless in tests.
//
//  The FSM mirrors the requested order vocabulary:
//     Idle → Guard → AttackMove → Engage, plus Work/Hauling for peasants.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.World;
using KurdCastle.Construction;

namespace KurdCastle.Combat
{
    public sealed class UnitSystem
    {
        readonly IWorld _world;
        readonly UnitRegistry _units;
        readonly BuildingRegistry _buildings;
        readonly PathfindingService _pathfinding;
        readonly NavigationGrid _nav;

        readonly List<UnitInstance> _neighbours = new List<UnitInstance>(32);
        readonly List<UnitInstance> _orderBuffer = new List<UnitInstance>(64);

        float _separationRadius = 0.66f;
        float _separationStrength = 4.2f;

        public UnitSystem(IWorld world, UnitRegistry units, BuildingRegistry buildings,
                          PathfindingService pathfinding, NavigationGrid nav)
        {
            _world = world;
            _units = units;
            _buildings = buildings;
            _pathfinding = pathfinding;
            _nav = nav;
        }

        public int RepathsThisTick { get; private set; }

        // =====================================================================
        //  Tick
        // =====================================================================
        public void Tick(float dt)
        {
            RepathsThisTick = 0;
            for (int i = 0; i < _units.All.Count; i++)
            {
                var u = _units.All[i];
                if (u == null || !u.IsAlive) continue;

                if (u.FlashTimer > 0f) u.FlashTimer = Mathf.Max(0f, u.FlashTimer - dt * 3f);
                if (u.CombatTimer > 0f) u.CombatTimer = Mathf.Max(0f, u.CombatTimer - dt);
                if (u.AttackCooldown > 0f) u.AttackCooldown = Mathf.Max(0f, u.AttackCooldown - dt);
                if (u.TargetScanTimer > 0f) u.TargetScanTimer = Mathf.Max(0f, u.TargetScanTimer - dt);

                if (u.IsGarrisoned) { TickGarrisoned(u, dt); continue; }

                FulfillPendingPath(u);
                SteerAndMove(u, dt);
                UpdateStateFromOrder(u);
            }
        }

        void TickGarrisoned(UnitInstance u, float dt)
        {
            u.Velocity = Vector2.zero;
            u.State = UnitState.Garrisoned;
            u.BobPhase += dt * 2f;

            // Ranged troops fire from the walls; melee troops only add defence value.
            var building = _buildings.Resolve(u.GarrisonBuilding);
            if (building != null && building.IsOperational)
            {
                u.Position = new Vector3(building.Rect.Center.x, 1.6f, building.Rect.Center.y + 0.2f);
                return;
            }
            // Garrison destroyed: the defenders are evicted.
            u.IsGarrisoned = false;
            u.GarrisonBuilding = Handle.Invalid;
            u.State = UnitState.Idle;
        }

        // =====================================================================
        //  Pathing
        // =====================================================================
        void FulfillPendingPath(UnitInstance u)
        {
            if (u.PendingJob == null) return;
            if (!u.PendingJob.Done) return;

            var result = u.PendingJob.Result;
            bool ok = result != null && result.Count > 0;
            if (ok) u.SetPath(result);

            _pathfinding.Release(u.PendingJob);
            u.PendingJob = null;

            if (!ok && u.HasDestination)
            {
                // Unreachable: drop the order so the unit does not stand frozen.
                u.HasDestination = false;
                if (u.Order == UnitOrder.Move || u.Order == UnitOrder.AttackMove) u.Order = UnitOrder.Idle;
            }
        }

        public bool RequestPath(UnitInstance u, Int2 goal, NavProfile profile = NavProfile.Ground,
                                bool faceGoal = true)
        {
            if (u == null || !u.IsAlive) return false;
            if (u.PendingJob != null)
            {
                _pathfinding.Cancel(u.PendingJob);
                u.PendingJob = null;
            }

            u.Destination = goal;
            u.HasDestination = true;
            u.RepathTimer = Balance.Pathfinding.WorkerRepathCooldown;
            u.LastPathStart = u.Cell;

            // Straight line? Walk it without touching the pathfinder at all.
            if (_pathfinding.HasLineOfSight(u.Cell, goal, profile, u.Team))
            {
                u.PathCount = 1;
                u.Path[0] = goal;
                u.PathIndex = 0;
                if (faceGoal) FaceTowards(u, goal.ToWorld(0f));
                return true;
            }

            var req = NavRequest.Create(u.Cell, goal, profile, u.Team);
            req.AllowPartial = true;
            req.AllowGoalBlocked = true;
            u.PendingJob = _pathfinding.Request(req, u, 48);
            u.WaitingForPath = true;
            return true;
        }

        void TryRepathIfStuck(UnitInstance u)
        {
            if (!u.HasDestination) return;
            if (u.PendingJob != null) return;
            if (u.RepathTimer > 0f) return;

            u.RepathTimer = Balance.Pathfinding.WorkerRepathCooldown;
            RepathsThisTick++;
            RequestPath(u, u.Destination);
        }

        // =====================================================================
        //  Movement
        // =====================================================================
        void SteerAndMove(UnitInstance u, float dt)
        {
            if (u.PendingJob != null && !u.HasPath)
            {
                u.Velocity = Vector2.zero;
                return;
            }

            if (!u.HasPath)
            {
                // No path: drift to a stop and keep the guard/engage state alive.
                u.Velocity = Vector2.zero;
                if (u.Order == UnitOrder.Move && !u.HasDestination) u.Order = UnitOrder.Idle;
                return;
            }

            Int2 waypoint = u.NextWaypoint;
            Vector3 target = waypoint.ToWorld(0f);
            Vector3 toTarget = target - u.Position;
            toTarget.y = 0f;

            if (toTarget.sqrMagnitude <= Balance.Pathfinding.WaypointTolerance * Balance.Pathfinding.WaypointTolerance)
            {
                u.PathIndex++;
                if (!u.HasPath)
                {
                    u.Velocity = Vector2.zero;
                    if (u.Order == UnitOrder.Move) u.Order = UnitOrder.Idle;
                    return;
                }
                waypoint = u.NextWaypoint;
                target = waypoint.ToWorld(0f);
                toTarget = target - u.Position;
                toTarget.y = 0f;
            }

            Vector2 desired = new Vector2(toTarget.x, toTarget.z).normalized;
            Vector2 steering = desired;

            // ---- crowd separation -----------------------------------------
            // Cheap: only the broad-phase bucket neighbours are inspected.
            _units.QueryRadius(u.Position, _separationRadius, _neighbours);
            Vector2 push = Vector2.zero;
            for (int i = 0; i < _neighbours.Count; i++)
            {
                var other = _neighbours[i];
                if (ReferenceEquals(other, u) || !other.IsAlive || other.IsGarrisoned) continue;
                Vector2 delta = u.Position2D - other.Position2D;
                float dist = delta.magnitude;
                if (dist < 0.0001f)
                {
                    delta = new Vector2(_world.Rng.Range(-1f, 1f), _world.Rng.Range(-1f, 1f));
                    dist = 0.1f;
                }
                if (dist >= _separationRadius) continue;
                push += delta / (dist * dist);
            }
            if (push.sqrMagnitude > 0.0001f)
            {
                // Heavier machines shove lighter troops aside.
                float mass = u.Definition.Clearance > 1 ? 0.35f : 1f;
                steering += push * _separationStrength * mass * 0.25f;
            }

            if (steering.sqrMagnitude < 0.0001f) steering = desired;
            steering.Normalize();

            float speed = u.Definition.MoveSpeed * u.SpeedMultiplier;
            u.Velocity = Vector2.Lerp(u.Velocity, steering * speed, Mathf.Clamp01(dt * 8f));

            Vector3 next = u.Position + new Vector3(u.Velocity.x, 0f, u.Velocity.y) * dt;

            // ---- collision with the nav surface ---------------------------
            Int2 nextCell = new Int2(Mathf.FloorToInt(next.x), Mathf.FloorToInt(next.z));
            if (!_nav.IsWalkable(nextCell, NavProfile.Ground, u.Team))
            {
                // Slide along the axis that still works, then repath if fully stuck.
                Int2 axisX = new Int2(nextCell.x, u.Cell.y);
                Int2 axisZ = new Int2(u.Cell.x, nextCell.z);
                if (_nav.IsWalkable(axisX, NavProfile.Ground, u.Team))
                {
                    next = new Vector3(next.x, u.Position.y, u.Position.z);
                }
                else if (_nav.IsWalkable(axisZ, NavProfile.Ground, u.Team))
                {
                    next = new Vector3(u.Position.x, u.Position.y, next.z);
                }
                else
                {
                    next = u.Position;
                    u.Velocity *= 0.2f;
                    u.RepathTimer = Mathf.Min(u.RepathTimer, 0.15f);
                    TryRepathIfStuck(u);
                }
            }

            u.Position = next;
            u.Position.y = 0f;

            // Walk bob drives the procedural foot animation in the view layer.
            float speed01 = u.Velocity.magnitude / Mathf.Max(0.1f, u.Definition.MoveSpeed);
            u.BobPhase += dt * u.Definition.WalkBobFrequency * Mathf.Clamp01(speed01);
            if (u.BobPhase > Mathf.PI * 2f) u.BobPhase -= Mathf.PI * 2f;

            if (u.Velocity.sqrMagnitude > 0.01f)
            {
                float angle = Mathf.Atan2(u.Velocity.x, u.Velocity.y) * Mathf.Rad2Deg;
                u.FacingDeg = Mathf.MoveTowardsAngle(u.FacingDeg, angle, u.Definition.TurnSpeedDeg * dt);
            }
        }

        static void FaceTowards(UnitInstance u, Vector3 point)
        {
            Vector3 d = point - u.Position;
            if (d.sqrMagnitude < 0.0001f) return;
            u.FacingDeg = Mathf.Atan2(d.x, d.z) * Mathf.Rad2Deg;
        }

        void UpdateStateFromOrder(UnitInstance u)
        {
            switch (u.Order)
            {
                case UnitOrder.Move:
                case UnitOrder.AttackMove:
                case UnitOrder.Patrol:
                    if (u.HasPath) { u.State = UnitState.Moving; return; }
                    u.State = u.Order == UnitOrder.AttackMove ? UnitState.AttackMove : UnitState.Idle;
                    return;
                case UnitOrder.Guard:
                    u.State = UnitState.Guard;
                    return;
                case UnitOrder.AttackTarget:
                    u.State = UnitState.Engage;
                    return;
                case UnitOrder.Garrison:
                    u.State = UnitState.Moving;
                    return;
                case UnitOrder.Repair:
                    u.State = UnitState.Moving;
                    return;
                case UnitOrder.Work:
                    u.State = u.CarryAmount > 0 ? UnitState.Hauling : UnitState.Working;
                    return;
                case UnitOrder.Flee:
                    u.State = UnitState.Fleeing;
                    return;
                default:
                    if (u.State == UnitState.Hauling || u.State == UnitState.Working) return;
                    u.State = UnitState.Idle;
                    return;
            }
        }

        // =====================================================================
        //  Commands
        // =====================================================================
        public void Stop(UnitInstance u)
        {
            if (u == null || !u.IsAlive) return;
            if (u.PendingJob != null) { _pathfinding.Cancel(u.PendingJob); u.PendingJob = null; }
            u.ClearPath();
            u.HasDestination = false;
            u.Order = UnitOrder.Stop;
            u.TargetHandle = Handle.Invalid;
            u.Velocity = Vector2.zero;
        }

        public void MoveTo(UnitInstance u, Int2 goal, bool attackMove = false)
        {
            if (u == null || !u.IsAlive) return;
            u.TargetHandle = Handle.Invalid;
            u.Order = attackMove ? UnitOrder.AttackMove : UnitOrder.Move;
            RequestPath(u, goal, u.Definition.Clearance > 1 ? NavProfile.GroundWide : NavProfile.Ground);
        }

        public void GuardAt(UnitInstance u, Int2 post)
        {
            if (u == null || !u.IsAlive) return;
            u.Order = UnitOrder.Guard;
            u.TargetHandle = Handle.Invalid;
            RequestPath(u, post);
        }

        public void AttackTarget(UnitInstance u, int targetHandle)
        {
            if (u == null || !u.IsAlive) return;
            u.TargetHandle = targetHandle;
            u.Order = UnitOrder.AttackTarget;
        }

        public void FleeTo(UnitInstance u, Int2 safeCell)
        {
            if (u == null || !u.IsAlive) return;
            u.Order = UnitOrder.Flee;
            RequestPath(u, safeCell);
        }

        /// <summary>Issues a move order to a group, spreading them into a loose formation.</summary>
        public void IssueGroupMove(List<UnitInstance> group, Int2 center, bool attackMove)
        {
            if (group == null || group.Count == 0) return;
            int columns = Mathf.CeilToInt(Mathf.Sqrt(group.Count));
            int index = 0;
            int spacing = 1;

            for (int row = 0; row < columns; row++)
            {
                for (int col = 0; col < columns && index < group.Count; col++, index++)
                {
                    var u = group[index];
                    if (u == null || !u.IsAlive) continue;
                    int ox = (col - columns / 2) * spacing;
                    int oy = (row - columns / 2) * spacing;
                    Int2 goal = new Int2(center.x + ox, center.y + oy);

                    if (!_nav.IsWalkable(goal, NavProfile.Ground, u.Team))
                    {
                        Int2 adjusted;
                        if (_pathfinding.TryFindWalkableNear(goal, NavProfile.Ground, u.Team, 4, out adjusted))
                            goal = adjusted;
                    }
                    MoveTo(u, goal, attackMove);
                }
            }
        }

        /// <summary>Garrisoning: walk to the building, then pop inside.</summary>
        public void Garrison(UnitInstance u, BuildingInstance building)
        {
            if (u == null || !u.IsAlive || building == null) return;
            if (!building.HasFreeGarrisonSlot)
            {
                EventBus.Publish(ToastEvent.Warn("No room in " + building.Definition.DisplayName));
                return;
            }
            u.Order = UnitOrder.Garrison;
            u.TargetHandle = building.Handle;
            RequestPath(u, building.Rect.Center);
        }

        /// <summary>Called by CombatSystem once the unit is adjacent to its garrison target.</summary>
        public void EnterGarrison(UnitInstance u, BuildingInstance building)
        {
            if (!building.TryAddGarrison(u.Handle)) return;
            u.IsGarrisoned = true;
            u.GarrisonBuilding = building.Handle;
            u.State = UnitState.Garrisoned;
            u.ClearPath();
            u.HasDestination = false;
            u.Velocity = Vector2.zero;
            u.Position = new Vector3(building.Rect.Center.x, 1.6f, building.Rect.Center.y);
        }

        public void ExitGarrison(UnitInstance u, Int2 exitCell)
        {
            var building = _buildings.Resolve(u.GarrisonBuilding);
            if (building != null) building.RemoveGarrison(u.Handle);
            u.IsGarrisoned = false;
            u.GarrisonBuilding = Handle.Invalid;
            u.Order = UnitOrder.Idle;
            u.Position = new Vector3(exitCell.x + 0.5f, 0f, exitCell.y + 0.5f);
            u.HasDestination = false;
            u.ClearPath();
        }

        public void EvictAllGarrisons(BuildingInstance building)
        {
            if (building == null) return;
            Int2 exit;
            bool found = _pathfinding.TryFindWalkableNear(building.Rect.Center,
                NavProfile.Ground, building.Team, 6, out exit);
            if (!found) exit = building.Rect.Center;

            for (int i = 0; i < building.GarrisonSlots.Length; i++)
            {
                int handle = building.GarrisonSlots[i];
                if (handle == Handle.Invalid) continue;
                var u = _units.Resolve(handle);
                if (u != null) ExitGarrison(u, exit);
                building.GarrisonSlots[i] = Handle.Invalid;
            }
            building.GarrisonCount = 0;
        }
    }
}
