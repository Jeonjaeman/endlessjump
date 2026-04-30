import type { RankEntry } from '../types';
import { getFlagEmoji } from './profile-modal';
import { isAccountLinked } from '../services/auth';
import { getSkinBodyColorById, getSkinSpriteDir, getSkins } from '../services/skin-service';
import { skinAssetLoader } from '../skin-assets';
import { assetManager } from '../assets';

const MEDAL_EMOJIS = ['\u{1F451}', '\u{1F948}', '\u{1F949}'];
const MEDAL_BG = ['#FFD700', '#D0D0E0', '#E8A860'];
const MEDAL_SHADOW = ['#CC9900', '#8888AA', '#B07030'];

const ROW_H = 46;
const COMMENT_H = 22;
const ROW_GAP = 6;
const LIST_CLIP_H = 360;

// ── 프로필 사진 캐시 ──────────────────────────────────────────
const photoCache = new Map<string, HTMLImageElement | null>();

function getProfilePhoto(url: string | undefined): HTMLImageElement | null {
  if (!url) return null;
  const cached = photoCache.get(url);
  if (cached !== undefined) return cached;

  // 로딩 시작
  photoCache.set(url, null);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => photoCache.set(url, img);
  img.onerror = () => photoCache.set(url, null);
  img.src = url;
  return null;
}

function drawCircleImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement, cx: number, cy: number, radius: number,
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();
  const size = radius * 2;
  ctx.drawImage(img, cx - radius, cy - radius, size, size);
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// ── Neobrutalism 유틸 ──────────────────────────────────────────

function drawNeoRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  bgColor: string, shadowOffset: number = 3,
): void {
  // 오프셋 그림자
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  roundRect(ctx, x + shadowOffset, y + shadowOffset, w, h, r);
  ctx.fill();

  // 배경
  ctx.fillStyle = bgColor;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // 굵은 테두리
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawNeoButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  label: string, active: boolean,
  activeBg: string = '#FF6B35', inactiveBg: string = 'rgba(60,60,80,0.9)',
): void {
  drawNeoRect(ctx, x, y, w, h, 8, active ? activeBg : inactiveBg, active ? 3 : 2);
  ctx.fillStyle = '#FFF';
  ctx.font = active ? 'bold 14px sans-serif' : '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 5);
}

// 썸네일 프리로드 (최초 1회)
let _thumbsQueued = false;
function ensureThumbsLoaded(): void {
  if (_thumbsQueued) return;
  _thumbsQueued = true;
  const dirs = getSkins()
    .filter(s => s.spriteDir)
    .map(s => ({ id: s.id, spriteDir: s.spriteDir! }));
  skinAssetLoader.loadAllThumbs(dirs).catch(() => {});
}

function drawSkinDot(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, radius: number,
  skinId: string | undefined,
): void {
  const id = skinId ?? 'default';
  const thumb = skinAssetLoader.getThumb(id);

  if (thumb) {
    // 원형 클리핑으로 썸네일 이미지 렌더
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    const size = radius * 2;
    ctx.drawImage(thumb, cx - radius, cy - radius, size, size);
    ctx.restore();

    // 테두리
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    // 폴백: 기본 bunny_idle 스프라이트 또는 색상 원
    const defaultImg = assetManager.has('bunny_idle') ? assetManager.get('bunny_idle') : null;
    if (defaultImg) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      const size = radius * 2;
      ctx.drawImage(defaultImg, cx - radius, cy - radius, size, size);
      ctx.restore();

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      const color = getSkinBodyColorById(id);
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }
}

// ── 랭킹 TOP 10 진입 여부 체크 (댓글 팝업용) ───────────────────

export function isInTop10(rankings: RankEntry[], myRank: RankEntry | null): boolean {
  if (myRank && myRank.rank <= 10) return true;
  return rankings.some(r => r.is_me && r.rank <= 10);
}

// ── 스크롤 계산 ──────────────────────────────────────────────────

function getRowHeight(entry: RankEntry): number {
  return ROW_H + (entry.comment ? COMMENT_H : 0) + ROW_GAP;
}

export function getRankingMaxScroll(rankings: RankEntry[], myRank: RankEntry | null): number {
  const top10 = rankings.filter(r => r.rank <= 10);
  let totalH = 0;
  for (const e of top10) totalH += getRowHeight(e);
  if (myRank && myRank.rank > 10) totalH += getRowHeight(myRank) + 20;
  return Math.max(0, totalH - LIST_CLIP_H);
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
  ensureThumbsLoaded();

  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const safeTop = 40;
  const contentH = 500;
  const startY = Math.max(safeTop, (h - contentH) / 2);

  // Game Over title (Neobrutalism: bold, offset shadow text)
  ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillText('Game Over!', cx + 2, startY + 32);
  ctx.fillStyle = '#FF4444';
  ctx.fillText('Game Over!', cx, startY + 30);

  // Current height
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(`${heightMm}mm`, cx, startY + 66);

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Carrots: ${score}`, cx, startY + 86);

  ctx.fillStyle = '#FFD700';
  ctx.font = '13px sans-serif';
  ctx.fillText(`Best: ${bestHeight}mm / ${bestScore} carrots`, cx, startY + 106);

  // Tab buttons (Neobrutalism)
  const tabY = startY + 120;
  const tabW = 90;
  const tabH = 30;
  const tabGap = 10;
  drawNeoButton(ctx, cx - tabW - tabGap / 2, tabY, tabW, tabH, '\uC804\uCCB4', activeTab === 'all');
  drawNeoButton(ctx, cx + tabGap / 2, tabY, tabW, tabH, '\uC8FC\uAC04', activeTab === 'weekly');

  // Ranking list
  const listY = tabY + tabH + 14;
  const listW = Math.min(w - 30, 340);
  const listX = (w - listW) / 2;

  // Header
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('#', listX + 8, listY);
  ctx.fillText('Player', listX + 54, listY);
  ctx.textAlign = 'right';
  ctx.fillText('Height', listX + listW - 8, listY);

  const top10 = rankings.filter(r => r.rank <= 10);

  // 클립 영역
  ctx.save();
  ctx.beginPath();
  ctx.rect(listX - 6, listY + 2, listW + 12, LIST_CLIP_H);
  ctx.clip();
  ctx.translate(0, -scrollY);

  let curY = listY + 14;

  for (let i = 0; i < top10.length; i++) {
    const entry = top10[i];
    const isTop3 = entry.rank >= 1 && entry.rank <= 3;
    const medalIdx = entry.rank - 1;
    const hasComment = !!entry.comment;
    const thisRowH = ROW_H + (hasComment ? COMMENT_H : 0);

    if (isTop3) {
      // TOP 3: Neobrutalism medal card
      drawNeoRect(ctx, listX, curY - 6, listW, thisRowH + 4, 8, MEDAL_BG[medalIdx], 3);

      const rowCenterY = curY + 16;

      // 메달 이모지
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(MEDAL_EMOJIS[medalIdx], listX + 8, rowCenterY + 1);

      // 국가
      const flag3 = getFlagEmoji(entry.country_code);
      ctx.font = '14px sans-serif';
      ctx.fillText(flag3, listX + 30, rowCenterY + 1);

      // 스킨 닷
      drawSkinDot(ctx, listX + 58, rowCenterY - 3, 10, entry.skin_id);

      // 프로필 사진
      const photo3 = getProfilePhoto(entry.photo_url);
      if (photo3) {
        drawCircleImage(ctx, photo3, listX + 82, rowCenterY - 3, 10);
      }
      const nameX3 = photo3 ? listX + 98 : listX + 74;

      // 구글 계정명
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = entry.is_me ? '#FF6B35' : '#1a1a2e';
      ctx.textAlign = 'left';
      ctx.fillText(entry.nickname, nameX3, rowCenterY + 1);

      // 높이
      ctx.textAlign = 'right';
      ctx.fillStyle = '#1a1a2e';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${entry.height}mm`, listX + listW - 10, rowCenterY + 1);

      // 댓글
      if (hasComment) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'italic 12px sans-serif';
        const truncated = entry.comment!.length > 30 ? entry.comment!.slice(0, 30) + '\u2026' : entry.comment!;
        ctx.fillText('\uD83D\uDCAC ' + truncated, listX + 12, curY + ROW_H + 2);
      }

    } else {
      // 4위 이하
      if (entry.is_me) {
        drawNeoRect(ctx, listX, curY - 6, listW, thisRowH + 4, 6, 'rgba(255,107,53,0.85)', 2);
      } else {
        drawNeoRect(ctx, listX, curY - 6, listW, thisRowH + 4, 6, 'rgba(30,30,50,0.75)', 2);
      }

      const rowCenterY2 = curY + 16;

      ctx.textAlign = 'left';
      ctx.fillStyle = entry.is_me ? '#FFF' : 'rgba(255,255,255,0.7)';
      ctx.font = 'bold 14px sans-serif';
      const rankText = `${entry.rank}`;
      ctx.fillText(rankText, listX + 8, rowCenterY2);

      // 국가
      const flagR = getFlagEmoji(entry.country_code);
      ctx.font = '13px sans-serif';
      ctx.fillText(flagR, listX + 30, rowCenterY2);

      // 스킨 닷
      drawSkinDot(ctx, listX + 56, rowCenterY2 - 4, 9, entry.skin_id);

      // 프로필 사진
      const photoR = getProfilePhoto(entry.photo_url);
      if (photoR) {
        drawCircleImage(ctx, photoR, listX + 78, rowCenterY2 - 4, 9);
      }
      const nameXR = photoR ? listX + 92 : listX + 70;

      // 구글 계정명
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = entry.is_me ? '#FFF' : '#FFFFFF';
      ctx.textAlign = 'left';
      ctx.fillText(entry.nickname, nameXR, rowCenterY2);

      ctx.textAlign = 'right';
      ctx.fillStyle = entry.is_me ? '#FFD700' : 'rgba(255,255,255,0.85)';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText(`${entry.height}mm`, listX + listW - 10, rowCenterY2);

      if (hasComment) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = 'italic 12px sans-serif';
        const truncated = entry.comment!.length > 30 ? entry.comment!.slice(0, 30) + '\u2026' : entry.comment!;
        ctx.fillText('\uD83D\uDCAC ' + truncated, listX + 12, curY + ROW_H);
      }
    }

    curY += thisRowH + ROW_GAP;
  }

  // My rank if outside top 10
  if (myRank && myRank.rank > 10) {
    curY += 8;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(listX, curY - 4, listW, 1);
    curY += 8;

    const hasComment = !!myRank.comment;
    const thisRowH = ROW_H + (hasComment ? COMMENT_H : 0);

    drawNeoRect(ctx, listX, curY - 6, listW, thisRowH + 4, 6, 'rgba(255,107,53,0.85)', 2);

    const myRowCenterY = curY + 16;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 14px sans-serif';
    const myRankText = `${myRank.rank}`;
    ctx.fillText(myRankText, listX + 8, myRowCenterY);

    // 국가
    const myFlag = getFlagEmoji(myRank.country_code);
    ctx.font = '13px sans-serif';
    ctx.fillText(myFlag, listX + 30, myRowCenterY);

    // 스킨 닷
    drawSkinDot(ctx, listX + 56, myRowCenterY - 4, 9, myRank.skin_id);

    // 프로필 사진
    const myPhoto = getProfilePhoto(myRank.photo_url);
    if (myPhoto) {
      drawCircleImage(ctx, myPhoto, listX + 78, myRowCenterY - 4, 9);
    }
    const myNameX = myPhoto ? listX + 92 : listX + 70;

    // 구글 계정명
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = '#FFF';
    ctx.textAlign = 'left';
    ctx.fillText(myRank.nickname, myNameX, myRowCenterY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`${myRank.height}mm`, listX + listW - 10, myRowCenterY);

    if (hasComment) {
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.font = 'italic 12px sans-serif';
      const truncated = myRank.comment!.length > 30 ? myRank.comment!.slice(0, 30) + '\u2026' : myRank.comment!;
      ctx.fillText('\uD83D\uDCAC ' + truncated, listX + 12, curY + ROW_H);
    }
  }

  ctx.restore();

  // 스크롤 힌트
  if (getRankingMaxScroll(rankings, myRank) > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u25BC \uC2A4\uD06C\uB864', cx, listY + LIST_CLIP_H + 12);
  }

  // Revive button (Neobrutalism)
  if (reviveAvailable) {
    const btnW = 220;
    const btnH = 44;
    const btnX = cx - btnW / 2;
    const btnY = h - 90;
    drawNeoRect(ctx, btnX, btnY, btnW, btnH, 10, '#4CAF50', 3);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\uD83C\uDFAC \uAD11\uACE0 \uBCF4\uACE0 \uC774\uC5B4\uD558\uAE30', cx, btnY + btnH / 2 + 5);
  }

  // Google 연결 배너 (Neobrutalism)
  if (!isAccountLinked()) {
    const linkBtnW = 240;
    const linkBtnH = 36;
    const linkBtnX = cx - linkBtnW / 2;
    const linkBtnY = reviveAvailable ? h - 145 : h - 90;
    drawNeoRect(ctx, linkBtnX, linkBtnY, linkBtnW, linkBtnH, 8, '#4285F4', 3);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('G  Google\uB85C \uAE30\uB85D \uC601\uAD6C \uC800\uC7A5', cx, linkBtnY + linkBtnH / 2 + 5);
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
