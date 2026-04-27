# BunnyHop Audio Generation Prompts (Gemini)

## 공통 가이드

### BGM 공통 조건
- 루프 가능한 구조 (끝과 시작이 자연스럽게 이어지도록)
- 30초 길이
- 게임 BGM 느낌 (플레이에 집중할 수 있도록 보컬 없음)
- 밝고 에너지 있는 템포 (BPM 130~150)
- 모바일 게임에 적합한 깔끔한 믹스
- 출력: OGG 또는 MP3

### 효과음 공통 조건
- 짧고 임팩트 있는 사운드 (0.3~1초)
- 게임 효과음 스타일 (과하지 않게)
- 배경음과 겹쳐도 명확히 들리는 주파수 대역
- 출력: OGG 또는 MP3

---

## BGM Prompts (스킨별)

### 1. Default (기본 토끼)
```
Create a 30-second loopable game BGM. Cute and cheerful casual game music. Light piano melody with soft xylophone accents. Gentle bass line. Playful and bouncy rhythm at 140 BPM. Happy and innocent mood like a bunny hopping in a meadow. No vocals. Clean mix suitable for mobile game. The end should seamlessly connect back to the beginning for perfect looping.
```

### 2. Shadow (섀도우 버니)
```
Create a 30-second loopable game BGM. Dark and mysterious electronic music. Deep synth bass with atmospheric pads. Subtle glitchy hi-hats and muted kick drum. Minor key melody using bell-like synth sounds. Mysterious and slightly eerie mood but still playful. 135 BPM. No vocals. Think dark fairy tale or shadow realm. The end should seamlessly loop back to the start.
```

### 3. Shadow Ninja (섀도우 닌자)
```
Create a 30-second loopable game BGM. Japanese-inspired ninja action music. Traditional koto or shamisen melody combined with modern electronic beats. Taiko drum rhythm mixed with electronic kick and snare. Fast and intense at 145 BPM. Stealthy and agile mood. Pentatonic scale. No vocals. Think ninja running across rooftops at night. Seamless loop.
```

### 4. Ocean Pirate (오션 파이럿)
```
Create a 30-second loopable game BGM. Adventurous pirate sea shanty style. Accordion or concertina lead melody. Bouncy 6/8 time feel at 140 BPM. Upbeat and swashbuckling mood. Light orchestral backing with strings and brass hints. Wooden percussion (claves, woodblock). No vocals. Think sailing the open sea on a sunny day. Seamless loop.
```

### 5. Metal Hero (메탈 히어로)
```
Create a 30-second loopable game BGM. Heroic action music with electronic rock feel. Power synth lead melody. Driving electric guitar riffs (palm-muted chugging). Strong kick-snare pattern at 150 BPM. Epic and empowering mood. Think suiting up in power armor and flying into action. Brass-like synth stabs for heroic feel. No vocals. Seamless loop.
```

### 6. Thunder Guardian (썬더 가디언)
```
Create a 30-second loopable game BGM. Epic orchestral action music with thunder theme. Bold brass fanfare melody. Dramatic timpani and orchestral percussion. Soaring string section. Powerful and majestic mood at 140 BPM. Norse/Viking warrior feeling. Occasional deep bass drops like thunder. No vocals. Think god of thunder descending from the sky. Seamless loop.
```

### 7. Jungle King (정글 킹)
```
Create a 30-second loopable game BGM. African-inspired jungle music. Djembe and conga drum patterns as the rhythmic foundation. Kalimba or marimba melody. Deep tribal bass. Call-and-response musical phrases. Wild and primal energy at 135 BPM. Think a lion prowling through the savanna. Organic and earthy sound palette. No vocals. Seamless loop.
```

### 8. Claw Fighter (클로 파이터)
```
Create a 30-second loopable game BGM. Aggressive punk rock energy with electronic elements. Distorted power chord riffs. Fast and punchy drum beat at 150 BPM. Raw and fierce attitude. Growling bass line. Quick melodic runs between riff sections. Think underground fighting arena. Intense but fun, not scary. No vocals. Seamless loop.
```

### 9. Space Explorer (스페이스 익스플로러)
```
Create a 30-second loopable game BGM. Dreamy synthwave space exploration music. Lush analog synth pads and arpeggiated sequences. Retro 80s-inspired bass line. Shimmering high-frequency textures like stars twinkling. Cosmic and wonder-filled mood at 130 BPM. Think floating through a beautiful nebula. Reverb-heavy atmospheric mix. No vocals. Seamless loop.
```

---

## 효과음 Prompts (공통 — 스킨 무관)

### 10. 점프 (Jump)
```
Create a short game sound effect (0.2 seconds). Bright bouncy jump sound. Quick upward pitch sweep. Soft spring-like "boing" with a light sparkle at the end. Cute and satisfying. Think a small character bouncing off a mushroom. Clean and clear.
```

### 11. 당근 먹기 (Carrot Eat)
```
Create a short game sound effect (0.2 seconds). Satisfying crunch bite sound. Quick crispy chomp with a subtle juicy pop at the end. Think biting into a fresh carrot. Bright and rewarding. Should feel like collecting a coin but more organic.
```

### 12. 골든 당근 (Golden Carrot)
```
Create a short game sound effect (0.5 seconds). Magical golden item pickup sound. Sparkling ascending arpeggio chime. Shimmering high-frequency shimmer trailing off. Think collecting a rare power-up or golden star. Exciting and rewarding. More impactful than the regular carrot sound.
```

### 13. 게임 오버 (Game Over)
```
Create a short game sound effect (1 second). Sad game over jingle. Descending melody (4 notes going down). Soft and melancholic but not harsh. A gentle "aww" feeling. Low bass thud at the start like hitting the ground. Think a cute character falling and looking disappointed. Not dramatic, just gently sad.
```

### 14. 업적 달성 (Achievement Unlocked)
```
Create a short game sound effect (0.8 seconds). Achievement unlock fanfare. Bright ascending 4-note chime followed by a triumphant bell ring. Celebratory and rewarding. Think leveling up or unlocking a new item. Clear and memorable. Should make the player feel accomplished.
```

### 15. UI 버튼 탭 (UI Tap)
```
Create a very short game sound effect (0.1 seconds). Subtle UI button click. Soft, clean tap sound. Not intrusive. Think tapping a glass button on a phone screen. Minimal and elegant. Should not be annoying even when tapped repeatedly.
```

### 16. 스킨 선택 / 장착 (Skin Equip)
```
Create a short game sound effect (0.5 seconds). Character transformation or costume change sound. Quick whoosh followed by a magical sparkle burst. Think a superhero putting on their suit. Satisfying and cool. Medium impact — more special than a UI tap but less dramatic than an achievement.
```

---

## 파일 구조

```
public/assets/audio/
├── bgm/
│   ├── default.ogg        (~350KB)
│   ├── shadow.ogg
│   ├── shadow_ninja.ogg
│   ├── ocean_pirate.ogg
│   ├── metal_hero.ogg
│   ├── thunder_guardian.ogg
│   ├── jungle_king.ogg
│   ├── claw_fighter.ogg
│   └── space_explorer.ogg
└── sfx/
    ├── jump.ogg            (~10KB)
    ├── carrot_eat.ogg
    ├── golden_carrot.ogg
    ├── game_over.ogg
    ├── achievement.ogg
    ├── ui_tap.ogg
    └── skin_equip.ogg
```

## 생성 후 체크리스트

- [ ] 각 BGM 루프가 자연스럽게 이어지는지 확인 (Audacity에서 반복 재생)
- [ ] 루프 포인트가 정확하지 않으면 Audacity에서 크로스페이드 편집
- [ ] 볼륨 레벨이 BGM/SFX 간 균형 맞는지 확인
- [ ] OGG 형식으로 export (quality 5~6, 약 96~128kbps)
- [ ] 파일명이 위 구조와 일치하는지 확인
- [ ] 모바일에서 재생 테스트 (일부 기기에서 OGG 미지원 시 MP3 폴백 필요)
