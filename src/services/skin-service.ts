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
  PRODUCT_SKIN_PACK_SHADOW_NINJA,
  PRODUCT_SKIN_PACK_OCEAN_PIRATE,
  PRODUCT_SKIN_PACK_METAL_HERO,
  PRODUCT_SKIN_PACK_THUNDER_GUARDIAN,
  PRODUCT_SKIN_PACK_JUNGLE_KING,
  PRODUCT_SKIN_PACK_CLAW_FIGHTER,
  PRODUCT_SKIN_PACK_SPACE_EXPLORER,
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

const SHADOW_NINJA_COLORS: SkinColors = {
  body: '#2A2A3A',
  bodyLight: '#3A3A50',
  bodyDark: '#14141E',
  belly: 'rgba(80,80,100,0.35)',
  earInner: '#6050A0',
  nose: '#8060C0',
  cheek: 'rgba(80,60,120,0.2)',
};

const OCEAN_PIRATE_COLORS: SkinColors = {
  body: '#1A5580',
  bodyLight: '#2E80B8',
  bodyDark: '#0E3050',
  belly: 'rgba(60,160,220,0.35)',
  earInner: '#40B8E0',
  nose: '#20A0D0',
  cheek: 'rgba(40,140,200,0.2)',
};

const METAL_HERO_COLORS: SkinColors = {
  body: '#B0B8C8',
  bodyLight: '#D8E0EC',
  bodyDark: '#7A8494',
  belly: 'rgba(200,210,230,0.35)',
  earInner: '#7090C0',
  nose: '#5070A0',
  cheek: 'rgba(100,130,200,0.2)',
};

const THUNDER_GUARDIAN_COLORS: SkinColors = {
  body: '#4A3080',
  bodyLight: '#6A50A8',
  bodyDark: '#2A1850',
  belly: 'rgba(140,100,220,0.3)',
  earInner: '#FFD840',
  nose: '#FFC020',
  cheek: 'rgba(255,200,40,0.2)',
};

const JUNGLE_KING_COLORS: SkinColors = {
  body: '#C8880A',
  bodyLight: '#E8A820',
  bodyDark: '#905800',
  belly: 'rgba(220,160,40,0.35)',
  earInner: '#F0C040',
  nose: '#D09020',
  cheek: 'rgba(200,140,20,0.2)',
};

const CLAW_FIGHTER_COLORS: SkinColors = {
  body: '#8B3A3A',
  bodyLight: '#B05050',
  bodyDark: '#5A2020',
  belly: 'rgba(180,80,80,0.35)',
  earInner: '#E06060',
  nose: '#C04040',
  cheek: 'rgba(200,60,60,0.2)',
};

const SPACE_EXPLORER_COLORS: SkinColors = {
  body: '#0A1A3A',
  bodyLight: '#1A3060',
  bodyDark: '#050D20',
  belly: 'rgba(60,120,220,0.3)',
  earInner: '#4090FF',
  nose: '#2070E0',
  cheek: 'rgba(40,100,200,0.2)',
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
  {
    id: 'shadow_ninja',
    name: '섀도우 닌자',
    description: '그림자 속 닌자 토끼',
    colors: SHADOW_NINJA_COLORS,
    price: 1100,
    productId: PRODUCT_SKIN_PACK_SHADOW_NINJA,
    unlocked: false,
    spriteDir: 'shadow_ninja',
    unlockScore: 40000,
  },
  {
    id: 'ocean_pirate',
    name: '오션 파이럿',
    description: '대해적 토끼',
    colors: OCEAN_PIRATE_COLORS,
    price: 1100,
    productId: PRODUCT_SKIN_PACK_OCEAN_PIRATE,
    unlocked: false,
    spriteDir: 'ocean_pirate',
    unlockScore: 60000,
  },
  {
    id: 'metal_hero',
    name: '메탈 히어로',
    description: '강철 아머의 토끼',
    colors: METAL_HERO_COLORS,
    price: 2200,
    productId: PRODUCT_SKIN_PACK_METAL_HERO,
    unlocked: false,
    spriteDir: 'metal_hero',
    unlockScore: 80000,
  },
  {
    id: 'thunder_guardian',
    name: '썬더 가디언',
    description: '번개의 수호자 토끼',
    colors: THUNDER_GUARDIAN_COLORS,
    price: 2200,
    productId: PRODUCT_SKIN_PACK_THUNDER_GUARDIAN,
    unlocked: false,
    spriteDir: 'thunder_guardian',
    unlockScore: 100000,
  },
  {
    id: 'jungle_king',
    name: '정글 킹',
    description: '정글의 왕 사자',
    colors: JUNGLE_KING_COLORS,
    price: 2200,
    productId: PRODUCT_SKIN_PACK_JUNGLE_KING,
    unlocked: false,
    spriteDir: 'jungle_king',
    premium: true,
  },
  {
    id: 'claw_fighter',
    name: '클로 파이터',
    description: '날카로운 발톱의 전사 토끼',
    colors: CLAW_FIGHTER_COLORS,
    price: 2200,
    productId: PRODUCT_SKIN_PACK_CLAW_FIGHTER,
    unlocked: false,
    spriteDir: 'claw_fighter',
    premium: true,
  },
  {
    id: 'space_explorer',
    name: '스페이스 익스플로러',
    description: '우주를 탐험하는 토끼',
    colors: SPACE_EXPLORER_COLORS,
    price: 3300,
    productId: PRODUCT_SKIN_PACK_SPACE_EXPLORER,
    unlocked: false,
    spriteDir: 'space_explorer',
    premium: true,
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
  const bestHeight = parseInt(localStorage.getItem('bh_bestHeight') ?? '0', 10);
  return ALL_SKINS.map(skin => ({
    ...skin,
    unlocked:
      skin.price === 0 && skin.unlockScore == null && !skin.premium
        ? true
        : (skin.productId !== '' && isProductPurchased(skin.productId))
          || (!skin.premium && skin.unlockScore != null && bestHeight >= skin.unlockScore),
  }));
}

// ── 스킨 에셋 디렉토리 조회 ──────────────────────────────────
export function getSkinSpriteDir(skinId: string): string | undefined {
  const skin = ALL_SKINS.find(s => s.id === skinId);
  return skin?.spriteDir;
}

// ── 스킨 해금 정보 조회 ───────────────────────────────────────
export function getSkinUnlockInfo(skinId: string): {
  unlockScore?: number;
  premium?: boolean;
  bestHeight: number;
} {
  const skin = ALL_SKINS.find(s => s.id === skinId);
  const bestHeight = parseInt(localStorage.getItem('bh_bestHeight') ?? '0', 10);
  return {
    unlockScore: skin?.unlockScore,
    premium: skin?.premium,
    bestHeight,
  };
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
