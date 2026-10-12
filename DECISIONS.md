# Decisions

One line per judgement call. Newest at the bottom.

1. **Emberhold lives at the repository root**, beside the untouched Kurd Castle prototype (`unity/`, `preview/`, `tools/`, `android-app/`).
2. **Phaser 3.90.0** (the brief asks for Phaser 3; npm's latest Phaser is 4.x).
3. **Vite 8, TypeScript 5.9 (strict), Tailwind 4, TanStack Router 1.x, React 19**: the current stable lines that build together. TypeScript 7 (native port) is not used yet.
4. **Capacitor 8.5** with **JDK 21** in CI (Capacitor 8 requires 21).
5. **Keep-awake** uses `@capacitor-community/keep-awake` 8.x, which supports Capacitor 8.
6. **Hash history** for routing, so reloads and WebView file-style URLs keep working.
7. **Workflow named `emberhold-apk.yml`**, not `android-apk.yml`, because the Kurd Castle APK workflow already uses that name.
8. **Workflow runs on `main`, `arena/**`, `emberhold-v*` tags and manual dispatch.** The arena branch is included so the build can be checked before merging.
9. **Only the release APK is built and uploaded**, signed with one stable key. A separate debug APK would carry a fresh key each run and could not update older installs.
10. **Stable signing key**: repository secrets when present; otherwise a key generated once and kept in the Actions cache keyed by branch. No keystore is committed, because `.gitignore` forbids keystores.
11. **Release signing** is read from environment variables in `app/build.gradle`. Without them, the debug key is used so local builds still work.
12. **INTERNET permission removed** from the manifest; the game is offline and the WebView serves the bundle from the app itself.
13. **Immersive sticky mode** is applied in `MainActivity` on window focus, with display-cutout support in the app themes.
14. **Landscape** is locked with `sensorLandscape` in the manifest and by the screen-orientation plugin at runtime.
15. **minSdk 26** (Android 8.0), raised from the template's 24.
16. **Patch logic is pure text-in, text-out** in `scripts/lib/patches.mjs`, so Vitest can test it against real Capacitor files kept in `tests/fixtures/capacitor-android/`.
17. **Patches are idempotent and fail loudly** on a missing anchor, so a Capacitor upgrade cannot silently ship an unpatched APK.
18. **Launcher icons and splash** are rendered by sharp from `assets/icon.svg` and `assets/splash.svg` inside the generated project; the adaptive-icon XML is rewritten to match.
19. **Vite `allowedHosts: true`** for the dev and preview servers only, so the sandbox preview proxy works. The APK does not use them.
20. **Menu lists only working entries.** Continue, Campaign, Skirmish, Free Build and Settings appear in the milestones that build them, so there are no dead buttons.
21. **Android back in the game returns to the menu** until the pause menu exists (M3).
22. **Test map is a deterministic patchwork**, not the seeded generator, which arrives in M1.
23. **The simulation RNG is mulberry32** (`src/game/sim/rng.ts`); the simulation never calls `Math.random()` or `Date.now()`.
24. **Terrain is baked into one Graphics object** for M0; chunk textures (16×16 tiles) come in M1 as the brief specifies.
25. **Original art only.** The emblem, palette and UI are drawn in code and SVG; no commercial game's art, names or sounds are used.
26. **Everything visible goes through `t()`** in `src/i18n/en.ts`.
27. **The Kurd Castle README stays in place**, below the Emberhold section of `README.md`, so nothing is removed.
