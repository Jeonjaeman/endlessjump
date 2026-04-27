# BunnyHop Graphics Upgrade — Design Spec

## Summary

WebGL shader removal + AI-generated pre-rendered sprites for all game elements.
Zero per-frame gradient creation. Target: stable 60fps on mid-range devices (2-3 year old mid-tier phones).

## Problem

Three performance bottlenecks causing lag:
1. **WebGL→Canvas2D cross-canvas copy** — GPU readback every frame (`sky-renderer.ts:277`)
2. **Heavy fragment shader** — fbm 4-octave noise + aurora 4 iterations + nebula = ~20 noise calls per pixel
3. **Gradient recreation every frame** — ~60 `createRadialGradient`/`createLinearGradient` calls per frame (clouds, ground, bunny, particles)

## Strategy

**Full Sprite Replacement (Option A):**
- Replace all procedural rendering with pre-rendered AI-generated sprites
- Remove WebGL entirely
- Leverage existing AssetManager (already built, just needs actual images)
- Preserve vector fallback for asset loading failures

## Asset List

| Category | Asset | Spec | Count |
|----------|-------|------|-------|
| Background | Sky (day/sunset/night/dawn/space) | 1080x1920 WebP, vertical | 5 |
| Ground | Isometric stone block tile (seamless) | 128x128 WebP | 1 |
| Ground | Grass/moss top overlay | 256x32 WebP | 1 |
| Ground | Decorations (mushroom, grass, vine) | 32x32 WebP | 3-4 |
| Character | Bunny (idle/jump/fall) | 128x128 transparent WebP | 3 per skin |
| Items | Carrot (normal) | 64x64 transparent WebP | 1 |
| Items | Golden carrot (with glow) | 64x64 transparent WebP | 1 |
| Effects | Cloud variants | 256x96 transparent WebP | 2-3 |
| Effects | Particle glow (orange/gold) | 32x32 transparent WebP | 2 |

**Total:** ~20 assets, ~500KB (WebP compressed)

### AI Generation Guidelines

- **Tool:** Gemini Imagen / DALL-E / Midjourney (user choice)
- **Common prompt keywords:** "3D rendered, cute chibi style, soft lighting, game asset, transparent background, mobile game"
- **Post-processing:** Background removal (characters/items), size normalization, WebP conversion
- **Consistency:** Same prompt base + seed pinning per batch

## Rendering Pipeline

### Before (Laggy)
```
Every frame:
  WebGL shader → GPU readback → drawImage composition
  Clouds: 40x createRadialGradient
  Ground: 8x createLinearGradient
  Bunny: 10+ createRadialGradient
  Particles: Nx createRadialGradient
  Total: ~60 gradient creations + 1 GPU readback
```

### After (60fps)
```
Every frame:
  drawImage(sky_sprite)       x1-2 (crossfade during transition)
  drawImage(ground_tile)      xN (tile repeat)
  drawImage(cloud_sprite)     x40
  drawImage(carrot_sprite)    x~10 (visible only)
  drawImage(bunny_sprite)     x1
  drawImage(particle_sprite)  x~20
  Total: 0 gradients, 0 WebGL, drawImage only
```

## Background System

### Height Zones

| Height (mm) | Theme | Description |
|-------------|-------|-------------|
| 0-2000 | Meadow | Blue sky, clouds, bright atmosphere |
| 2000-5000 | High altitude | Deeper sky, clouds below |
| 5000-10000 | Stratosphere | Dark navy, stars appear |
| 10000+ | Space | Night sky + aurora + nebula (capture image style) |

### Day/Night Cycle

- Existing `DAY_CYCLE_MS = 120,000` (2min cycle) preserved
- Low altitude only: crossfade between day/night variants
- High altitude and above: always dark tone (no day/night toggle needed)
- 5 background images cover all combinations

### Crossfade Implementation

```typescript
// Pseudocode
ctx.globalAlpha = 1.0;
ctx.drawImage(currentBg, 0, 0, w, h);
if (fadeProgress > 0) {
  ctx.globalAlpha = fadeProgress; // 0→1 over ~2 seconds
  ctx.drawImage(nextBg, 0, 0, w, h);
  ctx.globalAlpha = 1.0;
}
```

- Maximum 2x drawImage during transition, 1x otherwise
- Transition triggered by height zone change or day/night cycle

## Module Refactoring

### Current: game.ts (1,668 lines, single class)

### Target Structure

| File | Content | Est. Lines |
|------|---------|------------|
| `src/audio.ts` | BGM scheduling, SFX (carrot, golden carrot sounds) | ~200 |
| `src/background.ts` | Height/time-based crossfade system (new) | ~80 |
| `src/renderer.ts` | Bunny, carrot, ground, cloud, particle rendering | ~450 |
| `src/input.ts` | Touch/mouse events, tap handlers | ~150 |
| `src/game.ts` | Game loop, physics, state management only | ~400 |

### Deleted

- `src/sky-renderer.ts` — WebGL shader completely removed

### Principles

- Extraction only, no behavior changes (refactoring)
- Each module receives Game instance or required state as parameters
- Existing vector fallback code preserved in `renderer.ts`

## Asset Loading Strategy

### AssetManager Extensions

New asset keys added to `src/assets.ts`:

```
sky_day, sky_sunset, sky_night, sky_dawn, sky_space
ground_deco_mushroom, ground_deco_grass, ground_deco_vine
particle_orange, particle_gold
cloud_1, cloud_2, cloud_3
```

### Loading Priority

- **Required (splash screen wait):** bunny (3 poses), carrot (2), ground tile (1), first background (1)
- **Optional (background load after game start):** additional backgrounds (4), decorations (3-4), cloud variants (2-3), particles (2)
- **Failure handling:** Vector fallback already implemented — game works without any assets

### Expected Load Times

- ~500KB WebP total
- 3G: ~2 seconds
- LTE: <1 second

## Implementation Phases

### Phase 1: Performance Fix (Lag Elimination)

- Remove WebGL: delete `sky-renderer.ts`, remove `SkyRenderer` from `game.ts`
- Replace sky rendering with temporary solid gradient (Canvas 2D `createLinearGradient` once, cached)
- Cache particle gradients on offscreen canvas
- **Milestone:** Lag eliminated, game runs at 60fps

### Phase 2: Module Refactoring

- Extract `audio.ts` from game.ts
- Extract `renderer.ts` from game.ts
- Extract `input.ts` from game.ts
- Create `background.ts` (new)
- Clean up `game.ts` to loop/physics/state only
- **Milestone:** game.ts reduced from 1,668 to ~400 lines, build passes

### Phase 3: Asset Pipeline

- Add new asset keys to AssetManager
- Implement required/optional loading split
- Build background crossfade system in `background.ts`
- **Milestone:** Asset infrastructure ready, waiting for actual images

### Phase 4: AI Asset Generation & Integration

- Generate background images (5)
- Generate bunny sprites (3 poses, default skin)
- Generate carrot/golden carrot sprites
- Generate ground tile + decorations
- Generate cloud variants + particle sprites
- Place in `public/assets/` directories
- Visual verification
- **Milestone:** Target quality reached (capture image level)

## Risks & Mitigations

| Risk | Probability | Mitigation |
|------|-------------|------------|
| AI-generated image style inconsistency | High | Same prompt base + seed pinning, regenerate as needed |
| Background transition flicker | Low | Tune crossfade duration (1-3 seconds) |
| Asset loading failure | Low | Vector fallback already implemented |
| Skin-specific bunny sprite proliferation | Medium | Default skin only in Phase 4, others in follow-up |

## Key Guarantee

Phase 1 alone fixes the lag. Each subsequent phase adds visual quality without any performance regression. Vector fallback is preserved throughout — if any asset fails to load, the game still works.
