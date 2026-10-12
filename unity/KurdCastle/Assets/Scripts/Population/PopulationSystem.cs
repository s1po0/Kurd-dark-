// -----------------------------------------------------------------------------
//  File: Population/PopulationSystem.cs
//  Purpose: The Stronghold heart of the game — popularity drives how fast new
//           peasants walk to your castle.
//
//  Popularity is an explicit ledger of contributions so the UI can explain it:
//      rations (food policy)   ±8
//      taxes                   -9 … 0
//      ale from inns (needs ale in store)  0 … +12
//      housing headroom        -X … +1.5
//      buildings paid for with gold (churches, gardens, keeps)  0 … +6
//      fear (enemies near the keep)           -25 … 0
//      keep under attack                      -6
//
//  Spawn interval interpolates between 4 s at 100 popularity and 40 s at 0, with
//  peasants actively leaving the castle when popularity drops below 30.
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
    /// <summary>One line of the popularity breakdown, surfaced in the HUD drawer.</summary>
    public struct PopularityFactor
    {
        public string Label;
        public float Value;
        public PopularityFactor(string label, float value) { Label = label; Value = value; }
    }

    public sealed class PopulationSystem
    {
        readonly IWorld _world;
        readonly UnitRegistry _units;
        readonly BuildingRegistry _buildings;
        readonly ResourceLedger _ledger;
        readonly ConstructionSystem _construction;

        readonly List<PopularityFactor> _factors = new List<PopularityFactor>(10);
        readonly List<UnitInstance> _scanBuffer = new List<UnitInstance>(32);

        float _spawnTimer;
        float _leaveTimer;
        float _draftUndoGuard;

        public PopulationSystem(IWorld world, UnitRegistry units, BuildingRegistry buildings,
                                ResourceLedger ledger, ConstructionSystem construction)
        {
            _world = world;
            _units = units;
            _buildings = buildings;
            _ledger = ledger;
            _construction = construction;
        }

        public IReadOnlyList<PopularityFactor> PlayerFactors { get { return _factors; } }
        public float SpawnCountdown { get; private set; }
        public int PeasantsArrived { get; private set; }
        public int PeasantsLeft { get; private set; }

        // =====================================================================
        //  Tick
        // =====================================================================
        public void Tick(float dt)
        {
            var stats = _world.PlayerKingdom;
            if (stats == null || !stats.KeepAlive) return;

            Recalculate(stats, dt);
            TickArrivals(dt, stats);
            TickDepartures(dt, stats);
        }

        void Recalculate(KingdomStats stats, float dt)
        {
            _factors.Clear();

            int peasants = _units.CountTeam(Team.Player, workersOnly: true);
            int military = _units.CountTeam(Team.Player, militaryOnly: true);
            int housing = _construction.HousingCapacity(Team.Player);
            stats.Peasants = peasants;
            stats.Military = military;
            stats.Housing = housing;
            stats.HousingUsed = peasants + Mathf.CeilToInt(military * 0.5f);

            // ---- rations ------------------------------------------------------
            float ration;
            switch (stats.Rations)
            {
                case RationPolicy.None: ration = Balance.Popularity.FoodNone; break;
                case RationPolicy.Half: ration = Balance.Popularity.FoodHalf; break;
                case RationPolicy.Extra: ration = Balance.Popularity.FoodExtra; break;
                default: ration = Balance.Popularity.FoodFull; break;
            }
            AddFactor("Rations (" + stats.Rations + ")", ration);

            // ---- taxes ---------------------------------------------------------
            float tax;
            switch (stats.Taxes)
            {
                case TaxPolicy.Generous: tax = Balance.Popularity.TaxGenerous; break;
                case TaxPolicy.Low: tax = Balance.Popularity.TaxLow; break;
                case TaxPolicy.High: tax = Balance.Popularity.TaxHigh; break;
                case TaxPolicy.Brutal: tax = Balance.Popularity.TaxBrutal; break;
                default: tax = Balance.Popularity.TaxNormal; break;
            }
            AddFactor("Taxes (" + stats.Taxes + ")", tax);

            // ---- ale -----------------------------------------------------------
            int inns = _buildings.CountOperational(Team.Player, BuildingId.Inn);
            int aleStored = _ledger.Get(Team.Player, ResourceType.Ale);
            float aleBonus = 0f;
            if (inns > 0 && aleStored > 0)
            {
                aleBonus = Mathf.Min(Balance.Popularity.AleBonusMax,
                                     inns * Balance.Popularity.AleBonusPerInn);
                if (aleStored < 5) aleBonus *= 0.5f;      // running dry is felt
            }
            if (aleBonus > 0f) AddFactor("Ale in the inns", aleBonus);

            // ---- housing -------------------------------------------------------
            int free = housing - stats.HousingUsed;
            float housingFactor = free < 0
                ? free * Balance.Popularity.OvercrowdPenalty
                : Mathf.Min(Balance.Popularity.SpareHousingBonus, free * 0.2f);
            if (Mathf.Abs(housingFactor) > 0.01f)
                AddFactor(free < 0 ? "Overcrowded" : "Spare housing", housingFactor);

            // ---- buildings that please the people -------------------------------
            float aura = _construction.PopularityAuraTotal(Team.Player);
            if (Mathf.Abs(aura) > 0.01f) AddFactor("Buildings", aura);

            // ---- fear ----------------------------------------------------------
            float fear = ComputeFear(stats);
            if (fear > 0.01f) AddFactor("Enemy at the gates", -fear);

            if (stats.IsUnderAttack) AddFactor("Keep under attack", -Balance.Popularity.KeepUnderAttackPenalty);

            // ---- total ----------------------------------------------------------
            // Neutral is Balance.Popularity.Baseline (50); every factor is a delta on
            // top of it, exactly like Stronghold's popularity ledger.
            float total = Balance.Popularity.Baseline;
            for (int i = 0; i < _factors.Count; i++) total += _factors[i].Value;

            // Popularity drifts toward the target rather than snapping: feels alive.
            stats.Popularity = Mathf.MoveTowards(
                stats.Popularity,
                Mathf.Clamp(total, Balance.Population.PopularityMin, Balance.Population.PopularityMax),
                Balance.Popularity.DriftPerSecond * dt);

            EventBus.Publish(new PopulationChangedEvent
            {
                Team = Team.Player,
                Peasants = peasants,
                Military = military,
                Housing = housing,
                Popularity = stats.Popularity,
                FoodRatePerMinute = stats.FoodRatePerMinute,
            });
        }

        void AddFactor(string label, float value)
        {
            if (Mathf.Abs(value) < 0.01f) return;
            _factors.Add(new PopularityFactor(label, value));
        }

        float ComputeFear(KingdomStats stats)
        {
            if (_world.KeepCell.x < 0) return 0f;
            float fear = 0f;
            var centre = new Vector3(_world.KeepCell.x, 0f, _world.KeepCell.y);
            _units.QueryRadius(centre, Balance.Ai.AggroRadius + 6f, _scanBuffer);
            for (int i = 0; i < _scanBuffer.Count; i++)
            {
                var u = _scanBuffer[i];
                if (!u.IsAlive || u.Team != Team.Enemy) continue;
                float dist = Vector3.Distance(centre, u.Position);
                if (dist > Balance.Ai.AggroRadius) continue;
                // Siege engines terrify civilians far more than a lone raider.
                float weight = u.Definition.IsSiege ? 2.5f : 1f;
                fear += Balance.Popularity.FearPerEnemyNearKeep * weight * (1f - dist / Balance.Ai.AggroRadius);
            }
            return Mathf.Min(Balance.Popularity.FearMax, fear);
        }

        // =====================================================================
        //  Arrivals / departures
        // =====================================================================
        float SpawnInterval(float popularity)
        {
            float t = Mathf.InverseLerp(0f, 100f, Mathf.Clamp(popularity, 0f, 100f));
            return Mathf.Lerp(Balance.Population.MaxSpawnInterval,
                              Balance.Population.MinSpawnInterval, t * t);
        }

        void TickArrivals(float dt, KingdomStats stats)
        {
            int total = stats.Peasants + stats.Military;
            if (total >= Balance.Population.MaxPopulation) return;
            if (stats.HousingFree <= 0f) return;
            if (_ledger.Get(Team.Player, ResourceType.Food) <= 2) return;

            float interval = SpawnInterval(stats.Popularity);
            SpawnCountdown = Mathf.Max(0f, interval - _spawnTimer);
            _spawnTimer += dt;

            if (_spawnTimer < interval) return;
            _spawnTimer = 0f;

            // New peasants walk in along the road from the map edge toward the keep.
            var def = UnitCatalog.Get(UnitId.Peasant);
            Int2 spawnCell;
            if (!_world.Pathfinding.TryFindWalkableNear(_world.KeepCell, NavProfile.Ground,
                                                        Team.Player, 10, out spawnCell))
                spawnCell = _world.KeepCell;

            var unit = _units.Spawn(def, Team.Player, new Vector3(spawnCell.x + 0.5f, 0f, spawnCell.y + 0.5f));
            if (unit == null) return;

            PeasantsArrived++;
            unit.Job = JobType.Idle;
            EventBus.Publish(new UnitSpawnedEvent
            {
                UnitId = (int)UnitId.Peasant, Team = Team.Player, Position = unit.Position,
            });
        }

        void TickDepartures(float dt, KingdomStats stats)
        {
            if (stats.Popularity >= Balance.Population.PeasantLeavesAbove) { _leaveTimer = 0f; return; }

            _leaveTimer += dt;
            if (_leaveTimer < 8f) return;
            _leaveTimer = 0f;

            if (stats.Peasants <= 1) return;

            var victim = _units.FindIdleWorker(Team.Player, new Vector3(_world.KeepCell.x, 0f, _world.KeepCell.y));
            if (victim == null) victim = FindAnyPeasant();
            if (victim == null) return;

            PeasantsLeft++;
            EventBus.Publish(ToastEvent.Warn("A peasant has abandoned your castle"));
            _units.Kill(victim, false);
        }

        UnitInstance FindAnyPeasant()
        {
            for (int i = 0; i < _units.All.Count; i++)
            {
                var u = _units.All[i];
                if (u != null && u.IsAlive && u.Team == Team.Player && u.Definition.Role == UnitRole.Worker && !u.IsGarrisoned)
                    return u;
            }
            return null;
        }

        // =====================================================================
        //  Policy setters (driven by the HUD)
        // =====================================================================
        public void SetRations(RationPolicy policy)
        {
            _world.PlayerKingdom.Rations = policy;
            EventBus.Publish(ToastEvent.Info("Rations set to " + policy));
        }

        public void CycleRations()
        {
            var next = (RationPolicy)(((int)_world.PlayerKingdom.Rations + 1) % 4);
            SetRations(next);
        }

        public void SetTaxes(TaxPolicy policy)
        {
            _world.PlayerKingdom.Taxes = policy;
            EventBus.Publish(ToastEvent.Info("Taxes set to " + policy));
        }

        public void CycleTaxes()
        {
            var next = (TaxPolicy)(((int)_world.PlayerKingdom.Taxes + 1) % 5);
            SetTaxes(next);
        }

        /// <summary>Converts a peasant into a soldier (called by the barracks queue).</summary>
        public bool TryDraftPeasant(out UnitInstance drafted)
        {
            drafted = null;
            var peasant = _units.FindIdleWorker(Team.Player, new Vector3(_world.KeepCell.x, 0f, _world.KeepCell.y));
            if (peasant == null) return false;
            drafted = peasant;
            _units.Kill(peasant, false);   // the peasant "becomes" the soldier
            return true;
        }
    }
}
