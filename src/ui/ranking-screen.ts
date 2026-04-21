import type { RankEntry } from '../types';
import { getFlagEmoji } from './profile-modal';

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32']; // gold, silver, bronze

export function renderRankingScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rankings: RankEntry[],
  myRank: RankEntry | null,
  activeTab: 'all' | 'weekly',
  score: number,
  heightMm: number,
  bestScore: number,
  bestHeight: number,
): void {
  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;

  // Calculate total content height to center vertically
  // Title(30) + gap(10) + score(22) + height(18) + best(16) + gap(12) + tabs(30) + gap(14) + 10 rows(320) + restart(30) ≈ 502
  const contentH = 500;
  const startY = Math.max(10, (h - contentH) / 2 - 20);

  // Game Over title — centered
  ctx.fillStyle = '#FF4444';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText('Game Over!', cx, startY + 30);
  ctx.shadowBlur = 0;

  // Current score — centered block
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`Score: ${score}`, cx, startY + 66);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Height: ${heightMm}mm`, cx, startY + 86);

  // Best score
  ctx.fillStyle = '#FFD700';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Best: ${bestScore} pts / ${bestHeight}mm`, cx, startY + 106);

  // Tab buttons
  const tabY = startY + 120;
  const tabW = 90;
  const tabH = 30;
  const tabGap = 10;

  // All tab
  const allTabX = cx - tabW - tabGap / 2;
  drawTab(ctx, allTabX, tabY, tabW, tabH, '전체', activeTab === 'all');

  // Weekly tab
  const weeklyTabX = cx + tabGap / 2;
  drawTab(ctx, weeklyTabX, tabY, tabW, tabH, '주간', activeTab === 'weekly');

  // Ranking list
  const listY = tabY + tabH + 14;
  const rowH = 32;
  const listW = Math.min(w - 30, 340);
  const listX = (w - listW) / 2;

  // Header
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('#', listX + 8, listY);
  ctx.fillText('Player', listX + 50, listY);
  ctx.textAlign = 'right';
  ctx.fillText('Score', listX + listW - 8, listY);

  const top10 = rankings.filter(r => r.rank <= 10);

  for (let i = 0; i < top10.length; i++) {
    const entry = top10[i];
    const ry = listY + 14 + i * rowH;

    // Highlight my row
    if (entry.is_me) {
      ctx.fillStyle = 'rgba(255,107,53,0.25)';
      ctx.beginPath();
      roundRect(ctx, listX, ry - 8, listW, rowH - 2, 6);
      ctx.fill();
      ctx.strokeStyle = '#FF6B35';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      roundRect(ctx, listX, ry - 8, listW, rowH - 2, 6);
      ctx.stroke();
    }

    // Rank number or medal
    ctx.textAlign = 'left';
    if (entry.rank <= 3) {
      ctx.fillStyle = MEDAL_COLORS[entry.rank - 1];
      ctx.font = 'bold 16px sans-serif';
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '14px sans-serif';
    }
    ctx.fillText(`${entry.rank}`, listX + 8, ry + 12);

    // Flag + name
    ctx.font = '14px sans-serif';
    ctx.fillStyle = entry.is_me ? '#FF6B35' : '#FFF';
    const flag = getFlagEmoji(entry.country_code);
    ctx.fillText(`${flag} ${entry.nickname}`, listX + 34, ry + 12);

    // Score
    ctx.textAlign = 'right';
    ctx.fillStyle = entry.is_me ? '#FFD700' : 'rgba(255,255,255,0.8)';
    ctx.font = entry.is_me ? 'bold 14px sans-serif' : '14px sans-serif';
    ctx.fillText(`${entry.score}`, listX + listW - 8, ry + 12);
  }

  // My rank if outside top 10
  if (myRank && myRank.rank > 10) {
    const myY = listY + 14 + Math.min(top10.length, 10) * rowH + 8;

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(listX, myY - 4, listW, 1);

    const myRowY = myY + 12;
    ctx.fillStyle = 'rgba(255,107,53,0.25)';
    ctx.beginPath();
    roundRect(ctx, listX, myRowY - 8, listW, rowH - 2, 6);
    ctx.fill();
    ctx.strokeStyle = '#FF6B35';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    roundRect(ctx, listX, myRowY - 8, listW, rowH - 2, 6);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF6B35';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${myRank.rank}`, listX + 8, myRowY + 12);

    const flag = getFlagEmoji(myRank.country_code);
    ctx.fillText(`${flag} ${myRank.nickname}`, listX + 34, myRowY + 12);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${myRank.score}`, listX + listW - 8, myRowY + 12);
  }

  // Tap to restart
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Tap to Restart', cx, h - 30);
}

export function getTabHitArea(w: number, h: number): { allTab: DOMRect; weeklyTab: DOMRect } {
  const cx = w / 2;
  const contentH = 500;
  const startY = Math.max(10, (h - contentH) / 2 - 20);
  const tabY = startY + 120;
  const tabW = 90;
  const tabH = 30;
  const tabGap = 10;

  return {
    allTab: new DOMRect(cx - tabW - tabGap / 2, tabY, tabW, tabH),
    weeklyTab: new DOMRect(cx + tabGap / 2, tabY, tabW, tabH),
  };
}

function drawTab(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, active: boolean,
): void {
  ctx.fillStyle = active ? 'rgba(255,107,53,0.8)' : 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  ctx.fillStyle = active ? '#FFF' : 'rgba(255,255,255,0.6)';
  ctx.font = active ? 'bold 14px sans-serif' : '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
