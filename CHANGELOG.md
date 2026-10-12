# Changelog

## Unreleased

### M0 Foundation

- Vite, React 19, TypeScript (strict), Tailwind 4 and TanStack Router (hash history) in the repository root.
- Main menu, "How to play" and a Test map route. The map is pannable (drag), pinch-zoomable and wheel-zoomable (0.5×–2×), with on-screen zoom and reset buttons.
- Phaser 3.90 mounted on the Game route; the render loop pauses in the background.
- Seeded RNG (mulberry32) and typed-array tile grid in `src/game/sim`, with no React or Phaser imports.
- Error boundary with a friendly screen and Restart button.
- Capacitor 8 configuration, keep-awake and screen-orientation hooks, back button and app-state listeners.
- Original emblem icon and splash (`assets/`).
- `scripts/make-icons.mjs` (launcher, adaptive and splash sizes) and `scripts/prepare-android.mjs` (manifest, immersive MainActivity, cutouts, minSdk 26, version from CI, optional release signing), with the patch logic unit-tested.
- GitHub Actions workflow `emberhold-apk.yml`: tests, build, Android project generation, stable signing, release APK, 25 MiB size check, artifact and tagged release.
- Vitest: 25 tests (RNG, tile grid, test map, Android patches against real Capacitor output).
- README "Get the APK" section for someone with no terminal.
