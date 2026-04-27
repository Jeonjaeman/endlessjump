# Graphics Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove WebGL shader and all per-frame gradient creation, replace with AI-generated pre-rendered sprites to achieve stable 60fps and capture-image-level visual quality.

**Architecture:** Full sprite replacement strategy. Delete WebGL sky renderer, extract audio/renderer/input/background modules from monolithic game.ts, extend existing AssetManager with background crossfade system. All rendering becomes drawImage-only with vector fallback preserved.

**Tech Stack:** TypeScript, Vite, Canvas 2D API, WebP sprites

**Spec:** `docs/superpowers/specs/2026-04-26-graphics-upgrade-design.md`

---

## File Structure

### New Files
- `src/audio.ts` — BGM scheduling, SFX playback (extracted from game.ts)
- `src/background.ts` — Height/time-based background crossfade system (new)
- `src/renderer.ts` — Bunny, carrot, ground, cloud, particle rendering (extracted from game.ts)
- `src/input.ts` — Touch/mouse event handling, tap detection (extracted from game.ts)

### Modified Files
- `src/game.ts` — Strip to game loop, physics, state management only
- `src/assets.ts` — Add background/decoration/particle asset keys

### Deleted Files
- `src/sky-renderer.ts` — WebGL shader completely removed

### Asset Directories (populated in Phase 4)
- `public/assets/backgrounds/` — sky_day, sky_sunset, sky_night, sky_dawn, sky_space
- `public/assets/sprites/` — bunny_idle, bunny_jump, bunny_fall (already in AssetManager)
- `public/assets/items/` — carrot_normal, carrot_special (already in AssetManager)
- `public/assets/tiles/` — ground, grass (already in AssetManager)
- `public/assets/effects/` — cloud, cloud_2, cloud_3, particle_orange, particle_gold
- `public/assets/tiles/deco/` — mushroom, grass_tuft, vine

---

## Phase 1: Performance Fix (Lag Elimination)

### Task 1: Remove WebGL Sky Renderer

**Files:**
- Delete: `src/sky-renderer.ts`
- Modify: `src/game.ts:1,12,67-68,119,168,871-943`

- [ ] **Step 1: Remove SkyRenderer import and field from game.ts**

In `src/game.ts`, remove the import line and the field initialization:

```typescript
// DELETE this line (line 12):
import { SkyRenderer } from './sky-renderer';

// DELETE this line (line 119):
private skyRenderer = new SkyRenderer();
```

- [ ] **Step 2: Remove skyRenderer.resize() call**

In `src/game.ts` `resize()` method, remove:

```typescript
// DELETE this line (inside resize()):
this.skyRenderer.resize(this.w * dpr, this.h * dpr);
```

- [ ] **Step 3: Replace renderBackground with cached gradient**

Replace the `renderBackground` method and `getSkyColors` method in `src/game.ts` with a simple cached gradient:

```typescript
private skyGradientCache: CanvasGradient | null = null;
private skyGradientH = 0;

private renderBackground(ctx: CanvasRenderingContext2D): void {
  // Cache gradient — only recreate on height change
  if (!this.skyGradientCache || this.skyGradientH !== this.h) {
    this.skyGradientH = this.h;
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, '#1a1a3e');
    grad.addColorStop(1, '#2d4a7a');
    this.skyGradientCache = grad;
  }
  ctx.fillStyle = this.skyGradientCache;
  ctx.fillRect(0, 0, this.w, this.h);
}
```

Remove the `getSkyColors()` method entirely (it is no longer called after this replacement).

- [ ] **Step 4: Delete sky-renderer.ts**

Delete the file `src/sky-renderer.ts`.

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/game.ts
git rm src/sky-renderer.ts
git commit -m "perf: WebGL sky renderer 제거 — 임시 캐시 그라디언트로 대체"
```

---

### Task 2: Cache Particle Gradients on Offscreen Canvas

**Files:**
- Modify: `src/game.ts` (renderParticles method, lines ~1492-1507)

- [ ] **Step 1: Create cached particle sprite generator**

Add a particle cache system above the `Game` class in `src/game.ts`:

```typescript
const particleCache = new Map<string, HTMLCanvasElement>();

function getParticleSprite(color: string, radius: number): HTMLCanvasElement {
  const key = `${color}_${radius}`;
  let canvas = particleCache.get(key);
  if (canvas) return canvas;

  canvas = document.createElement('canvas');
  const size = Math.ceil(radius * 3);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cx, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  particleCache.set(key, canvas);
  return canvas;
}
```

- [ ] **Step 2: Replace renderParticles to use cached sprites**

Replace the `renderParticles` method in `src/game.ts`:

```typescript
private renderParticles(ctx: CanvasRenderingContext2D): void {
  for (const p of this.particles) {
    const sy = this.worldToScreen(p.y);
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    const sprite = getParticleSprite(p.color, p.radius);
    const size = sprite.width;
    ctx.drawImage(sprite, p.x - size / 2, sy - size / 2);
  }
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/game.ts
git commit -m "perf: 파티클 그라디언트 오프스크린 캔버스 캐싱"
```

---

### Task 3: Cache Cloud Gradients (Vector Fallback)

**Files:**
- Modify: `src/game.ts` (renderClouds3D method, lines ~945-994)

- [ ] **Step 1: Create cloud sprite cache**

Add below the particle cache in `src/game.ts`:

```typescript
const cloudSpriteCache = new Map<string, HTMLCanvasElement>();

function getCloudSprite(width: number, height: number): HTMLCanvasElement {
  const key = `${width}_${height}`;
  let canvas = cloudSpriteCache.get(key);
  if (canvas) return canvas;

  canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d')!;
  const cx = width / 2;
  const cy = height / 2;

  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;

  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx - width * 0.22, cy + height * 0.15, width * 0.3, height * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + width * 0.22, cy + height * 0.15, width * 0.3, height * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  cloudSpriteCache.set(key, canvas);
  return canvas;
}
```

- [ ] **Step 2: Replace vector cloud rendering to use cached sprites**

In the `renderClouds3D` method, replace the "Vector fallback" section (the `else` block after the sprite branch, starting around `// Vector fallback (기존 코드)`) with:

```typescript
// Cached vector fallback
ctx.save();
ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);
const cachedCloud = getCloudSprite(cw, ch);
ctx.drawImage(cachedCloud, cl.x - cw / 2, screenY - ch / 2);
ctx.restore();
```

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/game.ts
git commit -m "perf: 구름 그라디언트 오프스크린 캔버스 캐싱"
```

---

## Phase 2: Module Refactoring

### Task 4: Extract Audio Module

**Files:**
- Create: `src/audio.ts`
- Modify: `src/game.ts`

- [ ] **Step 1: Create src/audio.ts**

Create `src/audio.ts` by extracting audio methods from game.ts:

```typescript
export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private bgmStarted = false;
  private bgmTimeout: ReturnType<typeof setTimeout> | null = null;

  initAudio(): void {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return;
    }
    this.audioCtx = new AudioContext();
    this.bgmGain = this.audioCtx.createGain();
    this.bgmGain.gain.value = 0.12;
    this.bgmGain.connect(this.audioCtx.destination);
  }

  startBGM(): void {
    if (!this.audioCtx || !this.bgmGain) return;
    this.bgmStarted = false;
    if (this.bgmTimeout) clearTimeout(this.bgmTimeout);
    this.bgmTimeout = setTimeout(() => {
      this.bgmStarted = true;
      this.scheduleBGMLoop();
    }, 50);
  }

  private scheduleBGMLoop(): void {
    if (!this.audioCtx || !this.bgmGain) return;
    const ctx = this.audioCtx;
    const gain = this.bgmGain;
    const bpm = 140;
    const beatDur = 60 / bpm;

    const melody: [number, number][] = [
      [523, 1], [587, 0.5], [659, 0.5], [784, 1], [659, 1],
      [587, 1], [523, 0.5], [440, 0.5], [523, 1], [587, 1],
      [659, 1], [784, 0.5], [880, 0.5], [784, 1], [659, 1],
      [523, 1], [587, 0.5], [523, 0.5], [440, 1], [523, 1],
    ];

    const bassNotes: [number, number][] = [
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
    ];

    const startTime = ctx.currentTime + 0.05;

    let t = startTime;
    for (const [freq, beats] of melody) {
      const dur = beats * beatDur;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.3, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
      osc.connect(env);
      env.connect(gain);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
    const loopDuration = t - startTime;

    let tb = startTime;
    for (const [freq, beats] of bassNotes) {
      const dur = beats * beatDur;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, tb);
      env.gain.linearRampToValueAtTime(0.15, tb + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, tb + dur * 0.9);
      osc.connect(env);
      env.connect(gain);
      osc.start(tb);
      osc.stop(tb + dur);
      tb += dur;
    }

    const scheduleAhead = loopDuration * 1000 - 200;
    setTimeout(() => {
      if (this.bgmStarted) this.scheduleBGMLoop();
    }, Math.max(scheduleAhead, 100));
  }

  stopBGM(): void {
    this.bgmStarted = false;
    if (this.bgmTimeout) {
      clearTimeout(this.bgmTimeout);
      this.bgmTimeout = null;
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  /** Suspend/resume for visibility change */
  suspend(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended' && this.bgmStarted) {
      this.audioCtx.resume();
    }
  }

  playCarrotSound(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.04);
    osc.frequency.linearRampToValueAtTime(400, t + 0.15);
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);

    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource();
    const noiseEnv = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = buffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 1.5;
    noiseEnv.gain.setValueAtTime(0.15, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.08);
  }

  playGoldenCarrotSound(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    const notes = [523, 659, 784, 1047];
    const noteDur = 0.12;

    for (let i = 0; i < notes.length; i++) {
      const noteTime = t + i * noteDur;

      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      env.gain.setValueAtTime(0, noteTime);
      env.gain.linearRampToValueAtTime(0.3, noteTime + 0.02);
      env.gain.setValueAtTime(0.3, noteTime + noteDur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDur + 0.15);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + noteDur + 0.15);

      const osc2 = ctx.createOscillator();
      const env2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = notes[i] * 2;
      env2.gain.setValueAtTime(0, noteTime);
      env2.gain.linearRampToValueAtTime(0.08, noteTime + 0.02);
      env2.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDur + 0.1);
      osc2.connect(env2);
      env2.connect(ctx.destination);
      osc2.start(noteTime);
      osc2.stop(noteTime + noteDur + 0.1);
    }

    const shimmerStart = t + notes.length * noteDur;
    const bufLen = ctx.sampleRate * 0.2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * 0.2;
    }
    const shimmer = ctx.createBufferSource();
    const shimmerEnv = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();
    shimmer.buffer = buf;
    shimmerFilter.type = 'highpass';
    shimmerFilter.frequency.setValueAtTime(3000, shimmerStart);
    shimmerFilter.frequency.linearRampToValueAtTime(8000, shimmerStart + 0.2);
    shimmerEnv.gain.setValueAtTime(0.1, shimmerStart);
    shimmerEnv.gain.exponentialRampToValueAtTime(0.001, shimmerStart + 0.2);
    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerEnv);
    shimmerEnv.connect(ctx.destination);
    shimmer.start(shimmerStart);
    shimmer.stop(shimmerStart + 0.2);
  }
}
```

- [ ] **Step 2: Replace audio methods in game.ts with AudioManager**

In `src/game.ts`:

1. Add import: `import { AudioManager } from './audio';`
2. Add field: `private audio = new AudioManager();`
3. Delete all private audio methods: `initAudio`, `startBGM`, `scheduleBGMLoop`, `stopBGM`, `playCarrotSound`, `playGoldenCarrotSound`
4. Delete audio fields: `audioCtx`, `bgmGain`, `bgmStarted`, `bgmTimeout`
5. Replace all call sites:
   - `this.initAudio()` → `this.audio.initAudio()`
   - `this.startBGM()` → `this.audio.startBGM()`
   - `this.stopBGM()` → `this.audio.stopBGM()`
   - `this.playCarrotSound()` → `this.audio.playCarrotSound()`
   - `this.playGoldenCarrotSound()` → `this.audio.playGoldenCarrotSound()`
6. In visibility change listener, replace:
   - `this.audioCtx` suspend/resume → `this.audio.suspend()` / `this.audio.resume()`

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/audio.ts src/game.ts
git commit -m "refactor: 오디오 모듈 분리 (audio.ts)"
```

---

### Task 5: Create Background Module

**Files:**
- Create: `src/background.ts`
- Modify: `src/game.ts`
- Modify: `src/assets.ts`

- [ ] **Step 1: Add background asset keys to assets.ts**

In `src/assets.ts`, extend the `AssetKey` type and `ASSET_SPECS` array:

```typescript
export type AssetKey =
  | 'bunny_idle'
  | 'bunny_jump'
  | 'bunny_fall'
  | 'carrot_normal'
  | 'carrot_special'
  | 'ground'
  | 'grass'
  | 'cloud'
  | 'cloud_2'
  | 'cloud_3'
  | 'sky_day'
  | 'sky_sunset'
  | 'sky_night'
  | 'sky_dawn'
  | 'sky_space'
  | 'ground_deco_mushroom'
  | 'ground_deco_grass'
  | 'ground_deco_vine'
  | 'particle_orange'
  | 'particle_gold';
```

Add to `ASSET_SPECS`:

```typescript
  { key: 'cloud_2',              basePath: '/assets/effects/cloud_2' },
  { key: 'cloud_3',              basePath: '/assets/effects/cloud_3' },
  { key: 'sky_day',              basePath: '/assets/backgrounds/sky_day' },
  { key: 'sky_sunset',           basePath: '/assets/backgrounds/sky_sunset' },
  { key: 'sky_night',            basePath: '/assets/backgrounds/sky_night' },
  { key: 'sky_dawn',             basePath: '/assets/backgrounds/sky_dawn' },
  { key: 'sky_space',            basePath: '/assets/backgrounds/sky_space' },
  { key: 'ground_deco_mushroom', basePath: '/assets/tiles/deco/mushroom' },
  { key: 'ground_deco_grass',    basePath: '/assets/tiles/deco/grass_tuft' },
  { key: 'ground_deco_vine',     basePath: '/assets/tiles/deco/vine' },
  { key: 'particle_orange',      basePath: '/assets/effects/particle_orange' },
  { key: 'particle_gold',        basePath: '/assets/effects/particle_gold' },
```

- [ ] **Step 2: Create src/background.ts**

```typescript
import { assetManager, type AssetKey } from './assets';

interface HeightZoneBg {
  maxHeight: number;
  dayKey: AssetKey;
  nightKey: AssetKey;
}

const HEIGHT_ZONES: HeightZoneBg[] = [
  { maxHeight: 2000,  dayKey: 'sky_day',    nightKey: 'sky_night' },
  { maxHeight: 5000,  dayKey: 'sky_sunset', nightKey: 'sky_night' },
  { maxHeight: 10000, dayKey: 'sky_dawn',   nightKey: 'sky_space' },
  { maxHeight: Infinity, dayKey: 'sky_space', nightKey: 'sky_space' },
];

const FADE_DURATION = 120; // frames (~2 seconds at 60fps)
const DAY_CYCLE_MS = 120_000;

export class BackgroundRenderer {
  private currentKey: AssetKey | null = null;
  private prevKey: AssetKey | null = null;
  private fadeProgress = 0; // 0=showing prev, 1=fully showing current

  // Cached fallback gradient
  private fallbackGrad: CanvasGradient | null = null;
  private fallbackH = 0;

  /**
   * Render background.
   * @param ctx - Canvas 2D context
   * @param w - canvas width
   * @param h - canvas height
   * @param height - current height reached (mm)
   * @param elapsed - ms since game start (for day/night cycle)
   * @param isPlaying - whether the game is in PLAYING state
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, height: number, elapsed: number, isPlaying: boolean): void {
    const targetKey = this.pickBackground(height, elapsed, isPlaying);

    // Detect background change
    if (targetKey !== this.currentKey) {
      this.prevKey = this.currentKey;
      this.currentKey = targetKey;
      this.fadeProgress = 0;
    }

    // Try sprite rendering
    const currentImg = this.currentKey ? assetManager.get(this.currentKey) : null;
    const prevImg = this.prevKey ? assetManager.get(this.prevKey) : null;

    if (currentImg) {
      // Crossfade transition
      if (this.fadeProgress < 1 && prevImg) {
        ctx.globalAlpha = 1.0;
        ctx.drawImage(prevImg, 0, 0, w, h);
        ctx.globalAlpha = this.fadeProgress;
        ctx.drawImage(currentImg, 0, 0, w, h);
        ctx.globalAlpha = 1.0;
        this.fadeProgress = Math.min(1, this.fadeProgress + 1 / FADE_DURATION);
      } else {
        ctx.drawImage(currentImg, 0, 0, w, h);
        this.fadeProgress = 1;
      }
      return;
    }

    // Fallback: cached gradient
    this.renderFallback(ctx, w, h);
  }

  private pickBackground(height: number, elapsed: number, isPlaying: boolean): AssetKey {
    const zone = HEIGHT_ZONES.find(z => height < z.maxHeight) || HEIGHT_ZONES[HEIGHT_ZONES.length - 1];

    // High altitude: always dark
    if (height >= 5000) return zone.dayKey;

    // Day/night cycle for low altitude
    if (!isPlaying) return zone.nightKey; // default to night on non-playing screens

    const cycle = (elapsed % DAY_CYCLE_MS) / DAY_CYCLE_MS;
    const isNight = cycle >= 0.3 && cycle < 0.7;
    return isNight ? zone.nightKey : zone.dayKey;
  }

  private renderFallback(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    if (!this.fallbackGrad || this.fallbackH !== h) {
      this.fallbackH = h;
      this.fallbackGrad = ctx.createLinearGradient(0, 0, 0, h);
      this.fallbackGrad.addColorStop(0, '#1a1a3e');
      this.fallbackGrad.addColorStop(1, '#2d4a7a');
    }
    ctx.fillStyle = this.fallbackGrad;
    ctx.fillRect(0, 0, w, h);
  }
}
```

- [ ] **Step 3: Integrate BackgroundRenderer into game.ts**

In `src/game.ts`:

1. Add import: `import { BackgroundRenderer } from './background';`
2. Add field: `private bg = new BackgroundRenderer();`
3. Replace the `renderBackground` method:

```typescript
private renderBackground(ctx: CanvasRenderingContext2D): void {
  const elapsed = this.state === GameState.PLAYING
    ? (performance.now() - this.startTime)
    : 0;
  this.bg.render(ctx, this.w, this.h, this.heightReached, elapsed, this.state === GameState.PLAYING);
}
```

4. Remove `skyGradientCache` and `skyGradientH` fields (from Task 1 temporary fix).
5. Remove `getSkyColors()` method if still present.
6. Remove `DAY_CYCLE_MS` constant from game.ts (now in background.ts).

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/background.ts src/assets.ts src/game.ts
git commit -m "feat: 배경 크로스페이드 시스템 구현 (background.ts)"
```

---

### Task 6: Extract Input Module

**Files:**
- Create: `src/input.ts`
- Modify: `src/game.ts`

- [ ] **Step 1: Create src/input.ts**

Extract `setupEvents` and tap handlers. The module provides an `InputManager` that calls back into the Game via an interface:

```typescript
import { GameState } from './types';
import { isShopOpen, handleShopTap } from './ui/shop-screen';

export interface InputCallbacks {
  readonly state: GameState;
  readonly w: number;
  initAudio(): void;
  onStartGame(): void;
  onGameOverTap(x: number, y: number): void;
  onTouchStart(x: number): void;
  onTouchMove(x: number): void;
  onTouchEnd(): void;
}

export class InputManager {
  constructor(canvas: HTMLCanvasElement, cb: InputCallbacks) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      cb.initAudio();
      const t = e.touches[0];
      if (isShopOpen()) { handleShopTap(t.clientX, t.clientY); return; }
      if (cb.state === GameState.START) { cb.onStartGame(); return; }
      if (cb.state === GameState.GAME_OVER) { cb.onGameOverTap(t.clientX, t.clientY); return; }
      cb.onTouchStart(t.clientX);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.touches[0].clientX);
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      cb.onTouchEnd();
    });

    canvas.addEventListener('mousedown', (e) => {
      cb.initAudio();
      if (isShopOpen()) { handleShopTap(e.clientX, e.clientY); return; }
      if (cb.state === GameState.START) { cb.onStartGame(); return; }
      if (cb.state === GameState.GAME_OVER) { cb.onGameOverTap(e.clientX, e.clientY); return; }
      cb.onTouchStart(e.clientX);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.clientX);
    });

    canvas.addEventListener('mouseup', () => { cb.onTouchEnd(); });
  }
}
```

- [ ] **Step 2: Implement InputCallbacks in Game class**

In `src/game.ts`:

1. Add import: `import { InputManager, type InputCallbacks } from './input';`
2. Delete the `setupEvents` method entirely.
3. In the constructor, replace `this.setupEvents()` with:

```typescript
new InputManager(canvas, {
  get state() { return self.state; },
  get w() { return self.w; },
  initAudio: () => this.audio.initAudio(),
  onStartGame: () => {
    this.state = GameState.PLAYING;
    this.velY = JUMP_VELOCITY;
    this.hasJumped = true;
    this.touching = true;
    this.startTime = performance.now();
    this.audio.startBGM();
    if (!areAdsRemoved()) showBanner();
  },
  onGameOverTap: (x: number, y: number) => {
    if (this.handleShopButtonTap(x, y)) return;
    if (this.handleTabTap(x, y)) return;
    if (this.handleReviveTap(x, y)) return;
    this.resetGame();
    this.state = GameState.START;
  },
  onTouchStart: (x: number) => {
    this.touchX = x;
    this.touching = true;
  },
  onTouchMove: (x: number) => {
    if (!this.touching) return;
    this.touchX = x;
  },
  onTouchEnd: () => { this.touching = false; },
});
```

(Where `const self = this;` is declared before the InputManager construction.)

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/input.ts src/game.ts
git commit -m "refactor: 입력 핸들러 모듈 분리 (input.ts)"
```

---

### Task 7: Extract Renderer Module

**Files:**
- Create: `src/renderer.ts`
- Modify: `src/game.ts`

- [ ] **Step 1: Create src/renderer.ts**

Extract all rendering methods and cache functions. The renderer receives game state as parameters:

```typescript
import { CarrotType, BunnyPose, type Carrot, type Particle, type Cloud, type ScorePopup, type SkinColors } from './types';
import { getCurrentSkinColors } from './services/skin-service';
import { assetManager } from './assets';

const BUNNY_RADIUS = 18;
const CARROT_RADIUS = 14;

// ---- Caches ----

const particleCache = new Map<string, HTMLCanvasElement>();

function getParticleSprite(color: string, radius: number): HTMLCanvasElement {
  const key = `${color}_${radius}`;
  let canvas = particleCache.get(key);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  const size = Math.ceil(radius * 3);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cx, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  particleCache.set(key, canvas);
  return canvas;
}

const cloudSpriteCache = new Map<string, HTMLCanvasElement>();

function getCloudSprite(width: number, height: number): HTMLCanvasElement {
  const key = `${width}_${height}`;
  let canvas = cloudSpriteCache.get(key);
  if (canvas) return canvas;
  canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d')!;
  const cx = width / 2;
  const cy = height / 2;
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - width * 0.22, cy + height * 0.15, width * 0.3, height * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + width * 0.22, cy + height * 0.15, width * 0.3, height * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  cloudSpriteCache.set(key, canvas);
  return canvas;
}

// ---- Helper ----

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

// ---- Render state interface ----

export interface RenderState {
  w: number;
  h: number;
  bunnyX: number;
  bunnyY: number;
  velX: number;
  velY: number;
  cameraY: number;
  score: number;
  bestScore: number;
  bestHeight: number;
  heightReached: number;
  bunnyPose: BunnyPose;
  earBounce: number;
  animTime: number;
  scoreBounce: number;
  scoreColor: string;
  carrots: Carrot[];
  particles: Particle[];
  clouds: Cloud[];
  scorePopups: ScorePopup[];
  worldToScreen(worldY: number): number;
  perspectiveScale(worldY: number): number;
}

export function renderClouds(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  const useSprite = assetManager.isReady() && assetManager.has('cloud');
  const cloudSprite = useSprite ? assetManager.get('cloud') : null;

  for (const cl of rs.clouds) {
    const screenY = rs.worldToScreen(cl.y) * cl.z + (1 - cl.z) * rs.h * 0.3;
    if (screenY < -200 || screenY > rs.h + 200) continue;
    const scale = 0.5 + cl.z * 0.5;
    const cw = cl.width * scale;
    const ch = cw * 0.35;

    if (cloudSprite) {
      ctx.save();
      ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);
      ctx.drawImage(cloudSprite, cl.x - cw / 2, screenY - ch / 2, cw, ch);
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);
    const cachedCloud = getCloudSprite(cw, ch);
    ctx.drawImage(cachedCloud, cl.x - cw / 2, screenY - ch / 2);
    ctx.restore();
  }
}

export function renderGround(ctx: CanvasRenderingContext2D, rs: RenderState, groundY: number): void {
  const gy = rs.worldToScreen(groundY);
  if (gy > rs.h + 200) return;

  const useSprite = assetManager.isReady() && assetManager.has('ground');
  const groundSprite = useSprite ? assetManager.get('ground') : null;
  const grassSprite = useSprite ? assetManager.get('grass') : null;

  if (groundSprite) {
    const tileW = groundSprite.width || 64;
    const tileH = groundSprite.height || 64;
    if (grassSprite) {
      const grassH = grassSprite.height || 8;
      for (let bx = 0; bx < rs.w; bx += grassSprite.width || 64) {
        ctx.drawImage(grassSprite, bx, gy - grassH + 2);
      }
    }
    for (let row = gy; row < rs.h + tileH; row += tileH) {
      for (let bx = 0; bx < rs.w; bx += tileW) {
        ctx.drawImage(groundSprite, bx, row);
      }
    }
    return;
  }

  // Vector fallback
  const blockH = 20;
  const rows = 8;
  for (let i = 0; i < rows; i++) {
    const rowY = gy + i * blockH;
    if (rowY > rs.h + blockH) break;
    const depth = i / rows;
    const baseR = 126 - depth * 40;
    const baseG = 200 - depth * 50;
    const baseB = 80 - depth * 30;
    const topColor = `rgb(${baseR},${baseG},${baseB})`;
    const botColor = `rgb(${baseR * 0.7},${baseG * 0.7},${baseB * 0.7})`;
    const grad = ctx.createLinearGradient(0, rowY, 0, rowY + blockH);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, botColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, rowY, rs.w, blockH + 1);
    if (i === 0) {
      const grassGrad = ctx.createLinearGradient(0, rowY - 6, 0, rowY + 4);
      grassGrad.addColorStop(0, '#8ED860');
      grassGrad.addColorStop(1, '#5A9A32');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, rowY - 3, rs.w, 7);
    }
    ctx.strokeStyle = `rgba(0,0,0,${0.05 + depth * 0.08})`;
    ctx.lineWidth = 1;
    const blockW = 40 + i * 5;
    const offset = (i % 2) * blockW * 0.5;
    for (let bx = -blockW + offset; bx < rs.w + blockW; bx += blockW) {
      ctx.strokeRect(bx, rowY, blockW, blockH);
    }
  }
  ctx.fillStyle = `rgb(${126 - 40},${200 - 50},${80 - 30})`;
  ctx.fillRect(0, gy + rows * blockH, rs.w, rs.h);
}

export function renderCarrots(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  const useSprite = assetManager.isReady();
  const normalSprite = useSprite ? assetManager.get('carrot_normal') : null;
  const specialSprite = useSprite ? assetManager.get('carrot_special') : null;

  for (const c of rs.carrots) {
    if (c.eaten) continue;
    const sy = rs.worldToScreen(c.y);
    if (sy < -60 || sy > rs.h + 60) continue;
    const scale = rs.perspectiveScale(c.y);
    const sprite = c.type === CarrotType.SPECIAL ? specialSprite : normalSprite;

    if (sprite) {
      const sw = sprite.width * scale * 0.5;
      const sh = sprite.height * scale * 0.5;
      ctx.save();
      if (c.type === CarrotType.SPECIAL) {
        const glowGrad = ctx.createRadialGradient(c.x, sy, 5, c.x, sy, 28 * scale);
        glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
        glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(c.x, sy, 28 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(sprite, c.x - sw / 2, sy - sh / 2, sw, sh);
      ctx.restore();
      continue;
    }

    // Vector fallback
    if (c.type === CarrotType.NORMAL) {
      drawCarrotVector(ctx, c.x, sy, scale, '#FF6B35', '#E85520', '#4CAF50', '#388E3C', false);
    } else {
      drawCarrotVector(ctx, c.x, sy, scale, '#FFD700', '#E6B800', '#90EE90', '#5CBF5C', true);
    }
  }
}

function drawCarrotVector(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  bodyLight: string, bodyDark: string,
  leafLight: string, leafDark: string,
  glow: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (glow) {
    const glowGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 28);
    glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
    glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(2, 16, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  const bodyGrad = ctx.createLinearGradient(-8, -8, 8, 14);
  bodyGrad.addColorStop(0, bodyLight);
  bodyGrad.addColorStop(0.6, bodyDark);
  bodyGrad.addColorStop(1, bodyLight);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.quadraticCurveTo(-10, 2, -3, 16);
  ctx.lineTo(3, 16);
  ctx.quadraticCurveTo(10, 2, 9, -8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(-7, 2, -2, 12);
  ctx.lineTo(-1, 12);
  ctx.quadraticCurveTo(-4, 2, -3, -6);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i <= 3; i++) {
    const ly = -6 + i * 5;
    ctx.beginPath();
    ctx.moveTo(-8 + i, ly);
    ctx.lineTo(8 - i, ly);
    ctx.stroke();
  }
  const leaves = [
    { angle: -0.4, len: 12 },
    { angle: 0, len: 14 },
    { angle: 0.4, len: 12 },
  ];
  for (const leaf of leaves) {
    const leafGrad = ctx.createLinearGradient(0, -10, 0, -10 - leaf.len);
    leafGrad.addColorStop(0, leafDark);
    leafGrad.addColorStop(1, leafLight);
    ctx.fillStyle = leafGrad;
    ctx.save();
    ctx.translate(0, -9);
    ctx.rotate(leaf.angle);
    ctx.beginPath();
    ctx.ellipse(0, -leaf.len / 2, 3, leaf.len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function renderBunny(ctx: CanvasRenderingContext2D, rs: RenderState, x: number, screenY: number): void {
  const skinColors = getCurrentSkinColors();
  const poseKey = rs.bunnyPose === BunnyPose.JUMPING ? 'bunny_jump'
    : rs.bunnyPose === BunnyPose.FALLING ? 'bunny_fall'
    : 'bunny_idle';
  const useSprite = assetManager.isReady() && assetManager.has('bunny_idle');
  const bunnySprite = useSprite ? (assetManager.get(poseKey) ?? assetManager.get('bunny_idle')) : null;

  if (bunnySprite) {
    ctx.save();
    ctx.translate(x, screenY);
    const lean = clamp(rs.velX * 0.05, -0.3, 0.3);
    ctx.rotate(lean);
    let scaleX = 1.0, scaleY = 1.0;
    if (rs.bunnyPose === BunnyPose.JUMPING) { scaleX = 0.92; scaleY = 1.10; }
    else if (rs.bunnyPose === BunnyPose.FALLING) { scaleX = 1.10; scaleY = 0.92; }
    ctx.scale(scaleX, scaleY);
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.ellipse(2, BUNNY_RADIUS + 6, BUNNY_RADIUS * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    const drawSize = BUNNY_RADIUS * 2.4;
    const dispW = drawSize;
    const dispH = drawSize * (bunnySprite.height / bunnySprite.width);
    ctx.drawImage(bunnySprite, -dispW / 2, -dispH / 2 - 2, dispW, dispH);
    ctx.restore();
    return;
  }

  // Vector fallback — full bunny rendering
  renderBunnyVector(ctx, x, screenY, rs, skinColors);
}

function renderBunnyVector(ctx: CanvasRenderingContext2D, x: number, screenY: number, rs: RenderState, sc: SkinColors): void {
  // (This is the full vector bunny rendering code from game.ts lines 1237-1448,
  //  moved here exactly as-is. See game.ts renderBunny3D vector fallback section.)
  // The full implementation is preserved — this comment represents
  // the complete vector bunny code which is too long to duplicate in the plan.
  // During implementation, copy lines 1237-1448 from game.ts verbatim.
}

export function renderParticles(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  for (const p of rs.particles) {
    const sy = rs.worldToScreen(p.y);
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    const sprite = getParticleSprite(p.color, p.radius);
    const size = sprite.width;
    ctx.drawImage(sprite, p.x - size / 2, sy - size / 2);
  }
  ctx.globalAlpha = 1;
}

export function renderHUD(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  const heightMm = Math.floor(rs.heightReached);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const hudW = 170, hudH = 65, hudX = 10, hudY = 10, r = 10;
  ctx.beginPath();
  ctx.moveTo(hudX + r, hudY);
  ctx.lineTo(hudX + hudW - r, hudY);
  ctx.quadraticCurveTo(hudX + hudW, hudY, hudX + hudW, hudY + r);
  ctx.lineTo(hudX + hudW, hudY + hudH - r);
  ctx.quadraticCurveTo(hudX + hudW, hudY + hudH, hudX + hudW - r, hudY + hudH);
  ctx.lineTo(hudX + r, hudY + hudH);
  ctx.quadraticCurveTo(hudX, hudY + hudH, hudX, hudY + hudH - r);
  ctx.lineTo(hudX, hudY + r);
  ctx.quadraticCurveTo(hudX, hudY, hudX + r, hudY);
  ctx.closePath();
  ctx.fill();

  ctx.save();
  const scoreTextX = 20, scoreTextY = 36;
  const bounce = rs.scoreBounce;
  ctx.translate(scoreTextX, scoreTextY);
  ctx.scale(bounce, bounce);
  ctx.translate(-scoreTextX, -scoreTextY);
  ctx.fillStyle = rs.scoreColor;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`Score: ${rs.score}`, scoreTextX, scoreTextY);
  ctx.restore();

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#CCC';
  ctx.fillText(`Height: ${heightMm}mm`, 20, 58);

  for (const p of rs.scorePopups) {
    const sy = rs.worldToScreen(p.y);
    const alpha = p.life / p.maxLife;
    const popScale = 0.5 + (p.life / p.maxLife) * (p.scale - 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, sy);
    ctx.scale(popScale, popScale);
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
}

export function renderStartScreen(ctx: CanvasRenderingContext2D, w: number, h: number, bestScore: number, bestHeight: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.fillText('\uBB34\uD55C\uC758\uB2F9\uADFC', w / 2, h / 3);
  ctx.shadowBlur = 0;
  ctx.font = '20px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Tap to Start', w / 2, h / 3 + 50);
  if (bestScore > 0) {
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`BEST: ${bestScore} pts / ${bestHeight}mm`, w / 2, h / 3 + 90);
  }
}
```

Note: `renderBunnyVector` contains the full vector bunny code (game.ts lines 1237-1448). During implementation, copy it verbatim from the existing code.

- [ ] **Step 2: Replace rendering calls in game.ts**

In `src/game.ts`:

1. Add import: `import { renderClouds, renderGround, renderCarrots, renderBunny, renderParticles, renderHUD, renderStartScreen, type RenderState } from './renderer';`
2. Add a method to create `RenderState`:

```typescript
private getRenderState(): RenderState {
  const self = this;
  return {
    w: this.w, h: this.h,
    bunnyX: this.bunnyX, bunnyY: this.bunnyY,
    velX: this.velX, velY: this.velY,
    cameraY: this.cameraY,
    score: this.score, bestScore: this.bestScore, bestHeight: this.bestHeight,
    heightReached: this.heightReached,
    bunnyPose: this.bunnyPose, earBounce: this.earBounce, animTime: this.animTime,
    scoreBounce: this.scoreBounce, scoreColor: this.scoreColor,
    carrots: this.carrots, particles: this.particles, clouds: this.clouds,
    scorePopups: this.scorePopups,
    worldToScreen: (y: number) => self.worldToScreen(y),
    perspectiveScale: (y: number) => self.perspectiveScale(y),
  };
}
```

3. Replace the `render()` method body to use the new functions:

```typescript
private render(): void {
  const ctx = this.ctx;
  const shakeX = this.shakeTimer > 0 ? rand(-3, 3) : 0;
  const shakeY = this.shakeTimer > 0 ? rand(-3, 3) : 0;
  ctx.save();
  ctx.translate(shakeX, shakeY);

  this.renderBackground(ctx);
  const rs = this.getRenderState();
  renderClouds(ctx, rs);

  if (this.state === GameState.PLAYING) {
    renderGround(ctx, rs, this.groundY);
    renderCarrots(ctx, rs);
    renderBunny(ctx, rs, this.bunnyX, this.h / 2);
    renderParticles(ctx, rs);
    renderHUD(ctx, rs);
  } else if (this.state === GameState.START) {
    renderGround(ctx, rs, this.groundY);
    renderCarrots(ctx, rs);
    renderBunny(ctx, rs, this.w / 2, this.worldToScreen(this.groundY - BUNNY_RADIUS - 10));
    renderStartScreen(ctx, this.w, this.h, this.bestScore, this.bestHeight);
  } else if (this.state === GameState.GAME_OVER) {
    renderGround(ctx, rs, this.groundY);
    renderCarrots(ctx, rs);
    renderBunny(ctx, rs, this.bunnyX, this.worldToScreen(this.bunnyY));
    this.renderGameOverScreen(ctx);
    renderShopButton(ctx, this.w, this.h);
  }

  if (isShopOpen()) { renderShop(ctx, this.w, this.h); }
  renderAchievementPopup(ctx, this.w, this.h);
  ctx.restore();
}
```

4. Delete the old rendering methods from game.ts: `renderClouds3D`, `renderGround3D`, `renderCarrots3D`, `renderBunny3D`, `drawCarrot3D`, `drawEar3D`, `renderParticles`, `renderHUD`, `renderStartScreen`
5. Delete the cache functions (`particleCache`, `getParticleSprite`, `cloudSpriteCache`, `getCloudSprite`) from game.ts (now in renderer.ts)
6. Keep: `renderGameOverScreen`, `handleReviveTap`, `handleShopButtonTap`, `handleTabTap` (these use Game-internal state)

- [ ] **Step 3: Build and verify**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/renderer.ts src/game.ts
git commit -m "refactor: 렌더링 모듈 분리 (renderer.ts)"
```

---

## Phase 3: Asset Pipeline (Already done in Task 5)

Asset keys and background system were added in Task 5. The `public/assets/backgrounds/` directory needs to be created for Phase 4.

### Task 8: Create Asset Directories

**Files:**
- Create: `public/assets/backgrounds/.gitkeep`
- Create: `public/assets/tiles/deco/.gitkeep`

- [ ] **Step 1: Create directories with gitkeep**

```bash
mkdir -p public/assets/backgrounds public/assets/tiles/deco
touch public/assets/backgrounds/.gitkeep public/assets/tiles/deco/.gitkeep
```

- [ ] **Step 2: Commit**

```bash
git add public/assets/backgrounds/.gitkeep public/assets/tiles/deco/.gitkeep
git commit -m "chore: 배경/장식 에셋 디렉터리 생성"
```

---

## Phase 4: AI Asset Generation & Integration

### Task 9: Generate and Place AI Assets

This task is done manually by the user with AI image generation tools. The plan provides the prompt guidelines and file placement.

**Files:**
- Place images in `public/assets/` subdirectories

- [ ] **Step 1: Generate background images (5)**

Generate 5 sky backgrounds at 1080x1920 WebP:

| File | Prompt keywords |
|------|----------------|
| `public/assets/backgrounds/sky_day.webp` | "blue sky, fluffy clouds, bright daylight, soft gradient, game background, vertical mobile, 1080x1920" |
| `public/assets/backgrounds/sky_sunset.webp` | "sunset sky, orange purple gradient, dramatic clouds, game background, vertical mobile, 1080x1920" |
| `public/assets/backgrounds/sky_night.webp` | "night sky, stars, aurora borealis, green cyan nebula, deep blue, game background, vertical mobile, 1080x1920" |
| `public/assets/backgrounds/sky_dawn.webp` | "dawn sky, pink orange horizon, fading stars, game background, vertical mobile, 1080x1920" |
| `public/assets/backgrounds/sky_space.webp` | "deep space, nebula, bright stars, purple blue cosmos, game background, vertical mobile, 1080x1920" |

- [ ] **Step 2: Generate bunny sprites (3)**

Generate 3 poses at 128x128 transparent WebP:

Common prompt: "3D rendered cute chibi bunny, white fur, round body, big eyes, transparent background, game sprite, soft lighting"

| File | Additional keywords |
|------|-------------------|
| `public/assets/sprites/bunny_idle.webp` | "sitting, relaxed pose, front view" |
| `public/assets/sprites/bunny_jump.webp` | "jumping upward, stretched body, excited" |
| `public/assets/sprites/bunny_fall.webp` | "falling, spread limbs, surprised face" |

- [ ] **Step 3: Generate carrot sprites (2)**

| File | Prompt |
|------|--------|
| `public/assets/items/carrot_normal.webp` | "3D rendered carrot, orange with green leaves, game item, transparent background, 64x64" |
| `public/assets/items/carrot_special.webp` | "3D rendered golden carrot, glowing gold, sparkles, green leaves, game item, transparent background, 64x64" |

- [ ] **Step 4: Generate ground tiles**

| File | Prompt |
|------|--------|
| `public/assets/tiles/ground.webp` | "isometric stone block tile, moss covered, seamless texture, game tile, 128x128" |
| `public/assets/tiles/grass.webp` | "grass border strip, green with small flowers, seamless horizontal, game tile, transparent background, 256x32" |

- [ ] **Step 5: Generate decoration and effect sprites**

| File | Prompt |
|------|--------|
| `public/assets/tiles/deco/mushroom.webp` | "small red mushroom, 3D rendered, cute, transparent background, 32x32" |
| `public/assets/tiles/deco/grass_tuft.webp` | "small grass tuft, 3D rendered, transparent background, 32x32" |
| `public/assets/tiles/deco/vine.webp` | "small vine with leaf, 3D rendered, transparent background, 32x32" |
| `public/assets/effects/cloud_2.webp` | "fluffy cloud, 3D rendered, white, transparent background, 256x96" |
| `public/assets/effects/cloud_3.webp` | "thin wispy cloud, 3D rendered, transparent background, 256x96" |
| `public/assets/effects/particle_orange.webp` | "orange glow circle, soft edges, transparent background, 32x32" |
| `public/assets/effects/particle_gold.webp` | "golden sparkle glow, transparent background, 32x32" |

- [ ] **Step 6: Verify all assets load**

Run: `npm run dev`
Open browser, check console for any asset loading errors. All sprites should render in-game.

- [ ] **Step 7: Commit**

```bash
git add public/assets/
git commit -m "feat: AI 생성 스프라이트 에셋 추가 (배경/캐릭터/아이템/효과)"
```

---

### Task 10: Final Build Verification

- [ ] **Step 1: Clean build**

```bash
rm -rf dist
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Dev server test**

```bash
npm run dev
```

Verify in browser:
- Game starts without lag
- Background transitions work (height zones + day/night)
- All sprites render correctly
- Vector fallback works when assets are missing (delete one asset and verify)
- Score popups, particles, clouds all render smoothly

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: 그래픽 업그레이드 완료 — 성능 최적화 + AI 스프라이트"
```
