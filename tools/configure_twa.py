#!/usr/bin/env python3
"""Configure the Trusted Web Activity packaging of the browser preview.

The preview build is the whole game running in a browser, so it can be wrapped
into a real, installable Android app (an APK / AAB) with Bubblewrap — no Android
Studio, no Unity, no Gradle knowledge required. This script writes the two files
that wrapping needs:

    android-app/twa/twa-manifest.json   Bubblewrap project description
    android-app/twa/assetlinks.json     Digital Asset Links (removes the URL bar)

Usage:

    python3 tools/configure_twa.py --host s1po0.github.io --path Kurd-dark-
    python3 tools/configure_twa.py --host kurdcastle.example.com --sha256 <fingerprint>

Get the SHA-256 fingerprint after signing (Bubblewrap prints it, or):

    keytool -list -v -keystore android-app/twa/android.keystore -alias android

Then follow android-app/README.md.
"""

import argparse
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "android-app", "twa")

NAME = "Kurd Castle"
LAUNCHER_NAME = "Kurd Castle"
THEME = "#1a1714"
BACKGROUND = "#14100d"
VERSION_NAME = "0.9.0-prototype"
VERSION_CODE = 1


def build_manifest(args, base_url):
    return {
        "packageId": args.app_id,
        "host": args.host,
        "name": NAME,
        "launcherName": LAUNCHER_NAME,
        "display": "fullscreen",
        "orientation": "landscape",
        "themeColor": THEME,
        "themeColorDark": "#000000",
        "navigationColor": THEME,
        "navigationColorDark": "#000000",
        "navigationDividerColor": THEME,
        "navigationDividerColorDark": "#000000",
        "backgroundColor": BACKGROUND,
        "enableNotifications": False,
        "startUrl": base_url + "/",
        "iconUrl": base_url + "/icons/icon-512.png",
        "maskableIconUrl": base_url + "/icons/maskable-512.png",
        "webManifestUrl": base_url + "/manifest.webmanifest",
        "splashScreenFadeOutDuration": 300,
        "appVersionName": VERSION_NAME,
        "appVersionCode": VERSION_CODE,
        "appVersion": VERSION_NAME,
        "shortcuts": [],
        "generatorApp": "kurd-castle-config-twa",
        "generatedBy": "tools/configure_twa.py",
        "webviewFallback": "customtabs",
        # Custom Tabs fallback: if Chrome cannot verify the app against the site
        # (typically a missing assetlinks.json at the domain root) the app opens
        # in a Custom Tab with a thin URL bar instead of failing to launch.
        "fallbackType": "customtabs",
        "features": {
            "playBilling": {"enabled": False},
            "appsFlyer": {"enabled": False},
        },
        "alphaDependencies": {"enabled": False},
        "enableSiteSettingsShortcut": True,
        "isChromeOSOnly": False,
        "isMetaQuest": False,
        "isTrustedWebActivity": True,
        "minSdkVersion": 21,
        "signingKey": {
            "path": "./android.keystore",
            "alias": args.alias,
        },
        "additionalTrustedOrigins": [],
        "retainedBundles": [],
    }


def build_assetlinks(args):
    return [{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
            "namespace": "android_app",
            "package_name": args.app_id,
            "sha256_cert_fingerprints": [
                args.sha256 or "REPLACE_WITH_THE_SHA256_FINGERPRINT_OF_YOUR_SIGNING_KEY"
            ],
        },
    }]


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", required=True,
                        help="hostname that serves the preview, e.g. s1po0.github.io")
    parser.add_argument("--path", default="",
                        help="sub-path the preview is served from, e.g. Kurd-dark- (GitHub Pages)")
    parser.add_argument("--host-origin", default=None,
                        help="full origin to use in URLs (defaults to https://host/path)")
    parser.add_argument("--app-id", default="com.kurdcastle.prototype",
                        help="Android application id (reverse-DNS, must be unique)")
    parser.add_argument("--alias", default="android", help="keystore alias")
    parser.add_argument("--sha256", default=None,
                        help="SHA-256 fingerprint of your signing key (removes the URL bar)")
    args = parser.parse_args()

    path = args.path.strip("/")
    base_url = (args.host_origin or f"https://{args.host}" + (f"/{path}" if path else "")).rstrip("/")

    os.makedirs(OUT_DIR, exist_ok=True)

    manifest_path = os.path.join(OUT_DIR, "twa-manifest.json")
    with open(manifest_path, "w") as fh:
        json.dump(build_manifest(args, base_url), fh, indent=2)
        fh.write("\n")

    links_path = os.path.join(OUT_DIR, "assetlinks.json")
    with open(links_path, "w") as fh:
        json.dump(build_assetlinks(args), fh, indent=2)
        fh.write("\n")

    rel = os.path.relpath
    print(f"wrote {rel(manifest_path, ROOT)}")
    print(f"      host      : {args.host}")
    print(f"      start url : {base_url}/")
    print(f"      app id    : {args.app_id}")
    print(f"wrote {rel(links_path, ROOT)}")

    if not args.sha256:
        print()
        print("assetlinks.json still holds a placeholder fingerprint. After the first")
        print("`bubblewrap build`, run `keytool -list -v -keystore "
              "android-app/twa/android.keystore -alias android`")
        print("and re-run this script with --sha256 <the SHA256 line>.")

    print()
    print("Next:")
    print("  cd android-app/twa && npm install -g @bubblewrap/cli && bubblewrap build")
    print("  → app-release-signed.apk (install on a phone), app-release-bundle.aab (Play Store)")
    print()
    print("Reminder: Digital Asset Links only work when assetlinks.json is served from")
    print(f"https://{args.host}/.well-known/assetlinks.json — the *domain root*. A project")
    print("GitHub Pages site cannot host that path, so use a custom domain, a root site,")
    print("or a static host you control. Without it the app still installs and plays, it")
    print("just shows a thin URL bar (the customtabs fallback above).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
