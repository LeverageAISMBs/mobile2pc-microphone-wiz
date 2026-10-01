import React from 'react';
import { AudioCodec, CodecInfo } from '../types/audio';
import { Zap, Radio, Check, Disc, Sliders } from 'lucide-react';

interface CodecSelectorProps {
  activeCodec: AudioCodec;
  onChangeCodec: (codec: AudioCodec) => void;
  frameSizeMs: number;
  onChangeFrameSize: (frameSizeMs: number) => void;
}

export const CODEC_DEFINITIONS: CodecInfo[] = [
  {
    id: 'opus',
    name: 'Opus VBR (Sub-band Adaptive)',
    bitrateKbps: 128,
    sampleRate: 48000,
    channels: 2,
    frameSizeMs: 10,
    encodeDelayMs: 0.15,
    description: 'High-fidelity voice & music with 4:1 compression ratio and sub-millisecond encoding overhead.',
    lossless: false,
    idealFor: 'Low-bandwidth Wi-Fi & everyday streaming',
  },
  {
    id: 'pcm16',
    name: 'Linear PCM 16-bit (CD Standard)',
    bitrateKbps: 1536,
    sampleRate: 48000,
    channels: 2,
    frameSizeMs: 5,
    encodeDelayMs: 0.02,
    description: 'True uncompressed linear PCM with 96 dB dynamic range and zero encode latency.',
    lossless: true,
    idealFor: 'Esports, competitive gaming, zero latency',
  },
  {
    id: 'pcm24',
    name: 'Studio Master 24-bit PCM',
    bitrateKbps: 2304,
    sampleRate: 48000,
    channels: 2,
    frameSizeMs: 5,
    encodeDelayMs: 0.04,
    description: 'Professional 144 dB dynamic range for high-end studio monitoring, instrumentation, and DAWs.',
    lossless: true,
    idealFor: 'Studio production & audiophile DACs',
  },
  {
    id: 'flac',
    name: 'FLAC Predictive Lossless',
    bitrateKbps: 840,
    sampleRate: 48000,
    channels: 2,
    frameSizeMs: 10,
    encodeDelayMs: 0.08,
    description: 'Lossless linear predictive differential encoding reducing bandwidth by ~45% without fidelity loss.',
    lossless: true,
    idealFor: 'Hi-Fi music on congested Wi-Fi channels',
  },
  {
    id: 'float32',
    name: 'Float32 IEEE Direct Stream',
    bitrateKbps: 3072,
    sampleRate: 48000,
    channels: 2,
    frameSizeMs: 2.5,
    encodeDelayMs: 0.01,
    description: 'Direct 32-bit floating point audio bus for direct virtual driver inject with maximum headroom.',
    lossless: true,
    idealFor: 'ASIO / PipeWire low-latency loopback',
  },
];

export const CodecSelector: React.FC<CodecSelectorProps> = ({
  activeCodec,
  onChangeCodec,
  frameSizeMs,
  onChangeFrameSize,
}) => {
  const selectedInfo = CODEC_DEFINITIONS.find((c) => c.id === activeCodec) || CODEC_DEFINITIONS[0];

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-neutral-200">
            High-Fidelity Codec Engine
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Select lossless PCM, studio master bit-depth, or adaptive compressed stream
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-mono text-neutral-400">
          <span className="text-neutral-500">Active:</span>
          <span className="font-semibold text-emerald-400 tabular-nums">
            {selectedInfo.bitrateKbps} kbps
          </span>
        </div>
      </div>

      {/* Codec Card Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CODEC_DEFINITIONS.map((codec) => {
          const isSelected = codec.id === activeCodec;
          return (
            <button
              key={codec.id}
              onClick={() => onChangeCodec(codec.id)}
              className={`p-3.5 rounded-lg border text-left transition-all relative ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-950/20 text-neutral-100 shadow-sm'
                  : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-1.5 rounded ${
                      isSelected
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-neutral-800 text-neutral-400'
                    }`}
                  >
                    {codec.lossless ? <Disc className="w-4 h-4" /> : <Radio className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-xs font-semibold leading-tight text-neutral-200">
                      {codec.name}
                    </div>
                    <div className="text-[11px] text-neutral-500 font-mono tabular-nums mt-0.5">
                      {codec.bitrateKbps} kbps · {codec.lossless ? 'Lossless' : 'Compressed'}
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center text-neutral-950">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>

              <p className="text-[11px] text-neutral-400 mt-2.5 line-clamp-2">
                {codec.description}
              </p>

              <div className="mt-2.5 pt-2 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500">
                <span>{codec.idealFor}</span>
                <span className="font-mono text-emerald-400/80 font-medium">
                  {codec.encodeDelayMs} ms delay
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Frame Size / Packetizer Controls */}
      <div className="rounded border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Packet Frame Size / Chunk Duration</span>
            </div>
            <p className="text-[11px] text-neutral-500 mt-0.5">
              Smaller frames minimize transmission latency; larger frames optimize Wi-Fi packet efficiency
            </p>
          </div>

          {/* Segmented frame size selector */}
          <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-md border border-neutral-800 text-xs">
            {[2.5, 5, 10, 20].map((ms) => (
              <button
                key={ms}
                onClick={() => onChangeFrameSize(ms)}
                className={`px-3 py-1 font-mono font-medium rounded transition-colors whitespace-nowrap ${
                  frameSizeMs === ms
                    ? 'bg-neutral-800 text-emerald-400 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {ms} ms
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
