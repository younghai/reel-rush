#!/usr/bin/env python3
"""Extract dog + dancer pose sprites (final: v1 flood fill + trims, dancer per-row bg)."""
import os
from collections import deque
from PIL import Image, ImageDraw
import numpy as np

BASE = "/Users/young2026/Downloads/AI /AI_game/arirang-clone"
D = f"{BASE}/dog-analysis"
OUT = f"{BASE}/app/public/sprites"
FLOOR_Y = 882

DOG_CROPS = [
    ("dog_stand",  f"{D}/fr_1.5.png", 140, 538, 390, 558, []),
    ("dog_tongue", f"{D}/fr_13.png", 170, 508, 395, 598, [(0, 0, 48, 115), (338, 0, 395, 115), (0, 285, 28, 385)]),
    ("dog_shake",  f"{D}/fr_9.5.png", 205, 490, 325, 612, [(0, 0, 60, 70)]),
    ("dog_side",   f"{D}/fr_16.png", 180, 485, 350, 620, [(0, 0, 40, 60)]),
    ("dog_sniff",  f"{D}/fr_0.5.png", 155, 615, 350, 430, [(0, 0, 50, 55)]),
    ("dog_front2", f"{D}/fr_7.2.png", 240, 520, 300, 570, [(0, 0, 55, 45)]),
]
DANCER_CROPS = [
    ("dancer_stand", f"{D}/fr_1.5.png", 435, 400, 235, 560, [(0, 260, 80, 560)]),
    ("dancer_arms",  f"{D}/fr_13.png", 445, 420, 225, 545, [(0, 210, 70, 545)]),
    ("dancer_bend",  f"{D}/fr_0.5.png", 420, 550, 210, 410, [(0, 120, 72, 410)]),
    ("dancer_back",  f"{D}/fr_7.2.png", 420, 425, 262, 535, [(0, 150, 112, 535)]),
]


def dilate(b, it):
    for _ in range(it):
        p = np.pad(b, 1)
        b = p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:] | p[1:-1, 1:-1] | \
            p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:]
    return b


def erode(b, it):
    for _ in range(it):
        p = np.pad(b, 1, constant_values=True)
        b = p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:] & p[1:-1, 1:-1] & \
            p[:-2, :-2] & p[:-2, 2:] & p[2:, :-2] & p[2:, 2:]
    return b


def smooth(a, k=2):
    pad = np.pad(a, k, mode="edge")
    out = a.copy()
    for dy in range(-k, k + 1):
        for dx in range(-k, k + 1):
            out += pad[k + dy: k + dy + a.shape[0], k + dx: k + dx + a.shape[1]]
    return np.clip(out / (2 * k + 1) ** 2, 0, 1)


EXTRA_CLOSE = {"dog_shake": 10, "dog_side": 16}
ERASE = {c[0]: c[6] for c in DOG_CROPS}
for name, fp, x, y, w, h, _e in DOG_CROPS:
    im = Image.open(fp).convert("RGB")
    c = np.asarray(im.crop((x, y, x + w, y + h))).astype(np.float32)
    lum = c.max(axis=2)
    sat = lum - c.min(axis=2)
    a = np.clip((lum - 150) / 75, 0, 1)
    for (ex0, ey0, ex1, ey1) in ERASE[name]:
        a[ey0:ey1, ex0:ex1] = 0.0
    low = a < 0.1
    seen = np.zeros_like(low)
    hh, ww = low.shape
    q = deque()
    for cx in range(ww):
        for cy in (0, hh - 1):
            if low[cy, cx] and not seen[cy, cx]:
                seen[cy, cx] = True
                q.append((cy, cx))
    for cy in range(hh):
        for cx in (0, ww - 1):
            if low[cy, cx] and not seen[cy, cx]:
                seen[cy, cx] = True
                q.append((cy, cx))
    while q:
        cy, cx = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < hh and 0 <= nx < ww and low[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True
                q.append((ny, nx))
    a[~seen] = 1.0
    if name in EXTRA_CLOSE:
        it = EXTRA_CLOSE[name]
        b = a > 0.15
        cb = erode(dilate(b, it), it)
        dark = cb & (a < 0.5) & (lum < 150)
        a[dark] = np.maximum(a[dark], 0.95)
    # face patches: the open mouth / muzzle must read as solid dark shape
    FACE: dict[str, tuple[float, float, float, float]] = {
        "dog_side": (95, 135, 58, 72),
        "dog_shake": (180, 85, 70, 62),
    }
    if name in FACE:
        cx, cy, rx, ry = FACE[name]
        yy, xx = np.mgrid[0:h, 0:w]
        m = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) <= 1.0
        a[m] = np.maximum(a[m], 0.92)
    y0 = int(h * 0.8)
    warm = np.clip((sat + 25) / 45, 0, 1)
    a[y0:, :] *= warm[y0:, :]
    for cx in range(ww):
        col = a[:, cx]
        tips = np.where(col >= 0.5)[0]
        if len(tips):
            last = tips[-1]
            if last < hh - 4:
                col[last + 3:] = 0
    a = smooth(a, 2)
    out = np.dstack([c, a * 255]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(f"{OUT}/{name}.png")
    print(f"{name}: {w}x{h}")

for name, fp, x, y, w, h, erase in DANCER_CROPS:
    im = Image.open(fp).convert("RGB")
    c = np.asarray(im.crop((x, y, x + w, y + h))).astype(np.float32)
    lum = c.max(axis=2)
    h_, w_ = lum.shape
    bgrow = np.median(lum[:, -14:], axis=1)
    k = 15
    pad = np.pad(bgrow, k, mode="edge")
    bgsm = np.array([pad[i:i + 2 * k + 1].mean() for i in range(h_)])
    dist = np.abs(lum - bgsm[:, None])
    a = np.clip((dist - 7) / 20, 0, 1)
    a[a < 0.24] = 0.0
    a = smooth(a, 2)
    for (ex0, ey0, ex1, ey1) in erase:
        a[ey0:ey1, ex0:ex1] = 0
    a[-26:, :] *= np.where(lum[-26:, :] > 185, 1.0, 0.15)
    a[:10, :] *= np.linspace(0, 1, 10)[:, None]
    out = np.dstack([c, a * 255]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(f"{OUT}/{name}.png")
    print(f"{name}: {w}x{h}")

names = [c[0] for c in DOG_CROPS] + [c[0] for c in DANCER_CROPS]
cols, cw, ch = 4, 260, 620
rows = (len(names) + cols - 1) // cols
sheet = Image.new("RGB", (cols * cw, rows * ch), (36, 30, 26))
d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    sp = Image.open(f"{OUT}/{n}.png")
    px, py = (i % cols) * cw, (i // cols) * ch
    sp2 = sp.copy()
    sp2.thumbnail((cw - 14, ch - 30))
    sheet.paste(sp2, (px + 7, py + 24), sp2)
    d.text((px + 7, py + 5), n, fill=(225, 225, 225))
sheet.save(f"{BASE}/qa/dog_sprite_sheet.png")
print("sheet saved")
