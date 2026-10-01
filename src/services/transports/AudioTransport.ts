export type TransportType = 'lan_wifi' | 'mobile_hotspot' | 'bluetooth_ble' | 'bluetooth_a2dp';

export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface TransportTelemetry {
  rttMs: number;
  throughputKbps: number;
  rssi: number;
  packetLossPercent: number;
  hopLatencyMs: number;
  directPeerIp?: string;
  bytesSent: number;
  bytesReceived: number;
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
