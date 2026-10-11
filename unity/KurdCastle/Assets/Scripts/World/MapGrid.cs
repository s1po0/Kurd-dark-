// -----------------------------------------------------------------------------
//  File: World/MapGrid.cs
//  Purpose: Occupancy half of the world: which building owns which cell, plus the
//           per-cell navigation costs that occupancy implies. All placement rules
//           live here too, so ConstructionSystem never touches raw arrays and the
//           navigation dirty-flag can never drift out of sync.
//
//  Nav cost encoding per cell (0 = "fall through to terrain/base cost"):
//    0        → use base terrain cost
//    1..254   → explicit cost (gate = cheap, wall-climb = expensive)
//    255      → impassable
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.World
{
    public sealed class MapGrid
    {
        public const byte NavFallThrough = 0;
        public const byte NavImpassable = 255;

        public readonly int Width;
        public readonly int Height;

        readonly int[] _occupant;       // building handle or Handle.Invalid
        readonly byte[] _reserved;      // 1 while a construction site is pending
        readonly byte[] _navGround;     // cost for ground-profile units
        readonly byte[] _navBypass;     // cost for wall-bypassing units
        readonly bool[] _gateOpen;

        readonly TerrainMap _terrain;

        public MapGrid(TerrainMap terrain)
        {
            _terrain = terrain;
            Width = terrain.Width;
            Height = terrain.Height;
            int n = Width * Height;
            _occupant = new int[n];
            _reserved = new byte[n];
            _navGround = new byte[n];
            _navBypass = new byte[n];
            _gateOpen = new bool[n];
            for (int i = 0; i < n; i++) _occupant[i] = Handle.Invalid;
        }

        /// <summary>Bumped on every mutation; navigation caches compare against it.</summary>
        public int Version { get; private set; }

        public bool InBounds(Int2 c) { return c.x >= 0 && c.y >= 0 && c.x < Width && c.y < Height; }
        public int ToIndex(Int2 c) { return c.y * Width + c.x; }
        public Int2 FromIndex(int i) { return new Int2(i % Width, i / Width); }

        public void MarkDirty() { Version++; }

        // ======================================================================
        //  Occupancy
        // ======================================================================
        public int GetOccupant(Int2 c) { return InBounds(c) ? _occupant[ToIndex(c)] : Handle.Invalid; }
        public bool IsOccupied(Int2 c) { return GetOccupant(c) != Handle.Invalid; }
        public bool IsReserved(Int2 c) { return InBounds(c) && _reserved[ToIndex(c)] != 0; }
        public bool IsFree(Int2 c) { return InBounds(c) && !IsOccupied(c) && !IsReserved(c); }

        public void Reserve(IntRect rect, bool on = true)
        {
            byte v = (byte)(on ? 1 : 0);
            for (int y = rect.y; y < rect.yMax; y++)
                for (int x = rect.x; x < rect.xMax; x++)
                    if (InBounds(new Int2(x, y))) _reserved[y * Width + x] = v;
            MarkDirty();
        }

        /// <summary>
        /// Claims the footprint for a building and installs its navigation costs.
        /// </summary>
        public void Occupy(IntRect rect, int buildingHandle, byte navGround, byte navBypass,
                           bool clearedByPlayer = false)
        {
            for (int y = rect.y; y < rect.yMax; y++)
            {
                for (int x = rect.x; x < rect.xMax; x++)
                {
                    Int2 c = new Int2(x, y);
                    if (!InBounds(c)) continue;
                    int i = ToIndex(c);
                    _occupant[i] = buildingHandle;
                    _reserved[i] = 0;
                    _navGround[i] = navGround;
                    _navBypass[i] = navBypass;
                    if (_terrain.HasVegetation(c)) _terrain.SetVegetation(c, false);
                }
            }
            MarkDirty();
        }

        public void Release(IntRect rect)
        {
            for (int y = rect.y; y < rect.yMax; y++)
            {
                for (int x = rect.x; x < rect.xMax; x++)
                {
                    Int2 c = new Int2(x, y);
                    if (!InBounds(c)) continue;
                    int i = ToIndex(c);
                    _occupant[i] = Handle.Invalid;
                    _reserved[i] = 0;
                    _navGround[i] = NavFallThrough;
                    _navBypass[i] = NavFallThrough;
                    _gateOpen[i] = false;
                }
            }
            MarkDirty();
        }

        public byte NavGroundAt(Int2 c) { return InBounds(c) ? _navGround[ToIndex(c)] : NavImpassable; }
        public byte NavBypassAt(Int2 c) { return InBounds(c) ? _navBypass[ToIndex(c)] : NavImpassable; }

        // ======================================================================
        //  Gates
        // ======================================================================
        public void SetGate(IntRect rect, bool open, byte gearCost)
        {
            for (int y = rect.y; y < rect.yMax; y++)
            {
                for (int x = rect.x; x < rect.xMax; x++)
                {
                    Int2 c = new Int2(x, y);
                    if (!InBounds(c)) continue;
                    int i = ToIndex(c);
                    _gateOpen[i] = open;
                    _navGround[i] = open ? gearCost : NavImpassable;
                    _navBypass[i] = open ? gearCost : NavigationGrid.WallClimbCost;
                }
            }
            MarkDirty();
        }

        public void SetGateOpen(Int2 cell, bool open, byte gearCost)
        {
            if (!InBounds(cell)) return;
            int i = ToIndex(cell);
            _gateOpen[i] = open;
            _navGround[i] = open ? gearCost : NavImpassable;
            _navBypass[i] = open ? gearCost : NavigationGrid.WallClimbCost;
            MarkDirty();
        }

        public bool IsGateOpen(Int2 cell) { return InBounds(cell) && _gateOpen[ToIndex(cell)]; }

        /// <summary>Iterates a footprint; false if any cell is out of bounds.</summary>
        public bool ForEachCell(IntRect rect, System.Action<Int2> action)
        {
            for (int y = rect.y; y < rect.yMax; y++)
            {
                for (int x = rect.x; x < rect.xMax; x++)
                {
                    Int2 c = new Int2(x, y);
                    if (!InBounds(c)) return false;
                    action(c);
                }
            }
            return true;
        }

        // ======================================================================
        //  Placement validation — the single authority on "can this go here?"
        // ======================================================================
        /// <summary>
        /// Physical validity only (bounds, occupancy, terrain, required deposits).
        /// Funds and territory are checked by ConstructionSystem.
        /// </summary>
        public PlacementError Validate(BuildingDefinition def, IntRect rect)
        {
            if (def == null || def.Id == BuildingId.None) return PlacementError.Unknown;

            if (rect.width <= 0 || rect.height <= 0) return PlacementError.Unknown;
            if (rect.x < 0 || rect.y < 0 || rect.xMax > Width || rect.yMax > Height)
                return PlacementError.OutOfBounds;

            for (int y = rect.y; y < rect.yMax; y++)
            {
                for (int x = rect.x; x < rect.xMax; x++)
                {
                    var c = new Int2(x, y);
                    int idx = ToIndex(c);

                    if (_occupant[idx] != Handle.Invalid) return PlacementError.Occupied;
                    if (_reserved[idx] != 0) return PlacementError.Occupied;

                    bool tree = _terrain.HasVegetation(c);
                    if (tree && !def.ClearsVegetation && def.Id != BuildingId.Moat)
                        return PlacementError.Occupied;

                    if (!_terrain.IsTerrainWalkable(c))
                    {
                        // Quarries and mines legitimately sit on the deposit they exploit.
                        bool depositBuilding = def.Id == BuildingId.Quarry || def.Id == BuildingId.IronMine;
                        if (!depositBuilding) return PlacementError.TerrainUnsuitable;
                    }

                    if (def.Id == BuildingId.Moat && _terrain.Get(c) == TerrainType.Water)
                        return PlacementError.TerrainUnsuitable;
                }
            }

            if (def.NeedsFlatGround && !_terrain.IsFlat(rect, 1)) return PlacementError.SlopeTooSteep;

            if (def.NeedsForest && !_terrain.HasVegetationWithin(rect)) return PlacementError.NeedsForest;
            if (def.NeedsRockDeposit && !_terrain.HasTerrainWithin(rect, TerrainType.Rock)) return PlacementError.NeedsRock;
            if (def.NeedsIronOre && !_terrain.HasTerrainWithin(rect, TerrainType.IronOre)) return PlacementError.NeedsIronOre;
            if (def.NeedsFertileSoil && !_terrain.HasTerrainWithin(rect, TerrainType.FertileSoil, 0))
                return PlacementError.NeedsFertile;

            return PlacementError.Ok;
        }

        // ======================================================================
        //  Search helpers
        // ======================================================================
        /// <summary>Finds a free cell closest to <paramref name="origin"/>, spiralling out.</summary>
        public bool TryFindFreeCell(Int2 origin, int maxRadius, out Int2 result)
        {
            result = origin;
            if (IsFree(origin)) return true;

            for (int r = 1; r <= maxRadius; r++)
            {
                for (int dy = -r; dy <= r; dy++)
                {
                    for (int dx = -r; dx <= r; dx++)
                    {
                        if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) != r) continue;
                        var c = new Int2(origin.x + dx, origin.y + dy);
                        if (IsFree(c)) { result = c; return true; }
                    }
                }
            }
            return false;
        }

        /// <summary>True when the rect touches an existing structure (used for snapping walls).</summary>
        public bool TouchesStructure(IntRect rect, int pad = 1)
        {
            for (int y = rect.y - pad; y < rect.yMax + pad; y++)
                for (int x = rect.x - pad; x < rect.xMax + pad; x++)
                {
                    var c = new Int2(x, y);
                    if (!InBounds(c) || rect.Contains(c)) continue;
                    if (IsOccupied(c)) return true;
                }
            return false;
        }

        /// <summary>How many of the rect's cells are already occupied (wall snapping uses this).</summary>
        public int CountOccupied(IntRect rect)
        {
            int n = 0;
            for (int y = rect.y; y < rect.yMax; y++)
                for (int x = rect.x; x < rect.xMax; x++)
                    if (IsOccupied(new Int2(x, y))) n++;
            return n;
        }

        /// <summary>Debug helper: dumps a footprint as text for logs / tests.</summary>
        public string DumpRect(IntRect rect)
        {
            var sb = new System.Text.StringBuilder((rect.width + 1) * rect.height);
            for (int y = rect.yMax - 1; y >= rect.y; y--)
            {
                for (int x = rect.x; x < rect.xMax; x++)
                {
                    var c = new Int2(x, y);
                    char ch = !InBounds(c) ? '#'
                            : IsOccupied(c) ? 'B'
                            : _terrain.HasVegetation(c) ? 'T'
                            : _terrain.IsTerrainWalkable(c) ? '.'
                            : 'X';
                    sb.Append(ch);
                }
                sb.Append('\n');
            }
            return sb.ToString();
        }
    }
}
