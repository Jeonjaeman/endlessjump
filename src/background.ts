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
    const zone = HEIGHT_ZONES.find(z => height < z.maxHeight) || HEIGHT_ZONES[HEIGHT_ZONES.length - 1];

    if (height >= 5000) return zone.dayKey;

    if (!isPlaying) return zone.nightKey;

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
