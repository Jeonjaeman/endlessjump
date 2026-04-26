import { GameState } from './types';
import { isShopOpen, handleShopTap } from './ui/shop-screen';

export interface InputCallbacks {
  readonly state: GameState;
  readonly w: number;
  initAudio(): void;
  onStartGame(): void;
  onGameOverTap(x: number, y: number): void;
  onTouchStart(x: number): void;
  onTouchMove(x: number): void;
  onTouchEnd(): void;
}

export class InputManager {
  constructor(canvas: HTMLCanvasElement, cb: InputCallbacks) {
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      cb.initAudio();
      const t = e.touches[0];
      if (isShopOpen()) { handleShopTap(t.clientX, t.clientY); return; }
      if (cb.state === GameState.START) { cb.onStartGame(); return; }
      if (cb.state === GameState.GAME_OVER) { cb.onGameOverTap(t.clientX, t.clientY); return; }
      cb.onTouchStart(t.clientX);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.touches[0].clientX);
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      cb.onTouchEnd();
    });

    canvas.addEventListener('mousedown', (e) => {
      cb.initAudio();
      if (isShopOpen()) { handleShopTap(e.clientX, e.clientY); return; }
      if (cb.state === GameState.START) { cb.onStartGame(); return; }
      if (cb.state === GameState.GAME_OVER) { cb.onGameOverTap(e.clientX, e.clientY); return; }
      cb.onTouchStart(e.clientX);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.clientX);
    });

    canvas.addEventListener('mouseup', () => { cb.onTouchEnd(); });
  }
}
