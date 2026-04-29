import { GameState } from './types';
import { isShopOpen, handleShopTap, handleShopWheel, handleShopPointerDown, handleShopPointerMove, handleShopPointerUp } from './ui/shop-screen';

export interface InputCallbacks {
  readonly state: GameState;
  readonly w: number;
  initAudio(): void;
  onStartGame(): void;
  onStartTap(x: number, y: number): void;
  onGameOverTap(x: number, y: number): void;
  onGameOverDrag(dy: number): void;
  onGameOverWheel(dy: number): void;
  onTouchStart(x: number): void;
  onTouchMove(x: number): void;
  onTouchEnd(): void;
}

const DRAG_THRESHOLD = 20; // px — 이 이상 움직이면 드래그로 판정

export class InputManager {
  constructor(canvas: HTMLCanvasElement, cb: InputCallbacks) {
    let dragStartX = 0;
    let dragStartY = 0;
    let isDragging = false;
    let lastDragY = 0;
    let shopWasOpen = false;
    let lastTouchTime = 0; // 터치 후 마우스 이벤트 무시용

    // clientX/clientY → 캔버스 상대 좌표 변환
    const toCanvasX = (clientX: number) => {
      const rect = canvas.getBoundingClientRect();
      return clientX - rect.left;
    };
    const toCanvasY = (clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      return clientY - rect.top;
    };

    // ── Touch ──────────────────────────────────────────────────
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      lastTouchTime = Date.now();
      cb.initAudio();
      const t = e.touches[0];
      const cx = toCanvasX(t.clientX);
      const cy = toCanvasY(t.clientY);
      if (isShopOpen()) {
        shopWasOpen = true;
        handleShopPointerDown(cx, cy);
        handleShopTap(cx, cy);
        return;
      }
      shopWasOpen = false;
      if (cb.state === GameState.START) { cb.onStartTap(cx, cy); return; }
      if (cb.state === GameState.GAME_OVER) {
        dragStartX = cx;
        dragStartY = cy;
        lastDragY = cy;
        isDragging = false;
        return;
      }
      cb.onTouchStart(cx);
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const cx = toCanvasX(t.clientX);
      const cy = toCanvasY(t.clientY);
      if (isShopOpen()) {
        handleShopPointerMove(cx, cy);
        return;
      }
      if (cb.state === GameState.GAME_OVER) {
        const totalDy = Math.abs(cy - dragStartY);
        if (!isDragging && totalDy > DRAG_THRESHOLD) isDragging = true;
        if (isDragging) {
          cb.onGameOverDrag(lastDragY - cy);
          lastDragY = cy;
        }
        return;
      }
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(cx);
    });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (shopWasOpen || isShopOpen()) { shopWasOpen = false; handleShopPointerUp(); return; }
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
      if (Date.now() - lastTouchTime < 500) return; // 터치 직후 마우스 이벤트 무시
      cb.initAudio();
      const cx = toCanvasX(e.clientX);
      const cy = toCanvasY(e.clientY);
      if (isShopOpen()) {
        shopWasOpen = true;
        handleShopPointerDown(cx, cy);
        handleShopTap(cx, cy);
        return;
      }
      shopWasOpen = false;
      if (cb.state === GameState.START) { cb.onStartTap(cx, cy); return; }
      if (cb.state === GameState.GAME_OVER) {
        dragStartX = cx;
        dragStartY = cy;
        lastDragY = cy;
        isDragging = false;
        return;
      }
      cb.onTouchStart(cx);
    });

    canvas.addEventListener('mousemove', (e) => {
      if (Date.now() - lastTouchTime < 500) return;
      const cx = toCanvasX(e.clientX);
      const cy = toCanvasY(e.clientY);
      if (isShopOpen()) { handleShopPointerMove(cx, cy); return; }
      if (cb.state === GameState.GAME_OVER && e.buttons === 1) {
        const totalDy = Math.abs(cy - dragStartY);
        if (!isDragging && totalDy > DRAG_THRESHOLD) isDragging = true;
        if (isDragging) {
          cb.onGameOverDrag(lastDragY - cy);
          lastDragY = cy;
        }
        return;
      }
      if (cb.state !== GameState.PLAYING) return;
      cb.onTouchMove(cx);
    });

    canvas.addEventListener('mouseup', (e) => {
      if (Date.now() - lastTouchTime < 500) return;
      if (shopWasOpen || isShopOpen()) { shopWasOpen = false; handleShopPointerUp(); return; }
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
