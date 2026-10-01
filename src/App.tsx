import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StreamTelemetry, AudioCodec, BufferConfig } from './types/audio';
import { AudioStreamer, AudioSourceType } from './services/audioStreamer';
import { PcReceiverView } from './components/PcReceiverView';
import { MobileTransmitterView } from './components/MobileTransmitterView';
import { DriverFrameworkHub } from './components/DriverFrameworkHub';
import { DevicePairingModal } from './components/DevicePairingModal';
import { AudioVisualizer } from './components/AudioVisualizer';
import {
  Radio,
  Wifi,
  Monitor,
  Smartphone,
  Cpu,
  QrCode,
  Volume2,
  VolumeX,
  Play,
  Square,
  Split,
  Layers,
  AlertTriangle,
  Info,
} from 'lucide-react';

export default function App() {
  // Navigation / View modes:
  // 'receiver': PC Workstation Host view
  // 'transmitter': Mobile phone transmitter view
  // 'workbench': Dual split simulator (transmitter + receiver side by side on one screen)
  // 'drivers': Open-source virtual audio driver setup guide
  const [activeTab, setActiveTab] = useState<'receiver' | 'transmitter' | 'workbench' | 'drivers'>('receiver');

  // Session & Connection state
  const [sessionCode, setSessionCode] = useState<string>('PULSE-89');
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [peerCounts, setPeerCounts] = useState({ rx: 1, tx: 0 });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audio Processing State
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [activeSource, setActiveSource] = useState<AudioSourceType>('mic');
  const [activeCodec, setActiveCodec] = useState<AudioCodec>('opus');
  const [frameSizeMs, setFrameSizeMs] = useState<number>(10);
  const [inputGain, setInputGain] = useState<number>(1.0);
  const [outputVolume, setOutputVolume] = useState<number>(1.0);
  const [pan, setPan] = useState<number>(0);
  const [isInputMuted, setIsInputMuted] = useState<boolean>(false);
  const [isOutputMuted, setIsOutputMuted] = useState<boolean>(false);
  const [isLoopbackMonitor, setIsLoopbackMonitor] = useState<boolean>(false);

  // Buffer Configuration
  const [bufferConfig, setBufferConfig] = useState<BufferConfig>({
    bufferSizeMs: 20,
    adaptiveJitter: true,
    packetLossConcealment: true,
    dropLatePackets: true,
    sampleRate: 48000,
    channels: 2,
    frameSizeMs: 10,
  });

  // Stream Telemetry
  const [telemetry, setTelemetry] = useState<StreamTelemetry>({
    rttMs: 4.8,
    audioLatencyMs: 16.2,
    jitterMs: 1.4,
    packetLossPercent: 0.0,
    bitrateKbps: 0,
    bufferFillMs: 20.0,
    bufferFillPercent: 100,
    packetsSent: 0,
    packetsReceived: 0,
    underruns: 0,
    overruns: 0,
    signalRssi: -44,
    peakDbfsLeft: -60,
    peakDbfsRight: -60,
    rmsDbfs: -60,
    isClipping: false,
    networkQuality: 'excellent',
  });

  // Streamer instance ref
  const streamerRef = useRef<AudioStreamer | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  // Initialize and check URL parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get('role');
      const codeParam = params.get('code');

      if (codeParam) {
        setSessionCode(codeParam.toUpperCase());
      }

      if (roleParam === 'transmitter') {
        setActiveTab('transmitter');
      } else if (roleParam === 'receiver') {
        setActiveTab('receiver');
      }
    }
  }, []);

  // Initialize audio streamer
  useEffect(() => {
    const role = activeTab === 'transmitter' ? 'transmitter' : 'receiver';

    if (streamerRef.current) {
      streamerRef.current.destroy();
    }

    const streamer = new AudioStreamer(role, sessionCode, {
      onTelemetry: (t) => {
        setTelemetry(t);
      },
      onConnectionChange: (connected, peers) => {
        setIsConnected(connected);
        setPeerCounts(peers);
      },
      onError: (err) => {
        setErrorMessage(err);
        setTimeout(() => setErrorMessage(null), 5000);
      },
    });

    streamer.connectWebSocket();
    streamerRef.current = streamer;

    // Set initial analyser node
    const an = role === 'transmitter' ? streamer.getInputAnalyser() : streamer.getOutputAnalyser();
    setAnalyser(an);

    return () => {
      streamer.destroy();
    };
  }, [sessionCode, activeTab]);

  // Transmit toggle handler
  const handleToggleStreaming = async () => {
    if (!streamerRef.current) return;

    if (isTransmitting) {
      streamerRef.current.stopTransmitting();
      setIsTransmitting(false);
    } else {
      await streamerRef.current.startTransmitting(activeSource);
      setIsTransmitting(true);
      setAnalyser(streamerRef.current.getInputAnalyser() || streamerRef.current.getOutputAnalyser());
    }
  };

  const handleChangeSource = async (newSource: AudioSourceType) => {
    setActiveSource(newSource);
    if (isTransmitting && streamerRef.current) {
      streamerRef.current.stopTransmitting();
      await streamerRef.current.startTransmitting(newSource);
    }
  };

  const handleChangeCodec = (codec: AudioCodec) => {
    setActiveCodec(codec);
    if (streamerRef.current) {
      streamerRef.current.setCodec(codec);
    }
  };

  const handleChangeBufferConfig = (updated: Partial<BufferConfig>) => {
    setBufferConfig((prev) => {
      const next = { ...prev, ...updated };
      if (streamerRef.current) {
        streamerRef.current.updateBufferConfig(next);
      }
      return next;
    });
  };

  const handleChangeInputGain = (gain: number) => {
    setInputGain(gain);
    if (streamerRef.current) {
      streamerRef.current.setInputGain(gain);
    }
  };

  const handleChangeOutputVolume = (vol: number) => {
    setOutputVolume(vol);
    if (streamerRef.current) {
      streamerRef.current.setOutputGain(vol);
    }
  };

  const handleChangePan = (newPan: number) => {
    setPan(newPan);
    if (streamerRef.current) {
      streamerRef.current.setPan(newPan);
    }
  };

  const handleToggleInputMute = () => {
    const next = !isInputMuted;
    setIsInputMuted(next);
    if (streamerRef.current) {
      streamerRef.current.setMute(next);
    }
  };

  const handleToggleOutputMute = () => {
    const next = !isOutputMuted;
    setIsOutputMuted(next);
    if (streamerRef.current) {
      streamerRef.current.setOutputGain(next ? 0 : outputVolume);
    }
  };

  const handleToggleLoopback = () => {
    const next = !isLoopbackMonitor;
    setIsLoopbackMonitor(next);
    if (streamerRef.current) {
      streamerRef.current.setLoopbackMonitor(next);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Top Bar Contract: Zone 1 (Single Wordmark) - Zone 2 (4-6 Clean Nav Links) - Zone 3 (1-2 Actions) */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5 border-b border-neutral-800 bg-neutral-950/90 backdrop-blur-md">
        {/* Zone 1: Single Brand Text Element */}
        <a
          href="/"
          className="text-base font-bold tracking-tight text-neutral-100 flex items-center gap-2 hover:text-emerald-400 transition-colors"
        >
          <Radio className="w-5 h-5 text-emerald-400" />
          <span>PulseCast</span>
        </a>

        {/* Zone 2: 4-6 Text Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-neutral-400">
          <button
            onClick={() => setActiveTab('receiver')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'receiver' ? 'text-emerald-400 font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            PC Workstation
          </button>

          <button
            onClick={() => setActiveTab('transmitter')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'transmitter' ? 'text-emerald-400 font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            Mobile Unit
          </button>

          <button
            onClick={() => setActiveTab('workbench')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'workbench' ? 'text-emerald-400 font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            Split Workbench
          </button>

          <button
            onClick={() => setActiveTab('drivers')}
            className={`transition-colors whitespace-nowrap ${
              activeTab === 'drivers' ? 'text-emerald-400 font-semibold' : 'hover:text-neutral-200'
            }`}
          >
            Virtual Drivers
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-neutral-400 bg-neutral-900 px-2.5 py-1 rounded border border-neutral-800">
            <span
              className={`h-2 w-2 rounded-full ${
                isConnected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-rose-500'
              }`}
            />
            <span className="tabular-nums">PIN: {sessionCode}</span>
          </div>

          <button
            onClick={() => setIsPairingModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors whitespace-nowrap shadow-sm"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Pair Phone</span>
          </button>
        </div>
      </header>

      {/* Error alert toast */}
      {errorMessage && (
        <div className="bg-rose-950/80 border-b border-rose-800/80 px-6 py-2.5 flex items-center justify-between text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Mobile Tab Segmented Switcher for small screens */}
        <div className="md:hidden mb-4 p-1 bg-neutral-900 rounded-lg border border-neutral-800 grid grid-cols-4 gap-1 text-center text-xs">
          <button
            onClick={() => setActiveTab('receiver')}
            className={`py-1.5 rounded font-medium truncate ${
              activeTab === 'receiver' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400'
            }`}
          >
            PC
          </button>
          <button
            onClick={() => setActiveTab('transmitter')}
            className={`py-1.5 rounded font-medium truncate ${
              activeTab === 'transmitter' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400'
            }`}
          >
            Mobile
          </button>
          <button
            onClick={() => setActiveTab('workbench')}
            className={`py-1.5 rounded font-medium truncate ${
              activeTab === 'workbench' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400'
            }`}
          >
            Split
          </button>
          <button
            onClick={() => setActiveTab('drivers')}
            className={`py-1.5 rounded font-medium truncate ${
              activeTab === 'drivers' ? 'bg-neutral-800 text-emerald-400' : 'text-neutral-400'
            }`}
          >
            Drivers
          </button>
        </div>

        {/* View Routing */}
        {activeTab === 'receiver' && (
          <PcReceiverView
            analyser={analyser}
            telemetry={telemetry}
            bufferConfig={bufferConfig}
            onChangeBufferConfig={handleChangeBufferConfig}
            activeCodec={activeCodec}
            onChangeCodec={handleChangeCodec}
            frameSizeMs={frameSizeMs}
            onChangeFrameSize={setFrameSizeMs}
            outputVolume={outputVolume}
            onChangeOutputVolume={handleChangeOutputVolume}
            pan={pan}
            onChangePan={handleChangePan}
            isMuted={isOutputMuted}
            onToggleMute={handleToggleOutputMute}
            isLoopbackMonitor={isLoopbackMonitor}
            onToggleLoopback={handleToggleLoopback}
            sessionCode={sessionCode}
            onOpenPairing={() => setIsPairingModalOpen(true)}
            peerCounts={peerCounts}
            onResetStats={() => {
              if (streamerRef.current) {
                // reset
              }
            }}
          />
        )}

        {activeTab === 'transmitter' && (
          <MobileTransmitterView
            isStreaming={isTransmitting}
            onToggleStreaming={handleToggleStreaming}
            activeSource={activeSource}
            onChangeSource={handleChangeSource}
            telemetry={telemetry}
            activeCodec={activeCodec}
            onChangeCodec={handleChangeCodec}
            sessionCode={sessionCode}
            onOpenPairing={() => setIsPairingModalOpen(true)}
            inputGain={inputGain}
            onChangeInputGain={handleChangeInputGain}
            isMuted={isInputMuted}
            onToggleMute={handleToggleInputMute}
            isConnected={isConnected}
          />
        )}

        {/* Split Workbench View: Allows testing transmitter and receiver simultaneously on one PC! */}
        {activeTab === 'workbench' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Split className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-semibold text-neutral-200">
                    Dual-Node Studio Simulation Workbench
                  </h2>
                </div>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Test microphone capture or test signals on the left, and observe the live receiver jitter buffer & visualizer on the right.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleStreaming}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all shadow-sm ${
                    isTransmitting
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {isTransmitting ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Test Broadcast</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Start Test Broadcast</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Transmitter Unit */}
              <div className="lg:col-span-5">
                <MobileTransmitterView
                  isStreaming={isTransmitting}
                  onToggleStreaming={handleToggleStreaming}
                  activeSource={activeSource}
                  onChangeSource={handleChangeSource}
                  telemetry={telemetry}
                  activeCodec={activeCodec}
                  onChangeCodec={handleChangeCodec}
                  sessionCode={sessionCode}
                  onOpenPairing={() => setIsPairingModalOpen(true)}
                  inputGain={inputGain}
                  onChangeInputGain={handleChangeInputGain}
                  isMuted={isInputMuted}
                  onToggleMute={handleToggleInputMute}
                  isConnected={isConnected}
                />
              </div>

              {/* Right Column: PC Receiver Unit */}
              <div className="lg:col-span-7">
                <PcReceiverView
                  analyser={analyser}
                  telemetry={telemetry}
                  bufferConfig={bufferConfig}
                  onChangeBufferConfig={handleChangeBufferConfig}
                  activeCodec={activeCodec}
                  onChangeCodec={handleChangeCodec}
                  frameSizeMs={frameSizeMs}
                  onChangeFrameSize={setFrameSizeMs}
                  outputVolume={outputVolume}
                  onChangeOutputVolume={handleChangeOutputVolume}
                  pan={pan}
                  onChangePan={handleChangePan}
                  isMuted={isOutputMuted}
                  onToggleMute={handleToggleOutputMute}
                  isLoopbackMonitor={isLoopbackMonitor}
                  onToggleLoopback={handleToggleLoopback}
                  sessionCode={sessionCode}
                  onOpenPairing={() => setIsPairingModalOpen(true)}
                  peerCounts={peerCounts}
                  onResetStats={() => {}}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'drivers' && <DriverFrameworkHub />}
      </main>

      {/* Device Pairing Modal with QR Code and LAN Discovery */}
      <DevicePairingModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
        sessionCode={sessionCode}
        onChangeSessionCode={setSessionCode}
        currentRole={activeTab === 'transmitter' ? 'transmitter' : 'receiver'}
        telemetry={telemetry}
        isConnected={isConnected}
        peerCounts={peerCounts}
      />

      {/* Footer conforming to anti-slop guidelines: quiet, clean */}
      <footer className="border-t border-neutral-900 bg-neutral-950 px-6 py-4 text-xs text-neutral-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span>PulseCast Audio Streamer</span>
          <span>·</span>
          <span>Open-Source Driver Framework</span>
          <span>·</span>
          <span>Low-Latency Wi-Fi Pipeline</span>
        </div>
        <div className="font-mono text-[11px] tabular-nums text-neutral-400">
          48000 Hz · WASAPI / PipeWire Compliant
        </div>
      </footer>
    </div>
  );
}
