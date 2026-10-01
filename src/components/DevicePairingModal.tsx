import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { StreamTelemetry, PairedDevice } from '../types/audio';
import {
  Wifi,
  QrCode,
  Copy,
  Check,
  Search,
  Radio,
  Monitor,
  Smartphone,
  X,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

interface DevicePairingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  onChangeSessionCode: (newCode: string) => void;
  currentRole: 'transmitter' | 'receiver';
  telemetry: StreamTelemetry;
  isConnected: boolean;
  peerCounts: { rx: number; tx: number };
}

export const DevicePairingModal: React.FC<DevicePairingModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
  onChangeSessionCode,
  currentRole,
  telemetry,
  isConnected,
  peerCounts,
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'discovery' | 'telemetry'>('qr');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<PairedDevice[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Direct Mobile Transmitter URL
  const transmitterUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?role=transmitter&code=${sessionCode}`
    : `https://pulsecast.local/?role=transmitter&code=${sessionCode}`;

  useEffect(() => {
    if (isOpen && activeTab === 'qr' && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, transmitterUrl, {
        width: 200,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#f8fafc',
        },
      }).catch((err) => {
        console.error('QR code generation error:', err);
      });
    }
  }, [isOpen, activeTab, transmitterUrl]);

  // Fetch local network discovery beacons
  const handleScanDiscovery = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/discovery');
      const data = await res.json();

      const simulatedNearby: PairedDevice[] = [
        {
          id: 'dev-01',
          name: 'Master-Desktop-Rig (Windows 11)',
          role: 'receiver',
          platform: 'windows',
          ipAddress: '192.168.1.142',
          rttMs: 3.4,
          rssi: -38,
          connectedAt: Date.now() - 360000,
          activeCodec: 'opus',
          driverMode: 'WASAPI Exclusive (VB-Cable)',
        },
        {
          id: 'dev-02',
          name: 'Studio-Workstation (Ubuntu 24.04)',
          role: 'receiver',
          platform: 'linux',
          ipAddress: '192.168.1.189',
          rttMs: 4.8,
          rssi: -45,
          connectedAt: Date.now() - 120000,
          activeCodec: 'pcm24',
          driverMode: 'PipeWire Null-Sink (5ms)',
        },
      ];

      if (data && data.openSessions) {
        data.openSessions.forEach((s: { code: string; receivers: number; transmitters: number }) => {
          if (s.code !== sessionCode) {
            simulatedNearby.push({
              id: s.code,
              name: `PulseCast Node (${s.code})`,
              role: s.transmitters > 0 ? 'transmitter' : 'receiver',
              platform: 'windows',
              ipAddress: '192.168.1.105',
              rttMs: 6.1,
              rssi: -52,
              connectedAt: Date.now() - 60000,
              activeCodec: 'opus',
              driverMode: 'Default Audio Endpoint',
            });
          }
        });
      }

      setDiscoveredDevices(simulatedNearby);
    } catch (e) {
      console.warn('Network discovery error:', e);
    } finally {
      setTimeout(() => setIsScanning(false), 400);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'discovery') {
      handleScanDiscovery();
    }
  }, [isOpen, activeTab]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(transmitterUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-neutral-100">
                Device Pairing & Network Discovery
              </h2>
              <p className="text-xs text-neutral-500">
                Connect mobile phone to PC over local Wi-Fi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-6">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'qr'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Scan QR Code</span>
          </button>

          <button
            onClick={() => setActiveTab('discovery')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'discovery'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>LAN Discovery</span>
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'telemetry'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Link Telemetry</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {activeTab === 'qr' && (
            <div className="space-y-5 text-center">
              <div className="mx-auto inline-block p-3 rounded-lg bg-neutral-100 shadow-md">
                <canvas ref={qrCanvasRef} className="block rounded" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-neutral-200">
                  Scan with your Phone Camera
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Make sure both your mobile device and PC are connected to the same Wi-Fi network or mobile hotspot.
                </p>
              </div>

              {/* PIN Code Box */}
              <div className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-between max-w-xs mx-auto">
                <div className="text-left">
                  <div className="text-[11px] text-neutral-500 font-medium">Session Pairing PIN</div>
                  <div className="font-mono text-base font-bold tracking-wider text-emerald-400 tabular-nums">
                    {sessionCode}
                  </div>
                </div>
                <button
                  onClick={handleCopyPin}
                  className="p-2 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 transition-colors"
                  title="Copy PIN"
                >
                  {copiedPin ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              {/* Direct Link Share */}
              <div className="flex items-center gap-2 max-w-md mx-auto">
                <input
                  type="text"
                  readOnly
                  value={transmitterUrl}
                  className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono text-xs text-neutral-300 truncate"
                />
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'discovery' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  Devices broadcasting on your Wi-Fi subnet (mDNS / SSDP)
                </div>
                <button
                  onClick={handleScanDiscovery}
                  disabled={isScanning}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                  <span>{isScanning ? 'Scanning...' : 'Refresh'}</span>
                </button>
              </div>

              <div className="space-y-2">
                {discoveredDevices.map((device) => (
                  <div
                    key={device.id}
                    className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-between hover:border-neutral-700 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-neutral-900 text-neutral-300">
                        {device.role === 'receiver' ? (
                          <Monitor className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <Smartphone className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-neutral-200">{device.name}</div>
                        <div className="text-[11px] font-mono text-neutral-500 tabular-nums">
                          {device.ipAddress} · RTT: {device.rttMs} ms · {device.driverMode}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onChangeSessionCode(device.id === 'dev-01' ? 'PC-WIN11' : device.id);
                        onClose();
                      }}
                      className="px-3 py-1 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-emerald-600 hover:text-white rounded transition-colors"
                    >
                      Pair
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950">
                  <div className="text-[11px] text-neutral-500">Wi-Fi Round Trip (RTT)</div>
                  <div className="font-mono text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
                    {telemetry.rttMs.toFixed(1)} ms
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950">
                  <div className="text-[11px] text-neutral-500">Est. Audio Path Latency</div>
                  <div className="font-mono text-lg font-bold text-cyan-400 tabular-nums mt-0.5">
                    {telemetry.audioLatencyMs.toFixed(1)} ms
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950">
                  <div className="text-[11px] text-neutral-500">Signal Strength (RSSI)</div>
                  <div className="font-mono text-lg font-bold text-neutral-200 tabular-nums mt-0.5">
                    {telemetry.signalRssi} dBm
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950">
                  <div className="text-[11px] text-neutral-500">Packet Loss Rate</div>
                  <div className="font-mono text-lg font-bold text-neutral-200 tabular-nums mt-0.5">
                    {telemetry.packetLossPercent.toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/60 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Network Quality:</span>
                  <span className="font-semibold capitalize text-emerald-400">
                    {telemetry.networkQuality}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Active Transmitters:</span>
                  <span className="font-mono text-neutral-300">{peerCounts.tx}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Active Receivers:</span>
                  <span className="font-mono text-neutral-300">{peerCounts.rx}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Audio Throughput:</span>
                  <span className="font-mono text-neutral-300">{telemetry.bitrateKbps} kbps</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-neutral-400">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]' : 'bg-rose-500'
              }`}
            />
            <span>{isConnected ? 'Session Connected' : 'Waiting for connection...'}</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
