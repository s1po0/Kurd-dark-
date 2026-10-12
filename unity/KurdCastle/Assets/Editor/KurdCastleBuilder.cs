// -----------------------------------------------------------------------------
//  File: Editor/KurdCastleBuilder.cs
//  Purpose: One-click Android packaging. Everything the game needs is generated
//           from code, so this script does not depend on prefabs, art import
//           settings or scene assets — it just configures player settings (once)
//           and hands off to Unity's build pipeline.
//
//  Menu items
//      Kurd Castle ▸ 1. Apply Android Project Settings
//      Kurd Castle ▸ 2. Create Empty Boot Scene
//      Kurd Castle ▸ 3. Build Debug APK
//      Kurd Castle ▸ 4. Build Release AAB (Play Store)
//
//  Command line (batch mode) is documented in the repository README.
// -----------------------------------------------------------------------------
#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEngine;
using KurdCastle.Config;

namespace KurdCastle.EditorTools
{
    public static class KurdCastleBuilder
    {
        const string SceneFolder = "Assets/Scenes";
        const string ScenePath = SceneFolder + "/Main.unity";
        const string DebugApkPath = "Builds/Android/KurdCastle-debug.apk";
        const string ReleaseAabPath = "Builds/Android/KurdCastle-release.aab";
        const string ReleaseApkPath = "Builds/Android/KurdCastle-release.apk";

        [MenuItem("Kurd Castle/1. Apply Android Project Settings")]
        public static void ApplyAndroidSettings()
        {
            PlayerSettings.companyName = "Kurd Castle Prototype";
            PlayerSettings.productName = Balance.GameName;
            PlayerSettings.bundleVersion = Balance.Version;
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.kurdcastle.prototype");
            PlayerSettings.Android.bundleVersionCode = 1;

            // Landscape-only, GLES3 with a GLES2 fallback: the meshes are procedural
            // and vertex-light, so even old Adreno/Mali parts cope comfortably.
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.LandscapeLeft;
            PlayerSettings.Android.minSdkVersion = AndroidSdkVersions.AndroidApiLevel24;
            PlayerSettings.Android.targetSdkVersion = AndroidSdkVersions.AndroidApiLevelAuto;

            PlayerSettings.SetScriptingBackend(BuildTargetGroup.Android, ScriptingImplementation.IL2CPP);
            PlayerSettings.Android.targetArchitectures = AndroidArchitecture.ARM64 | AndroidArchitecture.ARMv7;
            PlayerSettings.SetApiCompatibilityLevel(BuildTargetGroup.Android, ApiCompatibilityLevel.NET_Standard_2_0);

            PlayerSettings.Android.forceInternetPermission = false;
            PlayerSettings.Android.forceSDCardPermission = false;
            PlayerSettings.bakeCollisionMeshes = false;
            PlayerSettings.stripEngineCode = true;
            PlayerSettings.SetManagedStrippingLevel(BuildTargetGroup.Android, ManagedStrippingLevel.Medium);

            Debug.Log("[KurdCastleBuilder] Android player settings applied.");
        }

        [MenuItem("Kurd Castle/2. Create Empty Boot Scene")]
        public static void CreateBootScene()
        {
            if (!Directory.Exists(SceneFolder)) Directory.CreateDirectory(SceneFolder);

            var scene = UnityEditor.SceneManagement.EditorSceneManager.NewScene(
                UnityEditor.SceneManagement.NewSceneSetup.EmptyScene,
                UnityEditor.SceneManagement.NewSceneMode.Single);
            UnityEditor.SceneManagement.EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            Debug.Log("[KurdCastleBuilder] Boot scene created at " + ScenePath +
                      ". GameBootstrap builds the entire world at runtime.");
        }

        [MenuItem("Kurd Castle/3. Build Debug APK")]
        public static void BuildDebugApk()
        {
            Prepare();
            var options = new BuildPlayerOptions
            {
                scenes = { ScenePath },
                locationPathName = DebugApkPath,
                target = BuildTarget.Android,
                options = BuildOptions.Development | BuildOptions.ConnectWithProfiler,
            };
            Run(options);
        }

        [MenuItem("Kurd Castle/4. Build Release APK")]
        public static void BuildReleaseApk()
        {
            Prepare();
            var options = new BuildPlayerOptions
            {
                scenes = { ScenePath },
                locationPathName = ReleaseApkPath,
                target = BuildTarget.Android,
                options = BuildOptions.None,
            };
            Run(options);
        }

        [MenuItem("Kurd Castle/5. Build Release AAB (Play Store)")]
        public static void BuildReleaseAab()
        {
            Prepare();
            EditorUserBuildSettings.buildAppBundle = true;
            var options = new BuildPlayerOptions
            {
                scenes = { ScenePath },
                locationPathName = ReleaseAabPath,
                target = BuildTarget.Android,
                options = BuildOptions.None,
            };
            Run(options);
        }

        static void Prepare()
        {
            ApplyAndroidSettings();
            if (!File.Exists(ScenePath)) CreateBootScene();
            Directory.CreateDirectory("Builds/Android");
        }

        static void Run(BuildPlayerOptions options)
        {
            var report = BuildPipeline.BuildPlayer(options);
            var summary = report.summary;
            if (summary.result == BuildResult.Succeeded)
            {
                Debug.Log("[KurdCastleBuilder] Build succeeded: " + summary.outputPath +
                          " (" + (summary.totalSize / 1024 / 1024) + " MB)");
            }
            else
            {
                Debug.LogError("[KurdCastleBuilder] Build failed: " + summary.result);
                if (Application.isBatchMode) EditorApplication.Exit(1);
            }
        }

        // ------------------------------------------------------------------
        //  Batch-mode entry points (see README for the full command lines)
        // ------------------------------------------------------------------
        public static void BuildAndroidDebugFromCommandLine() { BuildDebugApk(); }
        public static void BuildAndroidReleaseFromCommandLine() { BuildReleaseAab(); }

        /// <summary>Release APK (side-load / direct distribution) for pipelines.</summary>
        public static void BuildAndroidReleaseApkFromCommandLine() { BuildReleaseApk(); }
        public static void ApplySettingsFromCommandLine() { ApplyAndroidSettings(); }
    }
}
#endif
