// -----------------------------------------------------------------------------
//  File: UI/HudController.cs
//  Purpose: The whole Android UI, laid out the way a mobile RTS wants it:
//
//    top-left     resource strip (wood / stone / iron / gold / food)
//    top-centre   population, popularity and food-rate readout (tap for detail)
//    top-right    minimap + game-speed cluster (pause, 1×, 2×, 4×)
//    bottom-right build menu organised in tabs, contextual actions
//    bottom-left  selection panel, stance toggles, "select all troops" shortcuts
//    centre       toasts, wave banner, pause and game-over overlays
//
//  Everything subscribes to the EventBus, so the HUD never polls the simulation
//  and the simulation never knows the HUD exists.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;
using KurdCastle.Construction;
using KurdCastle.Economy;
using KurdCastle.View;
using KurdCastle.InputSys;

namespace KurdCastle.UI
{
    public sealed class HudController : MonoBehaviour
    {
        GameWorld _world;
        IsoCameraController _camera;
        InputSys.PlayerController _player;
        WorldView _view;

        Canvas _canvas;
        readonly List<Text> _resourceLabels = new List<Text>(8);
        readonly List<Text> _resourceDeltas = new List<Text>(8);
        Text _populationLabel;
        Text _popularityLabel;
        Text _speedLabel;
        Text _waveLabel;
        Text _selectionTitle;
        Text _selectionBody;
        Text _toastLabel;
        Text _buildHeader;
        Text _ghostHint;

        RectTransform _popularityDrawer;
        RectTransform _buildMenu;
        RectTransform _selectionPanel;
        RectTransform _pauseOverlay;
        RectTransform _gameOverOverlay;
        RectTransform _mainMenu;
        Text _gameOverTitle;
        Text _gameOverBody;
        readonly List<Button> _buildButtons = new List<Button>(48);
        readonly List<Text> _buildButtonLabels = new List<Text>(48);
        readonly List<Text> _buildButtonCosts = new List<Text>(48);
        RectTransform _buildContent;
        BuildingCategory _category = BuildingCategory.Economy;
        MinimapView _minimap;
        RawImage _minimapImage;

        float _toastTimer;

        public System.Action OnRestartRequested;

        // =====================================================================
        //  Construction
        // =====================================================================
        public void Initialise(GameWorld world, IsoCameraController camera,
                               InputSys.PlayerController player, WorldView view)
        {
            _world = world;
            _camera = camera;
            _player = player;
            _view = view;

            UiFactory.EnsureEventSystem();
            _canvas = UiFactory.CreateCanvas("HUD", 10);
            _canvas.transform.SetParent(transform, false);

            BuildResourceBar();
            BuildTopRightCluster();
            BuildBuildMenu();
            BuildSelectionPanel();
            BuildOverlays();

            // Player, camera and game-state events all funnel into the same
            // "something changed, refresh the text" path.
            EventBus.Subscribe<SelectionChangedEvent>(_ => RefreshSelection());
            EventBus.Subscribe<GameStateChangedEvent>(OnStateChanged);
            EventBus.Subscribe<ToastEvent>(OnToast);
            EventBus.Subscribe<WaveAnnouncementEvent>(OnWaveAnnouncement);

            RefreshAll();
        }

        void OnDestroy()
        {
            EventBus.Unsubscribe<GameStateChangedEvent>(OnStateChanged);
            EventBus.Unsubscribe<ToastEvent>(OnToast);
        }

        // =====================================================================
        //  Resource strip
        // =====================================================================
        void BuildResourceBar()
        {
            var bar = UiFactory.Panel(_canvas.transform, "ResourceBar",
                new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                new Vector2(12f, -12f), new Vector2(860f, 78f), Balance.Ui.PanelColor);

            float slotWidth = 168f;
            for (int i = 0; i < ResourceUtil.Primary.Length; i++)
            {
                var type = ResourceUtil.Primary[i];
                var slot = UiFactory.Panel(bar, "Slot_" + type,
                    new Vector2(0f, 1f), new Vector2(0f, 1f), new Vector2(0f, 1f),
                    new Vector2(6f + i * slotWidth, -6f), new Vector2(slotWidth - 8f, 66f),
                    new Color(0f, 0f, 0f, 0.18f));

                var icon = UiFactory.Image(slot, "Icon", new Vector2(0f, 0f), new Vector2(0f, 1f),
                    new Vector2(6f, 6f), new Vector2(44f, -6f), ResourceUtil.Tint(type));
                icon.raycastTarget = false;

                var label = UiFactory.Label(slot, "Value", ResourceUtil.ShortLabel(type) + " 0",
                                           30, TextAnchor.MiddleLeft, Balance.Ui.TextColor);
                label.rectTransform.offsetMin = new Vector2(50f, 6f);
                _resourceLabels.Add(label);

                var delta = UiFactory.Label(slot, "Delta", "", 24, TextAnchor.MiddleLeft,
                                            new Color(0.7f, 0.85f, 0.7f));
                delta.rectTransform.offsetMin = new Vector2(50f, -18f);
                delta.rectTransform.offsetMax = new Vector2(-6f, 10f);
                _resourceDeltas.Add(delta);
            }

            // Population / popularity block sits centre-top, out of the way.
            var info = UiFactory.Panel(_canvas.transform, "KingdomInfo",
                new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -12f), new Vector2(520f, 78f), Balance.Ui.PanelColor);

            _populationLabel = UiFactory.Label(info, "Population", "Peasants 0/0   Troops 0",
                                               28, TextAnchor.MiddleCenter, Balance.Ui.TextColor);
            _populationLabel.rectTransform.offsetMin = new Vector2(10f, 34f);

            _popularityLabel = UiFactory.Label(info, "Popularity", "Popularity 65",
                                               30, TextAnchor.MiddleCenter, new Color(0.6f, 0.9f, 0.6f));
            _popularityLabel.rectTransform.offsetMax = new Vector2(-10f, -34f);

            var popularityButton = info.gameObject.AddComponent<Button>();
            popularityButton.targetGraphic = info.GetComponent<Image>();
            popularityButton.onClick.AddListener(TogglePopularityDrawer);

            _waveLabel = UiFactory.Label(_canvas.transform, "WaveBanner", "",
                                         34, TextAnchor.MiddleCenter, new Color(1f, 0.9f, 0.6f));
            _waveLabel.rectTransform.anchorMin = new Vector2(0.5f, 1f);
            _waveLabel.rectTransform.anchorMax = new Vector2(0.5f, 1f);
            _waveLabel.rectTransform.pivot = new Vector2(0.5f, 1f);
            _waveLabel.rectTransform.anchoredPosition = new Vector2(0f, -100f);
            _waveLabel.rectTransform.sizeDelta = new Vector2(900f, 44f);

            BuildPopularityDrawer();
        }

        void BuildPopularityDrawer()
        {
            _popularityDrawer = UiFactory.Panel(_canvas.transform, "PopularityDrawer",
                new Vector2(0.5f, 1f), new Vector2(0.5f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -96f), new Vector2(460f, 320f), new Color(0.08f, 0.08f, 0.07f, 0.94f));
            _popularityDrawer.gameObject.SetActive(false);
        }

        void TogglePopularityDrawer()
        {
            bool show = !_popularityDrawer.gameObject.activeSelf;
            _popularityDrawer.gameObject.SetActive(show);
            if (show) RefreshPopularityDrawer();
        }

        void RefreshPopularityDrawer()
        {
            var container = _popularityDrawer;
            for (int i = container.childCount - 1; i >= 0; i--) Destroy(container.GetChild(i).gameObject);

            UiFactory.Label(container, "Title", "Popularity breakdown", 30,
                            TextAnchor.UpperCenter, Balance.Ui.TextColor);

            var factors = _world.Population.PlayerFactors;
            float running = 0f;
            for (int i = 0; i < factors.Count; i++)
            {
                running += factors[i].Value;
                string text = factors[i].Label + "   " +
                              (factors[i].Value >= 0f ? "+" : "") + factors[i].Value.ToString("0.0");
                var line = UiFactory.Label(container, "F" + i, text, 26, TextAnchor.MiddleLeft,
                                           factors[i].Value >= 0f ? new Color(0.7f, 0.9f, 0.7f)
                                                                  : new Color(0.95f, 0.65f, 0.6f));
                line.rectTransform.anchorMin = new Vector2(0f, 1f);
                line.rectTransform.anchorMax = new Vector2(1f, 1f);
                line.rectTransform.pivot = new Vector2(0.5f, 1f);
                line.rectTransform.anchoredPosition = new Vector2(0f, -44f - i * 30f);
                line.rectTransform.sizeDelta = new Vector2(-20f, 28f);
            }

            var total = UiFactory.Label(container, "Total",
                "Total  " + (running >= 0f ? "+" : "") + running.ToString("0.0"),
                28, TextAnchor.LowerCenter, new Color(1f, 0.95f, 0.75f));
            total.rectTransform.offsetMin = new Vector2(10f, 10f);
        }

        // =====================================================================
        //  Minimap + speed controls
        // =====================================================================
        void BuildTopRightCluster()
        {
            var panel = UiFactory.Panel(_canvas.transform, "TopRight",
                new Vector2(1f, 1f), new Vector2(1f, 1f), new Vector2(1f, 1f),
                new Vector2(-12f, -12f), new Vector2(360f, 300f), Balance.Ui.PanelColor);

            var minimapFrame = UiFactory.Panel(panel, "MinimapFrame",
                new Vector2(0f, 0f), new Vector2(1f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -8f), new Vector2(-16f, -120f), new Color(0f, 0f, 0f, 0.35f));

            var rawGo = new GameObject("Minimap", typeof(RectTransform), typeof(RawImage), typeof(Button));
            var rawRect = rawGo.GetComponent<RectTransform>();
            rawRect.SetParent(minimapFrame, false);
            rawRect.anchorMin = Vector2.zero;
            rawRect.anchorMax = Vector2.one;
            rawRect.offsetMin = new Vector2(4f, 4f);
            rawRect.offsetMax = new Vector2(-4f, -4f);
            _minimapImage = rawGo.GetComponent<RawImage>();
            _minimapImage.color = Color.white;

            _minimap = gameObject.AddComponent<MinimapView>();
            _minimap.Initialise(_world, _minimapImage);

            var minimapButton = rawGo.GetComponent<Button>();
            minimapButton.targetGraphic = _minimapImage;
            minimapButton.onClick.AddListener(() => FocusFromMinimap(Input.mousePosition));

            // Speed cluster -------------------------------------------------
            float y = 8f;
            var pauseButton = UiFactory.Button(panel, "Pause", "II", new Color(0.22f, 0.20f, 0.16f),
                Balance.Ui.TextColor, 30, new Vector2(78f, 68f), TogglePause, out _);
            var pauseRect = pauseButton.GetComponent<RectTransform>();
            pauseRect.anchorMin = pauseRect.anchorMax = new Vector2(0f, 0f);
            pauseRect.pivot = new Vector2(0f, 0f);
            pauseRect.anchoredPosition = new Vector2(8f, y);

            var speeds = new[] { GameSpeed.Normal, GameSpeed.Fast, GameSpeed.VeryFast };
            var captions = new[] { "1x", "2x", "4x" };
            for (int i = 0; i < speeds.Length; i++)
            {
                var captured = speeds[i];
                var button = UiFactory.Button(panel, "Speed" + captions[i], captions[i],
                    new Color(0.22f, 0.20f, 0.16f), Balance.Ui.TextColor, 28,
                    new Vector2(78f, 68f), () => SetSpeed(captured), out _);
                var rect = button.GetComponent<RectTransform>();
                rect.anchorMin = rect.anchorMax = new Vector2(0f, 0f);
                rect.pivot = new Vector2(0f, 0f);
                rect.anchoredPosition = new Vector2(94f + i * 84f, y);
            }

            var gates = UiFactory.Button(panel, "Gates", "Gates", new Color(0.22f, 0.20f, 0.16f),
                Balance.Ui.TextColor, 24, new Vector2(150f, 60f),
                () => _world.Construction.SetAllGates(Team.Player, !AllGatesOpen()), out _);
            var gatesRect = gates.GetComponent<RectTransform>();
            gatesRect.anchorMin = gatesRect.anchorMax = new Vector2(1f, 0f);
            gatesRect.pivot = new Vector2(1f, 0f);
            gatesRect.anchoredPosition = new Vector2(-8f, y);

            _speedLabel = UiFactory.Label(panel, "SpeedLabel", "1x", 26, TextAnchor.MiddleRight,
                                          new Color(0.8f, 0.85f, 0.8f));
            _speedLabel.rectTransform.anchorMin = new Vector2(1f, 0f);
            _speedLabel.rectTransform.anchorMax = new Vector2(1f, 0f);
            _speedLabel.rectTransform.pivot = new Vector2(1f, 0f);
            _speedLabel.rectTransform.anchoredPosition = new Vector2(-166f, y);
            _speedLabel.rectTransform.sizeDelta = new Vector2(180f, 60f);
        }

        bool AllGatesOpen()
        {
            bool anyClosed = false;
            _world.Buildings.ForEach(b =>
            {
                if (b.Team == Team.Player && b.Definition.IsGate && !b.GateOpen) anyClosed = true;
            });
            return !anyClosed;
        }

        void FocusFromMinimap(Vector2 screenPosition)
        {
            // The minimap button and the touch handler both route through here.
            var rect = (RectTransform)_minimapImage.transform;
            Vector2Int cell;
            if (!_minimap.TryGetCellFromScreen(screenPosition, rect, out cell)) return;
            var world = new Vector3(cell.x + 0.5f, 0f, cell.y + 0.5f);
            _camera.Focus(world);
            if (_view != null) _view.SpawnOrderPing(world, new Color(0.95f, 0.9f, 0.45f));
        }

        void TogglePause()
        {
            if (_world.State.State == GameState.Paused) _world.State.Resume();
            else _world.State.Pause();
        }

        void SetSpeed(GameSpeed speed)
        {
            _world.Clock.SetSpeed(speed);
            RefreshSpeed();
        }

        // =====================================================================
        //  Build menu (bottom right)
        // =====================================================================
        void BuildBuildMenu()
        {
            _buildMenu = UiFactory.Panel(_canvas.transform, "BuildMenu",
                new Vector2(1f, 0f), new Vector2(1f, 0f), new Vector2(1f, 0f),
                new Vector2(-12f, 12f), new Vector2(520f, 560f), Balance.Ui.PanelColor);

            _buildHeader = UiFactory.Label(_buildMenu, "Header", "BUILD", 30, TextAnchor.MiddleLeft,
                                           new Color(0.95f, 0.9f, 0.7f));
            _buildHeader.rectTransform.anchorMin = new Vector2(0f, 1f);
            _buildHeader.rectTransform.anchorMax = new Vector2(1f, 1f);
            _buildHeader.rectTransform.pivot = new Vector2(0.5f, 1f);
            _buildHeader.rectTransform.anchoredPosition = new Vector2(0f, -6f);
            _buildHeader.rectTransform.sizeDelta = new Vector2(-20f, 36f);

            // Category tabs
            var categories = new[] { BuildingCategory.Castle, BuildingCategory.Economy,
                                     BuildingCategory.Military, BuildingCategory.Housing };
            for (int i = 0; i < categories.Length; i++)
            {
                var captured = categories[i];
                var tab = UiFactory.Button(_buildMenu, "Tab_" + captured, captured.ToString(),
                    new Color(0.26f, 0.22f, 0.16f), Balance.Ui.TextColor, 24,
                    new Vector2(120f, 58f), () => { _category = captured; RebuildBuildList(); }, out _);
                var rect = tab.GetComponent<RectTransform>();
                rect.anchorMin = rect.anchorMax = new Vector2(0f, 1f);
                rect.pivot = new Vector2(0f, 1f);
                rect.anchoredPosition = new Vector2(8f + i * 124f, -46f);
            }

            // Contextual action row
            var actionRow = new Vector2(0f, 0f);
            var demolish = UiFactory.Button(_buildMenu, "Demolish", "Demolish",
                new Color(0.34f, 0.18f, 0.16f), Balance.Ui.TextColor, 24, new Vector2(150f, 56f),
                () => _player.BeginDemolish(), out _);
            var demolishRect = demolish.GetComponent<RectTransform>();
            demolishRect.anchorMin = demolishRect.anchorMax = new Vector2(0f, 0f);
            demolishRect.pivot = new Vector2(0f, 0f);
            demolishRect.anchoredPosition = new Vector2(8f, 8f);

            var repair = UiFactory.Button(_buildMenu, "Repair", "Repair",
                new Color(0.24f, 0.28f, 0.20f), Balance.Ui.TextColor, 24, new Vector2(140f, 56f),
                () => _player.BeginRepair(), out _);
            var repairRect = repair.GetComponent<RectTransform>();
            repairRect.anchorMin = repairRect.anchorMax = new Vector2(0f, 0f);
            repairRect.pivot = new Vector2(0f, 0f);
            repairRect.anchoredPosition = new Vector2(166f, 8f);

            var garrison = UiFactory.Button(_buildMenu, "Garrison", "Garrison",
                new Color(0.20f, 0.24f, 0.30f), Balance.Ui.TextColor, 24, new Vector2(150f, 56f),
                () => _player.BeginGarrison(), out _);
            var garrisonRect = garrison.GetComponent<RectTransform>();
            garrisonRect.anchorMin = garrisonRect.anchorMax = new Vector2(0f, 0f);
            garrisonRect.pivot = new Vector2(0f, 0f);
            garrisonRect.anchoredPosition = new Vector2(314f, 8f);

            // Scrollable list of blueprints
            RectTransform content;
            UiFactory.VerticalScroll(_buildMenu, "BuildScroll", new Vector2(0f, 0f), new Vector2(1f, 1f),
                new Vector2(0.5f, 0f), new Vector2(0f, 72f), new Vector2(-16f, -320f), out content);
            _buildContent = content;

            _ghostHint = UiFactory.Label(_canvas.transform, "GhostHint", "", 26,
                                         TextAnchor.LowerCenter, new Color(0.95f, 0.95f, 0.8f));
            _ghostHint.rectTransform.anchorMin = new Vector2(0.5f, 0f);
            _ghostHint.rectTransform.anchorMax = new Vector2(0.5f, 0f);
            _ghostHint.rectTransform.pivot = new Vector2(0.5f, 0f);
            _ghostHint.rectTransform.anchoredPosition = new Vector2(0f, 18f);
            _ghostHint.rectTransform.sizeDelta = new Vector2(1000f, 40f);

            RebuildBuildList();
        }

        void RebuildBuildList()
        {
            for (int i = _buildContent.childCount - 1; i >= 0; i--) Destroy(_buildContent.GetChild(i).gameObject);
            _buildButtons.Clear();
            _buildButtonLabels.Clear();
            _buildButtonCosts.Clear();

            var list = BuildingCatalog.InCategory(_category);
            const float rowHeight = 78f;
            const float rowGap = 6f;

            for (int i = 0; i < list.Count; i++)
            {
                var def = list[i];
                Color background = def.Category == BuildingCategory.Military
                    ? new Color(0.30f, 0.20f, 0.18f)
                    : new Color(0.22f, 0.22f, 0.18f);
                if (def.IsKeep) background = new Color(0.32f, 0.28f, 0.14f);

                var captured = def.Id;
                Text label;
                var button = UiFactory.Button(_buildContent, "Build_" + def.Id, "",
                    background, Balance.Ui.TextColor, 26, new Vector2(0f, rowHeight),
                    () => _player.BeginPlacement(captured), out label);

                var rect = button.GetComponent<RectTransform>();
                rect.anchorMin = new Vector2(0f, 1f);
                rect.anchorMax = new Vector2(1f, 1f);
                rect.pivot = new Vector2(0.5f, 1f);
                rect.anchoredPosition = new Vector2(0f, -i * (rowHeight + rowGap));
                rect.sizeDelta = new Vector2(-8f, rowHeight);

                label.text = def.DisplayName + "\n<size=22>" + def.Cost.ToShortString() + "</size>";
                label.rectTransform.offsetMin = new Vector2(14f, 4f);

                var costLabel = UiFactory.Label(button.transform, "Hint",
                    def.Footprint.x + "×" + def.Footprint.y +
                    (def.WorkerSlots > 0 ? "  ·  " + def.WorkerSlots + " workers" : "") +
                    (def.HousingCapacity > 0 ? "  ·  +" + def.HousingCapacity + " housing" : ""),
                    20, TextAnchor.UpperRight, new Color(0.75f, 0.75f, 0.68f));
                costLabel.rectTransform.offsetMin = new Vector2(0f, 4f);
                costLabel.rectTransform.offsetMax = new Vector2(-14f, -6f);

                _buildButtons.Add(button);
                _buildButtonLabels.Add(label);
                _buildButtonCosts.Add(costLabel);
            }

            _buildContent.sizeDelta = new Vector2(0f, list.Count * (rowHeight + rowGap) + 8f);
        }

        // =====================================================================
        //  Selection panel (bottom left)
        // =====================================================================
        void BuildSelectionPanel()
        {
            _selectionPanel = UiFactory.Panel(_canvas.transform, "SelectionPanel",
                new Vector2(0f, 0f), new Vector2(0f, 0f), new Vector2(0f, 0f),
                new Vector2(12f, 12f), new Vector2(520f, 250f), Balance.Ui.PanelColor);

            _selectionTitle = UiFactory.Label(_selectionPanel, "Title", "No selection", 30,
                                              TextAnchor.UpperLeft, new Color(0.95f, 0.9f, 0.75f));
            _selectionTitle.rectTransform.offsetMin = new Vector2(14f, -6f);
            _selectionTitle.rectTransform.sizeDelta = new Vector2(-28f, 40f);

            _selectionBody = UiFactory.Label(_selectionPanel, "Body", "", 24,
                                             TextAnchor.UpperLeft, Balance.Ui.TextColor);
            _selectionBody.rectTransform.offsetMin = new Vector2(14f, 96f);
            _selectionBody.rectTransform.offsetMax = new Vector2(-14f, -44f);

            var selectTroops = UiFactory.Button(_selectionPanel, "SelectTroops", "Select Troops",
                new Color(0.20f, 0.26f, 0.34f), Balance.Ui.TextColor, 22, new Vector2(230f, 56f),
                () => _player.SelectAllMilitary(), out _);
            var troopsRect = selectTroops.GetComponent<RectTransform>();
            troopsRect.anchorMin = troopsRect.anchorMax = new Vector2(0f, 0f);
            troopsRect.pivot = new Vector2(0f, 0f);
            troopsRect.anchoredPosition = new Vector2(14f, 10f);

            var selectPeasants = UiFactory.Button(_selectionPanel, "SelectPeasants", "Idle Peasants",
                new Color(0.26f, 0.24f, 0.16f), Balance.Ui.TextColor, 22, new Vector2(230f, 56f),
                () => _player.SelectAllIdlePeasants(), out _);
            var peasantRect = selectPeasants.GetComponent<RectTransform>();
            peasantRect.anchorMin = peasantRect.anchorMax = new Vector2(0f, 0f);
            peasantRect.pivot = new Vector2(0f, 0f);
            peasantRect.anchoredPosition = new Vector2(256f, 10f);

            var stance = UiFactory.Button(_selectionPanel, "Stance", "Move / Attack-move",
                new Color(0.24f, 0.20f, 0.24f), Balance.Ui.TextColor, 22, new Vector2(480f, 52f),
                () => _player.ToggleAttackMove(), out _);
            var stanceRect = stance.GetComponent<RectTransform>();
            stanceRect.anchorMin = stanceRect.anchorMax = new Vector2(0f, 0f);
            stanceRect.pivot = new Vector2(0f, 0f);
            stanceRect.anchoredPosition = new Vector2(14f, 72f);
        }

        // =====================================================================
        //  Overlays: toast, pause, game over, main menu
        // =====================================================================
        void BuildOverlays()
        {
            _toastLabel = UiFactory.Label(_canvas.transform, "Toast", "", 32,
                                          TextAnchor.MiddleCenter, new Color(1f, 0.95f, 0.8f));
            _toastLabel.rectTransform.anchorMin = new Vector2(0.5f, 0.5f);
            _toastLabel.rectTransform.anchorMax = new Vector2(0.5f, 0.5f);
            _toastLabel.rectTransform.pivot = new Vector2(0.5f, 0.5f);
            _toastLabel.rectTransform.anchoredPosition = new Vector2(0f, 200f);
            _toastLabel.rectTransform.sizeDelta = new Vector2(1200f, 60f);
            _toastLabel.text = "";

            _pauseOverlay = UiFactory.Panel(_canvas.transform, "PauseOverlay",
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero,
                new Color(0f, 0f, 0f, 0.72f));
            _pauseOverlay.offsetMin = Vector2.zero;
            _pauseOverlay.offsetMax = Vector2.zero;
            _pauseOverlay.gameObject.SetActive(false);

            UiFactory.Label(_pauseOverlay, "Title", "PAUSED", 64, TextAnchor.MiddleCenter,
                            Balance.Ui.TextColor);
            var resume = UiFactory.Button(_pauseOverlay, "Resume", "Resume",
                new Color(0.24f, 0.30f, 0.22f), Balance.Ui.TextColor, 34, new Vector2(420f, 96f),
                () => _world.State.Resume(), out _);
            var resumeRect = resume.GetComponent<RectTransform>();
            resumeRect.anchorMin = resumeRect.anchorMax = new Vector2(0.5f, 0.5f);
            resumeRect.pivot = new Vector2(0.5f, 0.5f);
            resumeRect.anchoredPosition = new Vector2(0f, -40f);

            var quit = UiFactory.Button(_pauseOverlay, "Quit", "Abandon Castle",
                new Color(0.34f, 0.18f, 0.16f), Balance.Ui.TextColor, 28, new Vector2(420f, 80f),
                () => { _world.State.ReturnToMenu(); ShowMainMenu(true); }, out _);
            var quitRect = quit.GetComponent<RectTransform>();
            quitRect.anchorMin = quitRect.anchorMax = new Vector2(0.5f, 0.5f);
            quitRect.pivot = new Vector2(0.5f, 0.5f);
            quitRect.anchoredPosition = new Vector2(0f, -160f);

            BuildGameOverOverlay();
        }

        void BuildGameOverOverlay()
        {
            _gameOverOverlay = UiFactory.Panel(_canvas.transform, "GameOver",
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero,
                new Color(0.02f, 0.02f, 0.03f, 0.86f));
            _gameOverOverlay.offsetMin = Vector2.zero;
            _gameOverOverlay.offsetMax = Vector2.zero;
            _gameOverOverlay.gameObject.SetActive(false);

            _gameOverTitle = UiFactory.Label(_gameOverOverlay, "Title", "Victory!", 72,
                                             TextAnchor.MiddleCenter, new Color(1f, 0.92f, 0.6f));
            _gameOverTitle.rectTransform.anchoredPosition = new Vector2(0f, 120f);
            _gameOverTitle.rectTransform.sizeDelta = new Vector2(1200f, 100f);

            _gameOverBody = UiFactory.Label(_gameOverOverlay, "Body", "", 32,
                                            TextAnchor.UpperCenter, Balance.Ui.TextColor);
            _gameOverBody.rectTransform.anchoredPosition = new Vector2(0f, 30f);
            _gameOverBody.rectTransform.sizeDelta = new Vector2(1200f, 140f);

            var again = UiFactory.Button(_gameOverOverlay, "Again", "Play Again",
                new Color(0.24f, 0.30f, 0.22f), Balance.Ui.TextColor, 34, new Vector2(440f, 96f),
                () => { if (OnRestartRequested != null) OnRestartRequested(); }, out _);
            var againRect = again.GetComponent<RectTransform>();
            againRect.anchorMin = againRect.anchorMax = new Vector2(0.5f, 0.5f);
            againRect.pivot = new Vector2(0.5f, 0.5f);
            againRect.anchoredPosition = new Vector2(-240f, -140f);

            var menu = UiFactory.Button(_gameOverOverlay, "Menu", "Main Menu",
                new Color(0.22f, 0.22f, 0.20f), Balance.Ui.TextColor, 34, new Vector2(440f, 96f),
                () => { _gameOverOverlay.gameObject.SetActive(false); ShowMainMenu(true); }, out _);
            var menuRect = menu.GetComponent<RectTransform>();
            menuRect.anchorMin = menuRect.anchorMax = new Vector2(0.5f, 0.5f);
            menuRect.pivot = new Vector2(0.5f, 0.5f);
            menuRect.anchoredPosition = new Vector2(240f, -140f);
        }

        // =====================================================================
        //  Main menu
        // =====================================================================
        public void BuildMainMenu()
        {
            _mainMenu = UiFactory.Panel(_canvas.transform, "MainMenu",
                Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero,
                new Color(0.05f, 0.06f, 0.07f, 0.94f));
            _mainMenu.offsetMin = Vector2.zero;
            _mainMenu.offsetMax = Vector2.zero;

            var title = UiFactory.Label(_mainMenu, "Title", Balance.GameName, 96,
                                        TextAnchor.MiddleCenter, new Color(0.96f, 0.9f, 0.62f));
            title.rectTransform.anchoredPosition = new Vector2(0f, 240f);
            title.rectTransform.sizeDelta = new Vector2(1400f, 120f);

            var subtitle = UiFactory.Label(_mainMenu, "Subtitle",
                "Isometric castle building & siege defence  ·  v" + Balance.Version,
                32, TextAnchor.MiddleCenter, new Color(0.85f, 0.85f, 0.8f));
            subtitle.rectTransform.anchoredPosition = new Vector2(0f, 150f);
            subtitle.rectTransform.sizeDelta = new Vector2(1400f, 60f);

            var play = UiFactory.Button(_mainMenu, "Play", "DEFEND THE CASTLE",
                new Color(0.30f, 0.36f, 0.20f), new Color(0.97f, 0.96f, 0.9f), 40,
                new Vector2(680f, 120f), () => { _mainMenu.gameObject.SetActive(false); StartNewGame(); },
                out _);
            var playRect = play.GetComponent<RectTransform>();
            playRect.anchorMin = playRect.anchorMax = new Vector2(0.5f, 0.5f);
            playRect.pivot = new Vector2(0.5f, 0.5f);
            playRect.anchoredPosition = new Vector2(0f, -20f);

            var help = UiFactory.Label(_mainMenu, "Help",
                "Tap a blueprint, drag the ghost onto green ground and tap to build.\n" +
                "Long-press the map to attack-move. Pinch to zoom, twist to rotate.\n" +
                "Garrison archers in towers and walls — they shoot much further.",
                28, TextAnchor.MiddleCenter, new Color(0.8f, 0.82f, 0.78f));
            help.rectTransform.anchoredPosition = new Vector2(0f, -220f);
            help.rectTransform.sizeDelta = new Vector2(1400f, 200f);
        }

        public void ShowMainMenu(bool show)
        {
            if (_mainMenu == null) return;
            _mainMenu.gameObject.SetActive(show);
            _buildMenu.gameObject.SetActive(!show);
            _selectionPanel.gameObject.SetActive(!show);
        }

        void StartNewGame()
        {
            // The world is built and paused; "DEFEND THE CASTLE" simply begins the
            // match. "Play Again" after a game over rebuilds everything instead.
            ShowMainMenu(false);
            _world.State.StartMatch();
        }

        // =====================================================================
        //  Event handlers
        // =====================================================================
        void OnStateChanged(GameStateChangedEvent evt)
        {
            if (_pauseOverlay != null) _pauseOverlay.gameObject.SetActive(evt.Current == GameState.Paused);
            if (evt.Current == GameState.Victory || evt.Current == GameState.Defeat)
                ShowGameOver(evt.Current == GameState.Victory);
            RefreshSpeed();
            RefreshAll();
        }

        void OnToast(ToastEvent evt)
        {
            if (_toastLabel == null) return;
            _toastLabel.text = evt.Message;
            _toastLabel.color = SeverityColor(evt.Severity);
            _toastTimer = evt.Duration;
        }

        static Color SeverityColor(ToastSeverity severity)
        {
            switch (severity)
            {
                case ToastSeverity.Success: return new Color(0.6f, 0.95f, 0.6f);
                case ToastSeverity.Warning: return new Color(0.98f, 0.85f, 0.45f);
                case ToastSeverity.Danger: return new Color(1f, 0.5f, 0.45f);
                default: return new Color(0.9f, 0.92f, 0.95f);
            }
        }

        void OnWaveAnnouncement(WaveAnnouncementEvent evt)
        {
            if (_waveLabel == null) return;
            _waveLabel.text = "Wave " + evt.WaveIndex + "/" + evt.TotalWaves + " — " + evt.Title +
                              "  (" + evt.EnemyCount + " attackers)";
        }

        void ShowGameOver(bool victory)
        {
            _gameOverOverlay.gameObject.SetActive(true);
            _gameOverTitle.text = _world.State.GameOverTitle ?? (victory ? "Victory!" : "Defeat");
            _gameOverTitle.color = victory ? new Color(1f, 0.92f, 0.6f) : new Color(1f, 0.55f, 0.5f);
            _gameOverBody.text = (_world.State.GameOverSummary ?? "") +
                "\n\nPeasants " + _world.PlayerKingdom.Peasants +
                "   ·   Troops " + _world.PlayerKingdom.Military +
                "   ·   Enemies slain " + _world.State.ScoreEnemiesKilled +
                "   ·   Waves survived " + _world.State.WavesCleared + "/" + _world.State.WavesTotal;
        }

        // =====================================================================
        //  Refresh
        // =====================================================================
        void Update()
        {
            if (_world == null || !_world.IsReady) return;

            if (_toastTimer > 0f)
            {
                _toastTimer -= Time.unscaledDeltaTime;
                if (_toastTimer <= 0f) _toastLabel.text = "";
            }

            RefreshResources();
            RefreshKingdomInfo();
            RefreshSelection();
            RefreshGhostHint();
        }

        void RefreshResources()
        {
            var primary = ResourceUtil.Primary;
            for (int i = 0; i < primary.Length && i < _resourceLabels.Count; i++)
            {
                var type = primary[i];
                int amount = _world.Resources.Get(Team.Player, type);
                float rate = _world.Resources.GetRate(Team.Player, type);
                _resourceLabels[i].text = ResourceUtil.ShortLabel(type) + "  " + amount;
                _resourceLabels[i].color = _world.Resources.IsFull(Team.Player, type)
                    ? new Color(1f, 0.75f, 0.5f)
                    : Balance.Ui.TextColor;

                if (i < _resourceDeltas.Count)
                {
                    _resourceDeltas[i].text = rate > 0.01f ? "+" + Mathf.RoundToInt(rate)
                                          : rate < -0.01f ? Mathf.RoundToInt(rate).ToString()
                                          : "";
                }
            }

            // Blueprint affordability tinting.
            for (int i = 0; i < _buildButtons.Count && i < _buildButtonLabels.Count; i++)
            {
                var id = BuildingCatalog.InCategory(_category)[i].Id;
                bool affordable = _world.Resources.CanAfford(Team.Player, BuildingCatalog.Get(id).Cost);
                var image = _buildButtons[i].GetComponent<Image>();
                Color baseColor = image.color;
                baseColor.a = affordable ? 1f : 0.45f;
                image.color = baseColor;
                _buildButtonLabels[i].color = affordable ? Balance.Ui.TextColor : new Color(0.7f, 0.6f, 0.6f);
            }
        }

        void RefreshKingdomInfo()
        {
            var stats = _world.PlayerKingdom;
            _populationLabel.text = "Peasants " + stats.Peasants + "/" + stats.Housing +
                                    "   Troops " + stats.Military;

            float popularity = stats.Popularity;
            _popularityLabel.text = "Popularity " + Mathf.RoundToInt(popularity) +
                                    "   (" + FormatInterval(_world.Population.SpawnCountdown) + " to next peasant)";
            _popularityLabel.color = popularity >= 70f ? new Color(0.55f, 0.95f, 0.55f)
                                   : popularity >= 40f ? new Color(0.95f, 0.9f, 0.5f)
                                                       : new Color(1f, 0.5f, 0.45f);
        }

        static string FormatInterval(float seconds)
        {
            return Mathf.RoundToInt(Mathf.Max(0f, seconds)) + "s";
        }

        void RefreshSelection()
        {
            if (_player == null || _selectionPanel == null) return;

            if (_player.PendingBuilding != BuildingId.None)
            {
                _selectionTitle.text = "Placing: " + BuildingCatalog.Get(_player.PendingBuilding).DisplayName;
                _selectionBody.text = _player.GhostValid
                    ? "Drag to position · tap to build"
                    : InputSys.PlayerController.ExplainError(_player.PendingBuilding, _player.GhostError);
                return;
            }

            if (_player.SelectedBuilding != null)
            {
                var b = _player.SelectedBuilding;
                _selectionTitle.text = b.Definition.DisplayName;
                _selectionBody.text =
                    "Health " + Mathf.RoundToInt(b.Health) + "/" + Mathf.RoundToInt(b.MaxHealth) + "\n" +
                    (b.Definition.WorkerSlots > 0 ? "Workers " + b.WorkerCount + "/" + b.Definition.WorkerSlots + "\n" : "") +
                    (b.Definition.GarrisonSlots > 0 ? "Garrison " + b.GarrisonCount + "/" + b.Definition.GarrisonSlots + "\n" : "") +
                    (b.Definition.IsGate ? "Gate " + (b.GateOpen ? "open" : "sealed") + "\n" : "") +
                    (b.IsConstructionSite ? "Under construction " + Mathf.RoundToInt(b.BuildProgress * 100f) + "%" : b.Definition.Description);
                return;
            }

            if (_player.Selection.Count > 0)
            {
                var primary = _player.Selection[0];
                int workers = 0, troops = 0;
                for (int i = 0; i < _player.Selection.Count; i++)
                {
                    if (_player.Selection[i] == null || !_player.Selection[i].IsAlive) continue;
                    if (_player.Selection[i].IsWorker) workers++;
                    else troops++;
                }

                _selectionTitle.text = _player.Selection.Count + " selected  (" + troops + " troops" +
                                       (workers > 0 ? ", " + workers + " peasants" : "") + ")";
                _selectionBody.text = primary.Definition.DisplayName + "\n" +
                                      "Health " + Mathf.RoundToInt(primary.Health) + "/" +
                                      Mathf.RoundToInt(primary.MaxHealth) + "   ·   " +
                                      (primary.IsRanged ? "Range " + primary.Definition.AttackRange.ToString("0.0")
                                                        : "Melee reach " + primary.Definition.AttackRange.ToString("0.0")) + "\n" +
                                      "Damage " + primary.Definition.Damage + " " + primary.Definition.DamageType +
                                      "  vs  " + primary.Definition.Armor + " armour\n" +
                                      "Order: " + primary.Order + "   State: " + primary.State;
                return;
            }

            _selectionTitle.text = "No selection";
            _selectionBody.text = "Tap a unit or a building.\nTap the ground with troops selected to march them.\n" +
                                  "Long-press to attack-move.";
        }

        void RefreshGhostHint()
        {
            if (_player == null || _ghostHint == null) return;
            if (_player.PendingBuilding == BuildingId.None) { _ghostHint.text = ""; return; }

            var def = BuildingCatalog.Get(_player.PendingBuilding);
            _ghostHint.text = _player.GhostValid
                ? def.DisplayName + "  —  tap to build  ·  tap the blueprint again to cancel"
                : InputSys.PlayerController.ExplainError(_player.PendingBuilding, _player.GhostError);
        }

        void RefreshSpeed()
        {
            if (_speedLabel == null || _world == null) return;
            switch (_world.Clock.Speed)
            {
                case GameSpeed.Paused: _speedLabel.text = "Paused"; break;
                case GameSpeed.Fast: _speedLabel.text = "Speed 2×"; break;
                case GameSpeed.VeryFast: _speedLabel.text = "Speed 4×"; break;
                default: _speedLabel.text = "Speed 1×"; break;
            }
        }

        void RefreshAll()
        {
            RefreshSpeed();
            RefreshSelection();
        }
    }
}
