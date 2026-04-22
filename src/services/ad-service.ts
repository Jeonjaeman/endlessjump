/**
 * AdMob ad wrapper service
 *
 * - Uses @capacitor-community/admob plugin
 * - Manages banner / interstitial / rewarded ads
 * - Graceful fallback on web browsers (all ads disabled)
 * - Test mode / production mode separation
 */

import { Capacitor } from '@capacitor/core';

// -- Platform detection --
const isNative = Capacitor.isNativePlatform();

// -- AdMob Ad IDs (placeholders - replace with real IDs) --
// Google-provided test ad IDs (Android)
const TEST_BANNER_ID = 'ca-app-pub-3940256099942544/6300978111';
const TEST_INTERSTITIAL_ID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_REWARD_ID = 'ca-app-pub-3940256099942544/5224354917';

// Production ad IDs - replace with real AdMob console IDs
const PROD_BANNER_ID = 'ca-app-pub-xxxxx/banner';
const PROD_INTERSTITIAL_ID = 'ca-app-pub-xxxxx/interstitial';
const PROD_REWARD_ID = 'ca-app-pub-xxxxx/reward';

// Test mode flag (set to false for production builds)
const IS_TEST_MODE = true;

function getBannerId(): string {
  return IS_TEST_MODE ? TEST_BANNER_ID : PROD_BANNER_ID;
}
function getInterstitialId(): string {
  return IS_TEST_MODE ? TEST_INTERSTITIAL_ID : PROD_INTERSTITIAL_ID;
}
function getRewardId(): string {
  return IS_TEST_MODE ? TEST_REWARD_ID : PROD_REWARD_ID;
}

// -- Dynamic import for @capacitor-community/admob --
// Ignore import failures on web
let AdMobPlugin: any = null;
let BannerAdSizeEnum: any = null;
let BannerAdPositionEnum: any = null;
let InterstitialAdEvents: any = null;
let RewardAdEvents: any = null;

async function loadAdMobPlugin(): Promise<boolean> {
  // AdMob 플러그인 일시 비활성화 — 앱 안정성 확보 후 재활성화
  console.log('[AdService] AdMob 플러그인 비활성화 (스텁 모드)');
  return false;
}

// -- State --
let initialized = false;
let bannerVisible = false;
let interstitialReady = false;
let rewardedReady = false;
let gameOverCount = 0;

// Show interstitial every N game overs
const INTERSTITIAL_INTERVAL = 3;

// -- Initialization --
export async function initAds(): Promise<void> {
  if (initialized || !isNative) return;

  const loaded = await loadAdMobPlugin();
  if (!loaded || !AdMobPlugin) return;

  try {
    await AdMobPlugin.initialize({
      requestTrackingAuthorization: false,
    });
    initialized = true;
    console.log('[AdService] AdMob initialized');

    // Register event listeners
    setupEventListeners();

    // Preload interstitial
    preloadInterstitial();
    // Preload rewarded
    preloadRewarded();
  } catch (e) {
    console.warn('[AdService] AdMob init failed:', e);
  }
}

// -- Event Listeners --
function setupEventListeners(): void {
  if (!AdMobPlugin || !InterstitialAdEvents || !RewardAdEvents) return;

  AdMobPlugin.addListener(InterstitialAdEvents.Loaded, () => {
    interstitialReady = true;
    console.log('[AdService] Interstitial loaded');
  });

  AdMobPlugin.addListener(InterstitialAdEvents.FailedToLoad, () => {
    interstitialReady = false;
    console.warn('[AdService] Interstitial failed to load');
  });

  AdMobPlugin.addListener(RewardAdEvents.Loaded, () => {
    rewardedReady = true;
    console.log('[AdService] Rewarded ad loaded');
  });

  AdMobPlugin.addListener(RewardAdEvents.FailedToLoad, () => {
    rewardedReady = false;
    console.warn('[AdService] Rewarded ad failed to load');
  });
}

// -- Banner Ad --
export async function showBanner(): Promise<void> {
  if (!initialized || !AdMobPlugin || bannerVisible) return;

  try {
    await AdMobPlugin.showBanner({
      adId: getBannerId(),
      adSize: BannerAdSizeEnum.BANNER,
      position: BannerAdPositionEnum.BOTTOM_CENTER,
    });
    bannerVisible = true;
    console.log('[AdService] Banner shown');
  } catch (e) {
    console.warn('[AdService] Banner show failed:', e);
  }
}

export async function hideBanner(): Promise<void> {
  if (!bannerVisible || !AdMobPlugin) return;
  try {
    await AdMobPlugin.hideBanner();
    bannerVisible = false;
  } catch (e) {
    console.warn('[AdService] Banner hide failed:', e);
  }
}

// -- Interstitial Ad --
async function preloadInterstitial(): Promise<void> {
  if (!initialized || !AdMobPlugin) return;
  try {
    await AdMobPlugin.prepareInterstitial({
      adId: getInterstitialId(),
    });
    // interstitialReady is set by the event listener
  } catch (e) {
    console.warn('[AdService] Interstitial prepare failed:', e);
    interstitialReady = false;
  }
}

/**
 * Called on game over - shows interstitial every INTERSTITIAL_INTERVAL times
 * @returns true if ad was shown
 */
export async function showInterstitialOnGameOver(): Promise<boolean> {
  gameOverCount++;
  if (gameOverCount % INTERSTITIAL_INTERVAL !== 0) return false;
  if (!initialized || !interstitialReady || !AdMobPlugin) return false;

  try {
    await AdMobPlugin.showInterstitial();
    interstitialReady = false;
    preloadInterstitial();
    console.log('[AdService] Interstitial shown');
    return true;
  } catch (e) {
    console.warn('[AdService] Interstitial show failed:', e);
    interstitialReady = false;
    preloadInterstitial();
    return false;
  }
}

// -- Rewarded Ad --
async function preloadRewarded(): Promise<void> {
  if (!initialized || !AdMobPlugin) return;
  try {
    await AdMobPlugin.prepareRewardVideoAd({
      adId: getRewardId(),
    });
    // rewardedReady is set by the event listener
  } catch (e) {
    console.warn('[AdService] Rewarded ad prepare failed:', e);
    rewardedReady = false;
  }
}

/**
 * Check if rewarded ad is ready
 */
export function isRewardedReady(): boolean {
  return initialized && rewardedReady;
}

/**
 * Show rewarded ad - returns true if user completed viewing (allow revive)
 * Returns false on cancel/failure
 */
export async function showRewardedAd(): Promise<boolean> {
  if (!initialized || !rewardedReady || !AdMobPlugin) return false;

  try {
    const rewardPromise = new Promise<boolean>((resolve) => {
      let rewarded = false;

      const onRewarded = AdMobPlugin.addListener(
        RewardAdEvents.Rewarded,
        () => {
          rewarded = true;
          onRewarded.then((h: any) => h?.remove?.());
        },
      );

      const onDismissed = AdMobPlugin.addListener(
        RewardAdEvents.Dismissed,
        () => {
          onDismissed.then((h: any) => h?.remove?.());
          setTimeout(() => resolve(rewarded), 200);
        },
      );
    });

    await AdMobPlugin.showRewardVideoAd();
    const result = await rewardPromise;

    rewardedReady = false;
    preloadRewarded();

    if (result) {
      console.log('[AdService] Rewarded ad completed, granting reward');
    }
    return result;
  } catch (e) {
    console.warn('[AdService] Rewarded ad show failed:', e);
    rewardedReady = false;
    preloadRewarded();
    return false;
  }
}

// -- Ad Removal (reserved for Phase 5 IAP) --
let adsRemoved = false;

export function setAdsRemoved(removed: boolean): void {
  adsRemoved = removed;
  if (removed && bannerVisible) {
    hideBanner();
  }
}

export function areAdsRemoved(): boolean {
  return adsRemoved;
}
