/**
 * AdMob 광고 서비스 (전면 + 리워드만, 배너 없음)
 */

import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// -- AdMob Ad IDs --
const INTERSTITIAL_ID = 'ca-app-pub-7981513411030364/7579597996';
const REWARD_ID = 'ca-app-pub-7981513411030364/9888712896';

// -- Dynamic import --
let AdMobPlugin: any = null;
let InterstitialAdEvents: any = null;
let RewardAdEvents: any = null;

async function loadAdMobPlugin(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const mod = await import('@capacitor-community/admob');
    AdMobPlugin = mod.AdMob;
    InterstitialAdEvents = mod.InterstitialAdPluginEvents;
    RewardAdEvents = mod.RewardAdPluginEvents;
    return true;
  } catch {
    console.warn('[AdService] AdMob 플러그인 로드 실패');
    return false;
  }
}

// -- State --
let initialized = false;
let interstitialReady = false;
let rewardedReady = false;
let gameOverCount = 0;
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
    setupEventListeners();
    preloadInterstitial();
    preloadRewarded();
  } catch (e) {
    console.warn('[AdService] AdMob 초기화 실패:', e);
  }
}

function setupEventListeners(): void {
  if (!AdMobPlugin || !InterstitialAdEvents || !RewardAdEvents) return;

  AdMobPlugin.addListener(InterstitialAdEvents.Loaded, () => { interstitialReady = true; });
  AdMobPlugin.addListener(InterstitialAdEvents.FailedToLoad, () => { interstitialReady = false; });
  AdMobPlugin.addListener(RewardAdEvents.Loaded, () => { rewardedReady = true; });
  AdMobPlugin.addListener(RewardAdEvents.FailedToLoad, () => { rewardedReady = false; });
}

// -- Banner (비활성) --
export async function showBanner(): Promise<void> { /* 배너 미사용 */ }
export async function hideBanner(): Promise<void> { /* 배너 미사용 */ }

// -- Interstitial --
async function preloadInterstitial(): Promise<void> {
  if (!initialized || !AdMobPlugin) return;
  try {
    await AdMobPlugin.prepareInterstitial({ adId: INTERSTITIAL_ID });
  } catch {
    interstitialReady = false;
  }
}

export async function showInterstitialOnGameOver(): Promise<boolean> {
  gameOverCount++;
  if (gameOverCount % INTERSTITIAL_INTERVAL !== 0) return false;
  if (!initialized || !interstitialReady || !AdMobPlugin) return false;

  try {
    await AdMobPlugin.showInterstitial();
    interstitialReady = false;
    preloadInterstitial();
    return true;
  } catch {
    interstitialReady = false;
    preloadInterstitial();
    return false;
  }
}

// -- Rewarded --
async function preloadRewarded(): Promise<void> {
  if (!initialized || !AdMobPlugin) return;
  try {
    await AdMobPlugin.prepareRewardVideoAd({ adId: REWARD_ID });
  } catch {
    rewardedReady = false;
  }
}

export function isRewardedReady(): boolean {
  return initialized && rewardedReady;
}

export async function showRewardedAd(): Promise<boolean> {
  if (!initialized || !rewardedReady || !AdMobPlugin) return false;

  try {
    const rewardPromise = new Promise<boolean>((resolve) => {
      let rewarded = false;

      const onRewarded = AdMobPlugin.addListener(RewardAdEvents.Rewarded, () => {
        rewarded = true;
        onRewarded.then((h: any) => h?.remove?.());
      });

      const onDismissed = AdMobPlugin.addListener(RewardAdEvents.Dismissed, () => {
        onDismissed.then((h: any) => h?.remove?.());
        setTimeout(() => resolve(rewarded), 200);
      });
    });

    await AdMobPlugin.showRewardVideoAd();
    const result = await rewardPromise;
    rewardedReady = false;
    preloadRewarded();
    return result;
  } catch {
    rewardedReady = false;
    preloadRewarded();
    return false;
  }
}

// -- Ad Removal --
let adsRemoved = false;

export function setAdsRemoved(removed: boolean): void {
  adsRemoved = removed;
}

export function areAdsRemoved(): boolean {
  return adsRemoved;
}
