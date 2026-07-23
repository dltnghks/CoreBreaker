# CORE BREAKER

CORE BREAKER는 공 하나로 고정된 블록 패턴을 공략하고, 웨이브 보상으로 전사·궁수·법사·공용 스킬 빌드를 완성하는 20웨이브 브릭 브레이커입니다. 공을 놓치면 패들 안에 표시된 CORE가 1 감소하고 즉시 새 공으로 이어집니다.

## 주요 화면

- `/`: 실제 게임 플레이
- `/benchmark`: 실제 런타임 관찰 및 고정 스텝 대량 벤치마크
- `/skill-lab`: 스킬 수치·설명 편집과 역할별 실험
- `/stage-lab`: 실제 게임이 사용하는 20개 웨이브 패턴 편집

## 현재 게임 규칙

- 시작 전에 일반 스킬 1개를 선택합니다.
- 각 웨이브의 파괴 가능한 블록을 모두 제거하면 클리어됩니다.
- 흐름은 `웨이브 → 클리어 연출 → 스킬 선택 → 전환 연출 → 다음 웨이브`입니다.
- 웨이브 제한시간과 경험치 시스템은 없습니다.
- 기본 공은 매 웨이브 1개로 초기화됩니다.
- 공을 놓치면 CORE 1을 잃고 새 공을 소환합니다. CORE가 0이면 게임 오버입니다.
- W10과 W20에는 보스가 등장하며, 보스 클리어 보상으로 궁극기를 선택합니다.
- 일반 스킬은 공별 쿨타임이 준비된 블록 충돌에서 발동합니다. 공용 스킬은 획득 즉시 상시 적용됩니다.

## 개발 도구

- Skill Lab: 스킬의 수치·설명·레벨 효과 편집
- Stage Lab: 12열, 최대 8행의 웨이브 패턴과 HP 배율 편집
- Benchmark WATCH RUN: 실제 게임 런타임에서 봇 플레이 관찰
- Benchmark HEADLESS: 렌더링을 제외한 좌표 기반 120Hz 고정 스텝 반복 실행

## 실행

Node.js `22.13.0` 이상이 필요합니다.

```bash
npm install
npm run dev
```

Windows PowerShell에서는 package script의 POSIX 환경변수 문법 대신 다음 명령을 사용할 수 있습니다.

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
.\node_modules\.bin\vinext.cmd dev
```

## 검증

```bash
npm run build
npm test
```

Windows PowerShell:

```powershell
$env:WRANGLER_LOG_PATH='.wrangler/wrangler.log'
.\node_modules\.bin\vinext.cmd build
node --test tests\rendered-html.test.mjs tests\benchmark-parity.test.mjs
```

## 문서

- [게임 기획서](docs/GAME_DESIGN.md)
- [벤치마크 및 봇 파이프라인](docs/BENCHMARK_PIPELINE.md)
- [외부 에셋과 라이선스](docs/THIRD_PARTY_ASSETS.md)

기능 변경은 구현, 테스트, 문서 갱신, 기능 단위 커밋 순서로 마무리합니다.

## GitHub Pages

The repository includes `.github/workflows/deploy-pages.yml`. Pushes to `main` build a static Pages shell from the production renderer and deploy it to GitHub Pages.

In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**. The workflow automatically uses the repository name as the project-site base path, so the deployed game and `/benchmark`, `/skill-lab`, and `/stage-lab` routes work under the Pages URL.
