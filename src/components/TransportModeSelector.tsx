import React from 'react';
import { TransportType } from '../services/transports/AudioTransport';
import { Wifi, Flame, Bluetooth, Radio, Zap } from 'lucide-react';

interface TransportModeSelectorProps {
  currentTransport: TransportType;
  onChangeTransport: (type: TransportType) => void;
  onOpenHotspotWizard?: () => void;
  onOpenBluetoothWizard?: () => void;
  isHotspotActive?: boolean;
  isBluetoothActive?: boolean;
  gatewayIp?: string;
}

export const TransportModeSelector: React.FC<TransportModeSelectorProps> = ({
  currentTransport,
  onChangeTransport,
  onOpenHotspotWizard,
  onOpenBluetoothWizard,
  isHotspotActive = false,
  isBluetoothActive = false,
  gatewayIp,
}) => {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/90 p-3.5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
            Connection Medium / Transport Link
          </span>
        </div>

        {currentTransport === 'mobile_hotspot' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>Direct SoftAP Link: {gatewayIp || '192.168.43.1'}</span>
            </span>
            {onOpenHotspotWizard && (
              <button
                onClick={onOpenHotspotWizard}
                className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 transition-colors"
              >
                Hotspot Guide
              </button>
            )}
          </div>
        )}

        {currentTransport === 'bluetooth_a2dp' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Bluetooth className="w-3 h-3 text-cyan-400 animate-pulse" />
              <span>Bluetooth A2DP Audio Sink Active</span>
            </span>
            {onOpenBluetoothWizard && (
              <button
                onClick={onOpenBluetoothWizard}
                className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 transition-colors"
              >
                Bluetooth Setup
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mode Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* 1. LAN Wi-Fi */}
        <button
          onClick={() => onChangeTransport('lan_wifi')}
          className={`p-2.5 rounded-lg border text-left transition-all ${
            currentTransport === 'lan_wifi'
              ? 'border-emerald-500 bg-emerald-950/20 text-neutral-100 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Wifi
              className={`w-4 h-4 ${
                currentTransport === 'lan_wifi' ? 'text-emerald-400' : 'text-neutral-400'
              }`}
            />
            <span className="text-xs font-semibold">Local Wi-Fi (LAN)</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1 leading-tight">
            Standard router subnet discovery & streaming
          </p>
        </button>

        {/* 2. Direct Mobile Hotspot */}
        <button
          onClick={() => {
            onChangeTransport('mobile_hotspot');
            if (onOpenHotspotWizard && !isHotspotActive) {
              onOpenHotspotWizard();
            }
          }}
          className={`p-2.5 rounded-lg border text-left transition-all relative ${
            currentTransport === 'mobile_hotspot'
              ? 'border-amber-500 bg-amber-950/25 text-neutral-100 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame
                className={`w-4 h-4 ${
                  currentTransport === 'mobile_hotspot' ? 'text-amber-400' : 'text-neutral-400'
                }`}
              />
              <span className="text-xs font-semibold">Mobile Hotspot</span>
            </div>
            <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
              &lt;5ms
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-tight">
            Direct phone SoftAP link; bypasses router isolation
          </p>
        </button>

        {/* 3. Native Bluetooth A2DP Sink (Sprint 2 Complete!) */}
        <button
          onClick={() => {
            onChangeTransport('bluetooth_a2dp');
            if (onOpenBluetoothWizard) {
              onOpenBluetoothWizard();
            }
          }}
          className={`p-2.5 rounded-lg border text-left transition-all relative ${
            currentTransport === 'bluetooth_a2dp'
              ? 'border-cyan-500 bg-cyan-950/25 text-neutral-100 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bluetooth
                className={`w-4 h-4 ${
                  currentTransport === 'bluetooth_a2dp' ? 'text-cyan-400' : 'text-neutral-400'
                }`}
              />
              <span className="text-xs font-semibold">Bluetooth A2DP</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded">
              A2DP Sink
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-tight">
            Direct Bluetooth phone-to-PC audio sink bridge
          </p>
        </button>

        {/* 4. Bluetooth LE (GATT) (Sprint 3) */}
        <div className="p-2.5 rounded-lg border border-neutral-800/60 bg-neutral-950/30 text-neutral-500 cursor-not-allowed">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-neutral-600" />
              <span className="text-xs font-semibold text-neutral-400">Bluetooth LE</span>
            </div>
            <span className="text-[9px] uppercase font-mono px-1 rounded bg-neutral-800 text-neutral-400">
              Sprint 3
            </span>
          </div>
          <p className="text-[11px] text-neutral-600 mt-1 leading-tight">
            Experimental GATT custom audio packet stream
          </p>
        </div>
      </div>
    </div>
  );
};
