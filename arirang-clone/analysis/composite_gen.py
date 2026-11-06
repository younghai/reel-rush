#!/usr/bin/env python3
"""Composite the LivePortrait-generated animated head onto the body frames."""
import os, subprocess
import numpy as np
import cv2

BASE = "/Users/young2026/Downloads/AI /AI_game/arirang-clone"
GEN_DIR = f"{BASE}/dog-analysis/gen"
OUT = f"{BASE}/dog-analysis/frames_gen"
os.makedirs(GEN_DIR, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

# find the generated mp4
gen_mp4 = None
for root, _, fs in os.walk('/tmp/LivePortrait/animations'):
    for f in fs:
        if f.endswith('.mp4'):
            p = os.path.join(root, f)
            if gen_mp4 is None or os.path.getmtime(p) > os.path.getmtime(gen_mp4):
                gen_mp4 = p
print('generated:', gen_mp4)
have = len([f for f in os.listdir(GEN_DIR) if f.endswith('.png')])
if have < 670:
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', gen_mp4, f'{GEN_DIR}/g_%04d.png'], check=True)
gfiles = sorted(os.listdir(GEN_DIR))
print('gen frames:', len(gfiles))

# green key per frame -> RGBA
BG = np.array([24, 26, 30], np.float32)  # BGR of the source background (warm dark)


def key_green(frame_bgr):
    dist = np.linalg.norm(frame_bgr.astype(np.float32) - BG[None, None, :], axis=2)
    alpha = np.clip((dist - 11) / 26.0, 0, 1)
    a8 = (alpha * 255).astype(np.uint8)
    big = (a8 > 90).astype(np.uint8)
    big = cv2.morphologyEx(big, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    big = cv2.dilate(big, np.ones((9, 9), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(big)
    keep = 1 + int(np.argmax(stats[1:, 4])) if n >= 2 else 0
    a8 = np.where(lab == keep, a8, 0).astype(np.uint8)
    core = cv2.erode((a8 > 120).astype(np.uint8), np.ones((13, 13), np.uint8))
    a8 = cv2.GaussianBlur((core * 255), (0, 0), 4.5)
    hole = ((a8 > 0) & (core == 0)).astype(np.uint8)
    if hole.sum() > 0:
        f2 = cv2.inpaint(frame_bgr, hole * 255, 5, cv2.INPAINT_TELEA)
    else:
        f2 = frame_bgr
    # warm-shift the feather band (kill any blue/cyan cast from the source bg)
    b2, g2, r2 = f2[:, :, 0].astype(np.float32), f2[:, :, 1].astype(np.float32), f2[:, :, 2].astype(np.float32)
    band = (a8 > 0) & (a8 < 245)
    f2[:, :, 0] = np.where(band & (b2 > r2 + 4), r2 + 4, b2)  # clamp blue to red+4
    f2[:, :, 1] = np.where(band & (g2 > r2 + 8), r2 + 8, g2)
    return np.dstack([f2, a8])

g0 = cv2.imread(f"{GEN_DIR}/{gfiles[0]}")
src_face = key_green(g0)
am = src_face[:, :, 3].astype(np.float32) / 255.0
ys, xs = np.where(am > 0.4)
src_face_w = float(xs.max() - xs.min())
print('src face width', src_face_w)


def gen_bbox(rgba):
    am = rgba[:, :, 3].astype(np.float32) / 255.0
    am = cv2.morphologyEx((am > 0.35).astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(am)
    if n < 2:
        return None
    best = 1 + int(np.argmax(stats[1:, 4]))
    x, y, w, h, area = stats[best]
    if area < 3000:
        return None
    # face anchor: centroid of dark pixels (eyes/nose) in the blob's upper 60%
    roi = rgba[y:y + int(h * 0.6), x:x + w]
    lum = roi.max(axis=2)
    dk = (lum < 95) & (lab[y:y + int(h * 0.6), x:x + w] == best)
    dk = cv2.morphologyEx(dk.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    dn, dl, dst, dct = cv2.connectedComponentsWithStats(dk)
    if dn >= 2:
        cands = [(dst[i], dct[i]) for i in range(1, dn) if dst[i][4] > 150]
        cands = [c for c in cands if abs(c[1][0] - w / 2) < w * 0.5]
        if cands:
            tw = sum(s[4] for s, _ in cands)
            fx = sum(c[0] * s[4] for s, c in cands) / tw
            fy = sum(c[1] * s[4] for s, c in cands) / tw
            return x, y, w, h, (x + fx, y + fy + 8)
    return x, y, w, h, cent[best]

# body color sampling center per keyframe table (same as headswap)
KEY = [
    (0.0, 360, 815, 260), (1.2, 368, 720, 262), (1.7, 388, 632, 272),
    (4.0, 392, 655, 292), (5.7, 372, 600, 268), (8.2, 402, 588, 268),
    (10.6, 390, 648, 280), (14.2, 362, 592, 262), (16.4, 390, 648, 280),
    (28.0, 390, 650, 282),
]
def head_at(t):
    for i in range(len(KEY) - 1):
        t0, x0k, y0k, w0k = KEY[i]
        t1, x1k, y1k, w1k = KEY[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            u = u * u * (3 - 2 * u)
            return (x0k + (x1k - x0k) * u, y0k + (y1k - y0k) * u, w0k + (w1k - w0k) * u)
    return (KEY[-1][1], KEY[-1][2], KEY[-1][3])

import math
files = sorted(os.listdir(f"{BASE}/dog-analysis/frames"))
cap_mean = None
k = 0
for i, f in enumerate(files):
    img = cv2.imread(f"{BASE}/dog-analysis/frames/{f}")
    t = i / 24.0
    cx, cy, cw = head_at(t)
    jx = math.sin(t * 2.1 + 1.3) * 4 + math.sin(t * 5.3) * 2
    jy = math.sin(t * 1.7) * 3
    cx += jx
    cy += jy
    gf = gfiles[min(i, len(gfiles) - 1)]
    gen = cv2.imread(f"{GEN_DIR}/{gf}")
    rgba = key_green(gen)
    bb = gen_bbox(rgba)
    if bb is None:
        cv2.imwrite(f"{OUT}/{f}", img)
        continue
    bx, by, bw2, bh2, bcen = bb
    scale = (cw * 1.0) / max(1, bw2)
    rgba = cv2.resize(rgba, (int(rgba.shape[1] * scale), int(rgba.shape[0] * scale)), interpolation=cv2.INTER_AREA)
    hh2, hw2 = rgba.shape[:2]
    # map the generated head's face anchor onto the video dog's face anchor
    px0 = int(cx - bcen[0] * scale)
    py0 = int(cy - bcen[1] * scale)
    x0d, y0d = max(0, px0), max(0, py0)
    x1d, y1d = min(720, px0 + hw2), min(1280, py0 + hh2)
    if x1d <= x0d or y1d <= y0d:
        cv2.imwrite(f"{OUT}/{f}", img)
        continue
    sub = rgba[y0d - py0: y1d - py0, x0d - px0: x1d - px0].astype(np.float32)
    al = sub[:, :, 3:4] / 255.0
    # color match: bright fur pixels of overlay vs bright body pixels
    body = img[
        max(0, int(cy) - 60): int(cy) + 180,
        max(0, int(cx) - 100): int(cx) + 100,
    ]
    bm = body.max(axis=2)
    bmask = bm > 195
    if bmask.sum() > 400:
        bp = body[bmask].reshape(-1, 3).mean(axis=0)
        cap_mean = bp if cap_mean is None else cap_mean * 0.92 + bp * 0.08
    if cap_mean is not None:
        fm = sub[:, :, :3].reshape(-1, 3)[sub[:, :, 3].reshape(-1) > 200]
        if len(fm) > 500:
            om = fm.mean(axis=0)
            gain = np.clip(cap_mean / np.maximum(om, 1), 0.75, 1.35)
            sub[:, :, :3] = np.clip(sub[:, :, :3] * gain[None, None, :], 0, 255)
    # warm shift so the photo fur matches the stage's golden light
    sub[:, :, 0] = np.clip(sub[:, :, 0] - 7, 0, 255)
    sub[:, :, 2] = np.clip(sub[:, :, 2] + 7, 0, 255)
    roi = img[y0d:y1d, x0d:x1d].astype(np.float32)
    img[y0d:y1d, x0d:x1d] = (roi * (1 - al) + sub[:, :, :3] * al).astype(np.uint8)
    cv2.imwrite(f"{OUT}/{f}", img, [cv2.IMWRITE_JPEG_QUALITY, 96])
    k += 1
print('composited', k)
