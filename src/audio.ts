export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private bgmStarted = false;
  private bgmTimeout: ReturnType<typeof setTimeout> | null = null;

  initAudio(): void {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      return;
    }
    this.audioCtx = new AudioContext();
    this.bgmGain = this.audioCtx.createGain();
    this.bgmGain.gain.value = 0.12;
    this.bgmGain.connect(this.audioCtx.destination);
  }

  startBGM(): void {
    if (!this.audioCtx || !this.bgmGain) return;
    // Stop any previous loop before starting fresh
    this.bgmStarted = false;
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

    // Cute waltz melody (3/4 time) using pentatonic-friendly notes
    const melody: [number, number][] = [
      // [frequency Hz, duration in beats]
      [523, 1], [587, 0.5], [659, 0.5], [784, 1], [659, 1],
      [587, 1], [523, 0.5], [440, 0.5], [523, 1], [587, 1],
      [659, 1], [784, 0.5], [880, 0.5], [784, 1], [659, 1],
      [523, 1], [587, 0.5], [523, 0.5], [440, 1], [523, 1],
    ];

    // Bass waltz pattern (oom-pah-pah)
    const bassNotes: [number, number][] = [
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
      [131, 1], [196, 0.5], [196, 0.5], [165, 1], [247, 0.5], [247, 0.5],
      [175, 1], [262, 0.5], [262, 0.5], [131, 1], [196, 0.5], [196, 0.5],
    ];

    const startTime = ctx.currentTime + 0.05;

    // Melody voice (triangle wave for soft piano-like tone)
    let t = startTime;
    for (const [freq, beats] of melody) {
      const dur = beats * beatDur;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(0.3, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.95);
      osc.connect(env);
      env.connect(gain);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
    const loopDuration = t - startTime;

    // Bass voice (sine wave, lower volume)
    let tb = startTime;
    for (const [freq, beats] of bassNotes) {
      const dur = beats * beatDur;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, tb);
      env.gain.linearRampToValueAtTime(0.15, tb + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, tb + dur * 0.9);
      osc.connect(env);
      env.connect(gain);
      osc.start(tb);
      osc.stop(tb + dur);
      tb += dur;
    }

    // Schedule next loop iteration
    const scheduleAhead = loopDuration * 1000 - 200;
    setTimeout(() => {
      if (this.bgmStarted) this.scheduleBGMLoop();
    }, Math.max(scheduleAhead, 100));
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

  playCarrotSound(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.linearRampToValueAtTime(600, t + 0.04);
    osc.frequency.linearRampToValueAtTime(400, t + 0.15);
    env.gain.setValueAtTime(0.2, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(env);
    env.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.15);

    // Add a noise burst for crunch texture
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource();
    const noiseEnv = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    noise.buffer = buffer;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2000;
    noiseFilter.Q.value = 1.5;
    noiseEnv.gain.setValueAtTime(0.15, t);
    noiseEnv.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseEnv);
    noiseEnv.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.08);
  }

  playGoldenCarrotSound(): void {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const t = ctx.currentTime;

    // Fanfare arpeggio: C5 -> E5 -> G5 -> C6
    const notes = [523, 659, 784, 1047];
    const noteDur = 0.12;

    for (let i = 0; i < notes.length; i++) {
      const noteTime = t + i * noteDur;

      // Main tone (triangle for warmth)
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = notes[i];
      env.gain.setValueAtTime(0, noteTime);
      env.gain.linearRampToValueAtTime(0.3, noteTime + 0.02);
      env.gain.setValueAtTime(0.3, noteTime + noteDur * 0.6);
      env.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDur + 0.15);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(noteTime);
      osc.stop(noteTime + noteDur + 0.15);

      // Harmony layer (sine, octave up, quieter)
      const osc2 = ctx.createOscillator();
      const env2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = notes[i] * 2;
      env2.gain.setValueAtTime(0, noteTime);
      env2.gain.linearRampToValueAtTime(0.08, noteTime + 0.02);
      env2.gain.exponentialRampToValueAtTime(0.001, noteTime + noteDur + 0.1);
      osc2.connect(env2);
      env2.connect(ctx.destination);
      osc2.start(noteTime);
      osc2.stop(noteTime + noteDur + 0.1);
    }

    // Shimmer effect (noise sweep at the end)
    const shimmerStart = t + notes.length * noteDur;
    const bufLen = ctx.sampleRate * 0.2;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      ch[i] = (Math.random() * 2 - 1) * 0.2;
    }
    const shimmer = ctx.createBufferSource();
    const shimmerEnv = ctx.createGain();
    const shimmerFilter = ctx.createBiquadFilter();
    shimmer.buffer = buf;
    shimmerFilter.type = 'highpass';
    shimmerFilter.frequency.setValueAtTime(3000, shimmerStart);
    shimmerFilter.frequency.linearRampToValueAtTime(8000, shimmerStart + 0.2);
    shimmerEnv.gain.setValueAtTime(0.1, shimmerStart);
    shimmerEnv.gain.exponentialRampToValueAtTime(0.001, shimmerStart + 0.2);
    shimmer.connect(shimmerFilter);
    shimmerFilter.connect(shimmerEnv);
    shimmerEnv.connect(ctx.destination);
    shimmer.start(shimmerStart);
    shimmer.stop(shimmerStart + 0.2);
  }
}
