const express = require('express');
const fs = require('fs');
const path = require('path');
const { writeSyslogAuth } = require('../utils/logger');

const router = express.Router();
const usersPath = path.join(__dirname, '..', 'data', 'users.json');

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

function readUsers() {
  const content = fs.readFileSync(usersPath, 'utf-8');
  return JSON.parse(content || '[]');
}

function saveUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf-8');
}

router.post('/register', (req, res) => {
  const { username, password, role = 'trader' } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  if (role !== 'admin' && role !== 'trader') {
    return res.status(400).json({ message: 'role must be admin or trader' });
  }

  const users = readUsers();
  const exists = users.find((u) => u.username === username);

  if (exists) {
    writeSyslogAuth('register_failed', username, getClientIp(req));
    return res.status(409).json({ message: 'user already exists' });
  }

  const user = { username, password, role };
  users.push(user);
  saveUsers(users);

  writeSyslogAuth('register_success', username, getClientIp(req));

  return res.status(201).json({ message: 'registered successfully', role });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'username and password are required' });
  }

  const users = readUsers();
  const user = users.find((u) => u.username === username && u.password === password);

  if (!user) {
    writeSyslogAuth('login_failed', username, getClientIp(req));
    return res.status(401).json({ message: 'invalid credentials' });
  }

  writeSyslogAuth('login_success', username, getClientIp(req));

  return res.json({ message: 'login successful', username: user.username, role: user.role });
});

module.exports = router;
