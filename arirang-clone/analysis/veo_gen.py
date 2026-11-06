#!/usr/bin/env python3
"""Submit 4 Veo 3.1 image-to-video jobs (the dancing Pomeranian) and poll to completion."""
import base64, json, os, sys, time
import urllib.request

KEY = "AQ.Ab8RN6JTYhPO9LzjfN65maPDUI9XwQCyS98o5ex2LpNRYsZpng"
API = "https://generativelanguage.googleapis.com/v1beta"
MODEL = "veo-3.1-fast-generate-preview"
FIRST = "/Users/young2026/Downloads/AI /AI_game/arirang-clone/dog-analysis/veo_first_frame.jpg"
OUTDIR = "/Users/young2026/Downloads/AI /AI_game/arirang-clone/dog-analysis/veo"
os.makedirs(OUTDIR, exist_ok=True)

with open(FIRST, "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode()

BASE_PROMPT = (
    "Cinematic vertical music video. The exact fluffy cream Pomeranian dog from the image "
    "dances on a dark theater stage, staying centered and facing the camera. Two young female "
    "backup dancers in all-black streetwear groove behind it, whipping their long hair in sync. "
    "Five warm tungsten spotlights glow in a row above, hazy beams, glossy dark reflective floor "
    "showing soft reflections. Warm amber stage lighting, shallow depth of field, music video grade."
)
SEGMENTS = [
    ("seg1", "The dog first sniffs the floor with its fluffy head down, then lifts its head up "
             "and bounces once on all four paws, fur rippling. The dancers behind it sway side to side. "
             "Playful, bouncy energy."),
    ("seg2", "The dog bounces happily left and right on all four paws to the beat, ears and fluffy "
             "fur bouncing, mouth closed then opening. The dancers behind it do hair-whip moves. "
             "Playful, bouncy energy."),
    ("seg3", "The dog shakes its whole body left and right, fluffy fur swinging wildly, then bounces "
             "in place with its mouth open and tongue out. The two dancers behind it spin with huge "
             "hair whips. Playful, high energy."),
    ("seg4", "The dog stands tall and bounces in place to the beat, mouth open with tongue out, "
             "looking straight at the camera, fur bouncing softly. The dancers behind it raise their "
             "arms in rhythm. Playful, confident finale energy."),
]

NEG = "text, watermark, logo, captions, extra dogs, humans in front of the dog, cartoon, deformed face"


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"x-goog-api-key": KEY, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


def get(url):
    req = urllib.request.Request(url, headers={"x-goog-api-key": KEY})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read())


ops = {}
for name, extra in SEGMENTS:
    body = {
        "instances": [{"prompt": f"{BASE_PROMPT} {extra}", "image": {"bytesBase64Encoded": img_b64, "mimeType": "image/jpeg"}}],
        "parameters": {"aspectRatio": "9:16", "resolution": "720p", "durationSeconds": 8, "negativePrompt": NEG},
    }
    try:
        r = post(f"{API}/models/{MODEL}:predictLongRunning", body)
        ops[name] = r["name"]
        print(f"submitted {name}: {r['name']}", flush=True)
    except Exception as e:
        print(f"submit {name} FAILED: {e}", flush=True)

with open(f"{OUTDIR}/ops.json", "w") as f:
    json.dump(ops, f, indent=1)

# poll
done = {}
deadline = time.time() + 25 * 60
while len(done) < len(ops) and time.time() < deadline:
    time.sleep(20)
    for name, opname in list(ops.items()):
        if name in done:
            continue
        try:
            st = get(f"{API}/{opname}")
        except Exception as e:
            print(f"poll {name} err: {e}", flush=True)
            continue
        if st.get("done"):
            resp = st.get("response", {})
            samples = resp.get("generateVideoResponse", {}).get("generatedSamples", [])
            if samples:
                uri = samples[0]["video"]["uri"]
                try:
                    req = urllib.request.Request(uri, headers={"x-goog-api-key": KEY})
                    with urllib.request.urlopen(req, timeout=300) as r:
                        data = r.read()
                    p = f"{OUTDIR}/{name}.mp4"
                    with open(p, "wb") as f2:
                        f2.write(data)
                    done[name] = p
                    print(f"DONE {name}: {p} ({len(data)//1024} KB)", flush=True)
                except Exception as e:
                    print(f"download {name} err: {e}", flush=True)
            else:
                print(f"DONE {name} but no samples: {json.dumps(st)[:400]}", flush=True)
                done[name] = None
    print(f"status: {len(done)}/{len(ops)}", flush=True)

print(json.dumps(done, indent=1))
