export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmStarted = false;
  private bgmTimeout: ReturnType<typeof setTimeout> | null = null;
  private bgmIteration = 0;

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
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.masterGain);
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

    // 2가지 멜로디 패턴 교대 → 반복감 줄이기
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

    // ── 멜로디 (triangle → 부드러운 피아노풍) ──
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

    // ── 베이스 (sine, 웅장한 저음) ──
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

    // ── 하이햇 리듬 (노이즈 기반 퍼커션) ──
    const hihatInterval = beatDur;
    const hihatCount = Math.floor(loopDuration / hihatInterval);
    for (let i = 0; i < hihatCount; i++) {
      const ht = startTime + i * hihatInterval;
      const accent = i % 3 === 0; // 왈츠 3/4 강세
      this.playHihat(ctx, gain, ht, accent ? 0.06 : 0.03);
    }

    // ── 코드 패드 (부드러운 배경 화성) ──
    const chords: [number[], number][] = [
      [[262, 330, 392], 4], // C
      [[220, 330, 440], 4], // Am
      [[175, 262, 349], 4], // F
      [[196, 247, 392], 4], // G
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

  // ── 효과음: 점프 ─────────────────────────────────────────────
  playJumpSound(): void {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    // 밝은 톡 소리 (상승 피치)
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.08);
    env.gain.setValueAtTime(0.25, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);

    // 작은 반짝 레이어
    const osc2 = ctx.createOscillator();
    const env2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(800, t);
    osc2.frequency.exponentialRampToValueAtTime(1200, t + 0.06);
    env2.gain.setValueAtTime(0.08, t);
    env2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc2.connect(env2);
    env2.connect(this.sfxGain);
    osc2.start(t);
    osc2.stop(t + 0.08);
  }

  // ── 효과음: 당근 먹기 ─────────────────────────────────────────
  playCarrotSound(): void {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    // 만족스러운 크런치
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.linearRampToValueAtTime(650, t + 0.03);
    osc.frequency.linearRampToValueAtTime(380, t + 0.12);
    env.gain.setValueAtTime(0.18, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.12);

    // 크런치 노이즈
    const bufLen = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource();
    const noiseEnv = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = buf;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2500;
    noiseFilter.Q.value = 1.2;
    noiseEnv.gain.setValueAtTime(0.12, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(this.sfxGain);
    noise.start(t);
    noise.stop(t + 0.06);

    // 작은 팝 보상음
    const pop = ctx.createOscillator();
    const popEnv = ctx.createGain();
    pop.type = 'sine';
    pop.frequency.setValueAtTime(880, t + 0.04);
    pop.frequency.exponentialRampToValueAtTime(1100, t + 0.08);
    popEnv.gain.setValueAtTime(0, t);
    popEnv.gain.setValueAtTime(0.1, t + 0.04);
    popEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    pop.connect(popEnv);
    popEnv.connect(this.sfxGain);
    pop.start(t);
    pop.stop(t + 0.1);
  }

  // ── 효과음: 골든 당근 ─────────────────────────────────────────
  playGoldenCarrotSound(): void {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    // 팡파레 아르페지오: C5 → E5 → G5 → C6
    const notes = [523, 659, 784, 1047];
    const noteDur = 0.1;

    for (let i = 0; i < notes.length; i++) {
      const nt = t + i * noteDur;

      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      env.gain.setValueAtTime(0, nt);
      env.gain.linearRampToValueAtTime(0.3, nt + 0.015);
      env.gain.setValueAtTime(0.3, nt + noteDur * 0.5);
      env.gain.exponentialRampToValueAtTime(0.001, nt + noteDur + 0.15);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(nt);
      osc.stop(nt + noteDur + 0.15);

      // 옥타브 위 하모니
      const osc2 = ctx.createOscillator();
      const env2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = notes[i] * 2;
      env2.gain.setValueAtTime(0, nt);
      env2.gain.linearRampToValueAtTime(0.08, nt + 0.015);
      env2.gain.exponentialRampToValueAtTime(0.001, nt + noteDur + 0.1);
      osc2.connect(env2);
      env2.connect(this.sfxGain);
      osc2.start(nt);
      osc2.stop(nt + noteDur + 0.1);
    }

    // 쉬머 노이즈
    const shimmerStart = t + notes.length * noteDur;
    const bufLen = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * 0.15;
    }
    const shimmer = ctx.createBufferSource();
    const shimmerEnv = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();
    shimmer.buffer = buf;
    shimmerFilter.type = 'highpass';
    shimmerFilter.frequency.setValueAtTime(4000, shimmerStart);
    shimmerFilter.frequency.linearRampToValueAtTime(10000, shimmerStart + 0.2);
    shimmerEnv.gain.setValueAtTime(0.08, shimmerStart);
    shimmerEnv.gain.exponentialRampToValueAtTime(0.001, shimmerStart + 0.2);
    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerEnv);
    shimmerEnv.connect(this.sfxGain);
    shimmer.start(shimmerStart);
    shimmer.stop(shimmerStart + 0.2);
  }

  // ── 효과음: 게임오버 ──────────────────────────────────────────
  playGameOverSound(): void {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    // 하강 톤 (슬픈 느낌)
    const notes: [number, number][] = [[440, 0.2], [370, 0.2], [330, 0.3], [220, 0.5]];
    let nt = t;
    for (const [freq, dur] of notes) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, nt);
      env.gain.linearRampToValueAtTime(0.2, nt + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, nt + dur);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(nt);
      osc.stop(nt + dur);
      nt += dur * 0.8;
    }

    // 깊은 붐 (임팩트)
    const boom = ctx.createOscillator();
    const boomEnv = ctx.createGain();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, t);
    boom.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    boomEnv.gain.setValueAtTime(0.3, t);
    boomEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    boom.connect(boomEnv);
    boomEnv.connect(this.sfxGain);
    boom.start(t);
    boom.stop(t + 0.5);
  }

  // ── 효과음: UI 터치 ───────────────────────────────────────────
  playUITapSound(): void {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.04);
    env.gain.setValueAtTime(0.12, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  // ── 효과음: 업적 달성 ─────────────────────────────────────────
  playAchievementSound(): void {
    if (!this.audioCtx || !this.sfxGain) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    // 상승 3화음 (도→미→솔→도)
    const notes = [523, 659, 784, 1047];
    for (let i = 0; i < notes.length; i++) {
      const nt = t + i * 0.08;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      env.gain.setValueAtTime(0, nt);
      env.gain.linearRampToValueAtTime(0.2, nt + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, nt + 0.2);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(nt);
      osc.stop(nt + 0.2);
    }

    // 마지막에 벨 사운드
    const bellTime = t + 0.32;
    const bell = ctx.createOscillator();
    const bellEnv = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.value = 2093; // C7
    bellEnv.gain.setValueAtTime(0, bellTime);
    bellEnv.gain.linearRampToValueAtTime(0.15, bellTime + 0.01);
    bellEnv.gain.exponentialRampToValueAtTime(0.001, bellTime + 0.4);
    bell.connect(bellEnv);
    bellEnv.connect(this.sfxGain);
    bell.start(bellTime);
    bell.stop(bellTime + 0.4);
  }
}
