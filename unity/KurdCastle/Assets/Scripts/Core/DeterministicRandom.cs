// -----------------------------------------------------------------------------
//  File: Core/DeterministicRandom.cs
//  Purpose: Allocation-free xorshift RNG. Using our own instead of UnityEngine.
//           Random gives us (a) reproducibility for wave scripting / replays and
//           (b) zero dependence on Unity's internal global state from worker
//           systems that also run inside EditMode tests.
// -----------------------------------------------------------------------------
using UnityEngine;

namespace KurdCastle.Core
{
    /// <summary>Fast, seedable, deterministic pseudo-random number generator.</summary>
    public struct DeterministicRandom
    {
        uint _state;

        public DeterministicRandom(uint seed)
        {
            _state = seed == 0u ? 0x9E3779B9u : seed;
        }

        public uint State { get { return _state; } set { _state = value == 0u ? 0x9E3779B9u : value; } }

        /// <summary>xorshift32 step.</summary>
        public uint NextUInt()
        {
            uint x = _state;
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            _state = x;
            return x;
        }

        /// <summary>Uniform int in [0, maxExclusive).</summary>
        public int Range(int maxExclusive)
        {
            if (maxExclusive <= 1) return 0;
            return (int)(NextUInt() % (uint)maxExclusive);
        }

        /// <summary>Uniform int in [minInclusive, maxExclusive).</summary>
        public int Range(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            return minInclusive + (int)(NextUInt() % (uint)(maxExclusive - minInclusive));
        }

        /// <summary>Uniform float in [0,1).</summary>
        public float Value
        {
            get { return (NextUInt() >> 8) * (1f / 16777216f); }
        }

        /// <summary>Uniform float in [min,max).</summary>
        public float Range(float min, float max)
        {
            return min + Value * (max - min);
        }

        public bool Chance(float probability)
        {
            if (probability <= 0f) return false;
            if (probability >= 1f) return true;
            return Value < probability;
        }

        /// <summary>Point inside a unit circle (rejection sampling, bounded loops).</summary>
        public Vector2 InsideUnitCircle()
        {
            for (int i = 0; i < 8; i++)
            {
                float x = Range(-1f, 1f);
                float y = Range(-1f, 1f);
                if (x * x + y * y <= 1f) return new Vector2(x, y);
            }
            float a = Range(0f, Mathf.PI * 2f);
            return new Vector2(Mathf.Cos(a), Mathf.Sin(a));
        }

        /// <summary>Yaw rotation in degrees, useful for procedural scatter.</summary>
        public float RotationDegrees() { return Range(0f, 360f); }

        /// <summary>Random sign, -1 or +1.</summary>
        public int Sign() { return (NextUInt() & 1u) == 0u ? -1 : 1; }

        /// <summary>Derive an independent stream (keeps long-lived systems from coupling).</summary>
        public DeterministicRandom Fork(uint salt)
        {
            return new DeterministicRandom(_state ^ (salt * 2654435761u));
        }
    }
}
