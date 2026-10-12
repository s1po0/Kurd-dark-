#!/usr/bin/env node
// Patches the Capacitor-generated android/ project for Emberhold.
// Safe to run repeatedly. Exits non-zero with a clear message on any missing anchor.
//
//   npx cap add android        (creates android/ once, in CI)
//   node scripts/prepare-android.mjs
//
// The patch logic lives in scripts/lib/patches.mjs and is unit-tested.

import { readFile, writeFile, access, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import {
  PatchError,
  patchAppBuild,
  patchMainActivity,
  patchManifest,
  patchSigning,
  patchStyles,
  patchVariables,
} from './lib/patches.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const androidDir = join(root, 'android');
const appDir = join(androidDir, 'app', 'src', 'main');

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findFile(dir, name) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const hit = await findFile(full, name);
      if (hit) return hit;
    } else if (entry.name === name) {
      return full;
    }
  }
  return null;
}

/** Reads { appId, version, versionCode, versionName } from the repo sources. */
async function readIdentity() {
  const brand = await readFile(join(root, 'src', 'config', 'brand.ts'), 'utf8');
  const appId = brand.match(/appId:\s*'([\w.]+)'/)?.[1];
  if (!appId) throw new PatchError('src/config/brand.ts', 'appId not found');
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
  const runNumber = Number(process.env.GITHUB_RUN_NUMBER ?? '1');
  return {
    appId,
    versionName: String(pkg.version),
    versionCode: Number.isInteger(runNumber) && runNumber > 0 ? runNumber : 1,
  };
}

/** Applies one patch to one file. Writes only when the text actually changed. */
async function patchFile(path, patcher) {
  const before = await readFile(path, 'utf8');
  const after = patcher(before);
  const rel = relative(root, path);
  if (after === before) {
    console.log(`  = ${rel} (already up to date)`);
    return;
  }
  await writeFile(path, after, 'utf8');
  console.log(`  ✔ ${rel}`);
}

async function main() {
  if (!(await exists(androidDir))) {
    throw new PatchError('android/', 'the Android project does not exist yet. Run "npx cap add android" first.');
  }

  const identity = await readIdentity();
  console.log(`Preparing Android project for ${identity.appId} ${identity.versionName} (code ${identity.versionCode})`);

  const manifest = join(appDir, 'AndroidManifest.xml');
  const styles = join(appDir, 'res', 'values', 'styles.xml');
  const variables = join(androidDir, 'variables.gradle');
  const appGradle = join(androidDir, 'app', 'build.gradle');
  const activityPath =
    (await findFile(join(appDir, 'java'), 'MainActivity.java')) ??
    join(appDir, 'java', ...identity.appId.split('.'), 'MainActivity.java');
  if (!(await exists(activityPath))) {
    throw new PatchError('MainActivity.java', 'not found under app/src/main/java');
  }

  await patchFile(manifest, patchManifest);
  await patchFile(activityPath, patchMainActivity);
  await patchFile(styles, patchStyles);
  await patchFile(variables, patchVariables);
  await patchFile(appGradle, (g) => patchSigning(patchAppBuild(g, identity)));

  console.log('Android project patched.');
}

main().catch((error) => {
  if (error instanceof PatchError) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
