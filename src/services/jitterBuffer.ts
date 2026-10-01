import { BufferConfig, StreamTelemetry } from '../types/audio';
import { DecodedAudio } from './codecEngine';

interface QueuedAudioFrame {
  seq: number;
  timestamp: number;
  leftChannel: Float32Array;
  rightChannel: Float32Array;
  sampleRate: number;
  channels: number;
  arrivalPerfTime: number;
}

export class JitterBuffer {
  private queue: QueuedAudioFrame[] = [];
  private config: BufferConfig;
  private audioCtx: AudioContext | null = null;
  private nextPlayTime: number = 0;
  private lastPlayedSeq: number = 0;
  private lastFrame: QueuedAudioFrame | null = null;

  // Telemetry metrics
  private underruns: number = 0;
  private overruns: number = 0;
  private packetsReceived: number = 0;
  private droppedPackets: number = 0;
  private arrivalHistory: number[] = [];
  private jitterEstimateMs: number = 1.2;
  private smoothedRttMs: number = 4.5;
  private currentBufferMs: number = 0;

  // Active playing node connection
  private outputNode: AudioNode | null = null;

  constructor(config: BufferConfig) {
    this.config = config;
  }

  public setAudioContext(ctx: AudioContext, outputNode: AudioNode) {
    this.audioCtx = ctx;
    this.outputNode = outputNode;
    this.nextPlayTime = ctx.currentTime + this.config.bufferSizeMs / 1000;
  }

  public updateConfig(newConfig: Partial<BufferConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public pushPacket(decoded: DecodedAudio) {
    const now = performance.now();
    this.packetsReceived++;

    // Jitter calculation (RFC 3550 standard)
    if (this.arrivalHistory.length > 0) {
      const lastArrival = this.arrivalHistory[this.arrivalHistory.length - 1];
      const deltaArrival = now - lastArrival;
      const nominalFrameMs = (decoded.leftChannel.length / decoded.sampleRate) * 1000;
      const currentJitter = Math.abs(deltaArrival - nominalFrameMs);
      this.jitterEstimateMs = this.jitterEstimateMs + (currentJitter - this.jitterEstimateMs) / 16;
    }
    this.arrivalHistory.push(now);
    if (this.arrivalHistory.length > 60) this.arrivalHistory.shift();

    // Check sequence
    if (this.config.dropLatePackets && decoded.seq < this.lastPlayedSeq) {
      this.droppedPackets++;
      return;
    }

    const frame: QueuedAudioFrame = {
      seq: decoded.seq,
      timestamp: decoded.timestamp,
      leftChannel: decoded.leftChannel,
      rightChannel: decoded.rightChannel,
      sampleRate: decoded.sampleRate,
      channels: decoded.channels,
      arrivalPerfTime: now,
    };

    // Insert sorted by sequence number
    let insertIdx = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (this.queue[i].seq > frame.seq) {
        insertIdx = i;
        break;
      }
    }
    this.queue.splice(insertIdx, 0, frame);

    // Max queue depth limit (overrun prevention)
    const maxQueueFrames = Math.max(10, Math.ceil((this.config.bufferSizeMs * 2.5) / 10));
    if (this.queue.length > maxQueueFrames) {
      this.overruns++;
      this.queue.shift(); // Drop oldest frame
    }

    // Schedule playout if ready
    this.schedulePlayout();
  }

  private schedulePlayout() {
    if (!this.audioCtx || !this.outputNode) return;

    const ctxTime = this.audioCtx.currentTime;

    // Check if playhead has fallen behind (underrun)
    if (this.nextPlayTime < ctxTime) {
      this.underruns++;
      // Reset playhead with configured target buffer delay
      const effectiveBufferMs = this.getEffectiveBufferMs();
      this.nextPlayTime = ctxTime + effectiveBufferMs / 1000;
    }

    // Schedule audio buffers ahead of time up to 100ms
    while (this.queue.length > 0 && this.nextPlayTime < ctxTime + 0.1) {
      const frame = this.queue.shift()!;
      this.lastPlayedSeq = frame.seq;
      this.lastFrame = frame;

      const frameDuration = frame.leftChannel.length / frame.sampleRate;
      const audioBuffer = this.audioCtx.createBuffer(
        frame.channels,
        frame.leftChannel.length,
        frame.sampleRate
      );

      audioBuffer.copyToChannel(frame.leftChannel as unknown as Float32Array<ArrayBuffer>, 0);
      if (frame.channels === 2) {
        audioBuffer.copyToChannel(frame.rightChannel as unknown as Float32Array<ArrayBuffer>, 1);
      }

      const sourceNode = this.audioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(this.outputNode);

      const startTime = Math.max(ctxTime, this.nextPlayTime);
      sourceNode.start(startTime);
      this.nextPlayTime = startTime + frameDuration;
    }

    // If queue is empty and next play time is imminent, synthesize Packet Loss Concealment (PLC)
    if (
      this.queue.length === 0 &&
      this.config.packetLossConcealment &&
      this.lastFrame &&
      this.nextPlayTime < ctxTime + 0.02
    ) {
      this.synthesizeConcealmentFrame(ctxTime);
    }

    // Calculate current buffer water level in ms
    let queuedSamples = 0;
    for (const f of this.queue) {
      queuedSamples += f.leftChannel.length;
    }
    const queueMs = (queuedSamples / (this.config.sampleRate || 48000)) * 1000;
    const playheadLeadMs = Math.max(0, (this.nextPlayTime - ctxTime) * 1000);
    this.currentBufferMs = queueMs + playheadLeadMs;
  }

  /**
   * Packet Loss Concealment (PLC):
   * Synthesize smooth waveform decay from last frame to prevent audible clicks/pops
   */
  private synthesizeConcealmentFrame(ctxTime: number) {
    if (!this.audioCtx || !this.outputNode || !this.lastFrame) return;

    const len = Math.min(240, this.lastFrame.leftChannel.length);
    const plcBuffer = this.audioCtx.createBuffer(this.lastFrame.channels, len, this.lastFrame.sampleRate);
    const decayedL = new Float32Array(len);
    const decayedR = new Float32Array(len);

    const prevL = this.lastFrame.leftChannel;
    const prevR = this.lastFrame.rightChannel;
    const offset = Math.max(0, prevL.length - len);

    for (let i = 0; i < len; i++) {
      // Exponential decay envelope
      const decay = Math.exp(-i / (len * 0.4));
      decayedL[i] = prevL[offset + i] * decay * 0.7;
      decayedR[i] = prevR[offset + i] * decay * 0.7;
    }

    plcBuffer.copyToChannel(decayedL as unknown as Float32Array<ArrayBuffer>, 0);
    if (this.lastFrame.channels === 2) {
      plcBuffer.copyToChannel(decayedR as unknown as Float32Array<ArrayBuffer>, 1);
    }

    const source = this.audioCtx.createBufferSource();
    source.buffer = plcBuffer;
    source.connect(this.outputNode);
    const startTime = Math.max(ctxTime, this.nextPlayTime);
    source.start(startTime);
    this.nextPlayTime = startTime + len / this.lastFrame.sampleRate;
  }

  private getEffectiveBufferMs(): number {
    if (!this.config.adaptiveJitter) {
      return this.config.bufferSizeMs;
    }
    // Adaptive: base + 2.5 * estimated jitter
    const adaptiveTarget = this.config.bufferSizeMs + this.jitterEstimateMs * 2.2;
    return Math.min(200, Math.max(this.config.bufferSizeMs, adaptiveTarget));
  }

  public updateRtt(rtt: number) {
    this.smoothedRttMs = this.smoothedRttMs * 0.8 + rtt * 0.2;
  }

  public getTelemetry(bitrateKbps: number, peakL: number, peakR: number, rms: number): StreamTelemetry {
    const totalLost = this.droppedPackets;
    const totalExpected = this.packetsReceived + totalLost;
    const lossPct = totalExpected > 0 ? (totalLost / totalExpected) * 100 : 0;
    const effectiveBuffer = this.getEffectiveBufferMs();
    const fillPercent = Math.min(100, (this.currentBufferMs / Math.max(1, effectiveBuffer)) * 100);

    // Audio Latency = Network One-Way Latency (RTT/2) + Jitter Buffer Delay + Hardware Output (~4ms)
    const audioLatency = this.smoothedRttMs * 0.5 + this.currentBufferMs + 3.8;

    let networkQuality: StreamTelemetry['networkQuality'] = 'excellent';
    if (this.smoothedRttMs > 40 || lossPct > 2.5 || this.jitterEstimateMs > 12) {
      networkQuality = 'poor';
    } else if (this.smoothedRttMs > 20 || lossPct > 1.0 || this.jitterEstimateMs > 6) {
      networkQuality = 'fair';
    } else if (this.smoothedRttMs > 8 || this.jitterEstimateMs > 3) {
      networkQuality = 'good';
    }

    return {
      rttMs: Math.round(this.smoothedRttMs * 10) / 10,
      audioLatencyMs: Math.round(audioLatency * 10) / 10,
      jitterMs: Math.round(this.jitterEstimateMs * 10) / 10,
      packetLossPercent: Math.round(lossPct * 100) / 100,
      bitrateKbps: Math.round(bitrateKbps),
      bufferFillMs: Math.round(this.currentBufferMs * 10) / 10,
      bufferFillPercent: Math.round(fillPercent),
      packetsSent: 0,
      packetsReceived: this.packetsReceived,
      underruns: this.underruns,
      overruns: this.overruns,
      signalRssi: -42 - Math.min(40, Math.round(this.jitterEstimateMs * 3)),
      peakDbfsLeft: peakL,
      peakDbfsRight: peakR,
      rmsDbfs: rms,
      isClipping: peakL >= -0.1 || peakR >= -0.1,
      networkQuality,
    };
  }

  public resetStats() {
    this.underruns = 0;
    this.overruns = 0;
    this.droppedPackets = 0;
    this.packetsReceived = 0;
    this.queue = [];
  }
}
