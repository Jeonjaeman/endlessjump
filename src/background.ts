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

// 각 구간의 높이 경계 (순방향)
const ZONE_THRESHOLDS = [5000, 12000, 22000, 35000];
// 역방향 구간 폭
const REVERSE_ZONE_SIZE = 10000;

const FADE_DURATION = 120; // frames (~2 seconds at 60fps)
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

export class BackgroundRenderer {
  private currentKey: AssetKey | null = null;
  private prevKey: AssetKey | null = null;
  private fadeProgress = 0;

  private fallbackGrad: CanvasGradient | null = null;
  private fallbackH = 0;

  render(ctx: CanvasRenderingContext2D, w: number, h: number, height: number, elapsed: number, isPlaying: boolean): void {
    const targetKey = this.pickBackground(height, elapsed, isPlaying);

    if (targetKey !== this.currentKey) {
      this.prevKey = this.currentKey;
      this.currentKey = targetKey;
      this.fadeProgress = 0;
    }

    const currentImg = this.currentKey ? assetManager.get(this.currentKey) : null;
    const prevImg = this.prevKey ? assetManager.get(this.prevKey) : null;

    if (currentImg) {
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

    this.renderFallback(ctx, w, h);
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
