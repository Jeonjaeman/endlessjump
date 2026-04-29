/**
 * 첫 실행 튜토리얼 오버레이
 * - 3단계 애니메이션으로 게임 방법 안내
 * - localStorage로 1회만 표시
 */

const TUTORIAL_KEY = 'bh_tutorial_shown';

export function shouldShowTutorial(): boolean {
  return !localStorage.getItem(TUTORIAL_KEY);
}

export function markTutorialShown(): void {
  localStorage.setItem(TUTORIAL_KEY, '1');
}

// 튜토리얼 상태
let tutorialActive = false;
let tutorialStep = 0; // 0: 터치, 1: 좌우이동, 2: 당근점프
let stepTimer = 0;
const STEP_DURATION = 180; // 3초 @ 60fps
const TOTAL_STEPS = 3;

export function startTutorial(): void {
  tutorialActive = true;
  tutorialStep = 0;
  stepTimer = 0;
}

export function isTutorialActive(): boolean {
  return tutorialActive;
}

export function handleTutorialTap(): void {
  tutorialStep++;
  stepTimer = 0;
  if (tutorialStep >= TOTAL_STEPS) {
    tutorialActive = false;
    markTutorialShown();
  }
}

export function renderTutorial(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  if (!tutorialActive) return;

  stepTimer++;

  // 어두운 오버레이
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const t = stepTimer / 60; // 초 단위 시간

  if (tutorialStep === 0) {
    drawStep1_Touch(ctx, cx, h, t);
  } else if (tutorialStep === 1) {
    drawStep2_Move(ctx, cx, w, h, t);
  } else if (tutorialStep === 2) {
    drawStep3_Jump(ctx, cx, w, h, t);
  }

  // 하단 "탭하여 다음" 표시
  const blink = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  const nextText = tutorialStep < TOTAL_STEPS - 1 ? 'Tap to Next' : 'Tap to Start!';
  ctx.fillText(nextText, cx, h - 40);
  ctx.globalAlpha = 1.0;

  // 단계 인디케이터 (점 3개)
  for (let i = 0; i < TOTAL_STEPS; i++) {
    ctx.beginPath();
    ctx.arc(cx - 20 + i * 20, h - 65, 4, 0, Math.PI * 2);
    ctx.fillStyle = i === tutorialStep ? '#FF6B35' : 'rgba(255,255,255,0.3)';
    ctx.fill();
  }
}

// ── Step 1: 화면을 터치하세요 ─────────────────────────────────
function drawStep1_Touch(ctx: CanvasRenderingContext2D, cx: number, h: number, t: number): void {
  const centerY = h * 0.4;

  // 제목
  ctx.fillStyle = '#FF6B35';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('화면을 터치하세요', cx, h * 0.18);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText('손가락을 떼지 마세요!', cx, h * 0.24);

  // 손가락 아이콘 (아래로 내려오는 모션)
  const fingerY = centerY + Math.min(t * 40, 30);
  const pulse = Math.sin(t * 4) * 0.15 + 1;

  // 터치 파동
  if (t > 0.7) {
    const rippleAlpha = Math.max(0, 0.4 - ((t - 0.7) % 1.2) * 0.5);
    const rippleR = 20 + ((t - 0.7) % 1.2) * 30;
    ctx.strokeStyle = `rgba(255,107,53,${rippleAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, fingerY + 30, rippleR, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 터치 포인트
  ctx.beginPath();
  ctx.arc(cx, fingerY + 30, 12 * pulse, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,107,53,0.5)';
  ctx.fill();

  // 손가락 (간단한 형태)
  drawFinger(ctx, cx, fingerY, 1.0);
}

// ── Step 2: 좌우로 움직이세요 ─────────────────────────────────
function drawStep2_Move(ctx: CanvasRenderingContext2D, cx: number, w: number, h: number, t: number): void {
  const centerY = h * 0.4;

  // 제목
  ctx.fillStyle = '#4FC3F7';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('좌우로 움직이세요', cx, h * 0.18);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText('터치한 채로 좌우로 슬라이드!', cx, h * 0.24);

  // 좌우 이동 경로 표시
  const moveRange = Math.min(w * 0.25, 80);
  const fingerX = cx + Math.sin(t * 2.5) * moveRange;

  // 이동 경로 (점선)
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - moveRange, centerY + 30);
  ctx.lineTo(cx + moveRange, centerY + 30);
  ctx.stroke();
  ctx.setLineDash([]);

  // 좌우 화살표
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('\u2190', cx - moveRange - 20, centerY + 38);
  ctx.fillText('\u2192', cx + moveRange + 20, centerY + 38);

  // 터치 포인트 (이동 중)
  ctx.beginPath();
  ctx.arc(fingerX, centerY + 30, 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(79,195,247,0.5)';
  ctx.fill();

  // 손가락
  drawFinger(ctx, fingerX, centerY, 1.0);

  // 토끼 (손가락 따라 이동)
  drawMiniBunny(ctx, fingerX, centerY + 80);
}

// ── Step 3: 당근을 먹으며 점프 ────────────────────────────────
function drawStep3_Jump(ctx: CanvasRenderingContext2D, cx: number, w: number, h: number, t: number): void {
  const baseY = h * 0.65;

  // 제목
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('당근 위에서 점프!', cx, h * 0.13);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText('당근을 밟으면 자동으로 점프합니다', cx, h * 0.19);

  // 당근 3개 배치
  const carrotPositions = [
    { x: cx - 60, y: baseY },
    { x: cx + 30, y: baseY - 70 },
    { x: cx - 20, y: baseY - 150 },
  ];

  for (const pos of carrotPositions) {
    drawMiniCarrot(ctx, pos.x, pos.y);
  }

  // 토끼 점프 애니메이션 (당근 사이를 이동)
  const cycle = t % 3;
  let bunnyX: number, bunnyY: number;

  if (cycle < 1) {
    // 첫 번째 당근 → 두 번째 당근
    const p = cycle;
    bunnyX = carrotPositions[0].x + (carrotPositions[1].x - carrotPositions[0].x) * p;
    const jumpH = -80 * Math.sin(p * Math.PI);
    bunnyY = carrotPositions[0].y + (carrotPositions[1].y - carrotPositions[0].y) * p + jumpH;
  } else if (cycle < 2) {
    // 두 번째 당근 → 세 번째 당근
    const p = cycle - 1;
    bunnyX = carrotPositions[1].x + (carrotPositions[2].x - carrotPositions[1].x) * p;
    const jumpH = -80 * Math.sin(p * Math.PI);
    bunnyY = carrotPositions[1].y + (carrotPositions[2].y - carrotPositions[1].y) * p + jumpH;
  } else {
    // 세 번째 당근 위에서 잠시 대기 후 반복
    bunnyX = carrotPositions[2].x;
    bunnyY = carrotPositions[2].y - 20 + Math.sin((cycle - 2) * Math.PI) * -10;
  }

  drawMiniBunny(ctx, bunnyX, bunnyY - 20);

  // 점수 팝업 효과
  if (cycle > 0.8 && cycle < 1.3) {
    const alpha = 1 - Math.abs(cycle - 1.05) * 4;
    if (alpha > 0) {
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+1', carrotPositions[1].x, carrotPositions[1].y - 30);
      ctx.globalAlpha = 1;
    }
  }
  if (cycle > 1.8 && cycle < 2.3) {
    const alpha = 1 - Math.abs(cycle - 2.05) * 4;
    if (alpha > 0) {
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+1', carrotPositions[2].x, carrotPositions[2].y - 30);
      ctx.globalAlpha = 1;
    }
  }
}

// ── 헬퍼: 미니 손가락 그리기 ──────────────────────────────────
function drawFinger(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  // 손가락 몸통 (둥근 사각형)
  ctx.fillStyle = '#F5DEB3';
  ctx.beginPath();
  ctx.ellipse(0, -5, 14, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 손가락 윤곽
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(0, -5, 14, 22, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 손톱
  ctx.fillStyle = '#FFE4C4';
  ctx.beginPath();
  ctx.ellipse(0, -20, 8, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── 헬퍼: 미니 토끼 그리기 ────────────────────────────────────
function drawMiniBunny(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);

  // 몸통
  ctx.fillStyle = '#F5F2F0';
  ctx.beginPath();
  ctx.ellipse(0, 0, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();

  // 머리
  ctx.beginPath();
  ctx.arc(0, -16, 10, 0, Math.PI * 2);
  ctx.fill();

  // 귀
  ctx.fillStyle = '#F5F2F0';
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

// ── 헬퍼: 미니 당근 그리기 ────────────────────────────────────
function drawMiniCarrot(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);

  // 당근 몸체
  ctx.fillStyle = '#FF8C42';
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 당근 줄무늬
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

  // 잎
  ctx.fillStyle = '#4CAF50';
  ctx.beginPath();
  ctx.ellipse(-2, -10, 3, 6, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(4, -11, 3, 5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
