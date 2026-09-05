"""Re-render Play phone screenshots with es-419 headline blocks.

Takes the English renders in screenshots/play/, erases the burned-in
headline (masked horizontal inpaint — the headline zone is a smooth dark
expanse by design), then draws the es-419 headline from deck.json in the
same type system (Plus Jakarta Sans ExtraBold, matched cap height, weight,
tracking, and baselines).
"""
from PIL import Image, ImageFont, ImageDraw
import numpy as np
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DECK = json.load(open(os.path.join(ROOT, "screenshots", "deck.json")))
FONT_PATH = os.path.join(ROOT, "tmp", "pjs.ttf")
OUT_DIR = os.path.join(ROOT, "screenshots", "play-es419")
os.makedirs(OUT_DIR, exist_ok=True)

SLIDE_FILES = {
    "Porch Risk Score": "01_porch_risk_score.png",
    "Package Tracking": "02_package_tracking.png",
    "Community Hub": "03_community_hub.png",
    "Maintenance Requests": "04_maintenance_requests.png",
    "Admin Dashboard": "05_admin_dashboard.png",
}

# Measured from the English renders: line 1 cap band 164-241, line 2 280-357.
BASELINES = [241, 357]
CANVAS_CENTER_X = 642
CAP_TARGET = 77  # cap height of the English headline
ERASE_BAND = (85, 470)
TEXT_LUM = 45  # catches the drop-shadow/glow around the glyphs, not the ~lum-18 background
DILATE = 8
MAX_LINE_WIDTH = 1000

# --- calibrate font size for cap height, and tracking from English width ---
def font_at(size: int) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_PATH, size)
    f.set_variation_by_axes([800])
    return f

def cap_height(f: ImageFont.FreeTypeFont) -> int:
    bb = f.getbbox("K")
    return bb[3] - bb[1]

SIZE = next(s for s in range(90, 130) if cap_height(font_at(s)) >= CAP_TARGET)
FONT = font_at(SIZE)

# tracking: reproduce the English line width on slide 01 ("Know Your Risk")
_ref_w = 908  # measured cols 192-1100 on play/01
_plain = FONT.getlength("Know Your Risk")
TRACK = max(0.0, (_ref_w - _plain) / (len("Know Your Risk") - 1))

def tracking_for(lines: list[str]) -> float:
    """English-style tracking, tightened when a longer es line needs to fit."""
    longest = max(lines, key=len)
    plain = sum(FONT.getlength(ch) for ch in longest)
    fit = (MAX_LINE_WIDTH - plain) / max(1, len(longest) - 1)
    return max(0.0, min(TRACK, fit))

def draw_tracked(draw: ImageDraw.ImageDraw, xy, text: str, fill, track: float) -> None:
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=FONT, fill=fill, anchor="ls")
        x += FONT.getlength(ch) + track

def erase_headline(im: Image.Image) -> Image.Image:
    """Inpaint burned-in headline text using horizontal interpolation."""
    rgb = np.asarray(im.convert("RGB")).astype(np.float64)
    lum = rgb.mean(axis=2)
    y0, y1 = ERASE_BAND
    band_full = np.zeros(lum.shape, dtype=bool)
    band_full[y0:y1] = lum[y0:y1] > TEXT_LUM
    # dilate the text mask so anti-aliased edges and glow are covered
    mask = np.zeros_like(band_full)
    for dy in range(-DILATE, DILATE + 1):
        shifted = np.roll(band_full, dy, axis=0)
        for dx in range(-DILATE, DILATE + 1):
            if dx * dx + dy * dy <= DILATE * DILATE:
                mask |= np.roll(shifted, dx, axis=1)
    H, W = lum.shape
    out = rgb.copy()
    for y in range(y0 - DILATE, y1 + DILATE):
        row_mask = mask[y]
        if not row_mask.any():
            continue
        xs = np.where(row_mask)[0]
        runs = np.split(xs, np.where(np.diff(xs) > 1)[0] + 1)
        for run in runs:
            a, b = run[0], run[-1]
            left = a - 1
            right = b + 1
            lc = rgb[y, left] if left >= 0 else rgb[y, right]
            rc = rgb[y, right] if right < W else rgb[y, left]
            n = b - a + 1
            t = np.linspace(0.0, 1.0, n + 2)[1:-1][:, None]
            out[y, a:b + 1] = lc * (1 - t) + rc * t
    # light grain re-noise so the inpainted zone matches the film-grain texture
    rng = np.random.default_rng(y0)
    noise = rng.normal(0, 1.1, out[y0 - DILATE:y1 + DILATE].shape)
    out[y0 - DILATE:y1 + DILATE] += noise
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def main() -> None:
    for slide in DECK["slides"]:
        label = slide["label"]
        name = SLIDE_FILES[label]
        es = DECK["headlines"]["es-419"][label]
        lines = es.split("<br>")
        im = Image.open(os.path.join(ROOT, "screenshots", "play", name)).convert("RGB")
        im = erase_headline(im)
        draw = ImageDraw.Draw(im)
        track = tracking_for(lines)
        for i, line in enumerate(lines):
            baseline = BASELINES[i]
            width = sum(FONT.getlength(ch) + track for ch in line) - track
            x = CANVAS_CENTER_X - width / 2
            draw_tracked(draw, (x, baseline), line, (255, 255, 255), track)
        out_path = os.path.join(OUT_DIR, name)
        im.save(out_path)
        print("wrote", out_path)

if __name__ == "__main__":
    main()
