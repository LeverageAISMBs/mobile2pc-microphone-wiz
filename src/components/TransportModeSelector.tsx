import React from 'react';
import { TransportType } from '../services/transports/AudioTransport';
import { Wifi, Flame, Bluetooth, Radio, Zap, Globe } from 'lucide-react';

interface TransportModeSelectorProps {
  currentTransport: TransportType;
  onChangeTransport: (type: TransportType) => void;
  onOpenHotspotWizard?: () => void;
  onOpenBluetoothWizard?: () => void;
  onOpenGattWizard?: () => void;
  onOpenWebRtcWizard?: () => void;
  isHotspotActive?: boolean;
  isBluetoothActive?: boolean;
  isGattActive?: boolean;
  gatewayIp?: string;
  bleMtuSize?: number;
}

export const TransportModeSelector: React.FC<TransportModeSelectorProps> = ({
  currentTransport,
  onChangeTransport,
  onOpenHotspotWizard,
  onOpenBluetoothWizard,
  onOpenGattWizard,
  onOpenWebRtcWizard,
  isHotspotActive = false,
  isBluetoothActive = false,
  isGattActive = false,
  gatewayIp,
  bleMtuSize = 240,
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

        {currentTransport === 'webrtc_p2p' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Globe className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Direct WebRTC P2P DataChannel (0 Server Hops)</span>
            </span>
            {onOpenWebRtcWizard && (
              <button
                onClick={onOpenWebRtcWizard}
                className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 transition-colors"
              >
                P2P Inspector
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

        {currentTransport === 'bluetooth_ble' && (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              <Radio className="w-3 h-3 text-indigo-400 animate-pulse" />
              <span>BLE GATT Active · MTU {bleMtuSize}B</span>
            </span>
            {onOpenGattWizard && (
              <button
                onClick={onOpenGattWizard}
                className="text-xs text-neutral-400 hover:text-neutral-200 underline underline-offset-2 transition-colors"
              >
                GATT Slicer
              </button>
            )}
          </div>
        )}
      </div>

      {/* Mode Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
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
            <span className="text-xs font-semibold">Local Wi-Fi</span>
          </div>
          <p className="text-[11px] text-neutral-500 mt-1 leading-tight">
            Standard router subnet discovery &amp; streaming
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
              <span className="text-xs font-semibold">Hotspot</span>
            </div>
            <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded">
              &lt;5ms
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-tight">
            Direct phone SoftAP link; bypasses router isolation
          </p>
        </button>

        {/* 3. Direct WebRTC P2P DataChannel */}
        <button
          onClick={() => {
            onChangeTransport('webrtc_p2p');
            if (onOpenWebRtcWizard) {
              onOpenWebRtcWizard();
            }
          }}
          className={`p-2.5 rounded-lg border text-left transition-all relative ${
            currentTransport === 'webrtc_p2p'
              ? 'border-emerald-500 bg-emerald-950/25 text-neutral-100 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe
                className={`w-4 h-4 ${
                  currentTransport === 'webrtc_p2p' ? 'text-emerald-400' : 'text-neutral-400'
                }`}
              />
              <span className="text-xs font-semibold">WebRTC P2P</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
              UDP
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-tight">
            Direct host-to-host DataChannel; 0 server hops
          </p>
        </button>

        {/* 4. Native Bluetooth A2DP Sink */}
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
              <span className="text-xs font-semibold">A2DP Sink</span>
            </div>
            <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.5 rounded">
              A2DP
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-tight">
            Direct Bluetooth phone-to-PC audio sink bridge
          </p>
        </button>

        {/* 5. Bluetooth LE (GATT) */}
        <button
          onClick={() => {
            onChangeTransport('bluetooth_ble');
            if (onOpenGattWizard) {
              onOpenGattWizard();
            }
          }}
          className={`p-2.5 rounded-lg border text-left transition-all relative ${
            currentTransport === 'bluetooth_ble'
              ? 'border-indigo-500 bg-indigo-950/25 text-neutral-100 shadow-sm'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio
                className={`w-4 h-4 ${
                  currentTransport === 'bluetooth_ble' ? 'text-indigo-400' : 'text-neutral-400'
                }`}
              />
              <span className="text-xs font-semibold">BLE GATT</span>
            </div>
            <span className="text-[10px] font-mono text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded">
              GATT
            </span>
          </div>
          <p className="text-[11px] text-neutral-400 mt-1 leading-tight">
            Custom BLE GATT audio characteristic stream
          </p>
        </button>
      </div>
    </div>
  );
};
