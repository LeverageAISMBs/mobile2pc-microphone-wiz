import React, { useEffect, useRef, useState } from 'react';
import { StreamTelemetry } from '../types/audio';

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  telemetry: StreamTelemetry;
  title?: string;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  analyser,
  telemetry,
  title = 'Real-Time Audio Spectrum & Waveform',
  height = 140,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'oscilloscope' | 'spectrum'>('both');

  useEffect(() => {
    let animId: number;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const h = canvas.height;

      // Dark acoustic background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, width, h);

      // Draw subtle measurement grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridStepsY = 4;
      for (let i = 1; i < gridStepsY; i++) {
        const y = (h / gridStepsY) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (!analyser) {
        // Flat center idle line when offline
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.25)';
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(width, h / 2);
        ctx.stroke();
        animId = requestAnimationFrame(render);
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const timeData = new Uint8Array(bufferLength);
      const freqData = new Uint8Array(bufferLength);

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      // 1. Draw Spectrum (FFT Bars) in background or lower half
      if (viewMode === 'both' || viewMode === 'spectrum') {
        const barCount = 48;
        const barWidth = width / barCount;
        const maxBarHeight = viewMode === 'both' ? h * 0.7 : h * 0.85;

        for (let i = 0; i < barCount; i++) {
          // Logarithmic bin sampling
          const binIndex = Math.min(
            bufferLength - 1,
            Math.floor(Math.pow(i / barCount, 2) * (bufferLength / 2) + 2)
          );
          const barValue = freqData[binIndex] / 255.0;
          const barH = barValue * maxBarHeight;
          const x = i * barWidth;
          const y = h - barH;

          // Gradient from emerald green to cyan
          const grad = ctx.createLinearGradient(0, y, 0, h);
          grad.addColorStop(0, 'rgba(52, 211, 153, 0.85)');
          grad.addColorStop(1, 'rgba(16, 185, 129, 0.15)');

          ctx.fillStyle = grad;
          ctx.fillRect(x + 1, y, barWidth - 2, barH);
        }
      }

      // 2. Draw Oscilloscope (Time Domain Waveform)
      if (viewMode === 'both' || viewMode === 'oscilloscope') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#34d399';
        ctx.shadowColor = 'rgba(52, 211, 153, 0.6)';
        ctx.shadowBlur = 6;
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeData[i] / 128.0; // 0 to 2
          const y = (v * h) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }

        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyser, viewMode]);

  // Meter percentage calculations
  const leftPct = Math.max(0, Math.min(100, ((telemetry.peakDbfsLeft + 60) / 60) * 100));
  const rightPct = Math.max(0, Math.min(100, ((telemetry.peakDbfsRight + 60) / 60) * 100));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-4">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {title}
          </span>
          <span className="text-xs text-neutral-500">·</span>
          <span className="font-mono text-xs text-neutral-400 tabular-nums">
            {telemetry.sampleRate ? `${telemetry.sampleRate / 1000} kHz` : '48.0 kHz'} / 24-bit
          </span>
        </div>

        <div className="flex items-center gap-1 rounded bg-neutral-950 p-0.5 text-xs">
          <button
            onClick={() => setViewMode('both')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'both'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Combined
          </button>
          <button
            onClick={() => setViewMode('oscilloscope')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'oscilloscope'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Waveform
          </button>
          <button
            onClick={() => setViewMode('spectrum')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              viewMode === 'spectrum'
                ? 'bg-neutral-800 text-emerald-400'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Spectrum
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded border border-neutral-800/80 bg-neutral-950">
        <canvas
          ref={canvasRef}
          width={720}
          height={height}
          className="w-full h-auto block"
        />

        {/* Dynamic Peak Overlay tag */}
        <div className="absolute top-2 right-2 flex items-center gap-2 text-xs font-mono tabular-nums text-neutral-400 bg-neutral-950/80 px-2 py-0.5 rounded border border-neutral-800">
          <span>Peak: {telemetry.peakDbfsLeft.toFixed(1)} dBFS</span>
          {telemetry.isClipping && (
            <span className="text-rose-400 font-semibold uppercase animate-pulse">CLIP</span>
          )}
        </div>
      </div>

      {/* Stereo VU Peak Meters */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="w-4 text-neutral-500 font-semibold">L</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-neutral-950 border border-neutral-800">
            <div
              className={`h-full transition-all duration-75 ${
                leftPct > 90 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${leftPct}%` }}
            />
          </div>
          <span className="w-16 text-right tabular-nums text-neutral-400">
            {telemetry.peakDbfsLeft <= -60 ? '-∞' : `${telemetry.peakDbfsLeft} dB`}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="w-4 text-neutral-500 font-semibold">R</span>
          <div className="relative h-2 flex-1 overflow-hidden rounded-sm bg-neutral-950 border border-neutral-800">
            <div
              className={`h-full transition-all duration-75 ${
                rightPct > 90 ? 'bg-amber-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${rightPct}%` }}
            />
          </div>
          <span className="w-16 text-right tabular-nums text-neutral-400">
            {telemetry.peakDbfsRight <= -60 ? '-∞' : `${telemetry.peakDbfsRight} dB`}
          </span>
        </div>
      </div>
    </div>
  );
};
