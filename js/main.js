// REEL RUSH — bootstrap, game loop, input, DOM HUD wiring, debug hooks
import { W, H, UPGRADES, ZONES, RARITIES, DAY_LEN, CYCLE } from './config.js';
import { FISHES } from './data/fishes.js';
import { audio } from './audio.js';
import { Juice } from './juice.js';
import { Scene, drawFishPreview } from './scenes.js';
import { FishingGame } from './fishing.js';
import { Economy } from './economy.js';
import { t, fishName, rarityName, zoneName, timeName, getLocale, setLocale, detectLocale } from './i18n.js';
import { music } from './music.js';
import { quests, ACHIEVEMENTS } from './quests.js';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// ---------- canvas ----------
const canvas = $('#game');
const dpr = Math.min(window.devicePixelRatio || 1, 2);
canvas.width = W * dpr; canvas.height = H * dpr;
const ctx = canvas.getContext('2d');

// ---------- systems ----------
const juice = new Juice();
const economy = new Economy();
const scene = new Scene();
const game = { fg: null, juice, economy, scene, zone: ZONES[0] };

game.fg = new FishingGame({
  juice, audio, economy, fishes: FISHES,
  onEvent: (type, data) => handleEvent(type, data),
});
audio.setMuted(!!economy.s.muted);

// ---------- DOM refs ----------
const el = {
  coinNum: $('#coinNum'), coinPill: document.querySelector('.coin-pill'),
  comboPill: $('#comboPill'), comboNum: $('#comboNum'),
  timeIcon: $('#timeIcon'), zoneIcon: $('#zoneIcon'), zoneName: $('#zoneName'),
  muteBtn: $('#muteBtn'), localeBtn: $('#localeBtn'), localeLabel: $('#localeLabel'), musicBtn: $('#musicBtn'), zoneChips: $('#zoneChips'),
  btnLog: $('#btnLog'), btnShop: $('#btnShop'), btnQuests: $('#btnQuests'), questsPanel: $('#questsPanel'), qtabDaily: $('#qtab-daily'), qtabAch: $('#qtab-achievements'), coolerBadge: $('#coolerBadge'),
  hint: $('#hint'), toasts: $('#toasts'),
  shopPanel: $('#shopPanel'), logPanel: $('#logPanel'),
  tabUpgrades: $('#tab-upgrades'), tabCooler: $('#tab-cooler'),
  coolerList: $('#coolerList'), coolerCount: $('#coolerCount'), sellAllBtn: $('#sellAllBtn'),
  logGrid: $('#logGrid'), logProgress: $('#logProgress'),
  intro: $('#intro'), startBtn: $('#startBtn'),
};

// ---------- toasts ----------
function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = msg;
  el.toasts.appendChild(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 2200);
}

// ---------- quests & achievements ----------
const todayKey = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};
const QUEST_REWARDS = { catch_n_fish: 250, perfect_hooks: 300, sell_fish: 200, catch_at_night: 300, combo_x3: 400, earn_coins: 350, big_fish: 400 };
let questState = quests.deserialize(economy.s.quests ? JSON.stringify(economy.s.quests) : null);
let achSeenToday = false;
function persistQuests() { economy.s.quests = questState; economy.save(); }
function questEvent(event) {
  const newly = quests.record(questState, todayKey(), event);
  persistQuests();
  for (const q of newly) {
    if (!q.claimed) toast(t('toast.questDone', { n: (QUEST_REWARDS[q.id] ?? 200).toLocaleString() }), 'gold');
    juice.flash('#59d97e', 0.2, 160);
  }
  if (!el.questsPanel.hidden) renderQuests();
  checkAchievements();
}
function checkAchievements() {
  const states = quests.achievementState(economy.stats, economy.s.log, economy.s.achievements);
  let changed = false;
  for (const a of states) {
    if (a.isNew && a.unlocked) {
      const meta = ACHIEVEMENTS.find(x => x.id === a.id);
      const name = getLocale() === 'ko' ? meta.nameKo : meta.nameEn;
      toast(t('toast.achUnlocked', { name }), 'gold');
      juice.confetti(W / 2, 220, 60);
      audio.bigCatch();
      economy.s.achievements[a.id] = true;
      changed = true;
    }
  }
  if (changed) { economy.save(); if (!el.questsPanel.hidden) renderQuests(); }
}
let qTab = 'daily';
function renderQuests() {
  document.querySelectorAll('[data-qtab]').forEach(b => b.classList.toggle('active', b.dataset.qtab === qTab));
  el.qtabDaily.hidden = qTab !== 'daily';
  el.qtabAch.hidden = qTab !== 'achievements';
  const ko = getLocale() === 'ko';
  if (qTab === 'daily') {
    el.qtabDaily.innerHTML = '';
    for (const q of quests.daily(todayKey(), questState)) {
      q.claimed = !!(questState.claimed && questState.claimed[q.id]); // claim survives reload (quests.js resets it on rebuild)
      const row = document.createElement('div');
      row.className = 'quest-row' + (q.done ? ' done' : '');
      const reward = QUEST_REWARDS[q.id] ?? 200;
      row.innerHTML = `
        <div class="quest-icon">${q.icon}</div>
        <div class="quest-info">
          <div class="quest-name">${ko ? q.textKo : q.textEn}</div>
          <div class="quest-bar"><div style="width:${Math.min(100, q.progress / q.target * 100)}%"></div></div>
          <div class="quest-count">${Math.min(q.progress, q.target)} / ${q.target} · 🪙${reward.toLocaleString()}</div>
        </div>
        <button class="claim-btn" ${q.done && !q.claimed ? '' : 'disabled'}>${q.claimed ? '✓' : '🪙'}</button>`;
      if (q.done && !q.claimed) {
        row.querySelector('.claim-btn').addEventListener('click', () => {
          questState.done[q.id] = true;
          questState.claimed = questState.claimed || {};
          questState.claimed[q.id] = true;
          economy.addCoins(reward);
          persistQuests();
          audio.buy();
          for (let i = 0; i < 5; i++) setTimeout(() => audio.coin(i), i * 70);
          bumpCoins();
          juice.confetti(W / 2, 220, 40);
          renderQuests();
        });
      }
      el.qtabDaily.appendChild(row);
    }
  } else {
    el.qtabAch.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'ach-grid';
    for (const a of ACHIEVEMENTS) {
      const unlocked = !!economy.s.achievements[a.id];
      const card = document.createElement('div');
      card.className = 'ach-card' + (unlocked ? ' unlocked' : '');
      card.innerHTML = `<div class="ic">${unlocked ? a.icon : '🔒'}</div><div><b>${ko ? a.nameKo : a.nameEn}</b><span>${ko ? a.descKo : a.descEn}</span></div>`;
      grid.appendChild(card);
    }
    el.qtabAch.appendChild(grid);
  }
}
document.querySelectorAll('[data-qtab]').forEach(b => b.addEventListener('click', () => { qTab = b.dataset.qtab; audio.ui(); renderQuests(); }));
el.btnQuests.addEventListener('click', () => { audio.ui(); renderQuests(); el.questsPanel.hidden = false; });

// ---------- events ----------
function handleEvent(type, d) {
  if (type === 'catch') {
    bumpCoins();
    el.coolerBadge.hidden = economy.cooler.length === 0;
    el.coolerBadge.textContent = economy.cooler.length;
    el.coolerCount.textContent = economy.cooler.length;
    updateCombo();
    const night = scene.isNight(scene.worldT);
    if (night) economy.stats.nightCatches++;
    questEvent({ type: 'catch', night, weightKg: d.weight, combo: d.combo });
    if (d.perfect) questEvent({ type: 'perfect' });
  } else if (type === 'fail') {
    updateCombo();
    if (d.kind === 'snap') { toast(t('toast.snap'), 'red'); questEvent({ type: 'snap' }); }
    else if (d.kind === 'miss') { toast(t('toast.miss'), 'red'); questEvent({ type: 'escape' }); }
    else if (d.kind === 'escape') { toast(t('toast.escape'), 'red'); questEvent({ type: 'escape' }); }
  } else if (type === 'fightstart' && d.fish.boss) {
    toast(t('toast.bossFound', { name: fishName(d.fish) }), 'gold');
    juice.flash('#ff5d9e', 0.25, 260);
  } else if (type === 'onCombo') {
    updateCombo();
  }
}

function bumpCoins() {
  el.coinNum.textContent = Math.floor(economy.coins).toLocaleString();
  el.coinPill.classList.remove('bump');
  void el.coinPill.offsetWidth;
  el.coinPill.classList.add('bump');
}
function updateCombo() {
  const c = game.fg.combo;
  if (c > 1) {
    el.comboPill.hidden = false;
    el.comboNum.textContent = `x${economy.comboMult(c).toFixed(1)} (${c})`;
  } else el.comboPill.hidden = true;
}

// ---------- shop ----------
let shopTab = 'upgrades';
function renderShop() {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === shopTab));
  el.tabUpgrades.hidden = shopTab !== 'upgrades';
  el.tabCooler.hidden = shopTab !== 'cooler';
  if (shopTab === 'upgrades') renderUpgrades(); else renderCooler();
}
// named equipment per level (Tidewater Gear-style): "6호 카본 / 15 lb mono"
function gearLabel(u, lv) {
  const labels = u.labels;
  if (!labels) return '';
  const i = Math.min(lv, labels.length - 1);
  return getLocale() === 'ko' ? labels[i][0] : labels[i][1];
}
// localized upgrade description with per-level params (mirrors config.js formulas)
function upgDesc(u, lv) {
  switch (u.id) {
    case 'rod':  return t('upg.rod.desc', { p1: lv * 10, p2: lv * 22 });
    case 'line': return t('upg.line.desc', { n: (lv * 0.45).toFixed(2) });
    case 'reel': return t('upg.reel.desc', { n: lv * 25 });
    case 'bait': return t('upg.bait.desc', { n: lv * 18, m: lv * 15 });
    default: return '';
  }
}
function renderUpgrades() {
  el.tabUpgrades.innerHTML = '';
  for (const u of UPGRADES) {
    const lv = economy.upgrades[u.id];
    const max = u.costs.length;
    const cost = economy.upgradeCost(u.id);
    const row = document.createElement('div');
    row.className = 'upg-row';
    row.innerHTML = `
      <div class="upg-icon">${u.icon}</div>
      <div class="upg-info">
        <div class="upg-name">${t('upg.' + u.id + '.name')} <span style="color:var(--dim);font-size:12.5px">${gearLabel(u, lv)} · ${t('log.level', { n: lv })}${lv >= max ? ' ' + t('log.max') : ''}</span></div>
        <div class="upg-desc">${upgDesc(u, Math.min(lv + 1, max))}</div>
        <div class="upg-pips">${Array.from({ length: max }, (_, i) => `<div class="pip ${i < lv ? 'on' : ''}"></div>`).join('')}</div>
      </div>
      <button class="buy-btn ${lv >= max ? 'max' : ''}" ${cost == null || economy.coins < cost ? 'disabled' : ''}>
        ${lv >= max ? t('ui.maxBtn') : `🪙 ${cost.toLocaleString()}`}
      </button>`;
    row.querySelector('.buy-btn').addEventListener('click', () => {
      if (economy.buyUpgrade(u.id)) {
        audio.buy();
        toast(t('toast.upgradeDone', { icon: u.icon, name: t('upg.' + u.id + '.name') }), 'gold');
        bumpCoins(); renderShop();
      } else audio.deny();
    });
    el.tabUpgrades.appendChild(row);
  }
}
function renderCooler() {
  el.coolerList.innerHTML = '';
  el.coolerCount.textContent = economy.cooler.length;
  if (!economy.cooler.length) {
    el.coolerList.innerHTML = `<div style="color:var(--dim);text-align:center;padding:30px 0">${t('ui.coolerEmpty')}</div>`;
  }
  [...economy.cooler].reverse().forEach((c) => {
    const fish = FISHES.find(f => f.id === c.fishId);
    const R = RARITIES[c.rarity];
    const row = document.createElement('div');
    row.className = 'cool-row';
    row.innerHTML = `
      <span class="rarity-tag" style="background:${R.color}22;color:${R.color};border:1px solid ${R.color}55">${rarityName(c.rarity)}</span>
      <span>${fishName(fish)}</span>
      <span class="rw">${c.weight.toFixed(2)}kg${c.cm ? ' · ' + c.cm + 'cm' : ''}</span>
      <span class="rv">+${c.value.toLocaleString()}</span>`;
    el.coolerList.appendChild(row);
  });
  const total = economy.coolerValue();
  el.sellAllBtn.disabled = total === 0;
  el.sellAllBtn.textContent = total ? t('ui.sellAll', { n: total.toLocaleString() }) : t('ui.sellEmpty');
}
el.sellAllBtn.addEventListener('click', () => {
  const total = economy.sellAll();
  if (total > 0) {
    audio.buy();
    for (let i = 0; i < 6; i++) setTimeout(() => audio.coin(i), i * 70);
    toast(t('toast.sold', { n: total.toLocaleString() }), 'gold');
    bumpCoins();
    el.coolerBadge.hidden = true;
    renderCooler();
    questEvent({ type: 'sell', total });
  }
});
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { shopTab = b.dataset.tab; audio.ui(); renderShop(); }));

// ---------- collection log ----------
function renderLog() {
  const caught = Object.keys(economy.s.log).length;
  el.logProgress.textContent = t('log.progress', { caught, total: FISHES.length, bonus: (economy.logBonus() * 100).toFixed(0) });
  el.logGrid.innerHTML = '';
  const zoneOrder = Object.fromEntries(ZONES.map((z, i) => [z.id, i]));
  const sorted = [...FISHES].sort((a, b) => (zoneOrder[a.zone] - zoneOrder[b.zone]) || (RARITIES[a.rarity].order - RARITIES[b.rarity].order));
  for (const fish of sorted) {
    const entry = economy.s.log[fish.id];
    const R = RARITIES[fish.rarity];
    const card = document.createElement('div');
    card.className = 'log-card' + (entry ? ' caught' : '');
    card.innerHTML = `
      <canvas></canvas>
      <div class="fish-name ${entry ? '' : 'unknown'}">${fishName(fish)}</div>
      <div class="fish-sub">${entry
        ? `${rarityName(fish.rarity)} · ${t('log.count', { n: entry.count })} · ${t('log.maxWeight', { w: entry.maxW.toFixed(2) })}`
        : `${zoneName(fish.zone)} · ${timeName(fish.time)}`}</div>`;
    const cv = card.querySelector('canvas');
    requestAnimationFrame(() => drawFishPreview(cv, fish, !entry));
    el.logGrid.appendChild(card);
  }
}

// ---------- zone chips ----------
function renderZones() {
  el.zoneChips.innerHTML = '';
  for (const z of ZONES) {
    const unlocked = economy.zoneUnlocked(z.id);
    const chip = document.createElement('button');
    chip.className = 'zone-chip' + (unlocked ? (economy.zone === z.id ? ' active' : '') : ' locked');
    chip.textContent = unlocked ? zoneName(z.id) : `${zoneName(z.id)} 🪙${z.cost.toLocaleString()}`;
    chip.addEventListener('click', () => {
      if (unlocked) {
        if (economy.selectZone(z.id)) { audio.ui(); game.zone = z; renderZones(); el.zoneName.textContent = zoneName(z.id); toast(t('toast.zoneMove', { zone: zoneName(z.id) })); }
      } else if (economy.unlockZone(z.id)) {
        economy.selectZone(z.id);
        audio.buy(); audio.bigCatch();
        toast(t('toast.zoneUnlocked', { zone: zoneName(z.id) }), 'gold');
        bumpCoins(); game.zone = z; renderZones(); el.zoneName.textContent = zoneName(z.id);
        juice.confetti(W / 2, 200, 80);
      } else {
        audio.deny();
        toast(t('toast.needCoins', { cost: z.cost.toLocaleString(), have: economy.coins.toLocaleString() }), 'red');
      }
    });
    el.zoneChips.appendChild(chip);
  }
}

// ---------- panels ----------
function openPanel(id) {
  if (id === 'shopPanel') renderShop();
  if (id === 'logPanel') renderLog();
  $(`#${id}`).hidden = false;
}
function closePanels() { el.shopPanel.hidden = true; el.logPanel.hidden = true; el.questsPanel.hidden = true; }
el.btnShop.addEventListener('click', () => { audio.ui(); openPanel('shopPanel'); });
el.btnLog.addEventListener('click', () => { audio.ui(); openPanel('logPanel'); });
document.querySelectorAll('.close-btn').forEach(b => b.addEventListener('click', () => { audio.ui(); $(`#${b.dataset.close}`).hidden = true; }));
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanels(); });

// ---------- mute ----------
function renderMute() { el.muteBtn.textContent = audio.isMuted() ? '🔇' : '🔊'; }
el.muteBtn.addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
  economy.s.muted = audio.isMuted();
  music.setMuted(audio.isMuted());
  economy.save();
  renderMute();
});

// ---------- music ----------
function renderMusicBtn() { el.musicBtn.textContent = music.isPlaying() ? '🎵' : '🎵̸'; }
el.musicBtn.addEventListener('click', () => {
  audio.unlock();
  music.init(audio._ctx || undefined);
  music.setVolume(economy.s.musicVolume ?? 0.5);
  music.setMuted(!!economy.s.muted);
  if (music.isPlaying()) { music.stop(); economy.s.musicOn = false; }
  else { music.start(); economy.s.musicOn = true; }
  economy.save();
  renderMusicBtn();
});

// ---------- input ----------
let introDone = false;
function press() {
  if (!introDone) return;
  audio.unlock();
  if (!el.shopPanel.hidden || !el.logPanel.hidden || !el.questsPanel.hidden) return; // panels block canvas input
  game.fg.press();
}
canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); press(); });
window.addEventListener('pointerup', () => game.fg.release());
window.addEventListener('pointercancel', () => game.fg.release()); // 터치 제스처 취소 시 릴링 잠금 방지
window.addEventListener('blur', () => game.fg.release());          // 탭 전환 시 홀드 유지 방지
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && !e.repeat) { e.preventDefault(); press(); }
});
window.addEventListener('keyup', (e) => { if (e.code === 'Space') game.fg.release(); });

el.startBtn.addEventListener('click', () => {
  introDone = true;
  audio.unlock();
  el.intro.classList.add('hide');
  audio.buy();
  toast(t('toast.firstCast'));
  // 음악은 옵트인(🎵 버튼) — 시작 시 자재깅 소리가 나지 않도록 자동 재생하지 않는다
  music.init(audio._ctx || undefined);
  music.setVolume(economy.s.musicVolume ?? 0.5);
  music.setMuted(!!economy.s.muted);
  if (economy.s.musicOn && !economy.s.muted) music.start();
  renderMusicBtn();
});

// ---------- hints ----------
const HINT_KEYS = { idle: 'hint.idle', casting: 'hint.casting', bobbing: 'hint.bobbing', strike: 'hint.strike', fight: 'hint.fight', reveal: '' };
let lastHint = '';
function updateHint() {
  const s = game.fg.state;
  const key = HINT_KEYS[s] ?? '';
  const h = introDone && key ? t(key) : '';
  if (h !== lastHint) { el.hint.textContent = h; el.hint.style.opacity = h ? 1 : 0; lastHint = h; }
}

// ---------- main loop ----------
let lastPhase = 'day';
let last = performance.now();
let saveT = 0;
let lastFrameAt = performance.now();
function frame(now) {
  lastFrameAt = performance.now();
  const dt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  step(dt);
  requestAnimationFrame(frame);
}
function step(dt) {
  const fg = game.fg;
  if (introDone) {
    const gdt = juice.update(dt);
    fg._night = scene.isNight(scene.worldT);
    fg._hour = scene.hourOf(scene.worldT);   // game-clock hour (activity model input)
    const phase = scene.phaseOf(scene.worldT);
    if (phase !== lastPhase) {
      if ((phase === 'dusk' || phase === 'dawn') && introDone) {
        toast(t('toast.golden'), 'gold');
        audio.bigCatch();
        juice.flash('#ffb02e', 0.18, 300);
      }
      lastPhase = phase;
    }
    music.setDayNight(scene.nightAmount(scene.worldT));
    if (__RR.autoFight && fg.state === 'fight') {
      // QA driver: keep tension inside the green band — ease off harder during fish surges
      const F = fg.fight;
      fg.holdReeling = F.surging ? F.tension < 55 : F.tension < 78;
    }
    // QA hook: strike at 25% of the window = PERFECT hookset, deterministic
    if (__RR.autoHook && fg.state === 'strike' && fg.strike && !fg.strike.done && fg.strike.t >= fg.strike.window * 0.25) fg.press();
    fg.update(gdt);
    scene.draw(ctx, game, gdt);
  } else {
    scene.draw(ctx, game, dt); // ambient world behind intro
  }
  updateHint();
  // clock icon
  const night = scene.isNight(scene.worldT);
  const icon = night ? '🌙' : '☀️';
  if (el.timeIcon.dataset.v !== icon) { el.timeIcon.dataset.v = icon; el.timeIcon.textContent = icon; }
  saveT += dt;
  if (saveT > 8) { saveT = 0; economy.save(); }
}
// rAF starvation watchdog: occluded windows suspend requestAnimationFrame;
// keep simulating via a 30ms timer so the game stays consistent (QA/screen-recording safe).
setInterval(() => {
  if (performance.now() - lastFrameAt > 300) frame(performance.now());
}, 30);

// camera + juice compositing wrapper: we draw scene, then world juice, then UI juice.
// (Scene.draw already used raw ctx; wrap by drawing juice after with same transform pattern.)
const _sceneDraw = scene.draw.bind(scene);
scene.draw = (ctx, g, dt) => {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  juice.applyCamera(ctx);
  _sceneDraw(ctx, g, dt);
  juice.drawWorld(ctx);
  ctx.restore();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  juice.drawUI(ctx);
};

// ---------- boot ----------
// locale: saved choice -> browser detection (persisted only when the user toggles)
setLocale(economy.s.locale ?? detectLocale());
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(n => { n.textContent = t(n.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach(n => { n.title = t(n.dataset.i18nTitle); });
  el.localeLabel.textContent = getLocale().toUpperCase();
  el.zoneName.textContent = zoneName(economy.zone);
  renderZones();
  if (!el.shopPanel.hidden) renderShop();
  if (!el.logPanel.hidden) renderLog();
  if (!el.questsPanel.hidden) renderQuests();
  lastHint = ''; // force hint re-render in the new language
}
el.localeBtn.addEventListener('click', () => {
  audio.unlock(); audio.ui();
  setLocale(getLocale() === 'ko' ? 'en' : 'ko');
  economy.s.locale = getLocale();
  economy.save();
  applyI18n();
});
window.addEventListener('reelrush:locale', applyI18n);
applyI18n();
el.coinNum.textContent = Math.floor(economy.coins).toLocaleString();
game.zone = ZONES.find(z => z.id === economy.zone) ?? ZONES[0];
renderZones(); renderMute(); updateCombo();
window.addEventListener('beforeunload', () => economy.save());
document.addEventListener('visibilitychange', () => { if (document.hidden) economy.save(); });

// ---------- PWA ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ---------- debug/QA hooks ----------
const __RR = {
  game, fg: game.fg, juice, economy, audio, scene, FISHES,
  autoFight: false,
  autoHook: false,
  state: () => ({ state: game.fg.state, coins: economy.coins, cooler: economy.cooler.length, combo: game.fg.combo, log: Object.keys(economy.s.log).length }),
  forceBite: () => { game.fg.debugBite = true; },
  clearQa: () => { game.fg.debugBite = false; __RR.autoFight = false; __RR.autoHook = false; },
  // manual frame step for QA/headless driving (60Hz sim regardless of timer throttling)
  tick: (n = 1, dt = 1 / 60) => { for (let i = 0; i < n; i++) step(dt); return __RR.fg.state; },
  forceNight: () => { scene.worldT = Math.ceil(scene.worldT / CYCLE) * CYCLE + DAY_LEN + 2; },
  forceDay: () => { scene.worldT = Math.ceil(scene.worldT / CYCLE) * CYCLE + 2; },
  giveCoins: (n) => { economy.addCoins(n); bumpCoins(); },
  sellAll: () => economy.sellAll(),
};
window.__RR = __RR;

requestAnimationFrame(frame);
