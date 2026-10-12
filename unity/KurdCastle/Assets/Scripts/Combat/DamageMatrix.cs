// -----------------------------------------------------------------------------
//  File: Combat/DamageMatrix.cs
//  Purpose: Single source of truth for "how much does this hurt that".
//           A table lookup beats a chain of ifs inside the per-tick attack loop
//           and, more importantly, makes balance changes one-line edits.
//
//  Multipliers are percentages (100 = normal damage).
// -----------------------------------------------------------------------------
using UnityEngine;
using KurdCastle.Config;

namespace KurdCastle.Combat
{
    public static class DamageMatrix
    {
        // rows = DamageType, cols = ArmorType
        static readonly int[,] Table =
        {
            //            None  Leather Mail  Plate Wood  Stone
            /* Slash  */ { 120,   105,   70,   60,  140,    35 },
            /* Pierce */ { 100,    95,   85,   50,  110,    30 },
            /* Blunt  */ { 110,   100,  105,   90,  160,    75 },
            /* Fire   */ { 130,   120,  100,   70,  260,    25 },
            /* Siege  */ { 100,    90,   80,   70,  220,   150 },
        };

        public static float Apply(float amount, DamageType damage, ArmorType armor, float globalScale)
        {
            int d = Mathf.Clamp((int)damage, 0, Table.GetLength(0) - 1);
            int a = Mathf.Clamp((int)armor, 0, Table.GetLength(1) - 1);
            float mult = Table[d, a] / 100f;
            return amount * mult * globalScale;
        }

        /// <summary>Used by the unit inspector to explain the counters on screen.</summary>
        public static string Describe(DamageType damage, ArmorType armor)
        {
            float mult = Apply(100f, damage, armor, 1f);
            if (mult >= 150f) return "crushing";
            if (mult >= 110f) return "effective";
            if (mult >= 90f) return "normal";
            if (mult >= 60f) return "weak";
            return "almost useless";
        }
    }
}
