import React from 'react';
import { BufferConfig, StreamTelemetry } from '../types/audio';
import { ShieldCheck, Cpu, Activity, AlertCircle, RefreshCw } from 'lucide-react';

interface JitterBufferControlProps {
  config: BufferConfig;
  telemetry: StreamTelemetry;
  onChange: (updated: Partial<BufferConfig>) => void;
  onResetStats?: () => void;
}

export const JitterBufferControl: React.FC<JitterBufferControlProps> = ({
  config,
  telemetry,
  onChange,
  onResetStats,
}) => {
  const presets = [
    { label: 'Esports / Competitive', ms: 5, desc: 'Ultra-low latency <10ms total chain' },
    { label: 'Voice & Discord', ms: 15, desc: 'Balanced real-time communication' },
    { label: 'Studio & Hi-Fi', ms: 35, desc: 'Clean uncompressed audio stability' },
    { label: 'Extended Range Wi-Fi', ms: 80, desc: 'Maximum protection against packet jitter' },
  ];

  const safetyWidth = Math.min(100, (telemetry.bufferFillMs / (config.bufferSizeMs * 2)) * 100);

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">
            Jitter Buffer & Timing Architecture
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configures packet queue absorption and real-time playhead compensation over Wi-Fi
          </p>
        </div>

        {onResetStats && (
          <button
            onClick={onResetStats}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-neutral-400 hover:text-neutral-200 bg-neutral-800/80 rounded transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Reset Counters</span>
          </button>
        )}
      </div>

      {/* Real-time Buffer Waterlevel Indicator */}
      <div className="rounded border border-neutral-800 bg-neutral-950 p-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-neutral-400">Buffer Waterlevel:</span>
          <span className="tabular-nums font-semibold text-emerald-400">
            {telemetry.bufferFillMs.toFixed(1)} ms / target {config.bufferSizeMs} ms
          </span>
        </div>

        {/* Gauge Bar */}
        <div className="relative h-4 w-full overflow-hidden rounded bg-neutral-900 border border-neutral-800">
          {/* Target marker line */}
          <div
            className="absolute top-0 bottom-0 z-10 w-0.5 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
            style={{ left: '50%' }}
          />

          {/* Fill level */}
          <div
            className={`h-full transition-all duration-100 ${
              telemetry.bufferFillMs < config.bufferSizeMs * 0.4
                ? 'bg-rose-500'
                : telemetry.bufferFillMs > config.bufferSizeMs * 1.5
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${Math.max(2, safetyWidth)}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] font-mono text-neutral-500">
          <span>0 ms (Underrun zone)</span>
          <span className="text-cyan-400">Target ({config.bufferSizeMs} ms)</span>
          <span>{config.bufferSizeMs * 2} ms</span>
        </div>
      </div>

      {/* Target Buffer Size Slider & Presets */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-neutral-300">
            Target Buffer Depth
          </label>
          <span className="font-mono text-xs font-bold tabular-nums text-emerald-400">
            {config.bufferSizeMs} ms
          </span>
        </div>

        <input
          type="range"
          min={5}
          max={150}
          step={5}
          value={config.bufferSizeMs}
          onChange={(e) => onChange({ bufferSizeMs: Number(e.target.value) })}
          className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-neutral-800 rounded-lg appearance-none"
        />

        {/* Preset Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {presets.map((p) => {
            const isActive = config.bufferSizeMs === p.ms;
            return (
              <button
                key={p.ms}
                onClick={() => onChange({ bufferSizeMs: p.ms })}
                className={`p-2 rounded text-left border transition-all ${
                  isActive
                    ? 'border-emerald-500/50 bg-emerald-950/20 text-neutral-200'
                    : 'border-neutral-800 bg-neutral-950/50 text-neutral-400 hover:border-neutral-700 hover:text-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{p.ms} ms</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                </div>
                <div className="text-[10px] text-neutral-500 truncate mt-0.5">{p.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Algorithmic Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="flex items-start gap-3 rounded border border-neutral-800 bg-neutral-950 p-3">
          <div className="mt-0.5 text-emerald-400">
            <Activity className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">Adaptive Jitter</span>
              <input
                type="checkbox"
                checked={config.adaptiveJitter}
                onChange={(e) => onChange({ adaptiveJitter: e.target.checked })}
                className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Dynamically scales buffer during packet variance spikes
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded border border-neutral-800 bg-neutral-950 p-3">
          <div className="mt-0.5 text-cyan-400">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">Loss Concealment</span>
              <input
                type="checkbox"
                checked={config.packetLossConcealment}
                onChange={(e) => onChange({ packetLossConcealment: e.target.checked })}
                className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Extrapolates waveform decay to eliminate click artifacts
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded border border-neutral-800 bg-neutral-950 p-3">
          <div className="mt-0.5 text-amber-400">
            <Cpu className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-200">Drop Late Packets</span>
              <input
                type="checkbox"
                checked={config.dropLatePackets}
                onChange={(e) => onChange({ dropLatePackets: e.target.checked })}
                className="accent-emerald-500 h-4 w-4 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-neutral-500 mt-1">
              Prevents queue stacking by discarding stale frames
            </p>
          </div>
        </div>
      </div>

      {/* Underrun & Health Statistics */}
      <div className="grid grid-cols-4 gap-2 pt-1 border-t border-neutral-800/80">
        <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800">
          <div className="text-[11px] text-neutral-500">Network Jitter</div>
          <div className="font-mono text-xs font-bold text-neutral-200 tabular-nums mt-0.5">
            {telemetry.jitterMs.toFixed(1)} ms
          </div>
        </div>
        <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800">
          <div className="text-[11px] text-neutral-500">Audio Latency</div>
          <div className="font-mono text-xs font-bold text-emerald-400 tabular-nums mt-0.5">
            {telemetry.audioLatencyMs.toFixed(1)} ms
          </div>
        </div>
        <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800">
          <div className="text-[11px] text-neutral-500">Underruns</div>
          <div className={`font-mono text-xs font-bold tabular-nums mt-0.5 ${telemetry.underruns > 0 ? 'text-amber-400' : 'text-neutral-400'}`}>
            {telemetry.underruns}
          </div>
        </div>
        <div className="p-2 rounded bg-neutral-950/80 border border-neutral-800">
          <div className="text-[11px] text-neutral-500">Packet Loss</div>
          <div className={`font-mono text-xs font-bold tabular-nums mt-0.5 ${telemetry.packetLossPercent > 0.5 ? 'text-rose-400' : 'text-neutral-400'}`}>
            {telemetry.packetLossPercent.toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
};
