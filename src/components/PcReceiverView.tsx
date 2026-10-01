import React from 'react';
import { StreamTelemetry, AudioCodec, BufferConfig } from '../types/audio';
import { AudioVisualizer } from './AudioVisualizer';
import { JitterBufferControl } from './JitterBufferControl';
import { CodecSelector } from './CodecSelector';
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
}) => {
  return (
    <div className="space-y-6">
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
                  WASAPI / PipeWire Ready
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Listening for incoming low-latency Wi-Fi stream on session PIN <strong className="font-mono text-neutral-200">{sessionCode}</strong>
              </p>
            </div>
          </div>

          {/* Quick Output Routing Selector */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-md border border-neutral-800 text-xs">
              <Layers className="w-3.5 h-3.5 text-neutral-400" />
              <span className="text-neutral-400">Driver Target:</span>
              <select
                aria-label="Virtual Audio Device Routing"
                className="bg-transparent text-neutral-200 font-medium focus:outline-none cursor-pointer"
                defaultValue="vb-cable"
              >
                <option value="vb-cable" className="bg-neutral-900 text-neutral-200">
                  VB-Cable / Virtual Audio Sink
                </option>
                <option value="pipewire" className="bg-neutral-900 text-neutral-200">
                  PipeWire Null-Sink (pulsecast.local)
                </option>
                <option value="wasapi-exclusive" className="bg-neutral-900 text-neutral-200">
                  WASAPI Exclusive 128 samples
                </option>
                <option value="speakers" className="bg-neutral-900 text-neutral-200">
                  Direct PC Speakers & Headphones
                </option>
              </select>
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
                {pan === 0 ? 'C' : pan < 0 ? `L${Math.abs(Math.round(pan * 100))}` : `R${Math.round(pan * 100)}`}
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
              <div className="text-xs font-semibold text-neutral-200">Local Speaker Pass-Through</div>
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
              Active Transmitters on Subnet
            </h3>
            <span className="text-xs text-neutral-500">·</span>
            <span className="font-mono text-xs text-neutral-400 tabular-nums">
              {peerCounts.tx} Mobile Node{peerCounts.tx === 1 ? '' : 's'} Linked
            </span>
          </div>

          <div className="text-xs text-neutral-400">
            Transport: <strong className="font-mono text-neutral-200">WS-Binary / WebRTC Ready</strong>
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
                    Session PIN: {sessionCode} · Codec: {activeCodec.toUpperCase()} · Latency: {telemetry.audioLatencyMs.toFixed(1)} ms
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
                Scan the QR code with your phone camera or open the Mobile Transmitter tab to begin low-latency streaming.
              </p>
              <button
                onClick={onOpenPairing}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
              >
                Show Pairing QR Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
