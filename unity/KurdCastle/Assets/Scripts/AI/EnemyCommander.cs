// -----------------------------------------------------------------------------
//  File: AI/EnemyCommander.cs
//  Purpose: The siege brain. Instead of ordering every attacker individually it
//           keeps the wave tied to the flow field toward the player's keep, so
//           200 raiders cost roughly the same as one.
//
//  Tactics it embodies:
//    * SIEGE ENGINE: rams and catapults head for gates first, then the nearest
//      wall segment; catapults stop at max range and bombard over the parapet.
//    * LADDER ASSAULT: laddermen pick a wall stretch away from towers, then
//      climb (wall-bypass navigation) and drop inside.
//    * HORDE: raiders/brutes follow the cheapest path, which naturally funnels
//      them through an open gate, a breach, or a ford.
//    * FOCUS FIRE: attackers all target the same structure until it collapses,
//      which is what makes defended walls fall at all.
//    * RETREAT: broken units (below FleeThresholdPct) fall back to the camp and
//      heal; they rejoin the next push.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;
using KurdCastle.Construction;
using KurdCastle.World;

namespace KurdCastle.AI
{
    public sealed class EnemyCommander
    {
        readonly IWorld _world;
        readonly UnitRegistry _units;
        readonly BuildingRegistry _buildings;
        readonly UnitSystem _unitMover;
        readonly CombatSystem _combat;
        readonly FlowFieldService _flowFields;

        readonly List<UnitInstance> _wave = new List<UnitInstance>(96);
        readonly List<UnitInstance> _laddermen = new List<UnitInstance>(24);
        readonly List<UnitInstance> _siege = new List<UnitInstance>(16);
        readonly List<UnitInstance> _retreating = new List<UnitInstance>(32);
        readonly List<BuildingInstance> _targets = new List<BuildingInstance>(32);

        float _thinkTimer;
        BuildingInstance _focusTarget;

        public EnemyCommander(IWorld world, UnitRegistry units, BuildingRegistry buildings,
                              UnitSystem unitMover, CombatSystem combat, FlowFieldService flowFields)
        {
            _world = world;
            _units = units;
            _buildings = buildings;
            _unitMover = unitMover;
            _combat = combat;
            _flowFields = flowFields;
        }

        /// <summary>Root obstacle the horde is currently trying to break.</summary>
        public BuildingInstance FocusTarget { get { return _focusTarget; } }
        public int AttackerCount { get; private set; }

        public void OnWaveStarted(List<UnitInstance> wave)
        {
            _wave.Clear();
            if (wave != null) _wave.AddRange(wave);
            _focusTarget = null;
            _thinkTimer = 0f;   // think immediately
        }

        public void Tick(float dt)
        {
            AttackerCount = 0;

            // Keep the flow fields pointed at the objective; a gate that opens or
            // a wall that collapses changes the field automatically because the
            // navigation surface version changed.
            var objective = ChooseObjective();
            if (objective != null)
            {
                var target = objective.Rect.Center;
                _flowFields.GetField(NavProfile.Ground, target, Team.Enemy);
                _flowFields.GetField(NavProfile.WallBypass, target, Team.Enemy);
                _flowFields.GetField(NavProfile.GroundWide, target, Team.Enemy);
            }

            _thinkTimer -= dt;
            bool think = _thinkTimer <= 0f;
            if (think) _thinkTimer = Balance.Sim.CommanderThinkInterval;

            for (int i = 0; i < _wave.Count; i++)
            {
                var u = _wave[i];
                if (u == null || !u.IsAlive) continue;
                AttackerCount++;
                CommandUnit(u, dt, think);
            }
        }

        // =====================================================================
        //  Objective selection
        // =====================================================================
        BuildingInstance ChooseObjective()
        {
            var keep = _buildings.FindNearest(_world.KeepCell, Team.Player, def => def.IsKeep, false);
            if (_focusTarget != null && !_focusTarget.IsDestroyed && !_focusTarget.IsRubble)
                return _focusTarget;

            // Priority: open gate → gatehouse → keep wall ring → keep.
            _targets.Clear();
            _buildings.QueryRadius(_world.KeepCell, 30, Team.Player, _targets);

            BuildingInstance bestGate = null, bestWall = null;
            float bestGateDist = float.MaxValue, bestWallDist = float.MaxValue;

            for (int i = 0; i < _targets.Count; i++)
            {
                var b = _targets[i];
                if (b == null || b.IsRubble || !b.IsOperational) continue;
                float d = b.Rect.Center.DistanceTo(_world.EnemyCampCell);

                if (b.Definition.IsGate || b.Definition.Id == BuildingId.Drawbridge)
                {
                    if (d < bestGateDist) { bestGateDist = d; bestGate = b; }
                }
                else if (b.Definition.IsWall)
                {
                    if (d < bestWallDist) { bestWallDist = d; bestWall = b; }
                }
            }

            _focusTarget = bestGate != null ? bestGate : (bestWall != null ? bestWall : keep);
            return _focusTarget;
        }

        void SetFocus(BuildingInstance building)
        {
            _focusTarget = building;
        }

        // =====================================================================
        //  Per-unit orders
        // =====================================================================
        void CommandUnit(UnitInstance u, float dt, bool think)
        {
            var def = u.Definition;

            // --- wounded units pull back ---------------------------------------
            float campDistance = Vector2.Distance(
                new Vector2(u.Position.x, u.Position.z),
                new Vector2(_world.EnemyCampCell.x + 0.5f, _world.EnemyCampCell.y + 0.5f));
            bool atCamp = campDistance <= Balance.Ai.CampHealRadius;

            if (u.HealthPct < Balance.Ai.FleeThresholdPct && !_retreating.Contains(u))
            {
                _retreating.Add(u);
                u.RetreatCount++;
                Int2 camp = _world.EnemyCampCell;
                Int2 walkable;
                if (_world.Pathfinding.TryFindWalkableNear(camp, def.Clearance > 1 ? NavProfile.GroundWide : NavProfile.Ground,
                                                            Team.Enemy, 8, out walkable))
                    camp = walkable;
                _unitMover.FleeTo(u, camp);
                return;
            }
            if (_retreating.Contains(u))
            {
                u.RegroupTimer += dt;

                // Regroup behind the tents: broken units patch themselves up and
                // come back for another push instead of standing around forever.
                if (atCamp)
                    u.Health = Mathf.Min(u.MaxHealth, u.Health + Balance.Ai.CampHealPerSecond * dt);

                // If a unit has lost heart one time too many, or simply cannot get
                // back into the fight, it leaves the field so the wave can end.
                bool deserting = u.RetreatCount > Balance.Ai.MaxRetreats &&
                                 u.RegroupTimer >= Balance.Ai.DesertSeconds;
                if (deserting || u.RegroupTimer >= Balance.Ai.DesertSeconds * 2f)
                {
                    _retreating.Remove(u);
                    _units.Kill(u, false);
                    EventBus.Publish(ToastEvent.Info("A broken raider slips away from the camp"));
                    return;
                }

                if (u.HealthPct > 0.55f && u.State != UnitState.Fleeing)
                {
                    _retreating.Remove(u);
                    u.RegroupTimer = 0f;
                }
                else return;
            }

            // --- siege engines bombard walls from standoff range ----------------
            if (def.IsSiege)
            {
                TickSiegeUnit(u, dt);
                return;
            }

            // --- laddermen scale the ramparts ------------------------------------
            if (def.CanBypassWalls && def.Role == UnitRole.Ladder)
            {
                TickLadderman(u, think);
                return;
            }

            // --- standard melee/ranged horde --------------------------------------
            TickHordeUnit(u, dt, think);
        }

        void TickSiegeUnit(UnitInstance u, float dt)
        {
            var objective = _focusTarget;
            if (objective == null || objective.IsDestroyed)
            {
                objective = ChooseObjective();
                if (objective == null) return;
            }

            float distance = Vector3.Distance(
                u.Position, new Vector3(objective.Rect.Center.x, 0f, objective.Rect.Center.y));

            float standoff = ComputeStandoff(u, objective);

            if (distance > standoff)
            {
                // Drive forward on the wide profile: machines follow the flow field
                // toward the objective, which avoids tearing down their own tents.
                var profile = NavProfile.GroundWide;
                var field = _world.FlowFields.GetField(profile, objective.Rect.Center, Team.Enemy);
                Int2 from = u.Cell;
                Int2 next;
                if (field.NextStep(from, out next) && u.RepathTimer <= 0f)
                {
                    u.RepathTimer = Balance.Ai.RepathInterval;
                    _unitMover.RequestPath(u, next, profile);
                }
                u.RepathTimer -= dt;
                return;
            }

            // In range: fire.
            _combat.AttackBuilding(u, objective);
        }

        float ComputeStandoff(UnitInstance u, BuildingInstance objective)
        {
            float range = u.Definition.AttackRange;
            // Catapults stay near max range, out of tower coverage where possible.
            float factor = u.Id == UnitId.Catapult ? 0.95f : Balance.Ai.RangedStandoffFactor;
            float standoff = Mathf.Max(2f, range * factor);

            // Keep away from defensive towers: if a tower can see the firing spot,
            // back off further (this is what makes tower placement matter).
            var tower = _buildings.FindNearest(objective.Rect.Center, Team.Player,
                                                d => d.DefenseRange > 0f, true);
            if (tower != null)
            {
                float towerReach = tower.Definition.DefenseRange + 1.5f;
                standoff = Mathf.Max(standoff, towerReach);   // rams ignore this via melee path
            }
            return standoff;
        }

        void TickLadderman(UnitInstance u, bool think)
        {
            Int2 keep = _world.KeepCell;
            if ((think || !u.HasDestination) && u.RepathTimer <= 0f)
            {
                // Pick a wall stretch away from towers so ladders are not shredded.
                var target = FindWallSectionAwayFromTowers();
                Int2 goal = target.x >= 0 ? target : keep;
                u.RepathTimer = Balance.Ai.RepathInterval;
                _unitMover.MoveTo(u, goal, true);
            }
            if (u.RepathTimer > 0f) u.RepathTimer -= 0.5f;
        }

        Int2 FindWallSectionAwayFromTowers()
        {
            _targets.Clear();
            _buildings.QueryRadius(_world.KeepCell, Balance.Ai.BreachSearchRadius + 10, Team.Player, _targets);

            Int2 best = new Int2(-1, -1);
            float bestScore = float.MinValue;
            for (int i = 0; i < _targets.Count; i++)
            {
                var b = _targets[i];
                if (b == null || !b.Definition.IsWall) continue;

                var tower = _buildings.FindNearest(b.Rect.Center, Team.Player, d => d.DefenseRange > 0f, true);
                float towerDist = tower != null
                    ? tower.Rect.Center.DistanceTo(b.Rect.Center)
                    : 99f;
                float toCamp = b.Rect.Center.DistanceTo(_world.EnemyCampCell);
                float score = towerDist * 2f - toCamp * 0.4f;
                if (score > bestScore) { bestScore = score; best = b.Rect.Center; }
            }
            return best;
        }

        void TickHordeUnit(UnitInstance u, float dt, bool think)
        {
            // Melee troops that reach a wall must break it, otherwise they stand
            // around politely. Ranged troops shoot whoever is on the wall.
            var objective = _focusTarget;

            if (u.Order != UnitOrder.AttackTarget && objective != null && !objective.IsDestroyed)
            {
                float distanceToObjective = Vector3.Distance(
                    u.Position, new Vector3(objective.Rect.Center.x, 0f, objective.Rect.Center.y));

                if (distanceToObjective < u.Definition.AttackRange + 1.5f)
                {
                    _combat.AttackBuilding(u, objective);
                    return;
                }
            }

            if (think || !u.HasDestination)
            {
                var field = _world.FlowFields.GetField(NavProfile.Ground, _world.KeepCell, Team.Enemy);
                Int2 next;
                if (field.NextStep(u.Cell, out next))
                {
                    if (u.RepathTimer <= 0f)
                    {
                        u.RepathTimer = Balance.Ai.RepathInterval;
                        _unitMover.MoveTo(u, next, true);
                    }
                }
            }
            u.RepathTimer -= dt;
        }

        /// <summary>Called when the player kills the enemy camp buildings.</summary>
        public void NotifyCampBreached()
        {
            SetFocus(null);
        }
    }
}
