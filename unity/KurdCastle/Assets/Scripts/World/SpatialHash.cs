// -----------------------------------------------------------------------------
//  File: World/SpatialHash.cs
//  Purpose: Uniform-grid broad phase for unit queries (nearest enemy, splash
//           damage, crowd separation). At 300 units a full O(n²) pass is 90k
//           distance checks per tick — on a 10 Hz tick that is survivable, but
//           it leaves nothing for the rest of the frame budget. The hash turns
//           every query into a handful of bucket scans.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;

namespace KurdCastle.World
{
    public sealed class SpatialHash
    {
        readonly float _cellSize;
        readonly float _invCellSize;
        readonly int _cols, _rows;
        readonly float _originX, _originY;
        readonly List<int>[] _buckets;
        readonly List<int>[] _scratch;

        public SpatialHash(float originX, float originY, int width, int height, float cellSize = 2f)
        {
            _originX = originX;
            _originY = originY;
            _cellSize = cellSize;
            _invCellSize = 1f / cellSize;
            _cols = Mathf.Max(1, Mathf.CeilToInt(width / cellSize));
            _rows = Mathf.Max(1, Mathf.CeilToInt(height / cellSize));
            _buckets = new List<int>[_cols * _rows];
            for (int i = 0; i < _buckets.Length; i++) _buckets[i] = new List<int>(8);
        }

        public void Clear()
        {
            for (int i = 0; i < _buckets.Length; i++) _buckets[i].Clear();
        }

        int BucketIndex(float x, float y)
        {
            int cx = Mathf.Clamp((int)((x - _originX) * _invCellSize), 0, _cols - 1);
            int cy = Mathf.Clamp((int)((y - _originY) * _invCellSize), 0, _rows - 1);
            return cy * _cols + cx;
        }

        public void Insert(int index, Vector2 position)
        {
            _buckets[BucketIndex(position.x, position.y)].Add(index);
        }

        public void Insert(int index, Vector3 position)
        {
            Insert(index, new Vector2(position.x, position.z));
        }

        /// <summary>Appends every index within <paramref name="radius"/> of a point.</summary>
        public void QueryCircle(Vector2 center, float radius, List<int> results)
        {
            float r2 = radius * radius;
            int minX = Mathf.Clamp((int)((center.x - radius - _originX) * _invCellSize), 0, _cols - 1);
            int maxX = Mathf.Clamp((int)((center.x + radius - _originX) * _invCellSize), 0, _cols - 1);
            int minY = Mathf.Clamp((int)((center.y - radius - _originY) * _invCellSize), 0, _rows - 1);
            int maxY = Mathf.Clamp((int)((center.y + radius - _originY) * _invCellSize), 0, _rows - 1);

            for (int y = minY; y <= maxY; y++)
            {
                int rowBase = y * _cols;
                for (int x = minX; x <= maxX; x++)
                {
                    var bucket = _buckets[rowBase + x];
                    for (int i = 0; i < bucket.Count; i++) results.Add(bucket[i]);
                }
            }
            // Radius filtering is done by the caller, which already knows each
            // candidate's position (one cache-friendly array read).
        }

        /// <summary>Iterates the indices of a single bucket (used for separation forces).</summary>
        public List<int> BucketAt(Vector2 position)
        {
            return _buckets[BucketIndex(position.x, position.y)];
        }

        public static Vector2 To2D(Vector3 v) { return new Vector2(v.x, v.z); }
    }
}
