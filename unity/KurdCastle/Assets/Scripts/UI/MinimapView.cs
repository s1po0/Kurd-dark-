// -----------------------------------------------------------------------------
//  File: UI/MinimapView.cs
//  Purpose: Builds the minimap from the terrain tile grid once, then stamps
//           buildings and units on top a few times per second. A 96×96 texture
//           is trivially cheap to update and needs no second camera or render
//           texture — important on mobile where an extra camera pass costs real
//           milliseconds.
// -----------------------------------------------------------------------------
using UnityEngine;
using UnityEngine.UI;
using KurdCastle.Config;
using KurdCastle.Core;
using KurdCastle.Construction;

namespace KurdCastle.UI
{
    public sealed class MinimapView : MonoBehaviour
    {
        GameWorld _world;
        RawImage _image;
        Texture2D _texture;
        Color32[] _pixels;
        float _timer;

        const float UpdateInterval = 0.35f;

        public void Initialise(GameWorld world, RawImage target)
        {
            _world = world;
            _image = target;

            int w = world.Terrain.Width;
            int h = world.Terrain.Height;
            _texture = new Texture2D(w, h, TextureFormat.RGBA32, false)
            {
                filterMode = FilterMode.Point,
                wrapMode = TextureWrapMode.Clamp,
                name = "MinimapTexture",
            };
            _pixels = new Color32[w * h];

            PaintTerrain();
            _texture.SetPixels32(_pixels);
            _texture.Apply(false);

            _image.texture = _texture;
            _image.color = Color.white;
        }

        void PaintTerrain()
        {
            var terrain = _world.Terrain;
            for (int y = 0; y < terrain.Height; y++)
            {
                for (int x = 0; x < terrain.Width; x++)
                {
                    var cell = new Int2(x, y);
                    Color c;
                    switch (terrain.Get(cell))
                    {
                        case TerrainType.Water: c = new Color(0.10f, 0.19f, 0.29f); break;
                        case TerrainType.Rock: c = new Color(0.33f, 0.32f, 0.31f); break;
                        case TerrainType.IronOre: c = new Color(0.28f, 0.27f, 0.33f); break;
                        case TerrainType.Sand: c = new Color(0.62f, 0.56f, 0.40f); break;
                        case TerrainType.Dirt: c = new Color(0.30f, 0.26f, 0.20f); break;
                        case TerrainType.RoughGrass: c = new Color(0.24f, 0.32f, 0.18f); break;
                        case TerrainType.FertileSoil: c = new Color(0.32f, 0.28f, 0.14f); break;
                        default: c = new Color(0.28f, 0.38f, 0.21f); break;
                    }
                    if (terrain.HasVegetation(cell)) c = Color.Lerp(c, new Color(0.14f, 0.28f, 0.12f), 0.6f);
                    // Map rows are painted bottom-up to match the texture's v axis.
                    _pixels[(terrain.Height - 1 - y) * terrain.Width + x] = c;
                }
            }
        }

        void Update()
        {
            if (_world == null || !_world.IsReady || _texture == null) return;

            _timer += Time.unscaledDeltaTime;
            if (_timer < UpdateInterval) return;
            _timer = 0f;

            // Repaint the base each update so destroyed structures disappear.
            PaintTerrain();

            var buildings = _world.Buildings;
            for (int i = 0; i < buildings.All.Count; i++)
            {
                var b = buildings.All[i];
                if (b == null) continue;
                Color32 color = b.Team == Team.Player
                    ? (Color32)new Color(0.55f, 0.86f, 0.55f)
                    : (Color32)new Color(0.9f, 0.32f, 0.28f);
                if (b.IsConstructionSite) color = new Color32(150, 130, 90, 255);

                for (int y = b.Rect.y; y < b.Rect.yMax; y++)
                {
                    for (int x = b.Rect.x; x < b.Rect.xMax; x++)
                    {
                        if (x < 0 || y < 0 || x >= _world.Terrain.Width || y >= _world.Terrain.Height) continue;
                        _pixels[(_world.Terrain.Height - 1 - y) * _world.Terrain.Width + x] = color;
                    }
                }
            }

            var units = _world.Units;
            for (int i = 0; i < units.All.Count; i++)
            {
                var u = units.All[i];
                if (u == null || !u.IsAlive) continue;
                int x = Mathf.FloorToInt(u.Position.x);
                int y = Mathf.FloorToInt(u.Position.z);
                if (x < 0 || y < 0 || x >= _world.Terrain.Width || y >= _world.Terrain.Height) continue;
                Color32 color = u.Team == Team.Player
                    ? (u.IsWorker ? (Color32)new Color(0.95f, 0.92f, 0.55f) : (Color32)new Color(0.35f, 0.75f, 0.95f))
                    : (Color32)new Color(1f, 0.25f, 0.2f);
                _pixels[(_world.Terrain.Height - 1 - y) * _world.Terrain.Width + x] = color;
            }

            _texture.SetPixels32(_pixels);
            _texture.Apply(false);
        }

        /// <summary>Converts a tap on the minimap RectTransform into a world cell.</summary>
        public bool TryGetCellFromScreen(Vector2 screenPosition, RectTransform minimapRect, out Vector2Int cell)
        {
            cell = new Vector2Int(-1, -1);
            Vector2 local;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(
                    minimapRect, screenPosition, null, out local)) return false;

            Rect rect = minimapRect.rect;
            float u = Mathf.InverseLerp(rect.xMin, rect.xMax, local.x);
            float v = Mathf.InverseLerp(rect.yMin, rect.yMax, local.y);
            if (u < 0f || u > 1f || v < 0f || v > 1f) return false;

            int x = Mathf.Clamp(Mathf.FloorToInt(u * _world.Terrain.Width), 0, _world.Terrain.Width - 1);
            int y = Mathf.Clamp(Mathf.FloorToInt((1f - v) * _world.Terrain.Height), 0, _world.Terrain.Height - 1);
            cell = new Vector2Int(x, y);
            return true;
        }
    }
}
