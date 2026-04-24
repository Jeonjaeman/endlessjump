/**
 * WebGL Sky Renderer — 프로시저럴 하늘 (별, 오로라, 낮밤 전환)
 * 별도 WebGL canvas에서 렌더링 후 Canvas 2D에 drawImage로 합성
 */

const VERT_SRC = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `#version 300 es
precision mediump float;

uniform float uTime;
uniform float uCycle;      // 0~1 낮밤 주기
uniform vec2 uResolution;
uniform float uHeight;     // 카메라 높이 (높을수록 우주)

out vec4 fragColor;

// --- Noise utilities ---
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1, 0)), f.x),
    mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

// --- Stars ---
float stars(vec2 uv, float t) {
  float s = 0.0;
  // Layer 1: bright stars (fewer, sharper)
  vec2 id1 = floor(uv * 80.0);
  float rnd1 = hash(id1);
  vec2 c1 = (id1 + vec2(hash(id1 + 1.0), hash(id1 + 2.0))) / 80.0;
  float d1 = length(uv - c1) * 80.0;
  float tw1 = 0.7 + 0.3 * sin(t * (0.5 + rnd1 * 2.0) + rnd1 * 6.28);
  s += smoothstep(0.6, 0.0, d1) * step(0.985, rnd1) * tw1;

  // Layer 2: tiny dim stars
  vec2 id2 = floor(uv * 200.0);
  float rnd2 = hash(id2 + 42.0);
  vec2 c2 = (id2 + vec2(hash(id2 + 3.0), hash(id2 + 4.0))) / 200.0;
  float d2 = length(uv - c2) * 200.0;
  float tw2 = 0.6 + 0.4 * sin(t * (0.3 + rnd2 * 1.5) + rnd2 * 3.14);
  s += smoothstep(0.5, 0.0, d2) * step(0.99, rnd2) * tw2 * 0.3;

  return s;
}

// --- Aurora ---
float aurora(vec2 uv, float t) {
  float a = 0.0;
  for (float i = 0.0; i < 4.0; i++) {
    float phase = t * (0.06 + i * 0.015) + i * 1.7;
    float wave = sin(uv.x * (1.8 + i * 0.4) + phase)
               + 0.5 * sin(uv.x * (3.5 + i) + phase * 1.3);
    float band = uv.y - (0.2 + i * 0.05) + wave * 0.05;
    float strength = exp(-band * band * 40.0);
    float detail = fbm(vec2(uv.x * 4.0 + phase * 0.3, uv.y * 1.5 + i * 10.0));
    a += strength * detail * (1.0 - i * 0.15);
  }
  return a;
}

// --- Nebula wisps ---
float nebula(vec2 uv, float t) {
  vec2 p = uv * 3.0 + vec2(t * 0.01, t * 0.005);
  float n = fbm(p);
  n = n * n * 1.5;
  return n;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  uv.y = 1.0 - uv.y; // flip Y

  float t = uTime;
  float cycle = uCycle;

  // Night factor: 0=day, 1=full night
  // cycle: 0~0.25=day->sunset, 0.25~0.5=sunset->night, 0.5~0.75=night->dawn, 0.75~1=dawn->day
  float night = smoothstep(0.2, 0.45, cycle) - smoothstep(0.6, 0.8, cycle);

  // Height factor for space transition (0=ground, 1=deep space)
  float spaceFactor = smoothstep(5000.0, 20000.0, uHeight);

  // --- Sky gradient ---
  // Day colors
  vec3 dayTop = vec3(0.40, 0.65, 0.88);
  vec3 dayBot = vec3(0.68, 0.82, 0.95);

  // Sunset colors
  float sunset = smoothstep(0.1, 0.25, cycle) - smoothstep(0.25, 0.45, cycle);
  vec3 sunsetTop = vec3(0.55, 0.25, 0.45);
  vec3 sunsetBot = vec3(0.95, 0.55, 0.25);

  // Night colors
  vec3 nightTop = vec3(0.04, 0.04, 0.12);
  vec3 nightBot = vec3(0.08, 0.10, 0.22);

  // Space colors (high altitude)
  vec3 spaceTop = vec3(0.01, 0.01, 0.05);
  vec3 spaceBot = vec3(0.03, 0.03, 0.10);

  // Blend sky
  vec3 top = mix(dayTop, nightTop, night);
  vec3 bot = mix(dayBot, nightBot, night);
  top = mix(top, sunsetTop, sunset);
  bot = mix(bot, sunsetBot, sunset);
  top = mix(top, spaceTop, spaceFactor);
  bot = mix(bot, spaceBot, spaceFactor);

  vec3 sky = mix(top, bot, pow(uv.y, 0.8));

  // --- Stars (night + space) ---
  float starVisibility = max(night, spaceFactor);
  float s = stars(uv, t) * starVisibility;
  sky += vec3(s * 0.9, s * 0.95, s);

  // --- Aurora (night only, not in space) ---
  float auroraVisibility = night * (1.0 - spaceFactor);
  if (auroraVisibility > 0.05) {
    float a = aurora(uv, t) * auroraVisibility * 0.7;
    vec3 auroraCol1 = vec3(0.1, 0.9, 0.5);   // bright green
    vec3 auroraCol2 = vec3(0.15, 0.6, 0.95);  // cyan-blue
    vec3 auroraCol3 = vec3(0.5, 0.15, 0.65);  // purple
    vec3 ac = mix(auroraCol1, auroraCol2, sin(uv.x * 3.14) * 0.5 + 0.5);
    ac = mix(ac, auroraCol3, smoothstep(0.15, 0.5, uv.y));
    sky += ac * a;
    // Aurora glow on sky (soft ambient light)
    sky += ac * a * 0.15 * (1.0 - uv.y);
  }

  // --- Nebula wisps (night + space, more visible) ---
  float nebulaVis = max(night * 0.5, spaceFactor * 0.7);
  if (nebulaVis > 0.05) {
    float n = nebula(uv, t) * nebulaVis;
    vec3 nebCol = mix(vec3(0.15, 0.25, 0.55), vec3(0.45, 0.12, 0.5), uv.y);
    sky += nebCol * n * 0.5;
  }

  // --- Subtle vignette ---
  float vig = 1.0 - 0.3 * pow(length(uv - 0.5) * 1.2, 2.0);
  sky *= vig;

  fragColor = vec4(sky, 1.0);
}
`;

export class SkyRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private glCanvas: HTMLCanvasElement;
  private program: WebGLProgram | null = null;
  private uTime: WebGLUniformLocation | null = null;
  private uCycle: WebGLUniformLocation | null = null;
  private uResolution: WebGLUniformLocation | null = null;
  private uHeight: WebGLUniformLocation | null = null;
  private ready = false;

  constructor() {
    this.glCanvas = document.createElement('canvas');
    this.init();
  }

  private init(): void {
    const gl = this.glCanvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      console.warn('WebGL2 not available, falling back to Canvas 2D sky');
      return;
    }
    this.gl = gl;

    const vs = this.compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
    const fs = this.compileShader(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Shader link error:', gl.getProgramInfoLog(prog));
      return;
    }
    this.program = prog;

    // Fullscreen quad
    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.uTime = gl.getUniformLocation(prog, 'uTime');
    this.uCycle = gl.getUniformLocation(prog, 'uCycle');
    this.uResolution = gl.getUniformLocation(prog, 'uResolution');
    this.uHeight = gl.getUniformLocation(prog, 'uHeight');

    gl.useProgram(prog);
    this.ready = true;
  }

  private compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  /** 리사이즈 (Canvas 2D의 절반 해상도로 렌더링 — 성능 최적화) */
  resize(w: number, h: number): void {
    const scale = 0.5; // 절반 해상도로 렌더 후 업스케일
    this.glCanvas.width = Math.floor(w * scale);
    this.glCanvas.height = Math.floor(h * scale);
    if (this.gl) {
      this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    }
  }

  /**
   * 하늘 렌더링
   * @param ctx - Canvas 2D context (결과를 drawImage로 합성)
   * @param w - 화면 폭
   * @param h - 화면 높이
   * @param time - 경과 시간 (초)
   * @param cycle - 낮밤 주기 (0~1)
   * @param height - 카메라 높이 (mm 단위)
   */
  render(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, cycle: number, height: number): void {
    if (!this.ready || !this.gl) {
      // Fallback: 기존 그라데이션
      this.renderFallback(ctx, w, h, cycle);
      return;
    }

    const gl = this.gl;
    gl.uniform1f(this.uTime, time);
    gl.uniform1f(this.uCycle, cycle);
    gl.uniform2f(this.uResolution, this.glCanvas.width, this.glCanvas.height);
    gl.uniform1f(this.uHeight, height);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // WebGL -> Canvas 2D
    ctx.drawImage(this.glCanvas, 0, 0, w, h);
  }

  /** WebGL 미지원 시 기존 그라데이션 fallback */
  private renderFallback(ctx: CanvasRenderingContext2D, w: number, h: number, cycle: number): void {
    const lerpC = (a: string, b: string, t: number): string => {
      const parse = (c: string) => [
        parseInt(c.slice(1, 3), 16),
        parseInt(c.slice(3, 5), 16),
        parseInt(c.slice(5, 7), 16),
      ];
      const ca = parse(a), cb = parse(b);
      const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
      const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
      const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
      return `rgb(${r},${g},${bl})`;
    };

    let top: string, bot: string;
    if (cycle < 0.25) {
      const t = cycle / 0.25;
      top = lerpC('#87CEEB', '#FF8C42', t);
      bot = lerpC('#E0F0FF', '#FFB366', t);
    } else if (cycle < 0.5) {
      const t = (cycle - 0.25) / 0.25;
      top = lerpC('#FF8C42', '#1a1a3e', t);
      bot = lerpC('#FFB366', '#2d2d6b', t);
    } else if (cycle < 0.75) {
      const t = (cycle - 0.5) / 0.25;
      top = lerpC('#1a1a3e', '#2d4a7a', t);
      bot = lerpC('#2d2d6b', '#87CEEB', t);
    } else {
      const t = (cycle - 0.75) / 0.25;
      top = lerpC('#2d4a7a', '#87CEEB', t);
      bot = lerpC('#87CEEB', '#E0F0FF', t);
    }

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  isReady(): boolean {
    return this.ready;
  }

  destroy(): void {
    if (this.gl) {
      const ext = this.gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
    }
  }
}
