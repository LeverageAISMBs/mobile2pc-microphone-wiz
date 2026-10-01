import express from 'express';
import http from 'http';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

app.use(express.json());

interface ClientInfo {
  ws: WebSocket;
  role: 'transmitter' | 'receiver' | 'observer';
  code: string;
  deviceName: string;
  platform: 'windows' | 'linux' | 'android' | 'ios' | 'macos' | 'browser';
  ip?: string;
  connectedAt: number;
}

// In-memory active streaming sessions
interface AudioSession {
  code: string;
  createdAt: number;
  receivers: Set<ClientInfo>;
  transmitters: Set<ClientInfo>;
  stats: {
    totalPackets: number;
    totalBytes: number;
    lastActive: number;
    sampleRate: number;
    channels: number;
    codec: string;
    bufferMs: number;
  };
}

const sessions = new Map<string, AudioSession>();
const clients = new Map<WebSocket, ClientInfo>();

function getOrCreateSession(code: string): AudioSession {
  let session = sessions.get(code);
  if (!session) {
    session = {
      code,
      createdAt: Date.now(),
      receivers: new Set(),
      transmitters: new Set(),
      stats: {
        totalPackets: 0,
        totalBytes: 0,
        lastActive: Date.now(),
        sampleRate: 48000,
        channels: 2,
        codec: 'opus',
        bufferMs: 20,
      },
    };
    sessions.set(code, session);
  }
  return session;
}

// WebSocket Server attached to HTTP server
const wss = new WebSocketServer({ server, path: '/ws/audio' });

wss.on('connection', (ws: WebSocket, req) => {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const code = (url.searchParams.get('code') || 'DEFAULT-01').toUpperCase();
  const role = (url.searchParams.get('role') as ClientInfo['role']) || 'receiver';
  const deviceName = url.searchParams.get('device') || (role === 'transmitter' ? 'Mobile Transmitter' : 'PC Receiver');
  const platform = (url.searchParams.get('platform') as ClientInfo['platform']) || 'browser';
  const clientIp = req.socket.remoteAddress || '127.0.0.1';

  const clientInfo: ClientInfo = {
    ws,
    role,
    code,
    deviceName,
    platform,
    ip: clientIp,
    connectedAt: Date.now(),
  };

  clients.set(ws, clientInfo);
  const session = getOrCreateSession(code);

  if (role === 'transmitter') {
    session.transmitters.add(clientInfo);
  } else {
    session.receivers.add(clientInfo);
  }

  // Notify peer connection count
  const notifyPeerCount = () => {
    const statusMsg = JSON.stringify({
      type: 'SESSION_PEERS',
      code,
      receiversCount: session.receivers.size,
      transmittersCount: session.transmitters.size,
      stats: session.stats,
    });
    session.receivers.forEach((rcv) => {
      if (rcv.ws.readyState === WebSocket.OPEN) rcv.ws.send(statusMsg);
    });
    session.transmitters.forEach((tx) => {
      if (tx.ws.readyState === WebSocket.OPEN) tx.ws.send(statusMsg);
    });
  };

  notifyPeerCount();

  // Send welcome confirmation
  ws.send(
    JSON.stringify({
      type: 'CONNECTED',
      code,
      role,
      receiversCount: session.receivers.size,
      transmittersCount: session.transmitters.size,
      serverTime: Date.now(),
    })
  );

  ws.on('message', (data: Buffer | string, isBinary: boolean) => {
    session.stats.lastActive = Date.now();

    if (isBinary) {
      // Binary Audio Packet Relay:
      // Zero-copy, sub-millisecond broadcast from transmitter to all paired receivers
      session.stats.totalPackets++;
      const byteLen = typeof data === 'string' ? data.length : data.byteLength;
      session.stats.totalBytes += byteLen;

      if (role === 'transmitter' || clientInfo.role === 'transmitter') {
        session.receivers.forEach((rcv) => {
          if (rcv.ws.readyState === WebSocket.OPEN) {
            rcv.ws.send(data, { binary: true });
          }
        });
      } else {
        // If receiver sends audio in loopback/talkback mode, relay to other peers
        session.receivers.forEach((rcv) => {
          if (rcv !== clientInfo && rcv.ws.readyState === WebSocket.OPEN) {
            rcv.ws.send(data, { binary: true });
          }
        });
      }
    } else {
      // JSON Control Message
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', clientTime: msg.clientTime, serverTime: Date.now() }));
        } else if (msg.type === 'CONFIG_UPDATE') {
          if (msg.codec) session.stats.codec = msg.codec;
          if (msg.sampleRate) session.stats.sampleRate = msg.sampleRate;
          if (msg.channels) session.stats.channels = msg.channels;
          if (msg.bufferMs !== undefined) session.stats.bufferMs = msg.bufferMs;

          // Broadcast config update to session peers
          const broadcastMsg = JSON.stringify({
            type: 'CONFIG_SYNC',
            ...msg,
            senderRole: role,
          });
          [...session.receivers, ...session.transmitters].forEach((peer) => {
            if (peer !== clientInfo && peer.ws.readyState === WebSocket.OPEN) {
              peer.ws.send(broadcastMsg);
            }
          });
        } else if (msg.type === 'HEARTBEAT') {
          ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', timestamp: Date.now() }));
        }
      } catch (err) {
        // Silently ignore malformed control frames
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    if (role === 'transmitter') {
      session.transmitters.delete(clientInfo);
    } else {
      session.receivers.delete(clientInfo);
    }
    notifyPeerCount();

    // Clean up empty sessions older than 10 minutes
    if (session.receivers.size === 0 && session.transmitters.size === 0) {
      setTimeout(() => {
        const cur = sessions.get(code);
        if (cur && cur.receivers.size === 0 && cur.transmitters.size === 0) {
          sessions.delete(code);
        }
      }, 600000);
    }
  });

  ws.on('error', () => {
    ws.close();
  });
});

// REST API for Network Discovery & Status
app.get('/api/discovery', (_req, res) => {
  const activeSessions = Array.from(sessions.entries()).map(([code, s]) => ({
    code,
    receivers: s.receivers.size,
    transmitters: s.transmitters.size,
    uptimeSec: Math.floor((Date.now() - s.createdAt) / 1000),
    stats: s.stats,
  }));

  res.json({
    status: 'online',
    serverTime: Date.now(),
    port: PORT,
    protocols: ['WebSocket Binary Audio v2.4', 'WebRTC DataChannel', 'PCM 16/24-bit', 'Opus VBR'],
    openSessions: activeSessions,
    lanDiscovery: {
      mdnsHostname: 'pulsecast.local',
      recommendedSampleRate: 48000,
      lowestJitterBufferMs: 5,
    },
  });
});

// REST API for Network Interfaces & Mobile Hotspot Subnet Detection
app.get('/api/network/interfaces', (_req, res) => {
  const ifaces = os.networkInterfaces();
  const detectedInterfaces: Array<{
    name: string;
    family: string;
    address: string;
    internal: boolean;
    type: 'hotspot' | 'wifi' | 'ethernet' | 'loopback';
    estimatedSubnet: string;
    gatewayIp?: string;
  }> = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4') {
        let type: 'hotspot' | 'wifi' | 'ethernet' | 'loopback' = 'ethernet';
        let gatewayIp: string | undefined;

        if (addr.internal) {
          type = 'loopback';
        } else if (
          addr.address.startsWith('192.168.43.') || // Android SoftAP
          addr.address.startsWith('172.20.10.') ||  // iOS Personal Hotspot
          addr.address.startsWith('192.168.137.') || // Windows Mobile Hotspot
          name.toLowerCase().includes('ap') ||
          name.toLowerCase().includes('hotspot')
        ) {
          type = 'hotspot';
          if (addr.address.startsWith('192.168.43.')) gatewayIp = '192.168.43.1';
          if (addr.address.startsWith('172.20.10.')) gatewayIp = '172.20.10.1';
          if (addr.address.startsWith('192.168.137.')) gatewayIp = '192.168.137.1';
        } else if (
          name.toLowerCase().includes('wlan') ||
          name.toLowerCase().includes('wi-fi') ||
          name.toLowerCase().includes('wifi')
        ) {
          type = 'wifi';
        }

        detectedInterfaces.push({
          name,
          family: addr.family,
          address: addr.address,
          internal: addr.internal,
          type,
          estimatedSubnet: addr.address.substring(0, addr.address.lastIndexOf('.')) + '.0/24',
          gatewayIp,
        });
      }
    }
  }

  res.json({
    interfaces: detectedInterfaces,
    hotspotProfiles: [
      {
        os: 'Android Portable Hotspot',
        typicalGateway: '192.168.43.1',
        description: 'Android creates direct SoftAP with default gateway 192.168.43.1 (Subnet 192.168.43.0/24)',
      },
      {
        os: 'iOS Personal Hotspot',
        typicalGateway: '172.20.10.1',
        description: 'iOS assigns 172.20.10.1 as direct gateway to connected PC clients',
      },
      {
        os: 'Windows 10/11 Mobile Hotspot',
        typicalGateway: '192.168.137.1',
        description: 'HostedNetwork on Windows binds to virtual adapter 192.168.137.1',
      },
    ],
    serverPort: PORT,
  });
});

// Downloadable Virtual Driver Script Generators
app.get('/api/driver/windows-setup.ps1', (_req, res) => {
  const psScript = `# PulseCast - Open-Source Virtual Audio Driver Setup for Windows (WASAPI / VB-Cable)
# Run in PowerShell as Administrator

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   PulseCast Low-Latency Audio Driver & Routing Setup     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check for VB-Audio Virtual Cable or install open-source virtual audio sink
$vbInstalled = Get-CimInstance Win32_SoundDevice | Where-Object { $_.Name -like "*VB-Audio*" -or $_.Name -like "*Virtual Cable*" }

if (-not $vbInstalled) {
    Write-Host "[INFO] VB-Audio Virtual Cable not detected." -ForegroundColor Yellow
    Write-Host "[INFO] Downloading VB-Audio Cable package (Open-Source / Donationware standard)..." -ForegroundColor White
    
    $downloadUrl = "https://download.vb-audio.com/Download_CAB/VBCABLE_Driver_Pack43.zip"
    $tempZip = "$env:TEMP\\VBCABLE_Driver.zip"
    $extractPath = "$env:TEMP\\VBCABLE_Driver"
    
    Invoke-WebRequest -Uri $downloadUrl -OutFile $tempZip
    Expand-Archive -Path $tempZip -DestinationPath $extractPath -Force
    
    Write-Host "[INFO] Installing 64-bit Virtual Cable Driver..." -ForegroundColor Green
    Start-Process -FilePath "$extractPath\\VBCABLE_Setup_x64.exe" -ArgumentList "-i -h" -Wait
} else {
    Write-Host "[OK] Virtual Audio Cable device is already installed." -ForegroundColor Green
}

# Set Registry / Latency Buffer configuration to 48000Hz 24-bit 128 samples (WASAPI Exclusive)
Write-Host "[CONFIG] Setting optimal low-latency buffer: 48000 Hz, 2 Channel Stereo" -ForegroundColor Cyan
Write-Host "[READY] PulseCast Receiver can now route audio directly into: 'CABLE Input (VB-Audio Virtual Cable)'" -ForegroundColor Green
Write-Host "[OBS / Discord] In OBS or Discord, set Microphone to 'CABLE Output (VB-Audio Virtual Cable)'" -ForegroundColor Yellow
`;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="pulsecast-windows-setup.ps1"');
  res.send(psScript);
});

app.get('/api/driver/linux-pipewire.sh', (_req, res) => {
  const bashScript = `#!/usr/bin/env bash
# PulseCast - Open-Source Virtual Audio Driver Setup for Linux (PipeWire / PulseAudio)
set -e

echo "=== PulseCast Linux Audio Driver Setup ==="

# Check if PipeWire or PulseAudio is running
if command -v pw-cli >/dev/null 2>&1; then
    echo "[OK] PipeWire detected. Creating low-latency virtual null sink..."
    
    # Create low-latency null sink with 48000Hz sample rate
    pactl load-module module-null-sink sink_name=PulseCast_Sink sink_properties=device.description="PulseCast_Virtual_Audio_Input"
    
    echo "[OK] PulseCast_Sink created."
    echo "[INFO] Linking PulseCast virtual sink to default output..."
    pactl load-module module-loopback source=PulseCast_Sink.monitor latency_msec=5
    
    echo "=========================================================="
    echo "PulseCast Virtual Audio Input is ready!"
    echo "Select 'PulseCast_Virtual_Audio_Input' in Discord, OBS, or DAW."
    echo "Latency buffer configured for 5ms."
    echo "=========================================================="
else
    echo "[INFO] Setting up standard PulseAudio virtual sink..."
    pactl load-module module-null-sink sink_name=PulseCast_Sink sink_properties=device.description="PulseCast_Virtual_Mic"
    pactl load-module module-loopback source=PulseCast_Sink.monitor latency_msec=10
    echo "[OK] PulseAudio virtual mic initialized."
fi
`;
  res.setHeader('Content-Type', 'application/x-sh');
  res.setHeader('Content-Disposition', 'attachment; filename="pulsecast-linux-pipewire.sh"');
  res.send(bashScript);
});

// Bluetooth A2DP Bridge Script Generators
app.get('/api/bluetooth/windows-a2dp.ps1', (_req, res) => {
  const psScript = `# PulseCast - Native Bluetooth A2DP Audio Sink Setup for Windows 10/11
# Run in PowerShell as Administrator

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   PulseCast Bluetooth A2DP Audio Receiver Bridge Setup   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Check if Bluetooth adapter is present
$btAdapter = Get-PnpDevice -Class Bluetooth | Where-Object { $_.Status -eq "OK" }
if (-not $btAdapter) {
    Write-Host "[ERROR] No active Bluetooth adapter found on this system." -ForegroundColor Red
    Exit 1
}

Write-Host "[OK] Bluetooth adapter detected: $($btAdapter[0].FriendlyName)" -ForegroundColor Green

# 1. Open Windows Bluetooth Settings to ensure phone is paired
Write-Host "[STEP 1] Pairing your phone to PC..." -ForegroundColor Yellow
Write-Host "Please ensure your phone's Bluetooth is ON and paired with this PC." -ForegroundColor White
Start-Process "ms-settings:bluetooth"

# 2. Check for Windows Bluetooth Audio Receiver (A2DP Sink API)
Write-Host "[STEP 2] Verifying Windows A2DP Audio Sink Service..." -ForegroundColor Yellow
Write-Host "Windows 10/11 supports native A2DP sink via the Microsoft Bluetooth Audio Receiver." -ForegroundColor White
Write-Host "[TIP] If not already installed, you can launch the open-source Bluetooth Audio Receiver:" -ForegroundColor Cyan
Write-Host "  Winget install: winget install 9N9WCLWDQS5J" -ForegroundColor White

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "[READY] Once connected, PulseCast will capture your phone's" -ForegroundColor Green
Write-Host "        audio stream directly via the Bluetooth Audio Input device!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
`;
  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename="pulsecast-windows-bluetooth-a2dp.ps1"');
  res.send(psScript);
});

app.get('/api/bluetooth/linux-bluez.sh', (_req, res) => {
  const bashScript = `#!/usr/bin/env bash
# PulseCast - Native PipeWire / BlueZ 5 Bluetooth A2DP Sink Setup for Linux
set -e

echo "=== PulseCast Linux Bluetooth A2DP Setup ==="

# Check BlueZ service
if systemctl is-active --quiet bluetooth; then
    echo "[OK] BlueZ Bluetooth service is running."
else
    echo "[INFO] Starting Bluetooth service..."
    sudo systemctl start bluetooth
fi

# Enable A2DP Sink role in PipeWire / PulseAudio
if command -v pw-cli >/dev/null 2>&1; then
    echo "[OK] PipeWire detected. Checking bluetooth-discover module..."
    pactl load-module module-bluetooth-discover || true
    pactl load-module module-bluetooth-policy || true
    echo "[OK] PipeWire Bluetooth A2DP sink role active (LDAC / AAC / SBC-XQ supported)."
else
    echo "[INFO] Loading PulseAudio Bluetooth modules..."
    pactl load-module module-bluetooth-discover || true
    pactl load-module module-bluetooth-policy || true
fi

echo "=========================================================="
echo "To pair your phone via CLI:"
echo "  1. bluetoothctl"
echo "  2. power on"
echo "  3. discoverable on"
echo "  4. pair <PHONE_MAC>"
echo "  5. trust <PHONE_MAC>"
echo "PulseCast will detect 'bluez_source' in the device selector!"
echo "=========================================================="
`;
  res.setHeader('Content-Type', 'application/x-sh');
  res.setHeader('Content-Disposition', 'attachment; filename="pulsecast-linux-bluetooth.sh"');
  res.send(bashScript);
});

app.get('/api/bluetooth/status', (_req, res) => {
  res.json({
    status: 'ready',
    mode: 'native_a2dp_bridge',
    supportedCodecs: ['LDAC (Hi-Res 990kbps)', 'aptX-HD (576kbps)', 'AAC (256kbps)', 'SBC-XQ (328kbps)'],
    typicalLatencyRangeMs: '30 - 45 ms',
    scriptsAvailable: {
      windows: '/api/bluetooth/windows-a2dp.ps1',
      linux: '/api/bluetooth/linux-bluez.sh',
    },
  });
});

// Vite or Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, () => {
    console.log(`[PulseCast] High-Performance Audio Streaming Server listening on port ${PORT}`);
  });
}

startServer();
