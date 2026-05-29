/* ============================================================
   app.jsx — router, live data loop, shell, tweaks
   ============================================================ */
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "electric",
  "gaugeStyle": "ring",
  "density": "comfortable",
  "speed": 2.5,
  "live": true
}/*EDITMODE-END*/;

function parseRoute() {
  const h = (location.hash || "#/").replace(/^#/, "");
  const parts = h.split("/").filter(Boolean);
  if (parts.length === 0) return { name: "dashboard" };
  if (parts[0] === "workstations" && parts[1]) return { name: "detail", id: parts[1] };
  if (parts[0] === "workstations") return { name: "workstations" };
  if (parts[0] === "alerts") return { name: "alerts" };
  if (parts[0] === "network") return { name: "network" };
  return { name: "dashboard" };
}

const TITLES = {
  dashboard: { t: "Fleet Dashboard", s: "Real-time overview across all monitored workstations" },
  workstations: { t: "Workstations", s: "Every monitored device on the network" },
  detail: { t: "Workstation", s: null },
  alerts: { t: "Alerts Center", s: "Active and resolved threshold breaches" },
  network: { t: "Network View", s: "Topology and health grouped by location" },
};

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = React.useState(parseRoute());
  const [collapsed, setCollapsed] = React.useState(false);
  const [tick, setTick] = React.useState(0);
  const [live, setLive] = React.useState(true);

  // apply palette + density to <html>
  React.useEffect(() => {
    const r = document.documentElement;
    r.classList.toggle("pal-refined", t.palette === "refined");
    r.classList.toggle("density-compact", t.density === "compact");
  }, [t.palette, t.density]);

  // routing
  React.useEffect(() => {
    const onHash = () => { setRoute(parseRoute()); document.querySelector("#scroll")?.scrollTo(0, 0); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // live loop
  React.useEffect(() => {
    if (!live) return;
    const ms = Math.max(700, t.speed * 1000);
    const iv = setInterval(() => { window.WMS.tick(); setTick((x) => x + 1); }, ms);
    return () => clearInterval(iv);
  }, [live, t.speed]);

  const openWs = (id) => { location.hash = `#/workstations/${id}`; };

  const activeNav = route.name === "detail" ? "workstations" : route.name;
  const alertCount = window.WMS.alerts.filter((a) => !a.resolved).length;
  const title = TITLES[route.name];

  let view = null;
  if (route.name === "dashboard") view = <Dashboard tick={tick} gaugeStyle={t.gaugeStyle} onOpen={openWs} />;
  else if (route.name === "workstations") view = <WorkstationList tick={tick} onOpen={openWs} />;
  else if (route.name === "detail") view = <WorkstationDetail id={route.id} tick={tick} gaugeStyle={t.gaugeStyle} onOpen={openWs} />;
  else if (route.name === "alerts") view = <AlertsCenter tick={tick} onOpen={openWs} />;
  else if (route.name === "network") view = <NetworkView tick={tick} onOpen={openWs} />;

  return (
    <div style={{ display: "flex", height: "100vh", position: "relative", zIndex: 1 }}>
      <Sidebar active={activeNav} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} alertCount={alertCount} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title={title.t} subtitle={title.s} live={live} onToggleLive={() => setLive((l) => !l)}>
          <a href="#/alerts" className="btn" style={{ padding: "8px 11px" }}>
            <Icon name="bell" size={16} />
            {alertCount > 0 && <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--critical)" }}>{alertCount}</span>}
          </a>
        </Topbar>
        <div id="scroll" key={route.name + (route.id || "")} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {view}
        </div>
      </div>

      <TweaksPanel>
        <TweakSection label="Palette" />
        <TweakRadio label="Accent set" value={t.palette} options={["electric", "refined"]} onChange={(v) => setTweak("palette", v)} />
        <TweakSection label="Gauges" />
        <TweakRadio label="Gauge style" value={t.gaugeStyle} options={["ring", "arc", "bar"]} onChange={(v) => setTweak("gaugeStyle", v)} />
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density} options={["comfortable", "compact"]} onChange={(v) => setTweak("density", v)} />
        <TweakSection label="Live data" />
        <TweakSlider label="Tick interval" value={t.speed} min={1} max={6} step={0.5} unit="s" onChange={(v) => setTweak("speed", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
