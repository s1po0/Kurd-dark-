// -----------------------------------------------------------------------------
//  File: Core/GameStateManager.cs
//  Purpose: Finite state machine for the whole application (Menu → Gameplay →
//           Pause → Victory/Defeat). Owns the simulation clock and is the only
//           place allowed to change game state, which keeps "can the player
//           build right now?" a single, auditable question.
// -----------------------------------------------------------------------------
using System;
using KurdCastle.Config;
using UnityEngine;

namespace KurdCastle.Core
{
    public sealed class GameStateManager
    {
        public GameState State { get; private set; } = GameState.Booting;
        public GameState PreviousState { get; private set; } = GameState.Booting;

        public SimulationClock Clock { get; } = new SimulationClock();

        /// <summary>Wall-clock seconds since gameplay began (unaffected by speed).</summary>
        public float PlayTime { get; private set; }

        /// <summary>Objectives completed / total, surfaced by the HUD.</summary>
        public int WaveIndex { get; internal set; }
        public int WavesCleared { get; internal set; }
        public int WavesTotal { get; internal set; } = Balance.Progression.TotalWaves;

        public string GameOverTitle { get; private set; }
        public string GameOverSummary { get; private set; }
        public int ScoreUnitsKilled { get; internal set; }
        public int ScoreEnemiesKilled { get; internal set; }
        public int ScoreBuildingsRaised { get; internal set; }

        public event Action<GameState, GameState> StateChanged;
        /// <summary>Raised once per frame while a simulation clock tick was executed.</summary>
        public event Action<int> Tick;

        public bool IsSimulationRunning
        {
            get { return State == GameState.Playing || State == GameState.BuildPreview; }
        }

        /// <summary>True whenever a modal overlay should swallow touch input.</summary>
        public bool IsModal
        {
            get { return State == GameState.Menu || State == GameState.Paused || IsGameOver; }
        }

        public bool IsGameOver
        {
            get { return State == GameState.Victory || State == GameState.Defeat; }
        }

        public GameStateManager()
        {
            Clock.Tick += OnClockTick;
            Clock.SpeedChanged += (prev, next) =>
                EventBus.Publish(new GameSpeedChangedEvent
                {
                    Previous = prev, Current = next, Multiplier = SimulationClock.MultiplierFor(next),
                });
        }

        void OnClockTick(int tick)
        {
            if (Tick != null) Tick(tick);
        }

        public bool TransitionTo(GameState next)
        {
            if (State == next) return false;
            if (!IsLegal(State, next))
            {
                Debug.LogWarning("[GameState] Illegal transition " + State + " → " + next);
                return false;
            }

            PreviousState = State;
            State = next;

            // Auto-pause rule: leaving gameplay always freezes the clock, entering
            // gameplay always restores the player's chosen speed.
            if (next == GameState.Paused && Clock.Speed != GameSpeed.Paused) Clock.TogglePause();
            else if (next == GameState.Playing && Clock.Speed == GameSpeed.Paused) Clock.TogglePause();

            EventBus.Publish(new GameStateChangedEvent { Previous = PreviousState, Current = State });
            if (StateChanged != null) StateChanged(PreviousState, State);
            return true;
        }

        static bool IsLegal(GameState from, GameState to)
        {
            switch (from)
            {
                case GameState.Booting:
                    return to == GameState.Menu || to == GameState.Playing;
                case GameState.Menu:
                    return to == GameState.Playing;
                case GameState.Playing:
                case GameState.BuildPreview:
                    return to == GameState.Paused || to == GameState.Playing
                        || to == GameState.BuildPreview || to == GameState.Victory
                        || to == GameState.Defeat || to == GameState.Menu;
                case GameState.Paused:
                    return to == GameState.Playing || to == GameState.Menu;
                case GameState.Victory:
                case GameState.Defeat:
                    return to == GameState.Menu || to == GameState.Playing; // replay
                default:
                    return false;
            }
        }

        /// <summary>Enters the placement sub-mode (ghost follows the finger).</summary>
        public void EnterBuildPreview()
        {
            if (State == GameState.Playing) TransitionTo(GameState.BuildPreview);
        }

        /// <summary>Leaves the placement sub-mode without pausing.</summary>
        public void ExitBuildPreview()
        {
            if (State == GameState.BuildPreview) TransitionTo(GameState.Playing);
        }

        public void Pause()
        {
            if (IsSimulationRunning) TransitionTo(GameState.Paused);
        }

        public void Resume()
        {
            if (State == GameState.Paused) TransitionTo(GameState.Playing);
        }

        public void StartMatch()
        {
            ScoreUnitsKilled = 0;
            ScoreEnemiesKilled = 0;
            ScoreBuildingsRaised = 0;
            PlayTime = 0f;
            WavesCleared = 0;
            WaveIndex = 0;
            GameOverTitle = null;
            GameOverSummary = null;
            Clock.Reset(GameSpeed.Normal);
            TransitionTo(GameState.Playing);
        }

        public void TriggerVictory(string title, string summary)
        {
            if (IsGameOver) return;
            GameOverTitle = string.IsNullOrEmpty(title) ? "Victory!" : title;
            GameOverSummary = summary;
            TransitionTo(GameState.Victory);
            EventBus.Publish(new GameOverEvent { Victory = true, Title = GameOverTitle, Summary = GameOverSummary });
        }

        public void TriggerDefeat(string title, string summary)
        {
            if (IsGameOver) return;
            GameOverTitle = string.IsNullOrEmpty(title) ? "The Castle Has Fallen" : title;
            GameOverSummary = summary;
            TransitionTo(GameState.Defeat);
            EventBus.Publish(new GameOverEvent { Victory = false, Title = GameOverTitle, Summary = GameOverSummary });
        }

        public void ReturnToMenu()
        {
            TransitionTo(GameState.Menu);
        }

        /// <summary>Steps the app: called once per frame by GameWorld.</summary>
        public void Tick_(float unscaledDeltaTime)
        {
            if (!IsSimulationRunning) return;
            PlayTime += unscaledDeltaTime;
            int ticks = Clock.Advance(unscaledDeltaTime);
            Clock.RunPending(ticks);
        }
    }
}
