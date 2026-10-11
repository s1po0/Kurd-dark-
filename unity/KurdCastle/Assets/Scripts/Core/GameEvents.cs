// -----------------------------------------------------------------------------
//  File: Core/GameEvents.cs
//  Purpose: Every message the simulation broadcasts to the presentation layer.
//           All payloads are structs / immutable references to keep the GC quiet.
// -----------------------------------------------------------------------------
using UnityEngine;
using KurdCastle.Config;

namespace KurdCastle.Core
{
    public enum GameState : byte
    {
        Booting = 0,
        Menu = 1,
        Playing = 2,
        Paused = 3,
        BuildPreview = 4, // playing, but a placement ghost owns the touch input
        Victory = 5,
        Defeat = 6,
    }

    public struct ResourceChangedEvent : IGameEvent
    {
        public Team Team;
        public ResourceType Type;
        public int Amount;
        public int Delta;
    }

    public struct StockpileFullEvent : IGameEvent
    {
        public Team Team;
        public ResourceType Type;
    }

    public struct PopulationChangedEvent : IGameEvent
    {
        public Team Team;
        public int Peasants;
        public int Military;
        public int Housing;
        public float Popularity;
        public float FoodRatePerMinute;
    }

    public struct UnitSpawnedEvent : IGameEvent
    {
        public int UnitId;
        public Team Team;
        public Vector3 Position;
    }

    public struct UnitDiedEvent : IGameEvent
    {
        public int UnitId;
        public Team Team;
        public Vector3 Position;
        public bool WasKilledByPlayer;
    }

    public struct BuildingPlacedEvent : IGameEvent
    {
        public BuildingId Id;
        public Team Team;
        public Vector2Int Origin;
    }

    public struct BuildingDestroyedEvent : IGameEvent
    {
        public BuildingId Id;
        public Team Team;
        public Vector2Int Origin;
    }

    public struct BuildRejectedEvent : IGameEvent
    {
        public BuildingId Id;
        public PlacementError Reason;
        /// <summary>Cell the player tapped, for a world-space "X" marker.</summary>
        public Vector2Int Cell;
    }

    public struct GameStateChangedEvent : IGameEvent
    {
        public GameState Previous;
        public GameState Current;
    }

    public struct WaveAnnouncementEvent : IGameEvent
    {
        public int WaveIndex;
        public int TotalWaves;
        public string Title;
        public float SecondsUntilArrival;
        public int EnemyCount;
    }

    public struct WaveStartedEvent : IGameEvent
    {
        public int WaveIndex;
        public int EnemyCount;
        public bool HasSiege;
    }

    public struct WaveClearedEvent : IGameEvent
    {
        public int WaveIndex;
        public int GoldReward;
        public int RemainingWaves;
    }

    public struct ToastEvent : IGameEvent
    {
        public string Message;
        public float Duration;
        public ToastSeverity Severity;

        public static ToastEvent Info(string msg) { return Make(msg, ToastSeverity.Info); }
        public static ToastEvent Warn(string msg) { return Make(msg, ToastSeverity.Warning); }
        public static ToastEvent Good(string msg) { return Make(msg, ToastSeverity.Success); }
        public static ToastEvent Bad(string msg) { return Make(msg, ToastSeverity.Danger); }

        static ToastEvent Make(string msg, ToastSeverity sev)
        {
            return new ToastEvent { Message = msg, Duration = Balance.Ui.ToastDuration, Severity = sev };
        }
    }

    public enum ToastSeverity : byte { Info = 0, Success = 1, Warning = 2, Danger = 3 }

    public struct SelectionChangedEvent : IGameEvent
    {
        public int PrimaryUnitHandle;
        public int SelectedCount;
        public BuildingId SelectedBuilding;
        public Vector2Int SelectedCell;
        public bool HasSelection;
    }

    public struct UnderAttackEvent : IGameEvent
    {
        public bool Active;
        public Vector2Int Cell;
        public Team AttackedTeam;
    }

    public struct TrainingQueuedEvent : IGameEvent
    {
        public UnitId Unit;
        public int QueueLength;
        public int BuildingHandle;
        public float SecondsRemaining;
    }

    public struct TrainingCompletedEvent : IGameEvent
    {
        public UnitId Unit;
        public int BuildingHandle;
    }

    public struct GameOverEvent : IGameEvent
    {
        public bool Victory;
        public string Title;
        public string Summary;
    }

    public struct GateToggledEvent : IGameEvent
    {
        public Vector2Int Cell;
        public bool Open;
    }

    public struct RepairOrderedEvent : IGameEvent
    {
        public Vector2Int Cell;
        public bool Queued;
    }

    public struct GameSpeedChangedEvent : IGameEvent
    {
        public GameSpeed Previous;
        public GameSpeed Current;
        public float Multiplier;
    }

    public struct MinimapPingEvent : IGameEvent
    {
        public Vector2Int Cell;
        public Color Color;
    }

    public struct CameraFocusEvent : IGameEvent
    {
        public Vector3 WorldPosition;
        public bool Instant;
    }

    public struct ResourceDeliveredEvent : IGameEvent
    {
        public ResourceType Type;
        public int Amount;
        public Vector3 WorldPosition;
    }

    public struct ProjectileFiredEvent : IGameEvent
    {
        public Vector3 From;
        public Vector3 To;
        public int UnitId;
    }

    public struct CameraShakeEvent : IGameEvent
    {
        public float Magnitude;
        public float Duration;
        public Vector3 WorldPosition;
    }

    public struct FirstRunTipEvent : IGameEvent
    {
        public string Title;
        public string Body;
    }
}
