import React, { useState, useEffect } from 'react';
import {
  StudioDspEngine,
  StudioDspSettings,
  DspPresetName,
} from '../services/dsp/StudioDspEngine';
import {
  Sliders,
  Activity,
  Zap,
  Volume2,
  Shield,
  Check,
  Power,
  Sparkles,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface StudioDspRackProps {
  dspEngine: StudioDspEngine | null;
  onUpdate?: () => void;
}

export const StudioDspRack: React.FC<StudioDspRackProps> = ({ dspEngine, onUpdate }) => {
  const [isEnabled, setIsEnabled] = useState<boolean>(dspEngine?.settings.enabled ?? true);
  const [highPass, setHighPass] = useState<boolean>(dspEngine?.settings.highPassEnabled ?? true);
  const [bands, setBands] = useState(
    dspEngine?.settings.bands || [
      { freq: 80, gain: 2.0, q: 0.7, type: 'lowshelf' as BiquadFilterType },
      { freq: 250, gain: -1.5, q: 1.4, type: 'peaking' as BiquadFilterType },
      { freq: 1000, gain: 0.0, q: 1.0, type: 'peaking' as BiquadFilterType },
      { freq: 3500, gain: 2.5, q: 1.2, type: 'peaking' as BiquadFilterType },
      { freq: 10000, gain: 3.0, q: 0.7, type: 'highshelf' as BiquadFilterType },
    ]
  );
  const [threshold, setThreshold] = useState<number>(dspEngine?.settings.compressor.threshold ?? -20);
  const [ratio, setRatio] = useState<number>(dspEngine?.settings.compressor.ratio ?? 4);
  const [gainReduction, setGainReduction] = useState<number>(0);
  const [activePreset, setActivePreset] = useState<DspPresetName>('broadcast');

  useEffect(() => {
    if (!dspEngine) return;

    const interval = setInterval(() => {
      setGainReduction(dspEngine.getGainReduction());
    }, 100);

    return () => clearInterval(interval);
  }, [dspEngine]);

  const handleToggleEnable = () => {
    if (!dspEngine) return;
    const next = !isEnabled;
    setIsEnabled(next);
    dspEngine.setEnabled(next);
    if (onUpdate) onUpdate();
  };

  const handleToggleHighPass = () => {
    if (!dspEngine) return;
    const next = !highPass;
    setHighPass(next);
    dspEngine.setHighPassEnabled(next);
    if (onUpdate) onUpdate();
  };

  const handleBandChange = (index: number, val: number) => {
    if (!dspEngine) return;
    dspEngine.setBandGain(index, val);
    setBands((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], gain: val };
      return copy;
    });
    if (onUpdate) onUpdate();
  };

  const handleThresholdChange = (val: number) => {
    if (!dspEngine) return;
    setThreshold(val);
    dspEngine.setCompressorParam('threshold', val);
    if (onUpdate) onUpdate();
  };

  const handleRatioChange = (val: number) => {
    if (!dspEngine) return;
    setRatio(val);
    dspEngine.setCompressorParam('ratio', val);
    if (onUpdate) onUpdate();
  };

  const handleApplyPreset = (preset: DspPresetName) => {
    if (!dspEngine) return;
    setActivePreset(preset);
    dspEngine.applyPreset(preset);
    setIsEnabled(dspEngine.settings.enabled);
    setHighPass(dspEngine.settings.highPassEnabled);
    setBands([...dspEngine.settings.bands]);
    setThreshold(dspEngine.settings.compressor.threshold);
    setRatio(dspEngine.settings.compressor.ratio);
    if (onUpdate) onUpdate();
  };

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-5 space-y-4">
      {/* Rack Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-neutral-100">
                Studio DSP Audio Processor &amp; Dynamics Rack
              </h3>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                Sprint 5 Active
              </span>
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              5-band parametric equalizer, master compressor/limiter, and 80Hz rumble cut
            </p>
          </div>
        </div>

        {/* Master Power Bypass */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleEnable}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              isEnabled
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-400'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{isEnabled ? 'DSP Active' : 'DSP Bypassed'}</span>
          </button>
        </div>
      </div>

      {/* Presets Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-neutral-500 font-medium mr-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-emerald-400" /> Presets:
        </span>
        {[
          { id: 'broadcast', label: 'Radio Broadcast Warmth' },
          { id: 'vocal', label: 'Vocal Clarity & Presence' },
          { id: 'instrument', label: 'Acoustic / Flat' },
          { id: 'punch', label: 'Bass Punch & Air' },
          { id: 'bypass', label: 'Clean Bypass' },
        ].map((p) => {
          const isSelected = activePreset === p.id && isEnabled === (p.id !== 'bypass');
          return (
            <button
              key={p.id}
              onClick={() => handleApplyPreset(p.id as DspPresetName)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Main Rack Controls: 5-Band EQ + Dynamics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-1">
        {/* Left: 5-Band Parametric EQ (8 cols) */}
        <div className="lg:col-span-8 rounded-lg border border-neutral-800 bg-neutral-950 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>5-Band Parametric Equalizer</span>
            </span>
            <button
              onClick={handleToggleHighPass}
              className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono rounded border transition-colors ${
                highPass
                  ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-400'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-500'
              }`}
            >
              <span>80Hz Rumble Cut</span>
              {highPass && <Check className="w-3 h-3 text-emerald-400" />}
            </button>
          </div>

          {/* EQ Sliders Grid */}
          <div className="grid grid-cols-5 gap-3 text-center">
            {bands.map((band, idx) => {
              const freqLabels = ['80 Hz', '250 Hz', '1.0 kHz', '3.5 kHz', '10 kHz'];
              const subLabels = ['Sub Shelf', 'Mud Cut', 'Body', 'Clarity', 'Air Shelf'];
              return (
                <div key={idx} className="flex flex-col items-center space-y-2">
                  <div className="text-[11px] font-mono text-neutral-300 font-bold">
                    {band.gain > 0 ? `+${band.gain.toFixed(1)}` : band.gain.toFixed(1)} dB
                  </div>
                  <div className="h-32 flex items-center justify-center">
                    <input
                      type="range"
                      min={-12}
                      max={12}
                      step={0.5}
                      value={band.gain}
                      disabled={!isEnabled}
                      onChange={(e) => handleBandChange(idx, Number(e.target.value))}
                      className="accent-emerald-400 h-28 -rotate-90 appearance-none cursor-pointer w-28 bg-neutral-800 rounded-lg disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-neutral-200">{freqLabels[idx]}</div>
                    <div className="text-[10px] text-neutral-500 truncate">{subLabels[idx]}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Studio Dynamics Compressor (4 cols) */}
        <div className="lg:col-span-4 rounded-lg border border-neutral-800 bg-neutral-950 p-4 space-y-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Studio Compressor &amp; Limiter</span>
            </span>
            <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
              True Peak
            </span>
          </div>

          {/* Threshold Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400">Threshold:</span>
              <span className="text-neutral-200 font-bold">{threshold} dBFS</span>
            </div>
            <input
              type="range"
              min={-50}
              max={0}
              step={1}
              value={threshold}
              disabled={!isEnabled}
              onChange={(e) => handleThresholdChange(Number(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Ratio Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-neutral-400">Compression Ratio:</span>
              <span className="text-neutral-200 font-bold">{ratio}:1</span>
            </div>
            <input
              type="range"
              min={1}
              max={16}
              step={0.5}
              value={ratio}
              disabled={!isEnabled}
              onChange={(e) => handleRatioChange(Number(e.target.value))}
              className="w-full accent-amber-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer disabled:opacity-40"
            />
          </div>

          {/* Gain Reduction Meter */}
          <div className="p-2.5 rounded bg-neutral-900 border border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-neutral-400">Gain Reduction (GR):</span>
              <span className="font-bold text-amber-400">
                {gainReduction > 0 ? `-${gainReduction.toFixed(1)} dB` : '0.0 dB'}
              </span>
            </div>
            <div className="h-2 w-full bg-neutral-950 rounded-full overflow-hidden flex justify-end">
              <div
                className="bg-amber-500 h-full transition-all duration-75"
                style={{ width: `${Math.min(100, (gainReduction / 16) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
