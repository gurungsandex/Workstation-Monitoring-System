/* ============================================================
   detail.jsx — Workstation Detail
   ============================================================ */
function SpecRow({ k, v, mono = true }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--hairline)" }}>
      <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>{k}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: 12.5, color: "var(--text)", textAlign: "right", fontWeight: 500 }}>{v}</span>
    </div>
  );
}

function LiveMetric({ icon, label, value, unit, color, max, sub, gaugeStyle }) {
  const pct = max ? (value / max) * 100 : value;
  const col = color || window.loadColor(pct);
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <MetricLabel icon={icon} text={label} color={col} />
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span className="mono display" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}><AnimatedNumber value={value} decimals={unit === "%" || unit === "°C" ? 0 : 1} /></span>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{unit}</span>
      </div>
      <Gauge value={value} max={max || 100} style="bar" color={col} thickness={6} />
      {sub && <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{sub}</div>}
    </div>
  );
}

function WorkstationDetail({ id, tick, gaugeStyle, onOpen }) {
  const w = window.WMS.byId(id);
  if (!w) return <div style={{ padding: 40, color: "var(--text-faint)" }}>Workstation not found. <a href="#/workstations" className="c-info">Back to list</a></div>;

  const off = w.status === "offline";
  const myAlerts = window.WMS.alerts.filter((a) => a.wsId === w.id).sort((a, b) => a.ageMin - b.ageMin);
  const xlabels = [{ at: 0, t: "24h" }, { at: 24, t: "12h" }, { at: 47, t: "now" }];
  const scoreColor = w.health.score >= 80 ? "var(--healthy)" : w.health.score >= 55 ? "var(--warning)" : "var(--critical)";

  return (
    <div className="view-enter" style={{ padding: 24, display: "flex", flexDirection: "column", gap: "var(--gap-grid)" }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <a href="#/workstations" className="btn" style={{ padding: "8px 11px" }}><Icon name="collapse" size={15} /> Back</a>
        <span className={`dot ${w.status}`} style={{ width: 11, height: 11 }} />
        <h2 className="display mono" style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-.01em" }}>{w.hostname}</h2>
        <span className={`badge ${w.status}`}>{w.status}</span>
        <span style={{ color: "var(--text-faint)", fontSize: 13 }}>{w.user} · {w.dept}</span>
        <div style={{ flex: 1 }} />
        <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>{off ? `last seen ${window.WMS.relTime(w.lastSeenMin)}` : `up ${window.WMS.uptimeStr(w.uptimeSec)}`}</span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "300px 1fr" }}>
        {/* left column: specs + health */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-grid)" }}>
          <div className="card">
            <div className="card-head"><div className="card-title">Health score</div></div>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ position: "relative", width: 92, height: 92, flex: "none" }}>
                <Gauge value={w.health.score} max={100} style="arc" size={92} thickness={9} color={scoreColor} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span className="mono display" style={{ fontSize: 30, fontWeight: 600, color: scoreColor, lineHeight: 1 }}>{w.health.score}</span>
                  <span className="label" style={{ fontSize: 8.5, marginTop: 2 }}>/ 100</span>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {w.health.factors.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: "var(--healthy)" }}>All metrics nominal.</div>
                ) : w.health.factors.slice(0, 4).map((fa, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 0", borderBottom: i < w.health.factors.length - 1 ? "1px solid var(--hairline)" : "none" }}>
                    <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>{fa.label}</span>
                    <span className={`mono c-${fa.sev}`} style={{ fontSize: 11.5, fontWeight: 600, flex: "none" }}>{fa.delta}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Hardware</div><OSBadge os={w.os} size={15} /></div>
            <SpecRow k="CPU" v={w.cpu.model} />
            <SpecRow k="Cores / Threads" v={`${w.cpu.cores} / ${w.cpu.cores * 2}`} />
            <SpecRow k="Memory" v={`${w.ram.totalGB} GB`} />
            <SpecRow k="GPU" v={w.gpu.model} />
            <SpecRow k="Disk" v={`${w.disk.size} ${w.disk.type}`} />
            <SpecRow k="OS" v={w.os.name} />
            <SpecRow k="IP Address" v={w.ip} />
            <SpecRow k="MAC" v={w.mac} />
          </div>
        </div>

        {/* right column: live metrics + trends */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--gap-grid)" }}>
          {/* CPU with per-core */}
          <div className="card">
            <div className="card-head">
              <div className="card-title">CPU · {w.cpu.cores} cores</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
                <span className="mono display" style={{ fontSize: 26, fontWeight: 600, color: off ? "var(--text-ghost)" : window.loadColor(w.cpu.usage) }}>{off ? "—" : <AnimatedNumber value={w.cpu.usage} />}</span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>% · {Math.round(w.cpu.temp)}°C</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(w.cpu.cores, 12)}, 1fr)`, gap: 5 }}>
              {w.cpu.perCore.map((c, i) => (
                <div key={i} title={`Core ${i} · ${Math.round(c)}%`} style={{ height: 44, background: "var(--card-3)", borderRadius: 4, position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end" }}>
                  <div style={{ width: "100%", height: `${off ? 0 : c}%`, background: window.loadColor(c), transition: "height .4s, background .3s", opacity: .9 }} />
                  <span className="mono" style={{ position: "absolute", bottom: 2, left: 0, right: 0, textAlign: "center", fontSize: 8, color: "var(--text-faint)" }}>{i}</span>
                </div>
              ))}
            </div>
          </div>

          {/* live metric grid */}
          <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
            <LiveMetric icon="memory" label="RAM" value={off ? 0 : w.ram.usedPct} unit="%" sub={`of ${w.ram.totalGB} GB`} />
            <LiveMetric icon="disk" label="Disk" value={w.disk.usedPct} unit="%" color="var(--info)" sub={`${w.disk.readMBs.toFixed(0)}↓ ${w.disk.writeMBs.toFixed(0)}↑ MB/s`} />
            <LiveMetric icon="gpu" label="GPU Load" value={off ? 0 : w.gpu.load} unit="%" color="var(--gpu)" sub={`${Math.round(w.gpu.temp)}°C`} />
            <LiveMetric icon="thermo" label="CPU Temp" value={off ? 0 : w.cpu.temp} unit="°C" max={100} color={w.cpu.temp > 84 ? "var(--critical)" : "var(--warning)"} sub="package" />
            <LiveMetric icon="arrowDown" label="Ethernet In" value={off ? 0 : w.net.ethIn} unit="MB/s" max={125} color="var(--network)" />
            <LiveMetric icon="arrowUp" label="Ethernet Out" value={off ? 0 : w.net.ethOut} unit="MB/s" max={125} color="var(--network)" />
            <LiveMetric icon="download" label="Internet Down" value={off ? 0 : w.net.downMbps} unit="Mb/s" max={w.net.downMax} color="var(--network)" sub={`plan ${w.net.downMax}`} />
            <LiveMetric icon="globe" label="Internet Up" value={off ? 0 : w.net.upMbps} unit="Mb/s" max={w.net.upMax} color="var(--network)" sub={`plan ${w.net.upMax}`} />
          </div>

          {/* trends */}
          <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <div className="card">
              <div className="card-head"><div className="card-title">CPU & RAM · 24h</div></div>
              <LineChart w={400} h={150} yMax={100} labels={xlabels} series={[
                { name: "CPU", data: w.hist.cpu, color: "var(--info)" },
                { name: "RAM", data: w.hist.ram, color: "var(--gpu)" },
              ]} />
            </div>
            <div className="card">
              <div className="card-head"><div className="card-title">Network · 24h</div></div>
              <LineChart w={400} h={150} yMax={100} labels={xlabels} series={[
                { name: "In", data: w.hist.netIn, color: "var(--network)" },
                { name: "Out", data: w.hist.netOut, color: "var(--healthy)" },
              ]} />
            </div>
          </div>

          {/* alert history */}
          <div className="card">
            <div className="card-head"><div className="card-title">Alert history</div><span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{myAlerts.length} events</span></div>
            {myAlerts.length === 0 ? (
              <div style={{ padding: "18px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 12.5 }}>No alerts on record for this device.</div>
            ) : myAlerts.map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--hairline)" : "none" }}>
                <span className={`dot ${a.sev}`} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: "var(--text)" }}>{a.metric} <span style={{ color: "var(--text-faint)" }}>breached {a.threshold}</span></div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>{a.action}</div>
                </div>
                {a.resolved ? <span className="badge healthy">resolved</span> : <span className={`badge ${a.sev}`}>active</span>}
                <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)", width: 64, textAlign: "right" }}>{window.WMS.relTime(a.ageMin)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

window.WorkstationDetail = WorkstationDetail;
