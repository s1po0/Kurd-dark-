// -----------------------------------------------------------------------------
//  File: Core/Handles.cs
//  Purpose: Packed entity handles. Units and buildings live in flat arrays for
//           cache locality, but code outside the registries holds ints. Packing
//           (index, generation) into one int lets us detect stale handles after
//           a slot is recycled — the classic source of "ghost unit" bugs.
// -----------------------------------------------------------------------------
using UnityEngine;

namespace KurdCastle.Core
{
    public static class Handle
    {
        public const int IndexMask = 0xFFFFF;   // 20 bits → 1,048,575 live slots
        public const int IndexBits = 20;
        public const int MaxGeneration = 0x7FF; // 11 bits

        public static readonly int Invalid = -1;

        public static int Make(int index, int generation)
        {
            return ((generation & MaxGeneration) << IndexBits) | (index & IndexMask);
        }

        public static int IndexOf(int handle) { return handle & IndexMask; }
        public static int GenerationOf(int handle) { return (handle >> IndexBits) & MaxGeneration; }
        public static bool IsValid(int handle) { return handle >= 0; }

        public static int NextGeneration(int generation)
        {
            generation++;
            if (generation > MaxGeneration) generation = 1;
            return generation;
        }
    }

    /// <summary>Lightweight 2-slot handle pair, used by selection sets.</summary>
    public struct EntityRef
    {
        public int Handle;
        public bool IsBuilding;

        public EntityRef(int handle, bool isBuilding) { Handle = handle; IsBuilding = isBuilding; }
        public static readonly EntityRef None = new EntityRef(Handle.Invalid, false);
        public bool IsValid { get { return Handle != Handle.Invalid; } }
        public override string ToString() { return (IsBuilding ? "B:" : "U:") + Handle; }
    }
}
