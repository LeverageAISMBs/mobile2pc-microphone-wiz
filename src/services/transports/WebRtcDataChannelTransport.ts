import {
  AudioTransport,
  TransportState,
  TransportTelemetry,
  TransportType,
  WebRtcTelemetry,
} from './AudioTransport';

export interface WebRtcTransportOptions {
  role: 'transmitter' | 'receiver';
  sessionCode: string;
  directGatewayIp?: string;
  signalingHost?: string;
}

export class WebRtcDataChannelTransport implements AudioTransport {
  public type: TransportType = 'webrtc_p2p';
  public state: TransportState = 'disconnected';

  private options: WebRtcTransportOptions;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingWs: WebSocket | null = null;
  private radioBroadcastChannel: BroadcastChannel | null = null;

  private packetCallback: ((data: ArrayBuffer) => void) | null = null;
  private controlCallback: ((msg: Record<string, unknown>) => void) | null = null;
  private stateCallback: ((state: TransportState, error?: string) => void) | null = null;

  // Telemetry metrics
  private totalBytesSent: number = 0;
  private totalBytesReceived: number = 0;
  private bytesSentSec: number = 0;
  private bytesReceivedSec: number = 0;
  private throughputRateKbps: number = 0;
  private bitrateTimer: number | null = null;
  private rttEstimateMs: number = 8.5;
  private packetLossPct: number = 0;
  private packetsSentCount: number = 0;
  private packetsReceivedCount: number = 0;
  private packetsLostCount: number = 0;
  private candidateType: 'host' | 'srflx' | 'prflx' | 'relay' = 'host';
  private localCandidateStr: string = 'Local Host (LAN / SoftAP)';
  private remoteCandidateStr: string = 'Peer Host';

  // Manual SDP exchange cache for isolated / offline pairing
  public localSdpJson: string = '';
  public onLocalSdpGenerated?: (sdpJson: string) => void;

  constructor(options: WebRtcTransportOptions) {
    this.options = options;

    // Cross-tab broadcast channel for local peer simulation
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        const channelName = `pulsecast_webrtc_sig_${options.sessionCode || 'room'}`;
        this.radioBroadcastChannel = new BroadcastChannel(channelName);
        this.radioBroadcastChannel.onmessage = (event) => {
          this.handleSignalingMessage(event.data);
        };
      } catch (e) {
        // ignore
      }
    }
  }

  public async connect(): Promise<void> {
    this.updateState('connecting');

    try {
      // Connect to local signaling WebSocket to exchange SDP & ICE automatically
      await this.connectSignalingWebSocket();

      // Setup RTCPeerConnection with STUN host resolution
      const config: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 2,
      };

      this.pc = new RTCPeerConnection(config);

      this.pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignalingMessage({
            type: 'SIGNAL_ICE',
            candidate: event.candidate.toJSON(),
          });
        }
      };

      this.pc.oniceconnectionstatechange = () => {
        if (!this.pc) return;
        const iceState = this.pc.iceConnectionState;
        if (iceState === 'connected' || iceState === 'completed') {
          this.updateState('connected');
        } else if (iceState === 'disconnected' || iceState === 'failed') {
          this.updateState('reconnecting', 'WebRTC P2P direct link interrupted');
        } else if (iceState === 'closed') {
          this.updateState('disconnected');
        }
      };

      this.pc.onconnectionstatechange = () => {
        if (!this.pc) return;
        if (this.pc.connectionState === 'connected') {
          this.updateState('connected');
          this.startStatsTimer();
        }
      };

      if (this.options.role === 'transmitter') {
        // Transmitter creates low-latency unordered RTCDataChannel
        this.dataChannel = this.pc.createDataChannel('pulsecast-audio-p2p', {
          ordered: false, // Disables head-of-line blocking for real-time audio
          maxRetransmits: 0, // True UDP-like mode; skips late retransmissions
        });
        this.setupDataChannel(this.dataChannel);

        // Create Offer
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);

        this.localSdpJson = JSON.stringify(offer);
        if (this.onLocalSdpGenerated) this.onLocalSdpGenerated(this.localSdpJson);

        this.sendSignalingMessage({
          type: 'SIGNAL_OFFER',
          sdp: offer,
        });
      } else {
        // Receiver waits for incoming RTCDataChannel
        this.pc.ondatachannel = (event) => {
          this.dataChannel = event.channel;
          this.setupDataChannel(this.dataChannel);
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.updateState('failed', `WebRTC setup error: ${msg}`);
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      this.updateState('connected');
      this.startStatsTimer();
    };

    channel.onclose = () => {
      this.updateState('disconnected', 'WebRTC DataChannel closed');
    };

    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.bytesReceivedSec += event.data.byteLength;
        this.totalBytesReceived += event.data.byteLength;
        this.packetsReceivedCount++;
        if (this.packetCallback) {
          this.packetCallback(event.data);
        }
      } else if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data);
          if (this.controlCallback) {
            this.controlCallback(parsed);
          }
        } catch (e) {
          // ignore
        }
      }
    };
  }

  private async connectSignalingWebSocket(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        let host = window.location.host;
        if (this.options.directGatewayIp) {
          host = `${this.options.directGatewayIp}:3000`;
        } else if (this.options.signalingHost) {
          host = this.options.signalingHost;
        }

        const wsUrl = `${protocol}//${host}/ws/audio?code=${encodeURIComponent(
          this.options.sessionCode
        )}&role=${this.options.role}&device=WebRTC_P2P`;

        this.signalingWs = new WebSocket(wsUrl);

        this.signalingWs.onopen = () => {
          resolve();
        };

        this.signalingWs.onmessage = (event) => {
          if (typeof event.data === 'string') {
            try {
              const msg = JSON.parse(event.data);
              this.handleSignalingMessage(msg);
            } catch (e) {
              // ignore
            }
          }
        };

        this.signalingWs.onerror = () => {
          // Resolve anyway to permit manual SDP or local broadcast exchange
          resolve();
        };
      } catch (e) {
        resolve();
      }
    });
  }

  private sendSignalingMessage(msg: Record<string, unknown>) {
    // 1. Send via WebSocket signaling server
    if (this.signalingWs && this.signalingWs.readyState === WebSocket.OPEN) {
      try {
        this.signalingWs.send(JSON.stringify(msg));
      } catch (e) {
        // ignore
      }
    }

    // 2. Also broadcast over local tab BroadcastChannel
    if (this.radioBroadcastChannel) {
      try {
        this.radioBroadcastChannel.postMessage(msg);
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Handles incoming SDP Offer, Answer, or ICE candidate
   */
  public async handleSignalingMessage(msg: any): Promise<void> {
    if (!msg || !this.pc) return;

    try {
      if (msg.type === 'SIGNAL_OFFER' && this.options.role === 'receiver') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);

        this.localSdpJson = JSON.stringify(answer);
        if (this.onLocalSdpGenerated) this.onLocalSdpGenerated(this.localSdpJson);

        this.sendSignalingMessage({
          type: 'SIGNAL_ANSWER',
          sdp: answer,
        });
      } else if (msg.type === 'SIGNAL_ANSWER' && this.options.role === 'transmitter') {
        if (this.pc.signalingState !== 'stable') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        }
      } else if (msg.type === 'SIGNAL_ICE' && msg.candidate) {
        await this.pc.addIceCandidate(new RTCIceCandidate(msg.candidate));
      }
    } catch (err) {
      console.warn('[PulseCast WebRTC] Signaling processing error:', err);
    }
  }

  /**
   * Allows manual pasting of remote SDP for air-gapped / router-isolated pairing
   */
  public async applyManualRemoteSdp(sdpString: string): Promise<boolean> {
    if (!this.pc) return false;
    try {
      const parsed = JSON.parse(sdpString);
      await this.handleSignalingMessage({
        type: this.options.role === 'receiver' ? 'SIGNAL_OFFER' : 'SIGNAL_ANSWER',
        sdp: parsed,
      });
      return true;
    } catch (e) {
      console.warn('Manual SDP error:', e);
      return false;
    }
  }

  public send(packet: ArrayBuffer): boolean {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      return false;
    }

    try {
      this.dataChannel.send(packet);
      this.bytesSentSec += packet.byteLength;
      this.totalBytesSent += packet.byteLength;
      this.packetsSentCount++;
      return true;
    } catch (e) {
      return false;
    }
  }

  public sendControl(msg: Record<string, unknown>): void {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify(msg));
      } catch (e) {
        // ignore
      }
    }
  }

  public disconnect(): void {
    this.stopStatsTimer();
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        // ignore
      }
      this.dataChannel = null;
    }
    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {
        // ignore
      }
      this.pc = null;
    }
    if (this.signalingWs) {
      try {
        this.signalingWs.close();
      } catch (e) {
        // ignore
      }
      this.signalingWs = null;
    }
    if (this.radioBroadcastChannel) {
      try {
        this.radioBroadcastChannel.close();
      } catch (e) {
        // ignore
      }
      this.radioBroadcastChannel = null;
    }
    this.updateState('disconnected');
  }

  public onPacket(cb: (data: ArrayBuffer) => void): void {
    this.packetCallback = cb;
  }

  public onControlMessage(cb: (msg: Record<string, unknown>) => void): void {
    this.controlCallback = cb;
  }

  public onStateChange(cb: (state: TransportState, error?: string) => void): void {
    this.stateCallback = cb;
  }

  public getTelemetry(): TransportTelemetry {
    const webrtcStats: WebRtcTelemetry = {
      candidateType: this.candidateType,
      localCandidate: this.localCandidateStr,
      remoteCandidate: this.remoteCandidateStr,
      packetsLost: this.packetsLostCount,
      packetsSent: this.packetsSentCount,
      packetsReceived: this.packetsReceivedCount,
      rttMs: this.rttEstimateMs,
      availableOutgoingBitrateKbps: Math.round(this.throughputRateKbps * 1.2),
      dataChannelState: this.dataChannel?.readyState || 'closed',
    };

    return {
      rttMs: this.rttEstimateMs,
      throughputKbps: Math.round(this.throughputRateKbps),
      rssi: -45,
      packetLossPercent: this.packetLossPct,
      hopLatencyMs: Math.round(this.rttEstimateMs * 0.5 * 10) / 10,
      bytesSent: this.totalBytesSent,
      bytesReceived: this.totalBytesReceived,
      webrtc: webrtcStats,
    };
  }

  private updateState(state: TransportState, error?: string) {
    this.state = state;
    if (this.stateCallback) {
      this.stateCallback(state, error);
    }
  }

  private startStatsTimer() {
    this.stopStatsTimer();
    this.bitrateTimer = window.setInterval(async () => {
      const bytes =
        this.options.role === 'transmitter' ? this.bytesSentSec : this.bytesReceivedSec;
      this.throughputRateKbps = (bytes * 8) / 1000;
      this.bytesSentSec = 0;
      this.bytesReceivedSec = 0;

      // Extract real RTCPeerConnection statistics
      if (this.pc) {
        try {
          const stats = await this.pc.getStats();
          stats.forEach((report) => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                this.rttEstimateMs = Math.round(report.currentRoundTripTime * 1000 * 10) / 10;
              }
            } else if (report.type === 'local-candidate') {
              if (report.candidateType) {
                this.candidateType = report.candidateType;
              }
              if (report.address) {
                this.localCandidateStr = `${report.address}:${report.port} (${report.candidateType})`;
              }
            } else if (report.type === 'remote-candidate') {
              if (report.address) {
                this.remoteCandidateStr = `${report.address}:${report.port} (${report.candidateType})`;
              }
            }
          });
        } catch (e) {
          // ignore
        }
      }
    }, 1000);
  }

  private stopStatsTimer() {
    if (this.bitrateTimer) {
      clearInterval(this.bitrateTimer);
      this.bitrateTimer = null;
    }
  }
}
