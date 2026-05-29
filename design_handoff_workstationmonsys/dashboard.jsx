/* ============================================================
   dashboard.jsx — Main Dashboard
   ============================================================ */
function GaugeCard({ label, icon, color, value, display, unit, max, spark, gaugeStyle }) {
  const ringStyle = gaugeStyle === "bar" ? "bar" : gaugeStyle; // ring | arc | bar
  const pct = max ? (value / max) * 100 : value;
  const col = color || window.loadColor(pct);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <MetricLabel icon={icon} text={label} color={col} />
      {ringStyle === "bar" ? (
        <React.Fragment>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span className="mono display" style={{ fontSize: "var(--metric-size)", fontWeight: 600, lineHeight: 1, color: "var(--text)" }}>
              <AnimatedNumber value={value} decimals={display?.decimals ?? 0} />
            </span>
            <span className="mono" style={{ fontSize: 13, color: "var(--text-faint)" }}>{unit}</span>
          </div>
          <Gauge value={value} max={max || 100} style="bar" color={col} thickness={7} />
        </React.Fragment>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span className="mono display" style={{ fontSize: "var(--metric-size)", fontWeight: 600, lineHeight: 1, color: "var(--text)" }}>
                <AnimatedNumber value={value} decimals={display?.decimals ?? 0} />
              </span>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{unit}</span>
            </div>
          </div>
          <div style={{ flex: "none" }}>
            <Gauge value={value} max={max || 100} style={ringStyle} size={62} thickness={7} color={col} />
          </div>
        </div>
      )}
      <div style={{ marginTop: "auto", opacity: .85 }}>
        <Sparkline data={spark} w={220} h={26} color={col} />
      </div>
    </div>
  );
}

function NeedsAttention({ onOpen }) {
  const list = window.WMS.workstations
    .filter((w) => w.status !== "healthy")
    .sort((a, b) => a.health.score - b.health.score)
    .slice(0, 7);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-head">
        <div className="card-title">Workstations needing attention</div>
        <a href="#/workstations" className="chip">View all</a>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {list.map((w, i) => {
          const f = w.health.factors[0];
          return (
            <div key={w.id} onClick={() => onOpen(w.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 6px",
              borderTop: i ? "1px solid var(--hairline)" : "none", cursor: "pointer", borderRadius: 6,
            }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,.025)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
              <span className={`dot ${w.status}`} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="mono" style={{ fontSize: 13, color: "var(--text)", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.hostname}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{f ? f.label : w.status} · {w.dept}</div>
              </div>
              <div style={{ textAlign: "right", flex: "none" }}>
                <div className={`mono c-${w.status}`} style={{ fontSize: 15, fontWeight: 600 }}>{w.health.score}</div>
                <div className="mono" style={{ fontSize: 10, color: "var(--text-faint)" }}>{w.status === "offline" ? window.WMS.relTime(w.lastSeenMin) : window.WMS.relTime(w.timeInStateMin)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AlertFeed() {
  const evs = window.WMS.events.slice(0, 10);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column" }}>
      <div className="card-head">
        <div className="card-title">Live alert feed</div>
        <a href="#/alerts" className="chip">Alerts center</a>
      </div>
      <div style={{ display: "flex", flexDirection: "column", overflowY: "auto" }}>
        {evs.map((e, i) => (
          <a key={e.id} href={`#/workstations/${e.wsId}`} style={{
            display: "flex", alignItems: "flex-start", gap: 11, padding: "9px 6px",
            borderTop: i ? "1px solid var(--hairline)" : "none", borderRadius: 6,
          }}
            onMouseEnter={(ev) => ev.currentTarget.style.background = "rgba(255,255,255,.025)"}
            onMouseLeave={(ev) => ev.currentTarget.style.background = "transparent"}>
            <span className={`dot ${e.sev}`} style={{ marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: "var(--text)" }}>{e.text}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{e.ws}</div>
            </div>
            <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", flex: "none", whiteSpace: "nowrap" }}>{window.WMS.relTime(e.ageMin)}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function TopNCard({ title, metric, unit, sel, color, onOpen }) {
  const list = [...window.WMS.workstations].filter((w) => w.status !== "offline")
    .sort((a, b) => sel(b) - sel(a)).slice(0, 5);
  const maxV = Math.max(...list.map(sel), 1);
  return (
    <div className="card">
      <div className="card-head"><div className="card-title">{title}</div><span className="label">{metric}</span></div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        {list.map((w) => {
          const v = sel(w);
          const col = color || window.loadColor(v);
          return (
            <div key={w.id} onClick={() => onOpen(w.id)} style={{ cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{w.hostname}</span>
                <span className="mono" style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", flex: "none" }}>{v.toFixed(unit === "%" ? 0 : 1)}{unit}</span>
              </div>
              <ProgressBar value={v} max={unit === "%" ? 100 : maxV} color={col} height={6} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dashboard({ tick, gaugeStyle, onOpen }) {
  const f = window.WMS.fleet();
  // build fleet sparklines from averaging spark arrays
  const ws = window.WMS.workstations;
  const avgSpark = (key) => {
    const len = ws[0].spark[key].length;
    return Array.from({ length: len }, (_, i) => {
      const on = ws.filter((w) => w.status !== "offline");
      return on.reduce((s, w) => s + w.spark[key][i], 0) / on.length;
    });
  };
  const cpuSpark = avgSpark("cpu"), ramSpark = avgSpark("ram"), netSpark = avgSpark("net");

  // 24h fleet trend
  const histAvg = (key) => Array.from({ length: 48 }, (_, i) => {
    const on = ws.filter((w) => w.status !== "offline");
    return on.reduce((s, w) => s + w.hist[key][i], 0) / on.length;
  });
  const xlabels = [{ at: 0, t: "24h" }, { at: 12, t: "18h" }, { at: 24, t: "12h" }, { at: 36, t: "6h" }, { at: 47, t: "now" }];

  const healthy = f.counts.healthy / f.total * 100;

  return (
    <div className="view-enter" style={{ padding: 24, display: "flex", flexDirection: "column", gap: "var(--gap-grid)" }}>
      {/* fleet gauges */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        <GaugeCard label="Avg CPU" icon="cpu" value={f.avgCpu} unit="%" spark={cpuSpark} gaugeStyle={gaugeStyle} />
        <GaugeCard label="Avg RAM" icon="memory" value={f.avgRam} unit="%" spark={ramSpark} gaugeStyle={gaugeStyle} />
        <GaugeCard label="Avg Disk I/O" icon="disk" color="var(--info)" value={f.avgDisk} unit="MB/s" max={400} spark={cpuSpark.map(v=>v*3)} gaugeStyle={gaugeStyle} display={{ decimals: 0 }} />
        <GaugeCard label="Avg GPU" icon="gpu" color="var(--gpu)" value={f.avgGpu} unit="%" spark={ramSpark.map(v=>v*0.9)} gaugeStyle={gaugeStyle} />
        <GaugeCard label="Net Inbound" icon="arrowDown" color="var(--network)" value={f.netIn} unit="Mb/s" max={600} spark={netSpark} gaugeStyle={gaugeStyle} display={{ decimals: 0 }} />
        <GaugeCard label="Net Outbound" icon="arrowUp" color="var(--network)" value={f.netOut} unit="Mb/s" max={400} spark={netSpark.map(v=>v*0.6)} gaugeStyle={gaugeStyle} display={{ decimals: 0 }} />
      </div>

      {/* trend + donut */}
      <div className="grid" style={{ gridTemplateColumns: "2fr 1fr" }}>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Fleet load · last 24 hours</div>
            <div style={{ display: "flex", gap: 14 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-dim)" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--info)" }} />CPU</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-dim)" }}><span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--gpu)" }} />RAM</span>
            </div>
          </div>
          <LineChart w={620} h={190} yMax={100} labels={xlabels}
            series={[
              { name: "CPU %", data: histAvg("cpu"), color: "var(--info)" },
              { name: "RAM %", data: histAvg("ram"), color: "var(--gpu)" },
            ]} />
        </div>

        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head"><div className="card-title">Fleet health</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1 }}>
            <Donut size={138} thickness={15} segments={[
              { value: f.counts.healthy, color: "healthy" },
              { value: f.counts.warning, color: "warning" },
              { value: f.counts.critical, color: "critical" },
              { value: f.counts.offline, color: "offline" },
            ]}>
              <span className="mono display" style={{ fontSize: 30, fontWeight: 600, lineHeight: 1 }}>{Math.round(healthy)}%</span>
              <span className="label" style={{ marginTop: 3 }}>Healthy</span>
            </Donut>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
              {[["healthy", f.counts.healthy], ["warning", f.counts.warning], ["critical", f.counts.critical], ["offline", f.counts.offline]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span className={`dot ${k}`} />
                  <span style={{ textTransform: "capitalize", fontSize: 12.5, color: "var(--text-dim)", flex: 1 }}>{k}</span>
                  <span className="mono" style={{ fontWeight: 600, fontSize: 14 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* attention + feed */}
      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <NeedsAttention onOpen={onOpen} />
        <AlertFeed />
      </div>

      {/* top N */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        <TopNCard title="Top by CPU" metric="Load %" unit="%" sel={(w) => w.cpu.usage} onOpen={onOpen} />
        <TopNCard title="Top by RAM" metric="Used %" unit="%" sel={(w) => w.ram.usedPct} onOpen={onOpen} />
        <TopNCard title="Top by Disk" metric="Used %" unit="%" sel={(w) => w.disk.usedPct} onOpen={onOpen} />
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
