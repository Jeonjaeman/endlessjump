import { GameState, CarrotType, BunnyPose, type Carrot, type Particle, type Cloud, type ScorePopup, type RankEntry } from './types';
import { AudioManager } from './audio';
import { initAuth, getLocalUUID } from './services/auth';
import { submitScore } from './services/score';
import { fetchRanking, invalidateCache } from './services/leaderboard';
import { renderRankingScreen, getTabHitArea, getReviveHitArea } from './ui/ranking-screen';
import { showProfileModal } from './ui/profile-modal';
import { initAds, showBanner, hideBanner, showInterstitialOnGameOver, isRewardedReady, showRewardedAd, areAdsRemoved } from './services/ad-service';
import { initIAP } from './services/iap-service';
import { initSkins } from './services/skin-service';
import { initAchievements, onGameOver as achOnGameOver, onCarrotEaten as achOnCarrotEaten, popRecentlyCompleted } from './services/achievement-service';
import { isShopOpen, openShop, renderShop, renderShopButton, getShopButtonArea, renderAchievementPopup, queueAchievementPopup, clearAchievementPopups } from './ui/shop-screen';
import { InputManager } from './input';
import { BackgroundRenderer } from './background';
import { renderClouds, renderGround, renderCarrots, renderBunny, renderParticles, renderHUD, renderStartScreen, type RenderState } from './renderer';

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
  if (height < 2000) return { minGap: 30, maxGap: 50, specialChance: 0.15 };
  if (height < 5000) return { minGap: 40, maxGap: 65, specialChance: 0.15 };
  if (height < 8000) return { minGap: 55, maxGap: 85, specialChance: 0.17 };
  if (height < 12000) return { minGap: 70, maxGap: 110, specialChance: 0.18 };
  if (height < 20000) return { minGap: 90, maxGap: 150, specialChance: 0.20 };
  if (height < 35000) return { minGap: 130, maxGap: 210, specialChance: 0.22 };
  return { minGap: 200, maxGap: 300, specialChance: 0.25 };
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
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
    const self = this;
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
    const hMm = Math.floor(this.heightReached);
    // 높이 우선, 동점 시 당근 수로 비교
    const isNewBest = hMm > this.bestHeight ||
      (hMm === this.bestHeight && this.score > this.bestScore);
    if (isNewBest) {
      this.bestHeight = hMm;
      this.bestScore = this.score;
      localStorage.setItem('bh_bestHeight', String(this.bestHeight));
      localStorage.setItem('bh_bestScore', String(this.bestScore));
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
      const zoneLevel = height < 2000 ? 0 : height < 5000 ? 1 : height < 8000 ? 2
        : height < 12000 ? 3 : height < 20000 ? 4 : height < 35000 ? 5 : 6;
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
