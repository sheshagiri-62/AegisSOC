# Phase 3 (Simplified): MISP + Wazuh Threat Intel

> **Goal**: Show that your SOC can detect connections from known-malicious IPs using real threat intelligence.
> **Time**: ~30 minutes | **Complexity**: Low

---

## What We're Building

```
MISP (stores malicious IPs)
  ↓  sync script pulls IPs
Wazuh CDB List (flat file of bad IPs)
  ↓  rule checks every log against it
ALERT: "Known malicious IP detected!"
```

That's it. Three pieces.

---

## Step 1: Deploy MISP Docker (Ubuntu VM)

```bash
# On your Ubuntu VM
cd ~
git clone https://github.com/MISP/misp-docker.git
cd misp-docker

cp template.env .env
```

Edit `.env` — only change these 2 lines:

```bash
nano .env
```

```env
MISP_ADMIN_EMAIL=admin@admin.test
MISP_ADMIN_PASSPHRASE=SOCLab2026
```

Start it:

```bash
docker compose up -d
```

Wait ~3-5 minutes, then open in browser:

```
https://<YOUR_UBUNTU_VM_IP>
Login: admin@admin.test / SOCLab2026
```

> [!NOTE] 
> If you get a certificate warning, click "Advanced → Proceed" (it's self-signed).

---

## Step 2: Add Malicious IPs in MISP (Web UI)

No scripting needed — just use the MISP web interface:

1. **Click** `Event Actions → Add Event`
2. **Fill in**:
   - Info: `Malicious IPs targeting financial platforms`
   - Distribution: `Your organisation only`
   - Threat Level: `High`
   - Analysis: `Completed`
3. **Click** `Submit`
4. On the event page, click **Add Attribute** and add these one by one:
   - Category: `Network activity`
   - Type: `ip-src`
   - For IDS: ✅ checked
   - Value: (enter one IP per attribute)

**IPs to add:**

| IP | Comment |
|----|---------|
| `45.33.32.156` | Shodan scanner targeting HFT APIs |
| `185.220.101.34` | Tor exit node - brute force campaigns |
| `203.0.113.99` | Botnet node - HTTP flood source |

5. **Get your API key**: Go to `Administration → List Auth Keys → Add Auth Key` → Copy it.

---

## Step 3: Connect MISP to Wazuh

### 3a — Create the sync script on Ubuntu VM

```bash
nano ~/sync_misp.sh
```

```bash
#!/bin/bash
# Pulls malicious IPs from MISP → Wazuh CDB list

MISP_URL="https://localhost"
MISP_KEY="<PASTE_YOUR_API_KEY>"        # ← replace this
WAZUH_CTR="wazuh.manager"              # ← your wazuh container name

# Fetch IPs from MISP
curl -sk \
  -H "Authorization: ${MISP_KEY}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"returnFormat":"json","type":"ip-src","to_ids":true}' \
  "${MISP_URL}/attributes/restSearch" \
| python3 -c "
import sys, json
data = json.load(sys.stdin)
for a in data.get('response',{}).get('Attribute',[]):
    ip = a.get('value','')
    if ip: print(f'{ip}:malicious')
" > /tmp/misp_ips.txt

echo "Found $(wc -l < /tmp/misp_ips.txt) IPs:"
cat /tmp/misp_ips.txt

# Copy into Wazuh and rebuild
docker cp /tmp/misp_ips.txt ${WAZUH_CTR}:/var/ossec/etc/lists/misp-malicious-ips
docker exec ${WAZUH_CTR} /var/ossec/bin/wazuh-makelists
docker exec ${WAZUH_CTR} /var/ossec/bin/wazuh-control restart

echo "Done! Wazuh now knows about these IPs."
```

```bash
chmod +x ~/sync_misp.sh
```

### 3b — Add the CDB list to Wazuh config

```bash
# Enter Wazuh container
docker exec -it wazuh.manager bash

# Edit ossec.conf
nano /var/ossec/etc/ossec.conf
```

Find the `<ruleset>` section and add one line:

```xml
<ruleset>
  <!-- existing stuff stays -->
  <list>etc/lists/misp-malicious-ips</list>
</ruleset>
```

Exit the container.

### 3c — Add one detection rule

Add this single rule to your `local_rules.xml` (inside the existing `<group>` block, before `</group>`):

```xml
  <!-- MISP Threat Intel Match -->
  <rule id="100021" level="15">
    <if_sid>100001,100010</if_sid>
    <list field="srcip" lookup="address_match_key">etc/lists/misp-malicious-ips</list>
    <description>THREAT INTEL: Connection from MISP-flagged malicious IP $(srcip)</description>
    <group>threat_intel,misp_match,</group>
  </rule>
```

### 3d — Run it

```bash
~/sync_misp.sh
```

Expected output:
```
Found 3 IPs:
45.33.32.156:malicious
185.220.101.34:malicious
203.0.113.99:malicious
Done! Wazuh now knows about these IPs.
```

---

## How to Demo It

From your dashboard, trigger attacks as usual. If any log contains an IP matching the MISP list, Wazuh fires a **Level 15** critical alert.

To **force a demo match**, you can temporarily hardcode one MISP IP into your backend logger. In `backend/utils/logger.js`, change the `randomIp()` function temporarily:

```js
function randomIp() {
  // 20% chance of using a MISP-known malicious IP for demo
  if (Math.random() < 0.2) {
    const mispIps = ['45.33.32.156', '185.220.101.34', '203.0.113.99'];
    return mispIps[Math.floor(Math.random() * mispIps.length)];
  }
  return `${Math.floor(Math.random()*223)+1}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}`;
}
```

Then run a DoS simulation → some requests will use MISP-flagged IPs → Wazuh alerts fire.

Check alerts:
```bash
docker exec wazuh.manager grep "MISP" /var/ossec/logs/alerts/alerts.log
```

---

## Summary

| What | Where | Effort |
|------|-------|--------|
| MISP container | Ubuntu VM | 5 min |
| Add 3 IPs via web UI | MISP browser | 5 min |
| Sync script | Ubuntu VM | 5 min |
| One line in ossec.conf | Wazuh container | 2 min |
| One rule in local_rules.xml | Wazuh container | 2 min |
| Run sync + test | Ubuntu VM | 5 min |
