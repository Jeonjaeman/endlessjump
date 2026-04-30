/**
 * 상점 화면 (Canvas 기반 오버레이)
 *
 * - 광고 제거 구매
 * - 스킨 목록 (구매/선택)
 * - 구매 복원 버튼
 * - 업적 보기 버튼
 */

import { getProducts, purchaseProduct, restorePurchases, isProductPurchased, isAdsRemoved } from '../services/iap-service';
import { getSkins, selectSkin, getSelectedSkinId, getSkinUnlockInfo, getSkinSpriteDir } from '../services/skin-service';
import { getAchievements } from '../services/achievement-service';
import { showBanner, hideBanner } from '../services/ad-service';
import { skinAssetLoader } from '../skin-assets';
import { assetManager } from '../assets';
import type { BunnySkin, Achievement } from '../types';

// ── 상점 상태 ───────────────────────────────────────────────
let shopOpen = false;
let shopTab: 'items' | 'skins' | 'achievements' = 'items';
let skinsScrollY = 0;
let shopDragStartY = -1;
let shopDragScrollStart = 0;

export function isShopOpen(): boolean {
  return shopOpen;
}

export function handleShopWheel(deltaY: number): void {
  if (!shopOpen || shopTab !== 'skins') return;
  skinsScrollY = Math.max(0, Math.min(skinsMaxScroll, skinsScrollY + deltaY));
}

export function handleShopPointerDown(_x: number, y: number): void {
  if (!shopOpen || shopTab !== 'skins') return;
  shopDragStartY = y;
  shopDragScrollStart = skinsScrollY;
}

export function handleShopPointerMove(_x: number, y: number): void {
  if (!shopOpen || shopTab !== 'skins' || shopDragStartY < 0) return;
  const dy = shopDragStartY - y;
  skinsScrollY = Math.max(0, Math.min(skinsMaxScroll, shopDragScrollStart + dy));
}

export function handleShopPointerUp(): void {
  shopDragStartY = -1;
}

export function openShop(): void {
  shopOpen = true;
  shopTab = 'items';
  skinsScrollY = 0;

  // 스킨 썸네일 프리로드
  const skins = getSkins();
  const skinDirs = skins
    .filter(s => s.spriteDir)
    .map(s => ({ id: s.id, spriteDir: s.spriteDir! }));
  skinAssetLoader.loadAllThumbs(skinDirs).catch(() => {});

  // 배너 광고 표시
  showBanner();
}

export function closeShop(): void {
  shopOpen = false;
  hideBanner();
}

// ── 히트 영역 ───────────────────────────────────────────────
interface HitRect { x: number; y: number; width: number; height: number }

let closeButtonArea: HitRect = { x: 0, y: 0, width: 0, height: 0 };
let tabAreas: { items: HitRect; skins: HitRect; achievements: HitRect } = {
  items: { x: 0, y: 0, width: 0, height: 0 },
  skins: { x: 0, y: 0, width: 0, height: 0 },
  achievements: { x: 0, y: 0, width: 0, height: 0 },
};
let itemButtonAreas: { id: string; area: HitRect }[] = [];
let restoreArea: HitRect = { x: 0, y: 0, width: 0, height: 0 };
let skinsContentArea: HitRect = { x: 0, y: 0, width: 0, height: 0 };
let skinsMaxScroll = 0;

// ── 상점 버튼 히트 영역 (게임 오버 화면에서) ────────────────
export function getShopButtonArea(w: number, h: number): HitRect {
  const btnW = 100;
  const btnH = 36;
  return {
    x: w - btnW - 15,
    y: 15,
    width: btnW,
    height: btnH,
  };
}

// ── 상점 터치 처리 ──────────────────────────────────────────
export function handleShopTap(x: number, y: number): boolean {
  if (!shopOpen) return false;

  // 닫기 버튼
  if (hitTest(x, y, closeButtonArea)) {
    closeShop();
    return true;
  }

  // 탭 전환
  if (hitTest(x, y, tabAreas.items)) { shopTab = 'items'; return true; }
  if (hitTest(x, y, tabAreas.skins)) { shopTab = 'skins'; return true; }
  if (hitTest(x, y, tabAreas.achievements)) { shopTab = 'achievements'; return true; }

  // 아이템/스킨 구매 버튼
  for (const btn of itemButtonAreas) {
    if (hitTest(x, y, btn.area)) {
      handleItemTap(btn.id);
      return true;
    }
  }

  // 구매 복원
  if (hitTest(x, y, restoreArea)) {
    restorePurchases();
    return true;
  }

  // 상점 영역 안쪽 탭은 소비 (뒤로 전달 안 함)
  return true;
}

function hitTest(x: number, y: number, rect: HitRect): boolean {
  return x >= rect.x && x <= rect.x + rect.width &&
         y >= rect.y && y <= rect.y + rect.height;
}

async function handleItemTap(id: string): Promise<void> {
  // 스킨인 경우: 구매됨이면 선택, 아니면 구매
  const skins = getSkins();
  const skin = skins.find(s => s.id === id);
  if (skin) {
    if (skin.unlocked) {
      selectSkin(skin.id);
      skinAssetLoader.setCurrentSkin(skin.id);
      const spriteDir = getSkinSpriteDir(skin.id);
      if (spriteDir) {
        skinAssetLoader.loadSkin(skin.id, spriteDir);
      }
    } else if (skin.productId) {
      await purchaseProduct(skin.productId);
    }
    return;
  }

  // 광고 제거 등 일반 상품
  if (!isProductPurchased(id)) {
    await purchaseProduct(id);
  }
}

// ── 상점 렌더링 ─────────────────────────────────────────────
export function renderShop(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!shopOpen) return;

  itemButtonAreas = [];

  // 배경 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);

  const panelW = Math.min(w - 30, 360);
  const panelH = Math.min(h - 60, 520);
  const panelX = (w - panelW) / 2;
  const panelY = (h - panelH) / 2;

  // 패널 배경 (Neobrutalism)
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  roundRect(ctx, panelX + 4, panelY + 4, panelW, panelH, 14);
  ctx.fill();
  ctx.fillStyle = '#1e1e32';
  ctx.beginPath();
  roundRect(ctx, panelX, panelY, panelW, panelH, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  roundRect(ctx, panelX, panelY, panelW, panelH, 14);
  ctx.stroke();

  // 제목
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('상점', w / 2, panelY + 36);

  // 닫기 버튼
  const closeSize = 30;
  closeButtonArea = {
    x: panelX + panelW - closeSize - 8,
    y: panelY + 8,
    width: closeSize,
    height: closeSize,
  };
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.beginPath();
  ctx.arc(closeButtonArea.x + closeSize / 2, closeButtonArea.y + closeSize / 2, closeSize / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('✕', closeButtonArea.x + closeSize / 2, closeButtonArea.y + closeSize / 2 + 6);

  // 탭 버튼
  const tabY = panelY + 70;
  const tabW = (panelW - 40) / 3;
  const tabH = 30;
  const tabs: Array<{ key: typeof shopTab; label: string }> = [
    { key: 'items', label: '아이템' },
    { key: 'skins', label: '스킨' },
    { key: 'achievements', label: '업적' },
  ];

  tabs.forEach((tab, i) => {
    const tx = panelX + 10 + i * (tabW + 5);
    const active = shopTab === tab.key;

    // Neobrutalism 탭
    const bg = active ? '#FF6B35' : '#2a2a44';
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    roundRect(ctx, tx + 2, tabY + 2, tabW, tabH, 8);
    ctx.fill();
    ctx.fillStyle = bg;
    ctx.beginPath();
    roundRect(ctx, tx, tabY, tabW, tabH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, tx, tabY, tabW, tabH, 8);
    ctx.stroke();

    ctx.fillStyle = '#FFF';
    ctx.font = active ? 'bold 13px sans-serif' : '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tab.label, tx + tabW / 2, tabY + tabH / 2 + 5);

    (tabAreas as any)[tab.key] = { x: tx, y: tabY, width: tabW, height: tabH };
  });

  // 탭 내용
  const contentY = tabY + tabH + 16;
  const contentH = panelH - (contentY - panelY) - 50;

  if (shopTab === 'items') {
    renderItemsTab(ctx, panelX + 10, contentY, panelW - 20, contentH);
  } else if (shopTab === 'skins') {
    renderSkinsTab(ctx, panelX + 10, contentY, panelW - 20, contentH, w);
  } else {
    renderAchievementsTab(ctx, panelX + 10, contentY, panelW - 20, contentH);
  }

  // 구매 복원 버튼
  const restoreW = 120;
  const restoreH = 28;
  const restoreX = w / 2 - restoreW / 2;
  const restoreY = panelY + panelH - 40;
  restoreArea = { x: restoreX, y: restoreY, width: restoreW, height: restoreH };

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  roundRect(ctx, restoreX, restoreY, restoreW, restoreH, 6);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('구매 복원', w / 2, restoreY + restoreH / 2 + 4);
}

// ── 아이템 탭 ───────────────────────────────────────────────
function renderItemsTab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const purchased = isAdsRemoved();
  const rowH = 70;

  // 광고 제거 항목
  ctx.fillStyle = purchased ? 'rgba(76,175,80,0.15)' : 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  roundRect(ctx, x, y, w, rowH, 10);
  ctx.fill();

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🚫 광고 제거', x + 14, y + 26);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px sans-serif';
  ctx.fillText('모든 광고를 영구적으로 제거합니다', x + 14, y + 46);

  // 버튼
  const btnW = 70;
  const btnH = 30;
  const btnX = x + w - btnW - 10;
  const btnY = y + (rowH - btnH) / 2;

  if (purchased) {
    ctx.fillStyle = 'rgba(76,175,80,0.5)';
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('구매됨 ✓', btnX + btnW / 2, btnY + btnH / 2 + 4);
  } else {
    ctx.fillStyle = '#FF6B35';
    ctx.beginPath();
    roundRect(ctx, btnX, btnY, btnW, btnH, 6);
    ctx.fill();
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('₩3,300', btnX + btnW / 2, btnY + btnH / 2 + 4);

    itemButtonAreas.push({
      id: 'endlessjump_remove_ads',
      area: { x: btnX, y: btnY, width: btnW, height: btnH },
    });
  }
}

// ── 스킨 탭 ────────────────────────────────────────────────
function renderSkinsTab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _screenW: number): void {
  const skins = getSkins();
  const selectedId = getSelectedSkinId();
  const rowH = 72;
  const gap = 8;
  const totalContentH = skins.length * (rowH + gap) - gap;

  // 스크롤 상태 업데이트
  skinsContentArea = { x, y, width: w, height: h };
  skinsMaxScroll = Math.max(0, totalContentH - h);
  skinsScrollY = Math.min(skinsScrollY, skinsMaxScroll);

  // 클리핑
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  skins.forEach((skin, i) => {
    const ry = y + i * (rowH + gap) - skinsScrollY;
    if (ry + rowH < y || ry > y + h) return;

    const isSelected = skin.id === selectedId;
    const unlockInfo = getSkinUnlockInfo(skin.id);
    const spriteSet = skin.spriteDir ? skinAssetLoader.getSprites(skin.id) : null;

    // 행 배경 (Neobrutalism)
    const rowBg = isSelected ? '#FF6B35' : '#252540';
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    roundRect(ctx, x + 2, ry + 2, w, rowH, 8);
    ctx.fill();
    ctx.fillStyle = rowBg;
    ctx.beginPath();
    roundRect(ctx, x, ry, w, rowH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    roundRect(ctx, x, ry, w, rowH, 8);
    ctx.stroke();

    // 스킨 프리뷰 (48x48)
    const previewSize = 48;
    const previewX = x + 8;
    const previewY = ry + (rowH - previewSize) / 2;

    // 프리뷰: 썸네일 캐시 → 풀 스프라이트 thumb → 기본 bunny_idle → 색상 원 폴백
    const thumbImg = skinAssetLoader.getThumb(skin.id) ?? spriteSet?.thumb ?? null;
    const defaultBunnyImg = (!skin.spriteDir && assetManager.has('bunny_idle')) ? assetManager.get('bunny_idle') : null;
    const previewImg = thumbImg ?? defaultBunnyImg;

    if (previewImg) {
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, previewX, previewY, previewSize, previewSize, 6);
      ctx.clip();
      const aspect = previewImg.height / previewImg.width;
      const drawH = previewSize * aspect;
      const offsetY = (previewSize - drawH) / 2;
      ctx.drawImage(previewImg, previewX, previewY + offsetY, previewSize, drawH);
      ctx.restore();
    } else {
      const cx = previewX + previewSize / 2;
      const cy = previewY + previewSize / 2;
      ctx.fillStyle = skin.colors.body;
      ctx.beginPath();
      ctx.arc(cx, cy, previewSize / 2 - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = skin.colors.earInner;
      ctx.beginPath();
      ctx.arc(cx - 7, cy - 16, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + 7, cy - 16, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    const textX = x + previewSize + 16;
    const btnW = 68;
    const btnH = 28;
    const btnX = x + w - btnW - 8;

    // 이름
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(skin.name, textX, ry + 20);

    if (skin.unlocked) {
      // 해금됨
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.fillText(skin.description, textX, ry + 36);

      const btnY = ry + (rowH - btnH) / 2;
      if (isSelected) {
        drawNeoBtn(ctx, btnX, btnY, btnW, btnH, '선택됨', '#FF6B35');
      } else {
        drawNeoBtn(ctx, btnX, btnY, btnW, btnH, '선택', '#3a3a55');
        itemButtonAreas.push({ id: skin.id, area: { x: btnX, y: btnY, width: btnW, height: btnH } });
      }

    } else if (skin.premium) {
      // 프리미엄 전용
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('PREMIUM', textX, ry + 36);

      const btnY = ry + (rowH - btnH) / 2;
      const priceText = skin.price >= 1000 ? `₩${(skin.price / 1000).toFixed(1)}K` : `₩${skin.price.toLocaleString()}`;
      drawNeoBtn(ctx, btnX, btnY, btnW, btnH, priceText, '#FF6B35');
      itemButtonAreas.push({ id: skin.id, area: { x: btnX, y: btnY, width: btnW, height: btnH } });

    } else if (unlockInfo.unlockScore != null) {
      // 기록 해금 스킨: 진행 바
      const progress = Math.min(unlockInfo.bestHeight / unlockInfo.unlockScore, 1);
      const barW = btnX - textX - 8;
      const barH = 6;
      const barY = ry + 42;

      const targetMm = unlockInfo.unlockScore.toLocaleString();
      const currentMm = unlockInfo.bestHeight.toLocaleString();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${currentMm}mm / ${targetMm}mm`, textX, ry + 36);

      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      roundRect(ctx, textX, barY, barW, barH, 3);
      ctx.fill();
      ctx.fillStyle = progress >= 1 ? '#4CAF50' : '#FF6B35';
      ctx.beginPath();
      roundRect(ctx, textX, barY, barW * progress, barH, 3);
      ctx.fill();

      // or ₩X 버튼
      const btnY = ry + (rowH - btnH) / 2;
      const orPrice = skin.price >= 1000 ? `₩${(skin.price / 1000).toFixed(1)}K` : `₩${skin.price.toLocaleString()}`;
      drawNeoBtn(ctx, btnX, btnY, btnW, btnH, `or ${orPrice}`, '#D4A020', '10px');
      itemButtonAreas.push({ id: skin.id, area: { x: btnX, y: btnY, width: btnW, height: btnH } });

    } else {
      // 일반 미구매
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(skin.description, textX, ry + 36);

      const btnY = ry + (rowH - btnH) / 2;
      const priceText = skin.price >= 1000 ? `₩${(skin.price / 1000).toFixed(1)}K` : `₩${skin.price.toLocaleString()}`;
      drawNeoBtn(ctx, btnX, btnY, btnW, btnH, priceText, '#FF6B35');
      itemButtonAreas.push({ id: skin.id, area: { x: btnX, y: btnY, width: btnW, height: btnH } });
    }
  });

  ctx.restore();

  // 스크롤 인디케이터
  if (skinsMaxScroll > 0) {
    const indicatorH = Math.max(20, (h / totalContentH) * h);
    const indicatorY = y + (skinsScrollY / skinsMaxScroll) * (h - indicatorH);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    roundRect(ctx, x + w - 4, indicatorY, 4, indicatorH, 2);
    ctx.fill();
  }
}

// ── 업적 탭 ────────────────────────────────────────────────
function renderAchievementsTab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const achievements = getAchievements();
  const rowH = 56;
  const gap = 6;

  achievements.forEach((ach, i) => {
    const ry = y + i * (rowH + gap);
    if (ry > y + h) return;

    // 행 배경
    ctx.fillStyle = ach.completed
      ? 'rgba(76,175,80,0.15)'
      : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    roundRect(ctx, x, ry, w, rowH, 8);
    ctx.fill();

    // 아이콘
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(ach.icon, x + 12, ry + 34);

    // 이름
    ctx.fillStyle = ach.completed ? '#4CAF50' : '#FFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(ach.name, x + 44, ry + 22);

    // 설명
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.fillText(ach.description, x + 44, ry + 38);

    // 진행도 바
    const barW = 80;
    const barH = 6;
    const barX = x + w - barW - 40;
    const barY = ry + rowH / 2 - barH / 2;
    const progress = Math.min(ach.current / ach.target, 1);

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();

    ctx.fillStyle = ach.completed ? '#4CAF50' : '#FF6B35';
    ctx.beginPath();
    roundRect(ctx, barX, barY, barW * progress, barH, 3);
    ctx.fill();

    // 수치
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${ach.current}/${ach.target}`, x + w - 10, ry + 22);

    // 달성 표시
    if (ach.completed) {
      ctx.fillStyle = '#4CAF50';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('달성!', x + w - 10, ry + 38);
    }
  });
}

// ── 상점 버튼 렌더링 (게임 오버 화면에서) ───────────────────
export function renderShopButton(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const btn = getShopButtonArea(w, h);
  drawNeoBtn(ctx, btn.x, btn.y, btn.width, btn.height, '🛒 상점', '#FF6B35', '14px');
}

// ── 업적 달성 팝업 렌더링 ───────────────────────────────────
let popupQueue: Achievement[] = [];
let currentPopup: Achievement | null = null;
let popupTimer = 0;
const POPUP_DURATION = 120; // 프레임 수 (~2초)

export function queueAchievementPopup(ach: Achievement): void {
  popupQueue.push(ach);
}

export function clearAchievementPopups(): void {
  popupQueue = [];
  currentPopup = null;
}

export function renderAchievementPopup(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // 새 팝업 시작
  if (!currentPopup && popupQueue.length > 0) {
    currentPopup = popupQueue.shift()!;
    popupTimer = POPUP_DURATION;
  }

  if (!currentPopup || popupTimer <= 0) {
    currentPopup = null;
    return;
  }

  popupTimer--;

  // 슬라이드 인/아웃 애니메이션
  const progress = popupTimer / POPUP_DURATION;
  let slideY: number;
  if (progress > 0.85) {
    // 슬라이드 인
    slideY = -60 * ((progress - 0.85) / 0.15);
  } else if (progress < 0.1) {
    // 슬라이드 아웃
    slideY = -60 * (1 - progress / 0.1);
  } else {
    slideY = 0;
  }

  const popW = Math.min(w - 30, 280);
  const popH = 50;
  const popX = (w - popW) / 2;
  const popY = 20 + slideY;

  const alpha = progress > 0.85
    ? (1 - progress) / 0.15
    : progress < 0.1 ? progress / 0.1 : 1;

  ctx.save();
  ctx.globalAlpha = Math.min(alpha, 1);

  // 배경
  ctx.fillStyle = 'rgba(76,175,80,0.9)';
  ctx.beginPath();
  roundRect(ctx, popX, popY, popW, popH, 10);
  ctx.fill();

  // 아이콘
  ctx.font = '22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(currentPopup.icon, popX + 12, popY + 32);

  // 텍스트
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText('업적 달성!', popX + 42, popY + 20);

  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(currentPopup.name, popX + 42, popY + 38);

  ctx.restore();
}

// ── 유틸: Neobrutalism 버튼 ──────────────────────────────────
function drawNeoBtn(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, bg: string, fontSize: string = '11px',
): void {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  roundRect(ctx, x + 2, y + 2, w, h, 6);
  ctx.fill();
  ctx.fillStyle = bg;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 6);
  ctx.stroke();
  ctx.fillStyle = '#FFF';
  ctx.font = `bold ${fontSize} sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 4);
}

// ── 유틸: roundRect ─────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
