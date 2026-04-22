export const GameState = { START: 0, PLAYING: 1, GAME_OVER: 2 } as const;
export type GameState = (typeof GameState)[keyof typeof GameState];

export const CarrotType = { NORMAL: 0, SPECIAL: 1 } as const;
export type CarrotType = (typeof CarrotType)[keyof typeof CarrotType];

export const BunnyPose = { IDLE: 0, JUMPING: 1, FALLING: 2 } as const;
export type BunnyPose = (typeof BunnyPose)[keyof typeof BunnyPose];

export interface Carrot {
  x: number;
  y: number;
  vy: number;
  type: CarrotType;
  eaten: boolean;
  radius: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  radius: number;
}

export interface Cloud {
  x: number;
  y: number;
  z: number;
  width: number;
  speed: number;
  opacity: number;
}

export interface ScorePopup {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  scale: number;
  color: string;
}

export interface RankEntry {
  rank: number;
  score: number;
  height: number;
  nickname: string;
  country_code: string;
  is_me: boolean;
}

// -- Phase 5: IAP / Skin / Achievement --

export interface SkinColors {
  body: string;
  bodyLight: string;
  bodyDark: string;
  belly: string;
  earInner: string;
  nose: string;
  cheek: string;
}

export interface BunnySkin {
  id: string;
  name: string;
  description: string;
  colors: SkinColors;
  price: number;
  productId: string;
  unlocked: boolean;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  target: number;
  current: number;
  completed: boolean;
  reward: number;
  type: 'daily' | 'permanent';
}

export interface IAPProduct {
  id: string;
  name: string;
  description: string;
  price: string;
  type: 'non_consumable';
}
