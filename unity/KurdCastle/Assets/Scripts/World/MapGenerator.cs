// -----------------------------------------------------------------------------
//  File: World/MapGenerator.cs
//  Purpose: Procedural skirmish map: a river valley with forests, rock outcrops,
//           iron veins and fertile floodplain, a flat plateau for the player's
//           keep in the south-west, and a raider camp in the north-east joined by
//           a road so the siege always has a viable line of advance.
//
//  Everything here is deterministic for a given seed: same seed → same map, in
//  the editor, on device and in tests.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.World
{
    public struct MapGenSettings
    {
        public uint Seed;
        public int Width;
        public int Height;
        public float WaterLevel;
        public float MountainLevel;
        public float ForestThreshold;
        public float FertileNoiseScale;
        public int TreeCycles;
        public int RockCycles;
        public int IronCycles;

        public static MapGenSettings Default(uint seed)
        {
            return new MapGenSettings
            {
                Seed = seed,
                Width = Balance.Map.DefaultWidth,
                Height = Balance.Map.DefaultHeight,
                WaterLevel = 0.315f,
                MountainLevel = 0.735f,
                ForestThreshold = 0.60f,
                FertileNoiseScale = 0.06f,
                TreeCycles = 3,
                RockCycles = 5,
                IronCycles = 8,
            };
        }
    }

    public sealed class GeneratedMap
    {
        public TerrainMap Terrain;
        public MapGenSettings Settings;
        /// <summary>Where the player's keep is placed / camera starts.</summary>
        public Vector2Int PlayerStart;
        /// <summary>Centre of the enemy camp.</summary>
        public Vector2Int EnemyCamp;
        /// <summary>Cells the player starts with clear of vegetation and owned.</summary>
        public int PlayerTerritoryRadius;
        public int EnemyTerritoryRadius;
        public int TreeCount;
        public int RockCount;
        public int IronCount;
    }

    public static class MapGenerator
    {
        public static GeneratedMap Generate(MapGenSettings s)
        {
            var map = new TerrainMap(s.Width, s.Height);
            var rng = new DeterministicRandom(s.Seed);

            var playerStart = new Vector2Int(Mathf.RoundToInt(s.Width * 0.22f), Mathf.RoundToInt(s.Height * 0.22f));
            var enemyCamp = new Vector2Int(Mathf.RoundToInt(s.Width * 0.78f), Mathf.RoundToInt(s.Height * 0.78f));

            // ------------------------------------------------------------------
            // 1. Height field → water, hills, mountains
            // ------------------------------------------------------------------
            float[] height = new float[s.Width * s.Height];
            for (int y = 0; y < s.Height; y++)
            {
                for (int x = 0; x < s.Width; x++)
                {
                    float nx = x / (float)s.Width;
                    float ny = y / (float)s.Height;
                    float baseHeight = Noise.Fbm(nx * 3.4f, ny * 3.4f, s.Seed, 5, 2.1f, 0.52f);
                    float mask = Noise.IslandMask(nx, ny, 1.35f);
                    // Bias the south-west slightly upward so the keep plateau is dry.
                    float swBias = 0.06f * (1f - (nx + ny) * 0.5f);
                    height[y * s.Width + x] = Mathf.Clamp01(baseHeight * (0.72f + 0.42f * mask) + swBias);
                }
            }

            for (int y = 0; y < s.Height; y++)
            {
                for (int x = 0; x < s.Width; x++)
                {
                    var c = new Vector2Int(x, y);
                    float h = height[y * s.Width + x];
                    if (h < s.WaterLevel)
                    {
                        map.Set(new Int2(x, y), TerrainType.Water, 0);
                        continue;
                    }

                    byte elevation = (byte)Mathf.Clamp(Mathf.FloorToInt((h - s.WaterLevel) * 6f), 0, 4);
                    if (h > s.MountainLevel)
                    {
                        map.Set(new Int2(x, y), TerrainType.Rock, elevation);
                    }
                    else if (elevation >= 3)
                    {
                        map.Set(new Int2(x, y), TerrainType.RoughGrass, elevation);
                    }
                    else
                    {
                        map.Set(new Int2(x, y), TerrainType.Grass, elevation);
                    }
                }
            }

            // ------------------------------------------------------------------
            // 2. Iron veins inside mountain country
            // ------------------------------------------------------------------
            uint veinSeed = s.Seed ^ 0x5A17u;
            for (int y = 1; y < s.Height - 1; y++)
            {
                for (int x = 1; x < s.Width - 1; x++)
                {
                    var c = new Int2(x, y);
                    if (map.Get(c) != TerrainType.Rock) continue;
                    float vein = Noise.Fbm(x * 0.09f, y * 0.09f, veinSeed, 3, 2f, 0.5f);
                    if (vein > 0.66f) map.Set(c, TerrainType.IronOre, map.GetElevation(c));
                }
            }

            // ------------------------------------------------------------------
            // 3. Forests
            // ------------------------------------------------------------------
            int trees = 0;
            uint forestSeed = s.Seed ^ 0x1F0Fu;
            for (int y = 1; y < s.Height - 1; y++)
            {
                for (int x = 1; x < s.Width - 1; x++)
                {
                    var c = new Int2(x, y);
                    var t = map.Get(c);
                    if (t == TerrainType.Water || t == TerrainType.Rock || t == TerrainType.IronOre) continue;
                    float f = Noise.Fbm(x * 0.11f, y * 0.11f, forestSeed, 4, 2.3f, 0.55f);
                    // Forests prefer low, well-watered ground.
                    float bonus = map.GetElevation(c) == 0 ? 0.05f : 0f;
                    if (f + bonus > s.ForestThreshold)
                    {
                        map.SetVegetation(c, true);
                        map.SetHarvestBudget(c, (byte)s.TreeCycles);
                        trees++;
                    }
                }
            }

            // ------------------------------------------------------------------
            // 4. Fertile floodplain beside water
            // ------------------------------------------------------------------
            uint soilSeed = s.Seed ^ 0x30D9u;
            for (int y = 2; y < s.Height - 2; y++)
            {
                for (int x = 2; x < s.Width - 2; x++)
                {
                    var c = new Int2(x, y);
                    if (map.Get(c) != TerrainType.Grass) continue;
                    if (_hasWaterNear(map, c, 2))
                    {
                        float n = Noise.Value2D(x * s.FertileNoiseScale, y * s.FertileNoiseScale, soilSeed);
                        if (n > 0.35f) map.Set(c, TerrainType.FertileSoil, map.GetElevation(c));
                    }
                }
            }

            // ------------------------------------------------------------------
            // 5. Player plateau and enemy camp: flatten, clear, guarantee access
            // ------------------------------------------------------------------
            int playerRadius = 11;
            int enemyRadius = 9;
            FlattenRegion(map, playerStart, playerRadius, TerrainType.Grass);
            FlattenRegion(map, enemyCamp, enemyRadius, TerrainType.Dirt);

            // A road between the two armies guarantees a connected walkable graph
            // and gives the horde a believable line of advance.
            CarveRoad(map, playerStart, enemyCamp);

            // Guarantee each side has a starter woodlot so the opening is never
            // a "no valid build site" dead end on a bad seed.
            EnsureForestNear(map, playerStart, 16, 90, ref trees, rng, s.TreeCycles);
            EnsureForestNear(map, enemyCamp, 16, 60, ref trees, rng, s.TreeCycles);

            var result = new GeneratedMap
            {
                Terrain = map,
                Settings = s,
                PlayerStart = playerStart,
                EnemyCamp = enemyCamp,
                PlayerTerritoryRadius = playerRadius + 4,
                EnemyTerritoryRadius = enemyRadius + 3,
                TreeCount = trees,
                RockCount = map.Count(c => map.Get(c) == TerrainType.Rock),
                IronCount = map.Count(c => map.Get(c) == TerrainType.IronOre),
            };
            return result;
        }

        static bool _hasWaterNear(TerrainMap map, Int2 c, int radius)
        {
            for (int dy = -radius; dy <= radius; dy++)
                for (int dx = -radius; dx <= radius; dx++)
                    if (map.Get(new Int2(c.x + dx, c.y + dy)) == TerrainType.Water) return true;
            return false;
        }

        static void FlattenRegion(TerrainMap map, Vector2Int center, int radius, TerrainType ground)
        {
            byte elevation = map.GetElevation(new Int2(center.x, center.y));
            for (int y = center.y - radius; y <= center.y + radius; y++)
            {
                for (int x = center.x - radius; x <= center.x + radius; x++)
                {
                    var c = new Int2(x, y);
                    if (!map.InBounds(c)) continue;
                    float d = Vector2.Distance(new Vector2(x, y), new Vector2(center.x, center.y));
                    if (d > radius) continue;
                    // Feather the rim so the plateau blends into the landscape.
                    TerrainType t = d > radius - 1.5f ? TerrainType.RoughGrass : ground;
                    map.Set(c, t, elevation);
                    map.SetVegetation(c, false);
                }
            }
        }

        static void CarveRoad(TerrainMap map, Vector2Int a, Vector2Int b)
        {
            int x = a.x, y = a.y;
            int dx = Mathf.Abs(b.x - a.x), dy = Mathf.Abs(b.y - a.y);
            int sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
            int err = dx - dy;
            int guard = 0;

            while (guard++ < 4096)
            {
                // Wide road: clear a 3-cell band.
                for (int oy = -1; oy <= 1; oy++)
                {
                    for (int ox = -1; ox <= 1; ox++)
                    {
                        var c = new Int2(x + ox, y + oy);
                        if (!map.InBounds(c)) continue;
                        if (map.Get(c) == TerrainType.Water)
                        {
                            // Shallows: a ford the army can wade.
                            map.Set(c, TerrainType.Sand, 0);
                        }
                        else if (map.Get(c) == TerrainType.Rock && Mathf.Abs(ox) + Mathf.Abs(oy) == 0)
                        {
                            map.Set(c, TerrainType.Dirt, 0);
                        }
                        else if (map.Get(c) != TerrainType.Water && Mathf.Abs(ox) + Mathf.Abs(oy) == 0)
                        {
                            map.Set(c, TerrainType.Dirt, map.GetElevation(c));
                        }
                        map.SetVegetation(c, false);
                    }
                }

                if (x == b.x && y == b.y) break;
                int e2 = err * 2;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
        }

        static void EnsureForestNear(TerrainMap map, Vector2Int center, int radius, int targetTrees,
                                     ref int treeCount, DeterministicRandom rng, int cycles)
        {
            int existing = 0;
            for (int y = center.y - radius; y <= center.y + radius; y++)
                for (int x = center.x - radius; x <= center.x + radius; x++)
                    if (map.HasVegetation(new Int2(x, y))) existing++;
            if (existing >= targetTrees) return;

            int planted = 0;
            int attempts = 0;
            while (existing + planted < targetTrees && attempts < 4000)
            {
                attempts++;
                int bx = rng.Range(center.x - radius, center.x + radius + 1);
                int by = rng.Range(center.y - radius, center.y + radius + 1);
                var c = new Int2(bx, by);
                if (!map.InBounds(c)) continue;
                if (!map.IsTerrainWalkable(c)) continue;
                if (map.HasVegetation(c)) continue;

                // Plant a small clump so lumberjacks have a real woodlot.
                int clump = rng.Range(3, 8);
                for (int i = 0; i < clump; i++)
                {
                    var t = new Int2(c.x + rng.Range(-2, 3), c.y + rng.Range(-2, 3));
                    if (!map.InBounds(t)) continue;
                    if (!map.IsTerrainWalkable(t)) continue;
                    if (map.HasVegetation(t)) continue;
                    map.SetVegetation(t, true);
                    map.SetHarvestBudget(t, (byte)cycles);
                    planted++;
                    treeCount++;
                }
            }
        }
    }
}
