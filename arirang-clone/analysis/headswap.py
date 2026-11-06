#!/usr/bin/env python3
"""Head-swap: paste the user's dog head (photo cutout) over the video dog's head,
per frame, with tracking + per-frame color matching. Writes swapped frames."""
import os, subprocess, math
from collections import deque
import numpy as np
import cv2

BASE = "/Users/young2026/Downloads/AI /AI_game/arirang-clone"
SRC = f"{BASE}/app/public/dog-source.mp4"
FRAMES = f"{BASE}/dog-analysis/frames"
OUT = f"{BASE}/dog-analysis/frames_swap"
os.makedirs(FRAMES, exist_ok=True)
os.makedirs(OUT, exist_ok=True)

# 1) decode frames
have = len([f for f in os.listdir(FRAMES) if f.endswith('.jpg')])
if have < 670:
    subprocess.run([
        'ffmpeg', '-y', '-v', 'error', '-i', SRC,
        '-vf', 'scale=720:1280', f'{FRAMES}/f_%04d.jpg'
    ], check=True)
n = len(sorted(os.listdir(FRAMES)))
print('frames:', n)

# 2) head sprite from the photo cutout
cut = cv2.imread(f"{BASE}/dog-analysis/ourdog_cutout.png", cv2.IMREAD_UNCHANGED)
a = cut[:, :, 3].astype(np.float32) / 255.0
ys, xs = np.where(a > 0.5)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
# head crop: ears to just below the muzzle, with bottom fade
HX0, HY0, HX1, HY1 = x0 + 30, y0, x1 - 30, y0 + int((y1 - y0) * 0.52)
head = cut[HY0:HY1, HX0:HX1].copy()
hh, hw = head.shape[:2]
fade = np.ones((hh, hw), np.float32)
F = int(hh * 0.34)
fade[-F:, :] = np.linspace(1, 0, F)[:, None]
head[:, :, 3] = (head[:, :, 3].astype(np.float32) * fade).astype(np.uint8)
# feather all edges slightly
head_a = cv2.GaussianBlur(head[:, :, 3], (0, 0), 2.2)
head[:, :, 3] = head_a
# base per-channel mean color of sprite (for color matching)
am = head[:, :, 3:4].astype(np.float32) / 255.0
head_mean = (head[:, :, :3].astype(np.float32) * am).reshape(-1, 3).sum(axis=0) / (am.sum())
print('head sprite', head.shape, 'mean', head_mean.round(1))

# 3) manual head keyframes per pose phrase (camera is static; pose timeline known)
KEY = [
    (0.0, 360, 815, 260),
    (1.2, 368, 720, 262),
    (1.7, 388, 632, 272),
    (4.0, 392, 655, 292),
    (5.7, 372, 600, 268),
    (8.2, 402, 588, 268),
    (10.6, 390, 648, 280),
    (14.2, 362, 592, 262),
    (16.4, 390, 648, 280),
    (28.0, 390, 650, 282),
]

def head_at(t):
    for i in range(len(KEY) - 1):
        t0, x0, y0, w0 = KEY[i]
        t1, x1, y1, w1 = KEY[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            u = u * u * (3 - 2 * u)
            return (x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, w0 + (w1 - w0) * u)
    return (KEY[-1][1], KEY[-1][2], KEY[-1][3])

files = sorted(os.listdir(FRAMES))

results = []
for i in range(len(files)):
    t = i / 24.0
    cx, cy, cw = head_at(t)
    jx = math.sin(t * 2.1 + 1.3) * 4 + math.sin(t * 5.3) * 2
    jy = math.sin(t * 1.7) * 3
    results.append((cx + jx, cy + jy, cw, (cx, cy + 140)))
sm = results

# 4) composite per frame
k = 0
cap_mean = None
for i, f in enumerate(files):
    img = cv2.imread(f"{FRAMES}/{f}")
    cx, cy, hw_target, body_c = sm[i]
    body = img[
        max(0, int(body_c[1]) - 40): int(body_c[1]) + 160,
        max(0, int(body_c[0]) - 90): int(body_c[0]) + 90,
    ]
    bm = body.max(axis=2)
    bmask = bm > 195
    if bmask.sum() > 400:
        bp = body[bmask].reshape(-1, 3).mean(axis=0)
        cap_mean = bp if cap_mean is None else cap_mean * 0.92 + bp * 0.08
    scale = hw_target * 1.18 / hw
    head2 = cv2.resize(head, (int(hw * scale), int(hh * scale)), interpolation=cv2.INTER_AREA)
    h2 = head2.astype(np.float32)
    if cap_mean is not None:
        gain = np.clip(cap_mean / np.maximum(head_mean, 1), 0.72, 1.4)
        h2[:, :, :3] = np.clip(h2[:, :, :3] * gain[None, None, :], 0, 255)
    hh2, hw2 = h2.shape[:2]
    px0 = int(cx - hw2 * 0.5)
    py0 = int(cy - hh2 * 0.44)
    x0d, y0d = max(0, px0), max(0, py0)
    x1d, y1d = min(720, px0 + hw2), min(1280, py0 + hh2)
    if x1d <= x0d or y1d <= y0d:
        cv2.imwrite(f"{OUT}/{f}", img)
        continue
    sub = h2[y0d - py0: y1d - py0, x0d - px0: x1d - px0]
    al = sub[:, :, 3:4] / 255.0
    roi = img[y0d:y1d, x0d:x1d].astype(np.float32)
    roi = roi * (1 - al) + sub[:, :, :3] * al
    img[y0d:y1d, x0d:x1d] = roi.astype(np.uint8)
    cv2.imwrite(f"{OUT}/{f}", img, [cv2.IMWRITE_JPEG_QUALITY, 96])
    k += 1
print('composited', k, 'frames')
