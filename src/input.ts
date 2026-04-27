import { GameState } from './types';
import { isShopOpen, handleShopTap, handleShopWheel, handleShopPointerDown, handleShopPointerMove, handleShopPointerUp } from './ui/shop-screen';

export interface InputCallbacks {
  readonly state: GameState;
  readonly w: number;
  initAudio(): void;
  onStartGame(): void;
  onGameOverTap(x: number, y: number): void;
  onGameOverDrag(dy: number): void;
  onGameOverWheel(dy: number): void;
  onTouchStart(x: number): void;
  onTouchMove(x: number): void;
  onTouchEnd(): void;
}

const DRAG_THRESHOLD = 8; // px — 이 이상 움직이면 드래그로 판정

export class InputManager {
  constructor(canvas: HTMLCanvasElement, cb: InputCallbacks) {
    let dragStartX = 0;
    let dragStartY = 0;
    let isDragging = false;
    let lastDragY = 0;

    // ── Touch ──────────────────────────────────────────────────
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
      if (cb.state === GameState.GAME_OVER) {
        dragStartX = t.clientX;
        dragStartY = t.clientY;
        lastDragY = t.clientY;
        isDragging = false;
        return;
      }
      cb.onTouchStart(t.clientX);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (isShopOpen()) {
        const t = e.touches[0];
        handleShopPointerMove(t.clientX, t.clientY);
        return;
      }
      if (cb.state === GameState.GAME_OVER) {
        const t = e.touches[0];
        const totalDy = Math.abs(t.clientY - dragStartY);
        if (!isDragging && totalDy > DRAG_THRESHOLD) isDragging = true;
        if (isDragging) {
          cb.onGameOverDrag(lastDragY - t.clientY);
          lastDragY = t.clientY;
        }
        return;
      }
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.touches[0].clientX);
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (isShopOpen()) { handleShopPointerUp(); return; }
      if (cb.state === GameState.GAME_OVER) {
        if (!isDragging) {
          cb.onGameOverTap(dragStartX, dragStartY);
        }
        isDragging = false;
        return;
      }
      cb.onTouchEnd();
    });

    // ── Mouse ──────────────────────────────────────────────────
    canvas.addEventListener('mousedown', (e) => {
      cb.initAudio();
      if (isShopOpen()) {
        handleShopPointerDown(e.clientX, e.clientY);
        handleShopTap(e.clientX, e.clientY);
        return;
      }
      if (cb.state === GameState.START) { cb.onStartGame(); return; }
      if (cb.state === GameState.GAME_OVER) {
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        lastDragY = e.clientY;
        isDragging = false;
        return;
      }
      cb.onTouchStart(e.clientX);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (isShopOpen()) { handleShopPointerMove(e.clientX, e.clientY); return; }
      if (cb.state === GameState.GAME_OVER && e.buttons === 1) {
        const totalDy = Math.abs(e.clientY - dragStartY);
        if (!isDragging && totalDy > DRAG_THRESHOLD) isDragging = true;
        if (isDragging) {
          cb.onGameOverDrag(lastDragY - e.clientY);
          lastDragY = e.clientY;
        }
        return;
      }
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(e.clientX);
    });

    canvas.addEventListener('mouseup', () => {
      if (isShopOpen()) { handleShopPointerUp(); return; }
      if (cb.state === GameState.GAME_OVER) {
        if (!isDragging) {
          cb.onGameOverTap(dragStartX, dragStartY);
        }
        isDragging = false;
        return;
      }
      cb.onTouchEnd();
    });

    canvas.addEventListener('wheel', (e) => {
      if (isShopOpen()) {
        e.preventDefault();
        handleShopWheel(e.deltaY);
        return;
      }
      if (cb.state === GameState.GAME_OVER) {
        e.preventDefault();
        cb.onGameOverWheel(e.deltaY);
        return;
      }
    }, { passive: false });
  }
}
