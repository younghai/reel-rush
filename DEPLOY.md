# REEL RUSH — 배포 가이드 (GitHub Pages)

REEL RUSH는 의존성 없는 순수 정적 게임입니다. **빌드 과정이 없으므로** 프로젝트 루트의
파일들(`index.html`, `css/`, `js/`, `manifest.json`, `sw.js`, `pwa/`, `report.html`)을
그대로 호스팅에 올리면 끝납니다.

## 0) 사전 준비

- 전부 정적 파일이며 번들러/트랜스파일 단계가 없음을 확인 (no build).
- GitHub CLI 설치·로그인 확인:

  ```bash
  gh auth status
  ```

- 로컬 동작 확인(선택): `python3 -m http.server 8080` 실행 후
  `http://localhost:8080` 접속 — Service Worker는 localhost에서도 동작합니다.

## 1) .gitignore 생성 (권장)

프로젝트 루트에 `.gitignore` 파일을 만들고 아래 내용을 저장합니다:
(node_modules는 없음 — 의존성 제로 프로젝트라 별도 제외 불필요)

```gitignore
.omo/
gui-test-screenshots/
*.log
.codegraph
.DS_Store
```

## 2) Git 초기화 & 첫 커밋

```bash
cd "/Users/young2026/Downloads/AI /AI_game"
git init
git add .
git commit -m "REEL RUSH 첫 배포: PWA 앱 셸 + 게임 정적 자산"
git branch -M main
```

## 3) GitHub 저장소 생성 & 푸시 (한 번에)

```bash
gh repo create reel-rush --public --source=. --push
```

- 로그인된 계정 기준으로 공개 저장소 `reel-rush`가 만들어지고 `main` 브랜치가 즉시 푸시됩니다.

## 4) GitHub Pages 활성화

```bash
gh api repos/{owner}/reel-rush/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

- **`{owner}` 는 본인 GitHub 사용자명으로 반드시 교체**하세요. 예시(`younghai` 계정):

  ```bash
  gh api repos/younghai/reel-rush/pages -X POST -f "source[branch]=main" -f "source[path]=/"
  ```

- `409 Conflict` / "already exists" 오류가 나면 이미 Pages가 켜져 있다는 뜻이므로 다음 단계로 진행하세요.

## 5) 배포 확인

- 첫 배포는 1~3분 정도 소요됩니다.
- 확인 URL: `https://younghai.github.io/reel-rush/`
  (본인 계정 기준 일반형: `https://<owner>.github.io/reel-rush/`)
- **서브패스 이슈 없음**: GitHub Pages는 `/reel-rush/` 하위 경로로 서빙되지만,
  `manifest.json`의 `start_url` / `scope` 가 이미 `"."`(상대 경로)로 설정되어 있고
  index.html의 css/js 참조도 상대 경로이므로 별도 base-path 설정이 필요 없습니다.
- `https://younghai.github.io/reel-rush/manifest.json` 이 브라우저에서 JSON으로 보이면 manifest 정상.

## 6) Netlify 대안 (드래그 & 드롭, 1분)

- https://app.netlify.com/drop 에 접속해 프로젝트 폴더째 브라우저에 끌어다 놓기 → 즉시 HTTPS URL 발급. 끝.

## 7) 배포 후 PWA 체크리스트

- [ ] **manifest 로드**: DevTools → Application → Manifest — 오류 없음, 아이콘(SVG/PNG) 미리보기 표시
- [ ] **Service Worker 등록**: Application → Service Workers — `sw.js` 가 "activated and running"
      (GitHub Pages는 기본 HTTPS이므로 SW 등록 조건 충족)
- [ ] **오프라인 동작**: Network 탭 → Offline 체크 → 새로고침 — 게임이 캐시에서 그대로 로드되는지 확인
- [ ] **설치 프롬프트**: Android Chrome 주소창의 "설치" 배너 / 데스크톱 Chrome 주소창의
      설치 아이콘 노출 확인 (manifest + SW + HTTPS 모두 충족되면 노출됨)
- [ ] **Lighthouse**: DevTools → Lighthouse → PWA 항목 통과

> 참고: 나중에 캐시를 강제 갱신하려면 `sw.js` 상단의 `CACHE = 'reelrush-v1'` 버전을
> `'reelrush-v2'` 등으로 올리면 활성화 시 이전 캐시가 자동 삭제됩니다.
