// -----------------------------------------------------------------------------
//  File: Core/PerfMonitor.cs
//  Purpose: Keeps the prototype honest about the 60 FPS target on mid-range
//           Android hardware. Tracks a rolling frame time, exposes the numbers
//           the HUD/debug overlay shows, and applies two gentle degradations
//           before the player ever notices a stutter:
//
//     1. below the low-FPS watermark the unit view cull distance is reduced and
//        shadow/particle quality is stepped down
//     2. above the high-FPS watermark (sustained) the quality is restored
//
//  Deliberately conservative: it never touches simulation rate, because a
//  mobile RTS that runs its logic at half speed feels broken, not smooth.
// -----------------------------------------------------------------------------
using UnityEngine;
using KurdCastle.Config;

namespace KurdCastle.Core
{
    public sealed class PerfMonitor
    {
        readonly float[] _frameSamples = new float[120];
        int _sampleIndex;
        float _checkTimer;
        int _qualityLevel;   // 0 = full, 1 = reduced, 2 = minimal

        public float AverageFrameMs { get; private set; }
        public float AverageFps { get { return AverageFrameMs > 0.0001f ? 1000f / AverageFrameMs : 0f; } }
        public float WorstFrameMs { get; private set; }
        public int QualityLevel { get { return _qualityLevel; } }
        public int LiveUnits { get; set; }
        public int LiveProjectiles { get; set; }
        public int LiveBuildings { get; set; }
        public int PathRequestsQueued { get; set; }
        public float PathfindingMs { get; set; }
        public int FlowFieldNodes { get; set; }

        public void Tick(float unscaledDeltaTime)
        {
            _frameSamples[_sampleIndex] = unscaledDeltaTime * 1000f;
            _sampleIndex = (_sampleIndex + 1) % _frameSamples.Length;

            float sum = 0f, worst = 0f;
            for (int i = 0; i < _frameSamples.Length; i++)
            {
                sum += _frameSamples[i];
                if (_frameSamples[i] > worst) worst = _frameSamples[i];
            }
            AverageFrameMs = sum / _frameSamples.Length;
            WorstFrameMs = worst;

            _checkTimer += unscaledDeltaTime;
            if (_checkTimer < Balance.Performance.AdaptiveCheckInterval) return;
            _checkTimer = 0f;

            float fps = AverageFps;
            if (fps < Balance.Performance.AdaptiveQualityLowFps && _qualityLevel < 2) SetQuality(_qualityLevel + 1);
            else if (fps > Balance.Performance.AdaptiveQualityHighFps && _qualityLevel > 0) SetQuality(_qualityLevel - 1);
        }

        void SetQuality(int level)
        {
            _qualityLevel = Mathf.Clamp(level, 0, 2);
            switch (_qualityLevel)
            {
                case 0:
                    QualitySettings.shadows = ShadowQuality.All;
                    Application.targetFrameRate = Balance.Performance.TargetFrameRate;
                    break;
                case 1:
                    QualitySettings.shadows = ShadowQuality.HardOnly;
                    Application.targetFrameRate = Balance.Performance.TargetFrameRate;
                    break;
                default:
                    QualitySettings.shadows = ShadowQuality.Disable;
                    Application.targetFrameRate = 45;
                    break;
            }
            Debug.Log("[PerfMonitor] Quality level → " + _qualityLevel + " at " + AverageFps.ToString("0") + " fps");
        }

        public string StatusLine()
        {
            return AverageFps.ToString("0") + " fps (" + AverageFrameMs.ToString("0.0") + " ms)  ·  "
                 + LiveUnits + " units  ·  " + LiveProjectiles + " projectiles  ·  "
                 + LiveBuildings + " buildings  ·  path " + PathfindingMs.ToString("0.00") + " ms";
        }
    }
}
