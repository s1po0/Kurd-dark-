// -----------------------------------------------------------------------------
//  File: Economy/EconomySystem.cs
//  Purpose: The engine room of the Stronghold-style economy:
//    * production cycles for every staffed building (gatherers spend the tile's
//      harvest budget; converters consume inputs from the stockpile)
//    * finished goods land in the building's local store, where hauling peasants
//      pick them up and carry them to the nearest stockpile (see WorkerJobSystem)
//    * food consumption per ration policy, ale consumption by inns, tax income
//      per tax policy, and the market's emergency food imports
//    * healing auras (wells, healer's tents) applied to nearby friendly units
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Construction;
using KurdCastle.Combat;
using KurdCastle.World;

namespace KurdCastle.Economy
{
    public struct EconomyReport
    {
        public float FoodPerMinute;
        public float GoldPerMinute;
        public float AlePerMinute;
        public int FoodStored;
        public int AleStored;
        public float FoodMinutesLeft;
    }

    public sealed class EconomySystem
    {
        readonly IWorld _world;
        readonly ResourceLedger _ledger;
        readonly BuildingRegistry _buildings;
        readonly TerrainMap _terrain;
        readonly MapGrid _grid;

        readonly List<BuildingInstance> _producers = new List<BuildingInstance>(128);
        readonly List<BuildingInstance> _healers = new List<BuildingInstance>(16);
        readonly List<UnitInstance> _nearbyUnits = new List<UnitInstance>(64);

        float _economyTimer;

        public EconomySystem(IWorld world, ResourceLedger ledger, BuildingRegistry buildings,
                             TerrainMap terrain, MapGrid grid)
        {
            _world = world;
            _ledger = ledger;
            _buildings = buildings;
            _terrain = terrain;
            _grid = grid;
        }

        public EconomyReport PlayerReport { get; private set; }
        public EconomyReport EnemyReport { get; private set; }

        /// <summary>Market trade prices (buy price per unit).</summary>
        public const int MarketFoodBuyPrice = 3;     // gold per food
        public const int MarketWoodBuyPrice = 2;
        public const int MarketStoneBuyPrice = 3;
        public const int MarketSellRate = 1;         // gold per surplus unit sold

        // =====================================================================
        //  Main tick (every simulation tick)
        // =====================================================================
        public void Tick(float dt)
        {
            AdvanceProduction(dt);
            ApplyHealAuras(dt);

            _economyTimer += dt;
            if (_economyTimer < Balance.Sim.EconomyIntervalSeconds) return;

            float elapsed = _economyTimer;
            _economyTimer = 0f;

            SettleEconomy(Team.Player, elapsed);
            SettleEconomy(Team.Enemy, elapsed);
        }

        void AdvanceProduction(float dt)
        {
            _producers.Clear();
            for (int i = 0; i < _buildings.All.Count; i++)
            {
                var b = _buildings.All[i];
                if (b != null && b.IsOperational && b.Definition.HasRecipe) _producers.Add(b);
            }

            for (int i = 0; i < _producers.Count; i++)
            {
                var b = _producers[i];
                var def = b.Definition;
                var recipe = def.Recipe;

                if (def.WorkerSlots > 0 && b.WorkerCount == 0)
                {
                    b.LastProductionRate = 0f;
                    continue;
                }
                if (b.IsFull)
                {
                    b.LastProductionRate = 0f;   // waiting for a hauler
                    continue;
                }

                float staffRatio = def.WorkerSlots > 0 ? (float)b.WorkerCount / def.WorkerSlots : 1f;
                float rate = b.WorkerBonus * Mathf.Max(0.15f, staffRatio) / Mathf.Max(0.5f, recipe.CycleSeconds);

                b.ProductionProgress += rate * dt;
                b.LastProductionRate = rate * recipe.OutputAmount * 60f;

                if (b.ProductionProgress < 1f) continue;
                b.ProductionProgress = 0f;
                CompleteCycle(b, recipe);
            }
        }

        void CompleteCycle(BuildingInstance b, ProductionRecipe recipe)
        {
            var team = b.Team;

            // --- inputs ------------------------------------------------------
            if (recipe.InputA != ResourceType.None && recipe.InputAAmount > 0)
            {
                if (_ledger.Get(team, recipe.InputA) < recipe.InputAAmount) return;
                _ledger.Take(team, recipe.InputA, recipe.InputAAmount);
            }

            // --- gatherers deplete the tile they work -------------------------
            if (recipe.RequiresDepletableTile)
            {
                if (!TryFindWorkTile(b, recipe.Output, out Int2 tile))
                {
                    // Nothing left to gather: try to re-gas the building by expanding
                    // the search once, then idle until the player reacts.
                    if (!TryFindWorkTile(b, recipe.Output, out tile, 26))
                    {
                        b.LastProductionRate = 0f;
                        return;
                    }
                }
                _terrain.ConsumeHarvest(tile);
            }

            // --- output -------------------------------------------------------
            if (recipe.Output != ResourceType.None && recipe.OutputAmount > 0)
            {
                if (b.StoredType != recipe.Output && b.StoredAmount > 0)
                {
                    // Stored a different good: push it out first so nothing is lost.
                    _ledger.Add(team, b.StoredType, b.StoredAmount);
                    b.StoredAmount = 0;
                }
                b.StoredType = recipe.Output;
                b.StoredAmount = Mathf.Min(b.StoredCapacity, b.StoredAmount + recipe.OutputAmount);
            }

            // Foresters plant trees instead of producing goods.
            if (recipe.Output == ResourceType.None && recipe.Job == JobType.Forester)
                PlantTreeNear(b);
        }

        bool TryFindWorkTile(BuildingInstance b, ResourceType resource, out Int2 tile, int radius = 12)
        {
            return _terrain.TryFindNearestDeposit(b.Rect.Center, resource, radius, out tile);
        }

        void PlantTreeNear(BuildingInstance b)
        {
            for (int attempt = 0; attempt < 12; attempt++)
            {
                var c = new Int2(b.Rect.x + _world.Rng.Range(-6, 7), b.Rect.y + _world.Rng.Range(-6, 7));
                if (!_terrain.InBounds(c)) continue;
                if (_terrain.HasVegetation(c)) continue;
                if (!_terrain.IsTerrainWalkable(c)) continue;
                if (_grid.IsOccupied(c)) continue;
                _terrain.SetVegetation(c, true);
                _terrain.SetHarvestBudget(c, 3);
                return;
            }
        }

        void ApplyHealAuras(float dt)
        {
            _healers.Clear();
            for (int i = 0; i < _buildings.All.Count; i++)
            {
                var b = _buildings.All[i];
                if (b != null && b.IsOperational && b.Definition.HealAura > 0f) _healers.Add(b);
            }
            if (_healers.Count == 0) return;

            var units = _world.Units;
            for (int h = 0; h < _healers.Count; h++)
            {
                var healer = _healers[h];
                float radius = healer.AuraRadius;
                units.QueryRadius(healer.Center, radius, _nearbyUnits);
                for (int u = 0; u < _nearbyUnits.Count; u++)
                {
                    var unit = _nearbyUnits[u];
                    if (unit.Team != healer.Team || !unit.IsAlive) continue;
                    if (unit.Health >= unit.MaxHealth) continue;
                    unit.Health = Mathf.Min(unit.MaxHealth, unit.Health + healer.Definition.HealAura * dt);
                }
            }
        }

        // =====================================================================
        //  Periodic settle: consumption, taxes, popularity inputs
        // =====================================================================
        void SettleEconomy(Team team, float elapsedSeconds)
        {
            var stats = team == Team.Player ? _world.PlayerKingdom : _world.EnemyKingdom;
            if (stats == null || !stats.KeepAlive) return;

            float minutes = elapsedSeconds / 60f;

            // ---- food consumption -------------------------------------------
            int mouths = stats.Peasants + Mathf.RoundToInt(stats.Military * 0.5f);
            float rationMultiplier = RationMultiplier(stats.Rations);
            float foodWanted = mouths * Balance.Population.FoodPerPeasantPerMinute * minutes * rationMultiplier;
            int foodNeeded = Mathf.FloorToInt(foodWanted);
            float fractional = foodWanted - foodNeeded;
            if (_world.Rng.Chance(fractional)) foodNeeded++;

            int foodConsumed = foodNeeded > 0 ? _ledger.Take(team, ResourceType.Food, foodNeeded) : 0;
            bool starving = foodNeeded > 0 && foodConsumed < foodNeeded;

            // ---- taxes ------------------------------------------------------
            float goldPerPeasant = TaxGoldPerMinute(stats.Taxes);
            float goldGained = stats.Peasants * goldPerPeasant * minutes;
            int goldInt = Mathf.FloorToInt(goldGained);
            float goldFrac = goldGained - goldInt;
            if (_world.Rng.Chance(goldFrac)) goldInt++;
            if (goldInt > 0) _ledger.Add(team, ResourceType.Gold, goldInt);
            else if (goldInt < 0) _ledger.Take(team, ResourceType.Gold, -goldInt);

            // ---- ale for the inns ------------------------------------------
            int inns = _buildings.CountOperational(team, BuildingId.Inn);
            float aleMinutes = minutes * 0.5f;
            if (inns > 0)
            {
                int aleWanted = Mathf.FloorToInt(inns * aleMinutes);
                if (aleWanted > 0) _ledger.Take(team, ResourceType.Ale, aleWanted);
            }

            // ---- market: emergency food imports ----------------------------
            if (starving && stats.AutoBuyFood && team == Team.Player)
            {
                int markets = _buildings.CountOperational(team, BuildingId.MarketPlace);
                if (markets > 0)
                {
                    int affordable = _ledger.Get(team, ResourceType.Gold) / MarketFoodBuyPrice;
                    int buy = Mathf.Clamp(affordable, 0, 40);
                    if (buy > 0 && _ledger.TrySpend(team, ResourceCost.Of(ResourceType.Gold, buy * MarketFoodBuyPrice)))
                    {
                        _ledger.Add(team, ResourceType.Food, buy);
                        EventBus.Publish(ToastEvent.Info("Market imported " + buy + " food"));
                    }
                }
            }

            if (starving && team == Team.Player)
            {
                EventBus.Publish(ToastEvent.Warn("Your people are starving!"));
            }

            // ---- feed the numbers back to the simulation -------------------
            var rates = _ledger.ConsumeRates(team, elapsedSeconds);
            stats.FoodRatePerMinute = rates[ResourceType.Food];
            stats.GoldRatePerMinute = rates[ResourceType.Gold];

            var report = new EconomyReport
            {
                FoodPerMinute = stats.FoodRatePerMinute,
                GoldPerMinute = stats.GoldRatePerMinute,
                AlePerMinute = rates[ResourceType.Ale],
                FoodStored = _ledger.Get(team, ResourceType.Food),
                AleStored = _ledger.Get(team, ResourceType.Ale),
                FoodMinutesLeft = 0f,
            };
            float netFood = stats.FoodRatePerMinute;
            report.FoodMinutesLeft = netFood >= 0f ? 999f
                : (netFood == 0f ? 999f : report.FoodStored / -netFood);
            if (netFood >= 0f) report.FoodMinutesLeft = 999f;

            if (team == Team.Player) PlayerReport = report;
            else EnemyReport = report;
        }

        public static float RationMultiplier(RationPolicy policy)
        {
            switch (policy)
            {
                case RationPolicy.None: return 0f;
                case RationPolicy.Half: return 0.5f;
                case RationPolicy.Extra: return 2f;
                default: return 1f;
            }
        }

        public static float TaxGoldPerMinute(TaxPolicy policy)
        {
            switch (policy)
            {
                // per peasant per minute
                case TaxPolicy.Generous: return -0.06f;
                case TaxPolicy.Low: return 0.02f;
                case TaxPolicy.High: return 0.09f;
                case TaxPolicy.Brutal: return 0.16f;
                default: return 0.05f;
            }
        }

        /// <summary>Nearest stockpile-like building that can accept a good.</summary>
        public BuildingInstance FindDropOff(Int2 from, Team team)
        {
            return _buildings.FindNearest(from, team,
                def => def.IsStoragePoint, true);
        }

        /// <summary>Directly deposits hauled goods (called by WorkerJobSystem).</summary>
        public int Deposit(Team team, ResourceType type, int amount)
        {
            return _ledger.Add(team, type, amount);
        }

        /// <summary>Consumes from the ledger (used by training).</summary>
        public bool TryConsume(Team team, ResourceCost cost)
        {
            return _ledger.TrySpend(team, cost);
        }
    }
}
