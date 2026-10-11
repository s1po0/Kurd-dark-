// -----------------------------------------------------------------------------
//  File: Combat/ProjectileSystem.cs
//  Purpose: Object-pooled arrows, bolts, boulders and tower shafts. One flat
//           pool serves every ranged unit in the game, so a 40-archer volley
//           costs zero allocations and at most 40 updates per tick.
//
//  Projectiles are simulated as ballistic arcs in *progress* space (0→1) rather
//  than with real gravity integration: cheaper, deterministic and it looks right
//  from an isometric camera.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Construction;

namespace KurdCastle.Combat
{
    public sealed class Projectile
    {
        public bool Active;
        public int Handle;

        public Vector3 Start;
        public Vector3 End;
        public Vector3 Position;
        public float Progress;          // 0..1
        public float Speed;             // cells per second
        public float ArcHeight;
        public float Rotation;

        public float Damage;
        public DamageType Type = DamageType.Pierce;
        public Team Team;
        public int SourceHandle = Handle.Invalid;

        // target binding
        public UnitInstance TargetUnit;
        public BuildingInstance TargetBuilding;
        public bool Homing;             // arrows track a moving soldier
        public bool Splash;
        public float SplashRadius;

        public VisualShape Shape = VisualShape.Arrow;
    }

    public enum VisualShape : byte { Arrow = 0, Boulder = 1, Bolt = 2, Spear = 3 }

    public sealed class ProjectileSystem
    {
        readonly UnitRegistry _units;
        readonly BuildingRegistry _buildings;
        readonly ConstructionSystem _construction;
        readonly IWorld _world;

        readonly List<Projectile> _pool = new List<Projectile>(Balance.Performance.MaxProjectiles);
        readonly List<Projectile> _active = new List<Projectile>(Balance.Performance.MaxProjectiles);
        readonly List<UnitInstance> _splashUnits = new List<UnitInstance>(24);
        readonly List<BuildingInstance> _splashBuildings = new List<BuildingInstance>(8);

        int _nextHandle = 1;

        public ProjectileSystem(IWorld world, UnitRegistry units, BuildingRegistry buildings,
                                ConstructionSystem construction)
        {
            _world = world;
            _units = units;
            _buildings = buildings;
            _construction = construction;
            Prewarm(Balance.Performance.ProjectilePoolPrewarm);
        }

        public int ActiveCount { get { return _active.Count; } }
        public int PoolSize { get { return _pool.Count; } }
        public IReadOnlyList<Projectile> Active { get { return _active; } }

        void Prewarm(int count)
        {
            for (int i = 0; i < count; i++) _pool.Add(new Projectile());
        }

        Projectile Rent()
        {
            if (_pool.Count == 0)
            {
                if (_active.Count >= Balance.Performance.MaxProjectiles) return null;
                _pool.Add(new Projectile());
            }
            var p = _pool[_pool.Count - 1];
            _pool.RemoveAt(_pool.Count - 1);
            return p;
        }

        void Return(Projectile p)
        {
            p.Active = false;
            p.TargetUnit = null;
            p.TargetBuilding = null;
            _pool.Add(p);
        }

        // =====================================================================
        //  Spawning
        // =====================================================================
        public Projectile FireAtUnit(UnitInstance attacker, UnitInstance target, bool homing = true)
        {
            if (attacker == null || target == null || !target.IsAlive) return null;
            var def = attacker.Definition;

            var p = Rent();
            if (p == null) return null;

            p.Active = true;
            p.Handle = _nextHandle++;
            p.Start = attacker.Position + new Vector3(0f, 0.55f, 0f);
            p.End = target.Position + new Vector3(0f, 0.5f, 0f);
            p.Position = p.Start;
            p.Progress = 0f;
            p.Speed = Mathf.Max(4f, def.ProjectileSpeed);
            p.Damage = def.Damage * Balance.Combat.RangedScale;
            p.Type = def.DamageType;
            p.Team = attacker.Team;
            p.SourceHandle = attacker.Handle;
            p.TargetUnit = target;
            p.TargetBuilding = null;
            p.Homing = homing;
            p.Splash = def.SplashRadius > 0.01f;
            p.SplashRadius = def.SplashRadius;
            p.Shape = def.DamageType == DamageType.Siege ? VisualShape.Boulder
                    : def.Id == UnitId.Crossbowman ? VisualShape.Bolt : VisualShape.Arrow;

            float dist = Vector3.Distance(p.Start, p.End);
            p.ArcHeight = dist * Balance.Combat.ProjectileArcHeightPerCell *
                         (def.DamageType == DamageType.Siege ? 2.4f : 1f);
            p.Rotation = Mathf.Atan2(p.End.x - p.Start.x, p.End.z - p.Start.z) * Mathf.Rad2Deg;

            _active.Add(p);
            EventBus.Publish(new ProjectileFiredEvent { From = p.Start, To = p.End, UnitId = (int)def.Id });
            return p;
        }

        public Projectile FireAtBuilding(UnitInstance attacker, BuildingInstance target)
        {
            if (attacker == null || target == null) return null;
            var def = attacker.Definition;

            var p = Rent();
            if (p == null) return null;

            p.Active = true;
            p.Handle = _nextHandle++;
            p.Start = attacker.Position + new Vector3(0f, 0.55f, 0f);
            p.End = new Vector3(target.Rect.Center.x, 0.8f, target.Rect.Center.y);
            p.Position = p.Start;
            p.Progress = 0f;
            p.Speed = Mathf.Max(4f, def.ProjectileSpeed);
            p.Damage = def.Damage * def.BuildingDamageMultiplier * Balance.Combat.RangedScale;
            p.Type = def.DamageType == DamageType.Pierce ? DamageType.Siege : def.DamageType;
            p.Team = attacker.Team;
            p.SourceHandle = attacker.Handle;
            p.TargetUnit = null;
            p.TargetBuilding = target;
            p.Homing = false;
            p.Splash = def.SplashRadius > 0.01f;
            p.SplashRadius = def.SplashRadius;
            p.Shape = def.DamageType == DamageType.Siege ? VisualShape.Boulder : VisualShape.Arrow;

            float dist = Vector3.Distance(p.Start, p.End);
            p.ArcHeight = dist * Balance.Combat.ProjectileArcHeightPerCell *
                         (def.DamageType == DamageType.Siege ? 2.4f : 1f);
            p.Rotation = Mathf.Atan2(p.End.x - p.Start.x, p.End.z - p.Start.z) * Mathf.Rad2Deg;

            _active.Add(p);
            return p;
        }

        /// <summary>Automated tower/gate fire (no unit attacker).</summary>
        public Projectile FireFromBuilding(BuildingInstance tower, UnitInstance target)
        {
            if (tower == null || target == null || !target.IsAlive) return null;

            var p = Rent();
            if (p == null) return null;

            var def = tower.Definition;
            p.Active = true;
            p.Handle = _nextHandle++;
            p.Start = new Vector3(tower.Rect.Center.x, tower.Definition.Height * 0.8f, tower.Rect.Center.y);
            p.End = target.Position + new Vector3(0f, 0.5f, 0f);
            p.Position = p.Start;
            p.Progress = 0f;
            p.Speed = 22f;
            p.Damage = def.DefenseDamage * Balance.Combat.RangedScale;
            p.Type = DamageType.Pierce;
            p.Team = tower.Team;
            p.SourceHandle = tower.Handle;
            p.TargetUnit = target;
            p.Homing = true;
            p.Shape = VisualShape.Arrow;

            float dist = Vector3.Distance(p.Start, p.End);
            p.ArcHeight = dist * Balance.Combat.ProjectileArcHeightPerCell;
            p.Rotation = Mathf.Atan2(p.End.x - p.Start.x, p.End.z - p.Start.z) * Mathf.Rad2Deg;

            _active.Add(p);
            return p;
        }

        // =====================================================================
        //  Simulation
        // =====================================================================
        public void Tick(float dt)
        {
            for (int i = _active.Count - 1; i >= 0; i--)
            {
                var p = _active[i];
                if (!p.Active) { _active.RemoveAt(i); Return(p); continue; }

                // Track moving targets until impact.
                if (p.Homing && p.TargetUnit != null && p.TargetUnit.IsAlive)
                    p.End = p.TargetUnit.Position + new Vector3(0f, 0.5f, 0f);

                float distance = Vector3.Distance(p.Start, p.End);
                float travel = p.Speed * dt;
                p.Progress += distance > 0.01f ? travel / distance : 1f;

                if (p.Progress >= 1f)
                {
                    Impact(p);
                    _active.RemoveAt(i);
                    Return(p);
                    continue;
                }

                p.Position = Vector3.Lerp(p.Start, p.End, p.Progress);
                p.Position.y += p.ArcHeight * 4f * p.Progress * (1f - p.Progress);
            }
        }

        void Impact(Projectile p)
        {
            if (p.Splash)
            {
                ApplySplash(p);
                return;
            }

            if (p.TargetUnit != null && p.TargetUnit.IsAlive)
            {
                ApplyToUnit(p.TargetUnit, p);
                return;
            }
            if (p.TargetBuilding != null && !p.TargetBuilding.IsDestroyed)
            {
                ApplyToBuilding(p.TargetBuilding, p);
                return;
            }

            // Target died mid-flight: arrows hit dirt. (Feels correct and avoids
            // "phantom snipes" that players rightly hate.)
        }

        void ApplySplash(Projectile p)
        {
            _units.QueryRadius(p.End, p.SplashRadius, _splashUnits);
            for (int i = 0; i < _splashUnits.Count; i++)
            {
                var u = _splashUnits[i];
                if (u.Team == p.Team) continue;
                ApplyToUnit(u, p, 0.6f);
            }

            _buildings.QueryRadius(new Int2(Mathf.FloorToInt(p.End.x), Mathf.FloorToInt(p.End.z)),
                                   Mathf.CeilToInt(p.SplashRadius), Team.Neutral, _splashBuildings);
            for (int i = 0; i < _splashBuildings.Count; i++)
            {
                var b = _splashBuildings[i];
                if (b.Team == p.Team) continue;
                ApplyToBuilding(b, p, 0.8f);
            }

            EventBus.Publish(new CameraShakeEvent
            {
                Magnitude = 0.22f, Duration = 0.25f, WorldPosition = p.End,
            });
        }

        void ApplyToUnit(UnitInstance target, Projectile p, float scale = 1f)
        {
            if (target == null || !target.IsAlive) return;
            float dmg = DamageMatrix.Apply(p.Damage * scale, p.Type, target.Definition.Armor,
                                           Balance.Combat.GlobalDamageScale);
            target.Health -= dmg;
            target.FlashTimer = 1f;
            target.CombatTimer = 3f;
            target.LastAttackerHandle = p.SourceHandle;

            if (target.Health <= 0f)
            {
                bool byPlayer = p.Team == Team.Player;
                _units.Kill(target, byPlayer);
            }
        }

        void ApplyToBuilding(BuildingInstance target, Projectile p, float scale = 1f)
        {
            if (target == null || target.IsDestroyed) return;
            _construction.Damage(target, p.Damage * scale, p.Type, p.Team);
        }

        public void Clear()
        {
            for (int i = 0; i < _active.Count; i++) Return(_active[i]);
            _active.Clear();
        }
    }
}
