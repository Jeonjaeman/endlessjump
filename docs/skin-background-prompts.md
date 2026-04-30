# 스킨별 배경 이미지 프롬프트

## 공통 사양

- 해상도: 1080x1920 (9:16 세로)
- 포맷: WebP
- 스타일: 모바일 아케이드 게임용, 세로 스크롤, 장애물/캐릭터 없이 순수 배경만
- 색감: 각 스킨의 테마 컬러와 조화
- 디테일: 중간 정도 (캐릭터/UI가 잘 보이도록 과도하게 복잡하지 않게)
- 하단은 밝거나 단순하게 (지면 근처), 상단으로 갈수록 테마 강화

## 파일 네이밍 규칙

```
public/assets/backgrounds/{skin_id}/sky_day.webp
public/assets/backgrounds/{skin_id}/sky_sunset.webp
public/assets/backgrounds/{skin_id}/sky_night.webp
public/assets/backgrounds/{skin_id}/sky_dawn.webp
public/assets/backgrounds/{skin_id}/sky_space.webp
```

기본 스킨(default)은 기존 경로 유지: `public/assets/backgrounds/sky_*.webp`

---

## 1. default (기본 토끼)

테마: 평화로운 초원, 맑은 하늘, 부드러운 자연
컬러 키: 흰색, 하늘색, 연두색

### sky_day
> Bright sunny meadow sky, soft white clouds scattered across clear blue sky, gentle rolling green hills at the bottom, warm sunlight, peaceful countryside atmosphere, vertical mobile game background, simple and clean, pastel tones, no characters

### sky_sunset
> Golden hour meadow sky, warm orange and pink gradient clouds, silhouette of gentle hills, golden sunlight rays streaming through clouds, peaceful evening atmosphere, vertical mobile game background, soft warm palette

### sky_night
> Calm starry night sky over meadow, deep navy blue with twinkling stars, crescent moon glowing softly, gentle dark hills silhouette at bottom, fireflies dotting the air, serene nighttime, vertical mobile game background

### sky_dawn
> Early morning meadow sky, soft pink and lavender gradient, thin wispy clouds catching first light, morning mist over gentle hills, dew-fresh atmosphere, vertical mobile game background, dreamy pastel colors

### sky_space
> Peaceful cosmic sky, soft nebula in pastel blue and white, distant gentle stars, Earth's atmosphere glow at bottom edge, serene outer space, not too dark, vertical mobile game background, calming space scene

---

## 2. shadow (섀도우 버니)

테마: 신비로운 어둠의 숲, 보라빛 마법
컬러 키: #4A4A5A, #8B5CF6, 보라/남색

### sky_day
> Mystical dark forest canopy, filtered purple-tinted daylight through twisted trees, floating violet particles, eerie but beautiful atmosphere, dark tree silhouettes framing the edges, misty purple haze, vertical mobile game background

### sky_sunset
> Haunted forest at dusk, deep purple and magenta sky bleeding through dark branches, glowing violet orbs floating in mist, shadowy tree silhouettes, ethereal twilight atmosphere, vertical mobile game background

### sky_night
> Dark enchanted forest at midnight, deep indigo sky, bioluminescent purple mushrooms and flowers glowing, moonlight filtering through dense canopy, floating purple fireflies, mysterious atmosphere, vertical mobile game background

### sky_dawn
> Shadowy forest at pre-dawn, faint lavender light breaking through dark mist, purple fog rolling between ancient trees, subtle violet glow on horizon, mystical awakening, vertical mobile game background

### sky_space
> Dark void dimension, deep purple nebula swirling with black, glowing violet crystal formations floating, dark energy wisps, otherworldly shadow realm, scattered amethyst stars, vertical mobile game background

---

## 3. shadow_ninja (섀도우 닌자)

테마: 일본풍 야경, 대나무 숲, 은밀한 닌자 세계
컬러 키: #2A2A3A, #6050A0, 짙은 남색/보라

### sky_day
> Japanese bamboo forest in misty daylight, tall dark bamboo stalks framing the view, filtered gray-blue light, zen garden stones at bottom, subtle fog, traditional Asian atmosphere, muted desaturated tones, vertical mobile game background

### sky_sunset
> Japanese temple rooftops silhouetted against blood-red sunset, dark bamboo forest, crimson and deep purple sky, paper lanterns glowing faintly, dramatic Eastern sunset, vertical mobile game background

### sky_night
> Moonlit Japanese rooftop scene, full moon behind dark clouds, traditional pagoda silhouettes, dark bamboo forest, ninja stars subtly hidden in shadows, deep navy and charcoal tones, vertical mobile game background

### sky_dawn
> Misty Japanese mountain dawn, faint indigo and steel blue light, Mount Fuji silhouette in distance, bamboo forest in fog, cherry blossom petals drifting, quiet pre-dawn moment, vertical mobile game background

### sky_space
> Cosmic Japanese ink painting style, dark void with swirling ink-like nebula, traditional cloud patterns (kumo) made of stars, crescent moon as brushstroke, zen minimalist space, vertical mobile game background

---

## 4. ocean_pirate (오션 파이럿)

테마: 대해적 모험, 열대 바다, 항구
컬러 키: #1A5580, #40B8E0, 청록/감청색

### sky_day
> Tropical ocean paradise, bright turquoise sea meeting clear blue sky at horizon, white fluffy cumulus clouds, distant tropical island with palm trees, sparkling water reflections, pirate adventure atmosphere, vertical mobile game background

### sky_sunset
> Pirate ship sailing into golden sunset over ocean, dramatic orange and coral sky reflecting on calm sea, silhouette of distant islands, golden clouds, adventurous Caribbean evening, vertical mobile game background

### sky_night
> Moonlit pirate ocean at night, silver moonlight reflecting on dark teal waves, distant ghost ship silhouette, stars and constellation map overlay, nautical night sky, Jolly Roger flag shadow, vertical mobile game background

### sky_dawn
> Ocean dawn breaking over calm sea, soft coral and aquamarine gradient sky, lighthouse beam cutting through morning mist, seagulls silhouetted, gentle waves, new adventure beginning, vertical mobile game background

### sky_space
> Underwater-to-space transition, deep ocean blue fading into cosmic deep sea, bioluminescent jellyfish floating like stars, coral reef nebula, cosmic ocean dreamscape, vertical mobile game background

---

## 5. metal_hero (메탈 히어로)

테마: 미래 도시, 강철 요새, 사이버 메카닉
컬러 키: #B0B8C8, #5070A0, 메탈릭 실버/스틸블루

### sky_day
> Futuristic cityscape under bright sky, sleek silver skyscrapers with blue glass panels, flying vehicles in distance, clean metallic architecture, chrome reflections, advanced civilization, cool steel blue tones, vertical mobile game background

### sky_sunset
> Cyberpunk city sunset, metallic buildings reflecting orange and steel blue, neon lights beginning to glow, industrial skyline silhouette, chrome and copper gradient sky, futuristic twilight, vertical mobile game background

### sky_night
> Neon-lit futuristic city at night, dark steel buildings with blue and white LED lights, holographic billboards, rain-slicked surfaces reflecting neon, cool metallic nightscape, vertical mobile game background

### sky_dawn
> Industrial dawn over metal fortress, pale steel blue and silver sky, massive mechanical structures emerging from morning fog, cold metallic mist, factory silhouettes, vertical mobile game background

### sky_space
> Space station exterior, massive steel structures floating in orbit, Earth visible below, metallic panels reflecting starlight, satellite dishes and antennas, industrial space, cool silver and blue palette, vertical mobile game background

---

## 6. thunder_guardian (썬더 가디언)

테마: 폭풍의 수호자, 번개, 전기 에너지
컬러 키: #4A3080, #FFD840, 보라/금색

### sky_day
> Dramatic stormy sky with golden sunlight breaking through dark purple thunderclouds, lightning bolts in distance, electric energy crackling in clouds, powerful atmosphere, gold and violet contrast, vertical mobile game background

### sky_sunset
> Epic thunderstorm at sunset, massive purple cumulonimbus clouds lit gold from below, chain lightning illuminating the sky, electric orange and deep violet gradient, dramatic power, vertical mobile game background

### sky_night
> Intense electrical storm at night, deep purple sky splitting with bright golden lightning bolts, thunder clouds swirling, electric energy arcs, powerful and dramatic, gold sparks scattered, vertical mobile game background

### sky_dawn
> Storm clearing at dawn, dark violet clouds parting to reveal golden dawn light, residual lightning flickers, electric purple mist, rainbow forming through storm remnants, vertical mobile game background

### sky_space
> Cosmic electrical storm, purple nebula with golden lightning-like energy streams, plasma bolts arcing between asteroid clusters, electric space phenomenon, thunder in vacuum, vertical mobile game background

---

## 7. jungle_king (정글 킹)

테마: 정글의 왕, 사바나, 야생의 위엄
컬러 키: #C8880A, #E8A820, 골드/앰버/올리브

### sky_day
> Lush tropical jungle canopy, golden sunlight streaming through dense green foliage, exotic birds flying, ancient temple ruins peeking through vines, warm amber sunbeams, rich jungle atmosphere, vertical mobile game background

### sky_sunset
> African savanna sunset, massive golden sun on horizon, acacia tree silhouettes, warm amber and burnt orange sky, tall grass silhouette at bottom, majestic wild landscape, lion's domain, vertical mobile game background

### sky_night
> Jungle moonrise, full golden moon through dense tropical canopy, exotic night flowers glowing, golden fireflies among dark foliage, warm amber moonlight, nocturnal jungle alive, vertical mobile game background

### sky_dawn
> Savanna golden dawn, warm amber light flooding across grassland, distant mountain silhouettes, morning mist over tall grass, golden hour glow, birds taking flight, majestic sunrise, vertical mobile game background

### sky_space
> Cosmic jungle, golden nebula shaped like tree canopy, star clusters forming animal constellations (lion, eagle), amber and gold space dust, primordial cosmic wilderness, vertical mobile game background

---

## 8. claw_fighter (클로 파이터)

테마: 전투 아레나, 화산, 격투의 불꽃
컬러 키: #8B3A3A, #E06060, 진홍/크림슨/다크레드

### sky_day
> Volcanic landscape under harsh red-tinted sun, jagged rock formations, smoldering craters, heat haze rising, crimson dust in air, barren battle arena terrain, intense and hostile, vertical mobile game background

### sky_sunset
> Volcanic eruption at sunset, lava flows glowing orange-red, massive dark smoke plume against blood-red sky, ember particles floating, destructive beauty, crimson and black palette, vertical mobile game background

### sky_night
> Lava fields at night, rivers of molten red lava glowing against dark volcanic rock, red-hot embers floating upward like inverted rain, dark crimson sky with ash clouds, vertical mobile game background

### sky_dawn
> Battle arena at dawn, dark red sky slowly lightening, ancient colosseum ruins silhouetted, dust settling after battle, crimson fog, claw marks scored across the clouds, vertical mobile game background

### sky_space
> Infernal cosmic realm, red nebula with ember-like stars, molten asteroid field, crimson space dust clouds, volcanic planet surface visible below, hellish space landscape, vertical mobile game background

---

## 9. space_explorer (스페이스 익스플로러)

테마: 우주 탐험, 외계 행성, 성운, SF
컬러 키: #0A1A3A, #4090FF, 딥블루/네온블루

### sky_day
> Alien planet daylight, bright blue-white sun in foreign sky, floating rock islands, bioluminescent alien flora, crystalline structures, strange but beautiful exoplanet surface, cool blue tones, vertical mobile game background

### sky_sunset
> Binary sunset on alien planet, two suns setting in deep blue and teal gradient sky, alien landscape with crystal formations, otherworldly twilight, sci-fi atmosphere, vertical mobile game background

### sky_night
> Deep space vista, spectacular galaxy spiral visible, countless stars in deep navy void, colorful nebula bands in blue and cyan, space station lights in distance, awe-inspiring cosmos, vertical mobile game background

### sky_dawn
> Alien world sunrise, bright blue star rising over crystalline horizon, aurora-like phenomenon in sky, glowing blue atmospheric rings, futuristic dawn on distant planet, vertical mobile game background

### sky_space
> Hyperspace travel, blue energy tunnel with streaking stars, warp speed light trails, deep cosmic blue void, energy ribbons flowing, interstellar journey, electric blue and white, vertical mobile game background

---

## 제작 순서 권장

1. **shadow** - 가장 인기 스킨, 보라빛 차별화 뚜렷
2. **ocean_pirate** - 바다 테마로 기존 배경과 완전히 다른 분위기
3. **jungle_king** - 골드톤 사바나, 시각적 임팩트 큼
4. **thunder_guardian** - 번개 이펙트로 역동적
5. **space_explorer** - 우주 테마, SF 감성
6. **metal_hero** - 미래 도시, 사이버펑크
7. **claw_fighter** - 화산/전투 테마
8. **shadow_ninja** - 일본풍, shadow와 차별화 필요
9. **default** - 기존 배경 유지 또는 소폭 개선

## 구현 참고

현재 배경 시스템 (`background.ts`):
- 높이에 따라 5개 배경 순환: day -> sunset -> dawn -> space -> (역순 반복)
- 낮/밤 사이클: 120초 주기
- 패럴랙스 효과 적용

스킨별 배경 적용 시 필요 작업:
1. `assets.ts`에 스킨별 배경 AssetKey 추가
2. `background.ts`에 현재 스킨 ID 받아서 해당 배경 세트 사용
3. `skin-service.ts`에 spriteDir 활용하여 배경 경로 매핑
4. 총 이미지 수: 8 스킨 x 5 장면 = 40장 (default 제외)
