import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { StreamTelemetry, PairedDevice } from '../types/audio';
import { HotspotNetworkInfo } from '../services/transports/AudioTransport';
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
  Flame,
  Zap,
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
  onApplyHotspotPreset?: (gatewayIp: string) => void;
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
  onApplyHotspotPreset,
}) => {
  const [activeTab, setActiveTab] = useState<'qr' | 'hotspot' | 'discovery' | 'telemetry'>('qr');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<PairedDevice[]>([]);
  const [detectedIfaces, setDetectedIfaces] = useState<HotspotNetworkInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [hotspotGatewayIp, setHotspotGatewayIp] = useState<string>('192.168.43.1');
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hotspotQrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Standard LAN Transmitter URL
  const transmitterUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?role=transmitter&code=${sessionCode}`
    : `https://pulsecast.local/?role=transmitter&code=${sessionCode}`;

  // Direct Mobile Hotspot URL
  const hotspotUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${hotspotGatewayIp}:${window.location.port || '3000'}/?role=transmitter&transport=mobile_hotspot&code=${sessionCode}`
    : `http://${hotspotGatewayIp}:3000/?role=transmitter&transport=mobile_hotspot&code=${sessionCode}`;

  useEffect(() => {
    if (isOpen && activeTab === 'qr' && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, transmitterUrl, {
        width: 190,
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

  useEffect(() => {
    if (isOpen && activeTab === 'hotspot' && hotspotQrCanvasRef.current) {
      QRCode.toCanvas(hotspotQrCanvasRef.current, hotspotUrl, {
        width: 190,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#fef3c7',
        },
      }).catch((err) => {
        console.error('Hotspot QR code generation error:', err);
      });
    }
  }, [isOpen, activeTab, hotspotUrl]);

  // Fetch real local network discovery beacons and interfaces
  const handleScanDiscovery = async () => {
    setIsScanning(true);
    try {
      const [discRes, ifacesRes] = await Promise.all([
        fetch('/api/discovery'),
        fetch('/api/network/interfaces'),
      ]);
      const discData = await discRes.json();
      const ifacesData = await ifacesRes.json();

      if (ifacesData && ifacesData.interfaces) {
        setDetectedIfaces(ifacesData.interfaces);
        const hotspotIface = ifacesData.interfaces.find(
          (i: HotspotNetworkInfo) =>
            i.type === 'hotspot' ||
            i.address.startsWith('192.168.43.') ||
            i.address.startsWith('172.20.10.')
        );
        if (hotspotIface && hotspotIface.gatewayIp) {
          setHotspotGatewayIp(hotspotIface.gatewayIp);
        }
      }

      const activeList: PairedDevice[] = [];
      if (discData && discData.openSessions) {
        discData.openSessions.forEach(
          (s: { code: string; receivers: number; transmitters: number; stats?: { codec?: string; bufferMs?: number } }) => {
            activeList.push({
              id: s.code,
              name: `PulseCast Node (${s.code})`,
              role: s.transmitters > 0 ? 'transmitter' : 'receiver',
              platform: 'windows',
              ipAddress: '127.0.0.1',
              rttMs: 3.2,
              rssi: -40,
              connectedAt: Date.now() - 30000,
              activeCodec: (s.stats?.codec as any) || 'opus',
              driverMode: 'WASAPI / PipeWire Ready',
            });
          }
        );
      }
      setDiscoveredDevices(activeList);
    } catch (e) {
      console.warn('Network discovery error:', e);
    } finally {
      setTimeout(() => setIsScanning(false), 300);
    }
  };

  useEffect(() => {
    if (isOpen) {
      handleScanDiscovery();
    }
  }, [isOpen]);

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPin = () => {
    navigator.clipboard.writeText(sessionCode);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const handleActivateHotspot = () => {
    if (onApplyHotspotPreset) {
      onApplyHotspotPreset(hotspotGatewayIp);
    }
    onClose();
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
                Connect mobile phone to PC over Wi-Fi or Mobile Hotspot
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
        <div className="flex border-b border-neutral-800 bg-neutral-950/60 px-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'qr'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Wi-Fi QR Code</span>
          </button>

          <button
            onClick={() => setActiveTab('hotspot')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'hotspot'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Direct Hotspot</span>
          </button>

          <button
            onClick={() => setActiveTab('discovery')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'discovery'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>LAN Nodes</span>
          </button>

          <button
            onClick={() => setActiveTab('telemetry')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
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
          {/* TAB 1: LAN Wi-Fi QR */}
          {activeTab === 'qr' && (
            <div className="space-y-4 text-center">
              <div className="mx-auto inline-block p-3 rounded-lg bg-neutral-100 shadow-md">
                <canvas ref={qrCanvasRef} className="block rounded" />
              </div>

              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-neutral-200">
                  Scan with your Phone Camera
                </h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Ensure phone and PC are connected to the same Wi-Fi network.
                </p>
              </div>

              {/* PIN Code Box */}
              <div className="p-3 rounded-lg border border-neutral-800 bg-neutral-950 flex items-center justify-between max-w-xs mx-auto">
                <div className="text-left">
                  <div className="text-[11px] text-neutral-500 font-medium">Session PIN</div>
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
                  onClick={() => handleCopyLink(transmitterUrl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Direct Hotspot Mode */}
          {activeTab === 'hotspot' && (
            <div className="space-y-4 text-center">
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-left flex items-start gap-2.5">
                <Flame className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div className="text-xs text-neutral-300">
                  <strong className="text-amber-300">Mobile SoftAP Link:</strong> Connect PC to phone hotspot. Bypasses router isolation and drops network RTT to &lt;2ms.
                </div>
              </div>

              <div className="mx-auto inline-block p-3 rounded-lg bg-amber-100 shadow-md">
                <canvas ref={hotspotQrCanvasRef} className="block rounded" />
              </div>

              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-neutral-400">Target Gateway IP:</span>
                <select
                  value={hotspotGatewayIp}
                  onChange={(e) => setHotspotGatewayIp(e.target.value)}
                  className="bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-xs font-mono text-amber-300 focus:outline-none"
                >
                  <option value="192.168.43.1">192.168.43.1 (Android SoftAP)</option>
                  <option value="172.20.10.1">172.20.10.1 (iOS Hotspot)</option>
                  <option value="192.168.137.1">192.168.137.1 (Windows Hotspot)</option>
                  {detectedIfaces
                    .filter((i) => !i.address.startsWith('127.'))
                    .map((i) => (
                      <option key={i.address} value={i.address}>
                        {i.address} ({i.name})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-2 max-w-md mx-auto">
                <input
                  type="text"
                  readOnly
                  value={hotspotUrl}
                  className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono text-xs text-neutral-300 truncate"
                />
                <button
                  onClick={() => handleCopyLink(hotspotUrl)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <button
                onClick={handleActivateHotspot}
                className="w-full mt-2 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold transition-colors flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Apply 5ms Hotspot Preset &amp; Switch</span>
              </button>
            </div>
          )}

          {/* TAB 3: LAN Discovery Nodes */}
          {activeTab === 'discovery' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-neutral-400">
                  Active PulseCast instances on your local subnet
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

              {discoveredDevices.length > 0 ? (
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
                            {device.ipAddress} · Session: {device.id}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          onChangeSessionCode(device.id);
                          onClose();
                        }}
                        className="px-3 py-1 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-emerald-600 hover:text-white rounded transition-colors"
                      >
                        Pair
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center border border-neutral-800 rounded-lg bg-neutral-950/60 text-xs text-neutral-400">
                  Current session <strong className="font-mono text-neutral-200">{sessionCode}</strong> is actively broadcasting on port 3000. Open on another device to link.
                </div>
              )}

              {/* Detected Subnets list */}
              {detectedIfaces.length > 0 && (
                <div className="pt-2 border-t border-neutral-800/80">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Host Network Adapters:
                  </div>
                  <div className="space-y-1">
                    {detectedIfaces
                      .filter((i) => !i.internal)
                      .map((i) => (
                        <div
                          key={i.address}
                          className="flex items-center justify-between text-xs font-mono text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-800/60"
                        >
                          <span>{i.name} ({i.type})</span>
                          <span className="text-neutral-200">{i.address}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Link Telemetry */}
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
                  <span className="text-neutral-500">Transport Link:</span>
                  <span className="font-semibold uppercase text-amber-400 font-mono">
                    {telemetry.transportType || 'lan_wifi'}
                  </span>
                </div>
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
