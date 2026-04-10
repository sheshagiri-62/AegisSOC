import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

const API_HOST = import.meta.env.VITE_API_HOST || window.location.hostname || 'localhost';
const API_BASE = `http://${API_HOST}:5000/api`;

async function post(path, payload) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'request failed');
  return data;
}

const ts = (d) =>
  d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

/* ── Icons ── */
const I = {
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  ),
  key: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  ),
  wifi: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>
    </svg>
  ),
  code: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
  refresh: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>
    </svg>
  ),
};

/* ═══════════════════════════════════════════════════════════════
   AUTH PAGE
   ═══════════════════════════════════════════════════════════════ */
function AuthPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('trader');
  const [message, setMessage] = useState('');
  const [msgOk, setMsgOk] = useState(false);

  const submitRegister = async () => {
    try {
      const result = await post('/auth/register', { username, password, role });
      setMsgOk(true);
      setMessage(result.message || 'registered');
    } catch (e) {
      setMsgOk(false);
      setMessage(e.message);
    }
  };

  const submitLogin = async () => {
    try {
      const result = await post('/auth/login', { username, password });
      const user = { username: result.username, role: result.role };
      localStorage.setItem('soc-user', JSON.stringify(user));
      onLogin(user);
    } catch (e) {
      setMsgOk(false);
      setMessage(e.message);
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <section className="login-hero">
          <div className="brand">
            <div className="brand-logo">{I.shield}</div>
            <div>
              <span className="brand-text">HFT SOC LAB</span>
              <span className="brand-sub">Security Operations Centre</span>
            </div>
          </div>
          <h1>Simulate. <span>Detect.</span> Defend.</h1>
          <p>Generate realistic trading-platform activity and security events for Wazuh ingestion, parsing, and analyst drills.</p>
          <div className="feature-pills">
            {[['Auth Logs','#14b8a6'],['Network Logs','#3b82f6'],['App Logs','#22c55e'],['Role Events','#f59e0b']].map(([l,c])=>(
              <div className="pill" key={l}><span className="pill-dot" style={{background:c}}/>{l}</div>
            ))}
          </div>
        </section>
        <section className="login-form">
          <h2>Access</h2>
          <p className="sub">Register or log in to start generating events.</p>
          <div className="fields">
            <input className="input" placeholder="Username" value={username} onChange={e=>setUsername(e.target.value)} id="login-username"/>
            <input className="input" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} id="login-password"/>
            <select className="select" value={role} onChange={e=>setRole(e.target.value)} id="login-role">
              <option value="trader">Trader</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="btn-row">
            <button className="btn btn-secondary" onClick={submitRegister} id="btn-register">Register</button>
            <button className="btn btn-primary" onClick={submitLogin} id="btn-login">Login</button>
          </div>
          {message && <p className={`msg-bar ${msgOk?'ok':'error'}`}>{message}</p>}
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — sidebar + main, no scroll
   ═══════════════════════════════════════════════════════════════ */
function Dashboard({ user, onLogout }) {
  const [status, setStatus] = useState('Ready — awaiting operator input');
  const [statusOk, setStatusOk] = useState(true);
  const [dosCount, setDosCount] = useState(500);
  const [logs, setLogs] = useState([]);
  const [events, setEvents] = useState([]);
  const endRef = useRef(null);
  const userLabel = useMemo(() => `${user.username} (${user.role})`, [user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const log = useCallback((lv, txt) => {
    setLogs(p => [...p, { time: new Date(), lv, txt }]);
  }, []);

  const run = useCallback(async (label, type, fn) => {
    setStatus(`Running: ${label}…`);
    setStatusOk(true);
    log('info', `Launching ${label}…`);
    const t0 = Date.now();
    let ok = true;
    try {
      const r = await fn();
      log('ok', r?.message || 'Completed');
    } catch (e) {
      log('error', e.message);
      ok = false;
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(2);
    log('info', `Finished in ${secs}s`);
    setEvents(p => [{ id: Date.now(), time: new Date(), type, ok }, ...p]);
    setStatus(ok ? 'Action completed — events logged to Wazuh' : `Failed: ${label}`);
    setStatusOk(ok);
  }, [log]);

  return (
    <div className="dash">
      {/* ── HEADER ── */}
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-logo">{I.shield}</div>
          <div>
            <div className="dash-title">HFT SOC LAB</div>
            <div className="dash-subtitle">Security Operations</div>
          </div>
        </div>
        <div className="dash-header-center">
          <span className="pulse-dot" style={{ background: statusOk ? '#22c55e' : '#f43f5e' }}/>
          {status}
        </div>
        <div className="dash-header-right">
          <div className="user-chip">
            {user.username}
            <span className={`role-badge ${user.role}`}>{user.role}</span>
          </div>
          <button
            className="logout-btn"
            id="btn-logout"
            onClick={() => { localStorage.removeItem('soc-user'); onLogout(); }}
            title={`Logged in as ${userLabel}`}
          >
            {I.logout}
            Logout
          </button>
        </div>
      </header>

      {/* ── SIDEBAR: action panels ── */}
      <aside className="sidebar">
        {/* Auth Panel */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-icon" style={{background:'rgba(59,130,246,0.12)',color:'#3b82f6'}}>{I.key}</div>
            <div><div className="panel-title">Authentication</div><div className="panel-desc">Auth event generation</div></div>
          </div>
          <div className="panel-actions">
            <button className="action-btn" id="btn-login-success"
              onClick={()=>run('Login Success','Login Success',()=>post('/actions/login-success',{user:user.username,role:user.role}))}>
              <span className="action-icon" style={{background:'rgba(34,197,94,0.12)',color:'#22c55e'}}>{I.check}</span>
              Login Success
            </button>
            <button className="action-btn" id="btn-login-fail"
              onClick={()=>run('Login Fail','Login Fail',()=>post('/actions/login-fail',{user:user.username,role:user.role}))}>
              <span className="action-icon" style={{background:'rgba(244,63,94,0.12)',color:'#f43f5e'}}>{I.x}</span>
              Login Fail
            </button>
          </div>
        </div>

        {/* Trading Panel */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-icon" style={{background:'rgba(245,158,11,0.12)',color:'#f59e0b'}}>{I.activity}</div>
            <div><div className="panel-title">Trading</div><div className="panel-desc">Platform changes</div></div>
          </div>
          <div className="panel-actions">
            <button className="action-btn" id="btn-modify-algo"
              onClick={()=>run('Modify Algorithm','Algo Modify',()=>post('/actions/modify-algo',{user:user.username,role:user.role,time:'trading_hours'}))}>
              <span className="action-icon" style={{background:'rgba(245,158,11,0.12)',color:'#f59e0b'}}>{I.code}</span>
              Modify Algorithm
            </button>
          </div>
        </div>

        {/* MISP Threat Intel Panel */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-icon" style={{background:'rgba(167,139,250,0.12)',color:'#a78bfa'}}>{I.shield}</div>
            <div><div className="panel-title">Threat Intel</div><div className="panel-desc">MISP IoC simulation</div></div>
          </div>
          <div className="panel-actions">
            <button className="action-btn" id="btn-misp-threat"
              onClick={()=>run('MISP Threat Simulation','MISP Threat',()=>post('/actions/simulate-misp-threat',{user:user.username}))}>
              <span className="action-icon" style={{background:'rgba(167,139,250,0.12)',color:'#a78bfa'}}>{I.zap}</span>
              Trigger MISP IPs
            </button>
          </div>
        </div>

        {/* Attack Panel */}
        <div className="panel">
          <div className="panel-head">
            <div className="panel-icon" style={{background:'rgba(244,63,94,0.12)',color:'#f43f5e'}}>{I.zap}</div>
            <div><div className="panel-title">Attack Simulation</div><div className="panel-desc">Repeatable patterns</div></div>
          </div>
          <div className="panel-actions">
            <button className="action-btn" id="btn-brute-force"
              onClick={()=>run('SSH Brute Force','Brute Force',async()=>{
                for(let i=0;i<15;i++) await post('/actions/login-fail',{user:user.username,role:user.role});
                return {message:'15 brute-force login failures logged'};
              })}>
              <span className="action-icon" style={{background:'rgba(244,63,94,0.12)',color:'#f43f5e'}}>{I.key}</span>
              SSH Brute Force
            </button>
            <div className="dos-row">
              <input className="dos-input" type="number" value={dosCount} onChange={e=>setDosCount(e.target.value)} min="1" id="input-dos-count"/>
              <button className="action-btn" style={{flex:1}} id="btn-dos"
                onClick={()=>run('HTTP Flood','DoS Flood',()=>post('/actions/simulate-dos',{count:Number(dosCount)}))}>
                <span className="action-icon" style={{background:'rgba(20,184,166,0.12)',color:'#14b8a6'}}>{I.wifi}</span>
                HTTP Flood
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN: console + event log ── */}
      <main className="main">
        {/* Console */}
        <div className="console">
          <div className="console-bar">
            <div className="console-bar-left">
              <div className="traffic-lights"><span className="tl tl-r"/><span className="tl tl-y"/><span className="tl tl-g"/></div>
              <div className="console-label">
                ▸ Event Console
                <span className="console-badge" style={{
                  background: logs.length ? 'rgba(34,197,94,0.12)' : 'rgba(100,116,139,0.12)',
                  color: logs.length ? '#22c55e' : '#64748b',
                }}>{logs.length ? 'LIVE' : 'IDLE'}</span>
              </div>
            </div>
            <div className="console-bar-right">
              <button className="console-btn" onClick={()=>setLogs([])} id="btn-clear-log">Clear</button>
            </div>
          </div>
          <div className="console-body">
            {logs.length === 0
              ? <div className="console-empty">Waiting for events…</div>
              : logs.map((l,i)=>(
                  <div className="log-line" key={i}>
                    <span className="ts">{ts(l.time)}</span>
                    <span className={`lv ${l.lv}`}>{l.lv==='ok'?'DONE':l.lv.toUpperCase()}</span>
                    <span className="txt">{l.txt}</span>
                  </div>
                ))
            }
            <div ref={endRef}/>
          </div>
        </div>

        {/* Event Log */}
        <div className="event-log">
          <div className="event-log-bar">
            <div className="event-log-title">
              {I.clock}
              <span>Event Log</span>
              <span className="event-count">{events.length}</span>
            </div>
            <button className="console-btn" onClick={()=>setEvents([])} id="btn-clear-events">Reset</button>
          </div>
          {events.length === 0
            ? <div className="event-empty">{I.inbox}<p style={{marginTop:'0.3rem'}}>No events yet. Use the panels to generate activity.</p></div>
            : <div className="event-table-wrap">
                <table className="event-table">
                  <thead><tr><th>Time</th><th>Event Type</th><th>Status</th></tr></thead>
                  <tbody>
                    {events.map(e=>(
                      <tr key={e.id}>
                        <td className="mono">{ts(e.time)}</td>
                        <td><span className={`tag ${
                          e.type.includes('Brute')?'fail':e.type.includes('DoS')?'purple':e.type.includes('Algo')?'warn':e.type.includes('Success')?'ok':'info'
                        }`}>{e.type}</span></td>
                        <td><span className={`tag ${e.ok?'ok':'fail'}`}>{e.ok?'✓ Logged':'✗ Failed'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
          }
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('soc-user');
    return saved ? JSON.parse(saved) : null;
  });

  if (!user) return <AuthPage onLogin={setUser} />;
  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}
