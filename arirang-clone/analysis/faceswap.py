#!/usr/bin/env python3
"""Face-swap: keep the ORIGINAL video untouched (natural motion), and replace only
the dog's FACE (eyes/nose region) with the user's dog face on front-facing frames."""
import os
import numpy as np
import cv2

BASE = "/Users/young2026/Downloads/AI /AI_game/arirang-clone"
FRAMES = f"{BASE}/dog-analysis/frames"
OUT = f"{BASE}/dog-analysis/frames_face"
os.makedirs(OUT, exist_ok=True)

# ---- their dog's face patch from the photo cutout ----
cut = cv2.imread(f"{BASE}/dog-analysis/ourdog_cutout.png", cv2.IMREAD_UNCHANGED)
a = cut[:, :, 3].astype(np.float32) / 255.0
ys, xs = np.where(a > 0.5)
bx0, bx1, by0, by1 = xs.min(), xs.max(), ys.min(), ys.max()

# face dark features within the head area of the photo
head = cut[by0:by0 + int((by1 - by0) * 0.55), bx0:bx1]
lum = head.max(axis=2)
dk = (lum < 95).astype(np.uint8)
dk = cv2.morphologyEx(dk, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
dn, dl, dst, dct = cv2.connectedComponentsWithStats(dk)
cands = [(dst[i], dct[i]) for i in range(1, dn) if dst[i][4] > 150]
cands.sort(key=lambda c: c[1][1])  # top to bottom (eyes first, nose last)
assert cands, "no dark features in photo"
tw = sum(s[4] for s, _ in cands)
pfx = sum(c[0] * s[4] for s, c in cands) / tw
pfy = sum(c[1] * s[4] for s, c in cands) / tw
p_spread = math_spread = float(np.sqrt(sum(s[4] for s, _ in cands) / max(1, len(cands))))
print(f"photo face anchor=({pfx:.0f},{pfy:.0f}) spread={p_spread:.0f}")

# patch: elliptical region around the eyes/nose, excluding the mouth below
pad_x = int(p_spread * 2.6)
pad_top = int(p_spread * 1.9)
pad_bot = int(p_spread * 1.15)
ex0, ex1 = max(0, int(pfx - pad_x)), min(cut.shape[1], int(pfx + pad_x))
ey0, ey1 = max(0, int(pfy - pad_top)), min(cut.shape[0], int(pfy + pad_bot))
patch = cut[by0 + ey0:by0 + ey1, bx0 + ex0:bx0 + ex1].copy()
ph, pw = patch.shape[:2]
# feathered elliptical alpha
yy, xx = np.mgrid[0:ph, 0:pw]
ecx, ecy = pfx - ex0, pfy - ey0
ry = (ecy - 0) * 0.92 + (pad_bot) * 0.55  # ellipse center between top and chin
ell = (((xx - ecx) / (pw * 0.5)) ** 2 + ((yy - ecy) / ((ey1 - ey0) * 0.5)) ** 2) <= 1.0
m = (ell & (patch[:, :, 3] > 60)).astype(np.float32)
m = cv2.GaussianBlur(m, (0, 0), 7.0)
patch[:, :, 3] = (m * 255).astype(np.uint8)
patch_mean = patch[:, :, :3].reshape(-1, 3)[patch[:, :, 3].reshape(-1) > 200].mean(axis=0)
print("patch", patch.shape, "mean", patch_mean.round(1))
cv2.imwrite(f"{BASE}/qa/face_patch.png", patch)

# ---- per-frame video face detection ----
# The dog is always center-frame; its eyes/nose are dark features inside a tight
# face window. No bright-blob step: the lit wall behind the dog defeats it.
def detect_face(img):
    x0, x1, y0, y1 = 285, 445, 555, 740
    roi = img[y0:y1, x0:x1]
    lum = roi.max(axis=2)
    dk = (lum < 95).astype(np.uint8)
    dk = cv2.morphologyEx(dk, cv2.MORPH_CLOSE, np.ones((11, 11), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(dk)
    cands = []
    for i in range(1, n):
        s = stats[i]
        if not (60 <= s[4] <= 2600):
            continue
        if s[1] <= 4:  # touches window top (ear fur) -> skip
            continue
        cands.append((s, cent[i]))
    if not cands:
        return None
    pts = [(c[0] + x0, c[1] + y0, s[4]) for s, c in cands]
    pts.sort(key=lambda p: p[1])
    ys = np.array([p[1] for p in pts])
    groups = np.split(ys, np.where(np.diff(ys) > 90)[0] + 1)
    biggest = max(groups, key=len)
    gset = set(biggest.tolist())
    sel = [p for p in pts if p[1] in gset]
    tw = sum(p[2] for p in sel)
    if tw < 150:
        return None
    fx = sum(p[0] * p[2] for p in sel) / tw
    fy = sum(p[1] * p[2] for p in sel) / tw
    spread = float(np.sqrt(tw / max(1, len(sel))))
    conf = min(1.0, tw / 500.0)
    return fx, fy, spread, conf

files = sorted(os.listdir(FRAMES))
tracks = []
last = None
for i in range(len(files)):
    img = cv2.imread(f"{FRAMES}/{files[i]}")
    d = detect_face(img)
    if d is None:
        tracks.append(last)
        continue
    fx, fy, sp, conf = d
    if last is None:
        last = (fx, fy, sp, conf, 1.0)
    else:
        a = 0.45 if conf > 0.4 else 0.15
        last = (last[0] + (fx - last[0]) * a,
                last[1] + (fy - last[1]) * a,
                last[2] + (sp - last[2]) * 0.2,
                max(conf, last[4] * 0.9), 1.0)
    tracks.append(last)

# head-width keyframes (same table as the head-swap pass) for patch scale
KEY = [
    (0.0, 360, 815, 260), (1.2, 368, 720, 262), (1.7, 388, 632, 272),
    (4.0, 392, 655, 292), (5.7, 372, 600, 268), (8.2, 402, 588, 268),
    (10.6, 390, 648, 280), (14.2, 362, 592, 262), (16.4, 390, 648, 280),
    (28.0, 390, 650, 282),
]


def cw_at(t):
    for i in range(len(KEY) - 1):
        t0, _, _, w0 = KEY[i]
        t1, _, _, w1 = KEY[i + 1]
        if t0 <= t <= t1:
            u = (t - t0) / max(1e-6, t1 - t0)
            u = u * u * (3 - 2 * u)
            return w0 + (w1 - w0) * u
    return KEY[-1][3]


# ---- composite ----
k = 0
cap_mean = None
for i, f in enumerate(files):
    img = cv2.imread(f"{FRAMES}/{f}")
    t = i / 24.0
    tr = tracks[i]
    if tr is not None and tr[4] > 0.4 and tr[3] > 0.25:
        fx, fy, sp, conf, _ = tr
        growth = 0.88 + 0.12 * min(1.0, max(0.0, (t - 1.2) / 8))
        scale = (cw_at(t) * 0.55 * growth) / pw
        p2 = cv2.resize(patch, (int(pw * scale), int(ph * scale)), interpolation=cv2.INTER_AREA)
        ph2, pw2 = p2.shape[:2]
        # face anchor of the patch (dark centroid within the patch)
        pl = p2[:, :, :3].max(axis=2)
        pd = (pl < 95).astype(np.uint8)
        if pd.sum() > 60:
            pys, pxs = np.where(pd > 0)
            afx, afy = float(pxs.mean()), float(pys.mean())
        else:
            afx, afy = pw2 * 0.5, ph2 * 0.5
        px0 = int(fx - afx)
        py0 = int(fy - afy)
        x0d, y0d = max(0, px0), max(0, py0)
        x1d, y1d = min(720, px0 + pw2), min(1280, py0 + ph2)
        if x1d > x0d and y1d > y0d:
            sub = p2[y0d - py0: y1d - py0, x0d - px0: x1d - px0].astype(np.float32)
            al = sub[:, :, 3:4] / 255.0
            # color match: bright pixels of patch vs bright pixels of the video face area
            region = img[max(0, int(fy) - 90): int(fy) + 90, max(0, int(fx) - 110): int(fx) + 110]
            rm = region.max(axis=2)
            rmask = rm > 195
            if rmask.sum() > 300:
                rp = region[rmask].reshape(-1, 3).mean(axis=0)
                cap_mean = rp if cap_mean is None else cap_mean * 0.9 + rp * 0.1
            if cap_mean is not None:
                sel = sub[:, :, 3].reshape(-1) > 200
                if sel.sum() > 400:
                    om = sub[:, :, :3].reshape(-1, 3)[sel].mean(axis=0)
                    gain = np.clip(cap_mean / np.maximum(om, 1), 0.8, 1.3)
                    sub[:, :, :3] = np.clip(sub[:, :, :3] * gain[None, None, :], 0, 255)
            roi = img[y0d:y1d, x0d:x1d].astype(np.float32)
            img[y0d:y1d, x0d:x1d] = (roi * (1 - al) + sub[:, :, :3] * al).astype(np.uint8)
            k += 1
    cv2.imwrite(f"{OUT}/{f}", img, [cv2.IMWRITE_JPEG_QUALITY, 96])
print("face-swapped frames:", k, "/", len(files))
