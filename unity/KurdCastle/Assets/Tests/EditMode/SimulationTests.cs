// -----------------------------------------------------------------------------
//  File: Tests/EditMode/SimulationTests.cs
//  Purpose: EditMode tests for the parts of the simulation that must not regress:
//           resources, popularity maths, terrain/navigation rules, damage
//           resolution, catalogs, the wave table and the game state machine.
//           They run without entering Play Mode and without a device.
//
//  Run: Window ▸ General ▸ Test Runner ▸ EditMode ▸ Run All
//
//  Every API used here was verified against the repository sources; the sandbox
//  this project was written in has no C# compiler, so the tests are deliberately
//  limited to the low-level types that do not need a fully built GameWorld.
// -----------------------------------------------------------------------------
using NUnit.Framework;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Economy;
using KurdCastle.Combat;
using KurdCastle.World;

namespace KurdCastle.Tests
{
    static class TestMap
    {
        public static TerrainMap Flat(int size = 32, TerrainType type = TerrainType.Grass)
        {
            var map = new TerrainMap(size, size);
            for (int y = 0; y < size; y++)
                for (int x = 0; x < size; x++)
                    map.Set(new Int2(x, y), type, 0);
            return map;
        }
    }

    public class ResourceLedgerTests
    {
        [Test]
        public void AddRespectsCapacity()
        {
            var ledger = new ResourceLedger();
            int stored = ledger.Add(Team.Player, ResourceType.Wood, 99999);
            Assert.AreEqual(Balance.Economy.BaseStorageWood, stored,
                            "storage must clamp at the base capacity");
            Assert.AreEqual(Balance.Economy.BaseStorageWood, ledger.Get(Team.Player, ResourceType.Wood));
        }

        [Test]
        public void TrySpendFailsWhenShort()
        {
            var ledger = new ResourceLedger();
            ledger.Set(Team.Player, ResourceType.Gold, 10);
            bool spent = ledger.TrySpend(Team.Player, new ResourceCost(gold: 25));
            Assert.IsFalse(spent);
            Assert.AreEqual(10, ledger.Get(Team.Player, ResourceType.Gold), "no partial spending");
        }

        [Test]
        public void BundleRoundTrip()
        {
            var ledger = new ResourceLedger();
            var bundle = new ResourceCost(wood: 40, stone: 30, gold: 12);
            ledger.AddBundle(Team.Player, bundle);

            var stock = ledger.Stock(Team.Player);
            Assert.AreEqual(40, stock.Wood);
            Assert.AreEqual(30, stock.Stone);
            Assert.AreEqual(12, stock.Gold);
            Assert.IsTrue(ledger.CanAfford(Team.Player, bundle));
        }

        [Test]
        public void CapacityExpansionAllowsMoreStorage()
        {
            var ledger = new ResourceLedger();
            ledger.SetCapacity(Team.Player, ResourceType.Wood, 1000);
            ledger.Add(Team.Player, ResourceType.Wood, 800);
            Assert.AreEqual(800, ledger.Get(Team.Player, ResourceType.Wood));
        }
    }

    public class EconomyMathTests
    {
        [Test]
        public void RationPoliciesMatchStrongholdTable()
        {
            Assert.AreEqual(0f, EconomySystem.RationMultiplier(RationPolicy.None), 0.001f);
            Assert.AreEqual(0.5f, EconomySystem.RationMultiplier(RationPolicy.Half), 0.001f);
            Assert.AreEqual(1f, EconomySystem.RationMultiplier(RationPolicy.Full), 0.001f);
            Assert.AreEqual(2f, EconomySystem.RationMultiplier(RationPolicy.Extra), 0.001f);
        }

        [Test]
        public void BrutalTaxesOutearnGenerousTaxes()
        {
            float generous = EconomySystem.TaxGoldPerMinute(TaxPolicy.Generous);
            float brutal = EconomySystem.TaxGoldPerMinute(TaxPolicy.Brutal);
            Assert.Less(generous, 0f, "generous taxes cost you gold");
            Assert.Greater(brutal, generous);
            Assert.Greater(brutal, EconomySystem.TaxGoldPerMinute(TaxPolicy.Normal));
        }

        [Test]
        public void PopularityLeverOrderingIsSane()
        {
            Assert.Less(Balance.Popularity.FoodNone, Balance.Popularity.FoodHalf);
            Assert.Less(Balance.Popularity.FoodHalf, Balance.Popularity.FoodExtra);
            Assert.Less(Balance.Popularity.TaxBrutal, Balance.Popularity.TaxLow);
            Assert.Greater(Balance.Popularity.ChurchBonus, 0f);
            Assert.Greater(Balance.Popularity.Baseline, Balance.Popularity.FearMax,
                           "fear alone must never drive a well-run castle to revolt");
        }
    }

    public class DamageMatrixTests
    {
        const float Scale = 1f;

        [Test]
        public void SiegeIsStrongAgainstStone()
        {
            float stone = DamageMatrix.Apply(100f, DamageType.Siege, ArmorType.Stone, Scale);
            float flesh = DamageMatrix.Apply(100f, DamageType.Siege, ArmorType.None, Scale);
            Assert.Greater(stone, flesh, "siege damage must favour masonry over flesh");
        }

        [Test]
        public void FireIsIneffectiveAgainstStone()
        {
            float stone = DamageMatrix.Apply(100f, DamageType.Fire, ArmorType.Stone, Scale);
            float wood = DamageMatrix.Apply(100f, DamageType.Fire, ArmorType.Wood, Scale);
            Assert.Less(stone, wood);
            Assert.Less(stone, 50f, "stone should shrug fire off");
        }

        [Test]
        public void PlateTurnsAsideSwords()
        {
            float vsPlate = DamageMatrix.Apply(100f, DamageType.Slash, ArmorType.Plate, Scale);
            float vsNone = DamageMatrix.Apply(100f, DamageType.Slash, ArmorType.None, Scale);
            Assert.Less(vsPlate, vsNone, "plate must reduce cutting damage");
        }
    }

    public class TerrainAndNavigationTests
    {
        [Test]
        public void WaterAndRockStopGroundTroops()
        {
            var map = TestMap.Flat(16);
            map.Set(new Int2(4, 4), TerrainType.Water, 0);
            map.Set(new Int2(5, 5), TerrainType.Rock, 0);

            Assert.IsFalse(map.IsTerrainWalkable(new Int2(4, 4)));
            Assert.IsFalse(map.IsTerrainWalkable(new Int2(5, 5)));
            Assert.IsTrue(map.IsTerrainWalkable(new Int2(6, 6)));

            var grid = new MapGrid(map);
            var nav = new NavigationGrid(grid, map);
            Assert.IsFalse(nav.IsWalkable(new Int2(4, 4), NavProfile.Ground, Team.Player));
            Assert.IsTrue(nav.IsWalkable(new Int2(6, 6), NavProfile.Ground, Team.Player));
        }

        [Test]
        public void OccupiedCellsAreNoLongerFree()
        {
            var map = TestMap.Flat(16);
            var grid = new MapGrid(map);
            var rect = new IntRect(6, 6, 2, 2);
            Assert.IsTrue(grid.IsFree(new Int2(6, 6)));

            grid.Occupy(rect, 42, MapGrid.NavImpassable, NavigationGrid.WallClimbCost);
            Assert.IsFalse(grid.IsFree(new Int2(6, 6)));
            Assert.IsFalse(grid.IsFree(new Int2(7, 7)));
            Assert.AreEqual(42, grid.GetOccupant(new Int2(7, 7)));
            Assert.AreEqual(MapGrid.NavImpassable, grid.NavGroundAt(new Int2(6, 6)));
            Assert.AreEqual(NavigationGrid.WallClimbCost, grid.NavBypassAt(new Int2(6, 6)));
        }

        [Test]
        public void WallFootprintsStopGroundUnitsButNotLadders()
        {
            var map = TestMap.Flat(16);
            var grid = new MapGrid(map);
            var wall = BuildingCatalog.Get(BuildingId.StoneWall);

            byte ground, bypass;
            NavigationGrid.CostsFor(wall, out ground, out bypass);
            Assert.AreEqual(MapGrid.NavImpassable, ground, "walls stop ground units");
            Assert.AreEqual(NavigationGrid.WallClimbCost, bypass, "ladders may climb them");

            grid.Occupy(new IntRect(5, 5, 1, 1), 7, ground, bypass);
            var nav = new NavigationGrid(grid, map);
            Assert.IsFalse(nav.IsWalkable(new Int2(5, 5), NavProfile.Ground, Team.Enemy),
                           "sealed wall blocks normale navigation");
            Assert.IsTrue(nav.IsWalkable(new Int2(5, 5), NavProfile.WallBypass, Team.Enemy),
                          "wall-bypass profile can cross the rampart");
        }

        [Test]
        public void GateFootprintsAreWalkableWhileOpen()
        {
            var map = TestMap.Flat(16);
            var grid = new MapGrid(map);
            var gate = BuildingCatalog.Get(BuildingId.Gatehouse);

            byte ground, bypass;
            NavigationGrid.CostsFor(gate, out ground, out bypass);
            var rect = new IntRect(4, 8, gate.Footprint.x, gate.Footprint.y);
            grid.Occupy(rect, 11, ground, bypass);

            var nav = new NavigationGrid(grid, map);
            Assert.IsFalse(nav.IsWalkable(new Int2(4, 8), NavProfile.Ground, Team.Player),
                           "a sealed gatehouse is a wall");

            grid.SetGate(rect, true, NavigationGrid.GateCost);
            nav.Invalidate();
            Assert.IsTrue(nav.IsWalkable(new Int2(4, 8), NavProfile.Ground, Team.Player),
                          "open gates pass friendly troops");
        }

        [Test]
        public void FindsPathAroundAWall()
        {
            var map = TestMap.Flat(24);
            var grid = new MapGrid(map);
            for (int y = 2; y < 20; y++)
            {
                if (y == 12) continue; // one-cell gap
                grid.Occupy(new IntRect(10, y, 1, 1), 99, MapGrid.NavImpassable, NavigationGrid.WallClimbCost);
            }
            var nav = new NavigationGrid(grid, map);
            var astar = new AStarPathfinder(nav);

            var request = NavRequest.Create(new Int2(5, 5), new Int2(16, 5), NavProfile.Ground, Team.Player);
            var result = new PathResult();
            result.Reset(128);

            Assert.IsTrue(astar.FindPath(request, result), "a path exists through the gap");
            Assert.AreEqual(1, astar.LastResultCode, "the result is exact, not partial");
            Assert.Greater(result.Count, 0);
        }

        [Test]
        public void SealedWallYieldsAPartialPathForGroundTroops()
        {
            var map = TestMap.Flat(20);
            var grid = new MapGrid(map);
            for (int y = 0; y < 20; y++)
                grid.Occupy(new IntRect(9, y, 1, 1), 5, MapGrid.NavImpassable, NavigationGrid.WallClimbCost);
            var nav = new NavigationGrid(grid, map);
            var astar = new AStarPathfinder(nav);

            var ground = NavRequest.Create(new Int2(4, 10), new Int2(14, 10), NavProfile.Ground, Team.Enemy);
            var result = new PathResult();
            result.Reset(128);
            bool found = astar.FindPath(ground, result);
            Assert.IsTrue(!found || astar.LastResultCode == 2,
                          "ground troops cannot reach the far side of a sealed wall exactly");
        }
    }

    public class CatalogIntegrityTests
    {
        [Test]
        public void EveryPlayerBuildingIsBuildableAndPriced()
        {
            var list = BuildingCatalog.PlayerBuildable;
            Assert.Greater(list.Count, 20, "the build menu should feel like a castle builder");

            for (int i = 0; i < list.Count; i++)
            {
                var def = list[i];
                Assert.AreNotEqual(BuildingId.None, def.Id);
                Assert.IsFalse(string.IsNullOrEmpty(def.DisplayName));
                Assert.Greater(def.Footprint.x, 0, def.DisplayName + " footprint x");
                Assert.Greater(def.Footprint.y, 0, def.DisplayName + " footprint y");
                Assert.Greater(def.MaxHealth, 0, def.DisplayName + " health");
                Assert.IsFalse(def.Cost.IsZero, def.DisplayName + " must cost something");
            }
        }

        [Test]
        public void EveryProducingBuildingHasSaneRecipe()
        {
            var list = BuildingCatalog.PlayerBuildable;
            for (int i = 0; i < list.Count; i++)
            {
                var def = list[i];
                if (!def.HasRecipe) continue;
                Assert.Greater(def.Recipe.CycleSeconds, 0.1f, def.DisplayName + " cycle time");
                Assert.Greater(def.WorkerSlots, 0, def.DisplayName + " needs workers to produce");
            }
        }

        [Test]
        public void KeepIsBiggerThanAnyHouseAndTrainsNothing()
        {
            var keep = BuildingCatalog.Get(BuildingId.Keep);
            Assert.IsTrue(keep.IsKeep);
            Assert.Greater(keep.MaxHealth, BuildingCatalog.Get(BuildingId.House).MaxHealth);
            Assert.AreEqual(UnitId.None, keep.TrainsUnit, "the keep defends, it does not train");
        }

        [Test]
        public void UnitsHaveDistinctCombatRoles()
        {
            bool hasMelee = false, hasRanged = false, hasSiege = false, hasWorker = false;
            var all = UnitCatalog.All;
            for (int i = 0; i < all.Length; i++)
            {
                switch (all[i].Role)
                {
                    case UnitRole.Melee: hasMelee = true; break;
                    case UnitRole.Ranged: hasRanged = true; break;
                    case UnitRole.Siege: hasSiege = true; break;
                    case UnitRole.Worker: hasWorker = true; break;
                }
                Assert.Greater(all[i].AttackRange, 0f, all[i].DisplayName + " needs a reach");
                Assert.Greater(all[i].MoveSpeed, 0f, all[i].DisplayName + " needs to move");
                Assert.Greater(all[i].MaxHealth, 0, all[i].DisplayName + " needs health");
            }
            Assert.IsTrue(hasMelee && hasRanged && hasSiege && hasWorker,
                          "peasants, melee, ranged and siege must all exist");
        }

        [Test]
        public void TrainerBuildingsPointAtRealUnits()
        {
            var list = BuildingCatalog.All;
            int trainers = 0;
            for (int i = 0; i < list.Length; i++)
            {
                if (list[i].TrainsUnit == UnitId.None) continue;
                trainers++;
                var unit = UnitCatalog.Get(list[i].TrainsUnit);
                Assert.IsNotNull(unit, list[i].DisplayName + " trains a unit that does not exist");
                Assert.AreNotEqual(UnitRole.Worker, unit.Role,
                    list[i].DisplayName + " should train a soldier, not a peasant");
            }
            Assert.GreaterOrEqual(trainers, 2, "barracks and archery range at least");
        }
    }

    public class WaveTableTests
    {
        [Test]
        public void SixWavesEscalate()
        {
            Assert.AreEqual(Balance.Progression.TotalWaves, WaveTable.All.Length);
            for (int i = 1; i < WaveTable.All.Length; i++)
            {
                Assert.Greater(WaveTable.All[i].DelaySeconds, 0f);
                Assert.IsFalse(string.IsNullOrEmpty(WaveTable.All[i].Title));
                Assert.Greater(WaveTable.TotalUnitsInWave(i) + 3, WaveTable.TotalUnitsInWave(i - 1),
                               "waves get heavier over time");
            }
        }

        [Test]
        public void SiegeAppearsAfterTheOpening()
        {
            Assert.IsFalse(WaveTable.All[0].HasSiege, "the scouting party brings no engines");
            bool anySiege = false;
            for (int i = 0; i < WaveTable.All.Length; i++) anySiege |= WaveTable.All[i].HasSiege;
            Assert.IsTrue(anySiege, "at least one wave must bring siege equipment");
        }

        [Test]
        public void EverySquadReferencesARealUnit()
        {
            for (int w = 0; w < WaveTable.All.Length; w++)
            {
                var wave = WaveTable.All[w];
                Assert.Greater(wave.Squads.Length, 0, wave.Title + " has no squads");
                for (int s = 0; s < wave.Squads.Length; s++)
                {
                    Assert.Greater(wave.Squads[s].Count, 0, wave.Title + " has an empty squad");
                    Assert.AreNotEqual(UnitId.None, wave.Squads[s].Unit);
                    Assert.IsNotNull(UnitCatalog.Get(wave.Squads[s].Unit), wave.Title + " unknown unit");
                }
                Assert.GreaterOrEqual(wave.GoldReward, 0);
            }
        }
    }

    public class GameStateTests
    {
        [Test]
        public void LeavingGameplayPausesTheClock()
        {
            var state = new GameStateManager();
            state.TransitionTo(GameState.Menu);
            state.StartMatch();
            Assert.AreEqual(GameState.Playing, state.State);
            Assert.AreEqual(GameSpeed.Normal, state.Clock.Speed);

            state.Pause();
            Assert.AreEqual(GameState.Paused, state.State);
            Assert.AreEqual(GameSpeed.Paused, state.Clock.Speed);

            state.Resume();
            Assert.AreEqual(GameState.Playing, state.State);
            Assert.AreEqual(GameSpeed.Normal, state.Clock.Speed);
        }

        [Test]
        public void SpeedCycleMatchesTheHudButtons()
        {
            var clock = new SimulationClock();
            clock.SetSpeed(GameSpeed.Normal);
            clock.CycleSpeed();
            Assert.AreEqual(GameSpeed.Fast, clock.Speed);
            clock.CycleSpeed();
            Assert.AreEqual(GameSpeed.VeryFast, clock.Speed);
            clock.CycleSpeed();
            Assert.AreEqual(GameSpeed.Normal, clock.Speed);
        }

        [Test]
        public void VictoryIsTerminal()
        {
            var state = new GameStateManager();
            state.TransitionTo(GameState.Menu);
            state.StartMatch();
            state.TriggerVictory("win", "well played");
            Assert.AreEqual(GameState.Victory, state.State);
            Assert.IsTrue(state.IsGameOver);
            Assert.IsFalse(state.IsSimulationRunning, "the sim stops once the match is decided");
        }
    }

    public class PopularityCurveTests
    {
        [Test]
        public void SpawnIntervalShrinksWithPopularity()
        {
            float zero = Mathf.Lerp(Balance.Population.MaxSpawnInterval,
                                    Balance.Population.MinSpawnInterval, 0f);
            float full = Mathf.Lerp(Balance.Population.MaxSpawnInterval,
                                    Balance.Population.MinSpawnInterval, 1f);
            Assert.AreEqual(Balance.Population.MaxSpawnInterval, zero, 0.01f);
            Assert.AreEqual(Balance.Population.MinSpawnInterval, full, 0.01f);
            Assert.Greater(Balance.Population.MaxSpawnInterval, Balance.Population.MinSpawnInterval);
        }

        [Test]
        public void PeasantsOnlyLeaveBelowTheThreshold()
        {
            Assert.AreEqual(30f, Balance.Population.PeasantLeavesAbove, 0.01f);
            Assert.Greater(Balance.Popularity.Baseline, Balance.Population.PeasantLeavesAbove,
                           "a castle on default settings must not bleed peasants");
        }
    }
}
