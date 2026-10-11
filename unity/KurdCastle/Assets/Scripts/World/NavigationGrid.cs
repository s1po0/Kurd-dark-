// -----------------------------------------------------------------------------
//  File: World/NavigationGrid.cs
//  Purpose: Turns terrain + building occupancy into per-(team, profile) cost
//           surfaces consumed by A* and the enemy flow fields.
//
//  Profiles exist because "can this unit walk here?" is not one question:
//    * Ground      – normal troops; walls and closed gates are impassable.
//    * WallBypass  – ladders, siege towers, catapults; walls are very expensive
//                    but crossable, so units naturally prefer gates and only
//                    scale ramparts when that is genuinely the shorter route.
//    * GroundWide  – clearance-2 machines (rams, catapults): cells adjacent to
//                    blockers are dilated so the machine physically fits.
//
//  Cost encoding: 0 = impassable, otherwise 10 = normal ground.
// -----------------------------------------------------------------------------
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.World
{
    public enum NavProfile : byte
    {
        Ground = 0,
        WallBypass = 1,
        GroundWide = 2,
        Count = 3,
    }

    public sealed class NavigationGrid
    {
        public const byte Impassable = 0;
        public const byte NormalCost = 10;
        /// <summary>Cost of crossing a rampart for wall-bypassing units.</summary>
        public const byte WallClimbCost = 130;
        /// <summary>Cost of wading a moat (only for units that can, e.g. siege towers on causeways).</summary>
        public const byte MoatCost = 220;
        /// <summary>Friendly/gate passage is cheaper than any detour, so units funnel through.</summary>
        public const byte GateCost = 18;

        readonly MapGrid _grid;
        readonly TerrainMap _terrain;
        readonly int _width, _height;
        const int TeamCount = 3;

        readonly byte[] _baseTerrain;
        readonly byte[][] _surface;      // [(int)profile * TeamCount + (int)team]
        readonly int[] _surfaceVersion;

        public NavigationGrid(MapGrid grid, TerrainMap terrain)
        {
            _grid = grid;
            _terrain = terrain;
            _width = grid.Width;
            _height = grid.Height;

            int cells = _width * _height;
            _baseTerrain = new byte[cells];
            _surface = new byte[(int)NavProfile.Count * TeamCount][];
            _surfaceVersion = new int[_surface.Length];
            for (int i = 0; i < _surface.Length; i++)
            {
                _surface[i] = new byte[cells];
                _surfaceVersion[i] = -1;
            }
            RebuildBaseTerrain();
        }

        public int Width { get { return _width; } }
        public int Height { get { return _height; } }
        public int CellCount { get { return _width * _height; } }
        public int ToIndex(Int2 c) { return c.y * _width + c.x; }
        public Int2 FromIndex(int i) { return new Int2(i % _width, i / _width); }
        public bool InBounds(Int2 c) { return c.x >= 0 && c.y >= 0 && c.x < _width && c.y < _height; }

        public void RebuildBaseTerrain()
        {
            for (int y = 0; y < _height; y++)
            {
                for (int x = 0; x < _width; x++)
                {
                    var c = new Int2(x, y);
                    byte cost;
                    if (!_terrain.IsTerrainWalkable(c))
                    {
                        cost = Impassable;
                    }
                    else
                    {
                        switch (_terrain.Get(c))
                        {
                            case TerrainType.RoughGrass: cost = 12; break;
                            case TerrainType.Sand: cost = 17; break;
                            case TerrainType.Dirt: cost = 11; break;
                            case TerrainType.FertileSoil: cost = 13; break;
                            default: cost = NormalCost; break;
                        }
                    }
                    _baseTerrain[y * _width + x] = cost;
                }
            }
            Invalidate();
        }

        public void Invalidate()
        {
            for (int i = 0; i < _surfaceVersion.Length; i++) _surfaceVersion[i] = -1;
        }

        /// <summary>Cost surface for a (profile, team) pair, rebuilt lazily when the grid changed.</summary>
        public byte[] GetSurface(NavProfile profile, Team team)
        {
            int slot = (int)profile * TeamCount + (int)team;
            if (slot < 0 || slot >= _surface.Length) slot = 0;
            if (_surfaceVersion[slot] == _grid.Version) return _surface[slot];

            BuildSurface(profile, _surface[slot]);
            _surfaceVersion[slot] = _grid.Version;
            return _surface[slot];
        }

        void BuildSurface(NavProfile profile, byte[] target)
        {
            for (int i = 0; i < target.Length; i++)
            {
                byte baseCost = _baseTerrain[i];
                if (baseCost == Impassable) { target[i] = Impassable; continue; }

                Int2 c = FromIndex(i);
                byte navGround = _grid.NavGroundAt(c);

                if (navGround == MapGrid.NavFallThrough) { target[i] = baseCost; continue; }
                if (navGround == MapGrid.NavImpassable)
                {
                    target[i] = profile == NavProfile.WallBypass ? _grid.NavBypassAt(c) : Impassable;
                    if (target[i] == MapGrid.NavImpassable) target[i] = Impassable;
                    continue;
                }
                target[i] = navGround;
            }

            if (profile == NavProfile.GroundWide) DilateWide(target);
        }

        /// <summary>
        /// Dilation pass for clearance-2 machines: a cell is walkable only if its
        /// orthogonal neighbours are too, so rams and catapults never clip through
        /// buildings or squeeze into one-cell gaps.
        /// </summary>
        void DilateWide(byte[] target)
        {
            var copy = new byte[target.Length];
            System.Array.Copy(target, copy, target.Length);
            for (int y = 1; y < _height - 1; y++)
            {
                for (int x = 1; x < _width - 1; x++)
                {
                    int i = y * _width + x;
                    if (copy[i] == Impassable) { target[i] = Impassable; continue; }
                    if (copy[i - 1] == Impassable || copy[i + 1] == Impassable ||
                        copy[i - _width] == Impassable || copy[i + _width] == Impassable)
                        target[i] = Impassable;
                }
            }
            for (int x = 0; x < _width; x++) { target[x] = Impassable; target[(_height - 1) * _width + x] = Impassable; }
            for (int y = 0; y < _height; y++) { target[y * _width] = Impassable; target[y * _width + _width - 1] = Impassable; }
        }

        // ------------------------------------------------------------- helpers
        public bool IsWalkable(Int2 c, NavProfile profile, Team team)
        {
            return InBounds(c) && GetSurface(profile, team)[ToIndex(c)] != Impassable;
        }

        public byte CostAt(Int2 c, NavProfile profile, Team team)
        {
            return InBounds(c) ? GetSurface(profile, team)[ToIndex(c)] : Impassable;
        }

        /// <summary>
        /// Nav costs a footprint would get, derived straight from its definition.
        /// ConstructionSystem feeds these into MapGrid.Occupy.
        /// </summary>
        public static void CostsFor(BuildingDefinition def, out byte ground, out byte bypass)
        {
            if (def == null) { ground = MapGrid.NavFallThrough; bypass = MapGrid.NavFallThrough; return; }

            if (def.IsGate)
            {
                ground = GateCost;      // gates start open
                bypass = WallClimbCost;
                return;
            }
            if (def.Id == BuildingId.WallStairs) { ground = GateCost; bypass = WallClimbCost; return; }
            if (def.Id == BuildingId.Drawbridge || def.Id == BuildingId.Moat) { ground = GateCost; bypass = MoatCost; return; }
            if (!def.BlocksPath) { ground = (byte)(NormalCost + 4); bypass = (byte)(NormalCost + 4); return; }

            ground = MapGrid.NavImpassable;
            bypass = WallClimbCost;
        }

        /// <summary>Nearest walkable cell to <paramref name="from"/> within a radius (spiral search).</summary>
        public bool TryFindWalkable(Int2 from, NavProfile profile, Team team, int maxRadius, out Int2 result)
        {
            var surface = GetSurface(profile, team);
            result = from;
            if (InBounds(from) && surface[ToIndex(from)] != Impassable) return true;

            for (int r = 1; r <= maxRadius; r++)
            {
                for (int dy = -r; dy <= r; dy++)
                {
                    for (int dx = -r; dx <= r; dx++)
                    {
                        if (Mathf.Max(Mathf.Abs(dx), Mathf.Abs(dy)) != r) continue;
                        var c = new Int2(from.x + dx, from.y + dy);
                        if (!InBounds(c)) continue;
                        if (surface[ToIndex(c)] != Impassable) { result = c; return true; }
                    }
                }
            }
            return false;
        }
    }
}
