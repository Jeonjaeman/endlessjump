import { assetManager, type AssetKey } from './assets';

// 배경 전환 순서 (높이 기준)
// 0~5k: 낮/밤, 5k~12k: 석양, 12k~22k: 새벽, 22k~35k: 우주
// 35k 이후 역방향: 새벽→석양→낮/밤 (순환)
interface BgStep {
  dayKey: AssetKey;
  nightKey: AssetKey;
}

const BG_SEQUENCE: BgStep[] = [
  { dayKey: 'sky_day',    nightKey: 'sky_night' },   // 0: 낮/밤
  { dayKey: 'sky_sunset', nightKey: 'sky_night' },   // 1: 석양
  { dayKey: 'sky_dawn',   nightKey: 'sky_space' },   // 2: 새벽
  { dayKey: 'sky_space',  nightKey: 'sky_space' },   // 3: 우주
];

// ── 스킨별 배경 이미지 로더 ──────────────────────────────────
const BG_NAMES = ['sky_day', 'sky_sunset', 'sky_night', 'sky_dawn', 'sky_space'] as const;

const skinBgCache = new Map<string, Map<string, HTMLImageElement>>();
let skinBgLoading = new Set<string>();

function loadSkinBackgrounds(skinId: string): void {
  if (skinId === 'default' || skinBgCache.has(skinId) || skinBgLoading.has(skinId)) return;
  skinBgLoading.add(skinId);
  const map = new Map<string, HTMLImageElement>();
  let loaded = 0;
  for (const name of BG_NAMES) {
    const img = new Image();
    img.onload = () => {
      map.set(name, img);
      loaded++;
      if (loaded === BG_NAMES.length) {
        skinBgCache.set(skinId, map);
        skinBgLoading.delete(skinId);
      }
    };
    img.onerror = () => {
      loaded++;
      if (loaded === BG_NAMES.length) {
        if (map.size > 0) skinBgCache.set(skinId, map);
        skinBgLoading.delete(skinId);
      }
    };
    img.src = `/assets/backgrounds/${skinId}/${name}.webp`;
  }
}

function getSkinBgImage(skinId: string, key: AssetKey): HTMLImageElement | null {
  if (skinId === 'default') return null;
  const map = skinBgCache.get(skinId);
  return map?.get(key) ?? null;
}

// 각 구간의 높이 경계 (순방향)
const ZONE_THRESHOLDS = [5000, 12000, 22000, 35000];
// 역방향 구간 폭
const REVERSE_ZONE_SIZE = 10000;

const FADE_DURATION = 40; // frames (~0.67 seconds at 60fps)
const DAY_CYCLE_MS = 120_000;

function getZoneIndex(height: number): number {
  // 순방향: 0→1→2→3
  if (height < ZONE_THRESHOLDS[3]) {
    for (let i = 0; i < ZONE_THRESHOLDS.length; i++) {
      if (height < ZONE_THRESHOLDS[i]) return i;
    }
    return BG_SEQUENCE.length - 1;
  }

  // 역방향: 3→2→1→0→1→2→3→2→1→0... (순환)
  const past = height - ZONE_THRESHOLDS[3];
  const cycleLen = (BG_SEQUENCE.length - 1) * 2; // 6 steps per full cycle
  const pos = Math.floor(past / REVERSE_ZONE_SIZE) % cycleLen;
  // pos 0→2(dawn), 1→1(sunset), 2→0(day), 3→1(sunset), 4→2(dawn), 5→3(space)
  if (pos < BG_SEQUENCE.length - 1) {
    return (BG_SEQUENCE.length - 1) - 1 - pos; // 2, 1, 0
  }
  return pos - (BG_SEQUENCE.length - 1) + 1; // 1, 2, 3
}

// ── 패럴랙스 설정 ──────────────────────────────────────────
const PARALLAX_SCALE = 1.18;        // 배경을 18% 크게 그려서 여유 확보
const PARALLAX_X_FACTOR = 0.06;     // 토끼 X 이동 → 배경 반대 이동 비율
const PARALLAX_Y_FACTOR = 3.0;      // 수직 속도 → 배경 Y 이동 (위로 점프 시 배경 아래로)
const PARALLAX_SMOOTH = 0.10;       // 부드러운 보간 속도
const PARALLAX_Y_MAX = 30;          // Y 오프셋 최대값 (px)

export class BackgroundRenderer {
  private currentKey: AssetKey | null = null;
  private prevKey: AssetKey | null = null;
  private fadeProgress = 0;

  private fallbackGrad: CanvasGradient | null = null;
  private fallbackH = 0;

  // 패럴랙스 상태
  private offsetX = 0;
  private offsetY = 0;
  private targetOffsetX = 0;
  private targetOffsetY = 0;

  // 스킨 배경
  private skinId = 'default';

  setSkin(skinId: string): void {
    if (this.skinId === skinId) return;
    this.skinId = skinId;
    loadSkinBackgrounds(skinId);
  }

  render(
    ctx: CanvasRenderingContext2D, w: number, h: number,
    height: number, elapsed: number, isPlaying: boolean,
    bunnyX?: number, velY?: number,
  ): void {
    // 패럴랙스 목표값 계산
    if (bunnyX != null) {
      const centerX = w / 2;
      this.targetOffsetX = -(bunnyX - centerX) * PARALLAX_X_FACTOR;
    }
    if (velY != null) {
      // 점프(velY<0) → 배경 아래로, 하강(velY>0) → 배경 위로
      const rawY = velY * PARALLAX_Y_FACTOR;
      this.targetOffsetY = Math.max(-PARALLAX_Y_MAX, Math.min(PARALLAX_Y_MAX, rawY));
    }

    // 부드러운 보간
    this.offsetX += (this.targetOffsetX - this.offsetX) * PARALLAX_SMOOTH;
    this.offsetY += (this.targetOffsetY - this.offsetY) * PARALLAX_SMOOTH;

    const targetKey = this.pickBackground(height, elapsed, isPlaying);

    if (targetKey !== this.currentKey) {
      this.prevKey = this.currentKey;
      this.currentKey = targetKey;
      this.fadeProgress = 0;
    }

    const currentImg = this.currentKey
      ? (getSkinBgImage(this.skinId, this.currentKey) ?? assetManager.get(this.currentKey))
      : null;
    const prevImg = this.prevKey
      ? (getSkinBgImage(this.skinId, this.prevKey) ?? assetManager.get(this.prevKey))
      : null;

    if (currentImg) {
      if (this.fadeProgress < 1 && prevImg) {
        ctx.globalAlpha = 1.0;
        this.drawParallax(ctx, prevImg, w, h);
        ctx.globalAlpha = this.fadeProgress;
        this.drawParallax(ctx, currentImg, w, h);
        ctx.globalAlpha = 1.0;
        this.fadeProgress = Math.min(1, this.fadeProgress + 1 / FADE_DURATION);
      } else {
        this.drawParallax(ctx, currentImg, w, h);
        this.fadeProgress = 1;
      }
      return;
    }

    this.renderFallback(ctx, w, h);
  }

  private drawParallax(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number): void {
    const scaledW = w * PARALLAX_SCALE;
    const scaledH = h * PARALLAX_SCALE;
    const extraW = (scaledW - w) / 2;
    const extraH = (scaledH - h) / 2;
    const dx = -extraW + this.offsetX;
    const dy = -extraH + this.offsetY;
    ctx.drawImage(img, dx, dy, scaledW, scaledH);
  }

  private pickBackground(height: number, elapsed: number, isPlaying: boolean): AssetKey {
    const idx = getZoneIndex(height);
    const step = BG_SEQUENCE[idx];

    // 우주 이상에서는 낮/밤 사이클 무시
    if (idx >= 3) return step.dayKey;

    if (!isPlaying) return step.nightKey;

    const cycle = (elapsed % DAY_CYCLE_MS) / DAY_CYCLE_MS;
    const isNight = cycle >= 0.3 && cycle < 0.7;
    return isNight ? step.nightKey : step.dayKey;
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
