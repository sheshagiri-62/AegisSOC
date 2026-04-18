require('dotenv').config();
const express = require('express');

const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const authRoutes = require('./routes/auth');
const actionRoutes = require('./routes/actions');

const app = express();
const PORT = 5000;
const HOST = '0.0.0.0';

app.set('trust proxy', true);
app.use(cors());
app.use(express.json());

app.use('/', authRoutes);
app.use('/', actionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/actions', actionRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

function startNgrok() {
  const ngrokExe = path.join(__dirname, '..', 'ngrok.exe');
  const proc = spawn(ngrokExe, ['http', String(PORT)], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  proc.on('error', () => {
    console.log('[ngrok] ngrok.exe not found — skipping tunnel');
  });

  // Poll ngrok local API for the public URL
  let attempts = 0;
  const poll = setInterval(async () => {
    attempts++;
    try {
      const resp = await fetch('http://localhost:4040/api/tunnels');
      const data = await resp.json();
      const tunnel = data.tunnels?.find(t => t.proto === 'https');
      if (tunnel) {
        clearInterval(poll);
        console.log(`\n[ngrok] ✓ Public URL: ${tunnel.public_url}`);
        console.log(`[ngrok] Block-IP URL: ${tunnel.public_url}/api/actions/block-ip\n`);
      }
    } catch (_) {
      if (attempts > 15) {
        clearInterval(poll);
        console.log('[ngrok] Could not get tunnel URL — check ngrok is running');
      }
    }
  }, 1000);
}

app.listen(PORT, HOST, () => {
  console.log(`Backend running locally at http://localhost:${PORT}`);
  console.log(`Network-accessible at http://${HOST}:${PORT}`);
  startNgrok();
});
