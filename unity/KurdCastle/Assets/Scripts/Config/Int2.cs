// -----------------------------------------------------------------------------
//  File: Config/Int2.cs + Geometry helpers
//  Purpose: Small allocation-free value types used by the grid, pathfinder and
//           spatial hash. A struct-cell Coordinate2 is the backbone of the whole
//           simulation, so it lives in Config next to the data model.
// -----------------------------------------------------------------------------
using System;
using UnityEngine;

namespace KurdCastle.Config
{
    /// <summary>Integer grid coordinate (x = column, y = row).</summary>
    [Serializable]
    public struct Int2 : IEquatable<Int2>
    {
        public int x;
        public int y;

        public Int2(int x, int y) { this.x = x; this.y = y; }

        public static readonly Int2 Zero = new Int2(0, 0);
        public static readonly Int2 Up = new Int2(0, 1);
        public static readonly Int2 Down = new Int2(0, -1);
        public static readonly Int2 Left = new Int2(-1, 0);
        public static readonly Int2 Right = new Int2(1, 0);

        public static readonly Int2[] FourNeighbours =
        {
            new Int2(0, 1), new Int2(1, 0), new Int2(0, -1), new Int2(-1, 0),
        };

        public static readonly Int2[] EightNeighbours =
        {
            new Int2(0, 1), new Int2(1, 1), new Int2(1, 0), new Int2(1, -1),
            new Int2(0, -1), new Int2(-1, -1), new Int2(-1, 0), new Int2(-1, 1),
        };

        /// <summary>
        /// Implicit conversion with UnityEngine.Vector2Int keeps the simulation
        /// free to speak grid coordinates while the view/UI layer speaks Unity
        /// types, without sprinkling casts through both.
        /// </summary>
        public static implicit operator Vector2Int(Int2 v) { return new Vector2Int(v.x, v.y); }

        public static implicit operator Int2(Vector2Int v) { return new Int2(v.x, v.y); }

        public static Int2 operator +(Int2 a, Int2 b) { return new Int2(a.x + b.x, a.y + b.y); }
        public static Int2 operator -(Int2 a, Int2 b) { return new Int2(a.x - b.x, a.y - b.y); }
        public static Int2 operator *(Int2 a, int m) { return new Int2(a.x * m, a.y * m); }
        public static bool operator ==(Int2 a, Int2 b) { return a.x == b.x && a.y == b.y; }
        public static bool operator !=(Int2 a, Int2 b) { return a.x != b.x || a.y != b.y; }

        public bool Equals(Int2 other) { return x == other.x && y == other.y; }
        public override bool Equals(object obj) { return obj is Int2 o && Equals(o); }
        public override int GetHashCode() { return (x * 397) ^ y; }
        public override string ToString() { return "(" + x + "," + y + ")"; }

        public int ManhattanTo(Int2 o) { return Mathf.Abs(x - o.x) + Mathf.Abs(y - o.y); }
        public int ChebyshevTo(Int2 o) { return Mathf.Max(Mathf.Abs(x - o.x), Mathf.Abs(y - o.y)); }
        public float DistanceTo(Int2 o)
        {
            float dx = x - o.x, dy = y - o.y;
            return Mathf.Sqrt(dx * dx + dy * dy);
        }

        /// <summary>Squared euclidean distance, avoiding a sqrt in distance comparisons.</summary>
        public int SqrDistanceTo(Int2 o)
        {
            int dx = x - o.x, dy = y - o.y;
            return dx * dx + dy * dy;
        }

        public Vector3 ToWorld(float height = 0f)
        {
            return new Vector3(x + 0.5f, height, y + 0.5f);
        }

        public Vector2 ToVector2Center() { return new Vector2(x + 0.5f, y + 0.5f); }
    }

    /// <summary>Integer rectangle, used for multi-tile building footprints.</summary>
    [Serializable]
    public struct IntRect
    {
        public int x, y, width, height;
        public int xMax { get { return x + width; } }
        public int yMax { get { return y + height; } }

        public IntRect(int x, int y, int w, int h) { this.x = x; this.y = y; width = w; height = h; }

        public static IntRect FromCenter(Int2 center, int w, int h)
        {
            // Odd footprints centre on the tapped tile, even ones bias down-left
            // (matches the ghost preview the player sees under their finger).
            return new IntRect(center.x - (w - 1) / 2, center.y - (h - 1) / 2, w, h);
        }

        public bool Contains(Int2 p) { return p.x >= x && p.y >= y && p.x < x + width && p.y < y + height; }

        public bool Overlaps(IntRect o)
        {
            return x < o.x + o.width && x + width > o.x && y < o.y + o.height && y + height > o.y;
        }

        public Int2 Center { get { return new Int2(x + width / 2, y + height / 2); } }
        public override string ToString() { return "[" + x + "," + y + " " + width + "x" + height + "]"; }
    }

    /// <summary>Integer bounds helper for camera clamping.</summary>
    [Serializable]
    public struct IntBounds
    {
        public int minX, minY, maxX, maxY;
        public IntBounds(int minX, int minY, int maxX, int maxY)
        { this.minX = minX; this.minY = minY; this.maxX = maxX; this.maxY = maxY; }
        public bool Contains(Int2 p) { return p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY; }
    }
}
