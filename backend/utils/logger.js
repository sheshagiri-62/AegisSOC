const fs = require('fs');
const path = require('path');

const logFileByType = {
  auth: 'auth.log',
  network: 'network.log',
  app: 'app.log'
};

// --- Utilities ---
function getSyslogTimestamp(date = new Date()) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = String(date.getDate()).padStart(2, ' ');
  const time = date.toTimeString().split(' ')[0];
  return `${month} ${day} ${time}`;
}

function randomIp() {
  return `${Math.floor(Math.random() * 223) + 1}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
}

function appendLog(type, lineString) {
  const fileName = logFileByType[type];
  const logPath = path.join(__dirname, '..', 'logs', fileName);
  fs.appendFileSync(logPath, `${lineString}\n`, 'utf-8');
}

// --- Formatters ---
function writeSyslogAuth(event, user, ipStr, port = null) {
  const ts = getSyslogTimestamp();
  const host = 'hft-server';
  const pid = Math.floor(Math.random() * 10000) + 1000;
  const p = port || Math.floor(Math.random() * 40000) + 10000;
  
  let msg;
  if (event === 'login_failed' || event === 'login_fail') {
    msg = `Failed password for ${user} from ${ipStr} port ${p} ssh2`;
  } else if (event === 'login_success') {
    msg = `Accepted password for ${user} from ${ipStr} port ${p} ssh2`;
  } else {
    msg = `Unknown auth event for ${user} from ${ipStr}`;
  }

  const logLine = `${ts} ${host} sshd[${pid}]: ${msg}`;
  appendLog('auth', logLine);
}

function writeNginxAccess(ipStr, route = '/api/public/market-data', status = 200, bytes = 456) {
  const ts = getSyslogTimestamp();
  const host = 'hft-server';
  const pid = Math.floor(Math.random() * 10000) + 1000;

  // Wrapped in a syslog header to behave natively as syslog
  // Changed nginx to hft-network to bypass native Wazuh conflicts
  const msg = `GET ${route} HTTP/1.1 from ${ipStr}`;
  const logLine = `${ts} ${host} hft-network[${pid}]: ${msg}`;
  
  appendLog('network', logLine);
}

function writeCefAppEvent(eventName, user, detailsStr) {
  const ts = getSyslogTimestamp();
  const host = 'hft-server';
  const pid = Math.floor(Math.random() * 10000) + 1000;
  
  // Wrapped in a syslog header
  const msg = `CEF:0|SOCLab|HFT-Platform|1.0|100|${eventName}|5|suser=${user} msg=${detailsStr}`;
  const logLine = `${ts} ${host} hft-app[${pid}]: ${msg}`;
  
  appendLog('app', logLine);
}

module.exports = { 
  writeSyslogAuth, 
  writeNginxAccess, 
  writeCefAppEvent,
  randomIp
};
