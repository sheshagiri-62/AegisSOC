# AegisSOC — End-to-End Automated SOC for Financial Trading Infrastructure

> A portfolio-grade Security Operations Centre (SOC) platform that models how a high-frequency trading (HFT) firm can detect, investigate, and respond to threats in real time. AegisSOC connects threat intelligence, SIEM detection, SOAR automation, and a live analyst dashboard into one end-to-end security workflow.

Built to demonstrate practical security engineering rather than an isolated proof of concept, the project turns MISP indicators into actionable Wazuh alerts and automated Shuffle responses while giving an analyst a real-time view of the environment.

---

## Overview

This project demonstrates a complete, end-to-end automated threat detection and response pipeline:

1. **MISP** stores real IoCs (malicious IPs) across 4 threat event campaigns
2. **Node.js backend** syncs those IoCs and simulates live network traffic
3. **Wazuh** reads the generated logs and fires custom detection rules
4. **Shuffle SOAR** automates the block-IP response via webhook
5. **React dashboard** visualises everything in real-time

---

## Achievements / Impact

- Built an end-to-end SOC workflow spanning threat intelligence, log collection, detection engineering, automated response, and analyst visualisation.
- Integrated **MISP, Wazuh, Shuffle, Node.js, React, VirtualBox, Docker, and ngrok** across a Windows host and Ubuntu VM.
- Implemented **10 custom Wazuh rules** and **2 custom decoders** for authentication, network, CEF, IOC, and SOAR events.
- Modelled **4 attack campaigns** containing **12 unique malicious IPs**, including cross-event correlation that exposes reused attacker infrastructure.
- Automated first-response containment by blocking malicious IPs and persisting the blocklist across backend restarts.
- Created a repeatable simulation environment for demonstrating SSH brute force, HTTP flood, IOC detection, C2/ransomware activity, and repeated blocked-IP attempts.

---

## Role and responsibilities

This project covered the full security engineering lifecycle:

- **Security architecture:** Designed the Windows-host and Ubuntu-VM topology and defined the flow from MISP intelligence through Wazuh and Shuffle to the dashboard.
- **Threat intelligence engineering:** Created campaign-based MISP events, synchronised indicators, and used correlation data to represent attacker infrastructure reuse.
- **Detection engineering:** Developed and tuned Wazuh rules and decoders for authentication failures, brute force, algorithm modification, network floods, MISP IOC matches, and SOAR actions.
- **Backend development:** Built the Node.js/Express service for MISP synchronisation, traffic simulation, CEF logging, API actions, ngrok exposure, and persistent blocklist management.
- **Automation and response:** Connected Shuffle webhooks to the backend so detected malicious IPs could be blocked automatically and safely reset for repeatable demonstrations.
- **Frontend development:** Designed the React dashboard to surface live events, threat intelligence, simulation controls, alert context, blocked IPs, and recovery actions.
- **Validation and documentation:** Added operational commands, log examples, deployment scripts, and a playbook for setup, troubleshooting, and live demonstrations.

---

## Project outcome

AegisSOC delivers a working, repeatable SOC demonstration in which a malicious event can move through the complete response chain:

**MISP indicator → simulated traffic → CEF/network log → Wazuh alert → Shuffle webhook → IP block → dashboard visibility**

The result is an isolated environment that makes security operations observable and testable. It demonstrates how threat intelligence can be operationalised into detection and containment, while also providing a practical foundation for extending the project with additional data sources, detections, playbooks, and analyst workflows.

---

## Architecture

The platform is split across two environments so that the security infrastructure and the application being monitored remain clearly separated:

- **Ubuntu VM:** Hosts the security operations infrastructure in Docker: MISP for threat intelligence, Wazuh for SIEM detection, and Shuffle for SOAR orchestration.
- **Windows host:** Runs the application under test: the Node.js backend, React dashboard, Wazuh agent, and ngrok tunnel.
- **Virtual network:** The VM uses `192.168.56.105` to communicate with the Windows host. The Wazuh agent ships host logs to the Wazuh manager, while ngrok provides a controlled route for Shuffle to call the backend response API.

```
┌──────────────────────────────────────────────────────────────┐
│                  UBUNTU VM (192.168.56.105)                  │
│                                                              │
│  MISP :8081    ──── 4 events, 12 IPs, correlation graph      │
│  Wazuh :443    ──── 10 custom rules, CEF log ingestion       │
│  Shuffle :3001 ──── SOAR workflow, ngrok webhook trigger      │
└──────────────────────────┬───────────────────────────────────┘
                           │  agent ships logs
┌──────────────────────────▼───────────────────────────────────┐
│                    WINDOWS HOST                              │
│                                                              │
│  Node.js :5000  ── MISP sync · simulation · CEF logging      │
│  React   :5173  ── 3-column SOC dashboard                    │
│  Wazuh Agent    ── monitors auth.log, network.log, app.log   │
│  ngrok          ── exposes /api/actions/block-ip to VM       │
└──────────────────────────────────────────────────────────────┘
```

### Diagram walkthrough

1. **MISP — threat intelligence source (`:8081`)**
   MISP stores the malicious IP indicators used by the project. The backend periodically synchronises these indicators, and the Wazuh deployment script can use the same intelligence to keep detection rules aligned with current MISP data.

2. **Node.js backend (`:5000`) — application and simulation layer**
   The backend runs on the Windows host. It retrieves MISP indicators, generates normal and malicious HFT-style traffic, writes authentication/network/CEF logs, exposes dashboard APIs, and maintains the persistent IP blocklist. It is the source of the events that exercise the rest of the pipeline.

3. **Wazuh Agent — log collection layer**
   The Windows Wazuh agent monitors `auth.log`, `network.log`, and `app.log`. It forwards those records to the Wazuh manager in the Ubuntu VM, allowing simulated activity to be processed like security telemetry from a real host.

4. **Wazuh Manager (`:443`) — detection and alerting layer**
   Wazuh decoders parse the project’s SSH, network, and CEF formats. The custom rules then identify events such as login failures, brute force, HTTP floods, MISP IOC matches, critical C2/ransomware indicators, and repeated connection attempts from blocked IPs.

5. **Shuffle (`:3001`) — orchestration and response layer**
   When Wazuh identifies a new malicious IP, the alert can trigger a Shuffle workflow. Shuffle sends a block request through the ngrok tunnel to the backend, which adds the IP to the persistent blocklist and records the response.

6. **ngrok — controlled webhook bridge**
   The tunnel exposes only the backend’s block-IP endpoint to the VM-hosted Shuffle workflow. This allows the isolated lab components to communicate without requiring the backend to be directly exposed on the local network.

7. **React dashboard (`:5173`) — analyst experience**
   The dashboard presents the live event console, threat intelligence, simulation controls, Wazuh-related activity, blocked IPs, and recovery actions in one interface. It provides the visual layer for observing the detection and response cycle.

### End-to-end data flow

The normal security workflow is:

1. MISP publishes or stores an indicator.
2. The backend synchronises the indicator and uses it in the traffic simulation.
3. Simulated activity is written as authentication, network, or CEF application logs.
4. The Wazuh Agent forwards those logs to the Wazuh Manager.
5. Wazuh decoders and custom rules classify the activity and generate an alert.
6. Shuffle receives the relevant alert and runs the response workflow.
7. Shuffle calls the backend through ngrok to block the malicious IP.
8. The backend persists the block, logs the action, and exposes the result to the React dashboard.

This separation mirrors a practical SOC design: **MISP supplies context, Wazuh detects, Shuffle orchestrates, the backend enforces the response, and the dashboard gives the analyst visibility and control.**

---

## Tech Stack

| Layer | Tool | Purpose |
|---|---|---|
| Threat Intelligence | **MISP** | Stores and correlates malicious IoCs across attack campaigns |
| SIEM | **Wazuh 4.7.5** | Ingests logs, fires custom rules, generates alerts |
| SOAR | **Shuffle** | Automates incident response via workflow webhooks |
| Backend | **Node.js + Express** | MISP sync, simulation engine, CEF logging, blocklist management |
| Frontend | **React + Vite** | Real-time 3-column SOC dashboard |
| Tunnel | **ngrok** | Exposes Windows backend to Ubuntu VM for Shuffle webhooks |
| Infrastructure | **VirtualBox** (Ubuntu 20.04) | Isolated VM running MISP, Wazuh, Shuffle in Docker |
| Log Format | **CEF** (Common Event Format) | Industry-standard SIEM-compatible alert format |

---

## Features

### Threat Intelligence (MISP)
- **4 threat events** modelling real-world attack campaigns against an HFT firm
- **12 unique malicious IPs** with descriptions, severity levels, and MISP event links
- **Cross-event IP correlation** — 3 shared IPs across events reveal APT infrastructure reuse
- Auto-sync every 5 minutes from MISP to the backend threat intel store

### Live Simulation Engine
- Generates realistic HFT network traffic at a configurable rate (4.5s/tick)
- **60% malicious** (MISP-tracked IPs, round-robin) / **40% normal** random traffic
- Round-robin cycling ensures all 12 MISP IPs are seen in each cycle

### Automated Incident Response (SOAR)
- Malicious IPs are **automatically blocked** on first detection
- Blocklist persists to `blocked_ips.txt` — survives backend restarts
- Blocked IP repeat attempts logged separately (`IP_Block_Repeated`)
- **Unblock All** recovery action for clean-state demo resets
- External block trigger via Shuffle → ngrok → `/api/actions/block-ip`

### Wazuh Alerting (10 Custom Rules)
| Rule | Level | Trigger |
|---|---|---|
| 100001 | 5 | SSH login failure |
| 100002 | 10 | SSH brute force (5+ failures/60s) |
| 100003 | 12 | Unauthorized algorithm modification |
| 100010 | 3 | Market data API request (base rule) |
| 100004 | 14 | HTTP flood / DoS (40+ req/30s) |
| 100021 | 15 | MISP IP in raw network traffic (srcip match) |
| 100030 | 12 | MISP IOC detected (CEF event) |
| 100031 | 15 | MISP CRITICAL IP — C2 / Ransomware |
| 100032 | 13 | SOAR auto-block — new IP blocked |
| 100033 | 10 | Blocked IP repeat connection attempt |

### Dashboard (React)
- **Left panel**: Auth, Trading, Threat Intel, Attack Simulation controls
- **Centre**: Live event console + event log table
- **Right panel**: Simulation engine (start/stop, stats, live IP feed) + SOAR response (blocked IPs, recovery)

---

## Project Structure

```
soc/
├── backend/
│   ├── server.js              Express server, ngrok, dotenv, MISP sync scheduler
│   ├── .env                   MISP_URL + MISP_KEY (not committed to git)
│   ├── routes/
│   │   ├── actions.js         Simulation, block-IP, SOAR, MISP routes
│   │   └── auth.js            Login/logout event generation
│   └── logs/
│       ├── auth.log           SSH auth events → Wazuh rules 100001/100002
│       ├── network.log        HTTP traffic → Wazuh rules 100010/100004/100021
│       ├── app.log            CEF events → Wazuh rules 100030–100033
│       └── blocked_ips.txt    Persistent blocklist (loaded on startup)
│
├── frontend/
│   └── src/
│       ├── App.jsx            3-column dashboard component
│       └── index.css          Full design system and layout styles
│
├── rules/                     Wazuh configuration files
│   ├── local_rules.xml        All 10 custom Wazuh rules (with comments)
│   ├── local_decoder.xml      hft_app_decoder + hft_network_decoder
│   └── sync_misp.sh           MISP → Wazuh sync script (run on Ubuntu VM)
│
├── ngrok.exe                  Tunnel binary for Windows
├── playbook.md                Full demo guide and troubleshooting reference
└── README.md                  This file
```

---

## Setup & Running

### Prerequisites
- **VirtualBox** with Ubuntu 20.04 VM (IP: `192.168.56.105`)
- **Docker** running on VM with: MISP, Wazuh (single-node), Shuffle
- **Wazuh Windows Agent** installed on host, pointing to VM
- **Node.js 18+** and **npm** on Windows host

### Environment Configuration

Create `backend/.env`:
```env
MISP_URL=http://192.168.56.105:8081
MISP_KEY=<your-misp-api-key>
```

Get your MISP API key from: `MISP UI → Administration → List Auth Keys`

### Start Backend
```powershell
cd backend
npm install
npm start
```

Wait for:
```
[MISP] ✓ Synced 12 IPs from MISP (MISP-only mode)
[ngrok] ✓ Public URL: https://xxxx.ngrok-free.dev
```

### Start Frontend
```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — login with any username and password.

### Deploy Wazuh Rules (on Ubuntu VM)

```bash
# Copy sync script to VM
scp rules/sync_misp.sh seed@192.168.56.105:~/sync_misp.sh

# Run on VM to deploy all rules and restart Wazuh
ssh seed@192.168.56.105 "chmod +x ~/sync_misp.sh && bash ~/sync_misp.sh"
```

---

## MISP Events

| # | Campaign | Threat Level | IPs |
|---|---|---|---|
| 1 | Malicious IPs targeting financial platforms | High | 3 |
| 2 | SSH Brute Force Campaign targeting HFT Firms | High | 3 |
| 3 | APT Reconnaissance against Financial Trading Platforms | High | 3 |
| 4 | Ransomware + DDoS Combined Attack on HFT Infrastructure | High | 5 (incl. 2 shared) |

**Correlation graph** (visible in MISP UI → Event 4 → View Correlations):
- `203.0.113.99` shared between Events 1 and 4 (C2 server reuse)
- `188.166.26.195` shared between Events 2 and 3 (brute-force bot in APT recon)
- `193.32.162.157` shared between Events 3 and 4 (exfil endpoint post-encryption)

---

## Dashboard Actions

| Button | What it simulates | Wazuh rule fired |
|---|---|---|
| Login Success | Successful SSH authentication | — |
| Login Fail | Failed SSH authentication | 100001 (5+→ 100002) |
| Modify Algorithm | Algo change during trading hours | 100003 (if Trader role) |
| Trigger MISP IPs | Manual 3-IP MISP threat burst | 100030, 100032 |
| SSH Brute Force | 15 rapid login failures | 100001 → 100002 |
| HTTP Flood | N simultaneous market-data requests | 100010 → 100004 |
| ▶ Start Simulation | Auto 60/40 MISP/normal traffic | 100021, 100030, 100031, 100032, 100033 |
| Unblock All | Analyst-initiated blocklist clear | — |

---

## Log Formats

**auth.log** (syslog/ssh format):
```
Apr 17 09:00:00 hft-server sshd[1234]: Failed password for vish from 192.168.56.1 port 11866 ssh2
```

**network.log** (hft-network syslog format):
```
Apr 17 09:00:00 hft-server hft-network[1234]: GET /api/public/market-data HTTP/1.1 from 185.220.101.34
```

**app.log** (CEF format):
```
Apr 17 09:00:00 hft-server hft-app[1234]: CEF:0|SOCLab|HFT-Platform|1.0|100|MISP_IOC_Detected|5|suser=ThreatIntel msg=MISP-ALERT: ip=185.220.101.34 tag=Tor-Exit-Node severity=HIGH eventId=1 desc=Tor exit node - brute force campaigns
```

---

## Useful Commands

```bash
# Watch Wazuh alerts live (on VM)
docker exec single-node_wazuh.manager_1 tail -f /var/ossec/logs/alerts/alerts.log \
  | grep -E "100030|100032|100033|MISP|SOAR"

# Test a rule without an agent
echo "Apr 17 09:00:00 hft-server hft-app[1234]: CEF:0|SOCLab|HFT-Platform|1.0|100|MISP_IOC_Detected|5|suser=ThreatIntel msg=MISP-ALERT: ip=185.220.101.34 tag=Tor severity=HIGH" \
  | docker exec -i single-node_wazuh.manager_1 /var/ossec/bin/wazuh-logtest

# Re-sync MISP → Wazuh after adding new events
bash ~/sync_misp.sh

# Check registered Wazuh agents
docker exec single-node_wazuh.manager_1 /var/ossec/bin/agent_control -l
```

---

## Key Metrics

| Metric | Value |
|---|---|
| MISP threat events | 4 |
| Unique malicious IPs | 12 |
| Cross-event correlations | 3 |
| Custom Wazuh rules | 10 |
| Custom Wazuh decoders | 2 |
| Log files monitored | 3 (auth, network, app) |
| Simulation tick rate | 4.5 seconds |
| Malicious traffic ratio | 60% |
| Highest alert level | 15 (Critical) |

---

## References

- [MISP Project](https://www.misp-project.org/)
- [Wazuh Documentation](https://documentation.wazuh.com/)
- [Shuffle SOAR](https://shuffler.io/)
- [Common Event Format (CEF)](https://www.microfocus.com/documentation/arcsight/arcsight-smartconnectors-8.4/cef-implementation-standard/)

---

## For Reviewers

**AegisSOC demonstrates:** security monitoring, threat intelligence, detection engineering, incident-response automation, backend and frontend integration, Linux/Windows interoperability, and technical documentation.

The project is especially relevant to roles in:

- Security Operations and SOC Engineering
- Threat Detection and Incident Response
- Cybersecurity Automation and SOAR
- Security Engineering and Platform Engineering
- Full-stack engineering for security products

For a technical walkthrough, start with the [architecture](#architecture), [features](#features), and [setup instructions](#setup--running). For the complete live-demo sequence and troubleshooting notes, see [`playbook.md`](playbook.md).
