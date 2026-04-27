# EndlessJump - Claude Code 프로젝트 지침

## 프로젝트 개요

수직 스크롤 아케이드 게임 (TypeScript + Vite + Canvas 2D + Capacitor Android)

## 빌드

```bash
npm run build    # TypeScript 컴파일 + Vite 번들
npm run dev      # 개발 서버
npx cap sync     # Android 동기화

# Android APK 빌드 (JDK 21 필수 — JDK 25는 Gradle 8.x 미지원)
JAVA_HOME="/c/Program Files/Java/jdk-21.0.10" ./gradlew assembleDebug
```

## 의존성 설치 주의사항

```bash
# @capgo/capacitor-purchases가 Capacitor 5 peer dep → legacy-peer-deps 필요
npm install --legacy-peer-deps
```

## 커밋 규칙

작업 완료 시 반드시 git commit을 생성한다.

- 작업 내용에 맞는 적절한 커밋 이름을 짓는다
- conventional commits 형식: `<type>: <한국어 설명>`
- type: feat, fix, refactor, docs, test, chore, perf, ci
- 설명은 한국어로 작성, 무엇을 왜 변경했는지 명확히
- 예시:
  - `fix: Score 텍스트 초기 렌더링 안 되는 버그 수정`
  - `feat: 키보드 입력 지원 추가`
  - `refactor: game.ts 오디오 모듈 분리`

## 옵시디언 노트 업데이트

작업 완료 시 반드시 `D:\tengtengsoft\BunnyHop\개발노트.md`를 업데이트한다.

- 파일 상단 `최종 업데이트` 날짜를 당일로 변경
- 하단 `변경 이력` 테이블에 작업 내용 한 줄 추가
- 버그를 수정했으면 `버그 리포트` 섹션의 해당 항목에 취소선 처리
- 새 기능을 추가했으면 관련 섹션(메카닉, 시각 효과 등)에 내용 반영
- 새 버그를 발견했으면 `버그 리포트` 섹션에 추가

## 작업 완료 순서

1. 코드 수정
2. `npm run build`로 빌드 확인
3. git commit (적절한 이름)
4. 옵시디언 노트 업데이트
