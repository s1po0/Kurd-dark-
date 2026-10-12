// -----------------------------------------------------------------------------
//  File: World/FlowFieldService.cs
//  Purpose: Dijkstra integration fields used by the attacking horde. Instead of
//           asking A* for 60 individual paths every time a wave spawns (which is
//           exactly the kind of spike that drops frames on a mid-range Android
//           device), the AI computes one field toward the keep and every enemy
//           walks downhill on it.
//
//  The computation is incremental: StepCompute() expands a bounded number of
//  nodes per frame so a full 96x96 field never costs more than a fraction of a
//  millisecond per frame and the player never sees a hitch.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.World
{
    public sealed class FlowField
    {
        public const int Unreachable = int.MaxValue / 4;

        internal readonly int[] Dist;
        internal readonly int[] Stamp;
        internal readonly NodeHeap Open;

        internal int W, H;
        internal Int2 Target;
        internal Team Owner;
        internal NavProfile Profile;
        internal int SearchStamp;
        internal bool Complete;
        internal bool RebuildStarted;

        public FlowField(int width, int height)
        {
            W = width; H = height;
            int cells = width * height;
            Dist = new int[cells];
            Stamp = new int[cells];
            Open = new NodeHeap(cells);
            for (int i = 0; i < cells; i++) Dist[i] = Unreachable;
        }

        public bool IsValid(Vector2Int target, NavProfile profile, Team team)
        {
            return Complete && Target.x == target.x && Target.y == target.y &&
                   Profile == profile && Owner == team;
        }

        public int CostAt(Int2 c)
        {
            if (c.x < 0 || c.y < 0 || c.x >= W || c.y >= H) return Unreachable;
            int i = c.y * W + c.x;
            return Stamp[i] == SearchStamp ? Dist[i] : Unreachable;
        }

        public bool IsReachable(Int2 c) { return CostAt(c) < Unreachable; }

        /// <summary>Downhill step from a cell. Returns false when already at the goal / stuck.</summary>
        public bool NextStep(Int2 from, out Int2 next)
        {
            next = from;
            int best = CostAt(from);
            if (best >= Unreachable) return false;
            if (from == Target) return false;

            var neighbours = Int2.EightNeighbours;
            for (int i = 0; i < neighbours.Length; i++)
            {
                var c = from + neighbours[i];
                int d = CostAt(c);
                if (d >= Unreachable) continue;
                // Prefer strictly downhill; ties broken toward the target to avoid jitter.
                if (d < best || (d == best && c.SqrDistanceTo(Target) < from.SqrDistanceTo(Target)))
                {
                    best = d;
                    next = c;
                }
            }
            return next != from;
        }

        /// <summary>Local gradient blended with the raw direction, for smooth steering.</summary>
        public Vector2 DesiredDirection(Int2 from)
        {
            Int2 next;
            if (!NextStep(from, out next)) return Vector2.zero;
            Vector2 dir = new Vector2(next.x - from.x, next.y - from.y);
            return dir.sqrMagnitude > 0.0001f ? dir.normalized : Vector2.zero;
        }
    }

    public sealed class FlowFieldService
    {
        readonly NavigationGrid _nav;
        readonly MapGrid _grid;

        readonly FlowField[] _fields;                  // one per profile
        readonly Int2[] _targets;
        readonly bool[] _dirty;

        public FlowFieldService(NavigationGrid nav, MapGrid grid)
        {
            _nav = nav;
            _grid = grid;
            _fields = new FlowField[(int)NavProfile.Count];
            _targets = new Int2[(int)NavProfile.Count];
            _dirty = new bool[(int)NavProfile.Count];
            for (int i = 0; i < _fields.Length; i++)
            {
                _fields[i] = new FlowField(nav.Width, nav.Height);
                _dirty[i] = true;
            }
        }

        public int NodesLastFrame { get; private set; }
        public int TotalFieldsBuilt { get; private set; }

        /// <summary>Marks every field stale (called when the map changes).</summary>
        public void InvalidateAll()
        {
            for (int i = 0; i < _dirty.Length; i++) _dirty[i] = true;
        }

        public void Invalidate(NavProfile profile) { _dirty[(int)profile] = true; }

        /// <summary>Returns the field for a profile, restarting it if the target moved.</summary>
        public FlowField GetField(NavProfile profile, Int2 target, Team team)
        {
            int idx = (int)profile;
            var field = _fields[idx];
            if (!field.IsValid(new Vector2Int(target.x, target.y), profile, team))
            {
                _targets[idx] = target;
                _dirty[idx] = true;
                field.Target = target;
                field.Owner = team;
                field.Profile = profile;
            }
            return field;
        }

        /// <summary>
        /// Expands up to <paramref name="nodeBudget"/> graph nodes across the stale
        /// fields. Call once per frame.
        /// </summary>
        public void StepCompute(int nodeBudget)
        {
            NodesLastFrame = 0;
            if (nodeBudget <= 0) return;
            int remaining = nodeBudget;

            for (int p = 0; p < _fields.Length && remaining > 0; p++)
            {
                var field = _fields[p];
                if (!_dirty[p]) continue;

                var surface = _nav.GetSurface((NavProfile)p, field.Owner);

                if (!field.RebuildStarted)
                {
                    StartRebuild(field, _targets[p]);
                    if (!_nav.InBounds(_targets[p]))
                    {
                        field.Complete = true;
                        _dirty[p] = false;
                        continue;
                    }
                }

                int before = remaining;
                remaining = Expand(field, surface, remaining);
                NodesLastFrame += before - remaining;

                if (field.Open.IsEmpty)
                {
                    field.Complete = true;
                    field.RebuildStarted = false;
                    _dirty[p] = false;
                    TotalFieldsBuilt++;
                }
            }
        }

        void StartRebuild(FlowField field, Int2 target)
        {
            field.SearchStamp++;
            field.Complete = false;
            field.RebuildStarted = true;
            field.Open.Clear();

            int cells = field.W * field.H;
            for (int i = 0; i < cells; i++)
            {
                field.Dist[i] = FlowField.Unreachable;
                field.Stamp[i] = 0;
            }
            if (!_nav.InBounds(target)) return;

            int ti = field.W * target.y + target.x;
            field.Dist[ti] = 0;
            field.Stamp[ti] = field.SearchStamp;
            field.Open.PushOrUpdate(ti, 0);
        }

        int Expand(FlowField field, byte[] surface, int budget)
        {
            int expanded = 0;
            while (!field.Open.IsEmpty && expanded < budget)
            {
                int current = field.Open.Pop();
                expanded++;
                int cd = field.Dist[current];
                Int2 cc = new Int2(current % field.W, current / field.W);

                for (int d = 0; d < 8; d++)
                {
                    var offset = Int2.EightNeighbours[d];
                    int nx = cc.x + offset.x;
                    int ny = cc.y + offset.y;
                    if (nx < 0 || ny < 0 || nx >= field.W || ny >= field.H) continue;

                    int ni = ny * field.W + nx;
                    byte cellCost = surface[ni];
                    if (cellCost == NavigationGrid.Impassable) continue;

                    bool diagonal = offset.x != 0 && offset.y != 0;
                    if (diagonal)
                    {
                        int a = ny * field.W + cc.x;
                        int b = cc.y * field.W + nx;
                        if (surface[a] == NavigationGrid.Impassable || surface[b] == NavigationGrid.Impassable) continue;
                    }

                    int step = (diagonal ? 14 : 10) * cellCost / NavigationGrid.NormalCost;
                    if (step < 1) step = 1;
                    int nd = cd + step;

                    bool fresh = field.Stamp[ni] != field.SearchStamp;
                    if (fresh || nd < field.Dist[ni])
                    {
                        field.Dist[ni] = nd;
                        field.Stamp[ni] = field.SearchStamp;
                        field.Open.PushOrUpdate(ni, nd);
                    }
                }
            }
            return budget - expanded;
        }

        /// <summary>Nodes-per-second the AI needs to keep siege pathing fresh — shown in the perf overlay.</summary>
        public int PendingProfiles
        {
            get
            {
                int n = 0;
                for (int i = 0; i < _dirty.Length; i++) if (_dirty[i]) n++;
                return n;
            }
        }
    }
}
