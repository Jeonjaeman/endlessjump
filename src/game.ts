import { GameState, CarrotType, BunnyPose, type Carrot, type Particle, type Cloud, type ScorePopup, type RankEntry, type SkinColors } from './types';
import { AudioManager } from './audio';
import { initAuth, getLocalUUID } from './services/auth';
import { submitScore } from './services/score';
import { fetchRanking, invalidateCache } from './services/leaderboard';
import { renderRankingScreen, getTabHitArea, getReviveHitArea } from './ui/ranking-screen';
import { showProfileModal } from './ui/profile-modal';
import { initAds, showBanner, hideBanner, showInterstitialOnGameOver, isRewardedReady, showRewardedAd, areAdsRemoved } from './services/ad-service';
import { initIAP } from './services/iap-service';
import { initSkins, getCurrentSkinColors } from './services/skin-service';
import { initAchievements, onGameOver as achOnGameOver, onCarrotEaten as achOnCarrotEaten, popRecentlyCompleted } from './services/achievement-service';
import { isShopOpen, openShop, closeShop, handleShopTap, renderShop, renderShopButton, getShopButtonArea, renderAchievementPopup, queueAchievementPopup, clearAchievementPopups } from './ui/shop-screen';
import { assetManager } from './assets';
import { BackgroundRenderer } from './background';

const GRAVITY = 0.6;
const JUMP_VELOCITY = -15;
const MAX_FALL_SPEED = 12;
const BUNNY_RADIUS = 18;
const CARROT_RADIUS = 14;
const CARROT_HIT_RADIUS = 22;
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


function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

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

  private audio = new AudioManager();
  private bg = new BackgroundRenderer();

  // Ranking state
  private rankings: RankEntry[] = [];
  private myRank: RankEntry | null = null;
  private rankingTab: 'all' | 'weekly' = 'all';

  // Ad / Revive state
  private hasUsedRevive = false;
  private reviveAvailable = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not supported');
    this.ctx = ctx;
    this.loadBest();
    this.setupEvents();
    getLocalUUID();
    initAuth();
    initSkins();
    initAchievements();
    initIAP();
    initAds();
  }

  private resizeTimer = 0;

  start(): void {
    this.resize();
    window.addEventListener('resize', () => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => this.resize(), 100);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.audio.suspend();
      } else {
        this.audio.resume();
      }
    });
    this.resetGame();
    requestAnimationFrame((t) => this.loop(t));
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    // body safe-area padding 반영된 캔버스 실제 크기 사용
    const rect = this.canvas.getBoundingClientRect();
    this.w = rect.width;
    this.h = rect.height;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // PLAYING 상태에서는 groundY 변경하지 않기 (부활/게임 중 좌표 꼬임 방지)
    if (this.state !== GameState.PLAYING) {
      this.groundY = this.h * 10;
    }
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
    clearAchievementPopups();
    this.hasUsedRevive = false;
    this.reviveAvailable = false;
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
    // Safe gap bounds: Zone이 높을수록 허용 간격 증가 (Zone 6~7 난이도 무효화 방지)
    const safeMinGap = NORMAL_JUMP_PEAK * 0.4;
    let prevX = startX;

    while (this.poolTopY > targetTopY) {
      const height = this.groundY - this.poolTopY;
      const zone = getZone(height);

      // Zone 레벨에 따라 safeMaxGap 조정
      const zoneLevel = height < 500 ? 0 : height < 1000 ? 1 : height < 1500 ? 2
        : height < 3000 ? 3 : height < 5000 ? 4 : height < 8000 ? 5 : 6;
      const safeMaxGap = NORMAL_JUMP_PEAK * (0.75 + zoneLevel * 0.05);

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

  private setupEvents(): void {
    const c = this.canvas;

    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.audio.initAudio();
      const t = e.touches[0];
      this.touchX = t.clientX;
      // 상점 열려 있으면 상점 터치 처리
      if (isShopOpen()) {
        handleShopTap(t.clientX, t.clientY);
        return;
      }
      if (this.state === GameState.START) {
        this.state = GameState.PLAYING;
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.touching = true;
        this.startTime = performance.now();
        this.audio.startBGM();
        if (!areAdsRemoved()) showBanner();
        return;
      }
      if (this.state === GameState.GAME_OVER) {
        if (this.handleShopButtonTap(t.clientX, t.clientY)) return;
        if (this.handleTabTap(t.clientX, t.clientY)) return;
        if (this.handleReviveTap(t.clientX, t.clientY)) return;
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
      this.audio.initAudio();
      this.touchX = e.clientX;
      // 상점 열려 있으면 상점 터치 처리
      if (isShopOpen()) {
        handleShopTap(e.clientX, e.clientY);
        return;
      }
      if (this.state === GameState.START) {
        this.state = GameState.PLAYING;
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.touching = true;
        this.startTime = performance.now();
        this.audio.startBGM();
        if (!areAdsRemoved()) showBanner();
        return;
      }
      if (this.state === GameState.GAME_OVER) {
        if (this.handleShopButtonTap(e.clientX, e.clientY)) return;
        if (this.handleTabTap(e.clientX, e.clientY)) return;
        if (this.handleReviveTap(e.clientX, e.clientY)) return;
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
      const hasCarrotNearby = this.carrots.some(c =>
        !c.eaten &&
        c.y > this.bunnyY - NORMAL_JUMP_PEAK * 0.3 &&
        c.y - this.bunnyY <= MAX_CARROT_BELOW
      );

      if (hasCarrotNearby) {
        // 도달 가능한 당근이 있음 - 원래 속도로 추락
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
      const move = (targetX - this.bunnyX) * 0.15;
      this.bunnyX += move;
      this.velX = move;
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
      // 낙하 중이거나 점프 정점 근처에서만 충돌 (강하게 상승 중에는 통과)
      if (this.velY < -2) continue;
      // 토끼가 당근보다 너무 아래이면 무시
      if (this.bunnyY > c.y + CARROT_HIT_RADIUS) continue;
      const dx = this.bunnyX - c.x;
      // 충돌 판정은 토끼 발 위치(중심 + 반지름의 절반) 기준
      const feetY = this.bunnyY + BUNNY_RADIUS * 0.5;
      const dy = feetY - c.y;
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
      achOnCarrotEaten('normal');
      if (this.goldenBuffActive) {
        this.velY = JUMP_VELOCITY * 1.5;
        this.goldenBuffActive = false;
        this.score += 1;
        this.scoreBounce = 2.0;
        this.scoreColor = '#FFD700';
        this.spawnParticles(c.x, c.y, '#FF6B35', 8);
        this.spawnParticles(c.x, c.y, '#FFD700', 6);
        this.shakeTimer = 4;
        this.scorePopups.push({
          text: '+1 BUFF', x: c.x, y: c.y,
          life: 45, maxLife: 45, scale: 1.8, color: '#FFD700',
        });
      } else {
        this.velY = JUMP_VELOCITY;
        this.score += 1;
        this.scoreBounce = 1.5;
        this.scoreColor = '#FFF';
        this.spawnParticles(c.x, c.y, '#FF6B35', 8);
        this.scorePopups.push({
          text: '+1', x: c.x, y: c.y,
          life: 40, maxLife: 40, scale: 1.5, color: '#FF6B35',
        });
      }
      this.audio.playCarrotSound();
    } else if (c.type === CarrotType.SPECIAL) {
      achOnCarrotEaten('special');
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
      this.audio.playGoldenCarrotSound();
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
    this.audio.stopBGM();
    hideBanner();

    // 업적 체크
    achOnGameOver(this.score, Math.floor(this.heightReached));
    // 달성된 업적 팝업 큐
    const completed = popRecentlyCompleted();
    for (const ach of completed) {
      queueAchievementPopup(ach);
    }

    // 부활 가능 여부: 이번 게임에서 아직 부활 안 했고, (리워드 광고 준비됨 또는 광고 제거 구매자)
    this.reviveAvailable = !this.hasUsedRevive && (isRewardedReady() || areAdsRemoved());

    // 전면 광고 표시 (N회 게임 오버마다, 광고 제거 시 스킵)
    if (!areAdsRemoved()) showInterstitialOnGameOver();

    // 랭킹 UI 초기화 (이전 게임 데이터 잔상 방지)
    this.rankings = [];
    this.myRank = null;
    this.rankingTab = 'all';

    // async 클로저 전에 값 캡처 (상태 변경에 의한 경합 방지)
    const capturedScore = this.score;
    const capturedHeightMm = Math.floor(this.heightReached);

    // 점수 제출 + 랭킹 로드 먼저 실행 (스코어/랭킹 우선 표시)
    this.submitAndLoadRankings(capturedHeightMm, capturedScore).catch((e) => {
      console.warn('[Game] 점수 제출/랭킹 로드 실패:', e);
    });

    // 프로필 모달은 fire-and-forget 병렬 실행
    if (!localStorage.getItem('bh_profile_set')) {
      localStorage.setItem('bh_profile_set', '1');
      showProfileModal().catch((e) => {
        console.warn('[Game] 프로필 모달 표시 실패:', e);
      });
    }
  }

  private async submitAndLoadRankings(heightMm: number, score: number): Promise<void> {
    await submitScore({ score, height: heightMm });
    invalidateCache(); // 점수 제출 후 캐시 무효화하여 최신 랭킹 반영
    await this.loadRankings();
  }

  private async loadRankings(): Promise<void> {
    const entries = await fetchRanking(this.rankingTab);
    this.rankings = entries.filter(e => e.rank <= 10);
    this.myRank = entries.find(e => e.is_me && e.rank > 10) || null;
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
      renderShopButton(ctx, this.w, this.h);
    }

    // 상점 오버레이 (모든 상태 위에)
    if (isShopOpen()) {
      renderShop(ctx, this.w, this.h);
    }

    // 업적 달성 팝업 (최상위)
    renderAchievementPopup(ctx, this.w, this.h);

    ctx.restore();
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    const elapsed = this.state === GameState.PLAYING
      ? (performance.now() - this.startTime)
      : 0;
    this.bg.render(ctx, this.w, this.h, this.heightReached, elapsed, this.state === GameState.PLAYING);
  }

  private renderClouds3D(ctx: CanvasRenderingContext2D): void {
    const useSprite = assetManager.isReady() && assetManager.has('cloud');
    const cloudSprite = useSprite ? assetManager.get('cloud') : null;

    for (const cl of this.clouds) {
      const screenY = this.worldToScreen(cl.y) * cl.z + (1 - cl.z) * this.h * 0.3;
      if (screenY < -200 || screenY > this.h + 200) continue;

      const scale = 0.5 + cl.z * 0.5;
      const cw = cl.width * scale;
      const ch = cw * 0.35;

      // Sprite branch: 스프라이트가 있으면 사용
      if (cloudSprite) {
        ctx.save();
        ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);
        ctx.drawImage(cloudSprite, cl.x - cw / 2, screenY - ch / 2, cw, ch);
        ctx.restore();
        continue;
      }

      // Cached vector fallback
      ctx.save();
      ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);
      const cachedCloud = getCloudSprite(cw, ch);
      ctx.drawImage(cachedCloud, cl.x - cw / 2, screenY - ch / 2);
      ctx.restore();
    }
  }

  private renderGround3D(ctx: CanvasRenderingContext2D): void {
    const gy = this.worldToScreen(this.groundY);
    if (gy > this.h + 200) return;

    const useSprite = assetManager.isReady() && assetManager.has('ground');
    const groundSprite = useSprite ? assetManager.get('ground') : null;
    const grassSprite = useSprite ? assetManager.get('grass') : null;

    // Sprite branch: 지면 타일 가로 반복 + 그 아래 채우기
    if (groundSprite) {
      const tileW = groundSprite.width || 64;
      const tileH = groundSprite.height || 64;
      // 잔디 (있으면 윗 라인으로)
      if (grassSprite) {
        const grassH = grassSprite.height || 8;
        for (let bx = 0; bx < this.w; bx += grassSprite.width || 64) {
          ctx.drawImage(grassSprite, bx, gy - grassH + 2);
        }
      }
      // 지면 타일 가로 반복 + 화면 아래까지 채움
      for (let row = gy; row < this.h + tileH; row += tileH) {
        for (let bx = 0; bx < this.w; bx += tileW) {
          ctx.drawImage(groundSprite, bx, row);
        }
      }
      return;
    }

    // Vector fallback (기존 코드)
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
    const useSprite = assetManager.isReady();
    const normalSprite = useSprite ? assetManager.get('carrot_normal') : null;
    const specialSprite = useSprite ? assetManager.get('carrot_special') : null;

    for (const c of this.carrots) {
      if (c.eaten) continue;
      const sy = this.worldToScreen(c.y);
      if (sy < -60 || sy > this.h + 60) continue;

      const scale = this.perspectiveScale(c.y);

      // Sprite branch
      const sprite = c.type === CarrotType.SPECIAL ? specialSprite : normalSprite;
      if (sprite) {
        const sw = sprite.width * scale * 0.5;
        const sh = sprite.height * scale * 0.5;
        ctx.save();
        if (c.type === CarrotType.SPECIAL) {
          // 황금 당근 글로우
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

      // Vector fallback (기존 코드)
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
    const skinColors = getCurrentSkinColors();

    // Sprite branch: pose에 맞는 스프라이트 선택
    const poseKey = this.bunnyPose === BunnyPose.JUMPING ? 'bunny_jump'
      : this.bunnyPose === BunnyPose.FALLING ? 'bunny_fall'
      : 'bunny_idle';
    const useSprite = assetManager.isReady() && assetManager.has('bunny_idle');
    const bunnySprite = useSprite ? (assetManager.get(poseKey) ?? assetManager.get('bunny_idle')) : null;

    if (bunnySprite) {
      ctx.save();
      ctx.translate(x, screenY);
      const lean = clamp(this.velX * 0.05, -0.3, 0.3);
      ctx.rotate(lean);

      // Pose에 따른 squash & stretch는 스프라이트에서도 약하게 적용
      let scaleX = 1.0;
      let scaleY = 1.0;
      if (this.bunnyPose === BunnyPose.JUMPING) {
        scaleX = 0.92;
        scaleY = 1.10;
      } else if (this.bunnyPose === BunnyPose.FALLING) {
        scaleX = 1.10;
        scaleY = 0.92;
      }
      ctx.scale(scaleX, scaleY);

      // 그림자
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.beginPath();
      ctx.ellipse(2, BUNNY_RADIUS + 6, BUNNY_RADIUS * 0.9, 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // 스프라이트 그리기 — BUNNY_RADIUS=18 기준 약 64x64 표시 영역
      const drawSize = BUNNY_RADIUS * 2.4; // 약 43px (스프라이트 슈퍼샘플링 가정)
      const dispW = drawSize;
      const dispH = drawSize * (bunnySprite.height / bunnySprite.width);
      ctx.drawImage(bunnySprite, -dispW / 2, -dispH / 2 - 2, dispW, dispH);

      ctx.restore();
      return;
    }

    // Vector fallback (기존 코드)
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
    bodyGrad.addColorStop(0, skinColors.bodyLight);
    bodyGrad.addColorStop(0.5, skinColors.body);
    bodyGrad.addColorStop(0.8, skinColors.body);
    bodyGrad.addColorStop(1, skinColors.bodyDark);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 2, R - 1, R + 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly patch (lighter oval)
    ctx.fillStyle = skinColors.belly;
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
    headGrad.addColorStop(0, skinColors.bodyLight);
    headGrad.addColorStop(0.7, skinColors.body);
    headGrad.addColorStop(1, skinColors.bodyDark);
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(0, headY, R * 0.75, R * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cheeks (soft pink circles)
    ctx.fillStyle = skinColors.cheek;
    ctx.beginPath();
    ctx.arc(-9, headY + 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(9, headY + 4, 5, 0, Math.PI * 2);
    ctx.fill();

    // Ears
    const earBaseY = headY - R * 0.55;
    this.drawEar3D(ctx, -7, earBaseY, -0.15 + this.earBounce, skinColors);
    this.drawEar3D(ctx, 7, earBaseY, 0.15 - this.earBounce, skinColors);

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
    noseGrad.addColorStop(0, skinColors.nose);
    noseGrad.addColorStop(1, skinColors.nose);
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

  private drawEar3D(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, skinColors?: SkinColors): void {
    const sc = skinColors || getCurrentSkinColors();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Outer ear
    const earGrad = ctx.createLinearGradient(-6, 0, 6, 0);
    earGrad.addColorStop(0, sc.bodyDark);
    earGrad.addColorStop(0.3, sc.bodyLight);
    earGrad.addColorStop(0.7, sc.bodyLight);
    earGrad.addColorStop(1, sc.bodyDark);
    ctx.fillStyle = earGrad;
    ctx.beginPath();
    ctx.ellipse(0, -12, 6, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Inner ear
    const innerGrad = ctx.createLinearGradient(-3, -4, 3, -4);
    innerGrad.addColorStop(0, sc.earInner);
    innerGrad.addColorStop(0.5, sc.earInner);
    innerGrad.addColorStop(1, sc.earInner);
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
      const sprite = getParticleSprite(p.color, p.radius);
      const size = sprite.width;
      ctx.drawImage(sprite, p.x - size / 2, sy - size / 2);
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
    ctx.fillText('무한의당근', this.w / 2, this.h / 3);
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

  private handleReviveTap(x: number, y: number): boolean {
    if (!this.reviveAvailable) return false;
    const btn = getReviveHitArea(this.w, this.h);
    if (x >= btn.x && x <= btn.x + btn.width &&
        y >= btn.y && y <= btn.y + btn.height) {
      this.tryRevive();
      return true;
    }
    return false;
  }

  private async tryRevive(): Promise<void> {
    // 광고 제거 구매자는 광고 없이 바로 부활
    let rewarded = false;
    if (areAdsRemoved()) {
      rewarded = true;
    } else {
      rewarded = await showRewardedAd();
    }
    if (rewarded) {
      this.hasUsedRevive = true;
      this.reviveAvailable = false;
      // 마지막 도달 높이 근처에서 부활 (바닥이 아닌)
      this.bunnyY = this.groundY - this.heightReached + 200;
      this.bunnyX = this.w / 2;
      this.cameraY = this.bunnyY;
      this.targetCameraY = this.bunnyY;
      this.poolTopY = this.bunnyY + 100;
      this.fillPoolTo(this.bunnyY - this.h * 2, this.bunnyX);
      this.state = GameState.PLAYING;
      this.velY = JUMP_VELOCITY;
      this.hasJumped = true;
      this.audio.startBGM();
    }
  }

  private handleShopButtonTap(x: number, y: number): boolean {
    const btn = getShopButtonArea(this.w, this.h);
    if (x >= btn.x && x <= btn.x + btn.width &&
        y >= btn.y && y <= btn.y + btn.height) {
      openShop();
      return true;
    }
    return false;
  }

  private handleTabTap(x: number, y: number): boolean {
    const { allTab, weeklyTab } = getTabHitArea(this.w, this.h);
    if (x >= allTab.x && x <= allTab.x + allTab.width &&
        y >= allTab.y && y <= allTab.y + allTab.height) {
      if (this.rankingTab !== 'all') {
        this.rankingTab = 'all';
        this.loadRankings();
      }
      return true;
    }
    if (x >= weeklyTab.x && x <= weeklyTab.x + weeklyTab.width &&
        y >= weeklyTab.y && y <= weeklyTab.y + weeklyTab.height) {
      if (this.rankingTab !== 'weekly') {
        this.rankingTab = 'weekly';
        this.loadRankings();
      }
      return true;
    }
    return false;
  }

  private renderGameOverScreen(ctx: CanvasRenderingContext2D): void {
    renderRankingScreen(
      ctx, this.w, this.h,
      this.rankings, this.myRank, this.rankingTab,
      this.score, Math.floor(this.heightReached),
      this.bestScore, this.bestHeight,
      this.reviveAvailable,
    );
  }
}
