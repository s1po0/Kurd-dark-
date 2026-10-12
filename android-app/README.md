# Android packaging

This folder turns the game into an **installable Android app**. There are three
routes; pick by what you have on the machine.

| Route | Output | Needs | Time |
| --- | --- | --- | --- |
| **A. Let GitHub build it** (`.github/workflows/android-apk.yml`) | installable `.apk` (and a Play-Store `.aab` later) | nothing but a push | ~5 min, unattended |
| **B. WebView shell locally** (`android-app/webview/`) | `.apk` / `.aab`, self-contained and offline | JDK 17 + Android SDK or Android Studio | ~10 min |
| **C. Trusted Web Activity** (`android-app/twa/`) | `.apk` / `.aab` around the *hosted* build | Node, JDK 17, Android SDK, a public URL | ~15 min |
| **D. Unity player** (`unity/KurdCastle/`) | native `.apk` / `.aab` from the C# project | Unity 6 with Android Build Support | ~40 min |
| **E. Installable PWA** (`preview/`) | app on the home screen, offline, no store | a phone + the published URL | 2 min |

**Route A is the zero-setup one**: push, then download the APK from the run's
*Artifacts*, or push a `v*` tag and it is attached to a GitHub Release. Route B is
the same app built on your own machine. Route C wraps the hosted build instead of
bundling it. Route D is the shipping build of the native game and is documented
step by step in the [root README](../README.md#building-the-android-apk--step-by-step).
Route E costs nothing and needs no store review.

---

## A. Let GitHub build the APK (no toolchain at all)

```bash
git push                       # touching android-app/ or preview/
```

`.github/workflows/android-apk.yml` runs on GitHub's runners, which already carry
a JDK and the Android SDK:

1. runs `python3 tools/check_android_shell.py` — the shell configuration is
   checked before anything is compiled;
2. `gradle :app:assembleDebug` and `:app:assembleRelease`;
3. **verifies the APK really contains the game** (`unzip -l` for
   `assets/index.html`, `assets/src/main.js`, `assets/icons/…`, `classes.dex`) and
   fails the job if the shell is empty;
4. uploads `KurdCastle-0.9.0-debug.apk`, `KurdCastle-0.9.0-release.apk` and
   `SHA256SUMS.txt` as the artifact **`kurd-castle-apk`**.

Download it from **Actions ▸ Build Android APK ▸ (latest run) ▸ Artifacts**. To
publish a release instead, tag it:

```bash
git tag v0.9.0-prototype && git push origin v0.9.0-prototype
# → a GitHub Release with both APKs attached, so anyone can install from the repo page
```

Then install on a phone:

```bash
adb install -r KurdCastle-0.9.0-debug.apk
# or copy the file to the device and tap it (allow "install unknown apps")
```

The release APK is signed with a throwaway debug key so it is installable as-is;
re-sign it with your own keystore (C4 below) before distributing it.

---

## B. WebView shell built on your own machine

`android-app/webview/` is a one-module Gradle project — a single full-screen
`WebView` plus the game assets. It is **self-contained and offline**: the game is
bundled into the APK at build time from `preview/`, served over an internal
`https://kurdcastle.local/assets/` origin (ES modules are blocked on `file://`),
and the app declares **no permissions at all** — not even `INTERNET`.

```bash
cd android-app/webview
echo "sdk.dir=$ANDROID_HOME" > local.properties      # or open the folder in Android Studio

gradle :app:assembleDebug        # → app/build/outputs/apk/debug/app-debug.apk
gradle :app:assembleRelease      # → app/build/outputs/apk/release/app-release.apk
gradle :app:bundleRelease        # → app/build/outputs/bundle/release/app-release.aab
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`syncWebAssets` copies `preview/` into `app/src/main/assets/` before assets are
merged (excluding the headless suite and markdown), so there is exactly one copy
of the game in the repository — edit `preview/src/*.js`, rebuild, ship.

Keystore, one-time:

```bash
keytool -genkeypair -v -keystore kurdcastle.keystore -alias kurdcastle \
        -keyalg RSA -keysize 2048 -validity 10000
```

Then add a `signingConfigs.release` block in `app/build.gradle` and point
`buildTypes.release.signingConfig` at it (the file ships pointing at the debug key
so CI produces something installable without secrets). Never commit the keystore.

Tuning: `applicationId`, `versionCode`, `versionName` and `minSdk` all live in
`app/build.gradle`; the launcher icons come from `tools/make_icons.py`.

---

## C. Trusted Web Activity (wrapping the *hosted* build)

A TWA is a thin, verified Chrome shell around the playable preview. To Google
Play it is an ordinary app; to you it is a URL. Everything below happens in
`android-app/twa/` except the two one-time prerequisites.

### C0. One-time prerequisites

```bash
# Node 18+ (you have it if `node -v` works), then Bubblewrap:
npm install -g @bubblewrap/cli

# JDK 17 and the Android SDK: Bubblewrap downloads and manages both itself.
bubblewrap doctor        # checks/installs the toolchain, follow its prompts
```

If you prefer not to install globally, `npx @bubblewrap/cli <command>` works
everywhere below.

### C1. Publish the preview (one-time, gives you the URL the app loads)

The wrapper needs an HTTPS URL. `.github/workflows/pages.yml` publishes
`preview/` to GitHub Pages and runs the headless test suite before it does:

1. Push the repository (the workflow runs on `main`, or trigger it by hand from
   the *Actions* tab → *Publish playable preview* → *Run workflow*).
2. Repository **Settings ▸ Pages ▸ Build and deployment ▸ Source: GitHub Actions**.
3. After the first successful run your game is live at
   `https://<owner>.github.io/<repo>/` — open it on a phone and play it.

Already have hosting? Any static host works; you only need the URL in the next
step.

### C2. Configure and build

```bash
cd android-app/twa
python3 ../../tools/configure_twa.py --host <owner>.github.io --path <repo>

bubblewrap init --manifest https://<owner>.github.io/<repo>/manifest.webmanifest
bubblewrap build
```

`bubblewrap init` asks a handful of questions; the answers that matter:

| Prompt | Answer |
| --- | --- |
| Application name / short name | Kurd Castle |
| Application ID | `com.kurdcastle.prototype` (must be unique on Play; change it before you ship) |
| Display mode | `fullscreen` (the manifest already asks for it) |
| Orientation | `landscape` |
| Signing key | let it **create a new one** → `android.keystore` in this folder |
| Key alias / passwords | choose your own and **write them down**; losing this key means you can never update the app |

`bubblewrap build` writes two files here:

* `app-release-signed.apk` — install on a phone: `adb install -r app-release-signed.apk`
* `app-release-bundle.aab` — the only format Google Play accepts

> A keystore is the identity of the app: never commit `android.keystore` or its
> passwords (`.gitignore` already excludes `*.keystore`).

### C3. Remove the URL bar (Digital Asset Links)

A TWA shows a thin address bar until the site and the app are verified against
each other, which is what `assetlinks.json` is for:

1. Connect the site root to the app by publishing
   `https://<host>/.well-known/assetlinks.json` (the file this folder contains).
2. Put your signing key's fingerprint in it:

   ```bash
   keytool -list -v -keystore android.keystore -alias android | grep SHA256
   python3 ../../tools/configure_twa.py --host <owner>.github.io --path <repo> \
           --sha256 "AA:BB:CC:..."
   ```

3. Publish the file and rebuild.

**Where this gets tricky:** `.well-known/assetlinks.json` must be served from
the **domain root**. A project GitHub Pages site (`<owner>.github.io/<repo>/`)
cannot host a root path. Your options, in order of least hassle:

* point the app at a **custom domain** whose root you control (then the file
  lives at `https://kurdcastle.example.com/.well-known/assetlinks.json`), or
* publish the preview as the **root** Pages site (`<owner>.github.io`, i.e. a
  repository literally named `<owner>.github.io`) and put `assetlinks.json`
  inside `preview/.well-known/`, or
* accept the URL bar: the app still installs, plays, and is otherwise
  indistinguishable — the manifest's `customtabs` fallback is what keeps it
  from failing outright.

### C4. Ship it to Play (optional)

1. Play Console ▸ *Create app* ▸ upload `app-release-bundle.aab` to a testing track.
2. Fill the listing — store icon `android-app/twa/icon.png` (512×512), feature
   graphic `android-app/twa/feature-graphic.png` (1024×500), at least two phone
   screenshots, short and full description, privacy policy URL (the game
   collects nothing — say so).
3. Complete *Data safety*, *Content rating* (the game contains cartoon combat),
   and the *Ads* declaration.
4. New **personal** developer accounts must run a closed test with at least 12
   testers for 14 days before production access is granted. Organisation
   accounts skip this.
5. Play requires a `targetSdkVersion` no more than one release behind the newest
   Android. Bubblewrap's default tracks its own release; if the upload is
   rejected, raise `targetSdkVersion` in `twa-manifest.json` and rebuild.

### C5. Updating the app later

The layout is unchanged if you only touch the game: push to `main`, let Pages
republish, and the installed app shows the new build the next time it starts —
no store submission, no rebuild. Re-run `bubblewrap build` only when you change
the icon, name, orientation, package id or URL (and bump `appVersionCode` in
`twa-manifest.json` before each store upload).

---

## D. Native Unity APK/AAB

This is the real thing — the C# project compiled with IL2CPP for ARM64. It
requires Unity with the Android module, so it cannot be produced from a shell
without Unity installed. Full walkthrough, including the in-editor build menu
(`Kurd Castle ▸ 3. Build Debug APK`), IL2CPP settings, keystore setup and
command-line CI entry points: [root README, step 2 onward](../README.md#building-the-android-apk--step-by-step).

Quick version:

```bash
Unity -batchmode -quit -nographics -projectPath unity/KurdCastle \
      -executeMethod KurdCastle.EditorTools.KurdCastleBuilder.BuildAndroidDebugFromCommandLine \
      -logFile -
# → unity/KurdCastle/Builds/Android/KurdCastle-debug.apk
```

---

## E. Installable PWA (no store)

1. Open the published URL in Chrome on Android.
2. Menu ▸ *Add to Home screen* / *Install app*, or tap the in-game **Install**
   pill that `pwa.js` shows when the browser offers a prompt.
3. It launches full-screen, landscape, with its own icon, and works offline —
   `sw.js` precaches the app shell, and the whole game is a few kilobytes of
   text.

---

## What is in this folder

| Path | Purpose |
| --- | --- |
| `webview/` | Gradle project for the self-contained Android app (WebView shell + bundled game) |
| `webview/app/src/main/java/.../MainActivity.java` | The activity: local https origin, immersive full screen, pause-on-back |
| `webview/app/build.gradle` | `syncWebAssets` (bundles `preview/` into the APK), SDK levels, signing |
| `twa/twa-manifest.json` | Bubblewrap project description (package id, start URL, icons, signing key) |
| `twa/assetlinks.json` | Digital Asset Links template that removes the TWA URL bar |
| `twa/icon.png` | 512×512 store icon |
| `twa/feature-graphic.png` | 1024×500 Play Store feature graphic |
| `../preview/manifest.webmanifest` | Web App Manifest the TWA and the PWA both read |
| `../preview/sw.js` | Service worker: offline play |
| `../preview/pwa.js` | Service-worker registration + install prompt |
| `../preview/icons/` | Generated launcher icons (any + maskable + Apple touch) |
| `../tools/make_icons.py` | Regenerates every icon and the feature graphic from code |
| `../tools/configure_twa.py` | Writes the two files above for your host |
| `../.github/workflows/pages.yml` | Publishes `preview/` and runs the test suite first |
| `../.github/workflows/android-apk.yml` | Builds, verifies and uploads the APK on every push |
| `../tools/check_android_shell.py` | Checks the shell config without an Android SDK |

Regenerate the artwork after palette changes:

```bash
python3 -m pip install pillow
python3 tools/make_icons.py
```

> Note: this folder contains configuration and shell sources only. No compiled
> `.apk` or `.aab` is committed — the CI workflow produces them, or you build one
> locally. (Route A means you can have a working APK in hand without installing
> anything.) No APK or AAB is committed —
> builds are produced on the machine that holds the signing key, and binaries do
> not belong in a text repository. If you need a **prebuilt APK right now** and
> have no toolchain at all, Route A is the way: the toolchain installs itself
> through `bubblewrap doctor`.
