// -----------------------------------------------------------------------------
//  File: Construction/BuildingRegistry.cs
//  Purpose: Flat-array store of every placed building for both teams, with
//           handle recycling and the spatial queries the rest of the game asks
//           for ("nearest granary", "any hostile building within 12 cells").
// -----------------------------------------------------------------------------
using System;
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;

namespace KurdCastle.Construction
{
    public sealed class BuildingRegistry
    {
        readonly List<BuildingInstance> _buildings = new List<BuildingInstance>(256);
        readonly Stack<int> _freeSlots = new Stack<int>(64);
        readonly List<BuildingInstance> _scratch = new List<BuildingInstance>(64);

        public int Count { get; private set; }
        public int Version { get; private set; }

        public event Action<BuildingInstance> Placed;
        public event Action<BuildingInstance> Removed;
        public event Action<BuildingInstance> Destroyed;

        public IReadOnlyList<BuildingInstance> All { get { return _buildings; } }

        public BuildingInstance Resolve(int handle)
        {
            if (handle == Handle.Invalid) return null;
            int index = Handle.IndexOf(handle);
            if (index < 0 || index >= _buildings.Count) return null;
            var b = _buildings[index];
            if (b == null || b.Handle != handle) return null;   // recycled slot
            return b;
        }

        public BuildingInstance Create(BuildingDefinition def, Team team, IntRect rect)
        {
            int index;
            int generation = 0;
            if (_freeSlots.Count > 0)
            {
                index = _freeSlots.Pop();
                generation = Handle.GenerationOf(_buildings[index].Handle);
                generation = Handle.NextGeneration(generation);
            }
            else
            {
                index = _buildings.Count;
                _buildings.Add(null);
            }

            var instance = _buildings[index] ?? new BuildingInstance();
            instance.Init(Handle.Make(index, generation), def, team, rect);
            _buildings[index] = instance;
            Count++;
            Version++;
            return instance;
        }

        public void MarkPlaced(BuildingInstance b)
        {
            if (b == null) return;
            Version++;
            if (Placed != null) Placed(b);
        }

        public void Remove(BuildingInstance b, bool destroyed)
        {
            if (b == null) return;
            int index = Handle.IndexOf(b.Handle);
            if (index < 0 || index >= _buildings.Count) return;
            if (!ReferenceEquals(_buildings[index], b)) return;

            _buildings[index] = null;
            _freeSlots.Push(index);
            Count--;
            Version++;
            if (destroyed)
            {
                if (Destroyed != null) Destroyed(b);
            }
            else
            {
                if (Removed != null) Removed(b);
            }
            b.Handle = Handle.Invalid;
        }

        // ---------------------------------------------------------------------
        //  Queries
        // ---------------------------------------------------------------------
        public void ForEach(Action<BuildingInstance> action)
        {
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b != null) action(b);
            }
        }

        public void ForEachOperational(Team team, Action<BuildingInstance> action)
        {
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b != null && b.Team == team && b.IsOperational) action(b);
            }
        }

        public int CountOperational(Team team, BuildingId id)
        {
            int n = 0;
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b != null && b.Team == team && b.IsOperational && b.Definition.Id == id) n++;
            }
            return n;
        }

        public int CountTeam(Team team)
        {
            int n = 0;
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b != null && b.Team == team && !b.IsRubble) n++;
            }
            return n;
        }

        /// <summary>Nearest building of a team matching a predicate (Chebyshev distance).</summary>
        public BuildingInstance FindNearest(Int2 from, Team team, Func<BuildingDefinition, bool> filter,
                                            bool requireOperational = true)
        {
            BuildingInstance best = null;
            int bestDist = int.MaxValue;
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b == null || b.Team != team) continue;
                if (requireOperational && !b.IsOperational) continue;
                if (filter != null && !filter(b.Definition)) continue;
                int d = b.Rect.Center.ChebyshevTo(from);
                if (d < bestDist) { bestDist = d; best = b; }
            }
            return best;
        }

        public BuildingInstance FindNearestCell(Int2 from, Team team, Func<BuildingDefinition, bool> filter)
        {
            return FindNearest(from, team, filter, false);
        }

        /// <summary>Collects buildings whose footprint intersects a radius around a cell.</summary>
        public void QueryRadius(Int2 center, int radius, Team team, List<BuildingInstance> results)
        {
            results.Clear();
            int r2 = radius * radius;
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b == null || b.IsRubble) continue;
                if (team != Team.Neutral && b.Team != team) continue;
                if (b.Rect.Center.SqrDistanceTo(center) <= r2) results.Add(b);
            }
        }

        public BuildingInstance BuildingAt(Int2 cell)
        {
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b != null && !b.IsRubble && b.Rect.Contains(cell)) return b;
            }
            return null;
        }

        /// <summary>All buildings of one id for a team (used for storage capacity sums).</summary>
        public void CollectById(Team team, BuildingId id, List<BuildingInstance> results)
        {
            results.Clear();
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b != null && b.Team == team && b.Definition.Id == id) results.Add(b);
            }
        }

        public bool AnyHostileWithin(Int2 cell, Team friendly, int radius)
        {
            int r2 = radius * radius;
            for (int i = 0; i < _buildings.Count; i++)
            {
                var b = _buildings[i];
                if (b == null || b.Team == friendly || b.IsRubble) continue;
                if (b.Rect.Center.SqrDistanceTo(cell) <= r2) return true;
            }
            return false;
        }

        public void Clear()
        {
            for (int i = 0; i < _buildings.Count; i++)
            {
                if (_buildings[i] != null) _buildings[i].Handle = Handle.Invalid;
            }
            _buildings.Clear();
            _freeSlots.Clear();
            Count = 0;
            Version++;
        }
    }
}
