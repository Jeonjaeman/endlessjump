import { CarrotType, BunnyPose, type Carrot, type Particle, type Cloud, type ScorePopup, type SkinColors } from './types';
import { getCurrentSkinColors } from './services/skin-service';
import { assetManager } from './assets';

const BUNNY_RADIUS = 18;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export interface RenderState {
  w: number;
  h: number;
  bunnyX: number;
  bunnyY: number;
  velX: number;
  velY: number;
  cameraY: number;
  score: number;
  bestScore: number;
  bestHeight: number;
  heightReached: number;
  bunnyPose: BunnyPose;
  earBounce: number;
  animTime: number;
  scoreBounce: number;
  scoreColor: string;
  carrots: Carrot[];
  particles: Particle[];
  clouds: Cloud[];
  scorePopups: ScorePopup[];
  worldToScreen(worldY: number): number;
  perspectiveScale(worldY: number): number;
}

// --- Sprite caches ---

const particleCache = new Map<string, HTMLCanvasElement>();

function getParticleSprite(color: string, radius: number): HTMLCanvasElement {
  const key = `${color}_${radius}`;
  let canvas = particleCache.get(key);
  if (canvas) return canvas;

  canvas = document.createElement('canvas');
  const size = Math.ceil(radius * 3);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 0, cx, cx, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cx, radius * 1.5, 0, Math.PI * 2);
  ctx.fill();
  particleCache.set(key, canvas);
  return canvas;
}

const cloudSpriteCache = new Map<string, HTMLCanvasElement>();

function getCloudSprite(width: number, height: number): HTMLCanvasElement {
  const key = `${width}_${height}`;
  let canvas = cloudSpriteCache.get(key);
  if (canvas) return canvas;

  canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext('2d')!;
  const cx = width / 2;
  const cy = height / 2;

  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.4)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grd;

  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(cx - width * 0.22, cy + height * 0.15, width * 0.3, height * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + width * 0.22, cy + height * 0.15, width * 0.3, height * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();

  cloudSpriteCache.set(key, canvas);
  return canvas;
}

// --- Rendering functions ---

export function renderClouds(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  const useSprite = assetManager.isReady() && assetManager.has('cloud');
  const cloudSprite = useSprite ? assetManager.get('cloud') : null;

  for (const cl of rs.clouds) {
    const screenY = rs.worldToScreen(cl.y) * cl.z + (1 - cl.z) * rs.h * 0.3;
    if (screenY < -200 || screenY > rs.h + 200) continue;

    const scale = 0.5 + cl.z * 0.5;
    const cw = cl.width * scale;
    const ch = cw * 0.35;

    // Sprite branch: use sprite if available
    if (cloudSprite) {
      ctx.save();
      ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);
      ctx.drawImage(cloudSprite, cl.x - cw / 2, screenY - ch / 2, cw, ch);
      ctx.restore();
      continue;
    }

    // Cached vector fallback
    ctx.save();
    ctx.globalAlpha = cl.opacity * (0.5 + cl.z * 0.5);
    const cachedCloud = getCloudSprite(cw, ch);
    ctx.drawImage(cachedCloud, cl.x - cw / 2, screenY - ch / 2);
    ctx.restore();
  }
}

export function renderGround(ctx: CanvasRenderingContext2D, rs: RenderState, groundY: number): void {
  const gy = rs.worldToScreen(groundY);
  if (gy > rs.h + 200) return;

  const useSprite = assetManager.isReady() && assetManager.has('ground');
  const groundSprite = useSprite ? assetManager.get('ground') : null;
  const grassSprite = useSprite ? assetManager.get('grass') : null;

  // Sprite branch
  if (groundSprite) {
    const tileW = groundSprite.width || 64;
    const tileH = groundSprite.height || 64;
    if (grassSprite) {
      const grassH = grassSprite.height || 8;
      for (let bx = 0; bx < rs.w; bx += grassSprite.width || 64) {
        ctx.drawImage(grassSprite, bx, gy - grassH + 2);
      }
    }
    for (let row = gy; row < rs.h + tileH; row += tileH) {
      for (let bx = 0; bx < rs.w; bx += tileW) {
        ctx.drawImage(groundSprite, bx, row);
      }
    }
    return;
  }

  // Vector fallback
  const blockH = 20;
  const rows = 8;

  for (let i = 0; i < rows; i++) {
    const rowY = gy + i * blockH;
    if (rowY > rs.h + blockH) break;

    const depth = i / rows;
    const baseR = 126 - depth * 40;
    const baseG = 200 - depth * 50;
    const baseB = 80 - depth * 30;

    const topColor = `rgb(${baseR},${baseG},${baseB})`;
    const botColor = `rgb(${baseR * 0.7},${baseG * 0.7},${baseB * 0.7})`;

    const grad = ctx.createLinearGradient(0, rowY, 0, rowY + blockH);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, botColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, rowY, rs.w, blockH + 1);

    if (i === 0) {
      const grassGrad = ctx.createLinearGradient(0, rowY - 6, 0, rowY + 4);
      grassGrad.addColorStop(0, '#8ED860');
      grassGrad.addColorStop(1, '#5A9A32');
      ctx.fillStyle = grassGrad;
      ctx.fillRect(0, rowY - 3, rs.w, 7);
    }

    ctx.strokeStyle = `rgba(0,0,0,${0.05 + depth * 0.08})`;
    ctx.lineWidth = 1;
    const blockW = 40 + i * 5;
    const offset = (i % 2) * blockW * 0.5;
    for (let bx = -blockW + offset; bx < rs.w + blockW; bx += blockW) {
      ctx.strokeRect(bx, rowY, blockW, blockH);
    }
  }

  ctx.fillStyle = `rgb(${126 - 40},${200 - 50},${80 - 30})`;
  ctx.fillRect(0, gy + rows * blockH, rs.w, rs.h);
}

export function renderCarrots(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  const useSprite = assetManager.isReady();
  const normalSprite = useSprite ? assetManager.get('carrot_normal') : null;
  const specialSprite = useSprite ? assetManager.get('carrot_special') : null;

  for (const c of rs.carrots) {
    if (c.eaten) continue;
    const sy = rs.worldToScreen(c.y);
    if (sy < -60 || sy > rs.h + 60) continue;

    const scale = rs.perspectiveScale(c.y);

    // Sprite branch
    const sprite = c.type === CarrotType.SPECIAL ? specialSprite : normalSprite;
    if (sprite) {
      const sw = sprite.width * scale * 0.5;
      const sh = sprite.height * scale * 0.5;
      ctx.save();
      if (c.type === CarrotType.SPECIAL) {
        const glowGrad = ctx.createRadialGradient(c.x, sy, 5, c.x, sy, 28 * scale);
        glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
        glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(c.x, sy, 28 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.drawImage(sprite, c.x - sw / 2, sy - sh / 2, sw, sh);
      ctx.restore();
      continue;
    }

    // Vector fallback
    if (c.type === CarrotType.NORMAL) {
      drawCarrotVector(ctx, c.x, sy, scale, '#FF6B35', '#E85520', '#4CAF50', '#388E3C', false);
    } else if (c.type === CarrotType.SPECIAL) {
      drawCarrotVector(ctx, c.x, sy, scale, '#FFD700', '#E6B800', '#90EE90', '#5CBF5C', true);
    }
  }
}

function drawCarrotVector(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, scale: number,
  bodyLight: string, bodyDark: string,
  leafLight: string, leafDark: string,
  glow: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  if (glow) {
    const glowGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, 28);
    glowGrad.addColorStop(0, 'rgba(255, 215, 0, 0.4)');
    glowGrad.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(2, 16, 8, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  const bodyGrad = ctx.createLinearGradient(-8, -8, 8, 14);
  bodyGrad.addColorStop(0, bodyLight);
  bodyGrad.addColorStop(0.6, bodyDark);
  bodyGrad.addColorStop(1, bodyLight);
  ctx.fillStyle = bodyGrad;

  ctx.beginPath();
  ctx.moveTo(-9, -8);
  ctx.quadraticCurveTo(-10, 2, -3, 16);
  ctx.lineTo(3, 16);
  ctx.quadraticCurveTo(10, 2, 9, -8);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.moveTo(-6, -6);
  ctx.quadraticCurveTo(-7, 2, -2, 12);
  ctx.lineTo(-1, 12);
  ctx.quadraticCurveTo(-4, 2, -3, -6);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  for (let i = 1; i <= 3; i++) {
    const ly = -6 + i * 5;
    ctx.beginPath();
    ctx.moveTo(-8 + i, ly);
    ctx.lineTo(8 - i, ly);
    ctx.stroke();
  }

  const leaves = [
    { angle: -0.4, len: 12 },
    { angle: 0, len: 14 },
    { angle: 0.4, len: 12 },
  ];
  for (const leaf of leaves) {
    const leafGrad = ctx.createLinearGradient(0, -10, 0, -10 - leaf.len);
    leafGrad.addColorStop(0, leafDark);
    leafGrad.addColorStop(1, leafLight);
    ctx.fillStyle = leafGrad;

    ctx.save();
    ctx.translate(0, -9);
    ctx.rotate(leaf.angle);
    ctx.beginPath();
    ctx.ellipse(0, -leaf.len / 2, 3, leaf.len / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

export function renderBunny(ctx: CanvasRenderingContext2D, rs: RenderState, x: number, screenY: number): void {
  const skinColors = getCurrentSkinColors();

  // Sprite branch: pick sprite matching pose
  const poseKey = rs.bunnyPose === BunnyPose.JUMPING ? 'bunny_jump'
    : rs.bunnyPose === BunnyPose.FALLING ? 'bunny_fall'
    : 'bunny_idle';
  const useSprite = assetManager.isReady() && assetManager.has('bunny_idle');
  const bunnySprite = useSprite ? (assetManager.get(poseKey) ?? assetManager.get('bunny_idle')) : null;

  if (bunnySprite) {
    ctx.save();
    ctx.translate(x, screenY);
    const lean = clamp(rs.velX * 0.05, -0.3, 0.3);
    ctx.rotate(lean);

    // Pose squash & stretch (lighter for sprites)
    let scaleX = 1.0;
    let scaleY = 1.0;
    if (rs.bunnyPose === BunnyPose.JUMPING) {
      scaleX = 0.92;
      scaleY = 1.10;
    } else if (rs.bunnyPose === BunnyPose.FALLING) {
      scaleX = 1.10;
      scaleY = 0.92;
    }
    ctx.scale(scaleX, scaleY);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.beginPath();
    ctx.ellipse(2, BUNNY_RADIUS + 6, BUNNY_RADIUS * 0.9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Draw sprite
    const drawSize = BUNNY_RADIUS * 2.4;
    const dispW = drawSize;
    const dispH = drawSize * (bunnySprite.height / bunnySprite.width);
    ctx.drawImage(bunnySprite, -dispW / 2, -dispH / 2 - 2, dispW, dispH);

    ctx.restore();
    return;
  }

  // Vector fallback
  ctx.save();
  ctx.translate(x, screenY);

  const lean = clamp(rs.velX * 0.05, -0.3, 0.3);
  ctx.rotate(lean);

  // Squash & stretch based on pose
  let scaleX = 1.0;
  let scaleY = 1.0;
  if (rs.bunnyPose === BunnyPose.JUMPING) {
    scaleX = 0.82;
    scaleY = 1.25;
  } else if (rs.bunnyPose === BunnyPose.FALLING) {
    scaleX = 1.18;
    scaleY = 0.82;
  }
  ctx.scale(scaleX, scaleY);

  const R = BUNNY_RADIUS;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.10)';
  ctx.beginPath();
  ctx.ellipse(2, R + 6, R * 0.9, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail (fluffy pom-pom, drawn behind body)
  const tailBob = Math.sin(rs.animTime * 3) * 2;
  ctx.save();
  ctx.translate(0, R - 1 + tailBob);
  const tailGrad = ctx.createRadialGradient(-1, -1, 1, 0, 0, 7);
  tailGrad.addColorStop(0, '#FFFFFF');
  tailGrad.addColorStop(0.6, '#F5F0F0');
  tailGrad.addColorStop(1, '#E8E0E0');
  ctx.fillStyle = tailGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  // Tail highlight
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-2, -2, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Body (egg-shaped — taller ellipse)
  const bodyGrad = ctx.createRadialGradient(-3, -5, 3, 0, 2, R + 2);
  bodyGrad.addColorStop(0, skinColors.bodyLight);
  bodyGrad.addColorStop(0.5, skinColors.body);
  bodyGrad.addColorStop(0.8, skinColors.body);
  bodyGrad.addColorStop(1, skinColors.bodyDark);
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.ellipse(0, 2, R - 1, R + 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly patch (lighter oval)
  ctx.fillStyle = skinColors.belly;
  ctx.beginPath();
  ctx.ellipse(0, 5, R * 0.55, R * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body highlight (specular)
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(-5, -7, 7, 5, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Head (egg-shaped, slightly above body)
  const headY = -R + 2;
  const headGrad = ctx.createRadialGradient(-2, headY - 3, 2, 0, headY, R * 0.8);
  headGrad.addColorStop(0, skinColors.bodyLight);
  headGrad.addColorStop(0.7, skinColors.body);
  headGrad.addColorStop(1, skinColors.bodyDark);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(0, headY, R * 0.75, R * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks (soft pink circles)
  ctx.fillStyle = skinColors.cheek;
  ctx.beginPath();
  ctx.arc(-9, headY + 4, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(9, headY + 4, 5, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  const earBaseY = headY - R * 0.55;
  drawEar(ctx, -7, earBaseY, -0.15 + rs.earBounce, skinColors);
  drawEar(ctx, 7, earBaseY, 0.15 - rs.earBounce, skinColors);

  // Eyes — larger, more expressive
  // Eye whites
  ctx.fillStyle = '#FEFEFE';
  ctx.beginPath();
  ctx.ellipse(-6, headY - 1, 4.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(6, headY - 1, 4.5, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Pupils (large, dark)
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(-5.5, headY, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(5.5, headY, 3.2, 0, Math.PI * 2);
  ctx.fill();

  // Eye highlights (two per eye for liveliness)
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(-6.5, headY - 1.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-4.5, headY + 1, 0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(4.5, headY - 1.5, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(6.5, headY + 1, 0.7, 0, Math.PI * 2);
  ctx.fill();

  // Nose (inverted triangle, pink)
  const noseY = headY + 5;
  const noseGrad = ctx.createRadialGradient(-0.5, noseY - 1, 0, 0, noseY, 3.5);
  noseGrad.addColorStop(0, skinColors.nose);
  noseGrad.addColorStop(1, skinColors.nose);
  ctx.fillStyle = noseGrad;
  ctx.beginPath();
  ctx.moveTo(-3, noseY - 1.5);
  ctx.quadraticCurveTo(0, noseY + 3, 3, noseY - 1.5);
  ctx.quadraticCurveTo(0, noseY - 3, -3, noseY - 1.5);
  ctx.fill();

  // Mouth — :3 style
  ctx.strokeStyle = '#CC8888';
  ctx.lineWidth = 1.0;
  ctx.lineCap = 'round';
  // Left curve
  ctx.beginPath();
  ctx.arc(-3, noseY + 3, 3, -Math.PI * 0.8, -Math.PI * 0.1);
  ctx.stroke();
  // Right curve
  ctx.beginPath();
  ctx.arc(3, noseY + 3, 3, -Math.PI * 0.9, -Math.PI * 0.2);
  ctx.stroke();

  // Whiskers (3 per side, varied length/angle)
  ctx.strokeStyle = 'rgba(140,130,125,0.35)';
  ctx.lineWidth = 0.7;
  // Left whiskers
  ctx.beginPath(); ctx.moveTo(-8, noseY + 1); ctx.lineTo(-20, noseY - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, noseY + 2); ctx.lineTo(-21, noseY + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, noseY + 3); ctx.lineTo(-19, noseY + 6); ctx.stroke();
  // Right whiskers
  ctx.beginPath(); ctx.moveTo(8, noseY + 1); ctx.lineTo(20, noseY - 3); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, noseY + 2); ctx.lineTo(21, noseY + 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(8, noseY + 3); ctx.lineTo(19, noseY + 6); ctx.stroke();

  // Feet — pose-dependent
  if (rs.bunnyPose === BunnyPose.JUMPING) {
    // Feet tucked up and stretched
    const footGrad = ctx.createRadialGradient(0, R + 3, 1, 0, R + 3, 6);
    footGrad.addColorStop(0, '#F0ECEC');
    footGrad.addColorStop(1, '#DDD5D5');
    ctx.fillStyle = footGrad;
    ctx.beginPath();
    ctx.ellipse(-6, R + 4, 5, 2.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6, R + 4, 5, 2.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Toe pads
    ctx.fillStyle = 'rgba(255,190,190,0.3)';
    ctx.beginPath(); ctx.arc(-8, R + 3, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, R + 3, 1.5, 0, Math.PI * 2); ctx.fill();
  } else if (rs.bunnyPose === BunnyPose.FALLING) {
    // Feet spread out
    ctx.fillStyle = '#E8E4E4';
    ctx.beginPath();
    ctx.ellipse(-8, R + 2, 6, 3.5, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(8, R + 2, 6, 3.5, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,190,190,0.25)';
    ctx.beginPath(); ctx.arc(-10, R + 1, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, R + 1, 1.5, 0, Math.PI * 2); ctx.fill();
  } else {
    // Idle — rounded sitting paws
    ctx.fillStyle = '#E8E4E4';
    ctx.beginPath();
    ctx.ellipse(-7, R, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(7, R, 6, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Toe pads
    ctx.fillStyle = 'rgba(255,190,190,0.3)';
    ctx.beginPath(); ctx.arc(-9, R - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-6, R - 2, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, R - 1, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(6, R - 2, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

function drawEar(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, skinColors?: SkinColors): void {
  const sc = skinColors || getCurrentSkinColors();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Outer ear
  const earGrad = ctx.createLinearGradient(-6, 0, 6, 0);
  earGrad.addColorStop(0, sc.bodyDark);
  earGrad.addColorStop(0.3, sc.bodyLight);
  earGrad.addColorStop(0.7, sc.bodyLight);
  earGrad.addColorStop(1, sc.bodyDark);
  ctx.fillStyle = earGrad;
  ctx.beginPath();
  ctx.ellipse(0, -12, 6, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner ear
  const innerGrad = ctx.createLinearGradient(-3, -4, 3, -4);
  innerGrad.addColorStop(0, sc.earInner);
  innerGrad.addColorStop(0.5, sc.earInner);
  innerGrad.addColorStop(1, sc.earInner);
  ctx.fillStyle = innerGrad;
  ctx.beginPath();
  ctx.ellipse(0, -12, 3.5, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner ear vein detail (subtle darker line)
  ctx.strokeStyle = 'rgba(220,130,140,0.25)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(-1.5, -12, 0, -22);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(1, -12, -0.5, -18);
  ctx.stroke();

  ctx.restore();
}

export function renderParticles(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  for (const p of rs.particles) {
    const sy = rs.worldToScreen(p.y);
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    const sprite = getParticleSprite(p.color, p.radius);
    const size = sprite.width;
    ctx.drawImage(sprite, p.x - size / 2, sy - size / 2);
  }
  ctx.globalAlpha = 1;
}

export function renderHUD(ctx: CanvasRenderingContext2D, rs: RenderState): void {
  const heightMm = Math.floor(rs.heightReached);

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  const hudW = 170;
  const hudH = 65;
  const hudX = 10;
  const hudY = 10;
  const r = 10;
  ctx.beginPath();
  ctx.moveTo(hudX + r, hudY);
  ctx.lineTo(hudX + hudW - r, hudY);
  ctx.quadraticCurveTo(hudX + hudW, hudY, hudX + hudW, hudY + r);
  ctx.lineTo(hudX + hudW, hudY + hudH - r);
  ctx.quadraticCurveTo(hudX + hudW, hudY + hudH, hudX + hudW - r, hudY + hudH);
  ctx.lineTo(hudX + r, hudY + hudH);
  ctx.quadraticCurveTo(hudX, hudY + hudH, hudX, hudY + hudH - r);
  ctx.lineTo(hudX, hudY + r);
  ctx.quadraticCurveTo(hudX, hudY, hudX + r, hudY);
  ctx.closePath();
  ctx.fill();

  // Height (primary) with bounce animation
  ctx.save();
  const scoreTextX = 20;
  const scoreTextY = 36;
  const bounce = rs.scoreBounce;
  ctx.translate(scoreTextX, scoreTextY);
  ctx.scale(bounce, bounce);
  ctx.translate(-scoreTextX, -scoreTextY);
  ctx.fillStyle = rs.scoreColor;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${heightMm}mm`, scoreTextX, scoreTextY);
  ctx.restore();

  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#CCC';
  ctx.fillText(`Carrots: ${rs.score}`, 20, 58);

  // Score popups (floating +1, +2 GOLD text)
  for (const p of rs.scorePopups) {
    const sy = rs.worldToScreen(p.y);
    const alpha = p.life / p.maxLife;
    const popScale = 0.5 + (p.life / p.maxLife) * (p.scale - 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, sy);
    ctx.scale(popScale, popScale);
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
}

export function renderStartScreen(ctx: CanvasRenderingContext2D, w: number, h: number, bestScore: number, bestHeight: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 8;
  ctx.fillText('\uBB34\uD55C\uC758\uB2F9\uADFC', w / 2, h / 3);
  ctx.shadowBlur = 0;

  ctx.font = '20px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText('Tap to Start', w / 2, h / 3 + 50);

  if (bestHeight > 0) {
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`BEST: ${bestHeight}mm / ${bestScore} carrots`, w / 2, h / 3 + 90);
  }
}
