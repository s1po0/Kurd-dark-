// -----------------------------------------------------------------------------
//  File: AI/WaveDirector.cs
//  Purpose: Paces the skirmish. Announces each wave, musters it at the raider
//           camp, hands it to the EnemyCommander, rewards the player for
//           surviving, and decides victory/defeat.
//
//  The schedule comes from Config/WaveTable so the difficulty curve is data.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;
using KurdCastle.World;

namespace KurdCastle.AI
{
    public sealed class WaveDirector
    {
        readonly IWorld _world;
        readonly UnitRegistry _units;

        float _timer;
        int _waveIndex;
        bool _waveActive;
        bool _finished;
        readonly List<UnitInstance> _activeWaveUnits = new List<UnitInstance>(64);

        public WaveDirector(IWorld world, UnitRegistry units)
        {
            _world = world;
            _units = units;
        }

        public int WaveIndex { get { return _waveIndex; } }
        public int WavesTotal { get { return WaveTable.All.Length; } }
        public bool WaveActive { get { return _waveActive; } }
        public float SecondsUntilNextWave { get { return Mathf.Max(0f, _timer); } }
        public int TotalEnemiesSpawned { get; private set; }

        public void Start()
        {
            _waveIndex = 0;
            _waveActive = false;
            _finished = false;
            _timer = WaveTable.All[0].DelaySeconds;
            _world.State.WavesTotal = WavesTotal;
            _world.State.WaveIndex = 0;

            AnnounceNext();
        }

        void AnnounceNext()
        {
            if (_waveIndex >= WaveTable.All.Length) return;
            var wave = WaveTable.All[_waveIndex];
            EventBus.Publish(new WaveAnnouncementEvent
            {
                WaveIndex = _waveIndex + 1,
                TotalWaves = WavesTotal,
                Title = wave.Title,
                SecondsUntilArrival = _timer,
                EnemyCount = WaveTable.TotalUnitsInWave(_waveIndex),
            });
            EventBus.Publish(ToastEvent.Warn("Wave " + (_waveIndex + 1) + " incoming: " + wave.Title));
        }

        public void Tick(float dt)
        {
            if (_finished) return;

            if (!_waveActive)
            {
                _timer -= dt;
                if (_timer <= 0f) StartWave();
                return;
            }

            // Wave finished when every spawned attacker is dead or has retreated.
            bool anyAlive = false;
            for (int i = 0; i < _activeWaveUnits.Count; i++)
            {
                var u = _activeWaveUnits[i];
                if (u != null && u.IsAlive) { anyAlive = true; break; }
            }

            if (anyAlive) return;
            CompleteWave();
        }

        void StartWave()
        {
            if (_waveIndex >= WaveTable.All.Length) return;
            var wave = WaveTable.All[_waveIndex];
            _activeWaveUnits.Clear();

            var camp = _world.EnemyCampCell;

            int spawned = 0;
            for (int s = 0; s < wave.Squads.Length; s++)
            {
                var squad = wave.Squads[s];
                var def = UnitCatalog.Get(squad.Unit);
                for (int c = 0; c < squad.Count; c++)
                {
                    Int2 cell = FindSpawnCell(camp, spawned, squad.Unit);
                    var unit = _units.Spawn(def, Team.Enemy, new Vector3(cell.x + 0.5f, 0f, cell.y + 0.5f));
                    if (unit == null) continue;

                    unit.Order = UnitOrder.AttackMove;
                    unit.Job = JobType.None;
                    _activeWaveUnits.Add(unit);
                    spawned++;
                    TotalEnemiesSpawned++;

                    EventBus.Publish(new UnitSpawnedEvent
                    {
                        UnitId = (int)squad.Unit, Team = Team.Enemy, Position = unit.Position,
                    });
                }
            }

            _waveActive = true;
            _world.State.WaveIndex = _waveIndex + 1;

            EventBus.Publish(new WaveStartedEvent
            {
                WaveIndex = _waveIndex + 1,
                EnemyCount = spawned,
                HasSiege = wave.HasSiege,
            });
            EventBus.Publish(new ToastEvent
            {
                Message = wave.Title + " is marching on your castle!",
                Duration = Balance.Ui.ToastDuration,
                Severity = ToastSeverity.Danger,
            });
            EventBus.Publish(new CameraShakeEvent
            {
                Magnitude = 0.1f, Duration = 0.4f,
                WorldPosition = new Vector3(_world.KeepCell.x, 0f, _world.KeepCell.y),
            });

            // Give the commander the new hostile roster.
            _world.Commander.OnWaveStarted(_activeWaveUnits);
        }

        Int2 FindSpawnCell(Int2 camp, int index, UnitId unitId)
        {
            int ring = 1 + index / 8;
            int slot = index % 8;
            var offsets = Int2.EightNeighbours;
            var offset = offsets[slot % offsets.Length];
            var candidate = new Int2(camp.x + offset.x * ring, camp.y + offset.y * ring);

            Int2 walkable;
            if (_world.Pathfinding.TryFindWalkableNear(candidate, NavProfile.Ground, Team.Enemy, 8, out walkable))
                return walkable;

            // Heavy machines need the wide profile, otherwise they'd spawn inside
            // their own tents.
            if (_world.Pathfinding.TryFindWalkableNear(camp, NavProfile.GroundWide, Team.Enemy, 10, out walkable))
                return walkable;

            return camp;
        }

        void CompleteWave()
        {
            var wave = WaveTable.All[_waveIndex];
            _waveActive = false;

            _world.State.WavesCleared++;
            _world.Resources.Add(Team.Player, ResourceType.Gold, wave.GoldReward);

            EventBus.Publish(new WaveClearedEvent
            {
                WaveIndex = _waveIndex + 1,
                GoldReward = wave.GoldReward,
                RemainingWaves = WavesTotal - (_waveIndex + 1),
            });
            EventBus.Publish(ToastEvent.Good("Wave " + (_waveIndex + 1) + " repelled!  +" + wave.GoldReward + " gold"));

            _waveIndex++;

            if (_waveIndex >= WaveTable.All.Length)
            {
                _finished = true;
                _world.State.TriggerVictory("The Castle Stands!",
                    "You have repelled every siege the warlord could raise. " +
                    "Peasants " + _world.PlayerKingdom.Peasants +
                    " · Enemies slain " + _world.State.ScoreEnemiesKilled);
                return;
            }

            _timer = WaveTable.All[_waveIndex].DelaySeconds;
            AnnounceNext();
        }

        /// <summary>Called when the enemy camp is razed: the player wins early.</summary>
        public void NotifyEnemyCampDestroyed()
        {
            if (_finished) return;
            _finished = true;
            _world.State.TriggerVictory("Counter-Attack Victorious!",
                "You sallied out and burned the raider camp to the ground. " +
                "Waves survived: " + _world.State.WavesCleared);
        }

        public void NotifyKeepLost()
        {
            if (_finished) return;
            _finished = true;
            _world.State.TriggerDefeat("The Keep Has Fallen",
                "Your lord's keep was breached. Waves survived: " + _world.State.WavesCleared);
        }
    }
}
