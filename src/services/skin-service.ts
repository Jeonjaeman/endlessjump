/**
 * 스킨 관리 서비스
 *
 * - 기본 스킨(흰색) + 3개 유료 스킨 (핑크, 골든, 섀도우)
 * - 현재 선택 스킨 localStorage로 저장/로드
 * - 스킨별 토끼 렌더링 색상 데이터 제공
 * - IAP 구매 상태와 연동
 */

import type { BunnySkin, SkinColors } from '../types';
import {
  isProductPurchased,
  PRODUCT_SKIN_PACK_PINK,
  PRODUCT_SKIN_PACK_GOLDEN,
  PRODUCT_SKIN_PACK_SHADOW,
} from './iap-service';

// ── localStorage 키 ──────────────────────────────────────────
const STORAGE_KEY_SKIN = 'bh_selected_skin';

// ── 기본 스킨 색상 (현재 game.ts의 흰 토끼) ─────────────────
const DEFAULT_COLORS: SkinColors = {
  body: '#F5F2F0',
  bodyLight: '#FFFFFF',
  bodyDark: '#D5D0CC',
  belly: 'rgba(255,255,255,0.35)',
  earInner: '#FFB0B8',
  nose: '#FF8899',
  cheek: 'rgba(255,180,180,0.2)',
};

const PINK_COLORS: SkinColors = {
  body: '#FFB6C1',
  bodyLight: '#FFD1DC',
  bodyDark: '#E8909C',
  belly: 'rgba(255,220,230,0.4)',
  earInner: '#FF69B4',
  nose: '#FF1493',
  cheek: 'rgba(255,105,180,0.25)',
};

const GOLDEN_COLORS: SkinColors = {
  body: '#FFD700',
  bodyLight: '#FFE44D',
  bodyDark: '#CC9900',
  belly: 'rgba(255,248,200,0.4)',
  earInner: '#FFA500',
  nose: '#FF8C00',
  cheek: 'rgba(255,200,50,0.25)',
};

const SHADOW_COLORS: SkinColors = {
  body: '#4A4A5A',
  bodyLight: '#6A6A7A',
  bodyDark: '#2A2A3A',
  belly: 'rgba(100,100,120,0.35)',
  earInner: '#8B5CF6',
  nose: '#A78BFA',
  cheek: 'rgba(139,92,246,0.2)',
};

// ── 스킨 목록 정의 ──────────────────────────────────────────
const ALL_SKINS: BunnySkin[] = [
  {
    id: 'default',
    name: '기본 토끼',
    description: '하얗고 포근한 기본 토끼',
    colors: DEFAULT_COLORS,
    price: 0,
    productId: '',
    unlocked: true,
  },
  {
    id: 'pink',
    name: '핑크 버니',
    description: '사랑스러운 핑크 토끼',
    colors: PINK_COLORS,
    price: 1100,
    productId: PRODUCT_SKIN_PACK_PINK,
    unlocked: false,
  },
  {
    id: 'golden',
    name: '골든 버니',
    description: '반짝이는 황금 토끼',
    colors: GOLDEN_COLORS,
    price: 2200,
    productId: PRODUCT_SKIN_PACK_GOLDEN,
    unlocked: false,
  },
  {
    id: 'shadow',
    name: '섀도우 버니',
    description: '신비로운 어둠의 토끼',
    colors: SHADOW_COLORS,
    price: 2200,
    productId: PRODUCT_SKIN_PACK_SHADOW,
    unlocked: false,
  },
];

// ── 현재 선택된 스킨 ID ─────────────────────────────────────
let selectedSkinId = 'default';

// ── 초기화 (앱 시작 시 호출) ─────────────────────────────────
export function initSkins(): void {
  const stored = localStorage.getItem(STORAGE_KEY_SKIN);
  if (stored && ALL_SKINS.some(s => s.id === stored)) {
    selectedSkinId = stored;
  }
}

// ── 스킨 목록 조회 (구매 상태 반영) ─────────────────────────
export function getSkins(): BunnySkin[] {
  return ALL_SKINS.map(skin => ({
    ...skin,
    unlocked: skin.price === 0 || (skin.productId !== '' && isProductPurchased(skin.productId)),
  }));
}

// ── 현재 선택된 스킨 ID 조회 ────────────────────────────────
export function getSelectedSkinId(): string {
  return selectedSkinId;
}

// ── 스킨 선택 (잠금해제된 스킨만) ───────────────────────────
export function selectSkin(skinId: string): boolean {
  const skins = getSkins();
  const skin = skins.find(s => s.id === skinId);
  if (!skin || !skin.unlocked) return false;

  selectedSkinId = skinId;
  localStorage.setItem(STORAGE_KEY_SKIN, skinId);
  return true;
}

// ── 현재 선택된 스킨의 색상 데이터 조회 ─────────────────────
export function getCurrentSkinColors(): SkinColors {
  const skin = ALL_SKINS.find(s => s.id === selectedSkinId);
  return skin ? skin.colors : DEFAULT_COLORS;
}

// ── 특정 스킨의 색상 데이터 조회 ────────────────────────────
export function getSkinColors(skinId: string): SkinColors {
  const skin = ALL_SKINS.find(s => s.id === skinId);
  return skin ? skin.colors : DEFAULT_COLORS;
}
