// -----------------------------------------------------------------------------
//  File: Config/UnitDefinition.cs
//  Purpose: Data model for every unit type (player + AI) with combat stats and
//           the procedural visual palette used when no art assets exist.
// -----------------------------------------------------------------------------
using System;
using UnityEngine;

namespace KurdCastle.Config
{
    public enum UnitRole : byte
    {
        Worker = 0,    // peasants: economy, hauling, building
        Melee = 1,
        Ranged = 2,
        Siege = 3,     // rams, catapults: anti-structure
        Support = 4,   // lord/hero, healers
        Ladder = 5,    // wall-scaling infantry
    }

    public sealed class UnitDefinition
    {
        // ---- identity ----
        public UnitId Id;
        public string DisplayName = "Unit";
        public string Description = "";
        public UnitRole Role = UnitRole.Melee;
        public UnitShape Shape = UnitShape.Swordsman;
        public bool IsWorker = false;
        /// <summary>Workers can be drafted into the barracks.</summary>
        public bool CanBeDrafted = false;

        // ---- movement ----
        public float MoveSpeed = 3.4f;
        public float TurnSpeedDeg = 540f;
        public float Radius = 0.28f;
        /// <summary>Pathfinding clearance in cells (1 = single-cell corridors).</summary>
        public int Clearance = 1;
        public float VisionRange = 9f;
        public float AggroRange = 8f;
        public float PreferredRange = 0f;

        // ---- durability ----
        public int MaxHealth = 80;
        public ArmorType Armor = ArmorType.Leather;
        public float MoraleBase = 50f;

        // ---- offence ----
        public DamageType DamageType = DamageType.Slash;
        public int Damage = 8;
        public float AttackRange = 1.4f;
        public float AttackInterval = 1.15f;
        /// <summary>Time between the swing starting and damage landing (animation beat).</summary>
        public float AttackWindup = 0.35f;
        /// <summary>0 = melee; otherwise projectile speed in cells/second.</summary>
        public float ProjectileSpeed = 0f;
        public float Accuracy = 1f;
        public float SplashRadius = 0f;
        public float BuildingDamageMultiplier = 1f;
        public bool CanAttackBuildings = true;
        public bool CanAttackUnits = true;
        /// <summary>Ignores walls: ladders climb, rams smash, catapults lob over.</summary>
        public bool CanBypassWalls = false;

        // ---- economy / training ----
        public ResourceCost TrainCost = ResourceCost.Zero;
        public float TrainTimeSeconds = 10f;
        public float PopulationCost = 1f;
        public int HousingNeeded = 0;

        // ---- visuals ----
        public Color PrimaryColor = new Color(0.70f, 0.62f, 0.45f);
        public Color SecondaryColor = new Color(0.30f, 0.32f, 0.38f);
        public float VisualScale = 1f;
        /// <summary>Vertical bob amplitude used for the cheap procedural walk cycle.</summary>
        public float WalkBobAmplitude = 0.06f;
        public float WalkBobFrequency = 9f;

        public bool IsSiege { get { return Role == UnitRole.Siege; } }
        public bool IsRanged { get { return Role == UnitRole.Ranged; } }

        public override string ToString() { return Id + "(" + DisplayName + ")"; }
    }

    public enum UnitId : byte
    {
        None = 0,

        // --- Player ---
        Peasant = 10,
        Woodcutter = 11,
        Quarryman = 12,
        Farmer = 13,
        Baker = 14,
        Brewer = 15,
        BlacksmithUnit = 16,
        Miller = 17,

        Archer = 30,
        Crossbowman = 31,
        Spearman = 32,
        Swordsman = 33,
        Knight = 34,
        Engineer = 35,
        Lord = 36,

        // --- Enemy ---
        Raider = 60,          // cheap melee marauder
        EnemyArcher = 61,
        EnemyBrute = 62,      // heavy melee
        Ladderman = 63,       // scales walls
        BatteringRam = 64,    // breaks gates
        Catapult = 65,        // lobs at walls, cannot be hit by garrison well
        EnemyBoss = 66,
        SiegeTowerUnit = 67,
    }
}
