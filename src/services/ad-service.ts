/**
 * AdMob 광고 서비스 (배너 + 리워드)
 */

import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

// -- AdMob Ad IDs --
const BANNER_ID = 'ca-app-pub-7981513411030364/4476498218';
const REWARD_ID = 'ca-app-pub-7981513411030364/9888712896';

// -- Dynamic import --
let AdMobPlugin: any = null;
let BannerAdEvents: any = null;
let RewardAdEvents: any = null;
let BannerAdSizeEnum: any = null;
let BannerAdPositionEnum: any = null;

async function loadAdMobPlugin(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const mod = await import('@capacitor-community/admob');
    AdMobPlugin = mod.AdMob;
    BannerAdEvents = mod.BannerAdPluginEvents;
    RewardAdEvents = mod.RewardAdPluginEvents;
    BannerAdSizeEnum = mod.BannerAdSize;
    BannerAdPositionEnum = mod.BannerAdPosition;
    return true;
  } catch {
    console.warn('[AdService] AdMob 플러그인 로드 실패');
    return false;
  }
}

// -- State --
let initialized = false;
let rewardedReady = false;
let bannerShowing = false;

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
    preloadRewarded();
  } catch (e) {
    console.warn('[AdService] AdMob 초기화 실패:', e);
  }
}

function setupEventListeners(): void {
  if (!AdMobPlugin || !RewardAdEvents) return;

  AdMobPlugin.addListener(RewardAdEvents.Loaded, () => { rewardedReady = true; });
  AdMobPlugin.addListener(RewardAdEvents.FailedToLoad, () => { rewardedReady = false; });
}

// -- Banner (상점 화면 전용) --
export async function showBanner(): Promise<void> {
  if (!initialized || !AdMobPlugin || bannerShowing || adsRemoved) return;
  try {
    await AdMobPlugin.showBanner({
      adId: BANNER_ID,
      adSize: BannerAdSizeEnum?.BANNER ?? 'BANNER',
      position: BannerAdPositionEnum?.BOTTOM_CENTER ?? 'BOTTOM_CENTER',
      margin: 0,
    });
    bannerShowing = true;
  } catch (e) {
    console.warn('[AdService] 배너 표시 실패:', e);
  }
}

export async function hideBanner(): Promise<void> {
  if (!initialized || !AdMobPlugin || !bannerShowing) return;
  try {
    await AdMobPlugin.hideBanner();
    bannerShowing = false;
  } catch {
    bannerShowing = false;
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
