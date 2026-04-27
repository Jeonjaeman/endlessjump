# BunnyHop 그래픽 업그레이드 체크리스트

> 레퍼런스: 3D 렌더 스타일 (이끼 낀 돌벽돌, 오로라 밤하늘, 귀여운 3D 토끼)
> 현재 상태: Canvas 2D 코드 드로잉 (이미지 에셋 없음)

---

## 1. 배경 (Background)

### 준비물
- [ ] 낮 하늘 배경 (1080x1920, PNG, 세로 타일링 가능)
- [ ] 석양 하늘 배경
- [ ] 밤 하늘 배경 (오로라/별 포함)
- [ ] 우주 배경 (최고 높이 도달 시)

### AI 프롬프트

**낮:**
```
A seamless vertical tileable mobile game background, bright blue sky with
soft white clouds, gentle gradient from light blue to deeper blue, cartoon
painterly style, no ground elements, 1080x1920, game asset, clean edges for tiling
```

**석양:**
```
A seamless vertical tileable mobile game background, dramatic orange and
purple sunset sky with wispy clouds, warm golden light, painterly cartoon style,
1080x1920, game asset
```

**밤:**
```
A seamless vertical tileable mobile game background, deep dark blue night
sky with twinkling stars and soft aurora borealis green/cyan streaks, magical
atmosphere, 1080x1920, game asset
```

**우주:**
```
A seamless vertical tileable mobile game background, deep space with
distant galaxies, nebula in purple and blue tones, scattered bright stars,
1080x1920, game asset
```

> **팁**: "seamless vertical tileable"을 꼭 넣어야 위아래가 자연스럽게 이어진다. 생성 후 Photoshop/GIMP의 Offset 필터로 이음새 확인/보정.

---

## 2. 바닥/지면 (Ground)

### 준비물
- [ ] 돌벽돌 + 이끼 지면 타일 (512x256, 가로 타일링 가능)
- [ ] 잔디 윗면 스트립 (512x64, 가로 타일링)

### AI 프롬프트

**지면:**
```
Top-down perspective stone brick ground tile with green moss growing
between cracks, small mushrooms and grass tufts on edges, 3D rendered style,
game asset, seamless horizontal tile, 512x256px, transparent edges on top,
dark shadow gradient toward bottom
```

**잔디:**
```
Side view grass strip with varied green blades and small wildflowers,
seamless horizontal tile, transparent background, 512x64px, game sprite asset
```

---

## 3. 플랫폼 (Platforms)

### 준비물
- [ ] 일반 플랫폼 3종 (각 256x64, 투명 배경 PNG)
- [ ] 움직이는 플랫폼 1종 (빛나는 테두리 등으로 시각 구분)
- [ ] 부서지는 플랫폼 1종 (금이 간 모양)
- [ ] 부서지는 플랫폼 파편 스프라이트시트 (256x64, 4프레임)

### AI 프롬프트

**일반:**
```
A floating stone platform for a mobile game, mossy rock with grass on
top, 3D rendered style, side view, soft shadow underneath, isolated on
transparent background, 256x64px, game asset
```

**움직이는:**
```
A magical floating crystal platform, glowing blue edges, ethereal
light particles, side view, transparent background, 256x64px, game asset
```

**부서지는:**
```
A cracked stone platform with visible fracture lines, pieces about
to break apart, weathered texture, side view, transparent background,
256x64px, game asset
```

---

## 4. 토끼 캐릭터 (Bunny) - 스프라이트시트

### 준비물
- [ ] Idle (대기) - 4프레임 스프라이트시트
- [ ] Jump (점프 상승) - 2프레임
- [ ] Fall (낙하) - 2프레임
- [ ] Land (착지) - 2프레임

### 연속 동작 스프라이트 생성 방법

캐릭터 애니메이션은 AI로 한 번에 일관된 스프라이트시트를 만들기 어렵다. 아래 3가지 방법 중 선택:

#### 방법 A: AI + 수동 보정 (추천)
1. AI로 **기본 포즈 1장** 생성
2. 그 이미지를 **참조 이미지(img2img)**로 넣고 포즈만 변형
3. Photoshop/GIMP로 크기/색상/위치 일관성 보정
4. 스프라이트시트로 합치기 (TexturePacker 등)

#### 방법 B: AI 스프라이트시트 직접 생성

**기본 포즈 (레퍼런스):**
```
A cute chibi bunny character for a mobile game, front-facing, round body,
big expressive eyes, small pink nose, long upright ears, white/cream fur with
pink inner ears, angry determined expression, short stubby arms crossed,
3D rendered style, transparent background, 256x256px, character design sheet
```

**Idle 스프라이트시트:**
```
Sprite sheet of a cute chibi bunny, 4 frames in a horizontal row, idle
breathing animation, slight body bounce up and down, ears gently swaying,
consistent style across all frames, 3D rendered, transparent background,
1024x256px (4 frames of 256x256)
```

**Jump 스프라이트시트:**
```
Sprite sheet of a cute chibi bunny, 2 frames horizontal, jumping upward pose,
frame 1: crouching with bent legs preparing to jump, frame 2: stretched
upward with ears flowing down, consistent character design, 3D rendered,
transparent background, 512x256px
```

**Fall 스프라이트시트:**
```
Sprite sheet of a cute chibi bunny, 2 frames horizontal, falling downward,
frame 1: spread limbs with surprised look, frame 2: curled up bracing for
landing, ears pointing up from wind, consistent design, 3D rendered,
transparent background, 512x256px
```

**Land 스프라이트시트:**
```
Sprite sheet of a cute chibi bunny, 2 frames horizontal, landing impact,
frame 1: legs compressed on ground squash pose, frame 2: bouncing back up
to standing, consistent design, 3D rendered, transparent background, 512x256px
```

#### 방법 C: 스프라이트 제작 도구

| 도구 | 용도 | 비용 |
|------|------|------|
| Piskel | 픽셀 스프라이트 애니메이션 | 무료 (piskelapp.com) |
| Aseprite | 프로 스프라이트 제작 | $20 (aseprite.org) |
| LibreSprite | Aseprite 무료 포크 | 무료 (libresprite.github.io) |
| TexturePacker | 스프라이트시트 패킹 | 무료/유료 (texturepacker.com) |

---

## 5. 당근 아이템 (Carrots)

### 준비물
- [ ] 일반 당근 (64x64, 투명 배경)
- [ ] 황금 당근 (64x64, 빛나는 이펙트 포함)

### AI 프롬프트

**일반 당근:**
```
A single carrot game item, 3D rendered style, vibrant orange with
green leafy top, slightly cartoon proportions, soft shadow, isolated on
transparent background, 64x64px, mobile game collectible item
```

**황금 당근:**
```
A golden glowing carrot game item, shiny metallic gold surface with
sparkle effects, green crystalline leaves on top, magical aura glow around it,
isolated on transparent background, 64x64px, premium mobile game collectible
```

---

## 6. 구름 (Clouds)

### 준비물
- [ ] 구름 3종 (다양한 크기/형태, 투명 배경 PNG)

### AI 프롬프트

```
A soft fluffy white cloud, painterly style, semi-transparent edges fading to
nothing, slight blue/gray shadow on bottom, isolated on transparent background,
256x128px, mobile game decorative asset. Generate 3 variations in different
shapes: one wide and flat, one tall and puffy, one small and wispy
```

---

## 7. 파티클/이펙트

### 준비물
- [ ] 별/반짝임 파티클 (32x32, 2~3종)
- [ ] 먼지/착지 이펙트 스프라이트시트 (128x32, 4프레임)
- [ ] 당근 획득 이펙트 (빛 파티클)

### AI 프롬프트

**별:**
```
A small star sparkle particle effect, bright white/yellow with soft glow,
4-pointed star shape, transparent background, 32x32px, game VFX asset
```

**먼지:**
```
Sprite sheet of dust puff animation, 4 frames horizontal, small cloud
of dust expanding and fading, brown/tan color, transparent background,
128x32px (4 frames of 32x32)
```

---

## 8. UI 요소

### 준비물
- [ ] 버튼 배경 (둥근 사각형, 9-patch 또는 고정)
- [ ] 패널/카드 배경 (랭킹, Game Over용 반투명 프레임)
- [ ] 커스텀 폰트 (.woff2 - Google Fonts 등에서 선택)

### AI 프롬프트

**버튼:**
```
A rounded rectangle game UI button, glass-morphism style with frosted
semi-transparent white background, subtle border glow, clean modern mobile
game aesthetic, isolated on transparent background, 256x64px
```

**패널:**
```
A game UI panel frame, frosted glass effect with rounded corners,
subtle gradient border, semi-transparent dark background, elegant mobile
game style, 512x384px, transparent background
```

---

## 에셋 폴더 구조

```
public/assets/
├── bg/
│   ├── sky-day.png
│   ├── sky-sunset.png
│   ├── sky-night.png
│   └── sky-space.png
├── ground/
│   ├── ground-tile.png
│   └── grass-strip.png
├── platforms/
│   ├── platform-normal-1.png
│   ├── platform-normal-2.png
│   ├── platform-normal-3.png
│   ├── platform-moving.png
│   ├── platform-breaking.png
│   └── platform-debris.png
├── bunny/
│   ├── idle.png          (4프레임 스프라이트시트)
│   ├── jump.png          (2프레임)
│   ├── fall.png          (2프레임)
│   └── land.png          (2프레임)
├── items/
│   ├── carrot.png
│   └── carrot-gold.png
├── clouds/
│   ├── cloud-1.png
│   ├── cloud-2.png
│   └── cloud-3.png
├── fx/
│   ├── sparkle.png
│   ├── dust.png
│   └── glow.png
└── ui/
    ├── btn-bg.png
    └── panel-bg.png
```

---

## 작업 순서 (추천)

| 순서 | 에셋 | 이유 |
|------|------|------|
| 1 | 토끼 캐릭터 | 게임의 핵심, 다른 에셋과 스타일 기준이 됨 |
| 2 | 당근 (일반/황금) | 간단하고 즉시 효과 큼 |
| 3 | 배경 4종 | 분위기 전체가 바뀜 |
| 4 | 플랫폼 + 지면 | 게임플레이 영역 개선 |
| 5 | 구름 | 배경 디테일 |
| 6 | 파티클/이펙트 | 피드백 개선 |
| 7 | UI | 마무리 |

---

## AI 이미지 생성 도구 추천

| 도구 | 장점 | 적합한 에셋 |
|------|------|------------|
| Midjourney | 최고 품질, 일관된 스타일 | 배경, 캐릭터 레퍼런스 |
| DALL-E 3 | 프롬프트 정확도 높음 | 아이템, UI 요소 |
| Stable Diffusion | 로컬/무료, img2img 강력 | 스프라이트 변형, 타일링 |
| Gemini Imagen | Google 통합, 빠른 생성 | 전체 범용 |

---

## 에셋 규격 요약

| 에셋 | 크기 | 형식 | 수량 |
|------|------|------|------|
| 배경 | 1080x1920 | PNG/WebP | 4장 |
| 지면 타일 | 512x256 | PNG | 1장 |
| 잔디 스트립 | 512x64 | PNG | 1장 |
| 플랫폼 | 256x64 | PNG (투명) | 5종 |
| 토끼 스프라이트 | 256x256/프레임 | PNG (투명) | 10프레임 (4시트) |
| 당근/아이템 | 64x64 | PNG (투명) | 2종 |
| 구름 | 256x128 | PNG (투명) | 3종 |
| 파티클 | 32x32 | PNG (투명) | 3종 |
| 먼지 이펙트 | 128x32 (시트) | PNG (투명) | 1장 |
| UI 버튼 | 256x64 | PNG (투명) | 1종 |
| UI 패널 | 512x384 | PNG (투명) | 1종 |

**총 약 22~25개 에셋 파일 필요**
