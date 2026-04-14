import { GameState, CarrotType, type Carrot, type Particle, type Cloud } from './types';

const GRAVITY = 0.6;
const JUMP_VELOCITY = -15;
const MAX_FALL_SPEED = 12;
const BUNNY_RADIUS = 18;
const CARROT_RADIUS = 14;
const CARROT_HIT_RADIUS = 22;
const DAY_CYCLE_MS = 120_000;

interface HeightZone {
  minGap: number;
  maxGap: number;
  specialChance: number;
  rottenChance: number;
}

function getZone(height: number): HeightZone {
  if (height < 500) return { minGap: 60, maxGap: 80, specialChance: 0.1, rottenChance: 0 };
  if (height < 1500) return { minGap: 80, maxGap: 120, specialChance: 0.15, rottenChance: 0.05 };
  if (height < 3000) return { minGap: 120, maxGap: 180, specialChance: 0.2, rottenChance: 0.1 };
  return { minGap: 180, maxGap: 250, specialChance: 0.2, rottenChance: 0.15 };
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;

  private state: GameState = GameState.START;
  private bunnyX = 0;
  private bunnyY = 0;
  private velY = 0;
  private cameraY = 0;
  private highestY = 0;
  private score = 0;
  private bestScore = 0;
  private bestHeight = 0;
  private heightReached = 0;
  private groundY = 0;
  private startTime = 0;

  private carrots: Carrot[] = [];
  private generatedUpTo = 0;
  private particles: Particle[] = [];
  private clouds: Cloud[] = [];
  private shakeTimer = 0;

  private dragging = false;
  private dragStartX = 0;
  private bunnyDragStartX = 0;
  private hasJumped = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.loadBest();
    this.setupEvents();
  }

  start(): void {
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.resetGame();
    requestAnimationFrame((t) => this.loop(t));
  }

  private resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = this.w * dpr;
    this.canvas.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.groundY = this.h - 60;
  }

  private resetGame(): void {
    this.bunnyX = this.w / 2;
    this.bunnyY = this.groundY - BUNNY_RADIUS;
    this.velY = 0;
    this.cameraY = 0;
    this.highestY = 0;
    this.score = 0;
    this.heightReached = 0;
    this.hasJumped = false;
    this.carrots = [];
    this.particles = [];
    this.generatedUpTo = 0;
    this.shakeTimer = 0;
    this.generateCarrots(0, this.h * 3);
    this.generateClouds();
    this.startTime = performance.now();
  }

  private loadBest(): void {
    this.bestScore = parseInt(localStorage.getItem('bh_bestScore') || '0', 10);
    this.bestHeight = parseInt(localStorage.getItem('bh_bestHeight') || '0', 10);
  }

  private saveBest(): void {
    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('bh_bestScore', String(this.bestScore));
    }
    const hMm = Math.floor(this.heightReached);
    if (hMm > this.bestHeight) {
      this.bestHeight = hMm;
      localStorage.setItem('bh_bestHeight', String(this.bestHeight));
    }
  }

  private generateClouds(): void {
    this.clouds = [];
    for (let i = 0; i < 8; i++) {
      this.clouds.push({
        x: rand(0, this.w),
        y: rand(0, this.h * 3),
        width: rand(60, 140),
        speed: rand(0.2, 0.8),
        opacity: rand(0.15, 0.4),
      });
    }
  }

  private generateCarrots(fromY: number, toY: number): void {
    let y = fromY > 0 ? fromY : 100;
    if (this.generatedUpTo > y) y = this.generatedUpTo;

    while (y < toY) {
      const zone = getZone(y);
      const gap = rand(zone.minGap, zone.maxGap);
      y += gap;

      let type: CarrotType = CarrotType.NORMAL;
      const r = Math.random();
      if (r < zone.rottenChance) {
        type = CarrotType.ROTTEN;
      } else if (r < zone.rottenChance + zone.specialChance) {
        type = CarrotType.SPECIAL;
      }

      this.carrots.push({
        x: rand(CARROT_RADIUS + 20, this.w - CARROT_RADIUS - 20),
        y,
        type,
        eaten: false,
        radius: CARROT_RADIUS,
      });
    }
    this.generatedUpTo = y;
  }

  private setupEvents(): void {
    const c = this.canvas;

    c.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (this.state === GameState.START) {
        this.state = GameState.PLAYING;
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.startTime = performance.now();
        return;
      }
      if (this.state === GameState.GAME_OVER) {
        this.resetGame();
        this.state = GameState.START;
        return;
      }
      if (!this.hasJumped) {
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
      }
      this.dragging = true;
      this.dragStartX = t.clientX;
      this.bunnyDragStartX = this.bunnyX;
    });

    c.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this.dragging || this.state !== GameState.PLAYING) return;
      const t = e.touches[0];
      const dx = t.clientX - this.dragStartX;
      this.bunnyX = Math.max(BUNNY_RADIUS, Math.min(this.w - BUNNY_RADIUS, this.bunnyDragStartX + dx));
    });

    c.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.dragging = false;
    });

    c.addEventListener('mousedown', (e) => {
      if (this.state === GameState.START) {
        this.state = GameState.PLAYING;
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
        this.startTime = performance.now();
        return;
      }
      if (this.state === GameState.GAME_OVER) {
        this.resetGame();
        this.state = GameState.START;
        return;
      }
      if (!this.hasJumped) {
        this.velY = JUMP_VELOCITY;
        this.hasJumped = true;
      }
      this.dragging = true;
      this.dragStartX = e.clientX;
      this.bunnyDragStartX = this.bunnyX;
    });

    c.addEventListener('mousemove', (e) => {
      if (!this.dragging || this.state !== GameState.PLAYING) return;
      const dx = e.clientX - this.dragStartX;
      this.bunnyX = Math.max(BUNNY_RADIUS, Math.min(this.w - BUNNY_RADIUS, this.bunnyDragStartX + dx));
    });

    c.addEventListener('mouseup', () => { this.dragging = false; });
  }

  private update(): void {
    if (this.state !== GameState.PLAYING) return;

    this.velY = Math.min(this.velY + GRAVITY, MAX_FALL_SPEED);
    this.bunnyY += this.velY;

    const worldY = this.bunnyY;
    if (worldY > this.highestY) {
      this.highestY = worldY;
    }

    const targetCamera = this.highestY - this.h * 2 / 3;
    if (targetCamera > this.cameraY) {
      this.cameraY = targetCamera;
    }

    this.heightReached = Math.max(this.heightReached, this.highestY);

    if (this.generatedUpTo < this.highestY + this.h * 2) {
      this.generateCarrots(this.generatedUpTo, this.highestY + this.h * 2);
    }

    const screenBunnyY = this.bunnyY - this.cameraY;
    if (screenBunnyY < -BUNNY_RADIUS * 2) {
      this.gameOver();
      return;
    }

    const screenGround = this.groundY - this.cameraY;
    if (this.hasJumped && screenBunnyY >= screenGround && this.cameraY > 0) {
      this.gameOver();
      return;
    }

    if (this.bunnyY <= this.groundY - BUNNY_RADIUS && this.velY > 0 && this.cameraY <= 0) {
      if (this.bunnyY >= this.groundY - BUNNY_RADIUS) {
        this.bunnyY = this.groundY - BUNNY_RADIUS;
        this.velY = 0;
        this.hasJumped = false;
      }
    }

    for (const c of this.carrots) {
      if (c.eaten) continue;
      const dx = this.bunnyX - c.x;
      const dy = this.bunnyY - c.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < BUNNY_RADIUS + CARROT_HIT_RADIUS) {
        c.eaten = true;
        this.onCarrotEaten(c);
      }
    }

    this.carrots = this.carrots.filter(
      (c) => !c.eaten || c.y > this.cameraY - this.h
    );
    this.carrots = this.carrots.filter(
      (c) => c.y > this.cameraY - 100
    );

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }

    if (this.shakeTimer > 0) this.shakeTimer--;

    for (const cl of this.clouds) {
      cl.x += cl.speed;
      if (cl.x > this.w + cl.width) cl.x = -cl.width;
    }
  }

  private onCarrotEaten(c: Carrot): void {
    if (c.type === CarrotType.NORMAL) {
      this.velY = JUMP_VELOCITY;
      this.score += 1;
      this.spawnParticles(c.x, c.y, '#FF6B35', 6);
    } else if (c.type === CarrotType.SPECIAL) {
      this.velY = JUMP_VELOCITY * 2;
      this.score += 2;
      this.spawnParticles(c.x, c.y, '#FFD700', 12);
    } else if (c.type === CarrotType.ROTTEN) {
      this.velY = Math.abs(JUMP_VELOCITY);
      this.shakeTimer = 10;
      this.spawnParticles(c.x, c.y, '#666666', 6);
    }
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: rand(-3, 3),
        vy: rand(-4, 1),
        life: 30,
        maxLife: 30,
        color,
        radius: rand(2, 5),
      });
    }
  }

  private gameOver(): void {
    this.state = GameState.GAME_OVER;
    this.saveBest();
  }

  private lastTime = 0;
  private loop(time: number): void {
    if (this.lastTime === 0) this.lastTime = time;
    const _dt = time - this.lastTime;
    this.lastTime = time;

    if (_dt < 100) {
      this.update();
    }

    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  private render(): void {
    const ctx = this.ctx;
    const shakeX = this.shakeTimer > 0 ? rand(-3, 3) : 0;
    const shakeY = this.shakeTimer > 0 ? rand(-3, 3) : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this.renderBackground(ctx);
    this.renderClouds(ctx);

    if (this.state === GameState.PLAYING) {
      this.renderCarrots(ctx);
      this.renderBunny(ctx);
      this.renderParticles(ctx);
      this.renderHUD(ctx);
    } else if (this.state === GameState.START) {
      this.renderGround(ctx);
      this.renderBunnyAt(ctx, this.bunnyX, this.groundY - BUNNY_RADIUS);
      this.renderStartScreen(ctx);
    } else if (this.state === GameState.GAME_OVER) {
      this.renderCarrots(ctx);
      this.renderBunny(ctx);
      this.renderGameOverScreen(ctx);
    }

    ctx.restore();
  }

  private getSkyColors(): [string, string] {
    const elapsed = this.state === GameState.PLAYING
      ? (performance.now() - this.startTime)
      : 0;
    const cycle = (elapsed % DAY_CYCLE_MS) / DAY_CYCLE_MS;

    if (cycle < 0.25) {
      const t = cycle / 0.25;
      return [
        lerpColor('#87CEEB', '#FF8C42', t),
        lerpColor('#E0F0FF', '#FFB366', t),
      ];
    } else if (cycle < 0.5) {
      const t = (cycle - 0.25) / 0.25;
      return [
        lerpColor('#FF8C42', '#1a1a3e', t),
        lerpColor('#FFB366', '#2d2d6b', t),
      ];
    } else if (cycle < 0.75) {
      const t = (cycle - 0.5) / 0.25;
      return [
        lerpColor('#1a1a3e', '#2d4a7a', t),
        lerpColor('#2d2d6b', '#87CEEB', t),
      ];
    } else {
      const t = (cycle - 0.75) / 0.25;
      return [
        lerpColor('#2d4a7a', '#87CEEB', t),
        lerpColor('#87CEEB', '#E0F0FF', t),
      ];
    }
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    const [top, bottom] = this.getSkyColors();
    const grad = ctx.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.w, this.h);
  }

  private renderClouds(ctx: CanvasRenderingContext2D): void {
    for (const cl of this.clouds) {
      const screenY = cl.y - this.cameraY * 0.3;
      const drawY = ((screenY % (this.h + cl.width * 2)) + this.h + cl.width) % (this.h + cl.width * 2) - cl.width;
      ctx.fillStyle = `rgba(255,255,255,${cl.opacity})`;
      ctx.beginPath();
      const cw = cl.width;
      ctx.ellipse(cl.x, drawY, cw / 2, cw / 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cl.x - cw * 0.25, drawY + 5, cw / 3, cw / 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cl.x + cw * 0.25, drawY + 5, cw / 3, cw / 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderGround(ctx: CanvasRenderingContext2D): void {
    const gy = this.groundY - this.cameraY;
    ctx.fillStyle = '#7EC850';
    ctx.fillRect(0, gy, this.w, this.h - gy + 100);
    ctx.fillStyle = '#5A9A32';
    ctx.fillRect(0, gy, this.w, 4);
  }

  private renderBunny(ctx: CanvasRenderingContext2D): void {
    const screenY = this.bunnyY - this.cameraY;
    this.renderBunnyAt(ctx, this.bunnyX, screenY);
  }

  private renderBunnyAt(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, BUNNY_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#DDD';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(x - 7, y - BUNNY_RADIUS - 12, 5, 14, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#DDD';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + 7, y - BUNNY_RADIUS - 12, 5, 14, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFB6C1';
    ctx.beginPath();
    ctx.ellipse(x - 7, y - BUNNY_RADIUS - 14, 2.5, 10, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 7, y - BUNNY_RADIUS - 14, 2.5, 10, 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(x - 6, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 6, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FF9999';
    ctx.beginPath();
    ctx.arc(x, y + 2, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x - 3, y + 7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + 3, y + 7);
    ctx.stroke();
  }

  private renderCarrots(ctx: CanvasRenderingContext2D): void {
    for (const c of this.carrots) {
      if (c.eaten) continue;
      const sy = c.y - this.cameraY;
      if (sy < -50 || sy > this.h + 50) continue;

      if (c.type === CarrotType.NORMAL) {
        this.drawCarrot(ctx, c.x, sy, '#FF6B35', '#4CAF50');
      } else if (c.type === CarrotType.SPECIAL) {
        this.drawCarrot(ctx, c.x, sy, '#FFD700', '#90EE90');
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.beginPath();
        ctx.arc(c.x, sy, CARROT_RADIUS + 6, 0, Math.PI * 2);
        ctx.fill();
      } else {
        this.drawCarrot(ctx, c.x, sy, '#888888', '#666666');
      }
    }
  }

  private drawCarrot(ctx: CanvasRenderingContext2D, x: number, y: number, bodyColor: string, leafColor: string): void {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 6);
    ctx.lineTo(x + 8, y - 6);
    ctx.lineTo(x, y + 14);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = leafColor;
    ctx.beginPath();
    ctx.ellipse(x - 4, y - 10, 3, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 4, y - 10, 3, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 2.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y - this.cameraY, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private renderHUD(ctx: CanvasRenderingContext2D): void {
    const heightMm = Math.floor(this.heightReached);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(10, 10, 160, 60);
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${this.score}`, 20, 34);
    ctx.font = '14px sans-serif';
    ctx.fillText(`Height: ${heightMm}mm`, 20, 56);
  }

  private renderStartScreen(ctx: CanvasRenderingContext2D): void {
    this.renderGround(ctx);

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🐰 BunnyHop', this.w / 2, this.h / 3);

    ctx.font = '20px sans-serif';
    ctx.fillText('터치하여 시작', this.w / 2, this.h / 3 + 50);

    if (this.bestScore > 0) {
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`BEST: ${this.bestScore}점 / ${this.bestHeight}mm`, this.w / 2, this.h / 3 + 90);
    }
  }

  private renderGameOverScreen(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, this.w, this.h);

    ctx.fillStyle = '#FF4444';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('땅에 닿았습니다!', this.w / 2, this.h / 3);

    ctx.fillStyle = '#FFF';
    ctx.font = '22px sans-serif';
    ctx.fillText(`점수: ${this.score}`, this.w / 2, this.h / 3 + 50);
    ctx.fillText(`높이: ${Math.floor(this.heightReached)}mm`, this.w / 2, this.h / 3 + 80);

    ctx.fillStyle = '#FFD700';
    ctx.font = '16px sans-serif';
    ctx.fillText(`최고 기록: ${this.bestScore}점 / ${this.bestHeight}mm`, this.w / 2, this.h / 3 + 120);

    ctx.fillStyle = '#FFF';
    ctx.font = '18px sans-serif';
    ctx.fillText('터치하여 재시작', this.w / 2, this.h / 3 + 170);
  }
}

function lerpColor(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
