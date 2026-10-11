// -----------------------------------------------------------------------------
//  File: World/PathfindingService.cs
//  Purpose: Schedules path requests against a per-frame millisecond budget and
//           hands back pooled results. On a phone we cannot afford a 12k-node A*
//           inside a single frame for 40 units at once, so requests queue and the
//           service spends at most Balance.Pathfinding.FrameBudgetMs per frame.
//
//  Results are pooled: the previous owner of a result must call Release().
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.World
{
    internal sealed class PathJob
    {
        public NavRequest Request;
        public PathResult Result;
        public bool Done;
        public bool Cancelled;
        public int Id;
        public object Owner;
    }

    public sealed class PathfindingService
    {
        readonly AStarPathfinder _astar;
        readonly NavigationGrid _nav;

        readonly List<PathJob> _queue = new List<PathJob>(256);
        readonly Stack<PathResult> _resultPool = new Stack<PathResult>(128);
        readonly Stack<PathJob> _jobPool = new Stack<PathJob>(128);

        int _nextId = 1;

        public PathfindingService(AStarPathfinder astar, NavigationGrid nav)
        {
            _astar = astar;
            _nav = nav;
        }

        public int QueuedCount { get { return _queue.Count; } }
        public int PooledResults { get { return _resultPool.Count; } }
        public int TotalSearches { get { return _astar.TotalSearches; } }
        public float LastFrameMs { get; private set; }

        /// <summary>Enqueues a path request. Returns a job token the caller polls.</summary>
        public PathJob Request(NavRequest req, object owner = null, int waypointCapacity = 128)
        {
            PathJob job = _jobPool.Count > 0 ? _jobPool.Pop() : new PathJob();
            job.Request = req;
            job.Done = false;
            job.Cancelled = false;
            job.Owner = owner;
            job.Id = _nextId++;

            // Prefer the largest pooled buffer so long paths never reallocate.
            PathResult result = _resultPool.Count > 0 ? _resultPool.Pop() : new PathResult();
            if (job.Result != null && job.Result.Waypoints.Length > result.Waypoints.Length)
            {
                var old = result;
                result = job.Result;
                _resultPool.Push(old);
            }
            job.Result = result;
            job.Result.Reset(waypointCapacity);
            _queue.Add(job);

            // Immediate mode when nothing is pending: small maps + few units make
            // short paths cheap enough to answer inline, which removes a tick of
            // latency for the very common case (a peasant stepping to a tree).
            if (_queue.Count == 1 && req.Start.ChebyshevTo(req.Goal) <= 8)
            {
                RunJob(job);
                _queue.RemoveAt(0);
            }

            return job;
        }

        public void Cancel(PathJob job)
        {
            if (job == null) return;
            job.Cancelled = true;
            _queue.Remove(job);
            Release(job);
        }

        public void Release(PathJob job)
        {
            if (job == null) return;
            if (job.Result != null)
            {
                job.Result.Count = 0;
                _resultPool.Push(job.Result);
                job.Result = null;
            }
            job.Owner = null;
            _jobPool.Push(job);
        }

        /// <summary>Called once per frame by GameWorld with unscaled frame time.</summary>
        public void Tick()
        {
            if (_queue.Count == 0) { LastFrameMs = 0f; return; }

            float startMs = Time.realtimeSinceStartup * 1000f;
            int processed = 0;

            while (_queue.Count > 0 && processed < Balance.Pathfinding.MaxRequestsPerTick)
            {
                float elapsed = Time.realtimeSinceStartup * 1000f - startMs;
                if (elapsed >= Balance.Pathfinding.FrameBudgetMs) break;

                PathJob job = _queue[0];
                _queue.RemoveAt(0);
                if (job.Cancelled) continue;
                RunJob(job);
                processed++;
            }

            LastFrameMs = Time.realtimeSinceStartup * 1000f - startMs;
        }

        void RunJob(PathJob job)
        {
            var req = job.Request;
            bool ok = _astar.FindPath(req, job.Result);
            if (ok && job.Result.Count > 1)
            {
                _astar.Smooth(job.Result, req.Profile, req.Team);
            }
            job.Done = true;
        }

        /// <summary>Synchronous "can I see this cell" check used by combat and AI.</summary>
        public bool IsWalkable(Int2 c, NavProfile profile, Team team)
        {
            return _nav.IsWalkable(c, profile, team);
        }

        /// <summary>Walks a straight line and reports whether every step is passable.</summary>
        public bool HasLineOfSight(Int2 a, Int2 b, NavProfile profile, Team team)
        {
            var surface = _nav.GetSurface(profile, team);
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

        /// <summary>Nearest walkable cell around a point (used when a goal is inside a wall).</summary>
        public bool TryFindWalkableNear(Int2 from, NavProfile profile, Team team, int radius, out Int2 result)
        {
            return _nav.TryFindWalkable(from, profile, team, radius, out result);
        }
    }
}
