import { GameState, CarrotType, BunnyPose, type Carrot, type Particle, type Cloud, type ScorePopup } from './types';

const GRAVITY = 0.6;
const JUMP_VELOCITY = -15;
const MAX_FALL_SPEED = 12;
const BUNNY_RADIUS = 18;
const CARROT_RADIUS = 14;
const CARROT_HIT_RADIUS = 22;
const DAY_CYCLE_MS = 120_000;
const CAMERA_LERP = 0.08;
const CARROT_FALL_SPEED = 0.4;
const MAX_CARROT_BELOW = 2000;
const NORMAL_JUMP_PEAK = JUMP_VELOCITY ** 2 / (2 * GRAVITY); // ~187.5
const GOLDEN_JUMP_PEAK = (JUMP_VELOCITY * 2) ** 2 / (2 * GRAVITY); // ~750
const PRELOAD_HEIGHT_MULTIPLIER = 3;

interface HeightZone {
  minGap: number;
  maxGap: number;
  specialChance: number;
}

function getZone(height: number): HeightZone {
  if (height < 500) return { minGap: 30, maxGap: 50, specialChance: 0.15 };
  if (height < 1000) return { minGap: 40, maxGap: 60, specialChance: 0.15 };
  if (height < 1500) return { minGap: 50, maxGap: 80, specialChance: 0.17 };
  if (height < 3000) return { minGap: 80, maxGap: 120, specialChance: 0.19 };
  if (height < 5000) return { minGap: 120, maxGap: 180, specialChance: 0.21 };
  if (height < 8000) return { minGap: 180, maxGap: 250, specialChance: 0.23 };
  return { minGap: 250, maxGap: 350, specialChance: 0.25 };
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  private state: GameState = GameState.START;
  private bunnyX = 0;
  private bunnyY = 0;
  private velX = 0;
  private velY = 0;
  private cameraY = 0;
  private targetCameraY = 0;
  private score = 0;
  private bestScore = 0;
  private bestHeight = 0;
  private heightReached = 0;
  private groundY = 0;
  private startTime = 0;

  private carrots: Carrot[] = [];
  private particles: Particle[] = [];
  private clouds: Cloud[] = [];
  private shakeTimer = 0;
  private bunnyPose: BunnyPose = BunnyPose.IDLE;
  private earBounce = 0;
  private animTime = 0;

  private touching = false;
  private touchX = 0;
  private hasJumped = false;
  private goldenBuffActive = false;
  private poolTopY = 0;
  private scorePopups: ScorePopup[] = [];
  private scoreBounce = 0;
  private scoreColor = '#FFF';

  private audioCtx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private bgmStarted = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not supported');
    this.ctx = ctx;
    this.loadBest();
    this.setupEvents();
  }

  private resizeTimer = 0;

  start(): void {
    this.resize();
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.resize(), 100);
    });
    this.resetGame();
    requestAnimationFrame((t) => this.loop(t));
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.groundY = this.h * 10;
  }

  private resetGame(): void {
    this.bunnyX = this.w / 2;
    this.bunnyY = this.groundY - BUNNY_RADIUS - 10;
    this.velX = 0;
    this.velY = 0;
    this.cameraY = this.bunnyY;
    this.targetCameraY = this.bunnyY;
    this.score = 0;
    this.heightReached = 0;
    this.hasJumped = false;
    this.goldenBuffActive = false;
    this.touching = false;
    this.touchX = this.w / 2;
    this.shakeTimer = 0;
    this.bunnyPose = BunnyPose.IDLE;
    this.earBounce = 0;
    this.animTime = 0;
    this.particles = [];
    this.scorePopups = [];
    this.scoreBounce = 1.0;
    this.scoreColor = '#FFF';
    this.poolTopY = 0;
    this.lastTime = performance.now();
    this.generateInitialCarrotPool();
    this.generateClouds();
    this.startTime = performance.now();
  }

  private loadBest(): void {
    this.bestScore = parseInt(localStorage.getItem('bh_bestScore') || '0', 10);
    this.bestHeight = parseInt(localStorage.getItem('bh_bestHeight') || '0', 10);
  }

  private saveBest(): void {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('bh_bestScore', String(this.bestScore));
    }
    const hMm = Math.floor(this.heightReached);
    if (hMm > this.bestHeight) {
      this.bestHeight = hMm;
      localStorage.setItem('bh_bestHeight', String(this.bestHeight));
    }
  }

  private generateClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 40; i++) {
      this.clouds.push({
        x: rand(0, this.w),
        y: rand(0, this.groundY),
        z: rand(0.3, 1.0),
        width: rand(60, 160),
        speed: rand(0.1, 0.5),
        opacity: rand(0.15, 0.4),
      });
    }
  }

  private generateInitialCarrotPool(): void {
    this.carrots = [];
    this.poolTopY = this.groundY - 80;
    const targetTopY = this.groundY - (this.h * PRELOAD_HEIGHT_MULTIPLIER);
    this.fillPoolTo(targetTopY, this.w / 2);
  }

  /** Extend the carrot pool upward as bunny climbs */
  private extendCarrotPool(): void {
    const targetTopY = this.bunnyY - (this.h * PRELOAD_HEIGHT_MULTIPLIER);
    if (this.poolTopY <= targetTopY) return;

    // Find the highest non-eaten carrot's X for continuity
    let lastX = this.bunnyX;
    let highestY = Infinity;
    for (const c of this.carrots) {
      if (!c.eaten && c.y < highestY) {
        highestY = c.y;
        lastX = c.x;
      }
    }

    this.fillPoolTo(targetTopY, lastX);
  }

  /** Fill carrots from current poolTopY upward to targetTopY */
  private fillPoolTo(targetTopY: number, startX: number): void {
    const margin = CARROT_RADIUS + 20;
    const maxJumpReachX = this.w * 0.6;
    // Safe gap bounds: always within normal jump reach (40%~90% of peak)
    const safeMaxGap = NORMAL_JUMP_PEAK * 0.9;
    const safeMinGap = NORMAL_JUMP_PEAK * 0.4;
    let prevX = startX;

    while (this.poolTopY > targetTopY) {
      const height = this.groundY - this.poolTopY;
      const zone = getZone(height);

      // Clamp zone gaps to safe bounds so bunny can always reach the next carrot
      const minGap = Math.min(zone.minGap, safeMinGap);
      const maxGap = Math.min(zone.maxGap, safeMaxGap);
      const gap = rand(minGap, maxGap);

      this.poolTopY -= gap;

      const type: CarrotType = Math.random() < zone.specialChance
        ? CarrotType.SPECIAL
        : CarrotType.NORMAL;

      // Place within reachable X range of previous carrot
      const minX = Math.max(margin, prevX - maxJumpReachX);
      const maxX = Math.min(this.w - margin, prevX + maxJumpReachX);
      const x = rand(minX, maxX);

      this.carrots.push({
        x, y: this.poolTopY,
        vy: CARROT_FALL_SPEED,
        type, eaten: false,
        radius: CARROT_RADIUS,
      });
      prevX = x;
    }
  }

  private initAudio(): void {
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

  private startBGM(): void {
    if (!this.audioCtx || !this.bgmGain) return;
    // Stop any previous loop before starting fresh
    this.bgmStarted = false;
    setTimeout(() => {
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

    // Cute waltz melody (3/4 time) using pentatonic-friendly notes
    const melody: [number, number][] = [
      // [frequency Hz, duration in beats]
      [523, 1], [587, 0.5], [659, 0.5], [784, 1], [659, 1],
      [587, 1], [523, 0.5], [440, 0.5], [523, 1], [587, 1],
      [659, 1], [784, 0.5], [880, 0.5], [784, 1], [659, 1],
      [523, 1], [587, 0.5], [523, 0.5], [440, 1], [523, 1],
    ];

    // Bass waltz pattern (oom-pah-pah)
    const bassNotes: [number, number][] = [
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
    ];

    const startTime = ctx.currentTime + 0.05;

    // Melody voice (triangle wave for soft piano-like tone)
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

    // Bass voice (sine wave, lower volume)
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

    // Schedule next loop iteration
    const nextStart = startTime + loopDuration;
    const scheduleAhead = loopDuration * 1000 - 200;
    setTimeout(() => {
      if (this.bgmStarted) this.scheduleBGMLoop();
    }, Math.max(scheduleAhead, 100));
  }

  private stopBGM(): void {
    this.bgmStarted = false;
  }

  private playCarrotSound(): void {
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

    // Add a noise burst for crunch texture
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

  private playGoldenCarrotSound(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    // Fanfare arpeggio: C5 -> E5 -> G5 -> C6
    const notes = [523, 659, 784, 1047];
    const noteDur = 0.12;

    for (let i = 0; i < notes.length; i++) {
      const noteTime = t + i * noteDur;

      // Main tone (triangle for warmth)
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

      // Harmony layer (sine, octave up, quieter)
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

    // Shimmer effect (noise sweep at the end)
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

  private setupEvents(): void {
    const c = this.canvas;

    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.initAudio();
      const t = e.touches[0];
      this.touchX = t.clientX;
      if (this.state === GameState.START) {
        this.state = GameState.PLAYING;
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.touching = true;
        this.startTime = performance.now();
        this.startBGM();
        return;
      }
      if (this.state === GameState.GAME_OVER) {
        this.resetGame();
        this.state = GameState.START;
        return;
      }
      this.touching = true;
    });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.touching || this.state !== GameState.PLAYING) return;
      this.touchX = e.touches[0].clientX;
    });

    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.touching = false;
    });

    c.addEventListener('mousedown', (e) => {
      this.initAudio();
      this.touchX = e.clientX;
      if (this.state === GameState.START) {
        this.state = GameState.PLAYING;
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.touching = true;
        this.startTime = performance.now();
        this.startBGM();
        return;
      }
      if (this.state === GameState.GAME_OVER) {
        this.resetGame();
        this.state = GameState.START;
        return;
      }
      this.touching = true;
    });

    c.addEventListener('mousemove', (e) => {
      if (!this.touching || this.state !== GameState.PLAYING) return;
      this.touchX = e.clientX;
    });

    c.addEventListener('mouseup', () => { this.touching = false; });
  }

  private update(): void {
    if (this.state !== GameState.PLAYING) return;

    this.animTime += 0.05;

    // 추락 중 중력 조절
    if (this.velY > 0) {
      const hasCarrotBelow = this.carrots.some(c =>
        !c.eaten &&
        c.y > this.bunnyY &&
        c.y - this.bunnyY <= MAX_CARROT_BELOW
      );

      if (hasCarrotBelow) {
        // 아직 당근이 아래에 있음 - 원래 속도로 추락
        this.velY = Math.min(this.velY + GRAVITY, MAX_FALL_SPEED);
      } else {
        // 당근이 정말로 없음 - 높이에 비례하여 급속 낙하
        const fallDist = this.groundY - this.bunnyY;
        if (fallDist > 3000) {
          // 높은 곳에서 당근 없이 추락 → 즉시 게임 오버
          this.bunnyY = this.groundY - BUNNY_RADIUS;
          this.hasJumped = false;
          this.gameOver();
          return;
        }
        this.velY = Math.min(this.velY + GRAVITY * 6, MAX_FALL_SPEED * 4);
      }
    } else {
      // 상승 중
      this.velY = Math.min(this.velY + GRAVITY, MAX_FALL_SPEED);
    }
    this.bunnyY += this.velY;

    if (this.touching) {
      const targetX = clamp(this.touchX, BUNNY_RADIUS, this.w - BUNNY_RADIUS);
      this.bunnyX += (targetX - this.bunnyX) * 0.15;
      this.velX = (targetX - this.bunnyX) * 0.15;
    } else {
      this.velX *= 0.85;
      this.bunnyX += this.velX;
    }
    this.bunnyX = clamp(this.bunnyX, BUNNY_RADIUS, this.w - BUNNY_RADIUS);

    if (this.velY < -2) {
      this.bunnyPose = BunnyPose.JUMPING;
      this.earBounce = Math.sin(this.animTime * 8) * 0.3;
    } else if (this.velY > 2) {
      this.bunnyPose = BunnyPose.FALLING;
      this.earBounce = Math.sin(this.animTime * 4) * 0.15;
    } else {
      this.bunnyPose = BunnyPose.IDLE;
      this.earBounce = Math.sin(this.animTime * 2) * 0.05;
    }

    this.targetCameraY = this.bunnyY;
    this.cameraY += (this.targetCameraY - this.cameraY) * CAMERA_LERP;

    this.heightReached = Math.max(this.heightReached, this.groundY - this.bunnyY);

    if (this.hasJumped && this.bunnyY >= this.groundY - BUNNY_RADIUS) {
      this.bunnyY = this.groundY - BUNNY_RADIUS;
      this.hasJumped = false;
      this.gameOver();
      return;
    }

    const maxFallY = this.bunnyY + MAX_CARROT_BELOW;

    for (const c of this.carrots) {
      if (c.eaten) continue;
      c.y += c.vy;
      if (c.y > maxFallY) {
        c.eaten = true;
      }
    }

    this.carrots = this.carrots.filter(c => !c.eaten);

    // Extend carrot pool upward as bunny climbs
    this.extendCarrotPool();

    for (const c of this.carrots) {
      if (c.eaten) continue;
      // Only collide when bunny is falling (velY > 0) and approaching from above
      if (this.velY <= 0) continue;
      if (this.bunnyY > c.y + CARROT_HIT_RADIUS) continue;
      const dx = this.bunnyX - c.x;
      const dy = this.bunnyY - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BUNNY_RADIUS + CARROT_HIT_RADIUS) {
        c.eaten = true;
        this.onCarrotEaten(c);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // Update score bounce animation (decay toward 1.0)
    if (this.scoreBounce > 1.0) {
      this.scoreBounce += (1.0 - this.scoreBounce) * 0.12;
      if (this.scoreBounce < 1.02) this.scoreBounce = 1.0;
    }

    // Update score popups
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const p = this.scorePopups[i];
      p.y -= 1.2;
      p.life--;
      if (p.life <= 0) {
        this.scorePopups.splice(i, 1);
      }
    }

    if (this.shakeTimer > 0) this.shakeTimer--;

    for (const cl of this.clouds) {
      cl.x += cl.speed * cl.z;
      if (cl.x > this.w + cl.width) cl.x = -cl.width;
    }
  }

  private onCarrotEaten(c: Carrot): void {
    if (c.type === CarrotType.NORMAL) {
      if (this.goldenBuffActive) {
        this.velY = JUMP_VELOCITY * 1.5;
        this.goldenBuffActive = false;
      } else {
        this.velY = JUMP_VELOCITY;
      }
      this.score += 1;
      this.scoreBounce = 1.5;
      this.scoreColor = '#FFF';
      this.spawnParticles(c.x, c.y, '#FF6B35', 8);
      this.scorePopups.push({
        text: '+1', x: c.x, y: c.y,
        life: 40, maxLife: 40, scale: 1.5, color: '#FF6B35',
      });
      this.playCarrotSound();
    } else if (c.type === CarrotType.SPECIAL) {
      this.velY = JUMP_VELOCITY * 2;
      this.score += 2;
      this.goldenBuffActive = true;
      this.scoreBounce = 2.0;
      this.scoreColor = '#FFD700';
      this.shakeTimer = 6;
      this.spawnParticles(c.x, c.y, '#FFD700', 14);
      this.scorePopups.push({
        text: '+2 GOLD', x: c.x, y: c.y,
        life: 50, maxLife: 50, scale: 2.0, color: '#FFD700',
      });
      this.playGoldenCarrotSound();
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: rand(-4, 4),
        vy: rand(-5, 1),
        life: 35,
        maxLife: 35,
        color,
        radius: rand(2, 6),
      });
    }
  }

  private gameOver(): void {
    this.state = GameState.GAME_OVER;
    this.saveBest();
    this.stopBGM();
  }

  private worldToScreen(worldY: number): number {
    return worldY - this.cameraY + this.h / 2;
  }

  private perspectiveScale(worldY: number): number {
    const distFromBunny = Math.abs(worldY - this.bunnyY);
    return clamp(1.0 - distFromBunny * 0.00008, 0.7, 1.0);
  }

  private lastTime = 0;
  private loop(time: number): void {
    if (this.lastTime === 0) this.lastTime = time;
    const dt = time - this.lastTime;
    this.lastTime = time;

    if (dt < 100) {
      this.update();
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private render(): void {
    const ctx = this.ctx;
    const shakeX = this.shakeTimer > 0 ? rand(-3, 3) : 0;
    const shakeY = this.shakeTimer > 0 ? rand(-3, 3) : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.renderBackground(ctx);
    this.renderClouds3D(ctx);

    if (this.state === GameState.PLAYING) {
      this.renderGround3D(ctx);
      this.renderCarrots3D(ctx);
      this.renderBunny3D(ctx, this.bunnyX, this.h / 2);
      this.renderParticles(ctx);
      this.renderHUD(ctx);
    } else if (this.state === GameState.START) {
      this.renderGround3D(ctx);
      this.renderCarrots3D(ctx);
      this.renderBunny3D(ctx, this.w / 2, this.worldToScreen(this.groundY - BUNNY_RADIUS - 10));
      this.renderStartScreen(ctx);
    } else if (this.state === GameState.GAME_OVER) {
      this.renderGround3D(ctx);
      this.renderCarrots3D(ctx);
      this.renderBunny3D(ctx, this.bunnyX, this.worldToScreen(this.bunnyY));
      this.renderGameOverScreen(ctx);
    }

    ctx.restore();
  }

  private getSkyColors(): [string, string] {
    const elapsed = this.state === GameState.PLAYING
      ? (performance.now() - this.startTime)
      : 0;
    const cycle = (elapsed % DAY_CYCLE_MS) / DAY_CYCLE_MS;

    if (cycle < 0.25) {
      const t = cycle / 0.25;
      return [lerpColor('#87CEEB', '#FF8C42', t), lerpColor('#E0F0FF', '#FFB366', t)];
    } else if (cycle < 0.5) {
      const t = (cycle - 0.25) / 0.25;
      return [lerpColor('#FF8C42', '#1a1a3e', t), lerpColor('#FFB366', '#2d2d6b', t)];
    } else if (cycle < 0.75) {
      const t = (cycle - 0.5) / 0.25;
      return [lerpColor('#1a1a3e', '#2d4a7a', t), lerpColor('#2d2d6b', '#87CEEB', t)];
    } else {
      const t = (cycle - 0.75) / 0.25;
      return [lerpColor('#2d4a7a', '#87CEEB', t), lerpColor('#87CEEB', '#E0F0FF', t)];
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    const [top, bottom] = this.getSkyColors();
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private renderClouds3D(ctx: CanvasRenderingContext2D): void {
    for (const cl of this.clouds) {
      const screenY = this.worldToScreen(cl.y) * cl.z + (1 - cl.z) * this.h * 0.3;
      if (screenY < -200 || screenY > this.h + 200) continue;

      const scale = 0.5 + cl.z * 0.5;
      const cw = cl.width * scale;
      const ch = cw * 0.35;

      ctx.save();
      ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);

      const grd = ctx.createRadialGradient(cl.x, screenY, 0, cl.x, screenY, cw / 2);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(0.6, 'rgba(255,255,255,0.4)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd;

      ctx.beginPath();
      ctx.ellipse(cl.x, screenY, cw / 2, ch / 2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.ellipse(cl.x - cw * 0.22, screenY + ch * 0.15, cw * 0.3, ch * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cl.x + cw * 0.22, screenY + ch * 0.15, cw * 0.3, ch * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = cl.opacity * 0.15 * cl.z;
      ctx.fillStyle = '#8899aa';
      ctx.beginPath();
      ctx.ellipse(cl.x, screenY + ch * 0.4, cw * 0.4, ch * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  private renderGround3D(ctx: CanvasRenderingContext2D): void {
    const gy = this.worldToScreen(this.groundY);
    if (gy > this.h + 200) return;

    const blockH = 20;
    const rows = 8;

    for (let i = 0; i < rows; i++) {
      const rowY = gy + i * blockH;
      if (rowY > this.h + blockH) break;

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
      ctx.fillRect(0, rowY, this.w, blockH + 1);

      if (i === 0) {
        const grassGrad = ctx.createLinearGradient(0, rowY - 6, 0, rowY + 4);
        grassGrad.addColorStop(0, '#8ED860');
        grassGrad.addColorStop(1, '#5A9A32');
        ctx.fillStyle = grassGrad;
        ctx.fillRect(0, rowY - 3, this.w, 7);
      }

      ctx.strokeStyle = `rgba(0,0,0,${0.05 + depth * 0.08})`;
      ctx.lineWidth = 1;
      const blockW = 40 + i * 5;
      const offset = (i % 2) * blockW * 0.5;
      for (let bx = -blockW + offset; bx < this.w + blockW; bx += blockW) {
        ctx.strokeRect(bx, rowY, blockW, blockH);
      }
    }

    ctx.fillStyle = `rgb(${126 - 40},${200 - 50},${80 - 30})`;
    ctx.fillRect(0, gy + rows * blockH, this.w, this.h);
  }

  private renderCarrots3D(ctx: CanvasRenderingContext2D): void {
    for (const c of this.carrots) {
      if (c.eaten) continue;
      const sy = this.worldToScreen(c.y);
      if (sy < -60 || sy > this.h + 60) continue;

      const scale = this.perspectiveScale(c.y);

      if (c.type === CarrotType.NORMAL) {
        this.drawCarrot3D(ctx, c.x, sy, scale, '#FF6B35', '#E85520', '#4CAF50', '#388E3C', false);
      } else if (c.type === CarrotType.SPECIAL) {
        this.drawCarrot3D(ctx, c.x, sy, scale, '#FFD700', '#E6B800', '#90EE90', '#5CBF5C', true);
      }
    }
  }

  private drawCarrot3D(
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

  private renderBunny3D(ctx: CanvasRenderingContext2D, x: number, screenY: number): void {
    ctx.save();
    ctx.translate(x, screenY);

    const lean = clamp(this.velX * 0.05, -0.3, 0.3);
    ctx.rotate(lean);

    // Squash & stretch based on pose
    let scaleX = 1.0;
    let scaleY = 1.0;
    if (this.bunnyPose === BunnyPose.JUMPING) {
      scaleX = 0.82;
      scaleY = 1.25;
    } else if (this.bunnyPose === BunnyPose.FALLING) {
      scaleX = 1.18;
      scaleY = 0.82;
    }
    ctx.scale(scaleX, scaleY);

    const R = BUNNY_RADIUS;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.ellipse(2, R + 6, R * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tail (fluffy pom-pom, drawn behind body)
    const tailBob = Math.sin(this.animTime * 3) * 2;
    ctx.save();
    ctx.translate(0, R - 1 + tailBob);
    const tailGrad = ctx.createRadialGradient(-1, -1, 1, 0, 0, 7);
    tailGrad.addColorStop(0, '#FFFFFF');
    tailGrad.addColorStop(0.6, '#F5F0F0');
    tailGrad.addColorStop(1, '#E8E0E0');
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    // Tail highlight
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(-2, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Body (egg-shaped — taller ellipse)
    const bodyGrad = ctx.createRadialGradient(-3, -5, 3, 0, 2, R + 2);
    bodyGrad.addColorStop(0, '#FFFFFF');
    bodyGrad.addColorStop(0.5, '#F5F2F0');
    bodyGrad.addColorStop(0.8, '#E8E4E0');
    bodyGrad.addColorStop(1, '#D5D0CC');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, R - 1, R + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly patch (lighter oval)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 5, R * 0.55, R * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body highlight (specular)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(-5, -7, 7, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Head (egg-shaped, slightly above body)
    const headY = -R + 2;
    const headGrad = ctx.createRadialGradient(-2, headY - 3, 2, 0, headY, R * 0.8);
    headGrad.addColorStop(0, '#FFFFFF');
    headGrad.addColorStop(0.7, '#F0EDEB');
    headGrad.addColorStop(1, '#DDD8D5');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, headY, R * 0.75, R * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cheeks (soft pink circles)
    ctx.fillStyle = 'rgba(255,180,180,0.2)';
    ctx.beginPath();
    ctx.arc(-9, headY + 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, headY + 4, 5, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    const earBaseY = headY - R * 0.55;
    this.drawEar3D(ctx, -7, earBaseY, -0.15 + this.earBounce);
    this.drawEar3D(ctx, 7, earBaseY, 0.15 - this.earBounce);

    // Eyes — larger, more expressive
    // Eye whites
    ctx.fillStyle = '#FEFEFE';
    ctx.beginPath();
    ctx.ellipse(-6, headY - 1, 4.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, headY - 1, 4.5, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupils (large, dark)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(-5.5, headY, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(5.5, headY, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // Eye highlights (two per eye for liveliness)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-6.5, headY - 1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-4.5, headY + 1, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(4.5, headY - 1.5, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(6.5, headY + 1, 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Nose (inverted triangle, pink)
    const noseY = headY + 5;
    const noseGrad = ctx.createRadialGradient(-0.5, noseY - 1, 0, 0, noseY, 3.5);
    noseGrad.addColorStop(0, '#FFB8B8');
    noseGrad.addColorStop(1, '#FF8899');
    ctx.fillStyle = noseGrad;
    ctx.beginPath();
    ctx.moveTo(-3, noseY - 1.5);
    ctx.quadraticCurveTo(0, noseY + 3, 3, noseY - 1.5);
    ctx.quadraticCurveTo(0, noseY - 3, -3, noseY - 1.5);
    ctx.fill();

    // Mouth — :3 style
    ctx.strokeStyle = '#CC8888';
    ctx.lineWidth = 1.0;
    ctx.lineCap = 'round';
    // Left curve
    ctx.beginPath();
    ctx.arc(-3, noseY + 3, 3, -Math.PI * 0.8, -Math.PI * 0.1);
    ctx.stroke();
    // Right curve
    ctx.beginPath();
    ctx.arc(3, noseY + 3, 3, -Math.PI * 0.9, -Math.PI * 0.2);
    ctx.stroke();

    // Whiskers (3 per side, varied length/angle)
    ctx.strokeStyle = 'rgba(140,130,125,0.35)';
    ctx.lineWidth = 0.7;
    // Left whiskers
    ctx.beginPath(); ctx.moveTo(-8, noseY + 1); ctx.lineTo(-20, noseY - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, noseY + 2); ctx.lineTo(-21, noseY + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-8, noseY + 3); ctx.lineTo(-19, noseY + 6); ctx.stroke();
    // Right whiskers
    ctx.beginPath(); ctx.moveTo(8, noseY + 1); ctx.lineTo(20, noseY - 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, noseY + 2); ctx.lineTo(21, noseY + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, noseY + 3); ctx.lineTo(19, noseY + 6); ctx.stroke();

    // Feet — pose-dependent
    if (this.bunnyPose === BunnyPose.JUMPING) {
      // Feet tucked up and stretched
      const footGrad = ctx.createRadialGradient(0, R + 3, 1, 0, R + 3, 6);
      footGrad.addColorStop(0, '#F0ECEC');
      footGrad.addColorStop(1, '#DDD5D5');
      ctx.fillStyle = footGrad;
      ctx.beginPath();
      ctx.ellipse(-6, R + 4, 5, 2.5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6, R + 4, 5, 2.5, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Toe pads
      ctx.fillStyle = 'rgba(255,190,190,0.3)';
      ctx.beginPath(); ctx.arc(-8, R + 3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(8, R + 3, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (this.bunnyPose === BunnyPose.FALLING) {
      // Feet spread out
      ctx.fillStyle = '#E8E4E4';
      ctx.beginPath();
      ctx.ellipse(-8, R + 2, 6, 3.5, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(8, R + 2, 6, 3.5, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,190,190,0.25)';
      ctx.beginPath(); ctx.arc(-10, R + 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(10, R + 1, 1.5, 0, Math.PI * 2); ctx.fill();
    } else {
      // Idle — rounded sitting paws
      ctx.fillStyle = '#E8E4E4';
      ctx.beginPath();
      ctx.ellipse(-7, R, 6, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(7, R, 6, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      // Toe pads
      ctx.fillStyle = 'rgba(255,190,190,0.3)';
      ctx.beginPath(); ctx.arc(-9, R - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-6, R - 2, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(9, R - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(6, R - 2, 1.2, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();
  }

  private drawEar3D(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Outer ear
    const earGrad = ctx.createLinearGradient(-6, 0, 6, 0);
    earGrad.addColorStop(0, '#E5E2E0');
    earGrad.addColorStop(0.3, '#FFFFFF');
    earGrad.addColorStop(0.7, '#FFFFFF');
    earGrad.addColorStop(1, '#D5D0CC');
    ctx.fillStyle = earGrad;
    ctx.beginPath();
    ctx.ellipse(0, -12, 6, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner ear (blood-vessel pink detail)
    const innerGrad = ctx.createLinearGradient(-3, -4, 3, -4);
    innerGrad.addColorStop(0, '#FFCCCC');
    innerGrad.addColorStop(0.3, '#FFB0B8');
    innerGrad.addColorStop(0.7, '#FFB6C1');
    innerGrad.addColorStop(1, '#FFAAAA');
    ctx.fillStyle = innerGrad;
    ctx.beginPath();
    ctx.ellipse(0, -12, 3.5, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner ear vein detail (subtle darker line)
    ctx.strokeStyle = 'rgba(220,130,140,0.25)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(-1.5, -12, 0, -22);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(1, -12, -0.5, -18);
    ctx.stroke();

    ctx.restore();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const sy = this.worldToScreen(p.y);
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;

      const grad = ctx.createRadialGradient(p.x, sy, 0, p.x, sy, p.radius);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, sy, p.radius * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const heightMm = Math.floor(this.heightReached);

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    const hudW = 170;
    const hudH = 65;
    const hudX = 10;
    const hudY = 10;
    const r = 10;
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

    // Score with bounce animation
    ctx.save();
    const scoreTextX = 20;
    const scoreTextY = 36;
    const bounce = this.scoreBounce;
    ctx.translate(scoreTextX, scoreTextY);
    ctx.scale(bounce, bounce);
    ctx.translate(-scoreTextX, -scoreTextY);
    ctx.fillStyle = this.scoreColor;
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, scoreTextX, scoreTextY);
    ctx.restore();

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#CCC';
    ctx.fillText(`Height: ${heightMm}mm`, 20, 58);

    // Score popups (floating +1, +2 GOLD text)
    for (const p of this.scorePopups) {
      const sy = this.worldToScreen(p.y);
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

  private renderStartScreen(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 8;
    ctx.fillText('BunnyHop', this.w / 2, this.h / 3);
    ctx.shadowBlur = 0;

    ctx.font = '20px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('Tap to Start', this.w / 2, this.h / 3 + 50);

    if (this.bestScore > 0) {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`BEST: ${this.bestScore} pts / ${this.bestHeight}mm`, this.w / 2, this.h / 3 + 90);
    }
  }

  private renderGameOverScreen(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText('Game Over!', this.w / 2, this.h / 3);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#FFF';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Score: ${this.score}`, this.w / 2, this.h / 3 + 50);
    ctx.fillText(`Height: ${Math.floor(this.heightReached)}mm`, this.w / 2, this.h / 3 + 80);

    ctx.fillStyle = '#FFD700';
    ctx.font = '16px sans-serif';
    ctx.fillText(`Best: ${this.bestScore} pts / ${this.bestHeight}mm`, this.w / 2, this.h / 3 + 120);

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '18px sans-serif';
    ctx.fillText('Tap to Restart', this.w / 2, this.h / 3 + 170);
  }
}
