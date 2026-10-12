#!/usr/bin/env python3
"""Generate the app icons for Kurd Castle.

The game has no imported art — every building, unit and projectile is drawn from
code at runtime — so the icon is drawn from code too, and this script is the
source of truth for the PNGs under preview/icons/ and android-app/.

    python3 -m pip install pillow
    python3 tools/make_icons.py

Design: a castle keep in the game's palette on a night-sky gradient, with
crenellated towers, a gate and two banners. The maskable variant keeps the art
inside the 80% safe zone so Android can crop it to any shape.
"""

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:  # pragma: no cover - guidance beats a traceback
    sys.exit("Pillow is required: python3 -m pip install pillow")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICON_DIR = os.path.join(ROOT, "preview", "icons")
TWA_DIR = os.path.join(ROOT, "android-app", "twa")

# Palette shared with Config/Balance.cs and preview/src/balance.js
SKY_TOP = (32, 27, 23)
SKY_BOTTOM = (74, 56, 38)
STONE = (214, 205, 186)
STONE_DARK = (150, 140, 122)
STONE_SHADE = (108, 100, 86)
GOLD = (232, 198, 90)
GOLD_DARK = (176, 141, 48)
DANGER = (203, 70, 53)
GROUND = (46, 62, 34)

SUPERSAMPLE = 4


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def draw_sky(img, size, radius):
    """Vertical gradient background, optionally with rounded corners."""
    px = img.load()
    for y in range(size):
        row = lerp(SKY_TOP, SKY_BOTTOM, (y / max(1, size - 1)) ** 0.85)
        for x in range(size):
            px[x, y] = row + (255,)

    if radius <= 0:
        return img

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def draw_starfield(draw, size):
    """A few stars, positioned deterministically so every run is identical."""
    stars = [(0.16, 0.14, 1.6), (0.30, 0.09, 1.1), (0.72, 0.12, 1.7),
             (0.86, 0.22, 1.2), (0.62, 0.07, 1.0), (0.09, 0.28, 1.0)]
    for fx, fy, r in stars:
        x, y, rr = fx * size, fy * size, r * size / 512
        draw.ellipse((x - rr, y - rr, x + rr, y + rr), fill=(246, 240, 214, 190))


def draw_keep(draw, size):
    """The castle itself, front elevation: curtain wall, two flanking towers, a
    central keep and a projecting gatehouse with a torch either side."""
    s = size / 512.0  # the design was drawn on a 512 canvas

    def r(*vals):
        return tuple(v * s for v in vals)

    # --- ground: dark grass bank the castle stands on
    draw.polygon([r(0, 402), r(512, 402), r(512, 512), r(0, 512)], fill=GROUND + (255,))
    draw.polygon([r(0, 388), r(512, 388), r(512, 412), r(0, 412)], fill=(38, 52, 28, 255))

    # --- curtain wall
    draw.rectangle(r(160, 250, 352, 392), fill=STONE_DARK + (255,))
    draw.rectangle(r(160, 250, 352, 274), fill=STONE + (255,))
    x = 168
    while x < 344:
        draw.rectangle(r(x, 234, x + 18, 252), fill=STONE + (255,))
        x += 27

    # --- left tower
    draw.rectangle(r(104, 178, 184, 392), fill=STONE_DARK + (255,))
    draw.rectangle(r(104, 178, 184, 200), fill=STONE + (255,))
    x = 108
    while x < 180:
        draw.rectangle(r(x, 160, x + 16, 180), fill=STONE + (255,))
        x += 24
    for y in (222, 262, 302):
        draw.rectangle(r(132, y, 156, y + 22), fill=(42, 32, 24, 255))
        draw.rectangle(r(132, y, 156, y + 4), fill=(24, 18, 14, 255))

    # --- right tower
    draw.rectangle(r(328, 178, 408, 392), fill=STONE_DARK + (255,))
    draw.rectangle(r(328, 178, 408, 200), fill=STONE + (255,))
    x = 332
    while x < 404:
        draw.rectangle(r(x, 160, x + 16, 180), fill=STONE + (255,))
        x += 24
    # hit marks: this castle has been under siege
    draw.rectangle(r(344, 240, 372, 266), fill=(72, 66, 58, 255))
    draw.rectangle(r(356, 296, 380, 316), fill=(72, 66, 58, 255))

    # --- central keep
    draw.rectangle(r(212, 120, 300, 392), fill=STONE_DARK + (255,))
    draw.rectangle(r(212, 120, 300, 146), fill=STONE + (255,))
    x = 216
    while x < 296:
        draw.rectangle(r(x, 102, x + 16, 122), fill=STONE + (255,))
        x += 24
    draw.rectangle(r(238, 168, 274, 214), fill=(44, 34, 26, 255))
    draw.rectangle(r(238, 168, 274, 174), fill=(28, 20, 16, 255))

    # --- gatehouse: projects forward, so it is drawn last and clearly readable
    draw.rectangle(r(224, 292, 288, 392), fill=(168, 158, 140, 255))
    draw.rectangle(r(224, 292, 288, 312), fill=STONE + (255,))
    x = 228
    while x < 284:
        draw.rectangle(r(x, 280, x + 14, 294), fill=STONE + (255,))
        x += 22
    draw.rectangle(r(240, 322, 272, 392), fill=(56, 40, 27, 255))
    draw.pieslice(r(240, 296, 272, 350), start=180, end=360, fill=(56, 40, 27, 255))
    draw.rectangle(r(246, 334, 266, 392), fill=(84, 62, 40, 255))
    draw.line(r(256, 334, 256, 392), fill=(48, 34, 24, 255), width=max(1, int(2 * s)))
    # portcullis teeth at the top of the arch
    for tx in range(243, 272, 7):
        draw.rectangle(r(tx, 316, tx + 3, 330), fill=(38, 28, 20, 255))

    # --- torches flanking the gate
    for cx in (216, 296):
        draw.rectangle(r(cx - 3, 322, cx + 3, 352), fill=(62, 48, 34, 255))
        draw.ellipse(r(cx - 10, 306, cx + 10, 328), fill=(212, 168, 70, 255))
        draw.ellipse(r(cx - 5, 310, cx + 5, 322), fill=(255, 232, 150, 255))

    # --- banner on a pole over the keep
    draw.line(r(318, 58, 318, 200), fill=(74, 60, 44, 255), width=max(2, int(4 * s)))
    draw.polygon([r(318, 60), r(392, 76), r(318, 94)], fill=GOLD + (255,))
    draw.polygon([r(318, 98), r(376, 110), r(318, 124)], fill=DANGER + (255,))


def render(size, radius_ratio, art_scale, path):
    """Render at SUPERSAMPLE× and downsample for antialiasing."""
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    img = draw_sky(img, big, 0 if radius_ratio <= 0 else int(big * radius_ratio))
    draw = ImageDraw.Draw(img, "RGBA")
    draw_starfield(draw, big)

    art = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw_keep(ImageDraw.Draw(art, "RGBA"), big)
    if art_scale != 1.0:
        inner = max(1, int(big * art_scale))
        art = art.resize((inner, inner), Image.LANCZOS)
        offset = (big - inner) // 2
        canvas = Image.new("RGBA", (big, big), (0, 0, 0, 0))
        # the ground ramp must still reach the icon edges on a maskable icon
        canvas.paste(art, (offset, offset), art)
        art = canvas
    img = Image.alpha_composite(img, art)

    if radius_ratio > 0:
        mask = Image.new("L", (big, big), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1),
                                               radius=int(big * radius_ratio), fill=255)
        img.putalpha(mask)

    img = img.resize((size, size), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path, "PNG", optimize=True)
    return path


def render_feature(path, width=1024, height=500):
    """Play Store feature graphic (1024x500): the keep on the left, the title on
    the right, filled to the edges because the store crops this artwork."""
    scale = 2
    big_w, big_h = width * scale, height * scale
    img = Image.new("RGBA", (big_w, big_h), (0, 0, 0, 0))
    px = img.load()
    for y in range(big_h):
        row = lerp(SKY_TOP, SKY_BOTTOM, (y / max(1, big_h - 1)) ** 0.9)
        for x in range(big_w):
            px[x, y] = row + (255,)

    draw = ImageDraw.Draw(img, "RGBA")
    draw_starfield(draw, big_h)

    # Castle on the left, scaled to the full height of the banner and bled a
    # little off the bottom so it reads as a screenshot rather than a sticker.
    art_h = int(big_h * 1.06)
    art = Image.new("RGBA", (art_h, art_h), (0, 0, 0, 0))
    draw_keep(ImageDraw.Draw(art, "RGBA"), art_h)
    img.alpha_composite(art, (int(-art_h * 0.10), big_h - art_h))

    def font(size):
        try:
            return ImageFont.load_default(size=int(size))
        except TypeError:  # Pillow < 10.1 has no scalable default
            return ImageFont.load_default()

    title = "KURD CASTLE"
    lines = ["Isometric castle builder", "and siege defence"]
    tagline = "Build / Feed / Fortify / Hold"

    text_left = int(big_w * 0.475)
    avail = big_w - text_left - int(big_w * 0.05)

    title_font = font(big_h * 0.24)
    while draw.textlength(title, font=title_font) > avail and title_font.size > 20:
        title_font = font(title_font.size - 2)

    body_font = font(big_h * 0.082)
    while max(draw.textlength(l, font=body_font) for l in lines + [tagline]) > avail and body_font.size > 10:
        body_font = font(body_font.size - 1)

    y = int(big_h * 0.20)
    draw.text((text_left, y), title, font=title_font, fill=GOLD + (255,))
    y += int(title_font.size * 1.30)

    # gold rule under the title
    draw.rectangle((text_left, y, text_left + int(avail * 0.55), y + max(2, big_h // 150)),
                   fill=DANGER + (255,))
    y += int(big_h * 0.055)

    for line in lines:
        draw.text((text_left, y), line, font=body_font, fill=STONE + (255,))
        y += int(body_font.size * 1.32)

    y += int(big_h * 0.03)
    draw.text((text_left, y), tagline, font=body_font, fill=(198, 178, 120, 255))

    img = img.resize((width, height), Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.convert("RGB").save(path, "PNG", optimize=True)
    return path


def main():
    made = []
    # "any" icons: rounded square, art fills the canvas
    for size in (192, 512, 1024):
        made.append(render(size, 0.22, 1.0, os.path.join(ICON_DIR, f"icon-{size}.png")))
    # maskable: full-bleed background, art inside the 80% safe zone
    made.append(render(512, 0.0, 0.78, os.path.join(ICON_DIR, "maskable-512.png")))
    # iOS home screen + browser tab
    made.append(render(180, 0.0, 1.0, os.path.join(ICON_DIR, "apple-touch-icon.png")))
    made.append(render(32, 0.22, 1.0, os.path.join(ICON_DIR, "favicon-32.png")))
    # Bubblewrap wants a 512 px PNG to seed the TWA project and the Play listing
    made.append(render(512, 0.0, 1.0, os.path.join(TWA_DIR, "icon.png")))
    # Play Store listing artwork: 1024x500 feature graphic
    made.append(render_feature(os.path.join(TWA_DIR, "feature-graphic.png")))

    for path in made:
        rel = os.path.relpath(path, ROOT)
        print(f"  wrote {rel} ({os.path.getsize(path) // 1024 or 1} KB)")


if __name__ == "__main__":
    main()
