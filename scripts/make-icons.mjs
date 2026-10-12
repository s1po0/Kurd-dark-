#!/usr/bin/env node
// Renders assets/icon.svg and assets/splash.svg into every Android launcher
// and splash size inside the generated android/ project. Run after
// "npx cap add android" and before "npx cap sync android".
// Safe to run repeatedly: files are overwritten with the same content.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const res = join(root, 'android', 'app', 'src', 'main', 'res');
const BG = '#15130f';

// Launcher icons: legacy size is 48dp; adaptive foreground is 108dp.
const LAUNCHER_DENSITY = [
  { dir: 'mipmap-mdpi', scale: 1 },
  { dir: 'mipmap-hdpi', scale: 1.5 },
  { dir: 'mipmap-xhdpi', scale: 2 },
  { dir: 'mipmap-xxhdpi', scale: 3 },
  { dir: 'mipmap-xxxhdpi', scale: 4 },
];

// Splash sizes for the two orientations (the game is landscape-locked).
const SPLASH_LAND = [
  { dir: 'drawable-land-mdpi', w: 480, h: 320 },
  { dir: 'drawable-land-hdpi', w: 800, h: 480 },
  { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
  { dir: 'drawable-land-xxhdpi', w: 1600, h: 900 },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1080 },
  { dir: 'drawable', w: 1280, h: 720 },
];
const SPLASH_PORT = [
  { dir: 'drawable-port-mdpi', w: 320, h: 480 },
  { dir: 'drawable-port-hdpi', w: 480, h: 800 },
  { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { dir: 'drawable-port-xxhdpi', w: 1080, h: 1920 },
  { dir: 'drawable-port-xxxhdpi', w: 1440, h: 2560 },
];

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
}

async function writePng(path, pipeline) {
  await ensureDir(dirname(path));
  await writeFile(path, await pipeline.png({ compressionLevel: 9 }).toBuffer());
}

async function main() {
  if (!(await exists(res))) {
    throw new Error('android/app/src/main/res is missing. Run "npx cap add android" first.');
  }

  const iconSvg = await readFile(join(root, 'assets', 'icon.svg'));
  const splashSvg = await readFile(join(root, 'assets', 'splash.svg'));

  // 1. Legacy and round launcher icons (flattened on the iron background).
  for (const { dir, scale } of LAUNCHER_DENSITY) {
    const px = Math.round(48 * scale);
    const legacy = sharp(iconSvg).resize(px, px);
    await writePng(join(res, dir, 'ic_launcher.png'), legacy);
    await writePng(join(res, dir, 'ic_launcher_round.png'), sharp(iconSvg).resize(px, px));

    // 2. Adaptive foreground: 108dp canvas, emblem kept inside the 72dp safe zone.
    const full = Math.round(108 * scale);
    const inner = Math.round(full * (72 / 108) * 1.0);
    const emblem = await sharp(iconSvg).resize(inner, inner).png().toBuffer();
    const offset = Math.round((full - inner) / 2);
    await writePng(
      join(res, dir, 'ic_launcher_foreground.png'),
      sharp({ create: { width: full, height: full, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([
        { input: emblem, left: offset, top: offset },
      ]),
    );
  }

  // 3. Adaptive icon wiring: background colour, foreground PNG.
  await ensureDir(join(res, 'values'));
  await writeFile(
    join(res, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`,
  );
  const adaptive = `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n`;
  await ensureDir(join(res, 'mipmap-anydpi-v26'));
  await writeFile(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
  await writeFile(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);

  // 4. Splash screens (landscape is the primary orientation).
  for (const { dir, w, h } of SPLASH_LAND) {
    await writePng(join(res, dir, 'splash.png'), sharp(splashSvg).resize(w, h, { fit: 'cover' }));
  }
  for (const { dir, w, h } of SPLASH_PORT) {
    await writePng(
      join(res, dir, 'splash.png'),
      sharp({ create: { width: w, height: h, channels: 4, background: BG } }).composite([
        { input: await sharp(splashSvg).resize(w, Math.round(w * (1080 / 1920))).png().toBuffer(), gravity: 'center' },
      ]),
    );
  }

  console.log('Launcher icons, adaptive icons and splash screens written.');
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
