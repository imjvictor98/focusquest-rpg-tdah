// Web Audio API Synthesizer for immediate sensory feedback ("Game Feel / Juice")
// Uses native oscillators with dynamic pitch shifting based on comboCount

class SoundEngine {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Semitone multiplier based on combo count (caps at +12 semitones = 1 octave higher)
  private getPitchMultiplier(comboCount: number): number {
    const clamped = Math.max(0, Math.min(comboCount, 10));
    // Musical major/pentatonic steps feel extra rewarding
    const semitones = [0, 0, 2, 4, 5, 7, 9, 11, 12, 14, 16];
    const step = semitones[clamped] ?? 12;
    return Math.pow(2, step / 12);
  }

  private playTone(
    freq: number,
    type: OscillatorType,
    startTime: number,
    duration: number,
    maxGain = 0.14,
    slideToFreq?: number
  ) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideToFreq, startTime + duration);
    }

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(maxGain, startTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
  }

  /**
   * Crisp RPG coin + completion chime with dynamic pitch shifting
   */
  public playTaskComplete(comboCount = 1, enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pitch = this.getPitchMultiplier(comboCount);

    // Classic double coin bell (B5 -> E6 shifted by combo pitch)
    this.playTone(587.33 * pitch, 'sine', now, 0.11, 0.14);
    this.playTone(880.0 * pitch, 'triangle', now + 0.075, 0.28, 0.16);
    if (comboCount >= 3) {
      // Extra harmonic sparkle when combo is rolling
      this.playTone(1174.66 * pitch, 'sine', now + 0.14, 0.32, 0.11);
    }
  }

  /**
   * Tactile impact + damage hit sound for Boss Subtasks
   */
  public playBossHit(comboCount = 1, enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const pitch = this.getPitchMultiplier(comboCount);

    // Low punch impact
    this.playTone(160, 'sawtooth', now, 0.09, 0.16, 55);
    // Crisp high confirmation chime
    this.playTone(523.25 * pitch, 'triangle', now + 0.05, 0.12, 0.14);
    this.playTone(783.99 * pitch, 'sine', now + 0.11, 0.25, 0.15);
  }

  /**
   * Triumphant fanfare when a Boss reaches 0% HP
   */
  public playBossDefeat(enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Sub impact
    this.playTone(130.81, 'sawtooth', now, 0.22, 0.18, 45);

    // Victory fanfare notes (C5 - E5 - G5 - C6)
    const notes = [
      { f: 523.25, t: 0.06, d: 0.14 },
      { f: 659.25, t: 0.18, d: 0.14 },
      { f: 783.99, t: 0.30, d: 0.16 },
      { f: 1046.5, t: 0.44, d: 0.55 },
    ];
    notes.forEach((n) => {
      this.playTone(n.f, 'triangle', now + n.t, n.d, 0.18);
      this.playTone(n.f * 0.5, 'sine', now + n.t, n.d, 0.1);
    });
  }

  /**
   * Epic Level Up arpeggio
   */
  public playLevelUp(enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const arpeggio = [440, 554.37, 659.25, 880, 1108.73, 1318.51];
    arpeggio.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const duration = idx === arpeggio.length - 1 ? 0.65 : 0.18;
      this.playTone(freq, 'triangle', start, duration, 0.17);
      this.playTone(freq * 1.5, 'sine', start + 0.02, duration * 0.8, 0.07);
    });
  }

  /**
   * Reward redemption sound (coins + soothing positive chord)
   */
  public playRewardRedeem(enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(987.77, 'sine', now, 0.09, 0.14);
    this.playTone(1318.51, 'sine', now + 0.08, 0.32, 0.16);
    this.playTone(659.25, 'triangle', now + 0.12, 0.35, 0.12);
  }

  /**
   * Subtle focus lock-in tone for Tunnel Mode
   */
  public playTunnelEnter(enabled = true) {
    if (!enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    this.playTone(220, 'sine', now, 0.25, 0.09, 440);
  }
}

export const soundEngine = new SoundEngine();
