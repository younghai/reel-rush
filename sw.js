/* REEL RUSH — Service Worker
 * Zero-dependency offline app shell.
 * - install:  precache the app shell (missing files are tolerated)
 * - activate: drop old caches, take control of open clients
 * - fetch:    network-first for navigations, cache-first for static assets
 * Never caches non-GET or cross-origin responses. Never throws to pages.
 */
'use strict';

const CACHE = 'reelrush-v3';

const SHELL = [
  'index.html',
  'css/style.css',
  'js/main.js',
  'js/config.js',
  'js/fishing.js',
  'js/scenes.js',
    'js/scenes/world.js', 'js/scenes/hud.js', 'js/scenes/fishdraw.js',
  'js/juice.js',
  'js/economy.js',
  'js/i18n.js',
  'js/music.js',
  'js/quests.js',
  'js/data/fishes.js',
  'js/audio.js',
  'report.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE);
      // allSettled-style: one missing/broken file must not fail the install.
      await Promise.allSettled(SHELL.map((url) => cache.add(url)));
    } catch (_) {
      /* partial precache is acceptable; runtime caching covers the rest */
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((name) => name !== CACHE).map((name) => caches.delete(name))
      );
    } catch (_) {
      /* ignore cleanup failures */
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  try {
    const url = new URL(req.url);

    // NEVER cache non-GET or cross-origin requests — let the browser handle them.
    if (req.method !== 'GET' || url.origin !== self.location.origin) return;

    if (req.mode === 'navigate') {
      event.respondWith(handleNavigation(req));
    } else {
      event.respondWith(handleAsset(req));
    }
  } catch (_) {
    /* swallow: the SW must never throw to pages */
  }
});

/* Navigation requests: network-first -> cache -> built-in offline message. */
async function handleNavigation(req) {
  try {
    const fresh = await fetch(req);
    putInBackground(req, fresh);
    return fresh;
  } catch (_) {
    try {
      const cached =
        (await caches.match(req, { ignoreSearch: true })) ||
        (await caches.match('index.html'));
      if (cached) return cached;
    } catch (_) {
      /* fall through to the offline page */
    }
    return offlineMessage();
  }
}

/* Static assets: cache-first; on miss, fetch + fill the cache for next time. */
async function handleAsset(req) {
  let cache = null;
  try {
    cache = await caches.open(CACHE);
  } catch (_) {
    /* storage unavailable — degrade to network-only */
  }

  if (cache) {
    try {
      const hit = await cache.match(req);
      if (hit) return hit;
    } catch (_) {
      /* ignore match failures */
    }
  }

  try {
    const fresh = await fetch(req);
    if (cache && fresh && fresh.ok) {
      try {
        await cache.put(req, fresh.clone());
      } catch (_) {
        /* non-cacheable response (opaque/partial) — ignore */
      }
    }
    return fresh;
  } catch (_) {
    if (cache) {
      try {
        const stale = await cache.match(req);
        if (stale) return stale;
      } catch (_) {
        /* ignore */
      }
    }
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

/* Cache a good response without blocking the reply or ever throwing. */
function putInBackground(req, res) {
  try {
    if (!res || !res.ok) return;
    const copy = res.clone();
    caches
      .open(CACHE)
      .then((cache) => cache.put(req, copy))
      .catch(() => {});
  } catch (_) {
    /* ignore */
  }
}

/* Minimal bilingual offline fallback page (no external file needed). */
function offlineMessage() {
  const html =
    '<!doctype html><html lang="ko"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>REEL RUSH — 오프라인</title></head>' +
    '<body style="margin:0;height:100vh;display:grid;place-items:center;' +
    'background:#04121c;color:#ffd76a;font-family:system-ui,-apple-system,sans-serif;' +
    'text-align:center">' +
    '<div><h1 style="font-size:32px;margin:0 0 10px;letter-spacing:2px">REEL RUSH</h1>' +
    '<p style="margin:0;color:#9fc6de;line-height:1.6">' +
    '오프라인 상태입니다 · You are offline<br>네트워크 연결 후 다시 시도해 주세요.</p></div>' +
    '</body></html>';
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
