/**
 * AssetManager — Tier 1 그래픽 인프라
 *
 * - Promise.all로 모든 이미지 사전 로딩
 * - WebP 우선 + PNG 폴백
 * - 로딩 실패 시 vector fallback (game.ts의 render*가 자동 분기)
 * - onProgress 콜백으로 로딩 스피너 갱신
 */

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

interface AssetSpec {
  key: AssetKey;
  /** public/ 기준 경로 (확장자 제외). WebP 우선, PNG 폴백. */
  basePath: string;
}

const ASSET_SPECS: AssetSpec[] = [
  { key: 'bunny_idle',     basePath: '/assets/sprites/bunny_idle' },
  { key: 'bunny_jump',     basePath: '/assets/sprites/bunny_jump' },
  { key: 'bunny_fall',     basePath: '/assets/sprites/bunny_fall' },
  { key: 'carrot_normal',  basePath: '/assets/items/carrot_normal' },
  { key: 'carrot_special', basePath: '/assets/items/carrot_special' },
  { key: 'ground',         basePath: '/assets/tiles/ground' },
  { key: 'grass',          basePath: '/assets/tiles/grass' },
  { key: 'cloud',          basePath: '/assets/effects/cloud' },
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
];

export interface LoadProgress {
  loaded: number;
  total: number;
  /** 0~1 */
  ratio: number;
}

class AssetManagerImpl {
  private images = new Map<AssetKey, HTMLImageElement>();
  private loaded = false;
  private loading = false;

  /** 특정 에셋이 로드되어 사용 가능한지 여부 */
  has(key: AssetKey): boolean {
    return this.images.has(key);
  }

  /** 이미지 핸들 반환. 없으면 null (호출부에서 vector fallback 분기). */
  get(key: AssetKey): HTMLImageElement | null {
    return this.images.get(key) ?? null;
  }

  isReady(): boolean {
    return this.loaded;
  }

  /**
   * 모든 에셋을 사전 로드.
   * - WebP 시도 → 실패 시 PNG 시도 → 둘 다 실패 시 조용히 스킵 (vector fallback).
   * - 항상 resolve (개별 실패는 전체를 막지 않음).
   */
  async load(onProgress?: (p: LoadProgress) => void): Promise<void> {
    if (this.loaded || this.loading) return;
    this.loading = true;

    const total = ASSET_SPECS.length;
    let done = 0;

    const reportProgress = (): void => {
      done += 1;
      if (onProgress) {
        onProgress({ loaded: done, total, ratio: done / total });
      }
    };

    const tasks = ASSET_SPECS.map(async (spec) => {
      const img = await this.loadWithFallback(spec.basePath);
      if (img) {
        this.images.set(spec.key, img);
      }
      reportProgress();
    });

    await Promise.all(tasks);

    this.loaded = true;
    this.loading = false;
  }

  /** WebP 우선, 실패 시 PNG. 둘 다 실패 시 null 반환 (조용한 폴백). */
  private loadWithFallback(basePath: string): Promise<HTMLImageElement | null> {
    return this.tryLoad(`${basePath}.webp`).then((img) => {
      if (img) return img;
      return this.tryLoad(`${basePath}.png`);
    });
  }

  private tryLoad(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        // 사전 디코딩: 첫 drawImage 시 메인 스레드 블로킹 방지
        if ('decode' in img) {
          img.decode().then(() => resolve(img)).catch(() => resolve(img));
        } else {
          resolve(img);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }
}

/** 싱글톤 인스턴스. game.ts/main.ts에서 공유. */
export const assetManager = new AssetManagerImpl();
