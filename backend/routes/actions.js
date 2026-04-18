const express = require('express');
const fs = require('fs');
const path = require('path');
const { writeSyslogAuth, writeNginxAccess, writeCefAppEvent, randomIp } = require('../utils/logger');

const router = express.Router();

// ── Persistent Blocklist file ──
const BLOCKLIST_FILE = path.join(__dirname, '..', 'logs', 'blocked_ips.txt');

function loadBlocklist() {
  try {
    if (!fs.existsSync(BLOCKLIST_FILE)) return new Set();
    const lines = fs.readFileSync(BLOCKLIST_FILE, 'utf-8').split('\n');
    const ips = lines
      .map(l => l.trim().split('|')[0].trim())
      .filter(ip => ip && !ip.startsWith('#'));
    console.log(`[BLOCKLIST] Loaded ${ips.length} persisted blocked IPs from disk`);
    return new Set(ips);
  } catch { return new Set(); }
}

function saveToBlocklist(ip, reason, desc = '') {
  const ts = new Date().toISOString();
  const line = `${ip} | ${ts} | ${reason} | ${desc}\n`;
  fs.appendFileSync(BLOCKLIST_FILE, line, 'utf-8');
}

function clearBlocklist() {
  fs.writeFileSync(BLOCKLIST_FILE, `# Blocklist cleared at ${new Date().toISOString()}\n`, 'utf-8');
}

// ── Blocked IPs — loaded from disk on startup ──
const blockedIps = loadBlocklist();

// ── MISP Configuration ──
const MISP_URL = process.env.MISP_URL || 'http://192.168.56.105:8081';
const MISP_KEY = process.env.MISP_KEY || '';

// ── MISP Seed — the 3 IPs from our MISP Event #1 (used if MISP sync fails) ──
const MISP_SEED = {
  '45.33.32.156':   { tag: 'Shodan-Scanner', category: 'recon',    severity: 'HIGH',     desc: 'Shodan scanner probing HFT APIs', source: 'MISP', mispEventId: 1 },
  '185.220.101.34': { tag: 'Tor-Exit-Node',  category: 'anonymizer', severity: 'HIGH',   desc: 'Tor exit node — financial data exfil', source: 'MISP', mispEventId: 1 },
  '203.0.113.99':   { tag: 'C2-Server',      category: 'malware',  severity: 'CRITICAL', desc: 'C2 server for HFT trading malware', source: 'MISP', mispEventId: 1 },
};

// ── Live threat intel — MISP ONLY (no static fallback) ──
let THREAT_INTEL = { ...MISP_SEED };
let lastMispSync = null;
let mispIpCount = Object.keys(MISP_SEED).length;

// ── MISP Sync ──
async function syncFromMisp() {
  if (!MISP_KEY) {
    console.log('[MISP] No MISP_KEY — using MISP seed IPs only. Set MISP_KEY env var for live sync.');
    return;
  }
  try {
    console.log(`[MISP] Syncing from ${MISP_URL}...`);
    const resp = await fetch(`${MISP_URL}/attributes/restSearch`, {
      method: 'POST',
      headers: {
        'Authorization': MISP_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ returnFormat: 'json', type: ['ip-src', 'ip-dst'], to_ids: 1 }),
      signal: AbortSignal.timeout(8000),
    });

    if (!resp.ok) throw new Error(`MISP returned ${resp.status}`);
    const data = await resp.json();
    const attributes = data?.response?.Attribute || [];

    const mispEntries = {};
    for (const attr of attributes) {
      const ip = attr.value?.trim();
      if (!ip || ip.includes('/')) continue;

      // Map MISP category/tag to severity
      const tagName = attr.Tag?.[0]?.name || '';
      let severity = 'HIGH';
      if (tagName.includes('ransomware') || tagName.includes('apt') || tagName.includes('c2') || tagName.includes('malware')) severity = 'CRITICAL';
      else if (tagName.includes('scanner') || tagName.includes('recon')) severity = 'MEDIUM';

      mispEntries[ip] = {
        tag: tagName || attr.category || 'MISP-IOC',
        category: attr.category || 'network',
        severity,
        desc: attr.comment || `MISP Event #${attr.event_id} — ${attr.type}`,
        source: 'MISP',
        mispEventId: attr.event_id,
      };
    }

    mispIpCount = Object.keys(mispEntries).length;

    if (mispIpCount === 0) {
      console.log('[MISP] No IPs returned — keeping seed intel');
      return;
    }

    // MISP ONLY — no static fallback
    THREAT_INTEL = mispEntries;
    lastMispSync = new Date().toISOString();
    console.log(`[MISP] ✓ Synced ${mispIpCount} IPs from MISP (MISP-only mode)`);
  } catch (err) {
    console.log(`[MISP] Sync failed (${err.message}) — keeping last known intel (${Object.keys(THREAT_INTEL).length} IPs)`);
  }
}

syncFromMisp();
setInterval(syncFromMisp, 5 * 60 * 1000);

const ROUTES = [
  '/api/public/market-data',
  '/api/orders',
  '/api/portfolio',
  '/api/auth/login',
  '/api/admin/config',
  '/api/trade/execute',
];

// ── Simulation State ──
let simRunning = false;
let simInterval = null;
let simStats = { events: 0, threats: 0, blocked: 0, denied: 0, startTime: null };
let simRecentEvents = [];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function wazuhAlert(eventName, ip, meta, status) {
  // Write a CEF event to app.log — Wazuh agent picks this up immediately
  const detail = `status=${status} ip=${ip} tag=${meta?.tag || 'unknown'} severity=${meta?.severity || 'HIGH'} source=${meta?.source || 'MISP'} desc=${meta?.desc || ''}`;
  writeCefAppEvent(eventName, 'SOAR-BlockEngine', detail);
}

// ── Round-robin cycling through all MISP IPs so every IP gets seen ──
let mispCycleQueue = [];

function nextMispIp() {
  const allIps = Object.keys(THREAT_INTEL);
  if (allIps.length === 0) return null;
  // Refill queue when empty (shuffle for variety)
  if (mispCycleQueue.length === 0) {
    mispCycleQueue = [...allIps].sort(() => 0.5 - Math.random());
  }
  return mispCycleQueue.pop();
}

function simulationTick() {
  const mispIps = Object.keys(THREAT_INTEL);
  if (mispIps.length === 0) return;

  // 60% malicious (MISP), 40% normal
  const isMalicious = Math.random() < 0.60;
  const ip = isMalicious ? nextMispIp() : randomIp();
  const route = pickRandom(ROUTES);

  simStats.events++;


  if (blockedIps.has(ip)) {
    // Blocked IP tried again — log to Wazuh
    writeNginxAccess(ip, route, 403, 0);
    simStats.denied++;
    const meta = THREAT_INTEL[ip];
    console.log(`[SIM] ⛔ DENIED (already blocked): ${ip} [${meta?.tag || '?'}]`);
    // Wazuh alert for repeat attempt
    wazuhAlert('IP_Block_Repeated', ip, meta, 'DENIED_REPEAT');
    simRecentEvents.unshift({ type: 'denied', ip, route, tag: meta?.tag, ts: new Date().toISOString() });

  } else if (isMalicious) {
    const meta = THREAT_INTEL[ip];
    writeNginxAccess(ip, route, 200, Math.floor(Math.random() * 800) + 200);
    writeCefAppEvent('MISP_IOC_Detected', 'ThreatIntel',
      `MISP-ALERT: ip=${ip} tag=${meta.tag} severity=${meta.severity} eventId=${meta.mispEventId || 'N/A'} desc=${meta.desc}`);
    simStats.threats++;
    console.log(`[SIM] 🚨 MISP THREAT: ${ip} [${meta.tag}] severity=${meta.severity}`);

    if (meta.severity === 'HIGH' || meta.severity === 'CRITICAL') {
      blockedIps.add(ip);
      saveToBlocklist(ip, 'SOAR-AutoResponse', meta.desc);
      simStats.blocked++;
      console.log(`[SIM] 🔒 AUTO-BLOCKED: ${ip} [${meta.tag}]`);
      // Wazuh alert for new block
      wazuhAlert('IP_Blocked', ip, meta, 'NEW_BLOCK');
      simRecentEvents.unshift({ type: 'auto_blocked', ip, route, tag: meta.tag, severity: meta.severity, desc: meta.desc, ts: new Date().toISOString() });
    } else {
      simRecentEvents.unshift({ type: 'threat_detected', ip, route, tag: meta.tag, severity: meta.severity, ts: new Date().toISOString() });
    }
  } else {
    writeNginxAccess(ip, route, 200, Math.floor(Math.random() * 600) + 200);
    simRecentEvents.unshift({ type: 'normal', ip, route, ts: new Date().toISOString() });
  }

  if (simRecentEvents.length > 20) simRecentEvents = simRecentEvents.slice(0, 20);
}

// ── Live Simulation Endpoints ──

router.post('/simulation/start', (req, res) => {
  if (simRunning) return res.json({ message: 'Already running', running: true });
  simRunning = true;
  simStats = { events: 0, threats: 0, blocked: 0, denied: 0, startTime: new Date().toISOString() };
  simRecentEvents = [];
  simInterval = setInterval(simulationTick, 4500);
  console.log('[SIM] ▶ Live simulation started');
  res.json({ message: 'Simulation started', running: true });
});

router.post('/simulation/stop', (req, res) => {
  if (!simRunning) return res.json({ message: 'Not running', running: false });
  clearInterval(simInterval);
  simInterval = null;
  simRunning = false;
  console.log(`[SIM] ⏹ Stopped — ${simStats.events} events, ${simStats.threats} threats, ${simStats.blocked} blocked`);
  res.json({ message: 'Simulation stopped', running: false, stats: simStats });
});

router.get('/simulation/status', (req, res) => {
  res.json({
    running: simRunning,
    stats: simStats,
    recentEvents: simRecentEvents.slice(0, 10),
    blockedIps: Array.from(blockedIps),
    misp: {
      lastSync: lastMispSync,
      ipCount: mispIpCount,
      totalIntel: Object.keys(THREAT_INTEL).length,
      configured: !!MISP_KEY,
      mode: 'MISP-only',
    },
  });
});

// ── Auth Routes ──

router.post('/login-success', (req, res) => {
  const { user = 'unknown' } = req.body;
  writeSyslogAuth('login_success', user, '192.168.56.1');
  res.json({ message: 'login success event logged' });
});

router.post('/login-fail', (req, res) => {
  const { user = 'unknown' } = req.body;
  writeSyslogAuth('login_failed', user, '192.168.56.1');
  res.json({ message: 'login failed event logged' });
});

// ── Traffic Routes ──

router.post('/simulate-traffic', (req, res) => {
  const { count = 1 } = req.body;
  for (let i = 0; i < Number(count); i++) {
    writeNginxAccess(randomIp(), '/api/public/market-data', 200, 450);
  }
  res.json({ message: `generated ${count} traffic events` });
});

router.post('/simulate-dos', (req, res) => {
  const { count = 100 } = req.body;
  const attackIp = randomIp();
  for (let i = 0; i < Number(count); i++) {
    writeNginxAccess(attackIp, '/api/public/market-data', 200, Math.floor(Math.random() * 500) + 200);
  }
  res.json({ message: `generated ${count} DoS events from ${attackIp}` });
});

// ── MISP Threat Route (manual trigger) ──

router.post('/simulate-misp-threat', (req, res) => {
  const mispIps = Object.keys(THREAT_INTEL);
  if (mispIps.length === 0) return res.json({ message: 'No MISP IPs loaded yet', results: [] });

  const picked = [...mispIps].sort(() => 0.5 - Math.random()).slice(0, Math.min(3, mispIps.length));
  let allowed = 0, denied = 0;
  const results = [];

  for (const ip of picked) {
    const meta = THREAT_INTEL[ip];
    if (blockedIps.has(ip)) {
      writeNginxAccess(ip, '/api/public/market-data', 403, 0);
      wazuhAlert('IP_Block_Repeated', ip, meta, 'DENIED_REPEAT');
      denied++;
      results.push({ ip, status: 'BLOCKED', tag: meta.tag, severity: meta.severity });
    } else {
      writeNginxAccess(ip, '/api/public/market-data', 200, 450);
      writeCefAppEvent('MISP_IOC_Detected', 'ThreatIntel',
        `MISP-ALERT: ip=${ip} tag=${meta.tag} severity=${meta.severity} eventId=${meta.mispEventId || 'N/A'} desc=${meta.desc}`);
      allowed++;
      results.push({ ip, status: 'DETECTED', tag: meta.tag, severity: meta.severity, desc: meta.desc });
    }
  }

  res.json({ message: `MISP-only: ${allowed} detected, ${denied} blocked`, allowed, denied, results });
});

// ── Algo Modify Route ──

router.post('/modify-algo', (req, res) => {
  const { user = 'unknown', role = 'trader', time = 'trading_hours' } = req.body;
  const authorized = role === 'admin';
  writeCefAppEvent('Algorithm_Modified', user, `${authorized ? 'Authorized' : 'Unauthorized'} modification during ${time}`);
  res.json({ message: 'algorithm modification event logged', authorized });
});

// ── SOAR: IP Blocking Endpoints ──

router.post('/block-ip', (req, res) => {
  const body = req.body || {};
  const ip = body.ip;
  const reason = body.reason || 'SOAR automated response';
  if (!ip) return res.status(400).json({ message: 'Missing ip parameter' });

  const meta = THREAT_INTEL[ip] || { tag: 'External', severity: 'HIGH', desc: reason, source: 'SOAR' };

  if (blockedIps.has(ip)) {
    console.log(`[SOAR] ⚠ REPEAT ATTEMPT — already blocked: ${ip}`);
    // Wazuh alert for repeated attempt on already-blocked IP
    wazuhAlert('IP_Block_Repeated', ip, meta, 'ALREADY_BLOCKED');
    return res.json({
      message: `IP ${ip} is already blocked`,
      ip, status: 'already_blocked',
      totalBlocked: blockedIps.size,
      allBlocked: Array.from(blockedIps),
    });
  }

  blockedIps.add(ip);
  saveToBlocklist(ip, reason, meta.desc);
  console.log(`[SOAR] 🔒 BLOCKED: ${ip} [${meta.tag}] — ${reason}`);
  // Wazuh alert for new block
  wazuhAlert('IP_Blocked', ip, meta, 'NEW_BLOCK');

  res.json({
    message: `IP ${ip} has been blocked`,
    ip, status: 'newly_blocked', reason,
    tag: meta.tag, severity: meta.severity,
    totalBlocked: blockedIps.size,
    allBlocked: Array.from(blockedIps),
  });
});

router.post('/unblock-all', (req, res) => {
  const count = blockedIps.size;
  const ips = Array.from(blockedIps);
  blockedIps.clear();
  clearBlocklist();
  console.log(`[SOAR] 🔓 UNBLOCKED all ${count} IPs — blocklist cleared`);
  writeCefAppEvent('IP_Unblocked', 'SOC-Analyst', `Unblocked ${count} IPs: ${ips.join(', ')}`);
  res.json({ message: `Unblocked ${count} IPs`, unblocked: ips });
});

router.get('/blocked-ips', (req, res) => {
  res.json({ blocked: Array.from(blockedIps), count: blockedIps.size });
});

// ── MISP status endpoint ──
router.get('/misp-status', (req, res) => {
  res.json({
    lastSync: lastMispSync,
    ipCount: mispIpCount,
    configured: !!MISP_KEY,
    mode: 'MISP-only',
    ips: Object.entries(THREAT_INTEL).map(([ip, meta]) => ({ ip, ...meta })),
  });
});

module.exports = router;
