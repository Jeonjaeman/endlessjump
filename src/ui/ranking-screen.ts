import type { RankEntry } from '../types';
import { getFlagEmoji } from './profile-modal';
import { isAccountLinked } from '../services/auth';
import { getSkinBodyColorById } from '../services/skin-service';

const MEDAL_EMOJIS = ['\u{1F451}', '\u{1F948}', '\u{1F949}'];
const MEDAL_GLOWS = [
  { bg: 'rgba(255,215,0,0.2)', border: 'rgba(255,215,0,0.6)', text: '#FFD700' },
  { bg: 'rgba(192,192,192,0.15)', border: 'rgba(200,200,220,0.5)', text: '#E0E0F0' },
  { bg: 'rgba(205,127,50,0.15)', border: 'rgba(205,160,80,0.5)', text: '#E8B060' },
];

const ROW_H = 36;
const COMMENT_H = 18;
const ROW_GAP = 4;
const LIST_CLIP_H = 280;

export function getRankingMaxScroll(rankings: RankEntry[], myRank: RankEntry | null): number {
  const rows = Math.min(rankings.filter(r => r.rank <= 10).length, 10);
  const hasMyRank = myRank !== null && myRank.rank > 10;
  const rowH = ROW_H + COMMENT_H + ROW_GAP;
  const totalH = rows * rowH + (hasMyRank ? rowH + 20 : 0);
  return Math.max(0, totalH - LIST_CLIP_H);
}

// ── 글라스모피즘 유틸 ──────────────────────────────────────────

function drawGlassRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  bgColor: string, borderColor: string,
): void {
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  const hlGrad = ctx.createLinearGradient(x, y, x, y + h * 0.5);
  hlGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
  hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hlGrad;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h * 0.5, r);
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawGlassButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, active: boolean,
  accentColor: string = 'rgba(255,107,53,0.6)',
): void {
  const bg = active ? accentColor : 'rgba(255,255,255,0.08)';
  const border = active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
  drawGlassRect(ctx, x, y, w, h, 10, bg, border);
  ctx.fillStyle = active ? '#FFF' : 'rgba(255,255,255,0.7)';
  ctx.font = active ? 'bold 14px sans-serif' : '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

function drawSkinDot(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  skinId: string | undefined,
): void {
  const color = getSkinBodyColorById(skinId ?? 'default');
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ── 메인 렌더링 ────────────────────────────────────────────────

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
  reviveAvailable: boolean = false,
  scrollY: number = 0,
): void {
  // Dark overlay
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const safeTop = 40;
  const contentH = 500;
  const startY = Math.max(safeTop, (h - contentH) / 2);

  // Game Over title
  ctx.fillStyle = '#FF4444';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255,50,50,0.4)';
  ctx.shadowBlur = 12;
  ctx.fillText('Game Over!', cx, startY + 30);
  ctx.shadowBlur = 0;

  // Current height
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${heightMm}mm`, cx, startY + 66);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Carrots: ${score}`, cx, startY + 86);

  // Best record
  ctx.fillStyle = '#FFD700';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Best: ${bestHeight}mm / ${bestScore} carrots`, cx, startY + 106);

  // Tab buttons
  const tabY = startY + 120;
  const tabW = 90;
  const tabH = 30;
  const tabGap = 10;
  drawGlassButton(ctx, cx - tabW - tabGap / 2, tabY, tabW, tabH, '전체', activeTab === 'all');
  drawGlassButton(ctx, cx + tabGap / 2, tabY, tabW, tabH, '주간', activeTab === 'weekly');

  // Ranking list
  const listY = tabY + tabH + 14;
  const listW = Math.min(w - 30, 340);
  const listX = (w - listW) / 2;

  // Header
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('#', listX + 8, listY);
  ctx.fillText('Player', listX + 54, listY);
  ctx.textAlign = 'right';
  ctx.fillText('Height', listX + listW - 8, listY);

  const top10 = rankings.filter(r => r.rank <= 10);
  const rowH = ROW_H + COMMENT_H + ROW_GAP;

  // 클립 영역으로 스크롤 마스크
  ctx.save();
  ctx.beginPath();
  ctx.rect(listX - 4, listY + 10, listW + 8, LIST_CLIP_H);
  ctx.clip();
  ctx.translate(0, -scrollY);

  for (let i = 0; i < top10.length; i++) {
    const entry = top10[i];
    const ry = listY + 14 + i * rowH;
    const isTop3 = entry.rank >= 1 && entry.rank <= 3;
    const medalIdx = entry.rank - 1;
    const rowBoxH = ROW_H + (entry.comment ? COMMENT_H : 0);

    if (isTop3) {
      const glow = MEDAL_GLOWS[medalIdx];
      drawGlassRect(ctx, listX, ry - 8, listW, rowBoxH + 2, 10, glow.bg, glow.border);

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(MEDAL_EMOJIS[medalIdx], listX + 6, ry + 13);

      drawSkinDot(ctx, listX + 28, ry + 9, 7, entry.skin_id);

      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = entry.is_me ? '#FF6B35' : glow.text;
      const flag = getFlagEmoji(entry.country_code);
      ctx.fillText(`${flag} ${entry.nickname}`, listX + 40, ry + 13);

      ctx.textAlign = 'right';
      ctx.fillStyle = glow.text;
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${entry.height}mm`, listX + listW - 10, ry + 13);

      if (entry.comment) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = 'italic 11px sans-serif';
        const truncated = entry.comment.length > 38 ? entry.comment.slice(0, 38) + '\u2026' : entry.comment;
        ctx.fillText('\uD83D\uDCAC ' + truncated, listX + 10, ry + ROW_H + 4);
      }

    } else {
      if (entry.is_me) {
        drawGlassRect(ctx, listX, ry - 8, listW, rowBoxH + 2, 8,
          'rgba(255,107,53,0.15)', 'rgba(255,107,53,0.5)');
      }

      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${entry.rank}`, listX + 10, ry + 12);

      drawSkinDot(ctx, listX + 30, ry + 8, 6, entry.skin_id);

      ctx.font = '13px sans-serif';
      ctx.fillStyle = entry.is_me ? '#FF6B35' : '#FFF';
      const flag = getFlagEmoji(entry.country_code);
      ctx.fillText(`${flag} ${entry.nickname}`, listX + 42, ry + 12);

      ctx.textAlign = 'right';
      ctx.fillStyle = entry.is_me ? '#FFD700' : 'rgba(255,255,255,0.7)';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${entry.height}mm`, listX + listW - 10, ry + 12);

      if (entry.comment) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = 'italic 11px sans-serif';
        const truncated = entry.comment.length > 38 ? entry.comment.slice(0, 38) + '\u2026' : entry.comment;
        ctx.fillText('\uD83D\uDCAC ' + truncated, listX + 10, ry + ROW_H + 2);
      }
    }
  }

  // My rank if outside top 10
  if (myRank && myRank.rank > 10) {
    const myY = listY + 14 + top10.length * rowH + 8;

    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(listX, myY - 4, listW, 1);

    const myRowY = myY + 12;
    const myRowBoxH = ROW_H + (myRank.comment ? COMMENT_H : 0);
    drawGlassRect(ctx, listX, myRowY - 8, listW, myRowBoxH + 2, 8,
      'rgba(255,107,53,0.15)', 'rgba(255,107,53,0.5)');

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FF6B35';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${myRank.rank}`, listX + 10, myRowY + 12);

    drawSkinDot(ctx, listX + 30, myRowY + 8, 6, myRank.skin_id);

    const flag = getFlagEmoji(myRank.country_code);
    ctx.fillText(`${flag} ${myRank.nickname}`, listX + 42, myRowY + 12);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${myRank.height}mm`, listX + listW - 10, myRowY + 12);

    if (myRank.comment) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'italic 11px sans-serif';
      const truncated = myRank.comment.length > 38 ? myRank.comment.slice(0, 38) + '\u2026' : myRank.comment;
      ctx.fillText('\uD83D\uDCAC ' + truncated, listX + 10, myRowY + ROW_H + 2);
    }
  }

  ctx.restore(); // clip 해제

  // 스크롤 인디케이터
  if (getRankingMaxScroll(rankings, myRank) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u25BC \uC2A4\uD06C\uB864', cx, listY + LIST_CLIP_H + 14);
  }

  // Revive button
  if (reviveAvailable) {
    const btnW = 220;
    const btnH = 44;
    const btnX = cx - btnW / 2;
    const btnY = h - 90;
    drawGlassRect(ctx, btnX, btnY, btnW, btnH, 12,
      'rgba(76,175,80,0.4)', 'rgba(130,220,130,0.5)');
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎬 광고 보고 이어하기', cx, btnY + btnH / 2 + 6);
  }

  // Google 연결 배너
  if (!isAccountLinked()) {
    const linkBtnW = 240;
    const linkBtnH = 36;
    const linkBtnX = cx - linkBtnW / 2;
    const linkBtnY = reviveAvailable ? h - 145 : h - 90;
    drawGlassRect(ctx, linkBtnX, linkBtnY, linkBtnW, linkBtnH, 10,
      'rgba(66,133,244,0.35)', 'rgba(100,160,255,0.5)');
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G  Google로 기록 영구 저장', cx, linkBtnY + linkBtnH / 2 + 5);
  }

  // Tap to restart
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Tap to Restart', cx, h - 30);
}

export function getReviveHitArea(w: number, h: number): DOMRect {
  const cx = w / 2;
  return new DOMRect(cx - 110, h - 90, 220, 44);
}

export function getLinkHitArea(w: number, h: number, reviveAvailable: boolean): DOMRect {
  const cx = w / 2;
  const linkBtnY = reviveAvailable ? h - 145 : h - 90;
  return new DOMRect(cx - 120, linkBtnY, 240, 36);
}

export function getTabHitArea(w: number, h: number): { allTab: DOMRect; weeklyTab: DOMRect } {
  const cx = w / 2;
  const safeTop = 40;
  const contentH = 500;
  const startY = Math.max(safeTop, (h - contentH) / 2);
  const tabY = startY + 120;
  const tabW = 90;
  const tabH = 30;
  const tabGap = 10;
  return {
    allTab: new DOMRect(cx - tabW - tabGap / 2, tabY, tabW, tabH),
    weeklyTab: new DOMRect(cx + tabGap / 2, tabY, tabW, tabH),
  };
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
