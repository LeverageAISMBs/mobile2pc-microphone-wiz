import { TransportType, TransportState } from '../services/transports/AudioTransport';

export type AudioCodec = 'opus' | 'pcm16' | 'pcm24' | 'flac' | 'float32';

export interface CodecInfo {
  id: AudioCodec;
  name: string;
  bitrateKbps: number;
  sampleRate: number;
  channels: number;
  frameSizeMs: number;
  encodeDelayMs: number;
  description: string;
  lossless: boolean;
  idealFor: string;
}

export interface BufferConfig {
  bufferSizeMs: number;
  adaptiveJitter: boolean;
  packetLossConcealment: boolean;
  dropLatePackets: boolean;
  sampleRate: 44100 | 48000 | 96000;
  channels: 1 | 2;
  frameSizeMs: number;
}

export interface StreamTelemetry {
  sampleRate?: number;
  rttMs: number;
  audioLatencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  bitrateKbps: number;
  bufferFillMs: number;
  bufferFillPercent: number;
  packetsSent: number;
  packetsReceived: number;
  underruns: number;
  overruns: number;
  signalRssi: number; // dBm
  peakDbfsLeft: number;
  peakDbfsRight: number;
  rmsDbfs: number;
  isClipping: boolean;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  transportType?: TransportType;
  transportState?: TransportState;
  directHopLatencyMs?: number;
  gatewayIp?: string;
}

export interface HotspotProfile {
  os: string;
  typicalGateway: string;
  description: string;
}

export interface PairedDevice {
  id: string;
  name: string;
  role: 'transmitter' | 'receiver';
  platform: 'windows' | 'linux' | 'android' | 'ios' | 'macos';
  ipAddress: string;
  rttMs: number;
  rssi: number;
  connectedAt: number;
  activeCodec: AudioCodec;
  driverMode: string;
}

export interface VirtualDriverProfile {
  os: 'windows' | 'linux';
  name: string;
  framework: string;
  targetDevice: string;
  bufferLatencyMs: number;
  sampleRate: number;
  exclusiveMode: boolean;
  status: 'ready' | 'active' | 'configured' | 'setup_required';
  routingTarget: 'Discord' | 'OBS Studio' | 'DAW' | 'System Speakers';
}
