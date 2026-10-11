// -----------------------------------------------------------------------------
//  File: Core/SimulationClock.cs
//  Purpose: Fixed-timestep accumulator that decouples simulation from render
//           frame rate, with player-controlled speed multipliers and a
//           spiral-of-death guard. Logic runs at Balance.Sim.TickRate (10 Hz) so
//           pathfinding and economy costs are predictable on low-end Android
//           hardware while units still move smoothly via view interpolation.
// -----------------------------------------------------------------------------
using System;
using KurdCastle.Config;
using UnityEngine;

namespace KurdCastle.Core
{
    public sealed class SimulationClock
    {
        public const float TickDelta = Balance.Sim.TickDelta;

        float _accumulator;
        int _tickIndex;
        double _elapsedSimSeconds;
        float _floorFps = 999f;

        public GameSpeed Speed { get; private set; } = GameSpeed.Normal;
        public int TickIndex { get { return _tickIndex; } }
        public double ElapsedSeconds { get { return _elapsedSimSeconds; } }
        public float Accumulator { get { return _accumulator; } }
        /// <summary>Fraction [0,1) between the last tick and the next, for view lerping.</summary>
        public float Alpha { get { return Mathf.Clamp01(_accumulator / TickDelta); } }
        public float FloorFps { get { return _floorFps; } }
        public float SpeedMultiplier { get { return MultiplierFor(Speed); } }

        public event Action<int> Tick;
        public event Action<GameSpeed, GameSpeed> SpeedChanged;

        public static float MultiplierFor(GameSpeed s)
        {
            switch (s)
            {
                case GameSpeed.Paused: return 0f;
                case GameSpeed.Fast: return 2f;
                case GameSpeed.VeryFast: return 4f;
                default: return 1f;
            }
        }

        public void SetSpeed(GameSpeed s)
        {
            if (Speed == s) return;
            var prev = Speed;
            Speed = s;
            _accumulator = 0f;
            if (SpeedChanged != null) SpeedChanged(prev, s);
        }

        /// <summary>Cycles Paused → Normal → Fast → VeryFast → Normal (pause handled separately).</summary>
        public void CycleSpeed()
        {
            switch (Speed)
            {
                case GameSpeed.Normal: SetSpeed(GameSpeed.Fast); break;
                case GameSpeed.Fast: SetSpeed(GameSpeed.VeryFast); break;
                default: SetSpeed(GameSpeed.Normal); break;
            }
        }

        public void TogglePause()
        {
            if (Speed == GameSpeed.Paused) SetSpeed(GameSpeed.Normal);
            else SetSpeed(GameSpeed.Paused);
        }

        /// <summary>
        /// Feeds real (unscaled) frame time. Returns how many logic ticks the
        /// caller must now execute.
        /// </summary>
        public int Advance(float unscaledDeltaTime)
        {
            if (unscaledDeltaTime > 0f)
            {
                float fps = 1f / unscaledDeltaTime;
                // Exponential floor tracker with 3s half-life: cheap perf telemetry.
                _floorFps = Mathf.Min(_floorFps * 0.999f + fps * 0.001f, fps);
            }

            if (Speed == GameSpeed.Paused) { _accumulator = 0f; return 0; }

            _accumulator += unscaledDeltaTime * SpeedMultiplier;

            int ticks = 0;
            while (_accumulator >= TickDelta && ticks < Balance.Sim.MaxCatchUpTicks)
            {
                _accumulator -= TickDelta;
                ticks++;
            }

            // If we hit the catch-up ceiling (device hitch / tab resumed), drop the
            // backlog rather than running the whole game in one frame.
            if (_accumulator > TickDelta * Balance.Sim.MaxCatchUpTicks)
                _accumulator = 0f;

            return ticks;
        }

        /// <summary>Runs a single stepped tick, used by tests and the "step" debug button.</summary>
        public void StepOnce()
        {
            _tickIndex++;
            _elapsedSimSeconds += TickDelta;
            if (Tick != null) Tick(_tickIndex);
        }

        /// <summary>Consumes the ticks returned by <see cref="Advance"/>.</summary>
        public void RunPending(int tickCount)
        {
            for (int i = 0; i < tickCount; i++) StepOnce();
        }

        public void Reset(GameSpeed speed = GameSpeed.Normal)
        {
            _accumulator = 0f;
            _tickIndex = 0;
            _elapsedSimSeconds = 0d;
            _floorFps = 999f;
            Speed = speed;
        }

        public string FormatElapsed()
        {
            int total = (int)_elapsedSimSeconds;
            return (total / 60).ToString("00") + ":" + (total % 60).ToString("00");
        }
    }
}
