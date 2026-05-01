/**
 * 인앱 결제 래퍼 서비스 (RevenueCat / @capgo/capacitor-purchases)
 *
 * - 광고 제거 (일회성 구매)
 * - 스킨 팩 (일회성 구매)
 * - 웹 브라우저에서는 모든 IAP 비활성 (graceful fallback)
 * - 구매 상태는 localStorage + RevenueCat 서버로 동기화
 */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { setAdsRemoved } from './ad-service';
import { getSupabaseUserEmail } from './auth';
import type { IAPProduct } from '../types';

const DEV_EMAIL = 'jeonjaeman9668@gmail.com';

// ── 플랫폼 감지 ──────────────────────────────────────────────
const isNative = Capacitor.isNativePlatform();

// ── Google Play Billing 네이티브 플러그인 ─────────────────────
interface BillingPlugin {
  getProducts(opts: { productIds: string[] }): Promise<{ products: Array<{ productId: string; name: string; description: string; price: string; priceMicros: number; currencyCode: string }> }>;
  purchase(opts: { productId: string }): Promise<{ purchasedProducts: string[] }>;
  restorePurchases(): Promise<{ purchasedProducts: string[] }>;
}

const Billing = registerPlugin<BillingPlugin>('Billing');

// ── 상품 ID 상수 ─────────────────────────────────────────────
export const PRODUCT_REMOVE_ADS = 'endlessjump_remove_ads';
export const PRODUCT_SKIN_PACK_PINK = 'endlessjump_skin_pink';
export const PRODUCT_SKIN_PACK_GOLDEN = 'endlessjump_skin_golden';
export const PRODUCT_SKIN_PACK_SHADOW = 'endlessjump_skin_shadow';
export const PRODUCT_SKIN_PACK_SHADOW_NINJA = 'endlessjump_skin_shadow_ninja';
export const PRODUCT_SKIN_PACK_OCEAN_PIRATE = 'endlessjump_skin_ocean_pirate';
export const PRODUCT_SKIN_PACK_METAL_HERO = 'endlessjump_skin_metal_hero';
export const PRODUCT_SKIN_PACK_THUNDER_GUARDIAN = 'endlessjump_skin_thunder_guardian';
export const PRODUCT_SKIN_PACK_JUNGLE_KING = 'endlessjump_skin_jungle_king';
export const PRODUCT_SKIN_PACK_CLAW_FIGHTER = 'endlessjump_skin_claw_fighter';
export const PRODUCT_SKIN_PACK_SPACE_EXPLORER = 'endlessjump_skin_space_explorer';

const ALL_SKIN_PRODUCTS = [
  PRODUCT_SKIN_PACK_PINK, PRODUCT_SKIN_PACK_GOLDEN, PRODUCT_SKIN_PACK_SHADOW,
  PRODUCT_SKIN_PACK_SHADOW_NINJA, PRODUCT_SKIN_PACK_OCEAN_PIRATE,
  PRODUCT_SKIN_PACK_METAL_HERO, PRODUCT_SKIN_PACK_THUNDER_GUARDIAN,
  PRODUCT_SKIN_PACK_JUNGLE_KING, PRODUCT_SKIN_PACK_CLAW_FIGHTER,
  PRODUCT_SKIN_PACK_SPACE_EXPLORER,
];

// ── 상품 목록 (표시용 기본값 — 실제 가격은 스토어에서 가져옴) ─
const DEFAULT_PRODUCTS: IAPProduct[] = [
  {
    id: PRODUCT_REMOVE_ADS,
    name: '광고 제거',
    description: '모든 광고를 영구적으로 제거합니다',
    price: '₩5,500',
    type: 'non_consumable',
  },
  {
    id: PRODUCT_SKIN_PACK_PINK,
    name: '핑크 버니 스킨',
    description: '귀여운 핑크 토끼로 변신!',
    price: '₩1,100',
    type: 'non_consumable',
  },
  {
    id: PRODUCT_SKIN_PACK_GOLDEN,
    name: '골든 버니 스킨',
    description: '반짝이는 황금 토끼!',
    price: '₩2,200',
    type: 'non_consumable',
  },
  {
    id: PRODUCT_SKIN_PACK_SHADOW,
    name: '섀도우 버니 스킨',
    description: '신비로운 어둠의 토끼!',
    price: '₩2,200',
    type: 'non_consumable',
  },
];

// ── 상태 ────────────────────────────────────────────────────
let initialized = false;
let purchasedProducts: Set<string> = new Set();

// localStorage 키
const STORAGE_KEY = 'bh_purchases';

// ── localStorage에서 구매 상태 복원 ──────────────────────────
function loadPurchases(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const arr = JSON.parse(stored) as string[];
      purchasedProducts = new Set(arr);
    }
  } catch {
    purchasedProducts = new Set();
  }
}

function savePurchases(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...purchasedProducts]));
  } catch {
    // localStorage 접근 실패 시 무시
  }
}

// ── 초기화 ──────────────────────────────────────────────────
export async function initIAP(): Promise<void> {
  // 항상 로컬 구매 상태 복원 (웹에서도)
  loadPurchases();

  // 광고 제거 상태 복원
  if (purchasedProducts.has(PRODUCT_REMOVE_ADS)) {
    setAdsRemoved(true);
  }

  if (!isNative) {
    console.log('[IAPService] 웹 환경 — IAP 비활성');
    return;
  }

  try {
    // Google Play에서 기존 구매 복원
    const { purchasedProducts: restored } = await Billing.restorePurchases();
    for (const pid of restored) {
      purchasedProducts.add(pid);
      if (pid === PRODUCT_REMOVE_ADS) setAdsRemoved(true);
    }
    savePurchases();
    initialized = true;
    console.log('[IAPService] Google Play Billing 초기화 완료');
  } catch (e) {
    console.warn('[IAPService] Billing 초기화 실패:', e);
    initialized = true; // 실패해도 구매 시도는 가능하게
  }
}

// ── 상품 목록 조회 ──────────────────────────────────────────
export function getProducts(): IAPProduct[] {
  return DEFAULT_PRODUCTS;
}

// ── 구매 처리 ───────────────────────────────────────────────
export async function purchaseProduct(productId: string): Promise<boolean> {
  if (!isNative || !initialized) {
    console.warn('[IAPService] IAP를 사용할 수 없는 환경입니다.');
    return false;
  }

  try {
    const { purchasedProducts: bought } = await Billing.purchase({ productId });

    for (const pid of bought) {
      purchasedProducts.add(pid);
      if (pid === PRODUCT_REMOVE_ADS) setAdsRemoved(true);
    }
    savePurchases();

    console.log(`[IAPService] 구매 완료: ${productId}`);
    return true;
  } catch (e: any) {
    if (e?.message?.includes('USER_CANCELED')) {
      console.log('[IAPService] 사용자가 구매를 취소했습니다.');
      return false;
    }
    console.warn('[IAPService] 구매 실패:', e);
    return false;
  }
}

// ── 구매 복원 ───────────────────────────────────────────────
export async function restorePurchases(): Promise<boolean> {
  if (!isNative || !initialized) {
    console.warn('[IAPService] IAP를 사용할 수 없는 환경입니다.');
    return false;
  }

  try {
    const { purchasedProducts: restored } = await Billing.restorePurchases();

    let hasNew = false;
    for (const pid of restored) {
      if (!purchasedProducts.has(pid)) hasNew = true;
      purchasedProducts.add(pid);
      if (pid === PRODUCT_REMOVE_ADS) setAdsRemoved(true);
    }
    savePurchases();

    console.log(`[IAPService] 구매 복원 완료 (복원됨: ${hasNew})`);
    return hasNew;
  } catch (e) {
    console.warn('[IAPService] 구매 복원 실패:', e);
    return false;
  }
}

// ── 구매 상태 확인 ──────────────────────────────────────────
export function isProductPurchased(productId: string): boolean {
  // 개발자 계정은 모든 스킨 무료 (광고 제거 제외)
  if (productId !== PRODUCT_REMOVE_ADS && ALL_SKIN_PRODUCTS.includes(productId)) {
    if (getSupabaseUserEmail() === DEV_EMAIL) return true;
  }
  return purchasedProducts.has(productId);
}

export function isAdsRemoved(): boolean {
  return purchasedProducts.has(PRODUCT_REMOVE_ADS);
}

// ── 디버그용: 웹에서 구매 시뮬레이션 ────────────────────────
export function debugPurchase(productId: string): void {
  if (isNative) return; // 네이티브에서는 실제 결제만 허용
  purchasedProducts.add(productId);
  savePurchases();
  if (productId === PRODUCT_REMOVE_ADS) {
    setAdsRemoved(true);
  }
  console.log(`[IAPService] 디버그 구매: ${productId}`);
}
