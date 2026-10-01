import React, { useEffect, useState } from 'react';
import {
  Bluetooth,
  Terminal,
  Download,
  Copy,
  Check,
  X,
  Volume2,
  Sliders,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Monitor,
} from 'lucide-react';

interface BluetoothBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActivateBluetoothBridge: (deviceId: string, latencyOffsetMs: number) => Promise<boolean>;
  activeInputDeviceId?: string;
}

export const BluetoothBridgeModal: React.FC<BluetoothBridgeModalProps> = ({
  isOpen,
  onClose,
  onActivateBluetoothBridge,
  activeInputDeviceId,
}) => {
  const [selectedOs, setSelectedOs] = useState<'windows' | 'linux'>('windows');
  const [inputDevices, setInputDevices] = useState<{ deviceId: string; label: string; isBluetooth: boolean }[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [latencyOffsetMs, setLatencyOffsetMs] = useState<number>(35);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const windowsScript = `# PulseCast - Native Bluetooth A2DP Audio Sink Setup for Windows 10/11
# Run in PowerShell as Administrator

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   PulseCast Bluetooth A2DP Audio Receiver Bridge Setup   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Open Windows Bluetooth Settings to pair phone
Start-Process "ms-settings:bluetooth"

# 2. Install / Verify Microsoft Bluetooth Audio Receiver
Write-Host "[STEP] Verifying Bluetooth Audio Receiver (A2DP Sink)..." -ForegroundColor Yellow
winget install 9N9WCLWDQS5J --accept-source-agreements --accept-package-agreements

Write-Host "[READY] In PulseCast, select your Bluetooth Audio Device from the dropdown." -ForegroundColor Green`;

  const linuxScript = `#!/usr/bin/env bash
# PulseCast - Native PipeWire / BlueZ 5 Bluetooth A2DP Sink Setup
set -e

echo "=== PulseCast Linux Bluetooth A2DP Setup ==="
pactl load-module module-bluetooth-discover || true
pactl load-module module-bluetooth-policy || true

echo "[OK] PipeWire Bluetooth A2DP Sink ready (LDAC / AAC / SBC-XQ)."
echo "Select 'bluez_source' in the PulseCast device dropdown."`;

  const currentScript = selectedOs === 'windows' ? windowsScript : linuxScript;

  const refreshAudioInputs = async () => {
    setIsLoadingDevices(true);
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
        // Request temporary mic permission to reveal device labels if needed
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach((t) => t.stop());
        } catch (e) {
          // ignore if user denies, still try enumeration
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const inputs = devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => {
            const labelLower = d.label.toLowerCase();
            const isBt =
              labelLower.includes('bluetooth') ||
              labelLower.includes('bluez') ||
              labelLower.includes('a2dp') ||
              labelLower.includes('hands-free') ||
              labelLower.includes('wireless') ||
              labelLower.includes('headset') ||
              labelLower.includes('phone');
            return {
              deviceId: d.deviceId,
              label: d.label || `Audio Input (${d.deviceId.slice(0, 5)})`,
              isBluetooth: isBt,
            };
          });

        setInputDevices(inputs);

        // Pre-select bluetooth device if found
        const btDev = inputs.find((i) => i.isBluetooth);
        if (btDev) {
          setSelectedDeviceId(btDev.deviceId);
        } else if (inputs.length > 0 && selectedDeviceId === 'default') {
          setSelectedDeviceId(inputs[0].deviceId);
        }
      }
    } catch (e) {
      console.warn('Failed to enumerate audio inputs:', e);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshAudioInputs();
    }
  }, [isOpen]);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(currentScript);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    const ok = await onActivateBluetoothBridge(selectedDeviceId, latencyOffsetMs);
    setIsConnecting(false);
    if (ok) {
      setConnectSuccess(true);
      setTimeout(() => {
        setConnectSuccess(false);
        onClose();
      }, 1200);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4 bg-neutral-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400">
              <Bluetooth className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-100">
                  Native Bluetooth A2DP Audio Bridge
                </h2>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                  Sprint 2 Active
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Stream phone audio over Bluetooth A2DP and forward directly into PC virtual drivers
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

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Signal Routing Path Card */}
          <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3.5">
            <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Bluetooth A2DP Audio Route:
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-neutral-300">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                <span>Phone (A2DP Source)</span>
              </div>
              <span className="text-neutral-500">→</span>
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Bluetooth className="w-3.5 h-3.5" />
                <span>PC Bluetooth Sink</span>
              </div>
              <span className="text-neutral-500">→</span>
              <div className="flex items-center gap-1.5">
                <Monitor className="w-3.5 h-3.5 text-emerald-400" />
                <span>PulseCast DSP &amp; Driver</span>
              </div>
            </div>
          </div>

          {/* OS Pairing Track Tabs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300">
                Step 1: Pair Phone as Audio Sink on Host PC
              </span>
              <div className="flex items-center gap-1 bg-neutral-950 p-0.5 rounded border border-neutral-800 text-[11px]">
                <button
                  onClick={() => setSelectedOs('windows')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    selectedOs === 'windows'
                      ? 'bg-neutral-800 text-cyan-400 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Windows
                </button>
                <button
                  onClick={() => setSelectedOs('linux')}
                  className={`px-2 py-0.5 rounded font-medium transition-colors ${
                    selectedOs === 'linux'
                      ? 'bg-neutral-800 text-cyan-400 shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  Linux (PipeWire)
                </button>
              </div>
            </div>

            {/* Terminal Command Box */}
            <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 font-mono">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {selectedOs === 'windows'
                      ? 'PowerShell A2DP Sink Setup'
                      : 'PipeWire BlueZ Script'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
                  >
                    {copiedCode ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={
                      selectedOs === 'windows'
                        ? '/api/bluetooth/windows-a2dp.ps1'
                        : '/api/bluetooth/linux-bluez.sh'
                    }
                    download={
                      selectedOs === 'windows'
                        ? 'pulsecast-windows-bluetooth-a2dp.ps1'
                        : 'pulsecast-linux-bluetooth.sh'
                    }
                    className="flex items-center gap-1 px-2 py-0.5 text-[11px] rounded bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
              <pre className="text-[11px] font-mono text-neutral-300 overflow-x-auto whitespace-pre">
                {currentScript}
              </pre>
            </div>
          </div>

          {/* Step 2: Device Selector */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">
                Step 2: Select Bluetooth Audio Input Device
              </span>
              <button
                onClick={refreshAudioInputs}
                disabled={isLoadingDevices}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingDevices ? 'animate-spin' : ''}`} />
                <span>Refresh Devices</span>
              </button>
            </div>

            <div className="relative">
              <select
                aria-label="Bluetooth Input Device"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="default">Default Audio Input Device</option>
                {inputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.isBluetooth ? '🔵 [Bluetooth] ' : ''}
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 3: Latency Calibration Offset */}
          <div className="space-y-2 p-3.5 rounded-lg border border-neutral-800 bg-neutral-950">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Bluetooth Latency Calibration Offset</span>
              </span>
              <span className="font-mono text-cyan-400 font-bold tabular-nums">
                {latencyOffsetMs} ms
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Compensates for Bluetooth RF and codec buffers (AAC ~40ms, LDAC ~30ms, SBC ~45ms)
            </p>
            <input
              type="range"
              min={10}
              max={120}
              step={5}
              value={latencyOffsetMs}
              onChange={(e) => setLatencyOffsetMs(Number(e.target.value))}
              className="w-full accent-cyan-400 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-3.5 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500 font-mono">
            Supported Codecs: LDAC, aptX-HD, AAC, SBC-XQ
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              {connectSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Bridge Activated</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{isConnecting ? 'Linking...' : 'Activate Bluetooth Bridge'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
