// -----------------------------------------------------------------------------
//  File: Construction/BuildingInstance.cs
//  Purpose: Runtime state for one placed structure. Buildings live in a flat
//           array inside BuildingRegistry (pooled, no per-building MonoBehaviour)
//           because a 300-building castle must not cost 300 game objects.
// -----------------------------------------------------------------------------
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;

namespace KurdCastle.Construction
{
    public sealed class BuildingInstance
    {
        // identity
        public int Handle = Handle.Invalid;
        public BuildingDefinition Definition;
        public Team Team = Team.Player;

        // footprint
        public IntRect Rect;
        public Int2 Origin;
        public Vector3 Center;

        // lifecycle
        public bool IsConstructionSite;
        public float BuildProgress;        // 0..1, 1 = finished
        public bool IsDestroyed;
        public bool IsRubble;
        public float RubbleTimer;
        public float Health;
        public float MaxHealth;

        // economy
        public float ProductionProgress;   // 0..1 of the current cycle
        public ResourceType StoredType = ResourceType.None;
        public int StoredAmount;
        public int StoredCapacity = 30;    // haulers empty this into the stockpile
        public float WorkerBonus = 1f;     // mill/forester style multipliers from neighbours
        public float LastProductionRate;   // units per minute, for the inspector panel

        // workforce (parallel-array style: slots + occupant handles)
        public int[] WorkerSlots = System.Array.Empty<int>();
        public int WorkerCount;
        public int WorkersRequested;       // how many the economy would like to staff

        // military
        public bool GateOpen = true;
        public float DefenseCooldown;
        public int GarrisonCount;
        public int[] GarrisonSlots = System.Array.Empty<int>();

        // training queue (barracks / archery range / stables)
        public readonly System.Collections.Generic.List<UnitId> TrainingQueue =
            new System.Collections.Generic.List<UnitId>(4);
        public float TrainingProgress;

        // repair / damage feedback
        public bool RepairQueued;
        public float DamageFlash;

        public bool IsOperational
        {
            get { return !IsDestroyed && !IsConstructionSite && !IsRubble && Definition != null; }
        }

        public bool IsFull { get { return StoredAmount >= StoredCapacity; } }

        public float HealthPct
        {
            get { return MaxHealth <= 0f ? 0f : Mathf.Clamp01(Health / MaxHealth); }
        }

        public int CellCount { get { return Rect.width * Rect.height; } }

        /// <summary>Working radius used by auras (mills, healers, popularity).</summary>
        public float AuraRadius { get { return Mathf.Max(Rect.width, Rect.height) + 6f; } }

        public void Init(int handle, BuildingDefinition def, Team team, IntRect rect)
        {
            Handle = handle;
            Definition = def;
            Team = team;
            Rect = rect;
            Origin = new Int2(rect.x, rect.y);
            Center = new Vector3(rect.x + rect.width * 0.5f, 0f, rect.y + rect.height * 0.5f);

            IsConstructionSite = false;
            BuildProgress = 1f;
            IsDestroyed = false;
            IsRubble = false;
            MaxHealth = def.MaxHealth * Balance.Combat.GlobalHealthScale;
            Health = MaxHealth;
            ProductionProgress = 0f;
            StoredType = ResourceType.None;
            StoredAmount = 0;
            WorkerBonus = 1f;
            WorkerCount = 0;
            WorkersRequested = def.WorkerSlots;
            GateOpen = true;
            DefenseCooldown = 0f;
            GarrisonCount = 0;
            RepairQueued = false;
            TrainingQueue.Clear();
            TrainingProgress = 0f;

            if (WorkerSlots.Length < def.WorkerSlots) WorkerSlots = new int[def.WorkerSlots];
            for (int i = 0; i < WorkerSlots.Length; i++) WorkerSlots[i] = Handle.Invalid;

            if (GarrisonSlots.Length < def.GarrisonSlots) GarrisonSlots = new int[def.GarrisonSlots];
            for (int i = 0; i < GarrisonSlots.Length; i++) GarrisonSlots[i] = Handle.Invalid;
        }

        public float Damage(float amount, DamageType type)
        {
            float applied = DamageMatrix.Apply(amount, type, Definition != null ? Definition.Armor : ArmorType.Wood,
                                               Balance.Combat.GlobalDamageScale);
            Health -= applied;
            DamageFlash = 1f;
            return applied;
        }

        public bool HasFreeWorkerSlot
        {
            get
            {
                for (int i = 0; i < WorkerSlots.Length; i++)
                    if (WorkerSlots[i] == Handle.Invalid) return true;
                return false;
            }
        }

        public bool TryAddWorker(int unitHandle)
        {
            for (int i = 0; i < WorkerSlots.Length; i++)
            {
                if (WorkerSlots[i] != Handle.Invalid) continue;
                WorkerSlots[i] = unitHandle;
                WorkerCount++;
                return true;
            }
            return false;
        }

        public bool RemoveWorker(int unitHandle)
        {
            for (int i = 0; i < WorkerSlots.Length; i++)
            {
                if (WorkerSlots[i] != unitHandle) continue;
                WorkerSlots[i] = Handle.Invalid;
                WorkerCount = Mathf.Max(0, WorkerCount - 1);
                return true;
            }
            return false;
        }

        public bool HasFreeGarrisonSlot
        {
            get
            {
                for (int i = 0; i < GarrisonSlots.Length; i++)
                    if (GarrisonSlots[i] == Handle.Invalid) return true;
                return false;
            }
        }

        public bool TryAddGarrison(int unitHandle)
        {
            for (int i = 0; i < GarrisonSlots.Length; i++)
            {
                if (GarrisonSlots[i] != Handle.Invalid) continue;
                GarrisonSlots[i] = unitHandle;
                GarrisonCount++;
                return true;
            }
            return false;
        }

        public bool RemoveGarrison(int unitHandle)
        {
            for (int i = 0; i < GarrisonSlots.Length; i++)
            {
                if (GarrisonSlots[i] != unitHandle) continue;
                GarrisonSlots[i] = Handle.Invalid;
                GarrisonCount = Mathf.Max(0, GarrisonCount - 1);
                return true;
            }
            return false;
        }

        public override string ToString()
        {
            return Definition + " " + Rect + " hp " + Mathf.RoundToInt(Health) + "/" + Mathf.RoundToInt(MaxHealth);
        }
    }
}
