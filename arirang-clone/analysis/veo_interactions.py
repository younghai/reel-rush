#!/usr/bin/env python3
"""Generate dancing-Pomeranian clips with the Gemini Interactions API (gemini-omni-1.1-flash,
the model that replaced Veo 3.1). Requires a BILLING-ENABLED Gemini API key — free tier has a
hard limit of 0 requests/day for this model (verified 2026-11-04).

Usage: python3 veo_interactions.py <API_KEY>
Stages: submit 4 segment jobs (subject-reference photos + prompt) -> poll -> download MP4s.
If the exact Interactions request shape differs, the API error will guide a small fix here.
"""
import base64, json, os, sys, time
import urllib.request, urllib.error

KEY = sys.argv[1] if len(sys.argv) > 1 else ""
API = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "gemini-omni-1.1-flash"
BASE = "/Users/young2026/Downloads/AI /AI_game/arirang-clone"
OUTDIR = f"{BASE}/dog-analysis/veo"
os.makedirs(OUTDIR, exist_ok=True)

PHOTOS = [f"{BASE}/dog-analysis/photos/p{i}.jpg" for i in (1, 2, 4)]

SCENE = (
    "Cinematic vertical music video. The exact orange-red fluffy Pomeranian dog from the "
    "reference photos — small young Pomeranian, golden-orange coat, white chest, dark round "
    "eyes, pink tongue — dances happily on a dark theater stage, centered, facing the camera. "
    "Two young female backup dancers in all-black streetwear groove behind it, whipping long "
    "hair in sync. Five warm tungsten spotlights in a row above, hazy beams, glossy dark "
    "reflective stage floor with soft reflections. Warm amber lighting, shallow depth of field, "
    "music video grade."
)
SEGMENTS = [
    ("seg1", "The dog sniffs the floor head-down, then lifts its head and bounces once on all "
             "four paws, fur rippling. Dancers sway side to side behind it."),
    ("seg2", "The dog bounces happily left and right on all four paws to the beat, ears and fur "
             "bouncing. The dancers behind it do hair-whip moves."),
    ("seg3", "The dog shakes its whole body left and right, fur swinging wildly, then bounces in "
             "place with its mouth open and tongue out. The dancers spin with huge hair whips."),
    ("seg4", "The dog stands tall and bounces in place to the beat, mouth open, tongue out, "
             "looking at the camera. The dancers raise their arms in rhythm."),
]
NEG = "text, watermark, logo, captions, extra dogs, humans in front of the dog, cartoon, deformed face, different dog breed"


def req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=180) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": json.loads(e.read().decode())}


def build_input(extra):
    """Interactions API input: reference photos + scene/motion prompt."""
    return {
        "model": MODEL,
        "input": [
            {"type": "text", "text": f"{SCENE} {extra}. No on-screen text or logos. {NEG}"},
            *[{"type": "image", "uri_or_data": None} for _ in ()],  # placeholder
        ],
    }


def main():
    if not KEY:
        print("usage: veo_interactions.py <BILLING_ENABLED_API_KEY>")
        sys.exit(1)

    # NOTE: exact image-attachment shape is verified against API errors on first run.
    jobs = {}
    for name, extra in SEGMENTS:
        body = {
            "model": MODEL,
            "input": SCENE + " " + extra,
            "references": [{"mime_type": "image/jpeg",
                            "data": base64.b64encode(open(p, "rb").read()).decode()} for p in PHOTOS],
            "response_modalities": ["video"],
            "generation_config": {"aspect_ratio": "9:16", "duration_seconds": 8,
                                  "resolution": "720p", "negative_prompt": NEG},
        }
        r = req("POST", f"{API}/interactions", body)
        if "error" in r:
            print(f"{name}: ERROR {json.dumps(r['error'])[:500]}", flush=True)
            print("-> adjust request shape per the error, then re-run.", flush=True)
            sys.exit(2)
        jobs[name] = r.get("name") or r.get("id")
        print(f"submitted {name}: {jobs[name]}", flush=True)
        time.sleep(5)

    done, deadline = {}, time.time() + 30 * 60
    while len(done) < len(jobs) and time.time() < deadline:
        time.sleep(20)
        for name, jid in jobs.items():
            if name in done:
                continue
            st = req("GET", f"{API}/interactions/{jid}")
            status = st.get("status", "")
            if status in ("completed", "succeeded"):
                out = st.get("output", {})
                uri = None
                if isinstance(out, list):
                    for o in out:
                        uri = o.get("video_uri") or o.get("uri") or (o.get("video") or {}).get("uri")
                        if uri:
                            break
                if not uri:
                    print(f"{name}: completed but no video uri: {json.dumps(st)[:400]}", flush=True)
                    done[name] = None
                    continue
                rr = urllib.request.Request(uri, headers={"x-goog-api-key": KEY})
                with urllib.request.urlopen(rr, timeout=300) as resp:
                    data = resp.read()
                p = f"{OUTDIR}/{name}.mp4"
                open(p, "wb").write(data)
                done[name] = p
                print(f"DONE {name}: {p} ({len(data)//1024} KB)", flush=True)
            elif status in ("failed", "errored"):
                print(f"{name}: FAILED {json.dumps(st)[:400]}", flush=True)
                done[name] = None
        print(f"status {len(done)}/{len(jobs)}", flush=True)

    print(json.dumps(done, indent=1))


if __name__ == "__main__":
    main()
