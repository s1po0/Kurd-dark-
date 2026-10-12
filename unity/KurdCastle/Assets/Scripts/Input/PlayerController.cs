// -----------------------------------------------------------------------------
//  File: Input/PlayerController.cs
//  Purpose: One place where touches become intent. Handles the mobile gesture
//           vocabulary the design calls for:
//
//     one finger drag          pan the camera (with inertia), or move the build
//                              ghost when a building is selected for placement
//                              (which gives "drag-and-drop placement")
//     two finger pinch         zoom
//     two finger twist         rotate the camera
//     tap                      select a unit / building, or confirm a placement
//     double tap               jump the camera to that spot ("focus ping")
//     long press               attack-move / demolish / set rally point
//     edge drag                pan near the screen border
//
//  Marquee selection is deliberately omitted in favour of "select all troops /
//  select idle peasants" buttons in the HUD: precise box-drag is miserable on a
//  phone, and the buttons are one tap.
//
//  Everything is read from UnityEngine.Input so the legacy input backend works
//  on device without extra packages; the same code path runs with a mouse in the
//  editor.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;
using KurdCastle.Construction;
using KurdCastle.World;
using KurdCastle.View;

namespace KurdCastle.InputSys
{
    public enum InteractionMode : byte
    {
        Select = 0,
        PlaceBuilding = 1,
        Demolish = 2,
        Repair = 3,
        SetGarrison = 4,
    }

    public sealed class PlayerController : MonoBehaviour
    {
        // ---- wiring ----
        IsoCameraController _camera;
        GameWorld _world;
        UnitRegistry _units;
        BuildingRegistry _buildings;
        ConstructionSystem _construction;
        UnitSystem _unitMover;
        PathfindingService _pathfinding;
        NavigationGrid _nav;
        MapGrid _grid;

        // ---- selection ----
        public readonly List<UnitInstance> Selection = new List<UnitInstance>(64);
        readonly List<UnitInstance> _marqueeBuffer = new List<UnitInstance>(128);
        readonly List<BuildingInstance> _buildingBuffer = new List<BuildingInstance>(16);

        public BuildingInstance SelectedBuilding { get; private set; }

        // ---- gesture state ----
        float _touchStartTime;
        Vector2 _touchStart;
        Vector2 _lastTouch;
        Vector2 _moveAccum;
        bool _draggingCamera;
        bool _longPressFired;   // long-press intent fires exactly once per touch

        int _activeFingerId = -1;
        float _lastTapTime;
        Vector2 _lastTapPosition;
        float _pinchPrevDistance;

        // ---- placement ----
        public InteractionMode Mode { get; private set; } = InteractionMode.Select;
        public BuildingId PendingBuilding { get; private set; } = BuildingId.None;
        public Int2 GhostCell { get; private set; }
        public PlacementError GhostError { get; private set; }
        public bool GhostValid { get { return GhostError == PlacementError.Ok; } }
        public bool EnemyAttackMove { get; private set; }

        public bool IsPlacing { get { return Mode == InteractionMode.PlaceBuilding && PendingBuilding != BuildingId.None; } }

        public System.Action RefreshUi;

        public void Initialise(GameWorld world, IsoCameraController camera)
        {
            _world = world;
            _camera = camera;
            _units = world.Units;
            _buildings = world.Buildings;
            _construction = world.Construction;
            _unitMover = world.UnitMover;
            _pathfinding = world.Pathfinding;
            _nav = world.Navigation;
            _grid = world.Grid;
            SelectNone();
        }

        // =====================================================================
        //  Update
        // =====================================================================
        void Update()
        {
            if (_world == null || !_world.IsReady) return;

            _camera.Tick(Time.unscaledDeltaTime);

            var state = _world.State.State;
            if (state == GameState.Paused || state == GameState.Menu) return;

            ReadPointer();
        }

        void ReadPointer()
        {
#if UNITY_EDITOR || UNITY_STANDALONE
            ReadMouse();
#endif
            if (Input.touchCount > 0) ReadTouches();
            else if (Input.touchCount == 0 && _activeFingerId != -1) EndTouch();
        }

        // ------------------------------------------------------------------
        //  Mouse (editor / desktop) — same intents as touch
        // ------------------------------------------------------------------
        void ReadMouse()
        {
            if (Input.GetMouseButtonDown(0)) BeginPointer(Input.mousePosition, 0);
            else if (Input.GetMouseButton(0)) MovePointer(Input.mousePosition);
            else if (Input.GetMouseButtonUp(0)) EndPointer(Input.mousePosition);

            float scroll = Input.mouseScrollDelta.y;
            if (Mathf.Abs(scroll) > 0.01f && !IsPointerOverUi())
                _camera.ZoomBy(-scroll);
        }

        // ------------------------------------------------------------------
        //  Touch
        // ------------------------------------------------------------------
        void ReadTouches()
        {
            if (Input.touchCount >= 2)
            {
                HandlePinch();
                return;
            }

            var touch = Input.GetTouch(0);
            switch (touch.phase)
            {
                case TouchPhase.Began:
                    BeginPointer(touch.position, touch.fingerId);
                    break;
                case TouchPhase.Moved:
                case TouchPhase.Stationary:
                    MovePointer(touch.position);
                    break;
                case TouchPhase.Ended:
                case TouchPhase.Canceled:
                    EndPointer(touch.position);
                    break;
            }
        }

        void HandlePinch()
        {
            var a = Input.GetTouch(0);
            var b = Input.GetTouch(1);
            float distance = Vector2.Distance(a.position, b.position);

            if (_pinchPrevDistance > 1f)
            {
                float delta = distance - _pinchPrevDistance;
                _camera.ZoomBy(-delta * 0.02f);

                // Twist → camera yaw.
                Vector2 prevDir = a.position - a.deltaPosition - (b.position - b.deltaPosition);
                Vector2 dir = a.position - b.position;
                float angle = Vector2.SignedAngle(prevDir, dir);
                if (Mathf.Abs(angle) > 0.4f && Mathf.Abs(angle) < 25f) _camera.RotateBy(angle * 0.6f);
            }

            _pinchPrevDistance = distance;
            _activeFingerId = -1;
        }

        // ------------------------------------------------------------------
        //  Shared pointer handling
        // ------------------------------------------------------------------
        void BeginPointer(Vector2 position, int fingerId)
        {
            _activeFingerId = fingerId;
            _touchStart = position;
            _lastTouch = position;
            _touchStartTime = Time.unscaledTime;
            _moveAccum = Vector2.zero;
            _longPressFired = false;
            _draggingCamera = false;
            _pinchPrevDistance = 0f;

            if (IsPointerOverUi())
            {
                _activeFingerId = -1;
                return;
            }

            // A second tap inside the window counts as a double tap → focus.
            if (Time.unscaledTime - _lastTapTime < Balance.Ui.DoubleTapWindow &&
                Vector2.Distance(position, _lastTapPosition) < 60f)
            {
                HandleDoubleTap(position);
                _lastTapTime = -1f;
            }
        }

        void MovePointer(Vector2 position)
        {
            if (_activeFingerId == -1) return;

            Vector2 delta = position - _lastTouch;
            _lastTouch = position;
            _moveAccum += delta.abs();

            float heldFor = Time.unscaledTime - _touchStartTime;

            // Long press on the map: attack-move order (or demolish confirm).
            if (!_longPressFired && heldFor > Balance.Ui.LongPressDuration &&
                _moveAccum.magnitude < Balance.Ui.TapMaxMovementPixels)
            {
                _longPressFired = true;
                HandleLongPress(position);
                return;
            }

            if (_moveAccum.magnitude < Balance.Ui.DragThresholdPixels) return;

            if (IsPlacing)
            {
                UpdateGhost(position);
                return;
            }

            _draggingCamera = true;
            _camera.PanBy(delta);
        }

        void EndPointer(Vector2 position)
        {
            if (_activeFingerId == -1) return;
            float heldFor = Time.unscaledTime - _touchStartTime;

            if (_draggingCamera) _camera.AddPanInertia();

            if (!_longPressFired && _moveAccum.magnitude < Balance.Ui.TapMaxMovementPixels && heldFor < 0.6f)
            {
                HandleTap(position);
                _lastTapTime = Time.unscaledTime;
                _lastTapPosition = position;
            }

            _activeFingerId = -1;
            _draggingCamera = false;
        }

        void EndTouch()
        {
            _activeFingerId = -1;
            _draggingCamera = false;
        }

        // =====================================================================
        //  Intents
        // =====================================================================
        void HandleTap(Vector2 screenPosition)
        {
            var cell = _camera.ScreenToCell(screenPosition);

            switch (Mode)
            {
                case InteractionMode.PlaceBuilding:
                    TryConfirmPlacement(cell);
                    return;
                case InteractionMode.Demolish:
                    DemolishAt(cell);
                    return;
                case InteractionMode.Repair:
                    RepairAt(cell);
                    return;
                case InteractionMode.SetGarrison:
                    GarrisonAt(cell);
                    return;
            }

            // Build the touch world point once for unit picking.
            Vector3 world;
            if (!_camera.ScreenToGround(screenPosition, out world)) return;

            UnitInstance picked = FindUnitAt(world, 0.9f);
            if (picked != null)
            {
                if (picked.Team == Team.Player) SelectSingle(picked);
                else IssueOrder(cell, true);
                return;
            }

            var building = _buildings.BuildingAt(cell);
            if (building != null)
            {
                SelectBuilding(building);
                return;
            }

            // Empty ground with troops selected: move there.
            if (Selection.Count > 0) IssueOrder(cell, EnemyAttackMove);
            else SelectNone();
        }

        void HandleDoubleTap(Vector2 screenPosition)
        {
            Vector3 world;
            if (!_camera.ScreenToGround(screenPosition, out world)) return;
            _camera.Focus(world);
            EventBus.Publish(new MinimapPingEvent
            {
                Cell = new Vector2Int(Mathf.FloorToInt(world.x), Mathf.FloorToInt(world.z)),
                Color = new Color(0.95f, 0.85f, 0.35f),
            });
        }

        void HandleLongPress(Vector2 screenPosition)
        {
            var cell = _camera.ScreenToCell(screenPosition);
            if (Selection.Count == 0) return;
            IssueOrder(cell, true);   // attack-move
        }

        void UpdateGhost(Vector2 screenPosition)
        {
            GhostCell = _camera.ScreenToCell(screenPosition);
            if (PendingBuilding == BuildingId.None) return;
            GhostError = _construction.ValidateGhost(PendingBuilding, GhostCell, Team.Player);
            if (GhostError == PlacementError.Ok && !_world.Resources.CanAfford(Team.Player,
                    BuildingCatalog.Get(PendingBuilding).Cost))
                GhostError = PlacementError.CannotAfford;
            if (RefreshUi != null) RefreshUi();
        }

        void TryConfirmPlacement(Int2 cell)
        {
            if (PendingBuilding == BuildingId.None) return;

            BuildingInstance placed;
            PlacementError error;
            bool ok = _construction.TryPlace(PendingBuilding, cell, Team.Player, false, out placed, out error);

            if (!ok)
            {
                EventBus.Publish(ToastEvent.Bad(ExplainError(PendingBuilding, error)));
                return;
            }

            EventBus.Publish(new CameraShakeEvent
            {
                Magnitude = 0.06f, Duration = 0.15f,
                WorldPosition = new Vector3(cell.x, 0f, cell.y),
            });

            // Shift-drag style chain building: keep the same blueprint armed for
            // walls/gates so the player can trace an entire curtain wall.
            var def = BuildingCatalog.Get(PendingBuilding);
            bool keepArmed = def.IsWall && !def.IsTower && _world.Resources.CanAfford(Team.Player, def.Cost);
            if (!keepArmed) CancelPlacement();
            if (RefreshUi != null) RefreshUi();
        }

        public static string ExplainError(BuildingId id, PlacementError error)
        {
            string name = BuildingCatalog.Get(id).DisplayName;
            switch (error)
            {
                case PlacementError.OutOfBounds: return "Outside the map";
                case PlacementError.Occupied: return "Something is already there";
                case PlacementError.TerrainUnsuitable: return "That ground is not buildable";
                case PlacementError.SlopeTooSteep: return "The ground is too steep here";
                case PlacementError.NeedsForest: return name + " needs trees next to it";
                case PlacementError.NeedsRock: return name + " needs a rock deposit";
                case PlacementError.NeedsIronOre: return name + " needs an iron vein";
                case PlacementError.NeedsFertile: return name + " needs fertile soil";
                case PlacementError.NeedsWaterAdjacent: return name + " must touch water";
                case PlacementError.MustTouchTerritory: return "Build inside your territory, or touching an existing building";
                case PlacementError.CannotAfford: return "Not enough resources";
                case PlacementError.BlockedByUnit: return "Someone is standing there";
                case PlacementError.Unknown: return "Cannot build that here";
                default: return "Cannot build that here";
            }
        }

        void DemolishAt(Int2 cell)
        {
            var building = _buildings.BuildingAt(cell);
            if (building == null || building.Team != Team.Player) return;
            if (_construction.Demolish(building))
            {
                Mode = InteractionMode.Select;
                if (RefreshUi != null) RefreshUi();
            }
        }

        void RepairAt(Int2 cell)
        {
            var building = _buildings.BuildingAt(cell);
            if (building == null || building.Team != Team.Player) return;
            _construction.QueueRepair(building, true);
            Mode = InteractionMode.Select;
            if (RefreshUi != null) RefreshUi();
        }

        void GarrisonAt(Int2 cell)
        {
            var building = _buildings.BuildingAt(cell);
            if (building == null || building.Team != Team.Player) return;

            for (int i = 0; i < Selection.Count; i++)
            {
                var unit = Selection[i];
                if (unit == null || !unit.IsAlive) continue;
                _unitMover.Garrison(unit, building);
            }

            Mode = InteractionMode.Select;
            if (RefreshUi != null) RefreshUi();
        }

        // =====================================================================
        //  Orders
        // =====================================================================
        void IssueOrder(Int2 cell, bool attackMove)
        {
            if (Selection.Count == 0) return;

            // Filter to military; workers get explicit job orders elsewhere.
            var military = new List<UnitInstance>(Selection.Count);
            for (int i = 0; i < Selection.Count; i++)
            {
                var u = Selection[i];
                if (u == null || !u.IsAlive) continue;
                if (u.IsWorker) continue;
                military.Add(u);
            }

            if (military.Count == 0)
            {
                EventBus.Publish(ToastEvent.Info("Only troops take orders — peasants need a job building"));
                return;
            }

            _unitMover.IssueGroupMove(military, cell, attackMove);

            EventBus.Publish(new MinimapPingEvent
            {
                Cell = new Vector2Int(cell.x, cell.y),
                Color = attackMove ? new Color(0.9f, 0.3f, 0.25f) : new Color(0.4f, 0.85f, 0.45f),
            });
        }

        // =====================================================================
        //  Selection
        // =====================================================================
        public void SelectSingle(UnitInstance unit)
        {
            ClearSelectionFlags();
            Selection.Clear();
            SelectedBuilding = null;
            if (unit != null)
            {
                unit.Selected = true;
                Selection.Add(unit);
            }
            PublishSelection();
        }

        public void SelectBuilding(BuildingInstance building)
        {
            ClearSelectionFlags();
            Selection.Clear();
            SelectedBuilding = building;
            PublishSelection();
        }

        public void SelectNone()
        {
            ClearSelectionFlags();
            Selection.Clear();
            SelectedBuilding = null;
            PublishSelection();
        }

        public void SelectAllMilitary()
        {
            ClearSelectionFlags();
            Selection.Clear();
            SelectedBuilding = null;
            for (int i = 0; i < _units.All.Count; i++)
            {
                var u = _units.All[i];
                if (u == null || !u.IsAlive || u.Team != Team.Player || u.IsWorker) continue;
                u.Selected = true;
                Selection.Add(u);
            }
            PublishSelection();
        }

        public void SelectAllIdlePeasants()
        {
            ClearSelectionFlags();
            Selection.Clear();
            SelectedBuilding = null;
            for (int i = 0; i < _units.All.Count; i++)
            {
                var u = _units.All[i];
                if (u == null || !u.IsAlive || u.Team != Team.Player || !u.IsWorker) continue;
                if (u.JobBuilding != Handle.Invalid) continue;
                u.Selected = true;
                Selection.Add(u);
            }
            PublishSelection();
        }

        void ClearSelectionFlags()
        {
            for (int i = 0; i < Selection.Count; i++)
                if (Selection[i] != null) Selection[i].Selected = false;
        }

        void PublishSelection()
        {
            EventBus.Publish(new SelectionChangedEvent
            {
                PrimaryUnitHandle = Selection.Count > 0 ? Selection[0].Handle : Handle.Invalid,
                SelectedCount = Selection.Count,
                SelectedBuilding = SelectedBuilding != null ? SelectedBuilding.Definition.Id : BuildingId.None,
                SelectedCell = SelectedBuilding != null
                    ? new Vector2Int(SelectedBuilding.Rect.x, SelectedBuilding.Rect.y)
                    : new Vector2Int(-1, -1),
                HasSelection = Selection.Count > 0 || SelectedBuilding != null,
            });
            if (RefreshUi != null) RefreshUi();
        }

        UnitInstance FindUnitAt(Vector3 world, float radius)
        {
            _units.QueryRadius(world, radius, _marqueeBuffer);
            UnitInstance best = null;
            float bestDist = float.MaxValue;
            for (int i = 0; i < _marqueeBuffer.Count; i++)
            {
                var u = _marqueeBuffer[i];
                if (u == null || !u.IsAlive) continue;
                float d = (u.Position - world).sqrMagnitude;
                if (d < bestDist) { bestDist = d; best = u; }
            }
            return best;
        }

        // =====================================================================
        //  Placement API (called by the HUD)
        // =====================================================================
        public void BeginPlacement(BuildingId id)
        {
            if (id == BuildingId.None) { CancelPlacement(); return; }
            PendingBuilding = id;
            Mode = InteractionMode.PlaceBuilding;
            _world.State.EnterBuildPreview();
            GhostCell = _camera.ScreenToCell(new Vector2(Screen.width * 0.5f, Screen.height * 0.5f));
            RefreshUi?.Invoke();
        }

        public void CancelPlacement()
        {
            PendingBuilding = BuildingId.None;
            Mode = InteractionMode.Select;
            GhostError = PlacementError.Ok;
            _world.State.ExitBuildPreview();
            RefreshUi?.Invoke();
        }

        public void BeginDemolish()
        {
            CancelPlacement();
            Mode = InteractionMode.Demolish;
            EventBus.Publish(ToastEvent.Info("Tap a building to demolish it"));
            RefreshUi?.Invoke();
        }

        public void BeginRepair()
        {
            CancelPlacement();
            Mode = InteractionMode.Repair;
            EventBus.Publish(ToastEvent.Info("Tap a damaged building to repair it"));
            RefreshUi?.Invoke();
        }

        public void BeginGarrison()
        {
            CancelPlacement();
            Mode = InteractionMode.SetGarrison;
            EventBus.Publish(ToastEvent.Info("Tap a tower or wall to garrison your troops"));
            RefreshUi?.Invoke();
        }

        public void ToggleAttackMove()
        {
            EnemyAttackMove = !EnemyAttackMove;
            EventBus.Publish(ToastEvent.Info(EnemyAttackMove
                ? "Attack-move: troops engage everything on the way"
                : "Move: troops ignore enemies until they arrive"));
            RefreshUi?.Invoke();
        }

        static bool IsPointerOverUi()
        {
            return EventSystem.current != null && EventSystem.current.IsPointerOverGameObject();
        }

    }
}
