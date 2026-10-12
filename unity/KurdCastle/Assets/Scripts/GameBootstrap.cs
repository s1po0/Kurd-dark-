// -----------------------------------------------------------------------------
//  File: GameBootstrap.cs
//  Purpose: Single entry point. Uses [RuntimeInitializeOnLoadMethod] so the game
//           boots even from a completely empty scene — clone the repo, press
//           Play, and you are standing in front of your keep. That also means
//           the project has no scene-merge conflicts to manage.
//
//  On Android it additionally applies the mobile profile: 60 FPS target, never
//  sleep during play, landscape-left, and a conservative quality tier.
// -----------------------------------------------------------------------------
using UnityEngine;
using UnityEngine.UI;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;
using KurdCastle.View;
using KurdCastle.UI;
using KurdCastle.InputSys;

namespace KurdCastle
{
    public sealed class GameBootstrap : MonoBehaviour
    {
        public static GameBootstrap Instance { get; private set; }

        GameStateManager _state;
        GameWorld _world;
        IsoCameraController _camera;
        InputSys.PlayerController _player;
        WorldView _view;
        HudController _hud;
        PerfMonitor _perf;
        Canvas _debugCanvas;
        Text _debugLabel;
        uint _seed;
        bool _restarting;
        bool _wavesStarted;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (Instance != null) return;
            var go = new GameObject("[KurdCastle]");
            DontDestroyOnLoad(go);
            Instance = go.AddComponent<GameBootstrap>();
            Instance.StartGame((uint)(System.Environment.TickCount & 0x7FFFFFFF));
        }

        public void StartGame(uint seed)
        {
            _seed = seed == 0 ? 20260214u : seed;

            ApplyMobileProfile();
            TearDown();
            _wavesStarted = false;

            _state = new GameStateManager();
            _world = new GameWorld(_seed, _state);

            // Load-bearing order: the camera exists before the world is built so the
            // terrain mesh and views can clamp against its bounds.
            _camera = new GameObject("IsoCamera").AddComponent<IsoCameraController>();
            var camera = new GameObject("MainCamera").AddComponent<Camera>();
            camera.tag = "MainCamera";
            camera.transform.SetParent(_camera.transform, false);
            _camera.Initialise(camera, Balance.Map.DefaultWidth, Balance.Map.DefaultHeight);

            _world.Build(_seed);

            _player = gameObject.GetComponent<InputSys.PlayerController>();
            if (_player == null) _player = gameObject.AddComponent<InputSys.PlayerController>();
            _player.Initialise(_world, _camera);

            _view = gameObject.GetComponent<WorldView>();
            if (_view == null) _view = gameObject.AddComponent<WorldView>();
            _view.Initialise(_world, _camera, _player);

            _perf = new PerfMonitor();

            var hudGo = new GameObject("HUD");
            hudGo.transform.SetParent(transform, false);
            _hud = hudGo.AddComponent<HudController>();
            _hud.OnRestartRequested = () => RestartGame();
            _hud.Initialise(_world, _camera, _player, _view);
            _hud.BuildMainMenu();

            BuildDebugOverlay();

            // Camera starts looking at the player's keep, and the game opens on
            // the main menu; gameplay begins when the player taps DEFEND.
            _camera.Focus(new Vector3(_world.Map.PlayerStart.x, 0f, _world.Map.PlayerStart.y), true);
            _state.TransitionTo(GameState.Menu);
            _hud.ShowMainMenu(true);

            _state.StateChanged += OnStateChanged;

            EventBus.Publish(new FirstRunTipEvent
            {
                Title = "Welcome to " + Balance.GameName,
                Body = "Peasants are hauling timber already. Build a woodcutter's hut near a forest, " +
                       "then a farm, then start walling in your keep — the first raid arrives soon.",
            });
            EventBus.Publish(ToastEvent.Info("Tap START to begin — good luck, my lord"));
        }

        void OnStateChanged(GameState previous, GameState current)
        {
            // Waves are scheduled the first time the player actually starts playing,
            // so the opening seconds of a fresh match are always calm.
            if (current != GameState.Playing || _wavesStarted) return;
            _wavesStarted = true;
            _hud.ShowMainMenu(false);
            _world.Waves.Start();
            _world.State.ScoreUnitsKilled = 0;
        }

        void RestartGame()
        {
            if (_restarting) return;
            _restarting = true;
            StartGame((uint)(System.Environment.TickCount & 0x7FFFFFFF));
            _restarting = false;
        }

        void TearDown()
        {
            if (_state != null) _state.StateChanged -= OnStateChanged;
            if (_world != null) _world.Shutdown();
            for (int i = transform.childCount - 1; i >= 0; i--)
            {
                Destroy(transform.GetChild(i).gameObject);
            }
            var existingCamera = GameObject.Find("MainCamera");
            if (existingCamera != null) Destroy(existingCamera);
            var existingIso = GameObject.Find("IsoCamera");
            if (existingIso != null) Destroy(existingIso);
        }

        static void ApplyMobileProfile()
        {
            Application.targetFrameRate = Balance.Performance.TargetFrameRate;
            QualitySettings.vSyncCount = 0;
            Screen.sleepTimeout = SleepTimeout.NeverSleep;
            Screen.orientation = ScreenOrientation.LandscapeLeft;
            QualitySettings.shadowDistance = 30f;
            QualitySettings.antiAliasing = 0;

            // Lights: one directional sun. No realtime GI, no extra probes — mobile.
            if (Object.FindObjectOfType<Light>() == null)
            {
                var sunGo = new GameObject("Sun");
                var sun = sunGo.AddComponent<Light>();
                sun.type = LightType.Directional;
                sun.intensity = 1.05f;
                sun.color = new Color(1f, 0.96f, 0.88f);
                sunGo.transform.rotation = Quaternion.Euler(52f, 42f, 0f);
                sun.shadows = LightShadows.Hard;
            }
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
            RenderSettings.ambientLight = new Color(0.42f, 0.44f, 0.50f);
        }

        void BuildDebugOverlay()
        {
            _debugCanvas = UiFactory.CreateCanvas("DebugOverlay", 50);
            _debugCanvas.transform.SetParent(transform, false);
            _debugLabel = UiFactory.Label(_debugCanvas.transform, "Perf", "", 22,
                                          TextAnchor.LowerLeft, new Color(0.85f, 0.95f, 0.85f, 0.85f));
            _debugLabel.rectTransform.anchorMin = new Vector2(0f, 0f);
            _debugLabel.rectTransform.anchorMax = new Vector2(1f, 0f);
            _debugLabel.rectTransform.pivot = new Vector2(0f, 0f);
            _debugLabel.rectTransform.anchoredPosition = new Vector2(8f, 6f);
            _debugLabel.rectTransform.sizeDelta = new Vector2(-16f, 26f);
        }

        void Update()
        {
            if (_world == null) return;

            float dt = Time.unscaledDeltaTime;
            _world.Tick(dt);
            _perf.Tick(dt);

            if (_debugLabel == null) return;
            _perf.LiveUnits = _world.Units.LiveCount;
            _perf.LiveProjectiles = _world.Projectiles.ActiveCount;
            _perf.LiveBuildings = _world.Buildings.Count;
            _perf.PathRequestsQueued = _world.Pathfinding.QueuedCount;
            _perf.PathfindingMs = _world.Pathfinding.LastFrameMs;
            _perf.FlowFieldNodes = _world.FlowFields.NodesLastFrame;

            if (Time.frameCount % 15 == 0)
            {
                _debugLabel.text = _perf.StatusLine() +
                                   "  ·  fps-floor " + _world.Clock.FloorFps.ToString("0") +
                                   "  ·  " + _world.State.State;
            }
        }

        void OnApplicationPause(bool paused)
        {
            // Auto-pause keeps the castle safe when the player answers a call.
            if (paused && _world != null && _world.State.IsSimulationRunning) _world.State.Pause();
        }

        void OnApplicationQuit()
        {
            if (_state != null) _state.StateChanged -= OnStateChanged;
            if (_world != null) _world.Shutdown();
        }
    }
}
