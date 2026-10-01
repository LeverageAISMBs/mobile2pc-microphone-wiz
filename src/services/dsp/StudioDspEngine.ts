/**
 * PulseCast Studio DSP Mastering Engine
 * Real-time 5-Band Parametric EQ, Studio Dynamics Compressor,
 * and High-Pass Rumble Filter running via native Web Audio DSP nodes.
 */

export interface EqualizerBandConfig {
  freq: number;
  gain: number; // dB (-12 to +12)
  q: number;
  type: BiquadFilterType;
}

export interface CompressorConfig {
  threshold: number; // dB (-60 to 0)
  ratio: number; // 1 to 20
  attack: number; // seconds (0.001 to 0.1)
  release: number; // seconds (0.05 to 1.0)
  knee: number; // dB (0 to 40)
}

export interface StudioDspSettings {
  enabled: boolean;
  highPassEnabled: boolean;
  highPassFreq: number;
  bands: EqualizerBandConfig[];
  compressor: CompressorConfig;
}

export type DspPresetName = 'broadcast' | 'vocal' | 'instrument' | 'punch' | 'bypass';

export class StudioDspEngine {
  private audioCtx: AudioContext | null = null;
  public inputNode: GainNode | null = null;
  public outputNode: GainNode | null = null;

  // Nodes
  private highPassFilter: BiquadFilterNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private compressorNode: DynamicsCompressorNode | null = null;
  private dryGainNode: GainNode | null = null;
  private wetGainNode: GainNode | null = null;

  // State
  public settings: StudioDspSettings = {
    enabled: true,
    highPassEnabled: true,
    highPassFreq: 80,
    bands: [
      { freq: 80, gain: 2.0, q: 0.7, type: 'lowshelf' },
      { freq: 250, gain: -1.5, q: 1.4, type: 'peaking' },
      { freq: 1000, gain: 0.0, q: 1.0, type: 'peaking' },
      { freq: 3500, gain: 2.5, q: 1.2, type: 'peaking' },
      { freq: 10000, gain: 3.0, q: 0.7, type: 'highshelf' },
    ],
    compressor: {
      threshold: -20,
      ratio: 4,
      attack: 0.005,
      release: 0.2,
      knee: 12,
    },
  };

  public init(ctx: AudioContext): { input: GainNode; output: GainNode } {
    this.audioCtx = ctx;

    this.inputNode = ctx.createGain();
    this.outputNode = ctx.createGain();
    this.dryGainNode = ctx.createGain();
    this.wetGainNode = ctx.createGain();

    // Highpass rumble filter
    this.highPassFilter = ctx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.setValueAtTime(this.settings.highPassFreq, ctx.currentTime);

    // 5-Band EQ filters
    this.eqFilters = this.settings.bands.map((b) => {
      const filter = ctx.createBiquadFilter();
      filter.type = b.type;
      filter.frequency.setValueAtTime(b.freq, ctx.currentTime);
      filter.gain.setValueAtTime(b.gain, ctx.currentTime);
      filter.Q.setValueAtTime(b.q, ctx.currentTime);
      return filter;
    });

    // Studio Dynamics Compressor
    this.compressorNode = ctx.createDynamicsCompressor();
    this.applyCompressorSettings();

    // Wiring Wet Signal Chain:
    // inputNode -> highPassFilter -> EQ[0] -> EQ[1] -> EQ[2] -> EQ[3] -> EQ[4] -> compressorNode -> wetGainNode -> outputNode
    this.inputNode.connect(this.highPassFilter);
    let lastNode: AudioNode = this.highPassFilter;

    for (const f of this.eqFilters) {
      lastNode.connect(f);
      lastNode = f;
    }

    lastNode.connect(this.compressorNode);
    this.compressorNode.connect(this.wetGainNode);
    this.wetGainNode.connect(this.outputNode);

    // Wiring Dry Signal Chain (for instant bypass):
    this.inputNode.connect(this.dryGainNode);
    this.dryGainNode.connect(this.outputNode);

    this.updateBypassState();

    return { input: this.inputNode, output: this.outputNode };
  }

  public setEnabled(enabled: boolean) {
    this.settings.enabled = enabled;
    this.updateBypassState();
  }

  public setHighPassEnabled(enabled: boolean) {
    this.settings.highPassEnabled = enabled;
    if (this.highPassFilter && this.audioCtx) {
      this.highPassFilter.frequency.setValueAtTime(
        enabled ? this.settings.highPassFreq : 10,
        this.audioCtx.currentTime
      );
    }
  }

  public setBandGain(bandIndex: number, gainDb: number) {
    if (this.settings.bands[bandIndex]) {
      this.settings.bands[bandIndex].gain = Math.max(-12, Math.min(12, gainDb));
      const filter = this.eqFilters[bandIndex];
      if (filter && this.audioCtx) {
        filter.gain.setValueAtTime(this.settings.bands[bandIndex].gain, this.audioCtx.currentTime);
      }
    }
  }

  public setCompressorParam<K extends keyof CompressorConfig>(param: K, value: CompressorConfig[K]) {
    this.settings.compressor[param] = value;
    this.applyCompressorSettings();
  }

  private applyCompressorSettings() {
    if (!this.compressorNode || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const c = this.settings.compressor;
    this.compressorNode.threshold.setValueAtTime(c.threshold, now);
    this.compressorNode.ratio.setValueAtTime(c.ratio, now);
    this.compressorNode.attack.setValueAtTime(c.attack, now);
    this.compressorNode.release.setValueAtTime(c.release, now);
    this.compressorNode.knee.setValueAtTime(c.knee, now);
  }

  private updateBypassState() {
    if (!this.audioCtx || !this.dryGainNode || !this.wetGainNode) return;
    const now = this.audioCtx.currentTime;
    if (this.settings.enabled) {
      this.wetGainNode.gain.setValueAtTime(1.0, now);
      this.dryGainNode.gain.setValueAtTime(0.0, now);
    } else {
      this.wetGainNode.gain.setValueAtTime(0.0, now);
      this.dryGainNode.gain.setValueAtTime(1.0, now);
    }
  }

  public getGainReduction(): number {
    if (!this.compressorNode) return 0;
    return Math.round(Math.abs(this.compressorNode.reduction) * 10) / 10;
  }

  public applyPreset(name: DspPresetName) {
    if (name === 'bypass') {
      this.setEnabled(false);
      return;
    }

    this.setEnabled(true);

    if (name === 'broadcast') {
      // Warm, authoritative radio presenter sound
      this.setHighPassEnabled(true);
      this.setBandGain(0, 3.0); // 80Hz
      this.setBandGain(1, -2.0); // 250Hz boxiness scoop
      this.setBandGain(2, 0.5); // 1kHz
      this.setBandGain(3, 2.5); // 3.5kHz articulation
      this.setBandGain(4, 3.5); // 10kHz air
      this.setCompressorParam('threshold', -18);
      this.setCompressorParam('ratio', 4.5);
    } else if (name === 'vocal') {
      // Clarity for meetings / Discord / podcasting
      this.setHighPassEnabled(true);
      this.setBandGain(0, 0.0);
      this.setBandGain(1, -3.0); // cut mud
      this.setBandGain(2, 2.0); // presence
      this.setBandGain(3, 3.0); // intelligibility
      this.setBandGain(4, 1.5);
      this.setCompressorParam('threshold', -22);
      this.setCompressorParam('ratio', 3.5);
    } else if (name === 'instrument') {
      // Clean, uncolored acoustic guitar / music pass-through
      this.setHighPassEnabled(false);
      this.setBandGain(0, 0.5);
      this.setBandGain(1, 0.0);
      this.setBandGain(2, 0.0);
      this.setBandGain(3, 1.0);
      this.setBandGain(4, 1.0);
      this.setCompressorParam('threshold', -12);
      this.setCompressorParam('ratio', 2.0);
    } else if (name === 'punch') {
      // Deep bass & crystalline highs
      this.setHighPassEnabled(false);
      this.setBandGain(0, 4.5);
      this.setBandGain(1, -1.0);
      this.setBandGain(2, -0.5);
      this.setBandGain(3, 2.0);
      this.setBandGain(4, 4.0);
      this.setCompressorParam('threshold', -16);
      this.setCompressorParam('ratio', 5.0);
    }
  }

  public destroy() {
    if (this.inputNode) {
      try {
        this.inputNode.disconnect();
      } catch (e) {
        // ignore
      }
    }
    if (this.outputNode) {
      try {
        this.outputNode.disconnect();
      } catch (e) {
        // ignore
      }
    }
    this.eqFilters = [];
    this.compressorNode = null;
    this.highPassFilter = null;
    this.audioCtx = null;
  }
}
