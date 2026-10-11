// -----------------------------------------------------------------------------
//  File: View/ProceduralMeshFactory.cs
//  Purpose: Every visual in the prototype is generated in code, so the repo has
//           no binary art and the project builds from a fresh clone with zero
//           import steps. Meshes are built once and cached — the view layer only
//           ever swaps MeshFilter.sharedMesh and a MaterialPropertyBlock colour.
//
//  These are deliberately chunky, readable silhouettes: from an isometric camera
//  a spearman needs to read as a spearman at 40 metres, and nothing proves that
//  faster than simple primitives with strong vertical accents.
// -----------------------------------------------------------------------------
using System.Collections.Generic;
using UnityEngine;
using KurdCastle.Config;

namespace KurdCastle.View
{
    public static class ProceduralMeshFactory
    {
        static readonly Dictionary<string, Mesh> Cache = new Dictionary<string, Mesh>(64);
        static Material _sharedMaterial;

        public static Material SharedMaterial
        {
            get
            {
                if (_sharedMaterial == null)
                {
                    // URP-safe: if the project uses the built-in pipeline this still
                    // resolves to a lit shader, and the fallback keeps it white so
                    // vertex/material colours are never lost.
                    var shader = Shader.Find("Universal Render Pipeline/Lit");
                    if (shader == null) shader = Shader.Find("Standard");
                    if (shader == null) shader = Shader.Find("Sprites/Default");
                    _sharedMaterial = new Material(shader) { name = "KurdCastleProcedural" };
                    if (_sharedMaterial.HasProperty("_BaseColor")) _sharedMaterial.SetColor("_BaseColor", Color.white);
                    if (_sharedMaterial.HasProperty("_Color")) _sharedMaterial.SetColor("_Color", Color.white);
                    if (_sharedMaterial.HasProperty("_Glossiness")) _sharedMaterial.SetFloat("_Glossiness", 0.15f);
                    if (_sharedMaterial.HasProperty("_Smoothness")) _sharedMaterial.SetFloat("_Smoothness", 0.15f);
                }
                return _sharedMaterial;
            }
        }

        public static void ClearCache()
        {
            Cache.Clear();
        }

        // =====================================================================
        //  Units
        // =====================================================================
        public static Mesh GetUnitMesh(UnitShape shape)
        {
            string key = "unit_" + shape;
            Mesh cached;
            if (Cache.TryGetValue(key, out cached) && cached != null) return cached;

            Mesh mesh;
            switch (shape)
            {
                case UnitShape.Archer: mesh = BuildFigure(0.26f, 1.25f, true, 0.55f); break;
                case UnitShape.Spearman: mesh = BuildFigure(0.27f, 1.3f, true, 0.9f); break;
                case UnitShape.Swordsman: mesh = BuildFigure(0.3f, 1.35f, true, 0.35f); break;
                case UnitShape.Knight: mesh = BuildFigure(0.36f, 1.5f, true, 0.4f); break;
                case UnitShape.Lord: mesh = BuildFigure(0.32f, 1.6f, true, 0.5f); break;
                case UnitShape.Ram: mesh = BuildRam(); break;
                case UnitShape.Catapult: mesh = BuildCatapult(); break;
                case UnitShape.Ladder: mesh = BuildLadder(); break;
                case UnitShape.SiegeTower: mesh = BuildSiegeTower(); break;
                default: mesh = BuildFigure(0.24f, 1.15f, false, 0f); break;
            }
            Cache[key] = mesh;
            return mesh;
        }

        /// <summary>Body + head (+ spear if the unit carries one).</summary>
        static Mesh BuildFigure(float radius, float height, bool armed, float weaponLength)
        {
            var parts = new List<CombineInstance>(6);
            parts.Add(Part(CreateCylinder(radius, radius * 0.85f, height * 0.5f), new Vector3(0f, height * 0.25f, 0f)));
            parts.Add(Part(CreateSphere(radius * 0.75f), new Vector3(0f, height * 0.66f, 0f)));

            if (armed && weaponLength > 0f)
            {
                parts.Add(Part(CreateCylinder(0.035f, 0.035f, weaponLength),
                               new Vector3(radius * 0.9f, height * 0.75f, 0f)));
            }
            if (armed)
            {
                // Shield/pack on the back: reads as "soldier" from above.
                parts.Add(Part(CreateBox(radius * 1.5f, height * 0.3f, radius * 0.35f),
                               new Vector3(-radius * 0.5f, height * 0.4f, 0f)));
            }
            return Combine(parts, "unit");
        }

        static Mesh BuildRam()
        {
            var parts = new List<CombineInstance>(5);
            parts.Add(Part(CreateBox(1.1f, 0.7f, 1.6f), new Vector3(0f, 0.55f, 0f)));           // roof
            parts.Add(Part(CreateCylinder(0.22f, 0.22f, 2.2f, true), new Vector3(0f, 0.7f, 0f))); // trunk
            parts.Add(Part(CreateCylinder(0.1f, 0.1f, 0.5f), new Vector3(0.45f, 0.3f, 0.5f)));
            parts.Add(Part(CreateCylinder(0.1f, 0.1f, 0.5f), new Vector3(-0.45f, 0.3f, 0.5f)));
            parts.Add(Part(CreateCylinder(0.1f, 0.1f, 0.5f), new Vector3(0.45f, 0.3f, -0.5f)));
            return Combine(parts, "ram");
        }

        static Mesh BuildCatapult()
        {
            var parts = new List<CombineInstance>(5);
            parts.Add(Part(CreateBox(1.2f, 0.35f, 1.5f), new Vector3(0f, 0.5f, 0f)));
            parts.Add(Part(CreateBox(0.16f, 0.16f, 1.9f), new Vector3(0f, 1.15f, -0.25f)));
            parts.Add(Part(CreateBox(0.9f, 0.12f, 0.5f), new Vector3(0f, 1.45f, -1.0f)));   // throwing arm
            parts.Add(Part(CreateSphere(0.22f), new Vector3(0f, 1.5f, -1.3f)));             // boulder
            parts.Add(Part(CreateCylinder(0.34f, 0.34f, 0.22f, true), new Vector3(0.55f, 0.22f, 0.45f)));
            return Combine(parts, "catapult");
        }

        static Mesh BuildLadder()
        {
            var parts = new List<CombineInstance>(4);
            parts.Add(Part(CreateFigure(0.25f, 1.2f, false, 0f), Vector3.zero));
            parts.Add(Part(CreateBox(0.7f, 0.08f, 0.08f), new Vector3(0f, 1.5f, 0.2f)));
            parts.Add(Part(CreateBox(0.08f, 1.6f, 0.08f), new Vector3(-0.32f, 0.9f, 0.2f)));
            parts.Add(Part(CreateBox(0.08f, 1.6f, 0.08f), new Vector3(0.32f, 0.9f, 0.2f)));
            return Combine(parts, "ladder");
        }

        static Mesh BuildSiegeTower()
        {
            var parts = new List<CombineInstance>(4);
            parts.Add(Part(CreateBox(1.4f, 2.6f, 1.4f), new Vector3(0f, 1.4f, 0f)));
            parts.Add(Part(CreateBox(1.6f, 0.2f, 1.6f), new Vector3(0f, 2.75f, 0f)));
            parts.Add(Part(CreateBox(0.9f, 0.12f, 1.2f), new Vector3(0f, 1.6f, 0.8f)));   // boarding ramp
            parts.Add(Part(CreateCylinder(0.3f, 0.3f, 0.25f, true), new Vector3(0.6f, 0.25f, 0.6f)));
            return Combine(parts, "siegetower");
        }

        // =====================================================================
        //  Buildings
        // =====================================================================
        public static Mesh GetBuildingMesh(BuildingDefinition def)
        {
            if (def == null) return GetBox(1f, 1f, 1f);

            string key = "b_" + def.Id;
            Mesh cached;
            if (Cache.TryGetValue(key, out cached) && cached != null) return cached;

            Mesh mesh = BuildBuilding(def);
            Cache[key] = mesh;
            return mesh;
        }

        static Mesh BuildBuilding(BuildingDefinition def)
        {
            float w = def.Footprint.x * 0.94f;
            float d = def.Footprint.y * 0.94f;
            float h = def.Height;
            var parts = new List<CombineInstance>(8);

            switch (def.Shape)
            {
                case BuildingShape.Wall:
                    parts.Add(Part(CreateBox(w, h, d), new Vector3(0f, h * 0.5f, 0f)));
                    // Crenellations make a wall line read instantly from above.
                    parts.Add(Part(CreateBox(w + 0.3f, 0.22f, d + 0.3f), new Vector3(0f, h + 0.1f, 0f)));
                    if (def.IsGate)
                    {
                        parts.Add(Part(CreateBox(w * 0.5f, h * 0.62f, d + 0.12f),
                                       new Vector3(0f, h * 0.31f, 0f)));
                    }
                    break;

                case BuildingShape.TowerRound:
                    parts.Add(Part(CreateCylinder(def.Footprint.x * 0.46f, def.Footprint.x * 0.5f, h),
                                   new Vector3(0f, h * 0.5f, 0f)));
                    parts.Add(Part(CreateCylinder(def.Footprint.x * 0.55f, def.Footprint.x * 0.55f, 0.3f),
                                   new Vector3(0f, h + 0.15f, 0f)));
                    break;

                case BuildingShape.TowerSquare:
                case BuildingShape.Keep:
                    parts.Add(Part(CreateBox(w, h, d), new Vector3(0f, h * 0.5f, 0f)));
                    parts.Add(Part(CreateBox(w + 0.35f, 0.3f, d + 0.35f), new Vector3(0f, h + 0.15f, 0f)));
                    if (def.Shape == BuildingShape.Keep)
                    {
                        // Keep: corner turrets + banner, the visual anchor of the castle.
                        float ox = w * 0.42f, oz = d * 0.42f;
                        parts.Add(Part(CreateCylinder(0.6f, 0.6f, h * 1.2f), new Vector3(ox, h * 0.6f, oz)));
                        parts.Add(Part(CreateCylinder(0.6f, 0.6f, h * 1.2f), new Vector3(-ox, h * 0.6f, oz)));
                        parts.Add(Part(CreateCylinder(0.6f, 0.6f, h * 1.2f), new Vector3(ox, h * 0.6f, -oz)));
                        parts.Add(Part(CreateCylinder(0.6f, 0.6f, h * 1.2f), new Vector3(-ox, h * 0.6f, -oz)));
                        parts.Add(Part(CreateBox(0.16f, 3.2f, 0.16f), new Vector3(0f, h + 1.8f, 0f)));
                        parts.Add(Part(CreateBox(1.3f, 0.9f, 0.06f), new Vector3(0.65f, h + 2.4f, 0f)));
                    }
                    break;

                case BuildingShape.Gate:
                    parts.Add(Part(CreateBox(w, h, d), new Vector3(0f, h * 0.5f, 0f)));
                    parts.Add(Part(CreateBox(w + 0.4f, 0.35f, d + 0.4f), new Vector3(0f, h * 0.62f, 0f)));
                    parts.Add(Part(CreateBox(w * 0.42f, h * 0.66f, d + 0.15f), new Vector3(0f, h * 0.33f, 0f)));
                    break;

                case BuildingShape.Hut:
                    parts.Add(Part(CreateBox(w, h * 0.7f, d), new Vector3(0f, h * 0.35f, 0f)));
                    parts.Add(Part(CreateRoof(w, d, h * 0.45f), new Vector3(0f, h * 0.7f, 0f)));
                    break;

                case BuildingShape.Block:
                    parts.Add(Part(CreateBox(w, h * 0.75f, d), new Vector3(0f, h * 0.375f, 0f)));
                    parts.Add(Part(CreateRoof(w, d, h * 0.32f), new Vector3(0f, h * 0.75f, 0f)));
                    if (def.Id == BuildingId.Barracks || def.Id == BuildingId.ArcheryRange)
                    {
                        parts.Add(Part(CreateCylinder(0.14f, 0.14f, 3.2f), new Vector3(w * 0.3f, h * 0.8f, d * 0.3f)));
                    }
                    break;

                case BuildingShape.Tent:
                    parts.Add(Part(CreatePrism(w, h, d), new Vector3(0f, 0f, 0f)));
                    break;

                case BuildingShape.Field:
                    // Farm: tilled rows, low and wide.
                    for (int r = 0; r < def.Footprint.y; r++)
                    {
                        float z = -d * 0.5f + (r + 0.5f) * (d / def.Footprint.y);
                        parts.Add(Part(CreateBox(w * 0.92f, 0.12f, d / def.Footprint.y * 0.45f),
                                       new Vector3(0f, 0.08f, z)));
                    }
                    break;

                case BuildingShape.Pit:
                    parts.Add(Part(CreateBox(w, 0.3f, d), new Vector3(0f, -0.05f, 0f)));
                    break;

                case BuildingShape.Windmill:
                    parts.Add(Part(CreateCylinder(w * 0.34f, w * 0.42f, h * 0.7f), new Vector3(0f, h * 0.35f, 0f)));
                    parts.Add(Part(CreateRoof(w * 0.8f, d * 0.8f, h * 0.2f), new Vector3(0f, h * 0.72f, 0f)));
                    parts.Add(Part(CreateBox(0.14f, 3.4f, 0.14f), new Vector3(0f, h * 0.65f, d * 0.42f)));
                    parts.Add(Part(CreateBox(3.0f, 0.14f, 0.14f), new Vector3(0f, h * 0.65f, d * 0.42f)));
                    break;

                case BuildingShape.Storage:
                    parts.Add(Part(CreateBox(w, h, d), new Vector3(0f, h * 0.5f, 0f)));
                    // Crates read as "resources live here".
                    parts.Add(Part(CreateBox(0.5f, 0.5f, 0.5f), new Vector3(w * 0.22f, h + 0.25f, d * 0.2f)));
                    parts.Add(Part(CreateBox(0.42f, 0.42f, 0.42f), new Vector3(-w * 0.25f, h + 0.2f, -d * 0.18f)));
                    break;

                case BuildingShape.Well:
                    parts.Add(Part(CreateCylinder(w * 0.35f, w * 0.4f, h * 0.6f), new Vector3(0f, h * 0.3f, 0f)));
                    parts.Add(Part(CreateBox(0.1f, 1.4f, 0.1f), new Vector3(-w * 0.3f, h * 0.6f, 0f)));
                    parts.Add(Part(CreateBox(0.1f, 1.4f, 0.1f), new Vector3(w * 0.3f, h * 0.6f, 0f)));
                    parts.Add(Part(CreateBox(w * 0.8f, 0.1f, 0.4f), new Vector3(0f, h * 0.95f, 0f)));
                    break;

                case BuildingShape.Ranch:
                    parts.Add(Part(CreateBox(w * 0.5f, h * 0.7f, d * 0.6f), new Vector3(-w * 0.2f, h * 0.35f, 0f)));
                    parts.Add(Part(CreateRoof(w * 0.5f, d * 0.6f, h * 0.28f), new Vector3(-w * 0.2f, h * 0.7f, 0f)));
                    for (int i = 0; i < 3; i++)
                    {
                        parts.Add(Part(CreateBox(w * 0.9f, 0.12f, 0.12f),
                                       new Vector3(0f, 0.55f + i * 0.35f, d * 0.42f)));
                    }
                    break;

                default:
                    parts.Add(Part(CreateBox(w, h, d), new Vector3(0f, h * 0.5f, 0f)));
                    break;
            }

            return Combine(parts, "b" + def.Id);
        }

        // =====================================================================
        //  Primitives
        // =====================================================================
        public static Mesh GetBox(float w, float h, float d)
        {
            string key = "box_" + w + "_" + h + "_" + d;
            Mesh cached;
            if (Cache.TryGetValue(key, out cached) && cached != null) return cached;
            var mesh = CreateBox(w, h, d);
            Cache[key] = mesh;
            return mesh;
        }

        public static Mesh GetQuad()
        {
            Mesh cached;
            if (Cache.TryGetValue("quad", out cached) && cached != null) return cached;
            var mesh = new Mesh { name = "quad" };
            mesh.vertices = new[]
            {
                new Vector3(-0.5f, 0f, -0.5f), new Vector3(0.5f, 0f, -0.5f),
                new Vector3(0.5f, 0f, 0.5f), new Vector3(-0.5f, 0f, 0.5f),
            };
            mesh.triangles = new[] { 0, 2, 1, 0, 3, 2 };
            mesh.uv = new[] { new Vector2(0, 0), new Vector2(1, 0), new Vector2(1, 1), new Vector2(0, 1) };
            mesh.RecalculateNormals();
            Cache["quad"] = mesh;
            return mesh;
        }

        static Mesh CreateBox(float w, float h, float d)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var mesh = Object.Instantiate(go.GetComponent<MeshFilter>().sharedMesh);
            Object.DestroyImmediate(go);
            // Cube primitive is 1×1×1 centred at origin.
            var verts = mesh.vertices;
            for (int i = 0; i < verts.Length; i++)
                verts[i] = new Vector3(verts[i].x * w, verts[i].y * h, verts[i].z * d);
            mesh.vertices = verts;
            mesh.name = "box";
            return mesh;
        }

        static Mesh CreateCylinder(float topRadius, float bottomRadius, float height, bool alongZ = false)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            var source = go.GetComponent<MeshFilter>().sharedMesh;
            var mesh = Object.Instantiate(source);
            Object.DestroyImmediate(go);

            var verts = mesh.vertices;
            for (int i = 0; i < verts.Length; i++)
            {
                // Unity's cylinder is 2 units tall with radius 0.5.
                float t = verts[i].y + 0.5f;
                float radius = Mathf.Lerp(bottomRadius, topRadius, t);
                float r = Mathf.Max(0.0001f, new Vector2(verts[i].x, verts[i].z).magnitude * 2f);
                Vector3 v = new Vector3(verts[i].x / r * radius, t * height, verts[i].z / r * radius);
                if (alongZ) v = new Vector3(v.x, v.y, v.z);
                verts[i] = v;
            }
            mesh.vertices = verts;
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            mesh.name = "cylinder";
            return mesh;
        }

        static Mesh CreateSphere(float radius)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            var mesh = Object.Instantiate(go.GetComponent<MeshFilter>().sharedMesh);
            Object.DestroyImmediate(go);
            var verts = mesh.vertices;
            for (int i = 0; i < verts.Length; i++) verts[i] *= radius * 2f;
            mesh.vertices = verts;
            mesh.name = "sphere";
            return mesh;
        }

        static Mesh CreatePrism(float w, float h, float d)
        {
            var mesh = new Mesh { name = "prism" };
            float hw = w * 0.5f, hd = d * 0.5f;
            var verts = new[]
            {
                new Vector3(-hw, 0f, -hd), new Vector3(hw, 0f, -hd),
                new Vector3(hw, 0f, hd), new Vector3(-hw, 0f, hd),
                new Vector3(-hw, h, -hd), new Vector3(hw, h, -hd),
                new Vector3(hw, h, hd), new Vector3(-hw, h, hd),
            };
            mesh.vertices = verts;
            mesh.triangles = new[]
            {
                0, 1, 5, 0, 5, 4,      // front
                1, 2, 6, 1, 6, 5,      // right
                2, 3, 7, 2, 7, 6,      // back
                3, 0, 4, 3, 4, 7,      // left
                4, 5, 6, 4, 6, 7,      // top
                3, 2, 1, 3, 1, 0,      // bottom
            };
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }

        /// <summary>Two-slope roof: two rotated slabs.</summary>
        static Mesh CreateRoof(float w, float d, float h)
        {
            var parts = new List<CombineInstance>(2);
            var left = CreateBox(w * 0.56f, h * 0.18f, d * 1.05f);
            var right = CreateBox(w * 0.56f, h * 0.18f, d * 1.05f);
            parts.Add(Part(left, new Vector3(-w * 0.26f, h * 0.5f, 0f), Quaternion.Euler(0f, 0f, 32f)));
            parts.Add(Part(right, new Vector3(w * 0.26f, h * 0.5f, 0f), Quaternion.Euler(0f, 0f, -32f)));
            return Combine(parts, "roof");
        }

        static CombineInstance Part(Mesh mesh, Vector3 position, Quaternion? rotation = null)
        {
            return new CombineInstance
            {
                mesh = mesh,
                transform = Matrix4x4.TRS(position, rotation ?? Quaternion.identity, Vector3.one),
            };
        }

        static Mesh Combine(List<CombineInstance> parts, string name)
        {
            var arrays = new CombineInstance[parts.Count];
            for (int i = 0; i < parts.Count; i++) arrays[i] = parts[i];
            var mesh = new Mesh { name = name, indexFormat = UnityEngine.Rendering.IndexFormat.UInt16 };
            mesh.CombineMeshes(arrays, true, true);
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            return mesh;
        }
    }
}
