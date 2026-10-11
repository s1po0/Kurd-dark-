// -----------------------------------------------------------------------------
//  File: Combat/UnitRegistry.cs
//  Purpose: Pooled store of every soldier and peasant, plus the spatial queries
//           the AI and combat systems need. Units are plain C# objects recycled
//           through a free list — no GameObjects, no MonoBehaviour callbacks —
//           and a SpatialHash keeps "who is near me?" cheap at 300+ units.
// -----------------------------------------------------------------------------
using System;
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.World;

namespace KurdCastle.Combat
{
    /// <summary>High-level intent. Mirrors the RTS orders the player gives.</summary>
    public enum UnitOrder : byte
    {
        Idle = 0,
        Move = 1,
        AttackMove = 2,
        AttackTarget = 3,
        Guard = 4,        // hold position, engage anything in vision
        Patrol = 5,
        Stop = 6,
        Garrison = 7,
        Work = 8,         // economy job
        Flee = 9,
        Repair = 10,
    }

    public sealed class UnitInstance
    {
        // ---- identity ----
        public int Handle = Handle.Invalid;
        public UnitDefinition Definition;
        public Team Team = Team.Player;
        public UnitId Id = UnitId.None;
        public bool IsAlive = true;

        // ---- motion ----
        public Vector3 Position;
        public float FacingDeg;
        public Vector2 Velocity;
        public float SpeedMultiplier = 1f;
        public float BobPhase;
        public float VisualScale = 1f;

        // ---- health ----
        public float Health;
        public float MaxHealth;
        public float FlashTimer;
        public float DeathTimer;
        public float HealAccumulator;

        // ---- state machine ----
        public UnitState State = UnitState.Idle;
        public UnitOrder Order = UnitOrder.Idle;
        public UnitOrder PreviousOrder = UnitOrder.Idle;

        // ---- navigation ----
        public Int2 Destination;
        public bool HasDestination;
        public Int2[] Path = new Int2[64];
        public int PathCount;
        public int PathIndex;
        public float RepathTimer;
        public Int2 LastPathStart;
        public bool WaitingForPath;
        public PathJob PendingJob;
        public Int2 FormationOffset;

        // ---- economy job ----
        public JobType Job = JobType.Idle;
        public int JobBuilding = Handle.Invalid;
        public ResourceType CarryType = ResourceType.None;
        public int CarryAmount;
        public float WorkTimer;

        // ---- combat ----
        public int TargetHandle = Handle.Invalid;
        public float AttackCooldown;
        public float WindupTimer;
        public float TargetScanTimer;
        public int LastAttackerHandle = Handle.Invalid;
        public float Morale = 50f;
        public int RetreatCount;
        public float RegroupTimer;
        public bool Engaged;
        public float CombatTimer;

        // ---- garrison / wall ----
        public int GarrisonBuilding = Handle.Invalid;
        public bool IsGarrisoned;
        public bool OnWall;

        // ---- selection & ui ----
        public bool Selected;
        public bool IsWorker { get { return Definition != null && Definition.IsWorker; } }
        public bool IsRanged { get { return Definition != null && Definition.IsRanged; } }
        public bool IsSiege { get { return Definition != null && Definition.IsSiege; } }
        public float HealthPct { get { return MaxHealth <= 0f ? 0f : Mathf.Clamp01(Health / MaxHealth); } }
        public Vector2 Position2D { get { return new Vector2(Position.x, Position.z); } }

        public Int2 Cell
        {
            get { return new Int2(Mathf.FloorToInt(Position.x), Mathf.FloorToInt(Position.z)); }
        }

        public void Init(int handle, UnitDefinition def, Team team, Vector3 position)
        {
            Handle = handle;
            Definition = def;
            Team = team;
            Id = def.Id;
            IsAlive = true;
            Position = position;
            FacingDeg = team == Team.Player ? 45f : 225f;
            Velocity = Vector2.zero;
            SpeedMultiplier = 1f;
            BobPhase = 0f;
            VisualScale = def.VisualScale;
            MaxHealth = def.MaxHealth * Balance.Combat.GlobalHealthScale;
            Health = MaxHealth;
            FlashTimer = 0f;
            DeathTimer = 0f;
            HealAccumulator = 0f;
            State = UnitState.Idle;
            Order = UnitOrder.Idle;
            PreviousOrder = UnitOrder.Idle;
            HasDestination = false;
            PathCount = 0;
            PathIndex = 0;
            RepathTimer = 0f;
            WaitingForPath = false;
            PendingJob = null;
            FormationOffset = Int2.Zero;
            Job = def.IsWorker ? JobType.Idle : JobType.None;
            JobBuilding = Handle.Invalid;
            CarryType = ResourceType.None;
            CarryAmount = 0;
            WorkTimer = 0f;
            TargetHandle = Handle.Invalid;
            AttackCooldown = 0f;
            WindupTimer = 0f;
            TargetScanTimer = 0f;
            LastAttackerHandle = Handle.Invalid;
            Morale = def.MoraleBase;
            Engaged = false;
            CombatTimer = 0f;
            GarrisonBuilding = Handle.Invalid;
            IsGarrisoned = false;
            OnWall = false;
            Selected = false;
        }

        public void ClearPath()
        {
            PathCount = 0;
            PathIndex = 0;
            WaitingForPath = false;
        }

        public bool HasPath { get { return PathIndex < PathCount; } }

        public Int2 NextWaypoint { get { return Path[PathIndex]; } }

        public void SetPath(PathResult result)
        {
            if (result == null || result.Count == 0) { ClearPath(); return; }
            int n = Mathf.Min(result.Count, Path.Length);
            for (int i = 0; i < n; i++) Path[i] = result.Waypoints[i];
            PathCount = n;
            PathIndex = 0;
            HasDestination = true;
        }

        public override string ToString()
        {
            return Definition + "[" + Handle + "] " + State + " hp " + Mathf.RoundToInt(Health);
        }
    }

    public sealed class UnitRegistry
    {
        readonly List<UnitInstance> _units = new List<UnitInstance>(Balance.Performance.MaxLiveUnits);
        readonly Stack<UnitInstance> _pool = new Stack<UnitInstance>(128);
        readonly SpatialHash _hash;
        readonly List<int> _scratchIndices = new List<int>(256);
        readonly List<UnitInstance> _scratchUnits = new List<UnitInstance>(256);

        public int SpawnCount { get; private set; }
        public int DeathCount { get; private set; }
        public int LiveCount { get; private set; }

        public event Action<UnitInstance> Spawned;
        public event Action<UnitInstance> Died;

        public UnitRegistry(float mapWidth, float mapHeight)
        {
            _hash = new SpatialHash(0f, 0f, Mathf.CeilToInt(mapWidth) + 4, Mathf.CeilToInt(mapHeight) + 4, 2f);
        }

        public IReadOnlyList<UnitInstance> All { get { return _units; } }
        public SpatialHash Hash { get { return _hash; } }

        public UnitInstance Resolve(int handle)
        {
            if (handle == Handle.Invalid) return null;
            int index = Handle.IndexOf(handle);
            if (index < 0 || index >= _units.Count) return null;
            var u = _units[index];
            if (u == null || u.Handle != handle || !u.IsAlive) return null;
            return u;
        }

        public UnitInstance Spawn(UnitDefinition def, Team team, Vector3 position)
        {
            if (_units.Count >= Balance.Performance.MaxLiveUnits)
            {
                Debug.LogWarning("[UnitRegistry] Unit cap reached (" + Balance.Performance.MaxLiveUnits + ")");
                return null;
            }

            UnitInstance unit;
            int index;
            if (_pool.Count > 0)
            {
                unit = _pool.Pop();
                index = Handle.IndexOf(unit.Handle);
                int generation = Handle.NextGeneration(Handle.GenerationOf(unit.Handle));
                unit.Init(Handle.Make(index, generation), def, team, position);
                _units[index] = unit;
            }
            else
            {
                index = _units.Count;
                unit = new UnitInstance();
                unit.Init(Handle.Make(index, 1), def, team, position);
                _units.Add(unit);
            }

            SpawnCount++;
            LiveCount++;
            if (Spawned != null) Spawned(unit);
            return unit;
        }

        public void Kill(UnitInstance unit, bool byPlayer)
        {
            if (unit == null || !unit.IsAlive) return;
            unit.IsAlive = false;
            unit.State = UnitState.Dead;
            unit.Health = 0f;
            unit.DeathTimer = 1.2f;
            unit.Selected = false;
            LiveCount--;
            DeathCount++;

            if (Died != null) Died(unit);
            EventBus.Publish(new UnitDiedEvent
            {
                UnitId = unit.Definition.Id, Team = unit.Team, Position = unit.Position,
                WasKilledByPlayer = byPlayer || unit.Team == Team.Enemy,
            });
        }

        /// <summary>Removes corpses and recycles their objects back into the pool.</summary>
        public void CollectCorpses(float dt)
        {
            for (int i = 0; i < _units.Count; i++)
            {
                var u = _units[i];
                if (u == null || u.IsAlive) continue;
                u.DeathTimer -= dt;
                if (u.DeathTimer > 0f) continue;

                // Return the object to the pool but keep the slot addressable.
                if (_pool.Count < Balance.Performance.MaxLiveUnits) _pool.Push(u);
                _units[i] = null;
                u.IsAlive = false;
                u.Handle = Handle.Invalid;
            }
        }

        /// <summary>Rebuilds the broad-phase hash. Called once per simulation tick.</summary>
        public void RebuildSpatialIndex()
        {
            _hash.Clear();
            for (int i = 0; i < _units.Count; i++)
            {
                var u = _units[i];
                if (u == null || !u.IsAlive) continue;
                _hash.Insert(i, u.Position);
            }
        }

        /// <summary>Appends every live unit within a radius (radius filter applied here).</summary>
        public void QueryRadius(Vector3 center, float radius, List<UnitInstance> results)
        {
            results.Clear();
            _scratchIndices.Clear();
            _hash.QueryCircle(new Vector2(center.x, center.z), radius, _scratchIndices);
            float r2 = radius * radius;
            for (int i = 0; i < _scratchIndices.Count; i++)
            {
                var u = _units[_scratchIndices[i]];
                if (u == null || !u.IsAlive) continue;
                float dx = u.Position.x - center.x;
                float dz = u.Position.z - center.z;
                if (dx * dx + dz * dz <= r2) results.Add(u);
            }
        }

        /// <summary>Nearest hostile unit inside a radius, ignoring garrisoned troops.</summary>
        public UnitInstance FindNearestEnemy(Vector3 position, Team myTeam, float radius,
                                             bool includeGarrisoned = false)
        {
            _scratchIndices.Clear();
            _hash.QueryCircle(new Vector2(position.x, position.z), radius, _scratchIndices);
            float bestSqr = radius * radius;
            UnitInstance best = null;
            for (int i = 0; i < _scratchIndices.Count; i++)
            {
                var u = _units[_scratchIndices[i]];
                if (u == null || !u.IsAlive || u.Team == myTeam || u.Team == Team.Neutral) continue;
                if (!includeGarrisoned && u.IsGarrisoned) continue;
                float dx = u.Position.x - position.x;
                float dz = u.Position.z - position.z;
                float d2 = dx * dx + dz * dz;
                if (d2 < bestSqr) { bestSqr = d2; best = u; }
            }
            return best;
        }

        public int CountTeam(Team team, bool workersOnly = false, bool militaryOnly = false)
        {
            int n = 0;
            for (int i = 0; i < _units.Count; i++)
            {
                var u = _units[i];
                if (u == null || !u.IsAlive || u.Team != team) continue;
                if (workersOnly && !u.IsWorker) continue;
                if (militaryOnly && u.IsWorker) continue;
                n++;
            }
            return n;
        }

        public void ForEach(Action<UnitInstance> action)
        {
            for (int i = 0; i < _units.Count; i++)
            {
                var u = _units[i];
                if (u != null && u.IsAlive) action(u);
            }
        }

        public void ForEachTeam(Team team, Action<UnitInstance> action)
        {
            for (int i = 0; i < _units.Count; i++)
            {
                var u = _units[i];
                if (u != null && u.IsAlive && u.Team == team) action(u);
            }
        }

        /// <summary>Idle, non-garrisoned peasants available for drafting or new jobs.</summary>
        public int CountIdleWorkers(Team team)
        {
            int n = 0;
            for (int i = 0; i < _units.Count; i++)
            {
                var u = _units[i];
                if (u == null || !u.IsAlive || u.Team != team || !u.IsWorker) continue;
                if (u.IsGarrisoned) continue;
                if (u.State == UnitState.Idle || u.State == UnitState.Moving && u.Order == UnitOrder.Idle) n++;
            }
            return n;
        }

        public UnitInstance FindIdleWorker(Team team, Vector3 near)
        {
            UnitInstance best = null;
            float bestDist = float.MaxValue;
            for (int i = 0; i < _units.Count; i++)
            {
                var u = _units[i];
                if (u == null || !u.IsAlive || u.Team != team || !u.IsWorker || u.IsGarrisoned) continue;
                if (u.JobBuilding != Handle.Invalid) continue;
                if (u.State == UnitState.Working || u.State == UnitState.Hauling) continue;
                float d = (u.Position - near).sqrMagnitude;
                if (d < bestDist) { bestDist = d; best = u; }
            }
            return best;
        }

        public void Clear()
        {
            for (int i = 0; i < _units.Count; i++)
            {
                if (_units[i] != null) _units[i].Handle = Handle.Invalid;
            }
            _units.Clear();
            _pool.Clear();
            LiveCount = 0;
        }
    }
}
