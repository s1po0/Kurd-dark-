#!/usr/bin/env python3
"""Validate the installable-preview plumbing.

Everything a browser needs in order to install the game as an app is text, and
text can be checked without a device: the manifest has to parse and point at
icons that really exist at the sizes it claims, the service worker has to
precache files that are actually in the folder, and the HTML has to reference
things that exist. Run it from anywhere:

    python3 tools/check_pwa.py

Exits non-zero with a list of problems, so it works as a CI gate next to
`node preview/test/headless.mjs`.
"""

import json
import os
import re
import struct
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW = os.path.join(ROOT, "preview")

ERRORS = []
NOTES = []


def err(msg):
    ERRORS.append(msg)


def png_size(path):
    """Read width/height straight from the PNG header — no Pillow needed."""
    with open(path, "rb") as fh:
        header = fh.read(24)
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", header[16:24])


def check_manifest():
    path = os.path.join(PREVIEW, "manifest.webmanifest")
    if not os.path.exists(path):
        return err("manifest.webmanifest is missing")
    try:
        with open(path) as fh:
            manifest = json.load(fh)
    except json.JSONDecodeError as exc:
        return err(f"manifest.webmanifest is not valid JSON: {exc}")

    for key in ("name", "short_name", "start_url", "display", "icons", "theme_color",
                "background_color"):
        if key not in manifest:
            err(f"manifest is missing the required key '{key}'")

    if manifest.get("orientation") != "landscape":
        err("manifest orientation should be 'landscape' (the game is landscape-only)")
    if manifest.get("display") not in ("fullscreen", "standalone"):
        err("manifest display should be 'fullscreen' or 'standalone'")

    sizes_seen = set()
    maskable = False
    for icon in manifest.get("icons", []):
        src = icon.get("src", "")
        if src.startswith("./"):
            src = src[2:]
        icon_path = os.path.join(PREVIEW, src)
        if not os.path.exists(icon_path):
            err(f"manifest references a missing icon: {src}")
            continue
        actual = png_size(icon_path)
        if actual is None:
            err(f"icon is not a PNG: {src}")
            continue
        claimed = icon.get("sizes", "")
        want = claimed.split("x") if "x" in claimed else None
        if want and (str(actual[0]) != want[0] or str(actual[1]) != want[1]):
            err(f"{src}: declared {claimed} but the file is {actual[0]}x{actual[1]}")
        sizes_seen.add(claimed)
        if "maskable" in icon.get("purpose", ""):
            maskable = True

    if "512x512" not in sizes_seen:
        err("a 512x512 icon is required for install prompts")
    if "192x192" not in sizes_seen:
        err("a 192x192 icon is required for install prompts")
    if not maskable:
        err("no maskable icon declared; Android cannot crop the icon to its shape")

    NOTES.append(f"manifest OK ({len(manifest.get('icons', []))} icons, "
                 f"{'maskable present' if maskable else 'no maskable icon'})")


def check_service_worker():
    path = os.path.join(PREVIEW, "sw.js")
    if not os.path.exists(path):
        return err("sw.js is missing")
    text = open(path).read()

    shell = re.search(r"const SHELL = \[(.*?)\];", text, re.S)
    if not shell:
        return err("sw.js has no SHELL precache list")
    entries = re.findall(r"'([^']+)'", shell.group(1))
    if not entries:
        err("sw.js SHELL list is empty")

    for entry in entries:
        if entry == "./":
            if not os.path.exists(os.path.join(PREVIEW, "index.html")):
                err("sw.js precaches './' but index.html is missing")
            continue
        rel = entry[2:] if entry.startswith("./") else entry
        if not os.path.exists(os.path.join(PREVIEW, rel)):
            err(f"sw.js precaches a missing file: {entry}")

    # Every source module the game imports should be in the shell, or an offline
    # start would silently fall back to the network.
    main = open(os.path.join(PREVIEW, "src", "main.js")).read()
    imports = re.findall(r"from\s+'\./([^']+)'", main)
    for imp in imports:
        if f"./src/{imp}" not in entries:
            err(f"src/main.js imports {imp} but sw.js does not precache it")

    NOTES.append(f"service worker OK ({len(entries)} precached entries)")


def check_html():
    path = os.path.join(PREVIEW, "index.html")
    if not os.path.exists(path):
        return err("index.html is missing")
    text = open(path).read()

    for ref in re.findall(r'(?:href|src)="\./([^"]+)"', text):
        if not os.path.exists(os.path.join(PREVIEW, ref)):
            err(f"index.html references a missing file: {ref}")

    for needle in ("manifest.webmanifest", "apple-touch-icon", "viewport",
                   "theme-color", "viewport-fit=cover"):
        if needle not in text:
            err(f"index.html is missing '{needle}'")

    NOTES.append("index.html OK")


def check_icons_are_current():
    """Every generated icon should match the committed one: the generator is the
    source of truth, and a hand-edited binary silently drifting from it is the
    kind of thing nobody notices until the Play listing looks wrong."""
    import hashlib
    import tempfile

    script = os.path.join(ROOT, "tools", "make_icons.py")
    if not os.path.exists(script):
        return

    tracked = sorted(
        os.path.join(dirpath, name)
        for base in (os.path.join(PREVIEW, "icons"),
                     os.path.join(ROOT, "android-app", "twa"),
                     os.path.join(ROOT, "android-app", "webview", "app", "src", "main", "res"))
        for dirpath, _dirs, files in os.walk(base)
        for name in files
        if name.endswith(".png")
    )
    if not tracked:
        return

    def digest(path):
        with open(path, "rb") as fh:
            return hashlib.sha256(fh.read()).hexdigest()

    before = {p: digest(p) for p in tracked}

    # Regenerate into the real locations, compare, then put the originals back so
    # this check never leaves the working tree dirty.
    stash = tempfile.mkdtemp(prefix="kurd-icons-")
    for i, path in enumerate(tracked):
        os.makedirs(os.path.join(stash, str(i)), exist_ok=True)
        with open(os.path.join(stash, str(i), os.path.basename(path)), "wb") as fh:
            fh.write(open(path, "rb").read())

    import subprocess
    subprocess.run([sys.executable, script], cwd=ROOT, check=False,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    drifted = [os.path.relpath(p, ROOT) for p in tracked
               if os.path.exists(p) and digest(p) != before[p]]

    for i, path in enumerate(tracked):
        source = os.path.join(stash, str(i), os.path.basename(path))
        if os.path.exists(source):
            with open(source, "rb") as src, open(path, "wb") as dst:
                dst.write(src.read())

    if drifted:
        err("regenerating icons changes " + ", ".join(drifted) +
            " — commit the output of tools/make_icons.py")
    else:
        NOTES.append(f"all {len(tracked)} generated icons are reproducible from code")


def check_twa():
    twa = os.path.join(ROOT, "android-app", "twa")
    manifest_path = os.path.join(twa, "twa-manifest.json")
    if not os.path.exists(manifest_path):
        return NOTES.append("no TWA config yet (run tools/configure_twa.py)")

    with open(manifest_path) as fh:
        cfg = json.load(fh)

    if cfg.get("startUrl", "").endswith("REPLACE"):
        err("twa-manifest.json still holds placeholder values")
    if not cfg.get("packageId") or "." not in cfg.get("packageId", ""):
        err("twa-manifest.json packageId must be reverse-DNS style")

    for key in ("iconUrl", "maskableIconUrl", "webManifestUrl"):
        url = cfg.get(key, "")
        if url and "/icons/" in url:
            local = os.path.join(PREVIEW, "icons", os.path.basename(url))
            if not os.path.exists(local):
                err(f"twa-manifest {key} points at a missing icon: {url}")

    links = os.path.join(twa, "assetlinks.json")
    if not os.path.exists(links):
        err("android-app/twa/assetlinks.json is missing")
    else:
        with open(links) as fh:
            statements = json.load(fh)
        fps = statements[0]["target"]["sha256_cert_fingerprints"]
        if any("REPLACE" in fp for fp in fps):
            NOTES.append("assetlinks.json still needs your signing-key fingerprint "
                         "(expected until the first signed build)")

    for art in ("icon.png", "feature-graphic.png"):
        art_path = os.path.join(twa, art)
        if not os.path.exists(art_path):
            err(f"store artwork missing: android-app/twa/{art}")
        elif art == "feature-graphic.png":
            size = png_size(art_path)
            if size != (1024, 500):
                err(f"feature graphic must be 1024x500, found {size}")

    NOTES.append("TWA config OK")


def main():
    check_manifest()
    check_service_worker()
    check_html()
    check_twa()
    if "--skip-icons" not in sys.argv:
        check_icons_are_current()

    for note in NOTES:
        print("  " + note)
    for problem in ERRORS:
        print("ERROR " + problem)
    print(f"{len(ERRORS)} error(s)")
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
