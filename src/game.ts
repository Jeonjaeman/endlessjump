import { GameState, CarrotType, BunnyPose, type Carrot, type Particle, type Cloud, type ScorePopup, type RankEntry } from './types';
import { AudioManager } from './audio';
import { initAuth, getLocalUUID, isAccountLinked, linkGoogleAccount } from './services/auth';
import { submitScore } from './services/score';
import { fetchRanking, invalidateCache } from './services/leaderboard';
import { renderRankingScreen, getTabHitArea, getReviveHitArea, getLinkHitArea, getRankingMaxScroll } from './ui/ranking-screen';
import { showProfileModal } from './ui/profile-modal';
import { initAds, showBanner, hideBanner, isRewardedReady, showRewardedAd, areAdsRemoved } from './services/ad-service';
import { initIAP } from './services/iap-service';
import { initSkins, getCurrentSkinColors, getSelectedSkinId } from './services/skin-service';
import { skinAssetLoader } from './skin-assets';
import { initAchievements, onGameOver as achOnGameOver, onCarrotEaten as achOnCarrotEaten, popRecentlyCompleted } from './services/achievement-service';
import { isShopOpen, openShop, renderShop, renderShopButton, getShopButtonArea, renderAchievementPopup, queueAchievementPopup, clearAchievementPopups } from './ui/shop-screen';
import { InputManager } from './input';
import { BackgroundRenderer } from './background';
import { shouldShowTutorial, startTutorial, isTutorialActive, handleTutorialTap, renderTutorial } from './ui/tutorial-screen';
import { renderClouds, renderGround, renderCarrots, renderBunny, renderParticles, renderHUD, renderStartScreen, type RenderState } from './renderer';

const GRAVITY = 0.6;
const JUMP_VELOCITY = -15;
const MAX_FALL_SPEED = 12;
const BUNNY_RADIUS = 18;
const CARROT_RADIUS = 14;
const CARROT_HIT_RADIUS = 16;
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
  private rankingScrollY = 0;
  private rankingMaxScroll = 0;

  // Ad / Revive state
  private hasUsedRevive = false;
  private reviveAvailable = false;

  // Post-game flow state
  private capturedScore = 0;
  private capturedHeightMm = 0;
  private postGameFlowActive = false;
  private linkingInProgress = false;

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
        hideBanner();
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.touching = true;
        this.startTime = performance.now();
        this.bg.setSkin(getSelectedSkinId());
        this.audio.setBGM(getSelectedSkinId());
        this.audio.startBGM();
      },
      onStartTap: (x: number, y: number) => {
        // 튜토리얼 활성 중이면 다음 단계로
        if (isTutorialActive()) { handleTutorialTap(); return; }
        if (this.handleShopButtonTap(x, y)) return;
        if (this.handleStartGoogleTap(x, y)) return;
        // 첫 실행 시 튜토리얼 표시
        if (shouldShowTutorial()) { startTutorial(); return; }
        // 버튼이 아닌 영역 탭 → 게임 시작
        this.state = GameState.PLAYING;
        hideBanner();
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.touching = true;
        this.startTime = performance.now();
        this.bg.setSkin(getSelectedSkinId());
        this.audio.setBGM(getSelectedSkinId());
        this.audio.startBGM();
      },
      onGameOverTap: (x: number, y: number) => {
        if (this.handleShopButtonTap(x, y)) return;
        if (this.handleTabTap(x, y)) return;
        if (this.handleReviveTap(x, y)) return;
        if (this.handleLinkTap(x, y)) return;
        this.resetGame();
        this.state = GameState.START;
        showBanner();
      },
      onGameOverDrag: (dy: number) => {
        this.rankingScrollY = Math.max(0, Math.min(this.rankingMaxScroll, this.rankingScrollY + dy));
      },
      onGameOverWheel: (dy: number) => {
        this.rankingScrollY = Math.max(0, Math.min(this.rankingMaxScroll, this.rankingScrollY + dy * 0.5));
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
    this.bg.setSkin(getSelectedSkinId());
    initAchievements();
    initIAP();
    initAds().then(() => showBanner());
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
        this.lastTime = 0; // 복귀 시 dt 리셋 → 첫 프레임 렉 방지
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
    this.capturedScore = 0;
    this.capturedHeightMm = 0;
    this.postGameFlowActive = false;
    this.linkingInProgress = false;
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

      // Zone 레벨에 따라 safeMaxGap 조정 (최대 점프높이의 88%로 제한)
      const zoneLevel = height < 2000 ? 0 : height < 5000 ? 1 : height < 8000 ? 2
        : height < 12000 ? 3 : height < 20000 ? 4 : height < 35000 ? 5 : 6;
      const safeMaxGap = NORMAL_JUMP_PEAK * Math.min(0.75 + zoneLevel * 0.04, 0.88);

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
    // 낙하 시 카메라를 더 빠르게 추적 → 충돌 위치와 화면 위치 일치
    const lerpSpeed = this.velY > 2 ? 0.18 : CAMERA_LERP;
    this.cameraY += (this.targetCameraY - this.cameraY) * lerpSpeed;

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
      if (this.velY < -1) continue;
      // 토끼 발 위치 (중심 + 반지름)
      const feetY = this.bunnyY + BUNNY_RADIUS;
      // 토끼 발이 당근 상단보다 아래에 있어야 밟기 판정
      const carrotTop = c.y - CARROT_HIT_RADIUS;
      if (feetY < carrotTop) continue;
      // 토끼가 당근 중심보다 너무 아래이면 무시 (옆에서 스치는 것 방지)
      if (feetY > c.y + CARROT_HIT_RADIUS) continue;
      // 수평 거리 체크
      const dx = Math.abs(this.bunnyX - c.x);
      if (dx < BUNNY_RADIUS + CARROT_HIT_RADIUS) {
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
      this.audio.playJumpSound();
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
      this.audio.playJumpSound();
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
    showBanner();
    this.saveBest();
    this.audio.playGameOverSound();
    this.audio.stopBGM();
    // 업적 체크
    achOnGameOver(this.score, Math.floor(this.heightReached));
    // 달성된 업적 팝업 큐
    const completed = popRecentlyCompleted();
    for (const ach of completed) {
      queueAchievementPopup(ach);
    }

    // 부활 가능 여부: 이번 게임에서 아직 부활 안 했고, (리워드 광고 준비됨 또는 광고 제거 구매자)
    this.reviveAvailable = !this.hasUsedRevive && (isRewardedReady() || areAdsRemoved());

    // 랭킹 UI 초기화 (이전 게임 데이터 잔상 방지)
    this.rankings = [];
    this.myRank = null;
    this.rankingTab = 'all';
    this.rankingScrollY = 0;
    this.rankingMaxScroll = 0;

    // 인스턴스 필드에 캡처 (handleLinkTap 등에서도 접근 가능)
    this.capturedScore = this.score;
    this.capturedHeightMm = Math.floor(this.heightReached);

    // 직렬화된 post-game 흐름: Google 프롬프트 → 닉네임 모달 → 댓글 → 점수 제출
    this.serializedPostGameFlow().catch((e) => {
      console.warn('[Game] post-game flow 실패:', e);
    });
  }

  private async serializedPostGameFlow(): Promise<void> {
    if (this.postGameFlowActive) return;
    this.postGameFlowActive = true;

    try {
      // [1] Google 프롬프트 (미연동 유저만)
      if (!isAccountLinked()) {
        await this.showGooglePrompt();
      }

      // [2] 닉네임 모달 (Google 연동 완료 + 프로필 미설정 시만)
      if (isAccountLinked() && !localStorage.getItem('bh_profile_set')) {
        await showProfileModal();
        invalidateCache();
      }

      // [3] 댓글 수집 + 점수 제출 (연동된 유저만)
      if (isAccountLinked()) {
        await this.collectCommentThenSubmit(this.capturedHeightMm, this.capturedScore);
      } else {
        // 미연동 유저: 랭킹 조회만 (점수 미저장)
        await this.loadRankings();
      }
    } finally {
      this.postGameFlowActive = false;
    }
  }

  private showGooglePrompt(): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;
      const safeResolve = () => {
        if (resolved) return;
        resolved = true;
        overlay.remove();
        resolve();
      };

      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position:fixed;top:0;left:0;width:100%;height:100%;
        background:rgba(0,0,0,0.75);display:flex;align-items:center;
        justify-content:center;z-index:9998;font-family:sans-serif;
        padding:20px;box-sizing:border-box;
      `;

      const card = document.createElement('div');
      card.style.cssText = `
        background:rgba(30,30,50,0.97);border:1px solid rgba(66,133,244,0.5);
        border-radius:16px;padding:24px 20px;width:100%;max-width:340px;
        text-align:center;color:#fff;box-sizing:border-box;
      `;

      const title = document.createElement('div');
      title.style.cssText = 'font-size:18px;font-weight:bold;margin-bottom:8px;';
      title.textContent = '기록을 저장하시겠습니까?';
      card.appendChild(title);

      const desc = document.createElement('div');
      desc.style.cssText = 'font-size:14px;color:#aaa;margin-bottom:6px;';
      desc.textContent = 'Google 계정으로 로그인하면 기록이 영구 저장되고 랭킹에 반영됩니다.';
      card.appendChild(desc);

      const warn = document.createElement('div');
      warn.style.cssText = 'font-size:12px;color:#FF6B6B;margin-bottom:20px;';
      warn.textContent = '로그인하지 않으면 기록이 저장되지 않습니다.';
      card.appendChild(warn);

      const linkBtn = document.createElement('button');
      linkBtn.style.cssText = `
        width:100%;padding:14px;background:#4285F4;border:none;border-radius:10px;
        color:#fff;font-size:16px;font-weight:bold;cursor:pointer;margin-bottom:10px;
      `;
      linkBtn.textContent = 'Google로 기록 저장';

      const skipBtn = document.createElement('button');
      skipBtn.style.cssText = `
        width:100%;padding:12px;background:transparent;border:1px solid rgba(255,255,255,0.3);
        border-radius:10px;color:#aaa;font-size:14px;cursor:pointer;
      `;
      skipBtn.textContent = '건너뛰기';

      linkBtn.addEventListener('click', async () => {
        linkBtn.disabled = true;
        skipBtn.disabled = true;
        linkBtn.textContent = '연결 중...';
        linkBtn.style.opacity = '0.7';
        try {
          await linkGoogleAccount();
        } catch (e) {
          console.warn('[Game] Google link from prompt failed:', e);
        }
        safeResolve();
      });

      skipBtn.addEventListener('click', () => {
        linkBtn.disabled = true;
        skipBtn.disabled = true;
        safeResolve();
      });

      card.appendChild(linkBtn);
      card.appendChild(skipBtn);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    });
  }

  private async collectCommentThenSubmit(heightMm: number, score: number): Promise<void> {
    const skinId = getSelectedSkinId();

    // 먼저 랭킹을 로드하여 현재 TOP 10 확인
    await this.loadRankings();

    // 현재 기록이 TOP 10에 들 수 있는지 체크
    // 최소 200mm 이상이고 당근을 1개 이상 먹어야 댓글창 표시
    const top10Heights = this.rankings.map(r => r.height);
    const wouldBeTop10 = (top10Heights.length < 10 || heightMm > Math.min(...top10Heights));
    const isWorthCommenting = heightMm >= 200 && score >= 1;
    const rankingsLoaded = this.rankings.length > 0;

    if (wouldBeTop10 && isWorthCommenting && rankingsLoaded) {
      const comment = await this.showCommentOverlay();
      await this.submitAndLoadRankings(heightMm, score, skinId, comment);
    } else {
      await this.submitAndLoadRankings(heightMm, score, skinId, '');
    }
  }

  private showCommentOverlay(): Promise<string> {
    return new Promise((resolve) => {
      // ── 최상위 overlay ─────────────────────────────────────
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '9999';
      overlay.style.background = 'rgba(0,0,0,0.75)';
      overlay.style.padding = '20px';
      overlay.style.boxSizing = 'border-box';

      // ── 카드 ───────────────────────────────────────────────
      const card = document.createElement('div');
      card.style.background = 'rgba(30,30,50,0.97)';
      card.style.border = '1px solid rgba(255,107,53,0.5)';
      card.style.borderRadius = '16px';
      card.style.padding = '24px 20px';
      card.style.width = '100%';
      card.style.maxWidth = '340px';
      card.style.textAlign = 'center';
      card.style.fontFamily = 'sans-serif';
      card.style.color = '#fff';
      card.style.boxSizing = 'border-box';

      // ── 제목 ───────────────────────────────────────────────
      const title = document.createElement('div');
      title.style.fontSize = '22px';
      title.style.fontWeight = 'bold';
      title.style.color = '#FF4444';
      title.style.marginBottom = '6px';
      title.textContent = 'Game Over 🐰';

      // ── 서브타이틀 ─────────────────────────────────────────
      const sub = document.createElement('div');
      sub.style.fontSize = '13px';
      sub.style.color = 'rgba(255,255,255,0.6)';
      sub.style.marginBottom = '16px';
      sub.textContent = '이 기록 넘겨봐~ 한 마디 남기고 가!';

      // ── textarea ───────────────────────────────────────────
      const textarea = document.createElement('textarea');
      textarea.maxLength = 100;
      textarea.placeholder = '도발 한 마디 (선택, 최대 100자)';
      textarea.style.width = '100%';
      textarea.style.boxSizing = 'border-box';
      textarea.style.background = 'rgba(255,255,255,0.08)';
      textarea.style.border = '1px solid rgba(255,255,255,0.2)';
      textarea.style.borderRadius = '10px';
      textarea.style.color = '#fff';
      textarea.style.fontSize = '14px';
      textarea.style.padding = '10px 12px';
      textarea.style.resize = 'none';
      textarea.style.height = '70px';
      textarea.style.outline = 'none';
      textarea.style.fontFamily = 'sans-serif';

      // ── 글자 수 카운터 ─────────────────────────────────────
      const charCount = document.createElement('div');
      charCount.style.fontSize = '11px';
      charCount.style.color = 'rgba(255,255,255,0.35)';
      charCount.style.textAlign = 'right';
      charCount.style.marginTop = '4px';
      charCount.textContent = '0 / 100';

      // ── 확인 버튼 ──────────────────────────────────────────
      const btn = document.createElement('button');
      btn.style.marginTop = '14px';
      btn.style.width = '100%';
      btn.style.padding = '12px';
      btn.style.background = 'rgba(255,107,53,0.8)';
      btn.style.border = 'none';
      btn.style.borderRadius = '10px';
      btn.style.color = '#fff';
      btn.style.fontSize = '16px';
      btn.style.fontWeight = 'bold';
      btn.style.cursor = 'pointer';
      btn.textContent = '확인';

      // ── 조립 ───────────────────────────────────────────────
      card.appendChild(title);
      card.appendChild(sub);
      card.appendChild(textarea);
      card.appendChild(charCount);
      card.appendChild(btn);
      overlay.appendChild(card);
      document.body.appendChild(overlay);

      // ── 이벤트 ─────────────────────────────────────────────
      textarea.addEventListener('input', () => {
        charCount.textContent = `${textarea.value.length} / 100`;
      });

      const confirm = () => {
        const value = textarea.value.trim();
        document.body.removeChild(overlay);
        resolve(value);
      };

      btn.addEventListener('click', confirm);
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) confirm();
      });

      setTimeout(() => textarea.focus(), 100);
    });
  }

  private async submitAndLoadRankings(heightMm: number, score: number, skinId: string, comment: string): Promise<void> {
    await submitScore({ score, height: heightMm, skin_id: skinId, comment: comment || undefined });
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

  private perspectiveScale(_worldY: number): number {
    // 5만 미만: 1.0, 5만~10만: 1.0→0.5 선형 축소, 10만 이상: 0.5 고정
    const h = this.heightReached;
    if (h < 50000) return 1.0;
    if (h >= 100000) return 0.5;
    return 1.0 - (h - 50000) / 50000 * 0.5;
  }

  private lastTime = 0;
  private accumulator = 0;
  private readonly FIXED_DT = 1000 / 60; // 60fps 고정 타임스텝

  private loop(time: number): void {
    if (this.lastTime === 0) this.lastTime = time;
    const dt = time - this.lastTime;
    this.lastTime = time;

    if (dt < 100) {
      this.accumulator += dt;
      // 고정 타임스텝만큼 누적되면 update (최대 3회로 제한)
      let steps = 0;
      while (this.accumulator >= this.FIXED_DT && steps < 3) {
        this.update();
        this.accumulator -= this.FIXED_DT;
        steps++;
      }
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
      skinSprites: skinAssetLoader.getCurrentSkinSprites(),
      skinColors: getCurrentSkinColors(),
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
      // 시작 화면: 카메라를 위로 올려서 하늘을 더 보여줌
      const startCameraY = this.groundY - this.h * 0.7;
      const startWorldToScreen = (wy: number) => wy - startCameraY + this.h / 2;
      const startRs = { ...rs, worldToScreen: startWorldToScreen, cameraY: startCameraY };
      renderGround(ctx, startRs, this.groundY);
      renderCarrots(ctx, startRs);
      renderBunny(ctx, startRs, this.w / 2, startWorldToScreen(this.groundY - BUNNY_RADIUS - 10));
      renderStartScreen(ctx, this.w, this.h, this.bestScore, this.bestHeight);
      renderShopButton(ctx, this.w, this.h);
      this.renderStartGoogleButton(ctx);
      // 튜토리얼 오버레이 (최상위)
      if (isTutorialActive()) {
        renderTutorial(ctx, this.w, this.h);
      }
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
    this.bg.render(ctx, this.w, this.h, this.heightReached, elapsed, this.state === GameState.PLAYING, this.bunnyX, this.velY);
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
      hideBanner();
      this.velY = JUMP_VELOCITY;
      this.hasJumped = true;
      this.audio.startBGM();
    }
  }

  private handleLinkTap(x: number, y: number): boolean {
    if (isAccountLinked()) return false;
    const btn = getLinkHitArea(this.w, this.h, this.reviveAvailable);
    if (x >= btn.x && x <= btn.x + btn.width &&
        y >= btn.y && y <= btn.y + btn.height) {
      this.performLinkAndSubmit().catch((e) =>
        console.warn('[Game] link+submit 실패:', e));
      return true;
    }
    return false;
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

  private getStartGoogleBtnArea(): { x: number; y: number; width: number; height: number } {
    const btnW = 220;
    const btnH = 38;
    return { x: this.w / 2 - btnW / 2, y: this.h * 0.72, width: btnW, height: btnH };
  }

  private handleStartGoogleTap(x: number, y: number): boolean {
    if (isAccountLinked()) return false;
    const btn = this.getStartGoogleBtnArea();
    if (x >= btn.x && x <= btn.x + btn.width &&
        y >= btn.y && y <= btn.y + btn.height) {
      this.performLinkAndSubmit().catch((e) =>
        console.warn('[Game] link+submit 실패:', e));
      return true;
    }
    return false;
  }

  /** Google 연동 후 캡처된 점수 제출 (게임오버 상태일 때만) */
  private async performLinkAndSubmit(): Promise<void> {
    if (this.linkingInProgress) return;
    this.linkingInProgress = true;
    try {
      const success = await linkGoogleAccount();
      if (!success) return;

      // 게임오버 상태에서 캡처된 점수가 있으면 제출
      if (this.capturedScore > 0 && this.state === GameState.GAME_OVER) {
        if (!localStorage.getItem('bh_profile_set')) {
          await showProfileModal();
          invalidateCache();
        }
        await this.collectCommentThenSubmit(this.capturedHeightMm, this.capturedScore);
      }
    } finally {
      this.linkingInProgress = false;
    }
  }

  private renderStartGoogleButton(ctx: CanvasRenderingContext2D): void {
    if (isAccountLinked()) return;
    const btn = this.getStartGoogleBtnArea();
    // 배경 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.roundRect(btn.x + 2, btn.y + 2, btn.width, btn.height, 8);
    ctx.fill();
    // 배경
    ctx.fillStyle = '#4285F4';
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.width, btn.height, 8);
    ctx.fill();
    // 테두리
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.width, btn.height, 8);
    ctx.stroke();
    // 텍스트
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G  Google로 기록 영구 저장', btn.x + btn.width / 2, btn.y + btn.height / 2 + 5);
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
    this.rankingMaxScroll = getRankingMaxScroll(this.rankings, this.myRank);
    renderRankingScreen(
      ctx, this.w, this.h,
      this.rankings, this.myRank, this.rankingTab,
      this.score, Math.floor(this.heightReached),
      this.bestScore, this.bestHeight,
      this.reviveAvailable,
      this.rankingScrollY,
    );
  }
}
