/**
 * 상점 화면 (Canvas 기반 오버레이)
 *
 * - 광고 제거 구매
 * - 스킨 목록 (구매/선택)
 * - 구매 복원 버튼
 * - 업적 보기 버튼
 */

import { getProducts, purchaseProduct, restorePurchases, isProductPurchased, isAdsRemoved } from '../services/iap-service';
import { getSkins, selectSkin, getSelectedSkinId } from '../services/skin-service';
import { getAchievements, getCoins } from '../services/achievement-service';
import type { BunnySkin, Achievement } from '../types';

// ── 상점 상태 ───────────────────────────────────────────────
let shopOpen = false;
let shopTab: 'items' | 'skins' | 'achievements' = 'items';

export function isShopOpen(): boolean {
  return shopOpen;
}

export function openShop(): void {
  shopOpen = true;
  shopTab = 'items';
}

export function closeShop(): void {
  shopOpen = false;
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

  // 패널 배경
  ctx.fillStyle = 'rgba(30,30,50,0.95)';
  ctx.beginPath();
  roundRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, panelX, panelY, panelW, panelH, 16);
  ctx.stroke();

  // 제목 + 코인
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('상점', w / 2, panelY + 36);

  ctx.fillStyle = '#FFD700';
  ctx.font = '14px sans-serif';
  ctx.fillText(`🪙 ${getCoins()} 코인`, w / 2, panelY + 56);

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

    ctx.fillStyle = active ? 'rgba(255,107,53,0.8)' : 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    roundRect(ctx, tx, tabY, tabW, tabH, 6);
    ctx.fill();

    ctx.fillStyle = active ? '#FFF' : 'rgba(255,255,255,0.5)';
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
    ctx.fillText('₩1,100', btnX + btnW / 2, btnY + btnH / 2 + 4);

    itemButtonAreas.push({
      id: 'bunnyhop_remove_ads',
      area: { x: btnX, y: btnY, width: btnW, height: btnH },
    });
  }
}

// ── 스킨 탭 ────────────────────────────────────────────────
function renderSkinsTab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, screenW: number): void {
  const skins = getSkins();
  const selectedId = getSelectedSkinId();
  const rowH = 64;
  const gap = 8;

  skins.forEach((skin, i) => {
    const ry = y + i * (rowH + gap);
    if (ry > y + h) return;

    const isSelected = skin.id === selectedId;

    // 행 배경
    ctx.fillStyle = isSelected
      ? 'rgba(255,107,53,0.2)'
      : 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    roundRect(ctx, x, ry, w, rowH, 10);
    ctx.fill();

    if (isSelected) {
      ctx.strokeStyle = '#FF6B35';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, x, ry, w, rowH, 10);
      ctx.stroke();
    }

    // 스킨 프리뷰 (작은 원)
    const previewX = x + 30;
    const previewY = ry + rowH / 2;
    ctx.fillStyle = skin.colors.body;
    ctx.beginPath();
    ctx.arc(previewX, previewY, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = skin.colors.earInner;
    ctx.beginPath();
    ctx.arc(previewX - 6, previewY - 14, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(previewX + 6, previewY - 14, 4, 0, Math.PI * 2);
    ctx.fill();

    // 이름 + 설명
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(skin.name, x + 56, ry + 24);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.fillText(skin.description, x + 56, ry + 42);

    // 상태 버튼
    const btnW = 64;
    const btnH = 28;
    const btnX = x + w - btnW - 10;
    const btnY = ry + (rowH - btnH) / 2;

    if (skin.price === 0 || skin.unlocked) {
      if (isSelected) {
        ctx.fillStyle = 'rgba(255,107,53,0.6)';
        ctx.beginPath();
        roundRect(ctx, btnX, btnY, btnW, btnH, 6);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('선택됨', btnX + btnW / 2, btnY + btnH / 2 + 4);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        roundRect(ctx, btnX, btnY, btnW, btnH, 6);
        ctx.fill();
        ctx.fillStyle = '#FFF';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('선택', btnX + btnW / 2, btnY + btnH / 2 + 4);

        itemButtonAreas.push({
          id: skin.id,
          area: { x: btnX, y: btnY, width: btnW, height: btnH },
        });
      }
    } else {
      // 미구매
      ctx.fillStyle = '#FF6B35';
      ctx.beginPath();
      roundRect(ctx, btnX, btnY, btnW, btnH, 6);
      ctx.fill();
      ctx.fillStyle = '#FFF';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      const priceText = skin.price >= 2000 ? `₩${(skin.price / 1000).toFixed(1)}K` : `₩${skin.price.toLocaleString()}`;
      ctx.fillText(priceText, btnX + btnW / 2, btnY + btnH / 2 + 4);

      itemButtonAreas.push({
        id: skin.id,
        area: { x: btnX, y: btnY, width: btnW, height: btnH },
      });
    }
  });
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

    // 보상
    ctx.fillStyle = '#FFD700';
    ctx.font = '10px sans-serif';
    ctx.fillText(`🪙${ach.reward}`, x + w - 10, ry + 38);
  });
}

// ── 상점 버튼 렌더링 (게임 오버 화면에서) ───────────────────
export function renderShopButton(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const btn = getShopButtonArea(w, h);

  ctx.fillStyle = 'rgba(255,107,53,0.8)';
  ctx.beginPath();
  roundRect(ctx, btn.x, btn.y, btn.width, btn.height, 8);
  ctx.fill();

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🛒 상점', btn.x + btn.width / 2, btn.y + btn.height / 2 + 5);
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
  ctx.fillText(`${currentPopup.name} — 🪙${currentPopup.reward}`, popX + 42, popY + 38);

  ctx.restore();
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
