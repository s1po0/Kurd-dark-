import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// The patch functions are plain .mjs with no dependencies, so tests import them directly.
import {
  PatchError,
  patchAppBuild,
  patchMainActivity,
  patchManifest,
  patchSigning,
  patchStyles,
  patchVariables,
} from '../scripts/lib/patches.mjs';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, 'fixtures', 'capacitor-android', name), 'utf8');

describe('AndroidManifest.xml patch', () => {
  const once = patchManifest(fixture('AndroidManifest.xml'));

  it('locks the main activity to sensor landscape', () => {
    expect(once).toMatch(/android:name="\.MainActivity"[\s\S]*?android:screenOrientation="sensorLandscape"/);
  });

  it('makes the application hardware accelerated', () => {
    expect(once).toMatch(/<application[\s\S]*?android:hardwareAccelerated="true"/);
  });

  it('removes the INTERNET permission (the game is offline)', () => {
    expect(once).not.toContain('android.permission.INTERNET');
  });

  it('is idempotent', () => {
    expect(patchManifest(once)).toBe(once);
  });

  it('fails clearly when the activity is missing', () => {
    expect(() => patchManifest('<manifest><application></application></manifest>')).toThrow(PatchError);
  });
});

describe('MainActivity.java patch', () => {
  const once = patchMainActivity(fixture('MainActivity.java'));

  it('keeps the package and adds immersive sticky mode on focus', () => {
    expect(once).toContain('package com.emberhold.game;');
    expect(once).toContain('public class MainActivity extends BridgeActivity');
    expect(once).toContain('onWindowFocusChanged(boolean hasFocus)');
    expect(once).toContain('hideSystemBars()');
    expect(once).toContain('WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE');
    expect(once).toContain('controller.hide(WindowInsetsCompat.Type.systemBars());');
  });

  it('is idempotent', () => {
    expect(patchMainActivity(once)).toBe(once);
  });

  it('refuses a customised activity it does not recognise', () => {
    const custom = 'package a.b;\npublic class MainActivity extends BridgeActivity { void x() {} }';
    expect(() => patchMainActivity(custom)).toThrow(/default "MainActivity extends BridgeActivity/);
  });
});

describe('styles.xml patch', () => {
  const once = patchStyles(fixture('styles.xml'));

  it('allows drawing into display cutouts on the app themes', () => {
    const count = (once.match(/windowLayoutInDisplayCutoutMode/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(once).toContain('shortEdges');
  });

  it('is idempotent', () => {
    expect(patchStyles(once)).toBe(once);
  });

  it('fails when no app theme exists', () => {
    expect(() => patchStyles('<resources></resources>')).toThrow(PatchError);
  });
});

describe('variables.gradle patch', () => {
  it('raises minSdkVersion to 26 when it is lower', () => {
    const patched = patchVariables(fixture('variables.gradle'));
    expect(patched).toMatch(/minSdkVersion = 26\b/);
  });

  it('leaves a higher minSdkVersion alone', () => {
    const higher = 'ext {\n    minSdkVersion = 28\n}';
    expect(patchVariables(higher)).toBe(higher);
  });

  it('fails when the line is missing', () => {
    expect(() => patchVariables('ext { }')).toThrow(/minSdkVersion/);
  });
});

describe('app/build.gradle version patch', () => {
  it('writes versionCode and versionName from the inputs', () => {
    const patched = patchAppBuild(fixture('app-build.gradle'), { versionCode: 42, versionName: '0.1.0' });
    expect(patched).toMatch(/versionCode 42\b/);
    expect(patched).toMatch(/versionName "0\.1\.0"/);
  });

  it('rejects a non-positive versionCode', () => {
    expect(() => patchAppBuild(fixture('app-build.gradle'), { versionCode: 0, versionName: '1.0' })).toThrow(PatchError);
  });

  it('rejects a versionName with unsafe characters', () => {
    expect(() => patchAppBuild(fixture('app-build.gradle'), { versionCode: 1, versionName: '1.0"; evil' })).toThrow(
      /unsafe/,
    );
  });
});

describe('app/build.gradle signing patch', () => {
  const once = patchSigning(patchAppBuild(fixture('app-build.gradle'), { versionCode: 1, versionName: '0.1.0' }));

  it('adds a release signing config read from the environment', () => {
    expect(once).toContain('signingConfigs {');
    expect(once).toContain('System.getenv("EMBERHOLD_KEYSTORE")');
    expect(once).toContain('keyAlias System.getenv("EMBERHOLD_KEY_ALIAS")');
  });

  it('uses the release config in the release build type only', () => {
    const release = once.slice(once.indexOf('buildTypes {'));
    expect(release).toMatch(/release\s*\{\s*signingConfig System\.getenv\("EMBERHOLD_KEYSTORE"\)/);
    expect(once.match(/signingConfig System/g)).toHaveLength(1);
  });

  it('is idempotent', () => {
    expect(patchSigning(once)).toBe(once);
  });
});
