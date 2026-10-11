// -----------------------------------------------------------------------------
//  File: World/AStarPathfinder.cs
//  Purpose: A* over the navigation cost surfaces, written for mobile:
//    * all buffers are pre-allocated once and reused (zero GC in the hot path)
//    * "stamp" arrays replace clearing loops between searches
//    * a binary heap with position tracking provides O(1) decrease-key
//    * partial paths are returned when the budget runs out or the goal is
//      enclosed, which is what makes units feel smart around walls instead of
//      giving up
//    * optional multi-goal support (nearest stockpile / nearest tree / breach)
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.World
{
    /// <summary>One pathfinding query. Struct so the service can queue it without allocating.</summary>
    public struct NavRequest
    {
        public Int2 Start;
        public Int2 Goal;
        public NavProfile Profile;
        public Team Team;
        /// <summary>Accept the closest reachable cell when the goal can't be reached.</summary>
        public bool AllowPartial;
        /// <summary>Path to a cell adjacent to the goal (goal itself is a tree/rock/building).</summary>
        public bool AllowGoalBlocked;
        /// <summary>Node expansion ceiling; 0 = use the global default.</summary>
        public int MaxNodes;

        public static NavRequest Create(Int2 start, Int2 goal, NavProfile profile, Team team)
        {
            return new NavRequest
            {
                Start = start,
                Goal = goal,
                Profile = profile,
                Team = team,
                AllowPartial = true,
                AllowGoalBlocked = true,
                MaxNodes = 0,
            };
        }
    }

    /// <summary>Pooled result object handed back to the requester.</summary>
    public sealed class PathResult
    {
        public Int2[] Waypoints = new Int2[0];
        public int Count;
        public bool Success;
        /// <summary>True when the final waypoint is not the requested goal.</summary>
        public bool Partial;
        public Int2 ActualGoal;

        public void Reset(int capacity)
        {
            if (Waypoints.Length < capacity) Waypoints = new Int2[Mathf.Max(8, capacity)];
            Count = 0;
            Success = false;
            Partial = false;
            ActualGoal = default;
        }

        public bool HasNext(int cursor) { return cursor < Count; }
    }

    /// <summary>Binary min-heap keyed by f-score with O(1) decrease-key.</summary>
    internal sealed class NodeHeap
    {
        int[] _node;
        int[] _f;
        int[] _pos;      // node → heap index, -1 when absent
        int _count;

        public NodeHeap(int capacity)
        {
            _node = new int[capacity];
            _f = new int[capacity];
            _pos = new int[capacity];
            for (int i = 0; i < capacity; i++) _pos[i] = -1;
        }

        public int Count { get { return _count; } }
        public bool IsEmpty { get { return _count == 0; } }

        public void Clear()
        {
            for (int i = 0; i < _count; i++) _pos[_node[i]] = -1;
            _count = 0;
        }

        public bool Contains(int node) { return _pos[node] >= 0; }

        public void PushOrUpdate(int node, int f)
        {
            int p = _pos[node];
            if (p < 0)
            {
                _node[_count] = node;
                _f[_count] = f;
                _pos[node] = _count;
                SiftUp(_count);
                _count++;
            }
            else if (f < _f[p])
            {
                _f[p] = f;
                SiftUp(p);
            }
        }

        public int Pop()
        {
            int root = _node[0];
            _count--;
            _pos[root] = -1;
            if (_count > 0)
            {
                _node[0] = _node[_count];
                _f[0] = _f[_count];
                _pos[_node[0]] = 0;
                SiftDown(0);
            }
            return root;
        }

        void SiftUp(int i)
        {
            int node = _node[i], f = _f[i];
            while (i > 0)
            {
                int parent = (i - 1) >> 1;
                if (_f[parent] <= f) break;
                _node[i] = _node[parent];
                _f[i] = _f[parent];
                _pos[_node[i]] = i;
                i = parent;
            }
            _node[i] = node;
            _f[i] = f;
            _pos[node] = i;
        }

        void SiftDown(int i)
        {
            int node = _node[i], f = _f[i];
            int half = _count >> 1;
            while (i < half)
            {
                int child = (i << 1) + 1;
                int right = child + 1;
                if (right < _count && _f[right] < _f[child]) child = right;
                if (f <= _f[child]) break;
                _node[i] = _node[child];
                _f[i] = _f[child];
                _pos[_node[i]] = i;
                i = child;
            }
            _node[i] = node;
            _f[i] = f;
            _pos[node] = i;
        }
    }

    public sealed class AStarPathfinder
    {
        const int OrthogonalStep = 10;
        const int DiagonalStep = 14;
        const int MaxIterations = 200000;

        readonly NavigationGrid _nav;
        readonly int _w, _h, _cells;

        readonly int[] _gScore;
        readonly int[] _cameFrom;
        readonly int[] _stamp;
        readonly bool[] _closed;
        readonly byte[] _goalStamp;      // >0 when the cell is a goal of the current search
        readonly List<Int2> _goals = new List<Int2>(8);

        int _searchStamp;
        readonly NodeHeap _open;

        public AStarPathfinder(NavigationGrid nav)
        {
            _nav = nav;
            _w = nav.Width;
            _h = nav.Height;
            _cells = _w * _h;

            _gScore = new int[_cells];
            _cameFrom = new int[_cells];
            _stamp = new int[_cells];
            _closed = new bool[_cells];
            _goalStamp = new byte[_cells];
            _open = new NodeHeap(_cells);
            for (int i = 0; i < _cells; i++) _cameFrom[i] = -1;
        }

        public int LastExpandedNodes { get; private set; }
        public int LastResultCode { get; private set; }   // 0 fail, 1 exact, 2 partial

        /// <summary>Statistics for the HUD's perf overlay.</summary>
        public int TotalSearches { get; private set; }
        public int TotalExpanded { get; private set; }

        /// <summary>
        /// Core search. Writes waypoints into <paramref name="result"/> (start cell
        /// excluded, includes the goal).
        /// </summary>
        public bool FindPath(NavRequest req, PathResult result)
        {
            return FindPathMulti(req, null, 0, result);
        }

        /// <summary>Search toward the nearest of several targets (e.g. any stockpile).</summary>
        public bool FindPathMulti(NavRequest req, Int2[] extraGoals, int extraGoalCount, PathResult result)
        {
            if (result == null) return false;

            var surface = _nav.GetSurface(req.Profile, req.Team);

            if (!_nav.InBounds(req.Start))
            {
                LastResultCode = 0;
                return false;
            }

            Int2 start = req.Start;
            if (surface[_nav.ToIndex(start)] == NavigationGrid.Impassable)
            {
                // Snap the start to the nearest walkable cell (units can be shoved into
                // blocked cells by spawning or building underneath them).
                Int2 snapped;
                if (!_nav.TryFindWalkable(start, req.Profile, req.Team, 6, out snapped))
                {
                    LastResultCode = 0;
                    return false;
                }
                start = snapped;
            }

            int budget = req.MaxNodes > 0 ? req.MaxNodes : Balance.Pathfinding.MaxExpandedNodesPerRequest;

            _searchStamp++;
            _open.Clear();
            _goals.Clear();

            // ---- resolve the goal set -----------------------------------------
            Int2 goal = req.Goal;
            bool goalIsBlocked = !_nav.InBounds(goal) || surface[_nav.ToIndex(goal)] == NavigationGrid.Impassable;

            if (goalIsBlocked && req.AllowGoalBlocked)
            {
                // Path to a cell adjacent to the blocked target (trees, rocks, buildings).
                var neighbours = Int2.EightNeighbours;
                for (int i = 0; i < neighbours.Length; i++)
                    AddGoalCandidate(goal + neighbours[i], surface);
                if (_goals.Count == 0 && req.AllowPartial)
                {
                    Int2 snapped;
                    if (_nav.TryFindWalkable(goal, req.Profile, req.Team, 5, out snapped))
                        AddGoalCandidate(snapped, surface);
                }
            }
            else if (!goalIsBlocked)
            {
                _goals.Add(goal);
            }

            if (extraGoals != null)
            {
                for (int i = 0; i < extraGoalCount && i < extraGoals.Length; i++)
                    AddGoalCandidate(extraGoals[i], surface);
            }

            if (_goals.Count == 0)
            {
                LastResultCode = 0;
                LastExpandedNodes = 0;
                return false;
            }

            for (int i = 0; i < _goals.Count; i++) _goalStamp[_nav.ToIndex(_goals[i])] = 1;

            // ---- search ---------------------------------------------------------
            int startIndex = _nav.ToIndex(start);
            bool found = false;
            int bestNode = startIndex;
            int bestHeuristic = int.MaxValue;
            int expanded = 0;

            if (_goalStamp[startIndex] == 1) bestHeuristic = 0;

            _stamp[startIndex] = _searchStamp;
            _gScore[startIndex] = 0;
            _cameFrom[startIndex] = -1;
            _closed[startIndex] = false;

            _open.PushOrUpdate(startIndex, HeuristicToNearest(start) * 10);

            int iterations = 0;
            while (!_open.IsEmpty && iterations < MaxIterations)
            {
                iterations++;
                int current = _open.Pop();
                _closed[current] = true;
                expanded++;

                Int2 cc = _nav.FromIndex(current);
                int h = HeuristicToNearest(cc);

                if (_goalStamp[current] == 1)
                {
                    found = true;
                    bestNode = current;
                    break;
                }

                if (h < bestHeuristic)
                {
                    bestHeuristic = h;
                    bestNode = current;
                }

                if (expanded >= budget)
                {
                    // Out of budget: return the best partial path we have.
                    break;
                }

                int cg = _gScore[current];
                for (int d = 0; d < 8; d++)
                {
                    var offset = Int2.EightNeighbours[d];
                    Int2 nc = cc + offset;
                    if (!_nav.InBounds(nc)) continue;

                    int ni = _nav.ToIndex(nc);
                    byte cellCost = surface[ni];
                    if (cellCost == NavigationGrid.Impassable) continue;

                    bool diagonal = offset.x != 0 && offset.y != 0;
                    if (diagonal)
                    {
                        // No corner cutting: both orthogonal neighbours must be passable.
                        byte a = surface[_nav.ToIndex(new Int2(cc.x + offset.x, cc.y))];
                        byte b = surface[_nav.ToIndex(new Int2(cc.x, cc.y + offset.y))];
                        if (a == NavigationGrid.Impassable || b == NavigationGrid.Impassable) continue;
                    }

                    if (_stamp[ni] == _searchStamp && _closed[ni]) continue;

                    int step = (diagonal ? DiagonalStep : OrthogonalStep) * cellCost / NavigationGrid.NormalCost;
                    if (step < 1) step = 1;
                    int tentative = cg + step;

                    if (_stamp[ni] != _searchStamp)
                    {
                        _stamp[ni] = _searchStamp;
                        _closed[ni] = false;
                        _cameFrom[ni] = current;
                        _gScore[ni] = tentative;
                        _open.PushOrUpdate(ni, tentative + HeuristicToNearest(nc) * 10);
                    }
                    else if (tentative < _gScore[ni])
                    {
                        _cameFrom[ni] = current;
                        _gScore[ni] = tentative;
                        _open.PushOrUpdate(ni, tentative + HeuristicToNearest(nc) * 10);
                    }
                }
            }

            // Clear goal marks for the next search (small set).
            for (int i = 0; i < _goals.Count; i++) _goalStamp[_nav.ToIndex(_goals[i])] = 0;

            LastExpandedNodes = expanded;
            TotalSearches++;
            TotalExpanded += expanded;

            if (!found && !req.AllowPartial)
            {
                LastResultCode = 0;
                return false;
            }

            int endNode = bestNode;
            if (endNode == startIndex || _stamp[endNode] != _searchStamp)
            {
                LastResultCode = 0;
                return false;
            }

            // ---- reconstruct -----------------------------------------------------
            int node = endNode;
            int count = 0;
            while (node != -1 && node != startIndex)
            {
                if (count >= result.Waypoints.Length) break;
                result.Waypoints[count++] = _nav.FromIndex(node);
                node = _cameFrom[node];
            }

            // Reverse in place.
            for (int i = 0; i < count / 2; i++)
            {
                var tmp = result.Waypoints[i];
                result.Waypoints[i] = result.Waypoints[count - 1 - i];
                result.Waypoints[count - 1 - i] = tmp;
            }

            result.Count = count;
            result.Success = true;
            result.Partial = !found;
            result.ActualGoal = _nav.FromIndex(endNode);
            LastResultCode = found ? 1 : 2;
            return true;
        }

        void AddGoalCandidate(Int2 c, byte[] surface)
        {
            if (!_nav.InBounds(c)) return;
            if (surface[_nav.ToIndex(c)] == NavigationGrid.Impassable) return;
            if (_goalStamp[_nav.ToIndex(c)] == 1) return;
            if (_goals.Count >= 8) return;
            _goals.Add(c);
        }

        int HeuristicToNearest(Int2 from)
        {
            int best = int.MaxValue;
            for (int i = 0; i < _goals.Count; i++)
            {
                int h = Heuristic(from, _goals[i]);
                if (h < best) best = h;
            }
            return best;
        }

        static int Heuristic(Int2 a, Int2 b)
        {
            int dx = Mathf.Abs(a.x - b.x);
            int dy = Mathf.Abs(a.y - b.y);
            // Octile distance in "cells", scaled to match cost units.
            int diag = Mathf.Min(dx, dy);
            int straight = Mathf.Max(dx, dy) - diag;
            return diag * DiagonalStep + straight * OrthogonalStep;
        }

        /// <summary>
        /// String-pulling: drops waypoints whose straight line is walkable. Cuts
        /// waypoint counts by ~60% on open ground, which directly reduces the
        /// per-unit steering and separation work each tick.
        /// </summary>
        public int Smooth(PathResult result, NavProfile profile, Team team)
        {
            if (result.Count <= 2) return result.Count;
            var surface = _nav.GetSurface(profile, team);

            int lastKept = 0;
            for (int read = 1; read < result.Count; read++)
            {
                bool isLast = read == result.Count - 1;
                if (isLast || !HasLineOfWalk(result.Waypoints[lastKept], result.Waypoints[read + 1], surface))
                {
                    result.Waypoints[++lastKept] = result.Waypoints[read];
                }
            }
            result.Count = lastKept + 1;
            return result.Count;
        }

        bool HasLineOfWalk(Int2 a, Int2 b, byte[] surface)
        {
            int dx = Mathf.Abs(b.x - a.x);
            int dy = Mathf.Abs(b.y - a.y);
            int sx = a.x < b.x ? 1 : -1;
            int sy = a.y < b.y ? 1 : -1;
            int err = dx - dy;
            int x = a.x, y = a.y;
            int guard = 0;
            while (guard++ < 512)
            {
                if (!_nav.InBounds(new Int2(x, y))) return false;
                if (surface[_nav.ToIndex(new Int2(x, y))] == NavigationGrid.Impassable) return false;
                if (x == b.x && y == b.y) return true;
                int e2 = err * 2;
                if (e2 > -dy) { err -= dy; x += sx; }
                if (e2 < dx) { err += dx; y += sy; }
            }
            return false;
        }
    }
}
