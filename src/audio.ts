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

// ── BGM 파일 경로 (스킨별) ───────────────────────────────────
const BGM_BASE = '/assets/audio/bgm/';
const DEFAULT_BGM = 'default';

export class AudioManager {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmStarted = false;

  // SFX
  private sfxBuffers = new Map<string, AudioBuffer>();
  private sfxLoaded = false;

  // BGM (파일 기반)
  private bgmElement: HTMLAudioElement | null = null;
  private bgmMediaSource: MediaElementAudioSourceNode | null = null;
  private currentBgmId: string = DEFAULT_BGM;

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
    this.bgmGain.gain.value = 0.25;
    this.bgmGain.connect(this.masterGain);

    this.sfxGain = this.audioCtx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.masterGain);

    if (!this.sfxLoaded) {
      this.loadAllSFX();
    }
  }

  // ── SFX 로딩/재생 ────────────────────────────────────────────

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
      } catch { /* SFX 로드 실패 — 무시 */ }
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

  // ── BGM (파일 기반, 루프) ─────────────────────────────────────

  setBGM(skinId: string): void {
    this.currentBgmId = skinId || DEFAULT_BGM;
  }

  startBGM(): void {
    if (!this.audioCtx || !this.bgmGain) return;

    // 이전 BGM 정리
    this.stopBGMPlayback();

    const audio = new Audio(`${BGM_BASE}${this.currentBgmId}.mp3`);
    audio.loop = true;
    audio.preload = 'auto';

    // MediaElementSource → bgmGain → masterGain → destination
    const source = this.audioCtx.createMediaElementSource(audio);
    source.connect(this.bgmGain);

    this.bgmElement = audio;
    this.bgmMediaSource = source;
    this.bgmStarted = true;

    // 재생 (에러 시 무시 — 파일 없으면 BGM 없이 진행)
    audio.play().catch(() => {});
  }

  private stopBGMPlayback(): void {
    if (this.bgmElement) {
      this.bgmElement.pause();
      this.bgmElement.src = '';
      this.bgmElement = null;
    }
    if (this.bgmMediaSource) {
      this.bgmMediaSource.disconnect();
      this.bgmMediaSource = null;
    }
  }

  stopBGM(): void {
    this.bgmStarted = false;
    this.stopBGMPlayback();
  }

  suspend(): void {
    if (this.bgmElement) {
      this.bgmElement.pause();
    }
    if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioCtx.suspend();
    }
  }

  resume(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    if (this.bgmStarted && this.bgmElement) {
      this.bgmElement.play().catch(() => {});
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
