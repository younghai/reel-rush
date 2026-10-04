# REEL RUSH — Monster Fishing 🎣

Tidewater(dgreenheck/tidewater)에서 영감을 받은 아케이드 낚시 게임. 스팀 히트작들(DREDGE, Dave the Diver, WEBFISHING, Stardew Valley)의 타격감과 수집·성장 루프를 브라우저에서 즉시 플레이할 수 있게 구현했다.

## 실행

**https://younghai.github.io/reel-rush/ 에서 바로 플레이** (PWA 설치 지원)

로컬 실행 (의존성 없음):

```sh
npm start        # node serve.js — no-store 캐시 헤더 (모듈 수정이 즉시 반영됨)
# 또는: python3 -m http.server 8899
```

http://127.0.0.1:8899 접속 → **출항하기**

## 플레이 방법 (20~40초 사이클)

1. **캐스트** — 클릭으로 파워 게이지를 멈춘다. 멀수록(깊을수록) 희귀 어종 가중치 상승
2. **입질** — `!` 표시가 뜨면
3. **후킹** — 즉시 클릭. 창 초반 42%면 **PERFECT** (진행바 15% 시드 + x1.5 배수)
4. **파이팅** — 홀드=릴링, 해제=휴식. **긴장 게이지를 초록 밴드에 유지**해 진행바를 채운다.
   빨간 구간 지속 시 줄이 끊긴다. 어종별 패턴(steady/darting/diver/runner/thrasher)과 스타미나가 다르다
5. **리빌** — 히트스톱 + 레어도 카드 플립 + 콤보. 상점에서 판매 → 업그레이드/어장 개방

## 콘텐츠

- **어종 35종** (5개 어장 × 낮/밤, 흔함~신화 6단계 레어도, 보스 2종 — Coral Colossus / Abyssal Leviathan)
- **업그레이드 4계열 × 4단계**: 낚싯대 / 낚싯줄 / 릴 / 미끼
- **일일 퀘스트** (매일 3개, 결정론 선택 + 보상 수령) & **업적 12종**
- **앰비언트 음악(🎵 옵트인)**: 파도 세척음+드문 펜타토닉 플럭 — 지속 드론 없음(부팅 웅음 제거, v2 재설계)
- **이중 언어** 🌐 KO/EN 실시간 전환 (저장 유지)
- **낮·밤 사이클**, 심해 어장의 생체광과 가끔 지나가는 *그것*, 도감 완성 보너스(+판매%)
- **PWA**: 매니페스트·서비스워커·아이콘 — 오프라인 캐시, 홈화면 설치
- 저장: localStorage (`reelrush.save.v1`, 스키마 v2 — 퀘스트/업적/설정 포함, v1 자동 마이그레이션)
- **접근성**: prefers-reduced-motion 대응(타격감 축소), 색약 안전 긴장 바(해칭+눈금+⚠)

## 타격감 시스템 (`js/juice.js`)

히트스톱(레어도별 90~450ms), 스크린 셰이크, 슬로모션(rare+), 파티클 버스트/컨페티,
플로팅 텍스트, 크로매틱 펄스, 레어도별 팡파레 — 사운드는 전부 WebAudio 실시간 합성(`js/audio.js`, 에셋 0개).

## 구조

```
index.html  css/style.css  package.json  serve.js (no-cache 정적 서버)
manifest.json sw.js pwa/ (PWA)  .github/workflows/ci.yml (CI)
js/main.js      부트, 루프(rAF+워치독), 입력, HUD/상점/도감/퀘스트 DOM
js/config.js    밸런스 상수 (레어도/업그레이드/파이팅/캐스트/수면선)
js/fishing.js   캐스트→입질→후킹→파이팅 상태머신 + 어종 선택 가중치
js/scenes.js    씬 셸 + 오케스트레이션
js/scenes/world.js    하늘/낮밤/바다/부둣가/낚시꾼 렌더
js/scenes/hud.js      파이팅 UI/리빌 카드 렌더
js/scenes/fishdraw.js 어종 드로잉 (도감 미리보기 공유)
js/juice.js     타격감 엔진 (셰이크/히트스톱/파티클/텍스트, 풀 캡 420)
js/economy.js   코인/업그레이드/쿨러/도감/세이브(v2) + 로드 시 sanitization
js/data/fishes.js  어종 DB 35종
js/audio.js     WebAudio 합성 SFX 엔진
js/music.js     WebAudio 합성 앰비언트 음악 (낮/밤 레이어)
js/i18n.js      KO/EN 문자열 테이블 (61키)
js/quests.js    일일 퀘스트·업적 순수 로직
test/smoke.mjs      헤드리스 로직 테스트 (50 assertions)
test/quests.test.mjs 퀘스트·업적 테스트 (200 assertions)
```

## 테스트

```sh
npm test   # node test/smoke.mjs — 전체 낚시 루프 시뮬레이션 + 경제 수학 + 어종 도달성
node test/quests.test.mjs   # 퀘스트·업적 로직 (200 assertions)
npm run ci # 전 모듈 문법 검사 + 스모크
```

## 배포

GitHub Pages: main 브랜치 푸시 시 자동 배포 (https://younghai.github.io/reel-rush/).
CI: 푸시/PR마다 전 모듈 문법 검사 + 로직 테스트 + PWA 자산 점검 (.github/workflows/ci.yml).

QA용 디버그 훅: `window.__RR` (`forceBite()`, `autoHook`, `autoFight`, `tick(n)`, `state()` 등).
