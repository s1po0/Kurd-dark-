// -----------------------------------------------------------------------------
//  File: View/WorldView.cs
//  Purpose: The bridge from simulation state to what the player sees. Owns:
//    * pooled unit views (one GameObject per rendered unit, recycled)
//    * building views (created once per placed building)
//    * the build ghost with green/red footprint validation
//    * selection rings, order pings, health bars, damage flashes
//    * pooled projectile visuals
//
//  Everything uses MaterialPropertyBlock colour overrides on one shared material,
//  which keeps draw calls batched and — critically for mobile — avoids creating
//  materials at runtime.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Combat;
using KurdCastle.Construction;
using KurdCastle.World;
using KurdCastle.InputSys;

namespace KurdCastle.View
{
    public sealed class WorldView : MonoBehaviour
    {
        GameWorld _world;
        UnitRegistry _units;
        BuildingRegistry _buildings;
        ProjectileSystem _projectiles;
        InputSys.PlayerController _player;
        IsoCameraController _camera;

        readonly Dictionary<int, GameObject> _unitViews = new Dictionary<int, GameObject>(256);
        readonly Stack<GameObject> _unitPool = new Stack<GameObject>(128);
        readonly Dictionary<int, GameObject> _buildingViews = new Dictionary<int, GameObject>(256);
        readonly Dictionary<int, GameObject> _projectileViews = new Dictionary<int, GameObject>(256);
        readonly Stack<GameObject> _projectilePool = new Stack<GameObject>(128);
        readonly Dictionary<int, GameObject> _healthBars = new Dictionary<int, GameObject>(256);

        GameObject _ghost;
        GameObject _selectionRingPrefab;
        readonly List<GameObject> _selectionRings = new List<GameObject>(64);
        readonly List<GameObject> _orderPings = new List<GameObject>(8);

        Transform _root;
        static readonly int ColorId = Shader.PropertyToID("_BaseColor");
        static readonly int LegacyColorId = Shader.PropertyToID("_Color");

        public int LiveUnitViews { get { return _unitViews.Count; } }
        public int LiveBuildingViews { get { return _buildingViews.Count; } }
        public int LiveProjectileViews { get { return _projectileViews.Count; } }

        public void Initialise(GameWorld world, IsoCameraController camera, InputSys.PlayerController player)
        {
            _world = world;
            _camera = camera;
            _player = player;
            _units = world.Units;
            _buildings = world.Buildings;
            _projectiles = world.Projectiles;

            _root = new GameObject("WorldView").transform;
            _root.SetParent(transform, false);

            BuildGroundPlane();
            BuildGhost();
            PrewarmUnitViews(Balance.Performance.UnitViewPoolPrewarm);
            PrewarmProjectileViews(64);

            _buildings.Placed += OnBuildingPlaced;
            _buildings.Destroyed += OnBuildingDestroyed;
            _buildings.Removed += OnBuildingDestroyed;

            // Existing scenario buildings (keep, enemy camp, hamlet) need views now.
            for (int i = 0; i < _buildings.All.Count; i++)
                if (_buildings.All[i] != null) OnBuildingPlaced(_buildings.All[i]);
        }

        void OnDestroy()
        {
            if (_buildings == null) return;
            _buildings.Placed -= OnBuildingPlaced;
            _buildings.Destroyed -= OnBuildingDestroyed;
            _buildings.Removed -= OnBuildingDestroyed;
        }

        // =====================================================================
        //  Static world geometry
        // =====================================================================
        void BuildGroundPlane()
        {
            // One large terrain mesh built from the tile map: cheap, and it gives
            // the isometric camera something solid to read silhouettes against.
            var terrain = _world.Terrain;
            int w = terrain.Width, h = terrain.Height;
            var vertices = new Vector3[w * h * 4];
            var triangles = new int[w * h * 6];
            var colors = new Color[w * h * 4];

            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    var cell = new Int2(x, y);
                    int i = (y * w + x) * 4;
                    float e = terrain.GetElevation(cell) * 0.18f;

                    vertices[i + 0] = new Vector3(x, e, y);
                    vertices[i + 1] = new Vector3(x + 1, e, y);
                    vertices[i + 2] = new Vector3(x + 1, e, y + 1);
                    vertices[i + 3] = new Vector3(x, e, y + 1);

                    Color c = TerrainColor(terrain, cell);
                    colors[i + 0] = colors[i + 1] = colors[i + 2] = colors[i + 3] = c;

                    int t = (y * w + x) * 6;
                    triangles[t + 0] = i + 0; triangles[t + 1] = i + 2; triangles[t + 2] = i + 1;
                    triangles[t + 3] = i + 0; triangles[t + 4] = i + 3; triangles[t + 5] = i + 2;
                }
            }

            var mesh = new Mesh { name = "TerrainMesh" };
            mesh.indexFormat = UnityEngine.Rendering.IndexFormat.UInt32;
            mesh.vertices = vertices;
            mesh.triangles = triangles;
            mesh.colors = colors;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();

            var go = new GameObject("Terrain");
            go.transform.SetParent(_root, false);
            var filter = go.AddComponent<MeshFilter>();
            filter.sharedMesh = mesh;
            var renderer = go.AddComponent<MeshRenderer>();
            var material = new Material(ProceduralMeshFactory.SharedMaterial) { name = "TerrainMaterial" };
            material.enableInstancing = true;
            renderer.sharedMaterial = material;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            // Trees are drawn as instanced cones: one GameObject per tree would be
            // thousands of objects on a 96×96 map.
            BuildTrees();
        }

        static Color TerrainColor(TerrainMap terrain, Int2 cell)
        {
            switch (terrain.Get(cell))
            {
                case TerrainType.Water: return new Color(0.13f, 0.24f, 0.34f);
                case TerrainType.Rock: return new Color(0.38f, 0.37f, 0.36f);
                case TerrainType.IronOre: return new Color(0.34f, 0.33f, 0.38f);
                case TerrainType.Sand: return new Color(0.66f, 0.60f, 0.44f);
                case TerrainType.RoughGrass: return new Color(0.30f, 0.38f, 0.22f);
                case TerrainType.FertileSoil: return new Color(0.34f, 0.30f, 0.16f);
                case TerrainType.Dirt: return new Color(0.36f, 0.31f, 0.24f);
                default: return new Color(0.34f, 0.44f, 0.26f);
            }
        }

        void BuildTrees()
        {
            var terrain = _world.Terrain;
            var points = new List<Vector3>(2048);
            var scales = new List<float>(2048);
            for (int y = 0; y < terrain.Height; y++)
            {
                for (int x = 0; x < terrain.Width; x++)
                {
                    var cell = new Int2(x, y);
                    if (!terrain.HasVegetation(cell)) continue;
                    points.Add(new Vector3(x + 0.5f, terrain.GetElevation(cell) * 0.18f, y + 0.5f));
                    scales.Add(0.7f + ((x * 31 + y * 17) % 7) * 0.06f);
                }
            }

            if (points.Count == 0) return;

            var mesh = ProceduralMeshFactory.GetUnitMesh(UnitShape.Peasant);
            var renderer = new GameObject("Trees").AddComponent<MeshRenderer>();
            renderer.transform.SetParent(_root, false);
            renderer.sharedMaterial = ProceduralMeshFactory.SharedMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            _treeBlock = new MaterialPropertyBlock();
            _treePoints = points;
            _treeScales = scales;
            _treeMesh = mesh;
            _treeRenderer = renderer;
        }

        List<Vector3> _treePoints;
        List<float> _treeScales;
        Mesh _treeMesh;
        MeshRenderer _treeRenderer;
        MaterialPropertyBlock _treeBlock;

        // =====================================================================
        //  Per-frame refresh
        // =====================================================================
        void LateUpdate()
        {
            if (_world == null || !_world.IsReady) return;

            SyncUnits(Time.unscaledDeltaTime);
            SyncBuildings();
            SyncProjectiles();
            SyncSelectionVisuals();
            SyncGhost();
            DrawTrees();
        }

        void DrawTrees()
        {
            if (_treePoints == null || _treeMesh == null) return;
            var matrices = new Matrix4x4[Balance.Performance.InstanceBatchSize];
            int drawn = 0;
            _treeBlock.SetColor(ResolveColorId(ProceduralMeshFactory.SharedMaterial), new Color(0.16f, 0.30f, 0.15f));

            for (int i = 0; i < _treePoints.Count; i++)
            {
                var p = _treePoints[i];
                if (Vector3.Distance(p, _camera.TargetPoint) > Balance.Performance.UnitViewCullDistance + 8f)
                    continue;

                float s = _treeScales[i];
                matrices[drawn++] = Matrix4x4.TRS(p, Quaternion.Euler(0f, (i * 47f) % 360f, 0f),
                                                  new Vector3(s * 0.5f, s * 1.4f, s * 0.5f));
                if (drawn == matrices.Length)
                {
                    Graphics.DrawMeshInstanced(_treeMesh, 0, ProceduralMeshFactory.SharedMaterial, matrices,
                                               drawn, _treeBlock,
                                               UnityEngine.Rendering.ShadowCastingMode.Off, false, gameObject.layer);
                    drawn = 0;
                }
            }
            if (drawn > 0)
            {
                Graphics.DrawMeshInstanced(_treeMesh, 0, ProceduralMeshFactory.SharedMaterial, matrices,
                                           drawn, _treeBlock,
                                           UnityEngine.Rendering.ShadowCastingMode.Off, false, gameObject.layer);
            }
        }

        static int ResolveColorId(Material material)
        {
            return material.HasProperty("_BaseColor") ? ColorId : LegacyColorId;
        }

        // ------------------------------------------------------------------
        //  Units
        // ------------------------------------------------------------------
        void SyncUnits(float dt)
        {
            float cullDistance = Balance.Performance.UnitViewCullDistance;
            Vector3 cameraTarget = _camera.TargetPoint;

            for (int i = 0; i < _units.All.Count; i++)
            {
                var unit = _units.All[i];
                if (unit == null || !unit.IsAlive)
                {
                    if (unit != null) HideUnitView(unit.Handle);
                    continue;
                }

                float distance = Vector3.Distance(unit.Position, cameraTarget);
                if (distance > cullDistance)
                {
                    HideUnitView(unit.Handle);
                    continue;
                }

                GameObject view = GetUnitView(unit);
                float smoothing = Mathf.Clamp01(dt * Balance.Sim.InterpolationSmoothing);
                view.transform.position = Vector3.Lerp(view.transform.position, unit.Position, smoothing);

                // Procedural walk bob: a cheap stand-in for an animation clip.
                float bob = Mathf.Sin(unit.BobPhase) * unit.Definition.WalkBobAmplitude;
                view.transform.position += new Vector3(0f, bob, 0f);
                view.transform.rotation = Quaternion.Euler(0f, unit.FacingDeg, 0f);

                var renderer = view.GetComponent<MeshRenderer>();
                Color body = unit.Definition.PrimaryColor;
                if (unit.Team == Team.Enemy) body = Color.Lerp(body, new Color(0.55f, 0.12f, 0.12f), 0.45f);
                if (unit.FlashTimer > 0f) body = Color.Lerp(body, Color.red, unit.FlashTimer * 0.8f);
                if (unit.IsGarrisoned) body *= 0.8f;
                new PropertyBlockCache(renderer).Set(body);

                UpdateHealthBar(unit, distance);
            }
        }

        GameObject GetUnitView(UnitInstance unit)
        {
            GameObject view;
            if (_unitViews.TryGetValue(unit.Handle, out view) && view != null) return view;

            view = _unitPool.Count > 0 ? _unitPool.Pop() : CreateUnitView();
            view.SetActive(true);
            var filter = view.GetComponent<MeshFilter>();
            filter.sharedMesh = ProceduralMeshFactory.GetUnitMesh(unit.Definition.Shape);
            view.transform.localScale = Vector3.one * (unit.VisualScale * 1.5f);
            view.transform.position = unit.Position;
            _unitViews[unit.Handle] = view;
            return view;
        }

        GameObject CreateUnitView()
        {
            var go = new GameObject("UnitView");
            go.transform.SetParent(_root, false);
            go.AddComponent<MeshFilter>();
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralMeshFactory.SharedMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            renderer.lightProbeUsage = UnityEngine.Rendering.LightProbeUsage.Off;
            renderer.reflectionProbeUsage = UnityEngine.Rendering.ReflectionProbeUsage.Off;
            return go;
        }

        void HideUnitView(int handle)
        {
            GameObject view;
            if (!_unitViews.TryGetValue(handle, out view)) return;
            _unitViews.Remove(handle);
            if (view == null) return;
            view.SetActive(false);
            _unitPool.Push(view);
        }

        void UpdateHealthBar(UnitInstance unit, float distance)
        {
            bool show = unit.HealthPct < 0.999f && distance < Balance.Performance.HealthBarMaxDistance;
            GameObject bar;
            if (!_healthBars.TryGetValue(unit.Handle, out bar) || bar == null)
            {
                if (!show) return;
                bar = CreateBar("HealthBar", new Color(0.25f, 0.85f, 0.3f));
                _healthBars[unit.Handle] = bar;
            }

            bar.SetActive(show);
            if (!show) return;

            bar.transform.position = unit.Position + new Vector3(0f, 1.9f, 0f);
            bar.transform.localScale = new Vector3(0.9f * unit.HealthPct, 0.12f, 1f);
            Color c = unit.Team == Team.Player ? new Color(0.3f, 0.85f, 0.35f) : new Color(0.9f, 0.3f, 0.25f);
            new PropertyBlockCache(bar.GetComponent<MeshRenderer>()).Set(c);
        }

        GameObject CreateBar(string name, Color color)
        {
            var go = new GameObject(name);
            go.transform.SetParent(_root, false);
            go.AddComponent<MeshFilter>().sharedMesh = ProceduralMeshFactory.GetBox(1f, 1f, 1f);
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralMeshFactory.SharedMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            new PropertyBlockCache(renderer).Set(color);
            return go;
        }

        // ------------------------------------------------------------------
        //  Buildings
        // ------------------------------------------------------------------
        void OnBuildingPlaced(BuildingInstance building)
        {
            if (building == null) return;
            if (_buildingViews.ContainsKey(building.Handle)) return;

            var go = new GameObject("B_" + building.Definition.Id);
            go.transform.SetParent(_root, false);
            go.transform.position = new Vector3(building.Rect.x + building.Rect.width * 0.5f, 0f,
                                                building.Rect.y + building.Rect.height * 0.5f);
            go.AddComponent<MeshFilter>().sharedMesh = ProceduralMeshFactory.GetBuildingMesh(building.Definition);
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralMeshFactory.SharedMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            _buildingViews[building.Handle] = go;
        }

        void OnBuildingDestroyed(BuildingInstance building)
        {
            if (building == null) return;
            GameObject go;
            if (_buildingViews.TryGetValue(building.Handle, out go) && go != null)
            {
                Destroy(go);
            }
            _buildingViews.Remove(building.Handle);
        }

        void SyncBuildings()
        {
            for (int i = 0; i < _buildings.All.Count; i++)
            {
                var b = _buildings.All[i];
                if (b == null) continue;

                GameObject go;
                if (!_buildingViews.TryGetValue(b.Handle, out go) || go == null)
                {
                    OnBuildingPlaced(b);
                    if (!_buildingViews.TryGetValue(b.Handle, out go) || go == null) continue;
                }

                var renderer = go.GetComponent<MeshRenderer>();
                Color color = b.Definition.PrimaryColor;
                if (b.Team == Team.Enemy) color = Color.Lerp(color, new Color(0.5f, 0.12f, 0.14f), 0.5f);
                if (b.IsConstructionSite) color = Color.Lerp(color, new Color(0.35f, 0.30f, 0.22f), 0.55f);
                if (b.IsRubble) color = new Color(0.26f, 0.24f, 0.22f);
                if (b.DamageFlash > 0f) color = Color.Lerp(color, Color.red, b.DamageFlash * 0.7f);

                var block = new PropertyBlockCache(renderer);
                block.Set(color);
                if (b.IsConstructionSite)
                {
                    // Scaffolding: squash the mesh vertically while it is built.
                    go.transform.localScale = new Vector3(1f, Mathf.Max(0.25f, b.BuildProgress), 1f);
                }
                else
                {
                    go.transform.localScale = Vector3.one;
                }

                // Siege damage feedback: darken as the structure loses health.
                if (b.HealthPct < 0.6f)
                {
                    color = Color.Lerp(color, new Color(0.15f, 0.12f, 0.10f), (0.6f - b.HealthPct) * 0.8f);
                    block.Set(color);
                }
            }
        }

        /// <summary>Tiny helper so we allocate nothing per frame per building.</summary>
        readonly struct PropertyBlockCache
        {
            static readonly MaterialPropertyBlock Block = new MaterialPropertyBlock();
            readonly MeshRenderer _renderer;
            public PropertyBlockCache(MeshRenderer renderer) { _renderer = renderer; }
            public void Set(Color color)
            {
                Block.Clear();
                Block.SetColor(ResolveColorId(_renderer.sharedMaterial), color);
                _renderer.SetPropertyBlock(Block);
            }
        }

        // ------------------------------------------------------------------
        //  Projectiles
        // ------------------------------------------------------------------
        void SyncProjectiles()
        {
            // Recycle views for projectiles that no longer exist.
            if (_projectileViews.Count > 0)
            {
                var stale = new List<int>(8);
                foreach (var pair in _projectileViews)
                {
                    bool found = false;
                    for (int i = 0; i < _projectiles.Active.Count; i++)
                    {
                        if (_projectiles.Active[i].Handle == pair.Key) { found = true; break; }
                    }
                    if (!found) stale.Add(pair.Key);
                }
                for (int i = 0; i < stale.Count; i++)
                {
                    GameObject go;
                    if (_projectileViews.TryGetValue(stale[i], out go) && go != null)
                    {
                        go.SetActive(false);
                        _projectilePool.Push(go);
                    }
                    _projectileViews.Remove(stale[i]);
                }
            }

            for (int i = 0; i < _projectiles.Active.Count; i++)
            {
                var p = _projectiles.Active[i];
                GameObject view;
                if (!_projectileViews.TryGetValue(p.Handle, out view) || view == null)
                {
                    view = RentProjectileView(p.Shape);
                    _projectileViews[p.Handle] = view;
                }
                view.transform.position = p.Position;
                view.transform.rotation = Quaternion.Euler(0f, p.Rotation, p.Shape == VisualShape.Arrow ? 0f : 0f);
            }
        }

        void PrewarmProjectileViews(int count)
        {
            for (int i = 0; i < count; i++)
            {
                var go = CreateProjectileView(VisualShape.Arrow);
                go.SetActive(false);
                _projectilePool.Push(go);
            }
        }

        GameObject RentProjectileView(VisualShape shape)
        {
            var go = _projectilePool.Count > 0 ? _projectilePool.Pop() : CreateProjectileView(shape);
            go.SetActive(true);
            var filter = go.GetComponent<MeshFilter>();
            filter.sharedMesh = shape == VisualShape.Boulder ? GetBoulderMesh() : GetArrowMesh();
            go.transform.localScale = shape == VisualShape.Boulder ? Vector3.one * 0.5f : Vector3.one;
            return go;
        }

        static Mesh _arrowMesh;
        static Mesh _boulderMesh;

        static Mesh GetArrowMesh()
        {
            if (_arrowMesh == null) _arrowMesh = ProceduralMeshFactory.GetBox(0.08f, 0.08f, 0.7f);
            return _arrowMesh;
        }

        static Mesh GetBoulderMesh()
        {
            if (_boulderMesh == null) _boulderMesh = ProceduralMeshFactory.GetBox(0.4f, 0.4f, 0.4f);
            return _boulderMesh;
        }

        GameObject CreateProjectileView(VisualShape shape)
        {
            var go = new GameObject("Projectile");
            go.transform.SetParent(_root, false);
            go.AddComponent<MeshFilter>().sharedMesh = GetArrowMesh();
            var renderer = go.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralMeshFactory.SharedMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            return go;
        }

        void PrewarmUnitViews(int count)
        {
            for (int i = 0; i < count; i++)
            {
                var go = CreateUnitView();
                go.SetActive(false);
                _unitPool.Push(go);
            }
        }

        // ------------------------------------------------------------------
        //  Ghost, selection, pings
        // ------------------------------------------------------------------
        void BuildGhost()
        {
            _ghost = new GameObject("BuildGhost");
            _ghost.transform.SetParent(_root, false);
            _ghost.AddComponent<MeshFilter>().sharedMesh = ProceduralMeshFactory.GetQuad();
            var renderer = _ghost.AddComponent<MeshRenderer>();
            renderer.sharedMaterial = ProceduralMeshFactory.SharedMaterial;
            renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            _ghost.SetActive(false);

            _selectionRingPrefab = new GameObject("SelectionRing");
            _selectionRingPrefab.transform.SetParent(_root, false);
            _selectionRingPrefab.AddComponent<MeshFilter>().sharedMesh = ProceduralMeshFactory.GetQuad();
            var ringRenderer = _selectionRingPrefab.AddComponent<MeshRenderer>();
            ringRenderer.sharedMaterial = ProceduralMeshFactory.SharedMaterial;
            ringRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            _selectionRingPrefab.SetActive(false);
        }

        void SyncGhost()
        {
            bool placing = _player != null && _player.IsPlacing;
            _ghost.SetActive(placing);
            if (!placing) return;

            var def = BuildingCatalog.Get(_player.PendingBuilding);
            var cell = _player.GhostCell;
            _ghost.transform.position = new Vector3(cell.x + def.Footprint.x * 0.5f, 0.06f,
                                                    cell.y + def.Footprint.y * 0.5f);
            _ghost.transform.localScale = new Vector3(def.Footprint.x, 1f, def.Footprint.y);

            var renderer = _ghost.GetComponent<MeshRenderer>();
            var block = new PropertyBlockCache(renderer);
            block.Set(_player.GhostValid ? Balance.Ui.ValidColor : Balance.Ui.InvalidColor);
        }

        void SyncSelectionVisuals()
        {
            if (_player == null) return;

            // Rings under selected units.
            while (_selectionRings.Count < _player.Selection.Count)
            {
                var ring = Instantiate(_selectionRingPrefab, _root);
                ring.name = "Ring";
                ring.SetActive(true);
                _selectionRings.Add(ring);
            }
            for (int i = 0; i < _selectionRings.Count; i++)
            {
                bool used = i < _player.Selection.Count;
                _selectionRings[i].SetActive(used);
                if (!used) continue;
                var unit = _player.Selection[i];
                if (unit == null || !unit.IsAlive) { _selectionRings[i].SetActive(false); continue; }
                _selectionRings[i].transform.position = unit.Position + new Vector3(0f, 0.05f, 0f);
                _selectionRings[i].transform.localScale = new Vector3(0.8f, 1f, 0.8f);
                var renderer = _selectionRings[i].GetComponent<MeshRenderer>();
                var block = new PropertyBlockCache(renderer);
                block.Set(new Color(0.35f, 0.95f, 0.4f, 0.5f));
            }

            // Pings fade on their own.
            for (int i = _orderPings.Count - 1; i >= 0; i--)
            {
                var ping = _orderPings[i];
                if (ping == null) { _orderPings.RemoveAt(i); continue; }
                ping.transform.localScale += Vector3.one * Time.unscaledDeltaTime * 2.4f;
                if (ping.transform.localScale.x > 3.2f)
                {
                    Destroy(ping);
                    _orderPings.RemoveAt(i);
                }
            }
        }

        /// <summary>Called by the HUD's minimap when the player taps a location.</summary>
        public void SpawnOrderPing(Vector3 worldPosition, Color color)
        {
            var ping = Instantiate(_selectionRingPrefab, _root);
            ping.name = "Ping";
            ping.SetActive(true);
            ping.transform.position = worldPosition + new Vector3(0f, 0.08f, 0f);
            ping.transform.localScale = Vector3.one * 0.6f;
            var renderer = ping.GetComponent<MeshRenderer>();
            var block = new PropertyBlockCache(renderer);
            block.Set(color);
            _orderPings.Add(ping);
        }
    }
}
