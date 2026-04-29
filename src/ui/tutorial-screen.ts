/**
 * 첫 실행 튜토리얼 오버레이
 * - 손 모양이 화면을 터치하고 좌우로 이동하는 모션
 * - "손가락을 떼지 않고 당근을 먹고 점프하세요" 안내
 * - localStorage로 1회만 표시
 */

const TUTORIAL_KEY = 'bh_tutorial_shown';

export function shouldShowTutorial(): boolean {
  return !localStorage.getItem(TUTORIAL_KEY);
}

export function markTutorialShown(): void {
  localStorage.setItem(TUTORIAL_KEY, '1');
}

let tutorialActive = false;
let frameCount = 0;

export function startTutorial(): void {
  tutorialActive = true;
  frameCount = 0;
}

export function isTutorialActive(): boolean {
  return tutorialActive;
}

export function handleTutorialTap(): void {
  tutorialActive = false;
  markTutorialShown();
}

export function renderTutorial(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!tutorialActive) return;

  frameCount++;
  const t = frameCount / 60;

  // 어두운 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;

  // ── 상단 안내 텍스트 ──────────────────────────────────────
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('손가락을 떼지 않고', cx, h * 0.12);
  ctx.fillText('당근을 먹고 점프하세요!', cx, h * 0.12 + 30);

  // ── 중앙: 손 + 좌우 이동 모션 ─────────────────────────────
  const handCenterY = h * 0.38;
  const moveRange = Math.min(w * 0.22, 70);

  // 페이즈: 처음 1초는 내려오기, 이후 좌우 이동
  const enterDone = Math.min(t, 0.8);
  const handBaseY = handCenterY - 40 + enterDone * 50; // 위에서 내려옴
  const handX = t < 0.8 ? cx : cx + Math.sin((t - 0.8) * 2.0) * moveRange;

  // 터치 포인트 파동 (터치 후)
  if (t > 0.6) {
    const rippleT = (t - 0.6) % 1.5;
    const rippleAlpha = Math.max(0, 0.5 - rippleT * 0.4);
    const rippleR = 15 + rippleT * 35;
    ctx.strokeStyle = `rgba(255,107,53,${rippleAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(handX, handBaseY + 65, rippleR, 0, Math.PI * 2);
    ctx.stroke();

    // 두 번째 파동 (시차)
    if (rippleT > 0.5) {
      const r2 = rippleT - 0.5;
      const a2 = Math.max(0, 0.4 - r2 * 0.4);
      ctx.strokeStyle = `rgba(255,107,53,${a2})`;
      ctx.beginPath();
      ctx.arc(handX, handBaseY + 65, 15 + r2 * 35, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 터치 포인트 글로우
  if (t > 0.6) {
    const glow = Math.sin(t * 3) * 0.15 + 0.45;
    ctx.beginPath();
    ctx.arc(handX, handBaseY + 65, 14, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,107,53,${glow})`;
    ctx.fill();
  }

  // 손가락 아이콘 (원형)
  ctx.beginPath();
  ctx.arc(handX, handBaseY + 40, 18, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── 좌우 화살표 (이동 시작 후) ────────────────────────────
  if (t > 1.0) {
    const arrowAlpha = Math.min(1, (t - 1.0) * 2);
    ctx.globalAlpha = arrowAlpha * 0.4;
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u2190', cx - moveRange - 35, handBaseY + 72);
    ctx.fillText('\u2192', cx + moveRange + 35, handBaseY + 72);
    ctx.globalAlpha = 1;
  }

  // ── 하단: 당근 + 토끼 점프 데모 ──────────────────────────
  const demoBaseY = h * 0.72;
  const carrotPositions = [
    { x: cx - 55, y: demoBaseY },
    { x: cx + 35, y: demoBaseY - 55 },
    { x: cx - 15, y: demoBaseY - 120 },
  ];

  for (const pos of carrotPositions) {
    drawMiniCarrot(ctx, pos.x, pos.y);
  }

  // 토끼 점프 (2초 주기)
  const jumpT = Math.max(0, t - 0.5) % 2.4;
  let bunnyX: number, bunnyY: number;

  if (jumpT < 0.8) {
    const p = jumpT / 0.8;
    bunnyX = carrotPositions[0].x + (carrotPositions[1].x - carrotPositions[0].x) * p;
    bunnyY = carrotPositions[0].y + (carrotPositions[1].y - carrotPositions[0].y) * p - 60 * Math.sin(p * Math.PI);
  } else if (jumpT < 1.6) {
    const p = (jumpT - 0.8) / 0.8;
    bunnyX = carrotPositions[1].x + (carrotPositions[2].x - carrotPositions[1].x) * p;
    bunnyY = carrotPositions[1].y + (carrotPositions[2].y - carrotPositions[1].y) * p - 60 * Math.sin(p * Math.PI);
  } else {
    bunnyX = carrotPositions[2].x;
    bunnyY = carrotPositions[2].y - 18;
  }

  drawMiniBunny(ctx, bunnyX, bunnyY - 18);

  // +1 팝업
  drawScorePopup(ctx, jumpT, 0.6, 0.9, carrotPositions[1]);
  drawScorePopup(ctx, jumpT, 1.4, 1.7, carrotPositions[2]);

  // ── 하단 탭 안내 ──────────────────────────────────────────
  const blink = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
  ctx.globalAlpha = blink;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('화면을 탭하면 시작합니다', cx, h - 30);
  ctx.globalAlpha = 1.0;
}

function drawScorePopup(
  ctx: CanvasRenderingContext2D, jumpT: number,
  start: number, end: number, pos: { x: number; y: number },
): void {
  if (jumpT > start && jumpT < end) {
    const alpha = 1 - Math.abs(jumpT - (start + end) / 2) / ((end - start) / 2);
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+1', pos.x, pos.y - 25 - (jumpT - start) * 20);
    ctx.globalAlpha = 1;
  }
}

// ── 미니 토끼 ───────────────────────────────────────────────
function drawMiniBunny(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#F5F2F0';
  // 몸통
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  // 머리
  ctx.beginPath();
  ctx.arc(0, -16, 10, 0, Math.PI * 2);
  ctx.fill();
  // 귀
  ctx.beginPath();
  ctx.ellipse(-5, -32, 3.5, 10, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5, -32, 3.5, 10, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 귀 안쪽
  ctx.fillStyle = '#FFB0B8';
  ctx.beginPath();
  ctx.ellipse(-5, -32, 2, 7, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5, -32, 2, 7, 0.15, 0, Math.PI * 2);
  ctx.fill();
  // 눈
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(-4, -17, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4, -17, 2, 0, Math.PI * 2);
  ctx.fill();
  // 코
  ctx.fillStyle = '#FF8899';
  ctx.beginPath();
  ctx.ellipse(0, -13, 2, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── 미니 당근 ───────────────────────────────────────────────
function drawMiniCarrot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#FF8C42';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(4, -7);
  ctx.lineTo(4, 7);
  ctx.stroke();

  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.ellipse(-2, -10, 3, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, -11, 3, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
