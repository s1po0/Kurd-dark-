#!/usr/bin/env python3
"""Static checks for the Android shell (android-app/webview).

There is no Android SDK in this environment, so the shell is verified the only
way it can be verified here: every file Gradle will need must exist, the XML
must parse, and the Java entry point must reference the assets it claims to
serve. Run from anywhere:

    python3 tools/check_android_shell.py
"""

import os
import re
import sys
import xml.dom.minidom

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHELL = os.path.join(ROOT, "android-app", "webview")
PREVIEW = os.path.join(ROOT, "preview")

ERRORS = []
NOTES = []


def err(msg):
    ERRORS.append(msg)


def check_layout():
    required = [
        "settings.gradle",
        "build.gradle",
        "gradle.properties",
        "app/build.gradle",
        "app/src/main/AndroidManifest.xml",
        "app/src/main/java/com/kurdcastle/prototype/MainActivity.java",
        "app/src/main/res/values/strings.xml",
        "app/src/main/res/values/themes.xml",
        "app/src/main/res/values/colors.xml",
    ]
    for rel in required:
        if not os.path.exists(os.path.join(SHELL, rel)):
            err(f"missing {rel}")

    for density in ("mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"):
        for name in ("ic_launcher.png", "ic_launcher_round.png"):
            path = os.path.join(SHELL, "app/src/main/res", f"mipmap-{density}", name)
            if not os.path.exists(path):
                err(f"missing launcher icon {density}/{name} (run tools/make_icons.py)")

    if not os.path.isdir(os.path.join(PREVIEW, "src")):
        err("preview/src is missing — there would be nothing to bundle")

    NOTES.append(f"shell layout OK ({len(required)} files + 10 launcher icons)")


def check_gradle():
    settings = open(os.path.join(SHELL, "settings.gradle")).read()
    if "include ':app'" not in settings:
        err("settings.gradle does not include the :app module")

    app = open(os.path.join(SHELL, "app/build.gradle")).read()

    for needle, why in (
        ("com.android.application", "the Android application plugin"),
        ("namespace 'com.kurdcastle.prototype'", "the namespace"),
        ("applicationId 'com.kurdcastle.prototype'", "the application id"),
        ("minSdk 24", "min SDK"),
        ("compileSdk 34", "compile SDK"),
        ("androidx.webkit:webkit", "the WebViewAssetLoader dependency"),
        ("syncWebAssets", "the task that bundles preview/ into the APK"),
    ):
        if needle not in app:
            err(f"app/build.gradle is missing {why} ({needle!r})")

    if "rootProject.file('../../preview')" not in app:
        err("the bundling task does not point at preview/")

    if "exclude 'test/**'" not in app:
        err("the headless test suite would be bundled into the APK")

    # The bundling task must actually run before assets are merged, without
    # relying on task names that may not exist yet at configuration time.
    if "dependsOn syncWebAssets" not in app:
        err("nothing makes the bundling task run during a build")
    if "tasks.named('preBuild')" in app or 'tasks.named("preBuild")' in app:
        err("tasks.named('preBuild') fails when the plugin has not registered it; "
            "use tasks.matching { ... }.configureEach")

    # addGeneratedSourceDirectory expects a DirectoryProperty, which a plain Copy
    # task does not expose — that wiring failed the first CI run.
    if "addGeneratedSourceDirectory" in app:
        err("addGeneratedSourceDirectory is wired to a Copy task, which has no "
            "DirectoryProperty output; copy into src/main/assets instead")

    # Assets must land in the module's own source dir, or AGP never sees them.
    # Check the *definition* of the destination, not a mention in a comment.
    dest = re.search(r"def\s+webAssetsDir\s*=\s*file\(\s*[\"']([^\"']+)[\"']\s*\)", app)
    if not dest:
        err("app/build.gradle does not define where the web assets are copied to")
    elif "src/main/assets" not in dest.group(1):
        err(f"web assets are copied to {dest.group(1)}, outside app/src/main/assets, "
            "so the Android plugin never packages them")
    if not re.search(r"into\s+webAssetsDir", app):
        err("the bundling task does not copy into the assets directory it defines")

    NOTES.append("gradle config OK (assets bundled from preview/ before merge)")


def check_manifest():
    path = os.path.join(SHELL, "app/src/main/AndroidManifest.xml")
    try:
        doc = xml.dom.minidom.parse(path)
    except Exception as exc:
        return err(f"AndroidManifest.xml does not parse: {exc}")

    manifest = doc.documentElement
    if manifest.getAttribute("package"):
        err("manifest still declares package=; use namespace in build.gradle")

    # No permissions at all is a feature here: the game is fully offline.
    perms = [n.getAttribute("android:name") for n in doc.getElementsByTagName("uses-permission")]
    if perms:
        err(f"the app declares permissions it does not need: {perms}")

    activities = doc.getElementsByTagName("activity")
    if not activities:
        return err("no <activity> in the manifest")

    main = None
    for activity in activities:
        filters = activity.getElementsByTagName("intent-filter")
        for f in filters:
            actions = [a.getAttribute("android:name") for a in f.getElementsByTagName("action")]
            if "android.intent.action.MAIN" in actions:
                main = activity
    if main is None:
        return err("no activity handles android.intent.action.MAIN")

    if main.getAttribute("android:exported") != "true":
        err("the launcher activity must be android:exported=\"true\"")
    if "Landscape" not in main.getAttribute("android:screenOrientation"):
        err("the launcher activity is not locked to landscape")
    if "orientation" not in main.getAttribute("android:configChanges"):
        err("configChanges should include orientation so the WebView is not recreated")

    if doc.getElementsByTagName("uses-sdk"):
        err("uses-sdk belongs in build.gradle, not the manifest")

    NOTES.append("AndroidManifest OK (launcher activity, landscape, zero permissions)")


def check_activity():
    path = os.path.join(SHELL, "app/src/main/java/com/kurdcastle/prototype/MainActivity.java")
    text = open(path).read()

    if not re.search(r"package\s+com\.kurdcastle\.prototype\s*;", text):
        err("MainActivity.java package does not match the namespace in build.gradle")

    for needle, why in (
        ("WebViewAssetLoader", "the asset loader (file:// blocks ES modules)"),
        ("setDomain(", "the synthetic origin"),
        ('addPathHandler("/assets/"', "the /assets/ path handler"),
        ("AssetsPathHandler", "the handler that serves the bundled files"),
        ("setJavaScriptEnabled(true)", "JavaScript"),
        ("FLAG_KEEP_SCREEN_ON", "keeping the screen awake during a siege"),
        ("onBackPressed", "the back gesture that pauses the match"),
        ("window.kurdCastle", "the hook the pause-on-back uses"),
    ):
        if needle not in text:
            err(f"MainActivity is missing {why} ({needle!r})")

    if "setAllowFileAccess(true)" in text:
        err("file access should stay disabled: assets are served over the local origin")

    # The loader must serve from the host the start URL uses, or the game 404s.
    # Both may be written literally or through the LOCAL_HOST constant.
    host = re.search(r'LOCAL_HOST\s*=\s*"([^"]+)"', text)
    domain = re.search(r'setDomain\(([^)]+)\)', text)
    if not host:
        err("MainActivity does not declare the local host")
    elif not domain:
        err("MainActivity does not configure WebViewAssetLoader with a domain")
    else:
        domain_arg = domain.group(1).strip()
        resolved = host.group(1) if domain_arg == "LOCAL_HOST" else domain_arg.strip('"')
        if resolved != host.group(1):
            err(f"asset loader domain {resolved} does not match host {host.group(1)}")

    # Start URL: either a literal path or built from LOCAL_HOST.
    start = re.search(r'START_URL\s*=\s*(.+)', text)
    if not start:
        err("MainActivity does not declare a start URL")
    else:
        line = start.group(1)
        literal = re.search(r'"(https?://[^"]+)"', line)
        if literal:
            rel = literal.group(1).split("/", 3)[-1]
        elif "LOCAL_HOST" in line:
            rel = re.search(r'"/([^"]+)"', line).group(1).replace("assets/", "", 1)
        else:
            rel = None
        if not rel:
            err("cannot work out the start URL from MainActivity")
        elif not os.path.exists(os.path.join(PREVIEW, rel)):
            err(f"the start URL points at {rel}, which is not in preview/")
        else:
            NOTES.append(f"start URL resolves to preview/{rel}")
        if "assets/" not in line:
            err("the start URL should go through the /assets/ handler the loader installs")

    NOTES.append("MainActivity OK (local https origin, landscape, pause-on-back)")


def main():
    for check in (check_layout, check_gradle, check_manifest, check_activity):
        check()

    for note in NOTES:
        print("  " + note)
    for problem in ERRORS:
        print("ERROR " + problem)
    print(f"{len(ERRORS)} error(s)")
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
