// -----------------------------------------------------------------------------
//  File: World/Noise.cs
//  Purpose: Tiny deterministic value-noise implementation used by the map
//           generator. No Unity dependency beyond Mathf, so it runs identically
//           in unit tests and in the headless map-validation tool.
// -----------------------------------------------------------------------------
using UnityEngine;
using KurdCastle.Core;

namespace KurdCastle.World
{
    public static class Noise
    {
        /// <summary>Smooth hash of an integer lattice point → [0,1).</summary>
        static float Hash2(int x, int y, uint seed)
        {
            uint h = (uint)(x * 374761393) + (uint)(y * 668265263) + seed * 2246822519u;
            h = (h ^ (h >> 13)) * 1274126177u;
            h ^= h >> 16;
            return (h & 0xFFFFFF) / 16777216f;
        }

        static float Smooth(float t) { return t * t * (3f - 2f * t); }

        /// <summary>Bilinear-interpolated value noise in [0,1].</summary>
        public static float Value2D(float x, float y, uint seed)
        {
            int x0 = Mathf.FloorToInt(x);
            int y0 = Mathf.FloorToInt(y);
            float fx = Smooth(x - x0);
            float fy = Smooth(y - y0);

            float v00 = Hash2(x0, y0, seed);
            float v10 = Hash2(x0 + 1, y0, seed);
            float v01 = Hash2(x0, y0 + 1, seed);
            float v11 = Hash2(x0 + 1, y0 + 1, seed);

            float a = Mathf.Lerp(v00, v10, fx);
            float b = Mathf.Lerp(v01, v11, fx);
            return Mathf.Lerp(a, b, fy);
        }

        /// <summary>Fractal brownian motion — stacked octaves for natural-looking terrain.</summary>
        public static float Fbm(float x, float y, uint seed, int octaves = 4,
                                float lacunarity = 2f, float gain = 0.5f)
        {
            float sum = 0f, amp = 1f, norm = 0f, fx = x, fy = y;
            for (int i = 0; i < octaves; i++)
            {
                sum += Value2D(fx, fy, seed + (uint)i * 7919u) * amp;
                norm += amp;
                amp *= gain;
                fx *= lacunarity;
                fy *= lacunarity;
            }
            return norm > 0f ? sum / norm : 0f;
        }

        /// <summary>Radial falloff that pushes water toward the map border.</summary>
        public static float IslandMask(float nx, float ny, float strength = 1.6f)
        {
            float dx = nx - 0.5f, dy = ny - 0.5f;
            float d = Mathf.Sqrt(dx * dx + dy * dy) * 2f;
            return Mathf.Clamp01(1f - Mathf.Pow(d, strength));
        }
    }
}
