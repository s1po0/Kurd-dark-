// -----------------------------------------------------------------------------
//  File: Config/Resources.cs
//  Purpose: Allocation-free resource bundle value type + helpers.
//           ResourceCost is a struct so build/validation code never allocates in
//           the hot path (a real concern on mobile where the GC is aggressive).
// -----------------------------------------------------------------------------
using System;
using System.Text;
using UnityEngine;

namespace KurdCastle.Config
{
    public static class ResourceUtil
    {
        public const int Count = 9; // keep in sync with ResourceType

        public static readonly ResourceType[] All =
        {
            ResourceType.Wood, ResourceType.Stone, ResourceType.Iron,
            ResourceType.Gold, ResourceType.Food, ResourceType.Weapons,
            ResourceType.Armor, ResourceType.Ale,
        };

        /// <summary>Resources shown on the primary HUD bar (the "big five").</summary>
        public static readonly ResourceType[] Primary =
        {
            ResourceType.Wood, ResourceType.Stone, ResourceType.Iron,
            ResourceType.Gold, ResourceType.Food,
        };

        /// <summary>Secondary (military industry) resources shown in the info drawer.</summary>
        public static readonly ResourceType[] Secondary =
        {
            ResourceType.Weapons, ResourceType.Armor, ResourceType.Ale,
        };

        public static string Label(ResourceType t)
        {
            switch (t)
            {
                case ResourceType.Wood: return "Wood";
                case ResourceType.Stone: return "Stone";
                case ResourceType.Iron: return "Iron";
                case ResourceType.Gold: return "Gold";
                case ResourceType.Food: return "Food";
                case ResourceType.Weapons: return "Weapons";
                case ResourceType.Armor: return "Armour";
                case ResourceType.Ale: return "Ale";
                default: return "-";
            }
        }

        public static string ShortLabel(ResourceType t)
        {
            switch (t)
            {
                case ResourceType.Weapons: return "WPN";
                case ResourceType.Armor: return "ARM";
                case ResourceType.Gold: return "GLD";
                case ResourceType.Stone: return "STN";
                case ResourceType.Wood: return "WOD";
                case ResourceType.Iron: return "IRN";
                case ResourceType.Food: return "FOD";
                case ResourceType.Ale: return "ALE";
                default: return "??";
            }
        }

        /// <summary>Code-drawn icon tint (no art assets required for the prototype).</summary>
        public static Color Tint(ResourceType t)
        {
            switch (t)
            {
                case ResourceType.Wood: return new Color(0.55f, 0.36f, 0.18f);
                case ResourceType.Stone: return new Color(0.62f, 0.62f, 0.66f);
                case ResourceType.Iron: return new Color(0.45f, 0.50f, 0.58f);
                case ResourceType.Gold: return new Color(0.95f, 0.78f, 0.22f);
                case ResourceType.Food: return new Color(0.44f, 0.72f, 0.30f);
                case ResourceType.Weapons: return new Color(0.80f, 0.32f, 0.28f);
                case ResourceType.Armor: return new Color(0.35f, 0.62f, 0.85f);
                case ResourceType.Ale: return new Color(0.85f, 0.62f, 0.15f);
                default: return Color.gray;
            }
        }
    }

    /// <summary>
    /// Immutable-ish bundle of resource amounts. Indexed by <see cref="ResourceType"/>.
    /// Deliberately a struct with 9 ints (36 bytes) so cost checks are copy-free.
    /// </summary>
    [Serializable]
    public struct ResourceCost
    {
        public int Wood, Stone, Iron, Gold, Food, Weapons, Armor, Ale;

        public static readonly ResourceCost Zero = default;

        public ResourceCost(int wood = 0, int stone = 0, int iron = 0, int gold = 0,
                           int food = 0, int weapons = 0, int armor = 0, int ale = 0)
        {
            Wood = wood; Stone = stone; Iron = iron; Gold = gold;
            Food = food; Weapons = weapons; Armor = armor; Ale = ale;
        }

        public int this[ResourceType t]
        {
            get
            {
                switch (t)
                {
                    case ResourceType.Wood: return Wood;
                    case ResourceType.Stone: return Stone;
                    case ResourceType.Iron: return Iron;
                    case ResourceType.Gold: return Gold;
                    case ResourceType.Food: return Food;
                    case ResourceType.Weapons: return Weapons;
                    case ResourceType.Armor: return Armor;
                    case ResourceType.Ale: return Ale;
                    default: return 0;
                }
            }
            set
            {
                switch (t)
                {
                    case ResourceType.Wood: Wood = value; break;
                    case ResourceType.Stone: Stone = value; break;
                    case ResourceType.Iron: Iron = value; break;
                    case ResourceType.Gold: Gold = value; break;
                    case ResourceType.Food: Food = value; break;
                    case ResourceType.Weapons: Weapons = value; break;
                    case ResourceType.Armor: Armor = value; break;
                    case ResourceType.Ale: Ale = value; break;
                }
            }
        }

        public bool IsZero
        {
            get
            {
                return Wood == 0 && Stone == 0 && Iron == 0 && Gold == 0 &&
                       Food == 0 && Weapons == 0 && Armor == 0 && Ale == 0;
            }
        }

        public static ResourceCost Of(ResourceType t, int amount)
        {
            var c = Zero;
            c[t] = amount;
            return c;
        }

        public static ResourceCost operator +(ResourceCost a, ResourceCost b)
        {
            return new ResourceCost(
                a.Wood + b.Wood, a.Stone + b.Stone, a.Iron + b.Iron, a.Gold + b.Gold,
                a.Food + b.Food, a.Weapons + b.Weapons, a.Armor + b.Armor, a.Ale + b.Ale);
        }

        public static ResourceCost operator -(ResourceCost a, ResourceCost b)
        {
            return new ResourceCost(
                a.Wood - b.Wood, a.Stone - b.Stone, a.Iron - b.Iron, a.Gold - b.Gold,
                a.Food - b.Food, a.Weapons - b.Weapons, a.Armor - b.Armor, a.Ale - b.Ale);
        }

        public static ResourceCost operator *(ResourceCost a, int m)
        {
            return new ResourceCost(a.Wood * m, a.Stone * m, a.Iron * m, a.Gold * m,
                                    a.Food * m, a.Weapons * m, a.Armor * m, a.Ale * m);
        }

        public static ResourceCost operator *(ResourceCost a, float m)
        {
            return new ResourceCost(
                Mathf.FloorToInt(a.Wood * m), Mathf.FloorToInt(a.Stone * m),
                Mathf.FloorToInt(a.Iron * m), Mathf.FloorToInt(a.Gold * m),
                Mathf.FloorToInt(a.Food * m), Mathf.FloorToInt(a.Weapons * m),
                Mathf.FloorToInt(a.Armor * m), Mathf.FloorToInt(a.Ale * m));
        }

        public int Total
        {
            get { return Wood + Stone + Iron + Gold + Food + Weapons + Armor + Ale; }
        }

        /// <summary>True when every component of <paramref name="other"/> fits inside this bundle.</summary>
        public bool Contains(ResourceCost other)
        {
            return Wood >= other.Wood && Stone >= other.Stone && Iron >= other.Iron &&
                   Gold >= other.Gold && Food >= other.Food && Weapons >= other.Weapons &&
                   Armor >= other.Armor && Ale >= other.Ale;
        }

        public ResourceCost ClampedTo(ResourceCost limit)
        {
            return new ResourceCost(
                Mathf.Min(Wood, limit.Wood), Mathf.Min(Stone, limit.Stone),
                Mathf.Min(Iron, limit.Iron), Mathf.Min(Gold, limit.Gold),
                Mathf.Min(Food, limit.Food), Mathf.Min(Weapons, limit.Weapons),
                Mathf.Min(Armor, limit.Armor), Mathf.Min(Ale, limit.Ale));
        }

        public string ToShortString()
        {
            var sb = new StringBuilder(48);
            bool first = true;
            for (int i = 0; i < ResourceUtil.All.Length; i++)
            {
                var t = ResourceUtil.All[i];
                int v = this[t];
                if (v == 0) continue;
                if (!first) sb.Append("  ");
                first = false;
                sb.Append(ResourceUtil.ShortLabel(t)).Append(' ').Append(v);
            }
            return first ? "free" : sb.ToString();
        }

        public override string ToString() { return ToShortString(); }
    }
}
