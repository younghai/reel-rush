#!/usr/bin/env python3
"""Crop item sprites from original frames; alpha from luminance (items glow on dark bg)."""
import os
from PIL import Image
import numpy as np

BASE = "/Users/young2026/Downloads/AI /AI_game/arirang-clone"
A = f"{BASE}/analysis"
C = f"{BASE}/cave-analysis"
OUT = f"{BASE}/app/public/sprites"
os.makedirs(OUT, exist_ok=True)

# name, frame_path, x, y, w, h
CROPS = [
    # arirang items
    ("hourglass", f"{A}/fr_a_06.png",     68, 650, 132, 168),
    ("lantern",   f"{A}/fr_a_06.png",    555,  50, 100, 340),
    ("norigae",   f"{A}/fr_a_06.png",    588, 1068, 78, 212),
    ("flower",    f"{A}/fr_a_2.png",      65, 115, 175, 165),
    ("pouch",     f"{A}/fr_a_2.png",     558, 425, 112, 300),
    ("janggu",    f"{A}/fr_a_2.png",      35, 1000, 190, 172),
    ("fan",       f"{A}/fr_a_5.png",     498, 303, 188, 288),
    ("beads",     f"{A}/fr_a_14.png",    232, 868, 265, 100),
    ("shelf",     f"{A}/fr_a_44.2.png",  235, 630, 485, 195),
    # cave items
    ("c_torch",    f"{C}/fr_c_3.png",    568, 568, 104, 215),
    ("c_lantern",  f"{C}/fr_c_1.png",    555, 55, 120, 250),
    ("c_chain",    f"{C}/fr_c_2.png",     35, 80, 135, 430),
    ("c_gargoyle", f"{C}/fr_c_5.png",    568, 665, 112, 162),
    ("c_mushroom", f"{C}/fr_c_9.png",    560, 498, 142, 168),
    ("c_pickaxe",  f"{C}/fr_c_9.png",      5, 958, 102, 185),
    ("c_chest",    f"{C}/fr_c_56.8.png",  25, 540, 260, 215),
    ("c_crown",    f"{C}/fr_c_56.8.png", 490, 600, 145, 110),
]

for name, fp, x, y, w, h in CROPS:
    im = Image.open(fp).convert("RGB")
    crop = np.asarray(im.crop((x, y, x + w, y + h))).astype(np.float32)
    lum = crop.max(axis=2)
    # estimate bg from border pixels
    border = np.concatenate([lum[0:4].ravel(), lum[-4:].ravel(), lum[:, 0:4].ravel(), lum[:, -4:].ravel()])
    lo = float(np.percentile(border, 60)) + 4
    hi = lo + 85
    alpha = np.clip((lum - lo) / (hi - lo), 0, 1)
    alpha = alpha ** 0.85
    # keep some floor alpha where color is saturated (dim colored glass)
    sat = crop.max(axis=2) - crop.min(axis=2)
    alpha = np.maximum(alpha, np.clip((sat - 14) / 60, 0, 1) * 0.85)
    out = np.dstack([crop, alpha * 255]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(f"{OUT}/{name}.png")
    print(f"{name}: {w}x{h} lo={lo:.0f}")

# clean baked residue in fan sprite (a glass bar crossed the crop's lower-left)
fan = np.asarray(Image.open(f"{OUT}/fan.png")).astype(np.float32)
hf, wf = fan.shape[:2]
yy, xx = np.mgrid[0:hf, 0:wf]
mask = ((xx < 46) & (yy > 150)).astype(np.float32)
fan[:, :, 3] *= 1.0 - mask
Image.fromarray(fan.astype(np.uint8), "RGBA").save(f"{OUT}/fan.png")

# contact sheet on mid-dark checker for inspection
names = [c[0] for c in CROPS]
tiles = []
for n in names:
    sp = Image.open(f"{OUT}/{n}.png")
    tiles.append((n, sp))
cols, rows = 5, (len(tiles) + 4) // 5
cw, ch = 260, 420
sheet = Image.new("RGB", (cols * cw, rows * ch), (34, 32, 38))
from PIL import ImageDraw
d = ImageDraw.Draw(sheet)
for i, (n, sp) in enumerate(tiles):
    px, py = (i % cols) * cw, (i // cols) * ch
    sp2 = sp.copy()
    sp2.thumbnail((cw - 16, ch - 34))
    sheet.paste(sp2, (px + 8, py + 26), sp2)
    d.text((px + 8, py + 6), n, fill=(220, 220, 220))
sheet.save(f"{BASE}/qa/sprite_sheet.png")
print("sheet saved")
