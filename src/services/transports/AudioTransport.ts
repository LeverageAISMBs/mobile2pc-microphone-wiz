export type TransportType = 'lan_wifi' | 'mobile_hotspot' | 'bluetooth_ble' | 'bluetooth_a2dp' | 'webrtc_p2p';

export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface WebRtcTelemetry {
  candidateType: 'host' | 'srflx' | 'prflx' | 'relay';
  localCandidate: string;
  remoteCandidate: string;
  packetsLost: number;
  packetsSent: number;
  packetsReceived: number;
  rttMs: number;
  availableOutgoingBitrateKbps: number;
  dataChannelState: string;
}

export interface BleSlicerTelemetry {
  mtuSize: number;
  slicesSent: number;
  slicesReceived: number;
  slicesDropped: number;
  reassembledFrames: number;
  avgSlicesPerFrame: number;
  checksumErrors: number;
  connectionIntervalMs: number;
  phyMode: '1M' | '2M' | 'Coded';
  flowBackpressureQueue: number;
  isHardwareDevice: boolean;
  deviceName?: string;
}

export interface MtuBenchmarkResult {
  payloadSize: number;
  rttMs: number;
  throughputKbps: number;
  packetLossPercent: number;
  isRecommended: boolean;
}

export interface TransportTelemetry {
  rttMs: number;
  throughputKbps: number;
  rssi: number;
  packetLossPercent: number;
  hopLatencyMs: number;
  directPeerIp?: string;
  bytesSent: number;
  bytesReceived: number;
  ble?: BleSlicerTelemetry;
  webrtc?: WebRtcTelemetry;
}

export interface HotspotNetworkInfo {
  name: string;
  address: string;
  type: 'hotspot' | 'wifi' | 'ethernet' | 'loopback';
  estimatedSubnet: string;
  gatewayIp?: string;
  internal?: boolean;
}

export interface AudioTransport {
  type: TransportType;
  state: TransportState;
  connect(options?: {
    host?: string;
    sessionCode?: string;
    role?: 'transmitter' | 'receiver';
    device?: string;
  }): Promise<void>;
  send(packet: ArrayBuffer): boolean;
  sendControl(msg: Record<string, unknown>): void;
  disconnect(): void;
  onPacket(cb: (data: ArrayBuffer) => void): void;
  onControlMessage(cb: (msg: Record<string, unknown>) => void): void;
  onStateChange(cb: (state: TransportState, error?: string) => void): void;
  getTelemetry(): TransportTelemetry;
}
