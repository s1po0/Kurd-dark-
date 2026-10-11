// -----------------------------------------------------------------------------
//  File: Config/UnitCatalog.cs
//  Purpose: Unit stat database for player troops, workers and the attacking AI.
//           Enemy variants are stat-modified clones of shared archetypes so a
//           single balance pass fixes both sides.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;

namespace KurdCastle.Config
{
    public static class UnitCatalog
    {
        static UnitDefinition[] _all;
        static Dictionary<UnitId, UnitDefinition> _byId;
        static readonly List<UnitDefinition> _trainable = new List<UnitDefinition>();

        public static UnitDefinition[] All { get { EnsureInit(); return _all; } }
        public static IReadOnlyList<UnitDefinition> PlayerTrainable { get { EnsureInit(); return _trainable; } }

        public static UnitDefinition Get(UnitId id)
        {
            EnsureInit();
            UnitDefinition def;
            return _byId.TryGetValue(id, out def) ? def : _byId[UnitId.Peasant];
        }

        /// <summary>Convenience for spawn code that only has an id.</summary>
        public static UnitDefinition Get(int id) { return Get((UnitId)id); }

        static void EnsureInit()
        {
            if (_all != null) return;
            var list = new List<UnitDefinition>(40);

            // ------------------------------- WORKERS -------------------------------
            list.Add(new UnitDefinition
            {
                Id = UnitId.Peasant, DisplayName = "Peasant", Role = UnitRole.Worker, Shape = UnitShape.Peasant,
                Description = "Gathers, hauls and can be drafted. The soul of your economy.",
                IsWorker = true, CanBeDrafted = true,
                MoveSpeed = Balance.Population.WorkerMoveSpeed, Radius = 0.24f, Clearance = 1,
                MaxHealth = (int)Balance.Population.MaxPeasantHealth, Armor = ArmorType.None,
                Damage = 4, DamageType = DamageType.Slash, AttackRange = 1.2f, AttackInterval = 1.6f,
                VisionRange = 7f, AggroRange = 4f,
                CanAttackBuildings = false, BuildingDamageMultiplier = 0.4f,
                PrimaryColor = new Color(0.78f, 0.70f, 0.52f), SecondaryColor = new Color(0.42f, 0.36f, 0.26f),
                VisualScale = 0.92f, TrainCost = ResourceCost.Zero, TrainTimeSeconds = 0f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.Engineer, DisplayName = "Engineer", Role = UnitRole.Support, Shape = UnitShape.Peasant,
                Description = "Repairs walls and machinery under fire, dug in behind the ramparts.",
                IsWorker = true, MoveSpeed = 3.0f, Radius = 0.26f, MaxHealth = 65, Armor = ArmorType.Leather,
                Damage = 5, DamageType = DamageType.Blunt, AttackRange = 1.4f, AttackInterval = 1.5f,
                VisionRange = 9f, AggroRange = 5f,
                PrimaryColor = new Color(0.60f, 0.58f, 0.52f), SecondaryColor = new Color(0.30f, 0.34f, 0.40f),
                TrainCost = new ResourceCost(gold: 40, iron: 20), TrainTimeSeconds = 16f,
                PopulationCost = 1f, BuildingDamageMultiplier = 0.5f,
            });

            // ------------------------------- RANGED --------------------------------
            list.Add(new UnitDefinition
            {
                Id = UnitId.Archer, DisplayName = "Archer", Role = UnitRole.Ranged, Shape = UnitShape.Archer,
                Description = "Cheap, quick to train, lethal from a parapet. Fragile in the open.",
                MoveSpeed = 3.7f, Radius = 0.26f, MaxHealth = 58, Armor = ArmorType.Leather,
                Damage = 7, DamageType = DamageType.Pierce, AttackRange = 8.5f, AttackInterval = 1.5f,
                ProjectileSpeed = 17f, Accuracy = 0.85f, VisionRange = 11f, AggroRange = 8.5f,
                PreferredRange = 7.5f, MoraleBase = 55f,
                PrimaryColor = new Color(0.48f, 0.58f, 0.34f), SecondaryColor = new Color(0.32f, 0.26f, 0.18f),
                TrainCost = new ResourceCost(gold: 20, weapons: 1), TrainTimeSeconds = 11f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.Crossbowman, DisplayName = "Crossbowman", Role = UnitRole.Ranged, Shape = UnitShape.Archer,
                Description = "Slow to wind, but bolts punch through mail and light walls.",
                MoveSpeed = 3.3f, Radius = 0.27f, MaxHealth = 74, Armor = ArmorType.Leather,
                Damage = 14, DamageType = DamageType.Pierce, AttackRange = 9.5f, AttackInterval = 2.7f,
                ProjectileSpeed = 24f, Accuracy = 0.80f, VisionRange = 11f, AggroRange = 9f,
                PreferredRange = 8.5f, BuildingDamageMultiplier = 0.5f,
                PrimaryColor = new Color(0.44f, 0.52f, 0.52f), SecondaryColor = new Color(0.28f, 0.24f, 0.22f),
                TrainCost = new ResourceCost(gold: 35, weapons: 2), TrainTimeSeconds = 18f,
            });

            // ------------------------------- MELEE ---------------------------------
            list.Add(new UnitDefinition
            {
                Id = UnitId.Spearman, DisplayName = "Spearman", Role = UnitRole.Melee, Shape = UnitShape.Spearman,
                Description = "Reaches past a shield wall. Holds a breach better than anyone.",
                MoveSpeed = 3.3f, Radius = 0.28f, MaxHealth = 95, Armor = ArmorType.Mail,
                Damage = 10, DamageType = DamageType.Pierce, AttackRange = 1.9f, AttackInterval = 1.35f,
                VisionRange = 9f, AggroRange = 7.5f, MoraleBase = 60f,
                PrimaryColor = new Color(0.56f, 0.52f, 0.42f), SecondaryColor = new Color(0.36f, 0.30f, 0.24f),
                TrainCost = new ResourceCost(gold: 18, weapons: 1), TrainTimeSeconds = 10f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.Swordsman, DisplayName = "Swordsman", Role = UnitRole.Melee, Shape = UnitShape.Swordsman,
                Description = "Armoured line infantry. Expensive, and worth every coin.",
                MoveSpeed = 3.2f, Radius = 0.29f, MaxHealth = 125, Armor = ArmorType.Plate,
                Damage = 13, DamageType = DamageType.Slash, AttackRange = 1.45f, AttackInterval = 1.1f,
                VisionRange = 9f, AggroRange = 8f, MoraleBase = 70f,
                PrimaryColor = new Color(0.62f, 0.60f, 0.58f), SecondaryColor = new Color(0.34f, 0.30f, 0.28f),
                TrainCost = new ResourceCost(gold: 30, weapons: 1, armor: 1), TrainTimeSeconds = 16f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.Knight, DisplayName = "Knight", Role = UnitRole.Melee, Shape = UnitShape.Knight,
                Description = "Heavy cavalry. Rides down archers and arrives where the line is breaking.",
                MoveSpeed = 5.4f, Radius = 0.34f, MaxHealth = 230, Armor = ArmorType.Plate,
                Damage = 22, DamageType = DamageType.Slash, AttackRange = 1.6f, AttackInterval = 1.3f,
                VisionRange = 12f, AggroRange = 9f, MoraleBase = 85f, VisualScale = 1.15f,
                PrimaryColor = new Color(0.52f, 0.36f, 0.34f), SecondaryColor = new Color(0.72f, 0.70f, 0.66f),
                TrainCost = new ResourceCost(gold: 70, weapons: 1, armor: 2), TrainTimeSeconds = 28f,
                PopulationCost = 2f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.Lord, DisplayName = "Lord", Role = UnitRole.Support, Shape = UnitShape.Lord,
                Description = "Your liege. Inspiring, deadly, and irreplaceable.",
                MoveSpeed = 3.4f, Radius = 0.30f, MaxHealth = 280, Armor = ArmorType.Plate,
                Damage = 26, DamageType = DamageType.Slash, AttackRange = 1.5f, AttackInterval = 1.0f,
                VisionRange = 14f, AggroRange = 9f, MoraleBase = 100f, VisualScale = 1.2f,
                PrimaryColor = new Color(0.80f, 0.68f, 0.28f), SecondaryColor = new Color(0.42f, 0.20f, 0.24f),
                TrainCost = ResourceCost.Zero, TrainTimeSeconds = 0f,
            });

            // ------------------------------- ENEMY ---------------------------------
            list.Add(new UnitDefinition
            {
                Id = UnitId.Raider, DisplayName = "Raider", Role = UnitRole.Melee, Shape = UnitShape.Swordsman,
                Description = "Marauder. Cheap, fast, and burns your outlying farms.",
                MoveSpeed = 3.9f, Radius = 0.27f, MaxHealth = 60, Armor = ArmorType.None,
                Damage = 8, DamageType = DamageType.Slash, AttackRange = 1.4f, AttackInterval = 1.2f,
                VisionRange = 10f, AggroRange = 9f, MoraleBase = 40f,
                PrimaryColor = new Color(0.42f, 0.26f, 0.26f), SecondaryColor = new Color(0.26f, 0.18f, 0.16f),
                TrainCost = ResourceCost.Zero,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.EnemyArcher, DisplayName = "Raider Archer", Role = UnitRole.Ranged, Shape = UnitShape.Archer,
                Description = "Skirmisher. Screens the siege works with harassing fire.",
                MoveSpeed = 3.5f, Radius = 0.26f, MaxHealth = 52, Armor = ArmorType.None,
                Damage = 6, DamageType = DamageType.Pierce, AttackRange = 8f, AttackInterval = 1.7f,
                ProjectileSpeed = 15f, Accuracy = 0.75f, VisionRange = 10f, AggroRange = 8f,
                PreferredRange = 7f,
                PrimaryColor = new Color(0.44f, 0.30f, 0.28f), SecondaryColor = new Color(0.24f, 0.16f, 0.14f),
                TrainCost = ResourceCost.Zero,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.EnemyBrute, DisplayName = "Brute", Role = UnitRole.Melee, Shape = UnitShape.Swordsman,
                Description = "Armoured shock trooper. Sent in first through a breach.",
                MoveSpeed = 2.9f, Radius = 0.32f, MaxHealth = 170, Armor = ArmorType.Mail,
                Damage = 17, DamageType = DamageType.Slash, AttackRange = 1.5f, AttackInterval = 1.35f,
                VisionRange = 9f, AggroRange = 8f, MoraleBase = 65f, VisualScale = 1.18f,
                PrimaryColor = new Color(0.36f, 0.24f, 0.22f), SecondaryColor = new Color(0.54f, 0.50f, 0.46f),
                TrainCost = ResourceCost.Zero,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.Ladderman, DisplayName = "Ladderman", Role = UnitRole.Ladder, Shape = UnitShape.Ladder,
                Description = "Carries scaling ladders. Goes over your walls instead of through them.",
                MoveSpeed = 3.4f, Radius = 0.28f, MaxHealth = 80, Armor = ArmorType.Leather,
                Damage = 9, DamageType = DamageType.Pierce, AttackRange = 1.5f, AttackInterval = 1.3f,
                CanBypassWalls = true, VisionRange = 9f, AggroRange = 7f,
                PrimaryColor = new Color(0.50f, 0.40f, 0.24f), SecondaryColor = new Color(0.28f, 0.20f, 0.14f),
                TrainCost = ResourceCost.Zero,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.BatteringRam, DisplayName = "Battering Ram", Role = UnitRole.Siege, Shape = UnitShape.Ram,
                Description = "A roof of hides over a tree trunk. Shatters gates and palisades.",
                MoveSpeed = 1.9f, Radius = 0.55f, Clearance = 2, MaxHealth = 340, Armor = ArmorType.Wood,
                Damage = 55, DamageType = DamageType.Siege, AttackRange = 2.0f, AttackInterval = 3.0f,
                CanAttackUnits = false, BuildingDamageMultiplier = 2.2f, VisionRange = 8f, AggroRange = 6f,
                PrimaryColor = new Color(0.46f, 0.34f, 0.22f), SecondaryColor = new Color(0.30f, 0.22f, 0.14f),
                VisualScale = 1.4f, TrainCost = ResourceCost.Zero, PopulationCost = 2f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.Catapult, DisplayName = "Catapult", Role = UnitRole.Siege, Shape = UnitShape.Catapult,
                Description = "Lobs boulders over walls. Break it before it finds your keep.",
                MoveSpeed = 1.6f, Radius = 0.6f, Clearance = 2, MaxHealth = 280, Armor = ArmorType.Wood,
                Damage = 65, DamageType = DamageType.Siege, AttackRange = 13f, AttackInterval = 5.5f,
                ProjectileSpeed = 11f, Accuracy = 0.62f, SplashRadius = 1.6f,
                CanBypassWalls = true, BuildingDamageMultiplier = 2.5f, VisionRange = 14f, AggroRange = 11f,
                PreferredRange = 12f, VisualScale = 1.5f,
                PrimaryColor = new Color(0.40f, 0.32f, 0.24f), SecondaryColor = new Color(0.26f, 0.20f, 0.14f),
                TrainCost = ResourceCost.Zero, PopulationCost = 3f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.SiegeTowerUnit, DisplayName = "Siege Tower", Role = UnitRole.Siege, Shape = UnitShape.SiegeTower,
                Description = "A shielded stairway on wheels. Spills troops straight onto your parapet.",
                MoveSpeed = 1.7f, Radius = 0.62f, Clearance = 2, MaxHealth = 480, Armor = ArmorType.Wood,
                Damage = 30, DamageType = DamageType.Siege, AttackRange = 1.8f, AttackInterval = 2.6f,
                CanBypassWalls = true, BuildingDamageMultiplier = 0.6f, VisionRange = 10f, AggroRange = 7f,
                VisualScale = 1.6f,
                PrimaryColor = new Color(0.38f, 0.30f, 0.22f), SecondaryColor = new Color(0.24f, 0.18f, 0.12f),
                TrainCost = ResourceCost.Zero, PopulationCost = 3f,
            });

            list.Add(new UnitDefinition
            {
                Id = UnitId.EnemyBoss, DisplayName = "War Chief", Role = UnitRole.Support, Shape = UnitShape.Lord,
                Description = "The warlord leading the siege. Slaying him breaks the horde.",
                MoveSpeed = 3.3f, Radius = 0.34f, MaxHealth = 750, Armor = ArmorType.Plate,
                Damage = 34, DamageType = DamageType.Slash, AttackRange = 1.7f, AttackInterval = 1.15f,
                VisionRange = 14f, AggroRange = 10f, MoraleBase = 95f, VisualScale = 1.28f,
                PrimaryColor = new Color(0.30f, 0.18f, 0.20f), SecondaryColor = new Color(0.62f, 0.52f, 0.24f),
                TrainCost = ResourceCost.Zero, PopulationCost = 3f,
            });

            _all = list.ToArray();
            _byId = new Dictionary<UnitId, UnitDefinition>(_all.Length);
            for (int i = 0; i < _all.Length; i++) _byId[_all[i].Id] = _all[i];

            AddTrainable(_trainable, UnitId.Archer);
            AddTrainable(_trainable, UnitId.Crossbowman);
            AddTrainable(_trainable, UnitId.Spearman);
            AddTrainable(_trainable, UnitId.Swordsman);
            AddTrainable(_trainable, UnitId.Knight);
            AddTrainable(_trainable, UnitId.Engineer);
        }

        static void AddTrainable(List<UnitDefinition> target, UnitId id)
        {
            var def = _byId[id];
            if (def != null) target.Add(def);
        }
    }

    /// <summary>Enemy army composition table + siege escalation rules.</summary>
    public static class WaveTable
    {
        public struct Squad
        {
            public UnitId Unit;
            public int Count;
            public Squad(UnitId u, int c) { Unit = u; Count = c; }
        }

        public struct Wave
        {
            public int Index;
            public float DelaySeconds;
            public string Title;
            public Squad[] Squads;
            public bool HasSiege;
            public int GoldReward;
            /// <summary>AI starts with this much "morale": raiders flee less when high.</summary>
            public float Aggression;
        }

        static Wave[] _waves;

        public static Wave[] All { get { if (_waves == null) Build(); return _waves; } }

        static void Build()
        {
            _waves = new Wave[]
            {
                new Wave
                {
                    Index = 0, DelaySeconds = Balance.Progression.FirstWaveDelay,
                    Title = "Scouting Party", HasSiege = false, GoldReward = 25, Aggression = 0.5f,
                    Squads = new[] { new Squad(UnitId.Raider, 4), new Squad(UnitId.EnemyArcher, 2) },
                },
                new Wave
                {
                    Index = 1, DelaySeconds = 105f,
                    Title = "Marauders", HasSiege = false, GoldReward = 35, Aggression = 0.6f,
                    Squads = new[] { new Squad(UnitId.Raider, 7), new Squad(UnitId.EnemyArcher, 3) },
                },
                new Wave
                {
                    Index = 2, DelaySeconds = 115f,
                    Title = "The First Ram", HasSiege = true, GoldReward = 50, Aggression = 0.7f,
                    Squads = new[]
                    {
                        new Squad(UnitId.Raider, 8), new Squad(UnitId.EnemyArcher, 4),
                        new Squad(UnitId.BatteringRam, 1), new Squad(UnitId.Ladderman, 2),
                    },
                },
                new Wave
                {
                    Index = 3, DelaySeconds = 120f,
                    Title = "Brute Column", HasSiege = true, GoldReward = 60, Aggression = 0.8f,
                    Squads = new[]
                    {
                        new Squad(UnitId.EnemyBrute, 6), new Squad(UnitId.Raider, 6),
                        new Squad(UnitId.EnemyArcher, 5), new Squad(UnitId.BatteringRam, 1),
                        new Squad(UnitId.Ladderman, 4),
                    },
                },
                new Wave
                {
                    Index = 4, DelaySeconds = 135f,
                    Title = "Catapult Train", HasSiege = true, GoldReward = 75, Aggression = 0.9f,
                    Squads = new[]
                    {
                        new Squad(UnitId.EnemyBrute, 8), new Squad(UnitId.EnemyArcher, 6),
                        new Squad(UnitId.Catapult, 2), new Squad(UnitId.BatteringRam, 2),
                        new Squad(UnitId.Ladderman, 5),
                    },
                },
                new Wave
                {
                    Index = 5, DelaySeconds = 150f,
                    Title = "The Warlord's Host", HasSiege = true, GoldReward = 120, Aggression = 1f,
                    Squads = new[]
                    {
                        new Squad(UnitId.EnemyBrute, 10), new Squad(UnitId.EnemyArcher, 8),
                        new Squad(UnitId.Catapult, 2), new Squad(UnitId.SiegeTowerUnit, 1),
                        new Squad(UnitId.BatteringRam, 2), new Squad(UnitId.Ladderman, 6),
                        new Squad(UnitId.EnemyBoss, 1),
                    },
                },
            };
        }

        public static int TotalUnitsInWave(int index)
        {
            var waves = All;
            if (index < 0 || index >= waves.Length) return 0;
            int total = 0;
            var squads = waves[index].Squads;
            for (int i = 0; i < squads.Length; i++) total += squads[i].Count;
            return total;
        }

        public static int TotalUnitsAllWaves()
        {
            int total = 0;
            for (int i = 0; i < All.Length; i++) total += TotalUnitsInWave(i);
            return total;
        }
    }
}
