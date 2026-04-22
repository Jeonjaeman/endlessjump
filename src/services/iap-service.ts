/**
 * 인앱 결제 래퍼 서비스 (RevenueCat / @capgo/capacitor-purchases)
 *
 * - 광고 제거 (일회성 구매)
 * - 스킨 팩 (일회성 구매)
 * - 웹 브라우저에서는 모든 IAP 비활성 (graceful fallback)
 * - 구매 상태는 localStorage + RevenueCat 서버로 동기화
 */

import { Capacitor } from '@capacitor/core';
import { setAdsRemoved } from './ad-service';
import type { IAPProduct } from '../types';

// ── 플랫폼 감지 ──────────────────────────────────────────────
const isNative = Capacitor.isNativePlatform();

// ── RevenueCat API Key (플레이스홀더) ────────────────────────
const REVENUECAT_API_KEY = 'YOUR_REVENUECAT_API_KEY';

// ── 상품 ID 상수 ─────────────────────────────────────────────
export const PRODUCT_REMOVE_ADS = 'bunnyhop_remove_ads';
export const PRODUCT_SKIN_PACK_PINK = 'bunnyhop_skin_pink';
export const PRODUCT_SKIN_PACK_GOLDEN = 'bunnyhop_skin_golden';
export const PRODUCT_SKIN_PACK_SHADOW = 'bunnyhop_skin_shadow';

// ── 상품 목록 (표시용 기본값 — 실제 가격은 스토어에서 가져옴) ─
const DEFAULT_PRODUCTS: IAPProduct[] = [
  {
    id: PRODUCT_REMOVE_ADS,
    name: '광고 제거',
    description: '모든 광고를 영구적으로 제거합니다',
    price: '₩1,100',
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

// ── RevenueCat 동적 import ───────────────────────────────────
let Purchases: any = null;

async function loadPurchasesPlugin(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const mod = await import('@capgo/capacitor-purchases');
    Purchases = mod.Purchases;
    return true;
  } catch {
    console.warn('[IAPService] @capgo/capacitor-purchases를 로드할 수 없습니다.');
    return false;
  }
}

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

  const loaded = await loadPurchasesPlugin();
  if (!loaded || !Purchases) return;

  try {
    await Purchases.configure({
      apiKey: REVENUECAT_API_KEY,
    });
    initialized = true;
    console.log('[IAPService] RevenueCat 초기화 완료');

    // 서버에서 구매 상태 동기화
    await syncPurchases();
  } catch (e) {
    console.warn('[IAPService] RevenueCat 초기화 실패:', e);
  }
}

// ── 서버에서 구매 상태 동기화 ────────────────────────────────
async function syncPurchases(): Promise<void> {
  if (!initialized || !Purchases) return;

  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    const entitlements = customerInfo?.entitlements?.active || {};

    // 광고 제거
    if (entitlements['remove_ads'] || entitlements[PRODUCT_REMOVE_ADS]) {
      purchasedProducts.add(PRODUCT_REMOVE_ADS);
      setAdsRemoved(true);
    }

    // 스킨 팩들
    for (const skinId of [PRODUCT_SKIN_PACK_PINK, PRODUCT_SKIN_PACK_GOLDEN, PRODUCT_SKIN_PACK_SHADOW]) {
      if (entitlements[skinId]) {
        purchasedProducts.add(skinId);
      }
    }

    savePurchases();
  } catch (e) {
    console.warn('[IAPService] 구매 상태 동기화 실패:', e);
  }
}

// ── 상품 목록 조회 ──────────────────────────────────────────
export function getProducts(): IAPProduct[] {
  return DEFAULT_PRODUCTS;
}

// ── 구매 처리 ───────────────────────────────────────────────
export async function purchaseProduct(productId: string): Promise<boolean> {
  if (!isNative || !initialized || !Purchases) {
    console.warn('[IAPService] IAP를 사용할 수 없는 환경입니다.');
    return false;
  }

  try {
    const { customerInfo } = await Purchases.purchaseProduct({
      productIdentifier: productId,
    });

    // 구매 성공 처리
    purchasedProducts.add(productId);
    savePurchases();

    // 광고 제거 구매 시 즉시 반영
    if (productId === PRODUCT_REMOVE_ADS) {
      setAdsRemoved(true);
    }

    console.log(`[IAPService] 구매 완료: ${productId}`);
    return true;
  } catch (e: any) {
    // 사용자가 취소한 경우
    if (e?.code === 'PURCHASE_CANCELLED' || e?.userCancelled) {
      console.log('[IAPService] 사용자가 구매를 취소했습니다.');
      return false;
    }
    console.warn('[IAPService] 구매 실패:', e);
    return false;
  }
}

// ── 구매 복원 ───────────────────────────────────────────────
export async function restorePurchases(): Promise<boolean> {
  if (!isNative || !initialized || !Purchases) {
    console.warn('[IAPService] IAP를 사용할 수 없는 환경입니다.');
    return false;
  }

  try {
    const { customerInfo } = await Purchases.restorePurchases();
    const entitlements = customerInfo?.entitlements?.active || {};

    let restored = false;

    if (entitlements['remove_ads'] || entitlements[PRODUCT_REMOVE_ADS]) {
      purchasedProducts.add(PRODUCT_REMOVE_ADS);
      setAdsRemoved(true);
      restored = true;
    }

    for (const skinId of [PRODUCT_SKIN_PACK_PINK, PRODUCT_SKIN_PACK_GOLDEN, PRODUCT_SKIN_PACK_SHADOW]) {
      if (entitlements[skinId]) {
        purchasedProducts.add(skinId);
        restored = true;
      }
    }

    savePurchases();
    console.log(`[IAPService] 구매 복원 완료 (복원됨: ${restored})`);
    return restored;
  } catch (e) {
    console.warn('[IAPService] 구매 복원 실패:', e);
    return false;
  }
}

// ── 구매 상태 확인 ──────────────────────────────────────────
export function isProductPurchased(productId: string): boolean {
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
