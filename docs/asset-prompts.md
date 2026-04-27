# BunnyHop AI Asset Generation Prompts

모든 에셋은 **WebP** 형식으로 저장. 캐릭터/아이템은 **투명 배경** 필수.

공통 스타일 키워드: `3D rendered, cute chibi style, soft lighting, mobile game asset, high quality`

---

## 1. Backgrounds (1080x1920, JPG/WebP)

### sky_day.webp
```
Beautiful blue sky with fluffy white clouds, bright daylight, soft gradient from light blue to white,
vertical mobile game background, 1080x1920, 3D rendered, vibrant colors, cheerful atmosphere
```

### sky_sunset.webp
```
Dramatic sunset sky, orange and purple gradient, golden clouds, warm lighting,
vertical mobile game background, 1080x1920, 3D rendered, romantic atmosphere
```

### sky_night.webp
```
Deep night sky with aurora borealis, green and cyan northern lights, twinkling stars,
dark blue to purple gradient, nebula wisps, vertical mobile game background, 1080x1920,
3D rendered, magical atmosphere, similar to fantasy game art
```

### sky_dawn.webp
```
Dawn sky with pink and orange horizon, fading stars, soft pastel colors,
gentle transition from dark blue to warm pink, vertical mobile game background,
1080x1920, 3D rendered, peaceful atmosphere
```

### sky_space.webp
```
Deep space scene, colorful nebula clouds in purple and blue, bright scattered stars,
cosmic dust, galaxy atmosphere, vertical mobile game background, 1080x1920,
3D rendered, awe-inspiring, sci-fi game art style
```

---

## 2. Character - Bunny (128x128, transparent PNG/WebP)

공통 프롬프트 베이스:
```
Cute 3D rendered chibi bunny character, white fluffy fur, round body, big expressive eyes,
small pink nose, long floppy ears, game sprite, transparent background, soft studio lighting,
front-facing view, mobile game character design
```

### bunny_idle.webp
```
[공통 베이스] + sitting relaxed pose, calm expression, paws resting on belly,
slightly tilted head, adorable idle animation frame
```

### bunny_jump.webp
```
[공통 베이스] + jumping upward pose, body stretched vertically, arms up,
excited happy expression, ears flowing upward, dynamic action pose
```

### bunny_fall.webp
```
[공통 베이스] + falling downward pose, limbs spread out, surprised worried expression,
ears flowing upward from wind, squished body shape horizontally
```

---

## 3. Items - Carrots (64x64, transparent PNG/WebP)

### carrot_normal.webp
```
3D rendered orange carrot, realistic vibrant orange color, fresh green leaves on top,
slight glossy shine, game item sprite, transparent background, soft lighting,
centered composition, mobile game collectible item
```

### carrot_special.webp
```
3D rendered golden carrot, glowing metallic gold color, magical sparkle effects,
green leaves on top, golden aura glow around it, game item sprite,
transparent background, soft lighting, premium rare item look,
mobile game special collectible
```

---

## 4. Ground Tiles

### ground.webp (128x128, seamless)
```
Isometric stone block tile, mossy weathered stone, green moss patches on gray stone,
seamless tileable texture, top-down slight perspective, game tile asset,
3D rendered, medieval fantasy style, 128x128 pixels
```

### grass.webp (256x32, transparent)
```
Horizontal grass border strip, lush green grass blades with small wildflowers,
seamless horizontal tile, transparent background, game tile overlay,
3D rendered, side view, decorative ground edge
```

---

## 5. Ground Decorations (32x32, transparent PNG/WebP)

### mushroom.webp
```
Small cute red mushroom with white spots, 3D rendered, cartoon style,
transparent background, game decoration sprite, 32x32, forest floor item
```

### grass_tuft.webp
```
Small tuft of green grass blades, 3D rendered, cartoon style,
transparent background, game decoration sprite, 32x32, ground detail
```

### vine.webp
```
Small hanging vine with green leaves, 3D rendered, cartoon style,
transparent background, game decoration sprite, 32x32, nature element
```

---

## 6. Effects

### cloud.webp (기존), cloud_2.webp, cloud_3.webp (256x96, transparent)
```
cloud (기존): Fluffy white cloud, 3D rendered, soft rounded shape, transparent background, game effect, 256x96
cloud_2: Wider fluffy cloud with flat bottom, 3D rendered, transparent background, game effect, 256x96
cloud_3: Thin wispy stretched cloud, 3D rendered, semi-transparent, transparent background, game effect, 256x96
```

### particle_orange.webp (32x32, transparent)
```
Soft orange glow circle, radial gradient from bright orange center to transparent edge,
game particle effect, transparent background, 32x32, smooth edges
```

### particle_gold.webp (32x32, transparent)
```
Golden sparkle glow, radial gradient from bright gold center to transparent edge,
slight star shape, game particle effect, transparent background, 32x32
```

---

## 파일 배치 경로

```
public/assets/
├── backgrounds/
│   ├── sky_day.webp
│   ├── sky_sunset.webp
│   ├── sky_night.webp
│   ├── sky_dawn.webp
│   └── sky_space.webp
├── sprites/
│   ├── bunny_idle.webp
│   ├── bunny_jump.webp
│   └── bunny_fall.webp
├── items/
│   ├── carrot_normal.webp
│   └── carrot_special.webp
├── tiles/
│   ├── ground.webp
│   ├── grass.webp
│   └── deco/
│       ├── mushroom.webp
│       ├── grass_tuft.webp
│       └── vine.webp
└── effects/
    ├── cloud.webp
    ├── cloud_2.webp
    ├── cloud_3.webp
    ├── particle_orange.webp
    └── particle_gold.webp
```

## 참고사항

- 배경 이미지는 투명 배경 불필요 (전체 화면 채움)
- 캐릭터/아이템/효과는 반드시 **투명 배경**
- WebP 품질 80-90% 권장 (용량 vs 품질 균형)
- 지면 타일은 **seamless** (상하좌우 이어붙이기 가능) 필수
- 토끼 스프라이트는 기본 스킨(흰색)만 우선 생성, 다른 스킨은 후속 작업
