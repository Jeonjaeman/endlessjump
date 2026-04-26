import { GameState } from './types';
import { isShopOpen, handleShopTap, handleShopWheel, handleShopPointerDown, handleShopPointerMove, handleShopPointerUp } from './ui/shop-screen';

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
      if (isShopOpen()) {
        handleShopPointerDown(t.clientX, t.clientY);
        handleShopTap(t.clientX, t.clientY);
        return;
      }
      if (cb.state === GameState.START) { cb.onStartGame(); return; }
      if (cb.state === GameState.GAME_OVER) { cb.onGameOverTap(t.clientX, t.clientY); return; }
      cb.onTouchStart(t.clientX);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (isShopOpen()) {
        const t = e.touches[0];
        handleShopPointerMove(t.clientX, t.clientY);
        return;
      }
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.touches[0].clientX);
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (isShopOpen()) { handleShopPointerUp(); return; }
      cb.onTouchEnd();
    });

    canvas.addEventListener('mousedown', (e) => {
      cb.initAudio();
      if (isShopOpen()) {
        handleShopPointerDown(e.clientX, e.clientY);
        handleShopTap(e.clientX, e.clientY);
        return;
      }
      if (cb.state === GameState.START) { cb.onStartGame(); return; }
      if (cb.state === GameState.GAME_OVER) { cb.onGameOverTap(e.clientX, e.clientY); return; }
      cb.onTouchStart(e.clientX);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (isShopOpen()) { handleShopPointerMove(e.clientX, e.clientY); return; }
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.clientX);
    });

    canvas.addEventListener('mouseup', () => {
      if (isShopOpen()) { handleShopPointerUp(); return; }
      cb.onTouchEnd();
    });

    canvas.addEventListener('wheel', (e) => {
      if (isShopOpen()) {
        e.preventDefault();
        handleShopWheel(e.deltaY);
      }
    }, { passive: false });
  }
}
