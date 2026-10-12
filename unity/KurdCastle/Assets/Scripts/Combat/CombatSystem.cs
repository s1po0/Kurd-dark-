// -----------------------------------------------------------------------------
//  File: Combat/CombatSystem.cs
//  Purpose: Target acquisition, melee resolution, garrisoned archery and
//           automated defensive fire.
//
//  Design notes:
//   * Target scanning is staggered across ticks (TargetScanTimer) so 300 units
//     never all perform a spatial query in the same frame.
//   * Attacks have a wind-up beat: damage lands AttackWindup seconds after the
//     swing starts, which is what makes the procedural swing animation read as
//     a real attack and gives the defender a chance to interrupt.
//   * Rear attacks get a damage bonus based on the facing cone.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Construction;
using KurdCastle.World;

namespace KurdCastle.Combat
{
    public sealed class CombatSystem
    {
        readonly IWorld _world;
        readonly UnitRegistry _units;
        readonly BuildingRegistry _buildings;
        readonly ConstructionSystem _construction;
        readonly ProjectileSystem _projectiles;
        readonly UnitSystem _unitMover;

        readonly List<UnitInstance> _scanBuffer = new List<UnitInstance>(64);
        readonly List<BuildingInstance> _buildingBuffer = new List<BuildingInstance>(32);

        public int KillsThisTick { get; private set; }

        public CombatSystem(IWorld world, UnitRegistry units, BuildingRegistry buildings,
                            ConstructionSystem construction, ProjectileSystem projectiles,
                            UnitSystem unitMover)
        {
            _world = world;
            _units = units;
            _buildings = buildings;
            _construction = construction;
            _projectiles = projectiles;
            _unitMover = unitMover;
        }

        public void Tick(float dt)
        {
            KillsThisTick = 0;

            for (int i = 0; i < _units.All.Count; i++)
            {
                var u = _units.All[i];
                if (u == null || !u.IsAlive) continue;

                if (u.IsGarrisoned) { TickGarrisonedShooter(u, dt); continue; }
                if (u.Definition.Role == UnitRole.Worker) { TickWorkerSafety(u, dt); continue; }

                TickCombatant(u, dt);
            }

            TickDefensiveBuildings(dt);
        }

        // =====================================================================
        //  Field units
        // =====================================================================
        void TickCombatant(UnitInstance u, float dt)
        {
            bool hasExplicitTarget = u.TargetHandle != Handle.Invalid && u.Order == UnitOrder.AttackTarget;

            if (!hasExplicitTarget && u.TargetScanTimer <= 0f)
            {
                u.TargetScanTimer = 0.35f + _world.Rng.Range(0f, 0.25f);
                UnitInstance found = AcquireTarget(u);
                if (found != null) u.TargetHandle = found.Handle;
                else if (u.Order != UnitOrder.AttackTarget) u.TargetHandle = Handle.Invalid;
            }

            UnitInstance target = _units.Resolve(u.TargetHandle);
            if (target != null && (!target.IsAlive || target.IsGarrisoned && !u.Definition.CanBypassWalls))
            {
                u.TargetHandle = Handle.Invalid;
                target = null;
            }

            if (target == null)
            {
                if (u.Order == UnitOrder.AttackTarget)
                {
                    // The ordered victim is gone; revert to a defensive stance so the
                    // unit does not chase a corpse across the map.
                    u.Order = UnitOrder.Guard;
                    u.State = UnitState.Guard;
                }
                else if (u.Order == UnitOrder.AttackMove && !u.HasPath)
                {
                    u.State = UnitState.Guard;
                }
                return;
            }

            float distance = Vector3.Distance(u.Position, target.Position);
            float range = u.Definition.AttackRange;

            // Ranged units keep their distance; melee closes the gap.
            float standoff = u.IsRanged ? Mathf.Max(range * 0.85f, u.Definition.PreferredRange * 0.9f) : 0f;

            bool inRange = distance <= range;
            bool tooClose = standoff > 0f && distance < standoff * 0.6f;

            if (!inRange || tooClose)
            {
                // Close in / back off, but never cancel an active swing.
                if (u.WindupTimer <= 0f && (u.RepathTimer <= 0f || tooClose))
                {
                    Int2 goal = target.Cell;
                    if (tooClose)
                    {
                        // Back away along the unit→target axis.
                        Vector3 away = u.Position - target.Position;
                        Vector2 dir = new Vector2(away.x, away.z).normalized;
                        if (dir.sqrMagnitude < 0.01f) dir = new Vector2(1f, 0f);
                        goal = new Int2(target.Cell.x - Mathf.RoundToInt(dir.x * 2f),
                                        target.Cell.y - Mathf.RoundToInt(dir.y * 2f));
                    }
                    _unitMover.MoveTo(u, goal, u.Order == UnitOrder.AttackMove);
                }
                return;
            }

            u.Engaged = true;
            u.CombatTimer = 3f;
            u.State = UnitState.Engage;
            u.Velocity = Vector2.zero;

            // Face the enemy while fighting.
            Vector3 facing = target.Position - u.Position;
            if (facing.sqrMagnitude > 0.0001f)
                u.FacingDeg = Mathf.Atan2(facing.x, facing.z) * Mathf.Rad2Deg;

            if (u.WindupTimer > 0f)
            {
                u.WindupTimer -= dt;
                if (u.WindupTimer <= 0f) ResolveAttack(u, target);
                return;
            }

            if (u.AttackCooldown > 0f) return;

            // Start a swing.
            u.AttackCooldown = u.Definition.AttackInterval;
            u.WindupTimer = u.Definition.AttackWindup;
        }

        void ResolveAttack(UnitInstance attacker, UnitInstance target)
        {
            if (target == null || !target.IsAlive) return;
            var def = attacker.Definition;

            float distance = Vector3.Distance(attacker.Position, target.Position);
            if (distance > def.AttackRange * 1.35f) return;      // target escaped the blow

            if (def.ProjectileSpeed > 0.01f)
            {
                // Ranged: spawn a projectile, accuracy decides whether it is on line.
                float chance = HitChance(def, distance);
                if (!_world.Rng.Chance(chance))
                {
                    // A miss shoots past the target: still visible, still fair.
                    _projectiles.FireAtUnit(attacker, target);
                    return;
                }
                _projectiles.FireAtUnit(attacker, target);
                return;
            }

            // Melee: instant damage with a rear-attack bonus.
            float damage = def.Damage * Balance.Combat.MeleeScale;
            damage *= FacingBonus(attacker, target);

            float applied = DamageMatrix.Apply(damage, def.DamageType, target.Definition.Armor,
                                              Balance.Combat.GlobalDamageScale);
            target.Health -= applied;
            target.FlashTimer = 1f;
            target.CombatTimer = 3f;
            target.LastAttackerHandle = attacker.Handle;

            EventBus.Publish(new CameraShakeEvent
            {
                Magnitude = 0.04f, Duration = 0.08f, WorldPosition = target.Position,
            });

            if (target.Health <= 0f) OnUnitKilled(target, attacker);
        }

        static float FacingBonus(UnitInstance attacker, UnitInstance target)
        {
            // Attacking from behind the target's facing cone is more effective.
            float toAttacker = Mathf.Atan2(attacker.Position.x - target.Position.x,
                                           attacker.Position.z - target.Position.z) * Mathf.Rad2Deg;
            float delta = Mathf.Abs(Mathf.DeltaAngle(toAttacker, target.FacingDeg));
            return delta > 120f ? Balance.Combat.RearAttackBonus : 1f;
        }

        public static float HitChance(UnitDefinition def, float distance)
        {
            float range = Mathf.Max(0.5f, def.AttackRange);
            float t = Mathf.Clamp01(distance / range);
            float falloff = t <= Balance.Combat.AccuracyFalloffStart
                ? 1f
                : Mathf.Lerp(1f, Balance.Combat.AccuracyFalloffMax,
                             (t - Balance.Combat.AccuracyFalloffStart) / (1f - Balance.Combat.AccuracyFalloffStart));
            return Mathf.Max(Balance.Combat.MinimumHitChance, def.Accuracy * falloff);
        }

        void OnUnitKilled(UnitInstance victim, UnitInstance killer)
        {
            KillsThisTick++;
            bool byPlayer = killer != null && killer.Team == Team.Player;
            _units.Kill(victim, byPlayer);

            if (killer != null && killer.Team == Team.Player)
                _world.State.ScoreEnemiesKilled++;

            // Nearby friendly workers panic when soldiers die next to them.
            _units.QueryRadius(victim.Position, 6f, _scanBuffer);
            for (int i = 0; i < _scanBuffer.Count; i++)
            {
                var u = _scanBuffer[i];
                if (!u.IsAlive || !u.IsWorker || u.Team != victim.Team) continue;
                u.Morale = Mathf.Max(0f, u.Morale - 6f);
            }
        }

        // =====================================================================
        //  Target acquisition
        // =====================================================================
        UnitInstance AcquireTarget(UnitInstance u)
        {
            var def = u.Definition;
            float radius = u.Order == UnitOrder.Guard ? def.VisionRange : def.AggroRange;

            UnitInstance best = null;
            float bestScore = float.MaxValue;

            _units.QueryRadius(u.Position, radius, _scanBuffer);
            for (int i = 0; i < _scanBuffer.Count; i++)
            {
                var candidate = _scanBuffer[i];
                if (candidate == null || !candidate.IsAlive) continue;
                if (candidate.Team == u.Team || candidate.Team == Team.Neutral) continue;
                if (candidate.IsGarrisoned && !def.CanBypassWalls) continue;

                // Prefer soft targets for ranged, nearby targets for melee.
                float dist = Vector3.Distance(u.Position, candidate.Position);
                float score = dist;
                if (u.IsRanged && candidate.IsRanged) score -= 3f;
                if (u.IsRanged && candidate.IsWorker) score -= 2f;
                if (candidate.Definition.Role == UnitRole.Siege) score -= u.IsRanged ? 4f : 0f;

                if (score < bestScore) { bestScore = score; best = candidate; }
            }

            if (best != null) return best;

            // Nothing alive nearby: siege troops smash buildings, attackers head
            // for the walls. This is what makes an unwalled castle feel exposed.
            if (def.CanAttackBuildings && (u.Order == UnitOrder.AttackMove || u.Order == UnitOrder.Guard))
            {
                var building = FindBuildingTarget(u, radius + (def.IsSiege ? 6f : 2f));
                if (building != null)
                {
                    // Buildings are handled as move-and-attack orders rather than
                    // unit targets; the AI layer sets that up explicitly.
                    u.TargetHandle = Handle.Invalid;
                }
            }
            return null;
        }

        public BuildingInstance FindBuildingTarget(UnitInstance u, float radius)
        {
            var enemyTeam = u.Team == Team.Player ? Team.Enemy : Team.Player;
            int r2 = Mathf.RoundToInt(radius);
            _buildings.QueryRadius(u.Cell, r2, enemyTeam, _buildingBuffer);
            BuildingInstance best = null;
            float bestScore = float.MaxValue;
            for (int i = 0; i < _buildingBuffer.Count; i++)
            {
                var b = _buildingBuffer[i];
                if (b == null || b.IsRubble) continue;
                // Siege prefers gates and walls; infantry prefers the keep.
                float score = b.Rect.Center.DistanceTo(u.Cell);
                if (u.Definition.IsSiege)
                {
                    if (b.Definition.IsGate) score -= 6f;
                    if (b.Definition.IsWall) score -= 3f;
                }
                else if (b.Definition.IsKeep)
                {
                    score += 8f;
                }
                if (score < bestScore) { bestScore = score; best = b; }
            }
            return best;
        }

        // =====================================================================
        //  Garrisoned archers
        // =====================================================================
        void TickGarrisonedShooter(UnitInstance u, float dt)
        {
            var building = _buildings.Resolve(u.GarrisonBuilding);
            if (building == null || !building.IsOperational || !u.IsRanged) return;

            if (u.AttackCooldown > 0f) { u.AttackCooldown -= dt; return; }
            if (u.TargetScanTimer > 0f) { u.TargetScanTimer -= dt; return; }
            u.TargetScanTimer = 0.4f;

            float range = u.Definition.AttackRange + Balance.Combat.WallArcherRangeBonus;
            var target = _units.FindNearestEnemy(u.Position, u.Team, range);
            if (target == null) return;

            u.AttackCooldown = u.Definition.AttackInterval;
            _projectiles.FireAtUnit(u, target);
            u.FacingDeg = Mathf.Atan2(target.Position.x - u.Position.x,
                                      target.Position.z - u.Position.z) * Mathf.Rad2Deg;
        }

        // =====================================================================
        //  Peasants under threat
        // =====================================================================
        void TickWorkerSafety(UnitInstance u, float dt)
        {
            if (u.Morale > 0f) u.Morale = Mathf.Min(u.Definition.MoraleBase, u.Morale + dt * 2f);

            if (u.TargetScanTimer > 0f) { u.TargetScanTimer -= dt; return; }
            u.TargetScanTimer = 0.6f;

            var threat = _units.FindNearestEnemy(u.Position, u.Team, 7f);
            if (threat == null) return;

            float dist = Vector3.Distance(u.Position, threat.Position);
            if (dist > 5f) return;

            // Peasants run for the keep; they do not fight (that's the player's job).
            if (u.State != UnitState.Fleeing)
            {
                Int2 refuge = _world.KeepCell;
                Int2 walkable;
                if (_world.Pathfinding.TryFindWalkableNear(refuge, NavProfile.Ground, u.Team, 8, out walkable))
                    refuge = walkable;
                _unitMover.FleeTo(u, refuge);
            }
        }

        // =====================================================================
        //  Towers, gatehouses and keeps
        // =====================================================================
        void TickDefensiveBuildings(float dt)
        {
            var all = _buildings.All;
            for (int i = 0; i < all.Count; i++)
            {
                var b = all[i];
                if (b == null || !b.IsOperational) continue;
                var def = b.Definition;
                if (def.DefenseRange <= 0f || def.DefenseDamage <= 0f) continue;
                if (b.DefenseCooldown > 0f) continue;

                float range = def.DefenseRange;
                // Garrisoned archers inside the same building extend its reach.
                range += b.GarrisonCount * 0.6f;

                var target = _units.FindNearestEnemy(new Vector3(b.Rect.Center.x, 0f, b.Rect.Center.y),
                                                     b.Team, range);
                if (target == null) continue;

                b.DefenseCooldown = def.DefenseInterval;
                _projectiles.FireFromBuilding(b, target);
            }
        }

        /// <summary>Called by the AI when a sieging unit decides to break a wall.</summary>
        public void AttackBuilding(UnitInstance attacker, BuildingInstance target)
        {
            if (attacker == null || target == null) return;

            float distance = Vector3.Distance(
                attacker.Position,
                new Vector3(target.Rect.Center.x, 0f, target.Rect.Center.y));
            float reach = Mathf.Max(attacker.Definition.AttackRange,
                                    Mathf.Max(target.Rect.width, target.Rect.height) * 0.6f + 0.8f);

            if (distance > reach)
            {
                _unitMover.MoveTo(attacker, target.Rect.Center);
                return;
            }

            if (attacker.AttackCooldown > 0f) return;
            attacker.AttackCooldown = attacker.Definition.AttackInterval;
            attacker.State = UnitState.Engage;

            float damage = attacker.Definition.Damage * attacker.Definition.BuildingDamageMultiplier;
            _construction.Damage(target, damage, attacker.Definition.DamageType, attacker.Team);
        }
    }
}
