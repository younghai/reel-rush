#!/usr/bin/env python3
"""Analyze the Arirang reference clip: marimba onsets, loudness envelope, per-second colors."""
import json, wave, struct, math
import numpy as np

BASE = "/Users/young2026/Downloads/AI /AI_game/arirang-clone/analysis"

# ---------- audio ----------
wf = wave.open(f"{BASE}/audio.wav", "rb")
sr = wf.getframerate()
n = wf.getnframes()
x = np.frombuffer(wf.readframes(n), dtype=np.int16).astype(np.float64) / 32768.0
wf.close()
dur = n / sr

# RMS envelope (50ms hop)
hop = int(sr * 0.05)
win = hop * 2
rms = []
for i in range(0, n - win, hop):
    seg = x[i:i + win]
    rms.append(float(np.sqrt(np.mean(seg ** 2))))
rms = np.array(rms)

# spectral flux onsets
N, H = 1024, 256
frames = 1 + (n - N) // H
w = np.hanning(N)
mag = np.zeros((frames, N // 2 + 1))
for f in range(frames):
    seg = x[f * H: f * H + N] * w
    mag[f] = np.abs(np.fft.rfft(seg))
flux = np.maximum(0.0, np.diff(mag, axis=0)).sum(axis=1)
flux = np.concatenate([[0.0], flux])
# smooth
k = 3
kernel = np.ones(k) / k
fs = np.convolve(flux, kernel, mode="same")

onsets = []
i = 1
while i < len(fs) - 1:
    if fs[i] > fs[i - 1] and fs[i] >= fs[i + 1]:
        lo, hi = max(0, i - 43), min(len(fs), i + 43)  # ~0.5s window
        thresh = fs[lo:hi].mean() * 1.4 + 1e-4
        if fs[i] > thresh:
            t = i * H / sr
            # local max refinement within 30ms
            lo2 = max(0, i - int(0.03 * sr / H))
            hi2 = min(len(fs), i + int(0.03 * sr / H) + 1)
            j = lo2 + int(np.argmax(fs[lo2:hi2]))
            t = j * H / sr
            if not onsets or t - onsets[-1][0] > 0.07:
                onsets.append((t, float(fs[j] / (fs[lo:hi].mean() + 1e-9))))
    i += 1

first_sound = float(np.argmax(rms > 0.004)) * 0.05

# ---------- per-second colors from 1fps thumbs ----------
import os, glob
from PIL import Image
colors = []
for p in sorted(glob.glob(f"{BASE}/frame_*.jpg")):
    im = Image.open(p).convert("RGB").resize((60, 107))
    a = np.asarray(im).astype(float)
    # background estimate: median of darkest 60% pixels
    lum = a.mean(axis=2)
    mask = lum < np.percentile(lum, 60)
    c = a[mask].mean(axis=0)
    colors.append([round(float(v), 1) for v in c])

out = {
    "duration": dur, "sr": sr,
    "first_sound": first_sound,
    "rms_50ms": [round(float(v), 5) for v in rms],
    "onsets": [{"t": round(t, 3), "s": round(s, 2)} for t, s in onsets],
    "bg_colors_per_sec": colors,
}
with open(f"{BASE}/timing.json", "w") as f:
    json.dump(out, f, indent=1)
print(f"duration={dur:.3f}s first_sound={first_sound:.3f}s onsets={len(onsets)}")
print("first 12 onsets:", [round(t, 2) for t, _ in onsets[:12]])
print("last 6 onsets:", [round(t, 2) for t, _ in onsets[-6:]])
print("onset intervals:", [round(onsets[i+1][0]-onsets[i][0], 2) for i in range(min(25, len(onsets)-1))])
