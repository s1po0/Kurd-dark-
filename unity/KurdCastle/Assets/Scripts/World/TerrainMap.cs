// -----------------------------------------------------------------------------
//  File: World/TerrainMap.cs
//  Purpose: The terrain layer: cell classification, elevation, vegetation
//           (trees), and resource deposits (rock, iron ore, fertile soil).
//           This is the "what the ground is" half of the world; MapGrid holds
//           "what is standing on it".
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.World
{
    public sealed class TerrainMap
    {
        public readonly int Width;
        public readonly int Height;

        readonly TerrainType[] _cells;
        readonly byte[] _elevation;      // 0..4 terraces, 0 = flat lowland
        readonly bool[] _vegetation;     // tree present
        readonly byte[] _harvestCount;   // cycles remaining before a deposit is exhausted

        public TerrainMap(int width, int height)
        {
            Width = width;
            Height = height;
            _cells = new TerrainType[width * height];
            _elevation = new byte[width * height];
            _vegetation = new bool[width * height];
            _harvestCount = new byte[width * height];
        }

        public bool InBounds(Int2 c) { return c.x >= 0 && c.y >= 0 && c.x < Width && c.y < Height; }
        public int ToIndex(Int2 c) { return c.y * Width + c.x; }
        public Int2 FromIndex(int i) { return new Int2(i % Width, i / Width); }

        public TerrainType Get(Int2 c)
        {
            return InBounds(c) ? _cells[ToIndex(c)] : TerrainType.Rock;
        }

        public byte GetElevation(Int2 c) { return InBounds(c) ? _elevation[ToIndex(c)] : (byte)4; }

        public void Set(Int2 c, TerrainType t, byte elevation = 0)
        {
            if (!InBounds(c)) return;
            int i = ToIndex(c);
            _cells[i] = t;
            _elevation[i] = elevation;
        }

        // ---------------------------------------------------------------- trees
        public bool HasVegetation(Int2 c) { return InBounds(c) && _vegetation[ToIndex(c)]; }

        public void SetVegetation(Int2 c, bool present)
        {
            if (!InBounds(c)) return;
            _vegetation[ToIndex(c)] = present;
            if (!present) _harvestCount[ToIndex(c)] = 0;
        }

        // ------------------------------------------------------------- deposits
        /// <summary>True if a gatherer can work this cell at all.</summary>
        public bool HasDeposit(Int2 c, ResourceType type)
        {
            if (!InBounds(c)) return false;
            int i = ToIndex(c);
            switch (type)
            {
                case ResourceType.Wood: return _vegetation[i];
                case ResourceType.Stone: return _cells[i] == TerrainType.Rock;
                case ResourceType.Iron: return _cells[i] == TerrainType.IronOre;
                case ResourceType.Food: return _cells[i] == TerrainType.FertileSoil;
                default: return false;
            }
        }

        public byte HarvestRemaining(Int2 c) { return InBounds(c) ? _harvestCount[ToIndex(c)] : (byte)0; }

        public void SetHarvestBudget(Int2 c, byte cycles)
        {
            if (InBounds(c)) _harvestCount[ToIndex(c)] = cycles;
        }

        /// <summary>
        /// Consumes one harvest cycle of a deposit. Returns true when the deposit
        /// is still present afterwards.
        /// </summary>
        public bool ConsumeHarvest(Int2 c)
        {
            if (!InBounds(c)) return false;
            int i = ToIndex(c);
            if (_harvestCount[i] > 0) _harvestCount[i]--;
            if (_harvestCount[i] > 0) return true;

            // Deposit exhausted: downgrade the terrain so the map reflects reality.
            if (_vegetation[i])
            {
                _vegetation[i] = false;
                return false;
            }
            if (_cells[i] == TerrainType.Rock) { _cells[i] = TerrainType.RoughGrass; return false; }
            if (_cells[i] == TerrainType.IronOre) { _cells[i] = TerrainType.Rock; return false; }
            return false;
        }

        // ------------------------------------------------------------ queries
        /// <summary>Terrain-only walkability (buildings are handled by MapGrid).</summary>
        public bool IsTerrainWalkable(Int2 c)
        {
            switch (Get(c))
            {
                case TerrainType.Water:
                case TerrainType.Rock:
                case TerrainType.IronOre:
                    return false;
                default:
                    return true;
            }
        }

        public bool IsFertile(Int2 c) { return Get(c) == TerrainType.FertileSoil; }

        /// <summary>Slope check for buildings that need reasonably flat ground.</summary>
        public bool IsFlat(Int2 origin, int w, int h, int maxDelta = 1)
        {
            byte lo = 255, hi = 0;
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    byte e = GetElevation(new Int2(origin.x + x, origin.y + y));
                    if (e < lo) lo = e;
                    if (e > hi) hi = e;
                }
            }
            return hi - lo <= maxDelta;
        }

        /// <summary>Trees adjacent to (or inside) the rect — what a lumberjack needs.</summary>
        public bool HasVegetationWithin(IntRect rect, int pad = 1)
        {
            for (int y = rect.y - pad; y < rect.yMax + pad; y++)
                for (int x = rect.x - pad; x < rect.xMax + pad; x++)
                    if (HasVegetation(new Int2(x, y))) return true;
            return false;
        }

        public bool HasTerrainWithin(IntRect rect, TerrainType type, int pad = 1)
        {
            for (int y = rect.y - pad; y < rect.yMax + pad; y++)
                for (int x = rect.x - pad; x < rect.xMax + pad; x++)
                    if (Get(new Int2(x, y)) == type) return true;
            return false;
        }

        /// <summary>
        /// Finds the nearest workable deposit of a resource, spiralling outward from
        /// <paramref name="from"/>. Returns false when nothing exists inside radius.
        /// </summary>
        public bool TryFindNearestDeposit(Int2 from, ResourceType type, int radius, out Int2 found)
        {
            found = default;
            int bestSqr = int.MaxValue;
            int r2 = radius * radius;
            for (int y = Mathf.Max(0, from.y - radius); y <= Mathf.Min(Height - 1, from.y + radius); y++)
            {
                for (int x = Mathf.Max(0, from.x - radius); x <= Mathf.Min(Width - 1, from.x + radius); x++)
                {
                    var c = new Int2(x, y);
                    if (!HasDeposit(c, type)) continue;
                    int d = c.SqrDistanceTo(from);
                    if (d < bestSqr) { bestSqr = d; found = c; }
                }
            }
            return bestSqr <= r2;
        }

        /// <summary>Nearest cell that a worker could stand on to work <paramref name="targetCell"/>.</summary>
        public bool TryFindAdjacentWorkCell(Int2 targetCell, System.Func<Int2, bool> isWalkable, out Int2 workCell)
        {
            workCell = targetCell;
            if (isWalkable(targetCell)) return true;
            var neighbours = Int2.EightNeighbours;
            for (int i = 0; i < neighbours.Length; i++)
            {
                var n = targetCell + neighbours[i];
                if (isWalkable(n)) { workCell = n; return true; }
            }
            for (int ring = 2; ring <= 3; ring++)
            {
                for (int dy = -ring; dy <= ring; dy++)
                {
                    for (int dx = -ring; dx <= ring; dx++)
                    {
                        if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) != ring) continue;
                        var n = new Int2(targetCell.x + dx, targetCell.y + dy);
                        if (isWalkable(n)) { workCell = n; return true; }
                    }
                }
            }
            return false;
        }

        /// <summary>Counts tiles matching a predicate — used by the objective tracker.</summary>
        public int Count(System.Func<Int2, bool> predicate)
        {
            int n = 0;
            for (int i = 0; i < _cells.Length; i++) if (predicate(FromIndex(i))) n++;
            return n;
        }
    }
}
