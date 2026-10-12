// Pure patch functions for the generated Capacitor Android project.
// Each takes the current file text and returns the patched text. They are
// idempotent (running twice changes nothing more) and throw a PatchError with
// a clear message when an anchor line is missing, so a Capacitor upgrade fails
// loudly instead of shipping an unpatched APK.

export class PatchError extends Error {
  constructor(file, message) {
    super(`[prepare-android] ${file}: ${message}`);
    this.name = 'PatchError';
  }
}

const MIN_SDK = 26;

function requireMatch(text, pattern, file, what) {
  const m = text.match(pattern);
  if (!m) throw new PatchError(file, `expected ${what}, but it was not found`);
  return m;
}

/**
 * AndroidManifest.xml
 * - main activity locked to sensor landscape
 * - application hardware accelerated
 * - INTERNET permission removed (the game is offline; the WebView serves the
 *   bundle from the app itself)
 */
export function patchManifest(xml) {
  const file = 'AndroidManifest.xml';
  let out = xml;

  // Activity: add screenOrientation right after its launchMode (or name) attr.
  if (!/android:screenOrientation=/.test(out)) {
    const act = requireMatch(out, /<activity\b[^>]*android:name="\.MainActivity"[^>]*>/, file, 'the .MainActivity <activity> element');
    const tag = act[0];
    const patched = tag.replace(/(\s*)>$/, '\n            android:screenOrientation="sensorLandscape"$1>');
    out = out.replace(tag, patched);
  }

  // Application: hardwareAccelerated.
  if (!/android:hardwareAccelerated=/.test(out)) {
    const app = requireMatch(out, /<application\b[^>]*>/, file, 'an <application> element');
    const tag = app[0];
    const patched = tag.replace(/(\s*)>$/, '\n        android:hardwareAccelerated="true"$1>');
    out = out.replace(tag, patched);
  }

  // Offline game: drop the INTERNET permission the template adds.
  out = out.replace(/\n?[ \t]*<uses-permission android:name="android\.permission\.INTERNET"\s*\/>/g, '');

  return out;
}

/**
 * MainActivity.java: hide the system bars whenever the window gains focus,
 * using sticky immersive mode through WindowInsetsControllerCompat. The file
 * is rewritten from its package line, so it must still be the default
 * Capacitor template ("extends BridgeActivity {}").
 */
export function patchMainActivity(java) {
  const file = 'MainActivity.java';
  if (/hideSystemBars\(\)/.test(java)) return java;

  const pkg = requireMatch(java, /^package\s+([\w.]+);/m, file, 'a package declaration')[1];
  requireMatch(java, /public class MainActivity extends BridgeActivity\s*\{\s*\}/, file, 'the default "MainActivity extends BridgeActivity {}" class body');

  return `package ${pkg};

import android.os.Bundle;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    /** Immersive sticky mode: bars hide and reappear briefly on a swipe. */
    private void hideSystemBars() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        WindowInsetsControllerCompat controller =
                new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }
}
`;
}

/**
 * styles.xml: let the window draw into display cutouts (notches) on both the
 * app theme and the splash theme.
 */
export function patchStyles(xml) {
  const file = 'values/styles.xml';
  const cutout = '<item name="android:windowLayoutInDisplayCutoutMode">shortEdges</item>';
  if (xml.includes('windowLayoutInDisplayCutoutMode')) return xml;

  const styleOpen = /<style name="(AppTheme(?:\.NoActionBar|\.NoActionBarLaunch)?)"[^>]*>/g;
  let found = 0;
  const out = xml.replace(styleOpen, (m) => {
    found += 1;
    return `${m}\n        ${cutout}`;
  });
  if (found === 0) throw new PatchError(file, 'expected an AppTheme style, but none was found');
  return out;
}

/** variables.gradle: minSdkVersion at least 26 (Android 8.0). */
export function patchVariables(gradle) {
  const file = 'variables.gradle';
  const m = requireMatch(gradle, /minSdkVersion\s*=\s*(\d+)/, file, 'minSdkVersion');
  const current = Number(m[1]);
  if (current >= MIN_SDK) return gradle;
  return gradle.replace(m[0], `minSdkVersion = ${MIN_SDK}`);
}

/**
 * app/build.gradle: versionCode and versionName. versionCode comes from the CI
 * run number so every build installs over the last one.
 */
export function patchAppBuild(gradle, { versionCode, versionName }) {
  const file = 'app/build.gradle';
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new PatchError(file, `versionCode must be a positive integer, got ${versionCode}`);
  }
  if (!/^[\w.\-+]+$/.test(versionName)) {
    throw new PatchError(file, `versionName has unsafe characters: ${versionName}`);
  }
  requireMatch(gradle, /versionCode\s+\d+/, file, 'a versionCode line');
  requireMatch(gradle, /versionName\s+"[^"]*"/, file, 'a versionName line');
  return gradle
    .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
    .replace(/versionName\s+"[^"]*"/, `versionName "${versionName}"`);
}

/**
 * app/build.gradle: a release signing config read from environment variables.
 * When EMBERHOLD_KEYSTORE is unset the build falls back to the debug key, so
 * local and first-time runs still produce an APK.
 */
export function patchSigning(gradle) {
  const file = 'app/build.gradle';
  if (/signingConfigs\s*\{/.test(gradle)) return gradle;

  const signingBlock = `    signingConfigs {
        release {
            if (System.getenv("EMBERHOLD_KEYSTORE")) {
                storeFile file(System.getenv("EMBERHOLD_KEYSTORE"))
                storePassword System.getenv("EMBERHOLD_KEYSTORE_PASSWORD")
                keyAlias System.getenv("EMBERHOLD_KEY_ALIAS")
                keyPassword System.getenv("EMBERHOLD_KEY_PASSWORD")
            }
        }
    }
`;
  // Insert before buildTypes inside the android block.
  const bt = requireMatch(gradle, /\n(\s*)buildTypes\s*\{/, file, 'a buildTypes block');
  let out = gradle.replace(bt[0], `\n${signingBlock}${bt[1]}buildTypes {`);

  // Only the release build type takes the release config when the keystore is set.
  const release = requireMatch(out, /buildTypes\s*\{\s*release\s*\{/, file, 'a buildTypes { release { block');
  out = out.replace(
    release[0],
    `${release[0]}\n            signingConfig System.getenv("EMBERHOLD_KEYSTORE") ? signingConfigs.release : signingConfigs.debug`,
  );
  return out;
}

export const PATCH_CONSTANTS = { MIN_SDK };
