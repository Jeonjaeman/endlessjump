declare module 'admob-plus-capacitor' {
  export const AdMob: any;
  export class BannerAd { constructor(opts: any); show(): Promise<void>; hide(): Promise<void>; }
  export class InterstitialAd { constructor(opts: any); load(): Promise<void>; show(): Promise<void>; }
  export class RewardedAd { constructor(opts: any); load(): Promise<void>; show(): Promise<any>; }
}
