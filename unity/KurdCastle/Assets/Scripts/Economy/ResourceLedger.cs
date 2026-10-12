// -----------------------------------------------------------------------------
//  File: Economy/ResourceLedger.cs
//  Purpose: Authoritative resource store per team with soft caps driven by
//           storage buildings. All mutations funnel through here so the HUD can
//           subscribe to a single event and the AI can read a consistent picture.
// -----------------------------------------------------------------------------
using System;
using KurdCastle.Config;
using KurdCastle.Core;
using UnityEngine;

namespace KurdCastle.Economy
{
    public sealed class ResourceLedger
    {
        const int Teams = 3;

        readonly int[,] _amounts = new int[Teams, ResourceUtil.Count];
        readonly int[,] _caps = new int[Teams, ResourceUtil.Count];

        /// <summary>(team, type, newAmount, delta)</summary>
        public event Action<Team, ResourceType, int, int> Changed;
        public event Action<Team, ResourceType> Overflow;

        /// <summary>Income/expense accumulator, reset every economy cycle (per minute rates).</summary>
        readonly float[,] _rates = new float[Teams, ResourceUtil.Count];

        public ResourceLedger()
        {
            for (int t = 0; t < Teams; t++)
            {
                for (int r = 0; r < ResourceUtil.Count; r++)
                {
                    _caps[t, r] = DefaultCap((ResourceType)r);
                }
            }
        }

        public static int DefaultCap(ResourceType type)
        {
            switch (type)
            {
                case ResourceType.Wood: return Balance.Economy.BaseStorageWood;
                case ResourceType.Stone: return Balance.Economy.BaseStorageStone;
                case ResourceType.Iron: return Balance.Economy.BaseStorageIron;
                case ResourceType.Food: return Balance.Economy.BaseStorageFood;
                case ResourceType.Weapons: return Balance.Economy.BaseStorageWeapons;
                case ResourceType.Armor: return Balance.Economy.BaseStorageArmor;
                case ResourceType.Ale: return Balance.Economy.BaseStorageAle;
                case ResourceType.Gold: return Balance.Economy.GoldCap;
                default: return 999;
            }
        }

        public int Get(Team team, ResourceType type)
        {
            return _amounts[(int)team, (int)type];
        }

        public float GetRate(Team team, ResourceType type)
        {
            return _rates[(int)team, (int)type];
        }

        public ResourceCost Stock(Team team)
        {
            var t = (int)team;
            return new ResourceCost(
                _amounts[t, (int)ResourceType.Wood], _amounts[t, (int)ResourceType.Stone],
                _amounts[t, (int)ResourceType.Iron], _amounts[t, (int)ResourceType.Gold],
                _amounts[t, (int)ResourceType.Food], _amounts[t, (int)ResourceType.Weapons],
                _amounts[t, (int)ResourceType.Armor], _amounts[t, (int)ResourceType.Ale]);
        }

        public int Capacity(Team team, ResourceType type) { return _caps[(int)team, (int)type]; }

        public void SetCapacity(Team team, ResourceType type, int capacity)
        {
            _caps[(int)team, (int)type] = Mathf.Max(0, capacity);
        }

        public bool IsFull(Team team, ResourceType type)
        {
            return _amounts[(int)team, (int)type] >= _caps[(int)team, (int)type];
        }

        public bool CanAfford(Team team, ResourceCost cost)
        {
            for (int r = 0; r < ResourceUtil.Count; r++)
            {
                var type = (ResourceType)r;
                if (_amounts[(int)team, r] < cost[type]) return false;
            }
            return true;
        }

        /// <summary>Adds resources, clamped by capacity. Returns the amount actually stored.</summary>
        public int Add(Team team, ResourceType type, int amount)
        {
            if (amount <= 0) return 0;
            int t = (int)team, r = (int)type;
            int cap = _caps[t, r];
            int room = Mathf.Max(0, cap - _amounts[t, r]);
            int stored = Mathf.Min(room, amount);
            if (stored <= 0)
            {
                if (Overflow != null) Overflow(team, type);
                return 0;
            }
            _amounts[t, r] += stored;
            _rates[t, r] += stored;
            if (Changed != null) Changed(team, type, _amounts[t, r], stored);
            if (stored < amount && Overflow != null) Overflow(team, type);
            return stored;
        }

        /// <summary>Adds a whole bundle, returning how much of each component was stored.</summary>
        public ResourceCost AddBundle(Team team, ResourceCost bundle)
        {
            var stored = ResourceCost.Zero;
            for (int r = 0; r < ResourceUtil.Count; r++)
            {
                var type = (ResourceType)r;
                int want = bundle[type];
                if (want == 0) continue;
                stored[type] = Add(team, type, want);
            }
            return stored;
        }

        public bool TrySpend(Team team, ResourceCost cost)
        {
            if (!CanAfford(team, cost)) return false;
            for (int r = 0; r < ResourceUtil.Count; r++)
            {
                var type = (ResourceType)r;
                int amount = cost[type];
                if (amount == 0) continue;
                int t = (int)team;
                _amounts[t, r] -= amount;
                _rates[t, r] -= amount;
                if (Changed != null) Changed(team, type, _amounts[t, r], -amount);
            }
            return true;
        }

        /// <summary>Removes up to <paramref name="amount"/>; returns how much was removed.</summary>
        public int Take(Team team, ResourceType type, int amount)
        {
            if (amount <= 0) return 0;
            int t = (int)team, r = (int)type;
            int taken = Mathf.Min(_amounts[t, r], amount);
            if (taken <= 0) return 0;
            _amounts[t, r] -= taken;
            _rates[t, r] -= taken;
            if (Changed != null) Changed(team, type, _amounts[t, r], -taken);
            return taken;
        }

        /// <summary>Sets a value directly (scenario setup / save load).</summary>
        public void Set(Team team, ResourceType type, int amount)
        {
            int t = (int)team, r = (int)type;
            int clamped = Mathf.Clamp(amount, 0, _caps[t, r]);
            int delta = clamped - _amounts[t, r];
            _amounts[t, r] = clamped;
            if (Changed != null) Changed(team, type, clamped, delta);
        }

        /// <summary>Consumes accumulated rates and returns them as per-minute figures.</summary>
        public ResourceCost ConsumeRates(Team team, float elapsedSeconds)
        {
            var t = (int)team;
            float scale = elapsedSeconds > 0.001f ? 60f / elapsedSeconds : 0f;
            var result = ResourceCost.Zero;
            for (int r = 0; r < ResourceUtil.Count; r++)
            {
                var type = (ResourceType)r;
                result[type] = Mathf.RoundToInt(_rates[t, r] * scale);
                _rates[t, r] = 0f;
            }
            return result;
        }

        public void Clear()
        {
            for (int t = 0; t < Teams; t++)
                for (int r = 0; r < ResourceUtil.Count; r++)
                    _amounts[t, r] = 0;
        }
    }
}
