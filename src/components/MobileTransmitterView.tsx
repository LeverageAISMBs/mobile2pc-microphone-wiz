import React from 'react';
import { StreamTelemetry, AudioCodec } from '../types/audio';
import { AudioSourceType } from '../services/audioStreamer';
import { TransportType } from '../services/transports/AudioTransport';
import {
  Mic,
  Radio,
  Sliders,
  Volume2,
  VolumeX,
  Disc,
  QrCode,
  Music,
  Activity,
  Smartphone,
  Flame,
  Wifi,
} from 'lucide-react';

interface MobileTransmitterViewProps {
  isStreaming: boolean;
  onToggleStreaming: () => void;
  activeSource: AudioSourceType;
  onChangeSource: (source: AudioSourceType) => void;
  telemetry: StreamTelemetry;
  activeCodec: AudioCodec;
  onChangeCodec: (codec: AudioCodec) => void;
  sessionCode: string;
  onOpenPairing: () => void;
  inputGain: number;
  onChangeInputGain: (gain: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isConnected: boolean;
  currentTransport?: TransportType;
  onChangeTransport?: (type: TransportType) => void;
  onOpenHotspotWizard?: () => void;
  onOpenBluetoothWizard?: () => void;
  onOpenGattWizard?: () => void;
  bleMtuSize?: number;
}

export const MobileTransmitterView: React.FC<MobileTransmitterViewProps> = ({
  isStreaming,
  onToggleStreaming,
  activeSource,
  onChangeSource,
  telemetry,
  activeCodec,
  onChangeCodec,
  sessionCode,
  onOpenPairing,
  inputGain,
  onChangeInputGain,
  isMuted,
  onToggleMute,
  isConnected,
  currentTransport = 'lan_wifi',
  onChangeTransport,
  onOpenHotspotWizard,
  onOpenBluetoothWizard,
  onOpenGattWizard,
  bleMtuSize = 240,
}) => {
  const sources: { id: AudioSourceType; label: string; icon: React.ReactNode }[] = [
    { id: 'mic', label: 'Phone Mic', icon: <Mic className="w-4 h-4" /> },
    { id: 'sine1k', label: '1kHz Sine', icon: <Activity className="w-4 h-4" /> },
    { id: 'pinknoise', label: 'Pink Noise', icon: <Radio className="w-4 h-4" /> },
    { id: 'guitar', label: 'Guitar Chords', icon: <Music className="w-4 h-4" /> },
    { id: 'drums', label: 'Drum Pulse', icon: <Disc className="w-4 h-4" /> },
  ];

  const peakPct = Math.max(0, Math.min(100, ((telemetry.peakDbfsLeft + 60) / 60) * 100));

  return (
    <div className="max-w-md mx-auto space-y-4">
      {/* Top Mobile Status Header */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-neutral-200">
                Mobile Transmitter Unit
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-emerald-400">
                {telemetry.audioEngineMode === 'worklet_thread' ? 'Worklet Thread' : 'Fallback'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {currentTransport === 'mobile_hotspot' ? (
              <button
                onClick={onOpenHotspotWizard}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded"
              >
                <Flame className="w-3 h-3 text-amber-400" />
                <span>Hotspot</span>
              </button>
            ) : currentTransport === 'bluetooth_a2dp' ? (
              <button
                onClick={onOpenBluetoothWizard}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded"
              >
                <span>A2DP</span>
              </button>
            ) : currentTransport === 'bluetooth_ble' ? (
              <button
                onClick={onOpenGattWizard}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 rounded"
              >
                <span>BLE GATT</span>
              </button>
            ) : (
              <button
                onClick={onOpenHotspotWizard}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-neutral-400 bg-neutral-950 border border-neutral-800 rounded hover:text-amber-400"
              >
                <Wifi className="w-3 h-3" />
                <span>Wi-Fi</span>
              </button>
            )}

            <button
              onClick={onOpenPairing}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-emerald-400 bg-neutral-950 border border-neutral-800 rounded hover:border-emerald-500/50 transition-colors"
            >
              <QrCode className="w-3 h-3" />
              <span>PIN: {sessionCode}</span>
            </button>
          </div>
        </div>

        {/* Transport Link Switcher on Mobile */}
        {onChangeTransport && (
          <div className="mt-3 grid grid-cols-4 gap-1 p-1 bg-neutral-950 rounded border border-neutral-800 text-xs">
            <button
              onClick={() => onChangeTransport('lan_wifi')}
              className={`py-1 rounded font-medium transition-colors truncate ${
                currentTransport === 'lan_wifi'
                  ? 'bg-neutral-800 text-emerald-400 shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Wi-Fi
            </button>
            <button
              onClick={() => {
                onChangeTransport('mobile_hotspot');
                if (onOpenHotspotWizard) onOpenHotspotWizard();
              }}
              className={`py-1 rounded font-medium transition-colors flex items-center justify-center gap-1 truncate ${
                currentTransport === 'mobile_hotspot'
                  ? 'bg-amber-950/60 text-amber-400 border border-amber-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-amber-300'
              }`}
            >
              <Flame className="w-3 h-3 text-amber-400" />
              <span>Hotspot</span>
            </button>
            <button
              onClick={() => {
                onChangeTransport('bluetooth_a2dp');
                if (onOpenBluetoothWizard) onOpenBluetoothWizard();
              }}
              className={`py-1 rounded font-medium transition-colors flex items-center justify-center gap-1 truncate ${
                currentTransport === 'bluetooth_a2dp'
                  ? 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-cyan-300'
              }`}
            >
              <span>A2DP</span>
            </button>
            <button
              onClick={() => {
                onChangeTransport('bluetooth_ble');
                if (onOpenGattWizard) onOpenGattWizard();
              }}
              className={`py-1 rounded font-medium transition-colors flex items-center justify-center gap-1 truncate ${
                currentTransport === 'bluetooth_ble'
                  ? 'bg-indigo-950/60 text-indigo-400 border border-indigo-500/40 shadow-sm'
                  : 'text-neutral-400 hover:text-indigo-300'
              }`}
            >
              <span>BLE</span>
            </button>
          </div>
        )}

        {/* Connection Bar */}
        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-neutral-800/80 text-center font-mono">
          <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
            <div className="text-[10px] text-neutral-500">
              {currentTransport === 'mobile_hotspot' ? 'Direct Hop' : 'Wi-Fi RTT'}
            </div>
            <div className="text-xs font-bold text-emerald-400 tabular-nums mt-0.5">
              {telemetry.rttMs.toFixed(1)} ms
            </div>
          </div>
          <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
            <div className="text-[10px] text-neutral-500">Throughput</div>
            <div className="text-xs font-bold text-neutral-200 tabular-nums mt-0.5">
              {telemetry.bitrateKbps} kbps
            </div>
          </div>
          <div className="p-2 rounded bg-neutral-950/60 border border-neutral-800">
            <div className="text-[10px] text-neutral-500">Signal RSSI</div>
            <div className="text-xs font-bold text-neutral-200 tabular-nums mt-0.5">
              {telemetry.signalRssi} dBm
            </div>
          </div>
        </div>

        {/* BLE Slicer Status Bar (Sprint 3) */}
        {currentTransport === 'bluetooth_ble' && (
          <div className="mt-3 p-2.5 rounded-lg border border-indigo-500/30 bg-indigo-950/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-indigo-400" />
              <div>
                <span className="font-semibold text-neutral-200">BLE GATT Slicer:</span>{' '}
                <span className="font-mono text-indigo-300">
                  {bleMtuSize}B MTU · {telemetry.ble?.slicesSent || 0} Slices Out
                </span>
              </div>
            </div>
            {onOpenGattWizard && (
              <button
                onClick={onOpenGattWizard}
                className="text-[11px] font-medium text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
              >
                Configure
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Broadcast Activation Hero */}
      <div className="rounded-xl border border-neutral-800 bg-gradient-to-b from-neutral-900 to-neutral-950 p-6 text-center shadow-lg">
        <button
          onClick={onToggleStreaming}
          className={`mx-auto h-32 w-32 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-300 shadow-xl ${
            isStreaming
              ? 'border-emerald-500 bg-emerald-950/40 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.3)] animate-pulse'
              : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200'
          }`}
        >
          {isStreaming ? (
            <>
              <Radio className="w-10 h-10 mb-1" />
              <span className="text-xs font-bold uppercase tracking-wider">On Air</span>
            </>
          ) : (
            <>
              <Mic className="w-10 h-10 mb-1" />
              <span className="text-xs font-bold uppercase tracking-wider">Tap to Cast</span>
            </>
          )}
        </button>

        <div className="mt-4">
          <div className="text-xs font-semibold text-neutral-200">
            {isStreaming ? 'Broadcasting Audio to PC' : 'Ready to Stream'}
          </div>
          <p className="text-[11px] text-neutral-500 mt-0.5">
            {isStreaming
              ? currentTransport === 'mobile_hotspot'
                ? 'Ultra-low latency stream active over Direct SoftAP'
                : 'Low-latency packet stream active over local Wi-Fi'
              : 'Ensure PC receiver is paired before starting'}
          </p>
        </div>

        {/* Real-time Level Meter */}
        <div className="mt-4 pt-4 border-t border-neutral-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-neutral-500">Mic Input Level</span>
            <span className="text-neutral-300 tabular-nums">
              {telemetry.peakDbfsLeft <= -60 ? '-∞ dBFS' : `${telemetry.peakDbfsLeft} dBFS`}
            </span>
          </div>

          <div className="relative h-2.5 w-full overflow-hidden rounded bg-neutral-950 border border-neutral-800">
            <div
              className={`h-full transition-all duration-75 ${
                telemetry.isClipping
                  ? 'bg-rose-500'
                  : peakPct > 85
                  ? 'bg-amber-400'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${peakPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Input Gain & Source Controls */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-4 space-y-4">
        {/* Source Selector */}
        <div>
          <label className="text-xs font-semibold text-neutral-300 block mb-2">
            Audio Input Source
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {sources.map((s) => (
              <button
                key={s.id}
                onClick={() => onChangeSource(s.id)}
                className={`p-2 rounded border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                  activeSource === s.id
                    ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400'
                    : 'border-neutral-800 bg-neutral-950/50 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {s.icon}
                <span className="truncate">{s.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Gain Fader */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-neutral-400 font-medium">Preamp Gain</span>
            <span className="font-mono text-emerald-400 font-semibold tabular-nums">
              {(inputGain * 100).toFixed(0)}%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onToggleMute}
              className={`p-2 rounded border transition-colors ${
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
              max={2}
              step={0.05}
              value={inputGain}
              onChange={(e) => onChangeInputGain(Number(e.target.value))}
              className="flex-1 accent-emerald-500 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Quick Codec Toggle */}
        <div className="pt-2 border-t border-neutral-800/80">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-neutral-400 font-medium">Codec Transmission Mode</span>
            <span className="font-mono text-emerald-400 uppercase text-[11px]">
              {activeCodec}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-md border border-neutral-800 text-xs">
            {(['opus', 'pcm16', 'pcm24'] as AudioCodec[]).map((c) => (
              <button
                key={c}
                onClick={() => onChangeCodec(c)}
                className={`py-1 rounded font-medium transition-colors uppercase ${
                  activeCodec === c
                    ? 'bg-neutral-800 text-emerald-400 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
