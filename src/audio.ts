// ── SFX 파일 경로 ────────────────────────────────────────────
const SFX_PATHS: Record<string, string> = {
  jump: '/assets/audio/sfx/jump.ogg',
  carrot_eat: '/assets/audio/sfx/carrot_eat.ogg',
  golden_carrot: '/assets/audio/sfx/golden_carrot.ogg',
  game_over: '/assets/audio/sfx/game_over.ogg',
  achievement: '/assets/audio/sfx/achievement.ogg',
  ui_tap: '/assets/audio/sfx/ui_tap.ogg',
  skin_equip: '/assets/audio/sfx/skin_equip.ogg',
};

export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmStarted = false;
  private bgmTimeout: ReturnType<typeof setTimeout> | null = null;
  private bgmIteration = 0;

  // SFX 버퍼 캐시
  private sfxBuffers = new Map<string, AudioBuffer>();
  private sfxLoaded = false;

  initAudio(): void {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return;
    }
    this.audioCtx = new AudioContext();

    this.masterGain = this.audioCtx.createGain();
    this.masterGain.gain.value = 1.0;
    this.masterGain.connect(this.audioCtx.destination);

    this.bgmGain = this.audioCtx.createGain();
    this.bgmGain.gain.value = 0.10;
    this.bgmGain.connect(this.masterGain);

    this.sfxGain = this.audioCtx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);

    // SFX 파일 프리로드
    if (!this.sfxLoaded) {
      this.loadAllSFX();
    }
  }

  private async loadAllSFX(): Promise<void> {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const tasks = Object.entries(SFX_PATHS).map(async ([key, path]) => {
      try {
        const res = await fetch(path);
        if (!res.ok) return;
        const arrayBuf = await res.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);
        this.sfxBuffers.set(key, audioBuf);
      } catch {
        // SFX 로드 실패 — 절차적 폴백 사용
      }
    });
    await Promise.all(tasks);
    this.sfxLoaded = true;
  }

  private playSFX(key: string): void {
    if (!this.audioCtx || !this.sfxGain) return;
    const buf = this.sfxBuffers.get(key);
    if (!buf) return;
    const src = this.audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(this.sfxGain);
    src.start();
  }

  // ── BGM ──────────────────────────────────────────────────────

  startBGM(): void {
    if (!this.audioCtx || !this.bgmGain) return;
    this.bgmStarted = false;
    this.bgmIteration = 0;
    if (this.bgmTimeout) clearTimeout(this.bgmTimeout);
    this.bgmTimeout = setTimeout(() => {
      this.bgmStarted = true;
      this.scheduleBGMLoop();
    }, 50);
  }

  private scheduleBGMLoop(): void {
    if (!this.audioCtx || !this.bgmGain) return;
    const ctx = this.audioCtx;
    const gain = this.bgmGain;
    const bpm = 140;
    const beatDur = 60 / bpm;

    const melodyA: [number, number][] = [
      [523, 1], [587, 0.5], [659, 0.5], [784, 1], [659, 1],
      [587, 1], [523, 0.5], [440, 0.5], [523, 1], [587, 1],
      [659, 1], [784, 0.5], [880, 0.5], [784, 1], [659, 1],
      [523, 1], [587, 0.5], [523, 0.5], [440, 1], [523, 1],
    ];

    const melodyB: [number, number][] = [
      [659, 1], [784, 0.5], [880, 0.5], [784, 1], [659, 1],
      [523, 1], [587, 0.5], [659, 0.5], [784, 1], [880, 1],
      [784, 1], [659, 0.5], [587, 0.5], [523, 1], [440, 1],
      [523, 1], [440, 0.5], [523, 0.5], [587, 1], [523, 1],
    ];

    const melody = this.bgmIteration % 2 === 0 ? melodyA : melodyB;

    const bassNotes: [number, number][] = [
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
    ];

    const startTime = ctx.currentTime + 0.05;

    // 멜로디
    let t = startTime;
    for (const [freq, beats] of melody) {
      const dur = beats * beatDur;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.28, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
      osc.connect(env);
      env.connect(gain);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
    const loopDuration = t - startTime;

    // 베이스
    let tb = startTime;
    for (const [freq, beats] of bassNotes) {
      const dur = beats * beatDur;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, tb);
      env.gain.linearRampToValueAtTime(0.14, tb + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, tb + dur * 0.9);
      osc.connect(env);
      env.connect(gain);
      osc.start(tb);
      osc.stop(tb + dur);
      tb += dur;
    }

    // 하이햇 리듬
    const hihatInterval = beatDur;
    const hihatCount = Math.floor(loopDuration / hihatInterval);
    for (let i = 0; i < hihatCount; i++) {
      const ht = startTime + i * hihatInterval;
      const accent = i % 3 === 0;
      this.playHihat(ctx, gain, ht, accent ? 0.06 : 0.03);
    }

    // 코드 패드
    const chords: [number[], number][] = [
      [[262, 330, 392], 4],
      [[220, 330, 440], 4],
      [[175, 262, 349], 4],
      [[196, 247, 392], 4],
    ];
    let tc = startTime;
    for (const [freqs, beats] of chords) {
      const dur = beats * beatDur;
      for (const freq of freqs) {
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, tc);
        env.gain.linearRampToValueAtTime(0.04, tc + 0.1);
        env.gain.setValueAtTime(0.04, tc + dur * 0.7);
        env.gain.exponentialRampToValueAtTime(0.001, tc + dur);
        osc.connect(env);
        env.connect(gain);
        osc.start(tc);
        osc.stop(tc + dur);
      }
      tc += dur;
    }

    this.bgmIteration++;
    const scheduleAhead = loopDuration * 1000 - 200;
    setTimeout(() => {
      if (this.bgmStarted) this.scheduleBGMLoop();
    }, Math.max(scheduleAhead, 100));
  }

  private playHihat(ctx: AudioContext, dest: AudioNode, time: number, vol: number): void {
    const bufLen = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const env = ctx.createGain();
    env.gain.setValueAtTime(vol, time);
    env.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    src.connect(filter);
    filter.connect(env);
    env.connect(dest);
    src.start(time);
    src.stop(time + 0.03);
  }

  stopBGM(): void {
    this.bgmStarted = false;
    if (this.bgmTimeout) {
      clearTimeout(this.bgmTimeout);
      this.bgmTimeout = null;
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  suspend(): void {
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended' && this.bgmStarted) {
      this.audioCtx.resume();
    }
  }

  // ── 공개 SFX API ──────────────────────────────────────────────

  playJumpSound(): void { this.playSFX('jump'); }
  playCarrotSound(): void { this.playSFX('carrot_eat'); }
  playGoldenCarrotSound(): void { this.playSFX('golden_carrot'); }
  playGameOverSound(): void { this.playSFX('game_over'); }
  playAchievementSound(): void { this.playSFX('achievement'); }
  playUITapSound(): void { this.playSFX('ui_tap'); }
  playSkinEquipSound(): void { this.playSFX('skin_equip'); }
}
