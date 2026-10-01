import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { HotspotNetworkInfo } from '../services/transports/AudioTransport';
import {
  Flame,
  Wifi,
  Smartphone,
  Check,
  Copy,
  X,
  ExternalLink,
  RefreshCw,
  Zap,
  Sliders,
  ShieldAlert,
} from 'lucide-react';

interface HotspotWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionCode: string;
  onApplyHotspotPreset: (gatewayIp: string) => void;
}

export const HotspotWizardModal: React.FC<HotspotWizardModalProps> = ({
  isOpen,
  onClose,
  sessionCode,
  onApplyHotspotPreset,
}) => {
  const [selectedMobileOs, setSelectedMobileOs] = useState<'android' | 'ios' | 'windows'>('android');
  const [selectedGatewayIp, setSelectedGatewayIp] = useState<string>('192.168.43.1');
  const [customIp, setCustomIp] = useState<string>('');
  const [detectedIfaces, setDetectedIfaces] = useState<HotspotNetworkInfo[]>([]);
  const [isLoadingIfaces, setIsLoadingIfaces] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Direct Hotspot Transmitter Link
  const effectiveIp = customIp.trim() || selectedGatewayIp;
  const hotspotUrl = typeof window !== 'undefined'
    ? `${window.location.protocol}//${effectiveIp}:${window.location.port || '3000'}/?role=transmitter&transport=mobile_hotspot&code=${sessionCode}`
    : `http://${effectiveIp}:3000/?role=transmitter&transport=mobile_hotspot&code=${sessionCode}`;

  useEffect(() => {
    if (selectedMobileOs === 'android') {
      setSelectedGatewayIp('192.168.43.1');
    } else if (selectedMobileOs === 'ios') {
      setSelectedGatewayIp('172.20.10.1');
    } else {
      setSelectedGatewayIp('192.168.137.1');
    }
  }, [selectedMobileOs]);

  useEffect(() => {
    if (isOpen) {
      fetchNetworkInterfaces();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, hotspotUrl, {
        width: 180,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#fef3c7', // warm amber backing for hotspot
        },
      }).catch((e) => console.error('QR code error:', e));
    }
  }, [isOpen, hotspotUrl]);

  const fetchNetworkInterfaces = async () => {
    setIsLoadingIfaces(true);
    try {
      const res = await fetch('/api/network/interfaces');
      const data = await res.json();
      if (data && data.interfaces) {
        setDetectedIfaces(data.interfaces);
        // If an interface on hotspot subnet is detected, automatically select it!
        const hotspotIface = data.interfaces.find(
          (i: HotspotNetworkInfo) => i.type === 'hotspot' || i.address.startsWith('192.168.43.') || i.address.startsWith('172.20.10.')
        );
        if (hotspotIface && hotspotIface.gatewayIp) {
          setSelectedGatewayIp(hotspotIface.gatewayIp);
        }
      }
    } catch (e) {
      console.warn('Failed to query network interfaces:', e);
    } finally {
      setIsLoadingIfaces(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(hotspotUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleApply = () => {
    onApplyHotspotPreset(effectiveIp);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-800 px-6 py-4 bg-neutral-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-neutral-100">
                  Direct Mobile Hotspot (SoftAP) Wizard
                </h2>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  Sub-5ms Latency
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                Stream directly between phone and PC with zero router hops and client isolation bypass
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
          {/* Why Hotspot Banner */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3.5 flex items-start gap-3">
            <Zap className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-xs text-neutral-300">
              <strong className="text-amber-300">Zero-Router Direct Link:</strong> When using public, hotel, or office Wi-Fi, <em>Client Isolation</em> often blocks device pairing. Connecting your PC directly to your phone's personal hotspot eliminates router latency and avoids network drops.
            </div>
          </div>

          {/* OS Switcher for Hotspot setup instructions */}
          <div>
            <div className="text-xs font-semibold text-neutral-300 mb-2">
              Step 1: Turn on Personal Hotspot on Phone
            </div>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-neutral-950 rounded-lg border border-neutral-800 text-xs">
              <button
                onClick={() => setSelectedMobileOs('android')}
                className={`py-1.5 rounded font-medium transition-colors ${
                  selectedMobileOs === 'android'
                    ? 'bg-neutral-800 text-amber-400 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Android (SoftAP)
              </button>
              <button
                onClick={() => setSelectedMobileOs('ios')}
                className={`py-1.5 rounded font-medium transition-colors ${
                  selectedMobileOs === 'ios'
                    ? 'bg-neutral-800 text-amber-400 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                iPhone / iPad (iOS)
              </button>
              <button
                onClick={() => setSelectedMobileOs('windows')}
                className={`py-1.5 rounded font-medium transition-colors ${
                  selectedMobileOs === 'windows'
                    ? 'bg-neutral-800 text-amber-400 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Windows Hotspot
              </button>
            </div>

            {/* Instruction Card */}
            <div className="mt-2.5 p-3 rounded-lg border border-neutral-800 bg-neutral-950 text-xs text-neutral-300 space-y-1.5">
              {selectedMobileOs === 'android' && (
                <>
                  <div className="font-semibold text-neutral-200">Android Instructions:</div>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                    <li>Go to <strong className="text-neutral-200">Settings &gt; Network &amp; Internet &gt; Hotspot &amp; Tethering</strong></li>
                    <li>Toggle <strong className="text-neutral-200">Wi-Fi Hotspot</strong> ON</li>
                    <li>Connect your PC's Wi-Fi to your phone's hotspot network</li>
                    <li>Android default gateway IP is <strong className="font-mono text-amber-400">192.168.43.1</strong></li>
                  </ol>
                </>
              )}
              {selectedMobileOs === 'ios' && (
                <>
                  <div className="font-semibold text-neutral-200">iOS Instructions:</div>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                    <li>Go to <strong className="text-neutral-200">Settings &gt; Personal Hotspot</strong></li>
                    <li>Toggle <strong className="text-neutral-200">Allow Others to Join</strong> ON</li>
                    <li>Connect your PC's Wi-Fi to your iPhone's hotspot</li>
                    <li>iOS default gateway IP is <strong className="font-mono text-amber-400">172.20.10.1</strong></li>
                  </ol>
                </>
              )}
              {selectedMobileOs === 'windows' && (
                <>
                  <div className="font-semibold text-neutral-200">Windows Mobile Hotspot:</div>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-400">
                    <li>Open Windows <strong className="text-neutral-200">Settings &gt; Network &amp; Internet &gt; Mobile Hotspot</strong></li>
                    <li>Toggle ON to share PC Wi-Fi to your mobile phone</li>
                    <li>Windows HostedNetwork gateway IP is <strong className="font-mono text-amber-400">192.168.137.1</strong></li>
                  </ol>
                </>
              )}
            </div>
          </div>

          {/* Step 2: Gateway Target & QR Code */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">
                Step 2: Connect Phone with Direct Gateway IP
              </span>
              <button
                onClick={fetchNetworkInterfaces}
                disabled={isLoadingIfaces}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingIfaces ? 'animate-spin' : ''}`} />
                <span>Scan Subnets</span>
              </button>
            </div>

            {/* Detected subnets chips */}
            {detectedIfaces.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detectedIfaces
                  .filter((i) => !i.address.startsWith('127.'))
                  .map((iface) => (
                    <button
                      key={iface.address}
                      onClick={() => {
                        setSelectedGatewayIp(iface.address);
                        setCustomIp('');
                      }}
                      className={`px-2 py-1 rounded text-xs font-mono tabular-nums border transition-colors ${
                        effectiveIp === iface.address
                          ? 'border-amber-500 bg-amber-950/30 text-amber-300'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-neutral-200'
                      }`}
                    >
                      {iface.name}: {iface.address}
                    </button>
                  ))}
              </div>
            )}

            {/* Custom IP input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Or enter custom gateway IP (e.g. 192.168.43.1)"
                value={customIp}
                onChange={(e) => setCustomIp(e.target.value)}
                className="flex-1 rounded border border-neutral-800 bg-neutral-950 px-3 py-1.5 font-mono text-xs text-neutral-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* QR Code and Direct URL Container */}
            <div className="p-4 rounded-lg border border-neutral-800 bg-neutral-950 flex flex-col sm:flex-row items-center gap-4">
              <div className="p-2 rounded bg-amber-100 shadow shrink-0">
                <canvas ref={qrCanvasRef} className="block rounded" />
              </div>

              <div className="space-y-2 flex-1 text-center sm:text-left">
                <div className="text-xs font-semibold text-neutral-200">
                  Scan QR with Phone on Hotspot
                </div>
                <p className="text-[11px] text-neutral-400">
                  Automatically launches transmitter mode linked to direct gateway{' '}
                  <strong className="font-mono text-amber-400">{effectiveIp}</strong>.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    readOnly
                    value={hotspotUrl}
                    className="flex-1 rounded border border-neutral-800 bg-neutral-900 px-2.5 py-1 font-mono text-[11px] text-neutral-300 truncate"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="p-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors shrink-0"
                    title="Copy Link"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 text-amber-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-neutral-800 bg-neutral-950 px-6 py-3.5 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500 font-mono">
            Optimized Preset: 5ms Buffer · PCM 24-bit · 2.5ms Chunks
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-md transition-colors shadow-sm"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Activate Hotspot Mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
