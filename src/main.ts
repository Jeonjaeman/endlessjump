import { Game } from './game';
import { assetManager } from './assets';
import { skinAssetLoader } from './skin-assets';
import { getSelectedSkinId, getSkinSpriteDir, initSkins } from './services/skin-service';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const loadingEl = document.getElementById('loading');
const loadingBar = document.getElementById('loading-bar');
const loadingPct = document.getElementById('loading-pct');

async function bootstrap(): Promise<void> {
  initSkins();
  const selectedId = getSelectedSkinId();
  const spriteDir = getSkinSpriteDir(selectedId);
  skinAssetLoader.setCurrentSkin(selectedId);

  await Promise.all([
    assetManager.load((p) => {
      const pct = Math.round(p.ratio * 100);
      if (loadingBar) loadingBar.style.width = `${pct}%`;
      if (loadingPct) loadingPct.textContent = `${pct}%`;
    }),
    spriteDir ? skinAssetLoader.loadSkin(selectedId, spriteDir) : Promise.resolve(),
  ]);

  const game = new Game(canvas);
  game.start();

  // Fade out loading splash
  if (loadingEl) {
    loadingEl.classList.add('hidden');
    setTimeout(() => {
      loadingEl.parentNode?.removeChild(loadingEl);
    }, 500);
  }
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  // 에셋 로딩이 실패해도 게임은 시작 (vector fallback 동작)
  const game = new Game(canvas);
  game.start();
  if (loadingEl) loadingEl.classList.add('hidden');
});
