/**
 * PulseCast Lossless Session Audio Recorder
 * Records real-time 48kHz stereo master stream into broadcast-quality WAV files.
 */

export interface RecorderTelemetry {
  isRecording: boolean;
  elapsedSec: number;
  sampleCount: number;
  fileSizeBytes: number;
}

export class AudioRecorder {
  private audioCtx: AudioContext | null = null;
  private recorderNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  private recordedLeft: Float32Array[] = [];
  private recordedRight: Float32Array[] = [];
  private totalSamples: number = 0;
  private isRecording: boolean = false;
  private startTime: number = 0;
  private timer: number | null = null;
  private sampleRate: number = 48000;

  private telemetryCallback: ((t: RecorderTelemetry) => void) | null = null;

  public start(ctx: AudioContext, sourceNode: AudioNode, onTelemetry?: (t: RecorderTelemetry) => void) {
    if (this.isRecording) return;
    this.audioCtx = ctx;
    this.sampleRate = ctx.sampleRate || 48000;
    this.telemetryCallback = onTelemetry || null;
    this.recordedLeft = [];
    this.recordedRight = [];
    this.totalSamples = 0;
    this.isRecording = true;
    this.startTime = performance.now();

    // Use 4096 sample capture node routed through a muted gain to keep processing alive without audio doubling
    this.recorderNode = ctx.createScriptProcessor(4096, 2, 2);
    this.silentGainNode = ctx.createGain();
    this.silentGainNode.gain.value = 0;

    sourceNode.connect(this.recorderNode);
    this.recorderNode.connect(this.silentGainNode);
    this.silentGainNode.connect(ctx.destination);

    this.recorderNode.onaudioprocess = (e) => {
      if (!this.isRecording) return;
      const left = e.inputBuffer.getChannelData(0);
      const right = e.inputBuffer.getChannelData(1);

      this.recordedLeft.push(new Float32Array(left));
      this.recordedRight.push(new Float32Array(right));
      this.totalSamples += left.length;

      // Silence the output buffer so it never duplicates into the master destination
      if (e.outputBuffer) {
        e.outputBuffer.getChannelData(0).fill(0);
        e.outputBuffer.getChannelData(1).fill(0);
      }
    };

    this.timer = window.setInterval(() => {
      if (this.telemetryCallback) {
        const elapsed = Math.round((performance.now() - this.startTime) / 1000);
        const bytes = 44 + this.totalSamples * 2 * 2; // 16-bit stereo PCM
        this.telemetryCallback({
          isRecording: true,
          elapsedSec: elapsed,
          sampleCount: this.totalSamples,
          fileSizeBytes: bytes,
        });
      }
    }, 250);
  }

  public stop(): Blob | null {
    if (!this.isRecording) return null;
    this.isRecording = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.recorderNode) {
      try {
        this.recorderNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.recorderNode = null;
    }

    if (this.silentGainNode) {
      try {
        this.silentGainNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.silentGainNode = null;
    }

    const wavBlob = this.exportWav();
    this.recordedLeft = [];
    this.recordedRight = [];

    if (this.telemetryCallback) {
      this.telemetryCallback({
        isRecording: false,
        elapsedSec: 0,
        sampleCount: 0,
        fileSizeBytes: 0,
      });
    }

    return wavBlob;
  }

  public download(blob: Blob, filename?: string) {
    const defaultName = `PulseCast-Master-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.wav`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || defaultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  private exportWav(): Blob {
    const numChannels = 2;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = this.sampleRate * blockAlign;
    const dataSize = this.totalSamples * blockAlign;

    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // RIFF identifier
    this.writeString(view, 0, 'RIFF');
    // RIFF chunk length
    view.setUint32(4, 36 + dataSize, true);
    // RIFF type
    this.writeString(view, 8, 'WAVE');
    // format chunk identifier
    this.writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (1 = PCM)
    view.setUint16(20, 1, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, this.sampleRate, true);
    // byte rate
    view.setUint32(28, byteRate, true);
    // block align
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, 16, true);
    // data chunk identifier
    this.writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataSize, true);

    // Write interleaved 16-bit PCM audio samples
    let offset = 44;
    for (let chunkIdx = 0; chunkIdx < this.recordedLeft.length; chunkIdx++) {
      const leftChunk = this.recordedLeft[chunkIdx];
      const rightChunk = this.recordedRight[chunkIdx];
      const len = leftChunk.length;

      for (let i = 0; i < len; i++) {
        // Clamp and convert Float32 [-1.0, 1.0] to Int16 [-32768, 32767]
        const sampleL = Math.max(-1, Math.min(1, leftChunk[i]));
        const sampleR = Math.max(-1, Math.min(1, rightChunk[i]));

        const intL = sampleL < 0 ? sampleL * 0x8000 : sampleL * 0x7fff;
        const intR = sampleR < 0 ? sampleR * 0x8000 : sampleR * 0x7fff;

        view.setInt16(offset, intL, true);
        view.setInt16(offset + 2, intR, true);
        offset += 4;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}
