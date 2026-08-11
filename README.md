# CORE BREAKER

CORE BREAKER는 공 하나를 조준하고 반사해 고정된 블록 패턴을 돌파하는 20웨이브 빌드형 브릭 브레이커입니다.

웨이브를 클리어할 때마다 스킬을 선택해 공격, 연쇄, 제어, 소환, 방어 효과를 강화하고, 보스 웨이브에서는 보유 스킬을 진화시킬 수 있습니다.

## 주요 화면

- `/`: 실제 게임 플레이
- `/skill-lab`: 스킬 수치와 설명을 편집하고 빌드를 실험하는 도구
- `/stage-lab`: 실제 게임에서 사용하는 20개 웨이브 패턴을 편집하는 도구
- `/benchmark`: 실제 런타임 관찰 및 고정 스텝 벤치마크

## 게임 규칙

- 게임 시작 시 직업 스킬 3개 중 1개를 선택합니다.
- 총 20개의 고정 웨이브를 클리어합니다.
- 각 웨이브는 24열 × 최대 8행의 블록 패턴으로 구성됩니다.
- 제한시간은 없으며, 플레이 시간이 길어질수록 공의 속도가 점진적으로 증가합니다.
- 기본 공은 웨이브마다 1개로 시작합니다.
- 공을 놓치면 CORE를 1 잃고 패들 위에서 새 공이 생성됩니다.
- CORE가 0이 되면 게임 오버입니다.
- CORE는 패들 아래에 표시되는 크리스털 아이콘으로 확인할 수 있습니다.
- W5, W10, W15, W20에는 보스 웨이브가 등장합니다.
- 보스 코어를 파괴하면 일반 스킬 선택 대신 스킬 진화 보상을 선택합니다.
- 별도의 궁극기 시스템이나 경험치 시스템은 사용하지 않습니다.

## 플레이 흐름

```text
타이틀
  → 시작 스킬 선택
  → 웨이브 플레이
  → 웨이브 클리어
  → 일반 스킬 선택 또는 보스 진화 선택
  → 다음 웨이브
  → W20 클리어 또는 CORE 0
  → 결과 화면
```

## 조작

- `A / D`: 패들 좌우 이동
- `마우스`: 공의 반사 방향 조준
- `← / →`: 반사 각도 조절
- 전체화면 플레이 지원

## 블록 종류

- 일반 블록
- 강화 블록
- 가드 블록
- 폭발 블록
- 회복 블록
- 반사 블록
- 파괴 불가 블록

블록의 기능은 색상, 형태, 보호 방향, 애니메이션 및 충돌 이펙트로 구분됩니다.

## 아이템

블록을 파괴하면 다음 아이템이 드롭될 수 있습니다.

- `MULTI BALL`: 일정 시간 동안 임시 공 생성
- `AUTO BARRIER`: 자동 반사 장벽 생성
- `CORE REPAIR`: CORE 1 회복
- `COOLDOWN RESET`: 모든 공의 스킬 쿨타임 초기화

## 스킬 시스템

스킬은 전사, 궁수, 법사, 공용 계열로 구성됩니다.

- 전사: 직접 피해, 충격파, 가드 파괴, CORE 방어
- 궁수: 임시 화살, 관통, 도탄, 집중 공격, 약점 피해
- 법사: 화상, 연쇄 번개, 빙결, 블랙홀, 특성 봉인
- 공용: 아이템, 패들, CORE, 공, 스킬 전역 강화

일반 스킬은 LV1~LV3까지 성장하며, 같은 스킬을 한 번 더 선택하면 진화합니다. 보스 웨이브에서는 보유 중인 진화 가능한 스킬을 우선적으로 진화시킵니다.

## 개발 도구

### Skill Lab

- 스킬 계열별 목록 확인
- 스킬 설명과 LV1~LV3 수치 편집
- 쿨타임 및 밸런스 실험
- 실제 게임과 벤치마크에서 공유하는 설정 관리

### Stage Lab

- 20개 웨이브 패턴 편집
- 블록 배치와 HP 배율 조정
- JSON 가져오기·내보내기
- 기본값 복원 및 패턴 유효성 검증

### Benchmark

- `WATCH RUN`: 실제 게임 화면에서 봇 플레이 관찰
- `HEADLESS`: 렌더링 없이 120Hz 고정 스텝으로 반복 실행
- 동일한 시드와 설정으로 플레이 결과 재현
- 웨이브별 클리어 시간, CORE, 공 수, 점수, 스킬 발동 및 피해량 기록

## 실행

Node.js `22.13.0` 이상이 필요합니다.

```bash
npm install
npm run dev
```

Windows PowerShell:

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

## 외부 에셋

- BGM: MondaMusic의 “Retro Arcade Game Music”
  - [Pixabay 원본 페이지](https://pixabay.com/music/video-games-retro-arcade-game-music-512837/)
- 전투 VFX:
  - Ring Explosion
  - Spark Effect
  - Radial Lightning Effect
  - Pixel Art Spells
  - 모두 OpenGameArt.org의 CC0 에셋

상세 출처와 라이선스 정보는 [docs/THIRD_PARTY_ASSETS.md](docs/THIRD_PARTY_ASSETS.md)에서 확인할 수 있습니다.

## GitHub Pages 배포

GitHub Actions를 통해 `main` 브랜치에 변경사항이 push되면 게임을 빌드하고 GitHub Pages에 배포합니다.

배포 주소:

https://dltnghks.github.io/CoreBreaker/
