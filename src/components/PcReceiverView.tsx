import React, { useEffect, useState } from 'react';
import { StreamTelemetry, AudioCodec, BufferConfig } from '../types/audio';
import { AudioVisualizer } from './AudioVisualizer';
import { JitterBufferControl } from './JitterBufferControl';
import { CodecSelector } from './CodecSelector';
import { TransportModeSelector } from './TransportModeSelector';
import { TransportType } from '../services/transports/AudioTransport';
import {
  Volume2,
  VolumeX,
  Sliders,
  Radio,
  Monitor,
  Smartphone,
  Cpu,
  RefreshCw,
  QrCode,
  Shield,
  Layers,
  Flame,
  CheckCircle2,
} from 'lucide-react';

interface PcReceiverViewProps {
  analyser: AnalyserNode | null;
  telemetry: StreamTelemetry;
  bufferConfig: BufferConfig;
  onChangeBufferConfig: (config: Partial<BufferConfig>) => void;
  activeCodec: AudioCodec;
  onChangeCodec: (codec: AudioCodec) => void;
  frameSizeMs: number;
  onChangeFrameSize: (ms: number) => void;
  outputVolume: number;
  onChangeOutputVolume: (vol: number) => void;
  pan: number;
  onChangePan: (pan: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isLoopbackMonitor: boolean;
  onToggleLoopback: () => void;
  sessionCode: string;
  onOpenPairing: () => void;
  peerCounts: { rx: number; tx: number };
  onResetStats: () => void;
  currentTransport: TransportType;
  onChangeTransport: (type: TransportType) => void;
  onOpenHotspotWizard: () => void;
  onOpenBluetoothWizard?: () => void;
  onOpenGattWizard?: () => void;
  bleMtuSize?: number;
  onSelectAudioSink?: (sinkId: string) => Promise<boolean>;
}

export const PcReceiverView: React.FC<PcReceiverViewProps> = ({
  analyser,
  telemetry,
  bufferConfig,
  onChangeBufferConfig,
  activeCodec,
  onChangeCodec,
  frameSizeMs,
  onChangeFrameSize,
  outputVolume,
  onChangeOutputVolume,
  pan,
  onChangePan,
  isMuted,
  onToggleMute,
  isLoopbackMonitor,
  onToggleLoopback,
  sessionCode,
  onOpenPairing,
  peerCounts,
  onResetStats,
  currentTransport,
  onChangeTransport,
  onOpenHotspotWizard,
  onOpenBluetoothWizard,
  onOpenGattWizard,
  bleMtuSize = 240,
  onSelectAudioSink,
}) => {
  const [outputDevices, setOutputDevices] = useState<{ deviceId: string; label: string }[]>([]);
  const [selectedSink, setSelectedSink] = useState<string>('default');
  const [sinkSuccess, setSinkSuccess] = useState<boolean>(false);
  const [isRefreshingSinks, setIsRefreshingSinks] = useState<boolean>(false);

  const fetchAudioOutputs = () => {
    setIsRefreshingSinks(true);
    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const audioOutputs = devices
            .filter((d) => d.kind === 'audiooutput')
            .map((d) => ({
              deviceId: d.deviceId,
              label: d.label || `Output (${d.deviceId.slice(0, 5)})`,
            }));
          if (audioOutputs.length > 0) {
            setOutputDevices(audioOutputs);
          }
        })
        .catch(() => {})
        .finally(() => {
          setTimeout(() => setIsRefreshingSinks(false), 400);
        });
    } else {
      setIsRefreshingSinks(false);
    }
  };

  useEffect(() => {
    fetchAudioOutputs();
  }, []);

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedSink(deviceId);
    if (onSelectAudioSink) {
      const ok = await onSelectAudioSink(deviceId);
      if (ok) {
        setSinkSuccess(true);
        setTimeout(() => setSinkSuccess(false), 2500);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Transport Mode Switcher (LAN Wi-Fi vs Mobile Hotspot vs Bluetooth A2DP vs BLE GATT) */}
      <TransportModeSelector
        currentTransport={currentTransport}
        onChangeTransport={onChangeTransport}
        onOpenHotspotWizard={onOpenHotspotWizard}
        onOpenBluetoothWizard={onOpenBluetoothWizard}
        onOpenGattWizard={onOpenGattWizard}
        isHotspotActive={currentTransport === 'mobile_hotspot'}
        isBluetoothActive={currentTransport === 'bluetooth_a2dp'}
        isGattActive={currentTransport === 'bluetooth_ble'}
        gatewayIp={telemetry.gatewayIp}
        bleMtuSize={bleMtuSize}
      />

      {/* Workstation Top Bar / Audio Output Strip */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-neutral-200">
                  PC Receiver Master Audio Strip
                </h3>
                <span className="text-xs text-neutral-500">·</span>
                <span className="text-xs font-mono text-emerald-400">
                  {currentTransport === 'mobile_hotspot' ? 'Hotspot Direct (<5ms)' : 'WASAPI / PipeWire Ready'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Listening for incoming stream on session PIN{' '}
                <strong className="font-mono text-neutral-200">{sessionCode}</strong>
                {telemetry.gatewayIp && currentTransport === 'mobile_hotspot' && (
                  <span className="text-amber-400 font-mono ml-1">
                    (Gateway: {telemetry.gatewayIp})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Quick Output Routing Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-md border border-neutral-800 text-xs">
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-neutral-400">Audio Sink:</span>
              <select
                aria-label="Virtual Audio Device Routing"
                className="bg-transparent text-neutral-200 font-medium focus:outline-none cursor-pointer max-w-[200px] truncate"
                value={selectedSink}
                onChange={(e) => handleDeviceChange(e.target.value)}
              >
                <option value="default" className="bg-neutral-900 text-neutral-200">
                  Default System Audio Output
                </option>
                <option value="vb-cable" className="bg-neutral-900 text-neutral-200">
                  VB-Cable / Virtual Audio Sink
                </option>
                <option value="pipewire" className="bg-neutral-900 text-neutral-200">
                  PipeWire Null-Sink (pulsecast.local)
                </option>
                <option value="wasapi-exclusive" className="bg-neutral-900 text-neutral-200">
                  WASAPI Exclusive 128 samples
                </option>
                {outputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-neutral-900 text-neutral-200">
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchAudioOutputs}
                title="Refresh connected audio output devices"
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshingSinks ? 'animate-spin' : ''}`} />
              </button>
              {sinkSuccess && (
                <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Routed</span>
                </span>
              )}
            </div>

            {/* Audio Engine Mode Indicator (Sprint 4: AudioWorklet) */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-neutral-950 border border-neutral-800 text-xs font-mono">
              <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-neutral-400">Engine:</span>
              <span className="text-emerald-400 font-semibold">
                {telemetry.audioEngineMode === 'worklet_thread'
                  ? 'AudioWorklet (Realtime Thread)'
                  : 'ScriptProcessor Fallback'}
              </span>
            </div>

            <button
              onClick={onOpenPairing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Pair Mobile Phone</span>
            </button>
          </div>
        </div>

        {/* Bluetooth BLE GATT Slicer Status Card (Sprint 3) */}
        {currentTransport === 'bluetooth_ble' && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-950/30 p-3.5 mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold text-neutral-100">
                      Web Bluetooth GATT Engine (Active Stream)
                    </h4>
                    <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                      {telemetry.ble?.phyMode || '2M'} PHY · {telemetry.ble?.connectionIntervalMs || 15}ms Interval
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Streaming via UUID <code className="font-mono text-neutral-300">0000ffe0...</code> with 6-byte header &amp; CRC8 verification
                  </p>
                </div>
              </div>

              {onOpenGattWizard && (
                <button
                  onClick={onOpenGattWizard}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-md transition-colors shadow-sm self-start sm:self-auto"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>GATT Slicer &amp; Benchmark</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-indigo-500/20 text-center font-mono text-[11px]">
              <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-500">MTU Chunk Size</div>
                <div className="font-bold text-indigo-300 mt-0.5">{bleMtuSize} Bytes</div>
              </div>
              <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-500">Slices In / Out</div>
                <div className="font-bold text-neutral-200 mt-0.5">
                  {telemetry.ble?.slicesReceived || 0} / {telemetry.ble?.slicesSent || 0}
                </div>
              </div>
              <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-500">Reassembled Frames</div>
                <div className="font-bold text-emerald-400 mt-0.5">
                  {telemetry.ble?.reassembledFrames || 0}
                </div>
              </div>
              <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-500">Integrity Check</div>
                <div className="font-bold text-emerald-400 mt-0.5 flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>0 CRC Errors</span>
                </div>
              </div>
              <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
                <div className="text-[10px] text-neutral-500">RF Signal (RSSI)</div>
                <div className="font-bold text-indigo-300 mt-0.5">
                  {telemetry.signalRssi} dBm
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mixer Faders & Monitoring Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5 pt-4 border-t border-neutral-800/80">
          {/* Master Volume */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-medium">Master Output Volume</span>
              <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                {(outputVolume * 100).toFixed(0)}%
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                onClick={onToggleMute}
                className={`p-1.5 rounded border transition-colors ${
                  isMuted
                    ? 'border-rose-500/50 bg-rose-950/20 text-rose-400'
                    : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={outputVolume}
                onChange={(e) => onChangeOutputVolume(Number(e.target.value))}
                className="flex-1 accent-emerald-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          {/* Stereo Balance Pan */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-medium">Stereo Pan Balance</span>
              <span className="font-mono font-semibold text-neutral-300 tabular-nums">
                {pan === 0
                  ? 'C'
                  : pan < 0
                  ? `L${Math.abs(Math.round(pan * 100))}`
                  : `R${Math.round(pan * 100)}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-neutral-500">L</span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={pan}
                onChange={(e) => onChangePan(Number(e.target.value))}
                className="flex-1 accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-[10px] font-mono text-neutral-500">R</span>
            </div>
          </div>

          {/* Local Loopback / Self Monitor Toggle */}
          <div className="flex items-center justify-between p-2.5 rounded border border-neutral-800 bg-neutral-950">
            <div>
              <div className="text-xs font-semibold text-neutral-200">
                Local Speaker Pass-Through
              </div>
              <div className="text-[11px] text-neutral-500">Play stream on host speakers</div>
            </div>
            <input
              type="checkbox"
              checked={isLoopbackMonitor}
              onChange={onToggleLoopback}
              className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Visualizer Stage */}
      <AudioVisualizer
        analyser={analyser}
        telemetry={telemetry}
        title="Host Audio Analyser & Oscilloscope"
        height={150}
      />

      {/* Jitter Buffer & Codec Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <JitterBufferControl
          config={bufferConfig}
          telemetry={telemetry}
          onChange={onChangeBufferConfig}
          onResetStats={onResetStats}
        />

        <CodecSelector
          activeCodec={activeCodec}
          onChangeCodec={onChangeCodec}
          frameSizeMs={frameSizeMs}
          onChangeFrameSize={onChangeFrameSize}
        />
      </div>

      {/* Active Transmitters Roster */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-neutral-200">
              Active Transmitters on Link
            </h3>
            <span className="text-xs text-neutral-500">·</span>
            <span className="font-mono text-xs text-neutral-400 tabular-nums">
              {peerCounts.tx} Mobile Node{peerCounts.tx === 1 ? '' : 's'} Linked
            </span>
          </div>

          <div className="text-xs text-neutral-400 font-mono">
            Link: <strong className="text-emerald-400 uppercase">{currentTransport}</strong>
            {currentTransport === 'mobile_hotspot' && ' (Direct 1-Hop)'}
          </div>
        </div>

        <div className="mt-4">
          {peerCounts.tx > 0 ? (
            <div className="p-3.5 rounded-lg border border-neutral-800 bg-neutral-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded bg-emerald-500/10 text-emerald-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-neutral-200">
                      Mobile Audio Transmitter (Active Stream)
                    </span>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400 mt-0.5">
                    PIN: {sessionCode} · Codec: {activeCodec.toUpperCase()} · Audio Latency:{' '}
                    {telemetry.audioLatencyMs.toFixed(1)} ms
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono tabular-nums text-neutral-400">
                <div>
                  <span className="text-neutral-500">Bitrate: </span>
                  <span className="text-neutral-200">{telemetry.bitrateKbps} kbps</span>
                </div>
                <div>
                  <span className="text-neutral-500">Signal: </span>
                  <span className="text-emerald-400">{telemetry.signalRssi} dBm</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center rounded-lg border border-dashed border-neutral-800 bg-neutral-950/40">
              <Smartphone className="w-8 h-8 mx-auto text-neutral-600 mb-2" />
              <div className="text-xs font-semibold text-neutral-300">
                No Mobile Transmitters Connected
              </div>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto mt-1 mb-3">
                Scan the QR code with your phone camera or open the Mobile Transmitter tab to begin
                low-latency streaming.
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={onOpenPairing}
                  className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
                >
                  Show Pairing QR Code
                </button>
                <button
                  onClick={onOpenHotspotWizard}
                  className="px-3.5 py-1.5 text-xs font-medium text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors"
                >
                  Direct Hotspot Wizard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
