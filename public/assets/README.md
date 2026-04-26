# BunnyHop Sprite Assets

Tier 1 그래픽 에셋 디렉터리. WebP 우선, PNG 폴백 지원.

## 폴더 구조

| 폴더 | 키(AssetManager) | 설명 |
|------|------------------|------|
| `sprites/bunny_idle` | `bunny_idle` | 토끼 기본 자세 |
| `sprites/bunny_jump` | `bunny_jump` | 점프 중 (스쿼시) |
| `sprites/bunny_fall` | `bunny_fall` | 하강 중 (스트레치) |
| `items/carrot_normal` | `carrot_normal` | 일반 당근 |
| `items/carrot_special` | `carrot_special` | 황금 당근 |
| `tiles/ground` | `ground` | 지면 타일 (반복) |
| `tiles/grass` | `grass` | 잔디 윗부분 |
| `effects/cloud` | `cloud` | 구름 (3 variant 추천) |

## 파일 명명 규칙

각 키마다 두 파일을 배치하면 자동 폴백됩니다:

- `bunny_idle.webp` (기본)
- `bunny_idle.png` (폴백)

WebP만 또는 PNG만 있어도 동작합니다.

## 권장 해상도

- 토끼: 96x96 (BUNNY_RADIUS=18 기준 2.6배 슈퍼샘플링)
- 당근: 64x80 (CARROT_RADIUS=14 기준)
- 지면 타일: 64x64 (수평 반복)
- 구름: 256x96

## 활성화

`src/assets.ts`의 `AssetManager.load()`가 모든 에셋을 사전 로드합니다.
파일이 없으면 자동으로 vector 렌더링 폴백됩니다.
