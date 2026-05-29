# Handoff: WorkstationMonSys — Fleet Telemetry Platform

## Overview
A web-based **workstation monitoring platform** that gives IT teams real-time visibility into every PC/workstation on a network. Dark, information-dense, gauge- and sparkline-rich (Netdata/Grafana feel). Five sections: Fleet Dashboard, Workstation List, Workstation Detail, Alerts Center, and Network View. Focused on **hardware health and network performance** — not OS internals.

## About the Design Files
The files in this bundle are **design references created in HTML** — interactive prototypes showing the intended look, motion, and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs in your target codebase** using its established framework, component library, and patterns. The original brief targeted **Next.js 14 (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts + framer-motion + lucide-react** — if you're starting fresh, that stack is a good fit. If you already have an app, use its existing primitives and just match the visual spec below. The prototype hand-rolls its charts in SVG; in production, prefer a charting library (Recharts/Tremor/visx).

## Fidelity
**High-fidelity.** Final colors, typography, spacing, gauges, and interactions are all intentional and specified below. Recreate the UI to match, using your codebase's libraries. The mock data shape is also specified so you can wire it to a real telemetry backend later.

---

## Design Tokens

### Color — surfaces (dark theme)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#070A0F` | App background (near-black) |
| `--bg-2` | `#0A0E15` | Sidebar / topbar background |
| `--card` | `#0E1219` | Card background (top of a subtle vertical gradient to `#0b0e14`) |
| `--card-2` | `#131925` | Nested surfaces, chips, inputs |
| `--card-3` | `#18202E` | Gauge tracks, progress-bar tracks |
| `--border` | `rgba(255,255,255,0.055)` | Card borders |
| `--border-strong` | `rgba(255,255,255,0.10)` | Inputs, buttons, tooltips |
| `--hairline` | `rgba(255,255,255,0.04)` | Row dividers inside cards |

### Color — text
| Token | Hex |
|---|---|
| `--text` | `#E7EBF3` |
| `--text-dim` | `#939DB2` |
| `--text-faint` | `#5C6577` |
| `--text-ghost` | `#3A4150` (offline/empty values, e.g. "—") |

### Color — accents (semantic). Two palettes; "electric" is default.
| Meaning | Token | Electric | Refined |
|---|---|---|---|
| Info / CPU | `--info` | `#4C8DFF` | `#6E9BE8` |
| Healthy | `--healthy` | `#9EE34F` | `#84C98C` |
| Warning | `--warning` | `#FFB020` | `#E0B362` |
| Critical | `--critical` | `#FF4D7D` | `#E0788F` |
| Network | `--network` | `#34D6E6` | `#6BC2CC` |
| GPU / RAM-line | `--gpu` | `#B57BFF` | `#A98DDB` |
| Offline | (literal) | `#4A5160` | `#4A5160` |

**Load-color rule** (used by gauges/bars that represent a 0–100% utilization): `>=90 → critical`, `>=75 → warning`, `>=55 → info`, else `healthy`.

### Typography
- **Display / headings / big metric numbers**: `Space Grotesk` (400–700). Headings use `letter-spacing: -0.01em to -0.02em`.
- **Body / UI / tables**: `IBM Plex Sans` (400–700).
- **All metrics & numerals**: `IBM Plex Mono` with **tabular numerals** (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`) so digits never shift.
- **Category labels** (`.label`): 10.5px, `letter-spacing: 0.13em`, `text-transform: uppercase`, weight 600, color `--text-faint`.
- Type sizes: page title 18px/600; card title 13px/600; body 12.5–14px; big metric numbers 26–40px; small mono captions 10.5–11px.

### Spacing, radius, shadow
- Card padding: **18px** (comfortable) / **12px** (compact).
- Grid gap: **14px** (comfortable) / **10px** (compact).
- Radius: cards **12px** (10px compact), small/controls **8px**, pills/chips **999px**.
- Sidebar width: **232px** expanded, **64px** collapsed. Topbar height: **64px**.
- Glow accents: gauges/sparkline endpoints use `drop-shadow(0 0 4–5px <accent>)`; status dots use a colored `box-shadow` ring.
- Ambient: two faint radial gradients fixed behind everything (`info` top-right ~5.5% alpha, `network` bottom-left ~3% alpha).

### Density modes
"comfortable" (default) and "compact" only change card padding, grid gap, metric font size (`--metric-size` 40px → 32px), radius, and `.label` size.

---

## Screens / Views

> **Shell (all views):** fixed left **Sidebar** + top **Topbar** + scrollable content. Routing is client-side. Routes: `/` (dashboard), `/workstations`, `/workstations/:id` (detail), `/alerts`, `/network`. Content area animates in with a 0.34s `translateY(8px)→0` transform (no opacity gating).

### Sidebar
- Brand block (64px tall, bottom border): 30px rounded-8 logo tile with `linear-gradient(135deg, info, network)` + a white "pulse/activity" line icon; wordmark "WorkstationMonSys" (Space Grotesk 14.5/700) over mono caption "FLEET TELEMETRY" (9px, faint, tracked).
- Nav items: Dashboard, Workstations, Alerts, Network. Each is icon + label, 13px, radius 9, 9px×11px padding. **Active** item: `info`-tinted background (`color-mix info 14%`), inset 1px `info`-30% ring, a 3px×18px `info` bar on the left edge, icon tinted `info`. Hover (inactive): `rgba(255,255,255,.03)`.
- Alerts item shows a count pill (mono 10.5/700, `critical` bg, white text) when active alerts > 0.
- "FLEET STATUS" mini-legend near bottom: healthy/warning/critical/offline each as a status dot + capitalized label + mono count.
- Collapse button at bottom; collapsing shrinks to 64px (icons only, centered), width transition 0.22s.

### Topbar
- Left: page title (Space Grotesk 18/600) + optional subtitle (12px faint).
- Right: bell button (links to `/alerts`, shows active count in `critical`), a **Live/Paused** toggle (status dot + label; dot pulses + glows `healthy` when live), and a live mono clock (HH:MM:SS, updates every second).
- Background: `bg-2` at 75% with `backdrop-filter: blur(8px)`, bottom border, sticky.

### 1. Fleet Dashboard — `/`
**Purpose:** at-a-glance fleet health. **Layout:** vertical stack, 24px padding, 14px gaps.
- **Row 1 — 6 fleet gauge cards** (`grid-template-columns: repeat(6, 1fr)`): Avg CPU %, Avg RAM %, Avg Disk I/O (MB/s, max 400), Avg GPU % (gpu color), Net Inbound (Mb/s, max 600, network color), Net Outbound (Mb/s, max 400, network color). Each card = `.label` row with a small icon; a big mono metric number that **tweens up on mount/update**; a gauge (style per Tweak — see below); and a full-width sparkline pinned to the card bottom.
- **Row 2 — 2 columns (`2fr 1fr`)**: left = "Fleet load · last 24 hours" area-line chart (CPU in `info`, RAM in `gpu`, y-max 100, x-labels 24h/18h/12h/6h/now, faint gridlines, hover crosshair + tooltip). Right = "Fleet health" card: multi-segment **donut** (healthy/warning/critical/offline) with center "% Healthy" big number, plus a dot+label+count legend.
- **Row 3 — 2 columns (`1fr 1fr`)**: "Workstations needing attention" (up to 7 non-healthy devices sorted by ascending health score: status dot, hostname mono, top failing factor + dept, score colored by status, time-in-state) and "Live alert feed" (last 10 events: severity dot, text, hostname, relative time; rows link to detail).
- **Row 4 — 3 columns**: Top-by-CPU, Top-by-RAM, Top-by-Disk — each 5 rows of hostname + mono value + colored horizontal progress bar.

### 2. Workstation List — `/workstations`
**Purpose:** browse/search/filter/sort all devices.
- **Controls row:** search input (icon inside, 36px left padding, focus border `info`) matching hostname/user/dept/IP; status filter chips (All/Healthy/Warning/Critical/Offline, each with dot + mono count, active = `info`-tinted); right-aligned OS filter chips (All/Windows/macOS/Linux).
- **Table card** (padding 0, overflow hidden): columns = status dot, Hostname (mono bold + dept·IP subline), User, OS (text "WIN/MAC/LNX" badge + short name), Status (colored `.badge`), CPU/RAM/Disk (mini progress bar + mono %; offline shows "—"), Uptime (mono; "offline" if down). All columns sortable — click header toggles asc/desc, active header shows an arrow in `info`. Rows hover-highlight and link to detail. Footer: "N of 25 workstations".

### 3. Workstation Detail — `/workstations/:id`
**Purpose:** deep-dive one device.
- **Header:** Back button, status dot, hostname (Space Grotesk + mono 22/600), status badge, user · dept, right-aligned uptime ("up 18d 22h") or "last seen …" if offline.
- **Two columns (`300px 1fr`).** Left: **Health score** card — 92px **arc gauge** (270°) with the score centered inside (colored: ≥80 healthy, ≥55 warning, else critical) over a "/ 100" label, beside a list of contributing factors (`label … signed delta` colored by severity); and a **Hardware** card (CPU model, cores/threads, memory, GPU, disk size+type, OS, IP, MAC as label/value rows).
- Right: **CPU card** with header value (load% · temp°C) and a per-core grid of vertical mini-bars (up to 12 cols, each fills bottom-up, colored by load, core index label). A **4-col live-metric grid**: RAM, Disk (+read/write subline), GPU Load (+temp), CPU Temp, Ethernet In, Ethernet Out, Internet Down, Internet Up — each = label, big mono number, thin bar gauge, optional subline. Two **24h trend charts** (CPU+RAM; Network In+Out). An **Alert history** card (per-device events with severity dot, metric, suggested action, active/resolved badge, relative time; empty state if none).

### 4. Alerts Center — `/alerts`
**Purpose:** triage threshold breaches.
- **Summary strip** (4 cards): Active critical, Active warning, Acknowledged, Resolved (24h) — each = tinted icon tile + big mono count + label.
- **Tabs** (segmented control): Active · N / Resolved · N. **Severity chips:** All/Critical/Warning. Right side (active tab only): "N selected", Select all / Clear, and a primary **Acknowledge** button (disabled until rows selected).
- **Alert rows** (cards with a 3px left border in the severity color): checkbox (active tab), severity dot, metric name (Space Grotesk 14/600) + severity badge + hostname link + dept, a centered Value block (value colored by severity + "thr …" threshold), Suggested action text, and duration + relative time. Empty state shows a check icon + message.

### 5. Network View — `/network`
**Purpose:** spatial health overview.
- **Controls:** segmented toggle "By department" / "By subnet"; right-aligned legend (healthy/warning/critical/offline dots).
- **Grouped cards:** one card per department (or `x.x.x.0/24` subnet), header = icon + group name (subnet name in mono) + node count + a "N need attention" badge when any node is critical/offline. Inside: responsive grid of **node tiles** (`minmax(132px, 1fr)`), each = status dot + OS badge, hostname mono, and three tiny CPU/RAM/Disk bars. Offline tiles are dimmed. Tiles colored by status (`color-mix status 8% over card-2`, status-tinted border). Hover shows a **fixed tooltip** that follows the cursor (hostname, status, OS, live CPU/RAM/Disk/Net or "last seen" if offline, IP + "click to open"). Click → detail. Press feedback: `scale(.97)`.

---

## Interactions & Behavior
- **Navigation:** hash/client routing. Clicking any workstation row/list item/node opens `/workstations/:id`. Bell and "Alerts center" links go to `/alerts`.
- **Live data:** a global interval (default 2.5s, Tweakable 1–6s) mutates every online device's metrics within status-appropriate bounds, shifts the rolling sparkline arrays, and re-renders. A Live/Paused toggle stops/starts it.
- **Animations (keep subtle, no bounce):** metric numbers **tween** to new targets (~650ms, cubic ease-out); gauges sweep their arc/ring (~800ms); progress bars animate width; view content slides in 8px on route change (0.34s); critical status dots **pulse** (1.6s expanding ring); the live indicator dot pulses (1.8s).
  - ⚠️ Implementation note: the entrance animation must **not** animate opacity from 0 (a backgrounded iframe/tab can freeze it at the start frame and hide content). Animate transform only, keep base opacity 1.
- **Hover states:** nav items, table rows, list rows, chips, buttons, and network nodes all have hover feedback. Line charts show a crosshair + value tooltip.
- **Sorting/filtering:** list view sorts client-side by any column and filters by status + OS + free text simultaneously. Alerts filter by tab + severity.
- **Bulk acknowledge:** selecting alert checkboxes enables Acknowledge, which removes them from the active list (local state).
- **Responsive:** desktop-first. The 6-up/3-up/2-up grids should collapse to fewer columns on narrower widths; sidebar collapses to 64px.
- **Loading:** brief was to use skeletons over spinners (a `.skel` shimmer class exists for this) — wire to your real fetch states.

## State Management
- `route` (parsed from URL), `sidebarCollapsed`, `live` (boolean), `tickCount` (forces re-render on each interval), and the **tweaks** object (palette, gaugeStyle, density, speed).
- Per-view local state: list = search query, statusFilter, osFilter, sortKey, sortDir; alerts = tab, severityFilter, acknowledged set, selected set; network = grouping mode, hover tooltip target.
- **Data:** a central store of ~25 workstations + derived alerts + an events feed, with a `tick()` mutator and `fleet()` aggregator. In production this becomes your telemetry API / websocket; keep the same shape (see Data Model below).

## Data Model (per workstation)
`id, hostname, dept, user, os {name, short, family}, status (healthy|warning|critical|offline), ip, mac, uptimeSec, lastSeenMin, cpu {model, cores, usage, temp, perCore[]}, ram {totalGB, usedPct}, disk {size, type, usedPct, readMBs, writeMBs}, gpu {model, load, temp}, net {ethIn, ethOut, downMbps, downMax, upMbps, upMax}, health {score, factors[{label, delta, sev}]}, timeInStateMin, hist {cpu, ram, disk, netIn, netOut, gpu — each 48-point 24h array}, spark {cpu, ram, net — rolling 32-point arrays}.`
Fleet mix for realism: 18 healthy / 4 warning / 2 critical / 1 offline; OS mix of Windows 11, Windows 10, macOS Sonoma, Ubuntu 22.04.

## Assets
- **Fonts:** Space Grotesk, IBM Plex Sans, IBM Plex Mono (Google Fonts).
- **Icons:** the prototype hand-draws a small set of lucide-style stroke icons (dashboard, grid, alert, network, cpu, memory, disk, gpu, thermo, globe, bell, search, chevrons, arrows, check, x, clock, download, pulse). In production use **lucide-react** (or your icon set) — names map closely.
- No raster images or logos; the brand mark is a CSS-gradient tile + icon.

## Keeping the design identical (production theme)
To reproduce this exact look in a real app with **zero re-derivation**, use the ready-made files in **`theme/`**:
- **`theme/globals.css`** — every design token as CSS variables (both palettes + density modes + the ambient backdrop + base body styles). Paste into your global stylesheet (e.g. `app/globals.css`). This *is* the design — port it verbatim and the colors/type are pixel-identical.
- **`theme/tailwind.config.snippet.js`** — merge `theme.extend` into your `tailwind.config`. Maps the tokens to Tailwind color/font/radius names (`bg-card`, `text-text-dim`, `font-mono`, `rounded-card`, etc.) and includes the `pulse` + `viewIn` keyframes. Colors reference the CSS vars, so the electric↔refined palette and comfortable↔compact density still swap at runtime via a class on `<html>` — no rebuild.

Workflow: drop both `theme/` files in first, load the three Google Fonts, then build views against those token names. The component spec below tells you which token each element uses.

## Files (in this bundle)
- `WorkstationMonSys.html` — app shell, fonts, script load order.
- `styles.css` — all design tokens + base styles + the two palettes + density modes.
- `data.js` — mock data, generators, live `tick()`, `fleet()` aggregator (the data contract).
- `charts.jsx` — Gauge (ring/arc/bar), Sparkline, Donut, LineChart, ProgressBar, AnimatedNumber, `useTween`, `loadColor`.
- `components.jsx` — Icon set, OSBadge, StatusDot, Sidebar, Topbar, MetricLabel, SkeletonCard.
- `dashboard.jsx`, `workstations.jsx`, `detail.jsx`, `alerts.jsx`, `network.jsx` — the five views.
- `app.jsx` — router, live loop, shell composition, Tweaks panel.
- `tweaks-panel.jsx` — the in-prototype controls panel (palette/gauge style/density/speed); **not part of the product** — ignore for production.

> Tip: open `WorkstationMonSys.html` to see everything live, and read `styles.css` + `data.js` first — they encode the tokens and the data contract you'll port.
