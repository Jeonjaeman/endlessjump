export const GameState = { START: 0, PLAYING: 1, GAME_OVER: 2 } as const;
export type GameState = (typeof GameState)[keyof typeof GameState];

export const CarrotType = { NORMAL: 0, SPECIAL: 1, ROTTEN: 2 } as const;
export type CarrotType = (typeof CarrotType)[keyof typeof CarrotType];

export interface Carrot {
  x: number;
  y: number;
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
  width: number;
  speed: number;
  opacity: number;
}
