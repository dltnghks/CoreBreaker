# ECHO BREAKER

내려오는 블럭을 파괴하며 직업 스킬 빌드를 완성하는 무한 진행형 브릭 브레이커 프로토타입입니다. 전사·궁수·법사 스킬, 공용 패시브, 20웨이브 보스, 아이템·블럭 특성, 플레이테스트 봇과 단계별 벤치마크를 포함합니다.

## 주요 화면

- `/` — 실제 게임플레이
- `/benchmark` — 누적 기능 벤치마크와 봇 테스트
- `/skill-lab` — 스킬 수치 편집과 개별 영향력 실험

## 문서

- [게임 기획서](docs/GAME_DESIGN.md)

## 실행

Node.js `22.13.0` 이상이 필요합니다.

```bash
npm install
npm run dev
```

Windows PowerShell에서 package script의 환경변수 문법이 동작하지 않으면 다음 명령을 사용합니다.

```powershell
.\node_modules\.bin\vinext.cmd dev
```

## 검증

```bash
npm run build
npm test
```

Windows PowerShell:

```powershell
.\node_modules\.bin\vinext.cmd build
node --test tests/rendered-html.test.mjs
```

## 현재 개발 단계

- 핵심 게임 루프 구현 완료
- 직업·공용 스킬 26종 구현
- 보스 궁극기 보상 구조 구현
- 화면 흔들림·스킬 이펙트·합성 사운드 구현
- Skill LAB·W100 봇 벤치마크 파이프라인 구현
- 현재 작업: 스킬 역할, 발동 빈도, 시너지와 궁극기 밸런스 구체화

기능 변경은 구현과 테스트가 끝난 뒤 기획 문서를 함께 갱신하고 기능 단위로 커밋합니다.
