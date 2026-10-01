import { AudioCodec, BufferConfig, StreamTelemetry } from '../types/audio';
import { CodecEngine } from './codecEngine';
import { JitterBuffer } from './jitterBuffer';
import { WebSocketTransport } from './transports/WebSocketTransport';
import { WebBluetoothGattTransport } from './transports/WebBluetoothGattTransport';
import { AudioTransport, TransportType, TransportState } from './transports/AudioTransport';
import { AudioWorkletManager } from './worklets/AudioWorkletManager';

export type AudioSourceType = 'mic' | 'sine1k' | 'pinknoise' | 'guitar' | 'drums';

export interface StreamerCallbacks {
  onTelemetry: (telemetry: StreamTelemetry) => void;
  onConnectionChange: (connected: boolean, peerCount: { rx: number; tx: number }) => void;
  onError: (err: string) => void;
  onTransportStateChange?: (state: TransportState, error?: string) => void;
}

export class AudioStreamer {
  private role: 'transmitter' | 'receiver';
  private sessionCode: string;
  private audioCtx: AudioContext | null = null;
  private callbacks: StreamerCallbacks;

  // Transport Layer
  private transport: AudioTransport;
  private currentTransportType: TransportType = 'lan_wifi';
  private directGatewayIp?: string;
  private selectedInputDeviceId?: string;
  private selectedOutputDeviceId: string = 'default';
  private bluetoothLatencyOffsetMs: number = 35;
  private isBluetoothBridgeActive: boolean = false;

  // Audio Nodes
  private inputGainNode: GainNode | null = null;
  private outputGainNode: GainNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private captureWorkletNode: AudioWorkletNode | null = null;
  private outputAudioElement: HTMLAudioElement | null = null;
  private mediaStreamDest: MediaStreamAudioDestinationNode | null = null;
  private micStream: MediaStream | null = null;
  private synthInterval: number | null = null;

  // Signal Generator state
  private activeSource: AudioSourceType = 'mic';
  private drumBeatIndex: number = 0;

  // Processing state
  private isStreaming: boolean = false;
  private isMuted: boolean = false;
  private isLoopbackMonitor: boolean = false;
  private seq: number = 0;
  private codec: AudioCodec = 'opus';
  private bufferConfig: BufferConfig = {
    bufferSizeMs: 20,
    adaptiveJitter: true,
    packetLossConcealment: true,
    dropLatePackets: true,
    sampleRate: 48000,
    channels: 2,
    frameSizeMs: 10,
  };

  // Services
  private jitterBuffer: JitterBuffer;

  // Telemetry loop
  private telemetryInterval: number | null = null;

  constructor(
    role: 'transmitter' | 'receiver',
    sessionCode: string,
    callbacks: StreamerCallbacks,
    transportType: TransportType = 'lan_wifi',
    directGatewayIp?: string
  ) {
    this.role = role;
    this.sessionCode = sessionCode;
    this.callbacks = callbacks;
    this.currentTransportType = transportType;
    this.directGatewayIp = directGatewayIp;
    this.jitterBuffer = new JitterBuffer(this.bufferConfig);

    this.transport = new WebSocketTransport({
      type: transportType === 'mobile_hotspot' ? 'mobile_hotspot' : 'lan_wifi',
      sessionCode,
      role,
      directGatewayIp,
    });

    this.setupTransportListeners();
  }

  private setupTransportListeners() {
    this.transport.onPacket((data) => {
      const decoded = CodecEngine.decode(data);
      if (decoded) {
        this.jitterBuffer.pushPacket(decoded);
      }
    });

    this.transport.onControlMessage((msg) => {
      if (msg.type === 'SESSION_PEERS') {
        this.callbacks.onConnectionChange(true, {
          rx: Number(msg.receiversCount) || 1,
          tx: Number(msg.transmittersCount) || 0,
        });
      }
    });

    this.transport.onStateChange((state, error) => {
      const isConnected = state === 'connected';
      this.callbacks.onConnectionChange(isConnected, { rx: 1, tx: 0 });
      if (this.callbacks.onTransportStateChange) {
        this.callbacks.onTransportStateChange(state, error);
      }
      if (error) {
        this.callbacks.onError(error);
      }
    });
  }

  public async initAudio(): Promise<boolean> {
    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioContextClass({
          sampleRate: 48000,
          latencyHint: 'interactive',
        });
      }

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      // Input nodes
      this.inputGainNode = this.audioCtx.createGain();
      this.inputGainNode.gain.value = 1.0;

      this.inputAnalyser = this.audioCtx.createAnalyser();
      this.inputAnalyser.fftSize = 1024;
      this.inputAnalyser.smoothingTimeConstant = 0.8;
      this.inputGainNode.connect(this.inputAnalyser);

      // Output nodes
      this.outputGainNode = this.audioCtx.createGain();
      this.outputGainNode.gain.value = 1.0;

      this.pannerNode = this.audioCtx.createStereoPanner();
      this.pannerNode.pan.value = 0;

      this.outputAnalyser = this.audioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 1024;
      this.outputAnalyser.smoothingTimeConstant = 0.8;

      this.outputGainNode.connect(this.pannerNode);
      this.pannerNode.connect(this.outputAnalyser);
      this.outputAnalyser.connect(this.audioCtx.destination);

      // Connect JitterBuffer output
      await this.jitterBuffer.setAudioContext(this.audioCtx, this.outputGainNode);

      // Universal Output Device Bridge (for browsers with HTMLAudioElement setSinkId)
      try {
        this.mediaStreamDest = this.audioCtx.createMediaStreamDestination();
        this.outputAnalyser.connect(this.mediaStreamDest);
        this.outputAudioElement = new Audio();
        this.outputAudioElement.srcObject = this.mediaStreamDest.stream;
        this.outputAudioElement.volume = 1.0;
        this.outputAudioElement.play().catch(() => {});
      } catch (e) {
        // fallback
      }

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.callbacks.onError(`Failed to initialize Web Audio: ${msg}`);
      return false;
    }
  }

  public async connectTransport(
    type: TransportType = this.currentTransportType,
    gatewayIp?: string,
    customHost?: string,
    bleMtuSize?: number
  ) {
    this.currentTransportType = type;
    this.directGatewayIp = gatewayIp;

    if (type === 'bluetooth_ble') {
      this.transport.disconnect();
      this.transport = new WebBluetoothGattTransport({
        role: this.role,
        sessionCode: this.sessionCode,
        mtuPayloadSize: bleMtuSize || 240,
      });
      this.setupTransportListeners();
      await this.transport.connect();
    } else {
      if (!(this.transport instanceof WebSocketTransport)) {
        this.transport.disconnect();
        this.transport = new WebSocketTransport({
          type: type === 'mobile_hotspot' ? 'mobile_hotspot' : 'lan_wifi',
          sessionCode: this.sessionCode,
          role: this.role,
          directGatewayIp: gatewayIp,
        });
        this.setupTransportListeners();
      }
      await (this.transport as WebSocketTransport).connect({
        type: type === 'mobile_hotspot' ? 'mobile_hotspot' : 'lan_wifi',
        directGatewayIp: gatewayIp,
        customHost,
      });
    }
  }

  public async setAudioSink(deviceId: string): Promise<boolean> {
    this.selectedOutputDeviceId = deviceId;
    let success = false;

    // 1. Try standard W3C Web Audio setSinkId on AudioContext (Chrome 110+, Edge)
    if (
      this.audioCtx &&
      'setSinkId' in this.audioCtx &&
      typeof (this.audioCtx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId === 'function'
    ) {
      try {
        const targetId = deviceId === 'default' ? '' : deviceId;
        await (this.audioCtx as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(targetId);
        success = true;
      } catch (e) {
        console.warn('[PulseCast] audioCtx.setSinkId failed, trying HTMLAudioElement bridge:', e);
      }
    }

    // 2. Try HTMLAudioElement bridge with setSinkId (universal fallback)
    if (
      !success &&
      this.outputAudioElement &&
      'setSinkId' in this.outputAudioElement &&
      typeof (this.outputAudioElement as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId === 'function'
    ) {
      try {
        const targetId = deviceId === 'default' ? '' : deviceId;
        await (this.outputAudioElement as unknown as { setSinkId: (id: string) => Promise<void> }).setSinkId(targetId);
        await this.outputAudioElement.play();
        success = true;
      } catch (e) {
        console.warn('[PulseCast] audioElement.setSinkId failed:', e);
      }
    }

    return success;
  }

  private sendEncodedAudioFrame(inputL: Float32Array, inputR: Float32Array) {
    if (!this.isStreaming) return;

    const len = inputL.length;
    const leftToSend = new Float32Array(len);
    const rightToSend = new Float32Array(len);

    if (!this.isMuted) {
      leftToSend.set(inputL);
      rightToSend.set(inputR);
    }

    const packet = CodecEngine.encode(
      leftToSend,
      rightToSend,
      this.seq++,
      performance.now(),
      this.audioCtx?.sampleRate || 48000,
      this.bufferConfig.channels,
      this.codec
    );

    this.transport.send(packet.data);

    if (this.isLoopbackMonitor && this.role === 'transmitter') {
      const decoded = CodecEngine.decode(packet.data);
      if (decoded) {
        this.jitterBuffer.pushPacket(decoded);
      }
    }
  }

  public async startTransmitting(sourceType: AudioSourceType = 'mic', inputDeviceId?: string) {
    await this.initAudio();
    if (!this.audioCtx || !this.inputGainNode) return;

    this.activeSource = sourceType;
    this.selectedInputDeviceId = inputDeviceId;
    this.isStreaming = true;

    if (sourceType === 'mic') {
      try {
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000,
        };
        if (inputDeviceId && inputDeviceId !== 'default') {
          audioConstraints.deviceId = { exact: inputDeviceId };
        }

        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
        const sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
        sourceNode.connect(this.inputGainNode);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.callbacks.onError(
          `Microphone permission denied or unavailable: ${msg}. Falling back to 1kHz Reference Tone.`
        );
        this.activeSource = 'sine1k';
        this.startSyntheticSource();
        return;
      }
    } else {
      this.startSyntheticSource();
    }

    // Attempt zero-jitter AudioWorklet capture node on the high-priority audio thread
    try {
      const workletRegistered = await AudioWorkletManager.registerWorklets(this.audioCtx);
      if (workletRegistered) {
        this.captureWorkletNode = AudioWorkletManager.createCaptureNode(this.audioCtx);
        if (this.captureWorkletNode) {
          this.inputGainNode.connect(this.captureWorkletNode);
          this.captureWorkletNode.connect(this.audioCtx.destination);
          this.captureWorkletNode.port.onmessage = (event) => {
            const data = event.data;
            if (data && data.type === 'CAPTURE_CHUNK' && this.isStreaming) {
              this.sendEncodedAudioFrame(data.left, data.right);
            }
          };
        }
      }
    } catch (e) {
      console.warn('[PulseCast] Capture worklet registration failed, using ScriptProcessor fallback:', e);
      this.captureWorkletNode = null;
    }

    // Fallback: ScriptProcessorNode if AudioWorklet is not available
    if (!this.captureWorkletNode) {
      const bufferSize = 512; // ~10.6ms @ 48kHz
      this.processorNode = this.audioCtx.createScriptProcessor(bufferSize, 2, 2);
      this.inputGainNode.connect(this.processorNode);
      this.processorNode.connect(this.audioCtx.destination);

      this.processorNode.onaudioprocess = (e) => {
        if (!this.isStreaming) return;
        const inputL = e.inputBuffer.getChannelData(0);
        const inputR = e.inputBuffer.getChannelData(1);
        this.sendEncodedAudioFrame(inputL, inputR);
      };
    }

    this.startTelemetryLoop();
  }

  /**
   * Starts capturing an incoming Bluetooth A2DP audio stream from the PC's Bluetooth adapter
   */
  public async startBluetoothReceiverBridge(deviceId: string): Promise<boolean> {
    await this.initAudio();
    if (!this.audioCtx || !this.inputGainNode) return false;

    this.isBluetoothBridgeActive = true;
    this.selectedInputDeviceId = deviceId;
    this.currentTransportType = 'bluetooth_a2dp';

    try {
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
        this.micStream = null;
      }

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 2,
        sampleRate: 48000,
      };
      if (deviceId && deviceId !== 'default') {
        audioConstraints.deviceId = { exact: deviceId };
      }

      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      const sourceNode = this.audioCtx.createMediaStreamSource(this.micStream);
      sourceNode.connect(this.inputGainNode);

      // Route through local processor so receiver visualizer and output driver receive the Bluetooth audio
      if (!this.processorNode) {
        this.processorNode = this.audioCtx.createScriptProcessor(512, 2, 2);
        this.inputGainNode.connect(this.processorNode);
        this.processorNode.connect(this.audioCtx.destination);

        this.processorNode.onaudioprocess = (e) => {
          if (!this.isBluetoothBridgeActive) return;
          const inputL = e.inputBuffer.getChannelData(0);
          const inputR = e.inputBuffer.getChannelData(1);

          // Direct feed into jitter buffer for virtual driver output
          const frame = {
            leftChannel: new Float32Array(inputL),
            rightChannel: new Float32Array(inputR),
            seq: this.seq++,
            timestamp: performance.now(),
            sampleRate: this.audioCtx?.sampleRate || 48000,
            channels: 2,
          };
          this.jitterBuffer.pushPacket(frame);
        };
      }

      this.startTelemetryLoop();
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.callbacks.onError(`Failed to bridge Bluetooth device: ${msg}`);
      return false;
    }
  }

  public setBluetoothLatencyOffset(ms: number) {
    this.bluetoothLatencyOffsetMs = ms;
  }

  public stopTransmitting() {
    this.isStreaming = false;
    if (this.captureWorkletNode) {
      try {
        this.captureWorkletNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.captureWorkletNode = null;
    }

    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch (e) {
        // ignore
      }
      this.processorNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }

  private startSyntheticSource() {
    if (!this.audioCtx || !this.inputGainNode) return;
    if (this.synthInterval) clearInterval(this.synthInterval);

    const osc = this.audioCtx.createOscillator();
    const synthGain = this.audioCtx.createGain();

    if (this.activeSource === 'sine1k') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, this.audioCtx.currentTime);
      synthGain.gain.value = 0.25;
      osc.connect(synthGain);
      synthGain.connect(this.inputGainNode);
      osc.start();
    } else if (this.activeSource === 'pinknoise') {
      const bufferSize = this.audioCtx.sampleRate * 2;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
      const whiteNoiseNode = this.audioCtx.createBufferSource();
      whiteNoiseNode.buffer = noiseBuffer;
      whiteNoiseNode.loop = true;
      synthGain.gain.value = 0.35;
      whiteNoiseNode.connect(synthGain);
      synthGain.connect(this.inputGainNode);
      whiteNoiseNode.start();
    } else if (this.activeSource === 'guitar' || this.activeSource === 'drums') {
      const chordFreqs =
        this.activeSource === 'guitar' ? [220, 277.18, 329.63, 440] : [65, 130, 200, 800];
      this.synthInterval = window.setInterval(() => {
        if (!this.audioCtx || !this.inputGainNode || !this.isStreaming) return;
        const now = this.audioCtx.currentTime;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();

        const freq = chordFreqs[this.drumBeatIndex % chordFreqs.length];
        this.drumBeatIndex++;

        o.type = this.activeSource === 'drums' ? 'triangle' : 'sawtooth';
        o.frequency.setValueAtTime(freq, now);
        if (this.activeSource === 'drums') {
          o.frequency.exponentialRampToValueAtTime(30, now + 0.12);
        }

        g.gain.setValueAtTime(0.4, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        o.connect(g);
        g.connect(this.inputGainNode);
        o.start(now);
        o.stop(now + 0.4);
      }, 500);
    }
  }

  private startTelemetryLoop() {
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);

    this.telemetryInterval = window.setInterval(() => {
      const transportTel = this.transport.getTelemetry();

      let peakL = -60;
      let peakR = -60;
      let rms = -60;

      const analyser = this.role === 'transmitter' ? this.inputAnalyser : this.outputAnalyser;
      if (analyser) {
        const timeData = new Float32Array(analyser.fftSize);
        analyser.getFloatTimeDomainData(timeData);

        let maxVal = 0;
        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const val = Math.abs(timeData[i]);
          if (val > maxVal) maxVal = val;
          sumSq += val * val;
        }
        const rmsLinear = Math.sqrt(sumSq / timeData.length);
        peakL = maxVal > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(maxVal))) : -60;
        peakR = peakL;
        rms = rmsLinear > 0.0001 ? Math.max(-60, Math.round(20 * Math.log10(rmsLinear))) : -60;
      }

      const telemetry = this.jitterBuffer.getTelemetry(
        transportTel.throughputKbps,
        peakL,
        peakR,
        rms
      );
      telemetry.rttMs = transportTel.rttMs;
      telemetry.packetsSent = this.seq;
      telemetry.transportType = this.currentTransportType;
      telemetry.transportState = this.transport.state;
      telemetry.directHopLatencyMs = transportTel.hopLatencyMs;
      telemetry.gatewayIp = this.directGatewayIp;

      // In hotspot mode, adjust estimated audio latency for 1-hop link
      if (this.currentTransportType === 'mobile_hotspot') {
        telemetry.audioLatencyMs = Math.round((transportTel.rttMs * 0.4 + telemetry.bufferFillMs + 2.0) * 10) / 10;
        telemetry.signalRssi = transportTel.rssi;
      } else if (this.currentTransportType === 'bluetooth_a2dp') {
        telemetry.audioLatencyMs = Math.round((this.bluetoothLatencyOffsetMs + telemetry.bufferFillMs + 4.0) * 10) / 10;
        telemetry.rttMs = 35.0;
        telemetry.signalRssi = -52;
        telemetry.bitrateKbps = 328;
      } else if (this.currentTransportType === 'bluetooth_ble') {
        telemetry.audioLatencyMs = Math.round((transportTel.hopLatencyMs + telemetry.bufferFillMs + 4.0) * 10) / 10;
        telemetry.rttMs = transportTel.rttMs;
        telemetry.signalRssi = transportTel.rssi;
        telemetry.bitrateKbps = transportTel.throughputKbps;
        telemetry.ble = transportTel.ble;
      }

      if (this.role === 'transmitter') {
        telemetry.audioEngineMode = this.captureWorkletNode ? 'worklet_thread' : 'script_processor_fallback';
      }
      telemetry.activeAudioSinkDevice = this.selectedOutputDeviceId;

      this.callbacks.onTelemetry(telemetry);
    }, 100);
  }

  public setInputGain(gainLinear: number) {
    if (this.inputGainNode) {
      this.inputGainNode.gain.setValueAtTime(gainLinear, this.audioCtx?.currentTime || 0);
    }
  }

  public setOutputGain(gainLinear: number) {
    if (this.outputGainNode) {
      this.outputGainNode.gain.setValueAtTime(gainLinear, this.audioCtx?.currentTime || 0);
    }
  }

  public setPan(pan: number) {
    if (this.pannerNode) {
      this.pannerNode.pan.setValueAtTime(pan, this.audioCtx?.currentTime || 0);
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.captureWorkletNode) {
      this.captureWorkletNode.port.postMessage({ type: 'SET_MUTE', muted });
    }
  }

  public setLoopbackMonitor(enabled: boolean) {
    this.isLoopbackMonitor = enabled;
  }

  public setCodec(codec: AudioCodec) {
    this.codec = codec;
    this.transport.sendControl({ type: 'CONFIG_UPDATE', codec });
  }

  public updateBufferConfig(config: Partial<BufferConfig>) {
    this.bufferConfig = { ...this.bufferConfig, ...config };
    this.jitterBuffer.updateConfig(this.bufferConfig);
    this.transport.sendControl({ type: 'CONFIG_UPDATE', bufferMs: this.bufferConfig.bufferSizeMs });
  }

  public resetStats() {
    this.seq = 0;
    this.jitterBuffer.resetStats();
  }

  public getInputAnalyser(): AnalyserNode | null {
    return this.inputAnalyser;
  }

  public getOutputAnalyser(): AnalyserNode | null {
    return this.outputAnalyser;
  }

  public getBleTransport(): WebBluetoothGattTransport | null {
    if (this.transport instanceof WebBluetoothGattTransport) {
      return this.transport;
    }
    return null;
  }

  public setBleMtuPayloadSize(bytes: number) {
    if (this.transport instanceof WebBluetoothGattTransport) {
      this.transport.setMtuPayloadSize(bytes);
    }
  }

  public setBlePhyMode(mode: '1M' | '2M' | 'Coded') {
    if (this.transport instanceof WebBluetoothGattTransport) {
      this.transport.setPhyMode(mode);
    }
  }

  public setBleConnectionInterval(intervalMs: number) {
    if (this.transport instanceof WebBluetoothGattTransport) {
      this.transport.setConnectionInterval(intervalMs);
    }
  }

  public async runBleMtuBenchmark(customPayloads?: number[]) {
    if (this.transport instanceof WebBluetoothGattTransport) {
      return await this.transport.runMtuBenchmark(customPayloads);
    }
    return [];
  }

  public destroy() {
    this.stopTransmitting();
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
    this.transport.disconnect();
    this.jitterBuffer.destroy();
    if (this.outputAudioElement) {
      try {
        this.outputAudioElement.pause();
        this.outputAudioElement.srcObject = null;
      } catch (e) {
        // ignore
      }
      this.outputAudioElement = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
