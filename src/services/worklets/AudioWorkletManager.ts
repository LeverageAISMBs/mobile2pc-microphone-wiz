/**
 * PulseCast AudioWorklet Manager
 * Provides zero-jitter, real-time audio capture and playout ring buffer
 * running directly on the high-priority Web Audio rendering thread.
 */

const CAPTURE_PROCESSOR_CODE = `
class PulseCastCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 512; // ~10.6ms @ 48kHz
    this.bufferL = new Float32Array(this.bufferSize);
    this.bufferR = new Float32Array(this.bufferSize);
    this.bufIndex = 0;
    this.isMuted = false;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'SET_MUTE') {
        this.isMuted = !!data.muted;
      } else if (data && data.type === 'SET_BUFFER_SIZE') {
        if (data.bufferSize >= 128 && data.bufferSize <= 2048) {
          this.bufferSize = data.bufferSize;
          this.bufferL = new Float32Array(this.bufferSize);
          this.bufferR = new Float32Array(this.bufferSize);
          this.bufIndex = 0;
        }
      }
    };
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const inputL = input[0];
    const inputR = input.length > 1 ? input[1] : input[0];
    const quantumSize = inputL.length; // standard 128 samples

    for (let i = 0; i < quantumSize; i++) {
      if (this.isMuted) {
        this.bufferL[this.bufIndex] = 0;
        this.bufferR[this.bufIndex] = 0;
      } else {
        this.bufferL[this.bufIndex] = inputL[i];
        this.bufferR[this.bufIndex] = inputR ? inputR[i] : inputL[i];
      }
      this.bufIndex++;

      if (this.bufIndex >= this.bufferSize) {
        // Post full frame buffer with zero-copy transferable buffers
        const sendL = new Float32Array(this.bufferL);
        const sendR = new Float32Array(this.bufferR);
        this.port.postMessage(
          {
            type: 'CAPTURE_CHUNK',
            left: sendL,
            right: sendR,
            timestamp: currentTime,
          },
          [sendL.buffer, sendR.buffer]
        );
        this.bufIndex = 0;
      }
    }

    return true;
  }
}

registerProcessor('pulsecast-capture-processor', PulseCastCaptureProcessor);
`;

const PLAYOUT_PROCESSOR_CODE = `
class PulseCastPlayoutProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 16384 samples ring capacity (~340ms @ 48kHz)
    this.capacity = 16384;
    this.ringL = new Float32Array(this.capacity);
    this.ringR = new Float32Array(this.capacity);
    this.writePos = 0;
    this.readPos = 0;
    this.availableSamples = 0;

    // Playout metrics
    this.underruns = 0;
    this.overruns = 0;
    this.totalRendered = 0;
    this.lastSampleL = 0;
    this.lastSampleR = 0;
    this.decayRate = 0.96;

    this.port.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === 'PUSH_PCM') {
        this.pushPcm(data.left, data.right);
      } else if (data && data.type === 'RESET') {
        this.writePos = 0;
        this.readPos = 0;
        this.availableSamples = 0;
        this.underruns = 0;
      }
    };
  }

  pushPcm(left, right) {
    const len = left.length;
    if (this.availableSamples + len > this.capacity) {
      // Overrun: advance read position to drop oldest samples
      const dropCount = (this.availableSamples + len) - this.capacity;
      this.readPos = (this.readPos + dropCount) % this.capacity;
      this.availableSamples -= dropCount;
      this.overruns++;
    }

    for (let i = 0; i < len; i++) {
      this.ringL[this.writePos] = left[i];
      this.ringR[this.writePos] = right ? right[i] : left[i];
      this.writePos = (this.writePos + 1) % this.capacity;
    }
    this.availableSamples += len;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const outL = output[0];
    const outR = output.length > 1 ? output[1] : null;
    const quantumSize = outL.length; // usually 128

    if (this.availableSamples >= quantumSize) {
      // Normal continuous rendering from ring buffer
      for (let i = 0; i < quantumSize; i++) {
        const valL = this.ringL[this.readPos];
        const valR = this.ringR[this.readPos];
        outL[i] = valL;
        if (outR) outR[i] = valR;

        this.lastSampleL = valL;
        this.lastSampleR = valR;
        this.readPos = (this.readPos + 1) % this.capacity;
      }
      this.availableSamples -= quantumSize;
    } else {
      // Jitter Underrun: Smooth Packet Loss Concealment (PLC) decay
      this.underruns++;
      for (let i = 0; i < quantumSize; i++) {
        if (this.availableSamples > 0) {
          outL[i] = this.ringL[this.readPos];
          if (outR) outR[i] = this.ringR[this.readPos];
          this.lastSampleL = outL[i];
          this.lastSampleR = outR ? outR[i] : outL[i];
          this.readPos = (this.readPos + 1) % this.capacity;
          this.availableSamples--;
        } else {
          // Exponential decay towards zero to prevent speaker pop
          this.lastSampleL *= this.decayRate;
          this.lastSampleR *= this.decayRate;
          outL[i] = this.lastSampleL;
          if (outR) outR[i] = this.lastSampleR;
        }
      }
    }

    this.totalRendered += quantumSize;

    // Send metrics every ~100ms (every ~38 quanta @ 48kHz)
    if (this.totalRendered % (quantumSize * 38) === 0) {
      this.port.postMessage({
        type: 'WORKLET_METRICS',
        availableSamples: this.availableSamples,
        underruns: this.underruns,
        overruns: this.overruns,
      });
    }

    return true;
  }
}

registerProcessor('pulsecast-playout-processor', PulseCastPlayoutProcessor);
`;

const registeredContexts = new WeakSet<AudioContext>();

export class AudioWorkletManager {
  public static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof AudioContext !== 'undefined' &&
      'audioWorklet' in AudioContext.prototype &&
      typeof AudioWorkletNode !== 'undefined'
    );
  }

  public static async registerWorklets(audioCtx: AudioContext): Promise<boolean> {
    if (!AudioWorkletManager.isSupported()) {
      return false;
    }

    if (registeredContexts.has(audioCtx)) {
      return true;
    }

    try {
      // Register Capture Processor via Blob URL
      const captureBlob = new Blob([CAPTURE_PROCESSOR_CODE], {
        type: 'application/javascript; charset=utf-8',
      });
      const captureUrl = URL.createObjectURL(captureBlob);
      await audioCtx.audioWorklet.addModule(captureUrl);
      URL.revokeObjectURL(captureUrl);

      // Register Playout Processor via Blob URL
      const playoutBlob = new Blob([PLAYOUT_PROCESSOR_CODE], {
        type: 'application/javascript; charset=utf-8',
      });
      const playoutUrl = URL.createObjectURL(playoutBlob);
      await audioCtx.audioWorklet.addModule(playoutUrl);
      URL.revokeObjectURL(playoutUrl);

      registeredContexts.add(audioCtx);
      return true;
    } catch (err) {
      console.warn('[PulseCast] AudioWorklet registration failed, falling back to ScriptProcessor:', err);
      return false;
    }
  }

  public static createCaptureNode(audioCtx: AudioContext): AudioWorkletNode | null {
    if (!AudioWorkletManager.isSupported() || !registeredContexts.has(audioCtx)) {
      return null;
    }
    try {
      return new AudioWorkletNode(audioCtx, 'pulsecast-capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
    } catch (e) {
      console.warn('[PulseCast] Could not instantiate AudioWorkletNode for capture:', e);
      return null;
    }
  }

  public static createPlayoutNode(audioCtx: AudioContext): AudioWorkletNode | null {
    if (!AudioWorkletManager.isSupported() || !registeredContexts.has(audioCtx)) {
      return null;
    }
    try {
      return new AudioWorkletNode(audioCtx, 'pulsecast-playout-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [2],
      });
    } catch (e) {
      console.warn('[PulseCast] Could not instantiate AudioWorkletNode for playout:', e);
      return null;
    }
  }
}
