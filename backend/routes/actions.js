const express = require('express');
const { writeSyslogAuth, writeNginxAccess, writeCefAppEvent, randomIp } = require('../utils/logger');

const router = express.Router();

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (ip === '::1') {
    return '127.0.0.1';
  }
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    return ip.slice(7);
  }
  return ip;
}

router.post('/login-success', (req, res) => {
  const { user = 'unknown' } = req.body;
  writeSyslogAuth('login_success', user, getClientIp(req));
  res.json({ message: 'login success event logged' });
});

router.post('/login-fail', (req, res) => {
  const { user = 'unknown' } = req.body;
  writeSyslogAuth('login_failed', user, getClientIp(req));
  res.json({ message: 'login failed event logged' });
});

router.post('/simulate-traffic', (req, res) => {
  const { count = 1 } = req.body;
  
  for (let i = 0; i < Number(count); i++) {
    writeNginxAccess(randomIp(), '/api/public/market-data', 200, 450);
  }

  res.json({ message: `generated ${count} traffic events` });
});

router.post('/simulate-dos', (req, res) => {
  const { count = 100 } = req.body;
  
  // A DoS attack usually comes from a single IP or a few IPs rapidly. Let's use a single spoofed IP for this burst.
  const attackIp = randomIp();
  
  for (let i = 0; i < Number(count); i++) {
    // We can simulate slightly different request sizes
    writeNginxAccess(attackIp, '/api/public/market-data', 200, Math.floor(Math.random() * 500) + 200);
  }

  res.json({ message: `generated ${count} DoS events from ${attackIp}` });
});

router.post('/simulate-misp-threat', (req, res) => {
  // These IPs are the same ones seeded into MISP
  const mispIps = ['45.33.32.156', '185.220.101.34', '203.0.113.99'];
  
  // Generate network logs only — IoC detection is network-level
  for (const ip of mispIps) {
    writeNginxAccess(ip, '/api/public/market-data', 200, 450);
  }

  res.json({ message: `Generated ${mispIps.length} network events from MISP-flagged IPs` });
});

router.post('/modify-algo', (req, res) => {
  const { user = 'unknown', role = 'trader', time = 'trading_hours' } = req.body;
  const authorized = role === 'admin';
  const details = authorized ? `Authorized modification during ${time}` : `Unauthorized modification during ${time}`;

  writeCefAppEvent('Algorithm_Modified', user, details);

  res.json({ message: 'algorithm modification event logged', authorized });
});

module.exports = router;
