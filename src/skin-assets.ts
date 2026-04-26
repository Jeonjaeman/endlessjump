import { type SkinSpriteSet } from './types';

interface SkinJson {
  idle?: string;
  jump?: string;
  fall?: string;
  itemNormal?: string;
  itemSpecial?: string;
  thumb?: string;
}

function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

class SkinAssetLoaderImpl {
  private cache = new Map<string, SkinSpriteSet>();
  private loadOrder: string[] = [];
  private currentSkinId: string = 'default';

  async loadSkin(skinId: string, spriteDir: string): Promise<SkinSpriteSet> {
    if (this.cache.has(skinId)) {
      return this.cache.get(skinId)!;
    }

    const base = `/assets/skins/${spriteDir}`;

    let fileMap: Required<SkinJson> = {
      idle: 'idle.webp',
      jump: 'jump.webp',
      fall: 'fall.webp',
      itemNormal: 'item_normal.webp',
      itemSpecial: 'item_special.webp',
      thumb: 'thumb.webp',
    };

    try {
      const res = await fetch(`${base}/skin.json`);
      if (res.ok) {
        const json: SkinJson = await res.json();
        fileMap = {
          idle: json.idle ?? fileMap.idle,
          jump: json.jump ?? fileMap.jump,
          fall: json.fall ?? fileMap.fall,
          itemNormal: json.itemNormal ?? fileMap.itemNormal,
          itemSpecial: json.itemSpecial ?? fileMap.itemSpecial,
          thumb: json.thumb ?? fileMap.thumb,
        };
      }
    } catch {
      // skin.json not found or parse error — use convention filenames
    }

    const [idle, jump, fall, itemNormal, itemSpecial, thumb] = await Promise.all([
      tryLoadImage(`${base}/${fileMap.idle}`),
      tryLoadImage(`${base}/${fileMap.jump}`),
      tryLoadImage(`${base}/${fileMap.fall}`),
      tryLoadImage(`${base}/${fileMap.itemNormal}`),
      tryLoadImage(`${base}/${fileMap.itemSpecial}`),
      tryLoadImage(`${base}/${fileMap.thumb}`),
    ]);

    const spriteSet: SkinSpriteSet = { idle, jump, fall, itemNormal, itemSpecial, thumb };

    // Evict oldest when cache grows beyond 2 (never evict current skin)
    if (this.cache.size >= 2) {
      const evictIdx = this.loadOrder.findIndex(id => id !== this.currentSkinId);
      if (evictIdx >= 0) {
        const evictId = this.loadOrder[evictIdx];
        this.loadOrder.splice(evictIdx, 1);
        this.cache.delete(evictId);
      }
    }

    this.cache.set(skinId, spriteSet);
    this.loadOrder.push(skinId);

    return spriteSet;
  }

  getCurrentSkinSprites(): SkinSpriteSet | null {
    return this.cache.get(this.currentSkinId) ?? null;
  }

  getSprites(skinId: string): SkinSpriteSet | null {
    return this.cache.get(skinId) ?? null;
  }

  setCurrentSkin(skinId: string): void {
    this.currentSkinId = skinId;
  }
}

export const skinAssetLoader = new SkinAssetLoaderImpl();
