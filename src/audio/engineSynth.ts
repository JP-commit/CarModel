/**
 * Zero-asset procedural Web Audio engine & EV sound synthesizer.
 * Remains muted until explicitly unmuted by user gesture.
 */
export class EngineAudioSynth {
  private ctx: AudioContext | null = null;
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private gain: GainNode | null = null;
  private enabled = false;

  setEnabled(next: boolean): void {
    this.enabled = next;
    if (!next) {
      if (this.gain && this.ctx) {
        this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
      }
      return;
    }
    this.ensureContext();
    if (this.ctx?.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  private ensureContext(): void {
    if (this.ctx || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.value = 60;
      osc2.frequency.value = 120;

      filter.type = 'lowpass';
      filter.frequency.value = 280;
      filter.Q.value = 2.4;

      gain.gain.value = 0;

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      this.ctx = ctx;
      this.oscPrimary = osc1;
      this.oscHarmonic = osc2;
      this.filter = filter;
      this.gain = gain;
    } catch {
      // Ignore blocked AudioContext in restricted/headless environments
    }
  }

  update(params: { rpm: number; throttle: number; cylinders: number; isEv: boolean }): void {
    if (!this.enabled || !this.ctx || !this.oscPrimary || !this.oscHarmonic || !this.filter || !this.gain) {
      return;
    }
    const now = this.ctx.currentTime;
    const rpm = Math.max(700, Math.min(9000, params.rpm));
    if (params.isEv) {
      this.oscPrimary.type = 'sine';
      this.oscHarmonic.type = 'triangle';
      const whineHz = 180 + (rpm / 9000) * 920;
      this.oscPrimary.frequency.setTargetAtTime(whineHz, now, 0.06);
      this.oscHarmonic.frequency.setTargetAtTime(whineHz * 1.5, now, 0.06);
      this.filter.frequency.setTargetAtTime(1400, now, 0.08);
      this.gain.gain.setTargetAtTime(0.028 + params.throttle * 0.03, now, 0.06);
    } else {
      this.oscPrimary.type = 'sawtooth';
      this.oscHarmonic.type = 'triangle';
      const firingHz = Math.max(24, (rpm / 60) * (Math.max(1, params.cylinders) / 2));
      this.oscPrimary.frequency.setTargetAtTime(firingHz, now, 0.05);
      this.oscHarmonic.frequency.setTargetAtTime(firingHz * 0.5, now, 0.05);
      this.filter.frequency.setTargetAtTime(160 + (rpm / 9000) * 620 + params.throttle * 340, now, 0.06);
      this.gain.gain.setTargetAtTime(0.035 + params.throttle * 0.045, now, 0.05);
    }
  }

  dispose(): void {
    try {
      this.oscPrimary?.stop();
      this.oscHarmonic?.stop();
      void this.ctx?.close();
    } catch {
      // Ignore cleanup errors
    }
    this.ctx = null;
    this.oscPrimary = null;
    this.oscHarmonic = null;
    this.filter = null;
    this.gain = null;
  }
}

