# Deployment Notes — WorkstationMonSys (for the IT / Infrastructure admin)

> Practical, non-code notes for deploying the platform on a corporate network. Hand this to whoever runs your Active Directory / Intune / Jamf / MDM and your internal servers. Pair it with `PROMPT.md` (what the dev/Claude Code builds) and `README.md` (the design spec).

---

## The big picture (how the pieces sit on your network)

```
  [ Workstations ]            [ Internal server ]              [ Admin browser ]
   agent (Win/Mac/Linux)  ──►  WorkstationMonSys server  ◄──►  Dashboard (web app)
   streams metrics over TLS     + database (Postgres/Timescale)   over TLS
                                + alert engine + scanner
```

- **Agents** live on each monitored workstation and push telemetry to the server.
- **The server + database** run on one internal machine (VM or box) — the only thing that needs to be reachable by all agents and by admins.
- **Admins** just open the web dashboard in a browser. No software on the admin's PC.

Everything stays **inside your LAN/VPN** — nothing needs to touch the public internet.

---

## 1. Where to host the server
- A small **internal Linux VM** is plenty to start (e.g. 4 vCPU / 8 GB RAM / 100 GB disk for a few hundred workstations; scale disk with how much history you retain).
- Give it a **stable internal DNS name**, e.g. `monitor.company.local`, and a static IP.
- Stand it up with the provided **Docker Compose** file (one command brings up web + server + database + TLS reverse proxy).
- Put a **TLS certificate** on it — use your internal CA (AD Certificate Services) or Let's Encrypt if it has a resolvable name. Agents and browsers should trust it.
- Set up **database backups** (nightly dump of Postgres) and decide a **retention window** for metrics (e.g. raw 7 days, downsampled 90 days). The dev sets this via env vars.

## 2. Firewall / ports to open (internal only)
| From | To | Port | Why |
|---|---|---|---|
| All workstations | Server | **443 (HTTPS/WSS)** | Agents send metrics + receive config |
| Admin PCs | Server | **443** | Dashboard access |
| Server | Workstations | (only if using **agentless** fallback) | WMI 135/445, SNMP 161, SSH 22 |
| Server | Subnets to scan | ICMP + ARP | Network discovery scan |

Keep the server **off the public internet**. Require **VPN** for any remote admin access.

## 3. Configure the network scan ranges
- In the server's config (env var, e.g. `SCAN_CIDRS`), list the subnets to discover, e.g. `10.4.1.0/24,10.4.2.0/24`.
- Only list ranges you're **authorized** to scan. The scan is light (ping/ARP/mDNS + optional port probe) but should still be scoped to your managed network.

## 4. Create the first admin
- After the stack is up, follow `INSTALL.md` to create the **first admin account** (CLI command or first-run setup screen).
- Add more admins/viewers from the app afterwards. Use **SSO/OIDC** (Azure AD/Entra, Okta) if available instead of local passwords.

---

## 5. Deploying the agent fleet-wide (no desk visits)

You distribute **one installer per OS** (the build produces these). The installer must receive **two parameters** so the agent knows where to report and how to authenticate:

- **Server URL** — e.g. `https://monitor.company.local`
- **Enrollment token** — generated in the app (Discover & Enroll screen). Use a **reusable/group enrollment token** for mass deployment so every machine can self-register on first run.

### Windows — Intune or Group Policy
- **Intune:** upload the agent **MSI** as a Win32/LOB app. Set the silent install command with parameters, e.g.:
  ```
  msiexec /i WorkstationMonAgent.msi /qn SERVER="https://monitor.company.local" TOKEN="<enrollment-token>"
  ```
  Assign it to the device groups you want to monitor. Intune installs it silently on next sync.
- **Group Policy (GPO):** either a **Software Installation** policy pointing at the MSI on a share, or a **startup script** running the `msiexec` line above. Target the right OU.

### macOS — Jamf / MDM
- Upload the **.pkg** to Jamf (or your MDM) and deploy via a **policy** to a smart group.
- Pass the server URL + token via a **configuration profile** or a `postinstall` script / managed preferences, so the agent enrolls silently.

### Linux — MDM / config management
- Distribute the **.deb/.rpm** (or install script) via your config tool (Ansible/Puppet/Chef) or MDM.
- Provide server URL + token as env vars or a config file dropped by the same tool; agent runs as a **systemd** service.

**Result:** machines install the agent silently, the agent self-enrolls using the token, and they appear in the dashboard automatically — you never log into an end user's machine.

> Tip: the **Discover & Enroll** scan screen is still useful even with mass deployment — it shows which discovered machines are **not yet reporting an agent**, so you can spot coverage gaps (machines your GPO/Intune missed).

---

## 6. Rollout sequence (recommended)
1. Stand up the server + database (Docker Compose) on the internal VM; get TLS working.
2. Create the first admin; set scan CIDRs.
3. **Pilot:** deploy the agent to a small test OU/group (5–10 machines) via Intune/GPO/Jamf. Confirm they enroll and stream data.
4. Review the dashboard against the design; verify alerts fire correctly.
5. **Roll out** to the rest of the fleet in waves (by department/OU).
6. Set up backups, retention, and admin/viewer accounts for the team.

## 7. Governance / policy (do this in parallel — not a code task)
- Monitoring employee workstations should be covered by your **IT acceptable-use / monitoring policy**; check with whoever owns HR/legal policy before fleet rollout.
- Keep the **audit log** (the app records admin scans/enrollments/acknowledgements) for accountability.
- Restrict admin access (RBAC + VPN + SSO) and rotate/revoke agent credentials when machines are decommissioned.

---

## What's a code task vs. an admin task
| Build (Claude Code, via `PROMPT.md`) | Your IT admin console |
|---|---|
| Agent installers (MSI/pkg/deb) | Pushing them via Intune/GPO/Jamf |
| Server, DB, dashboard, scanner, alert engine | Hosting the server VM + TLS cert + firewall rules |
| Enrollment-token generation | Plugging token + server URL into the deployment |
| Docker Compose + INSTALL.md | Running it on your internal box, backups, retention |
