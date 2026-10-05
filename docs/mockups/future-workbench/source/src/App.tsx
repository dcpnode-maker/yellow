import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  BedDouble,
  Bell,
  Bot,
  Box,
  Building2,
  CalendarDays,
  Cable,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Command,
  Cpu,
  CreditCard,
  Database,
  FileDown,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  Headphones,
  House,
  Layers3,
  LayoutDashboard,
  LockKeyhole,
  Megaphone,
  Menu,
  MessageSquareText,
  Mic2,
  Minus,
  Moon,
  MoreHorizontal,
  Network,
  PanelLeftClose,
  Plus,
  ReceiptText,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  TrendingUp,
  Users,
  WandSparkles,
  Workflow,
  X,
  Zap,
} from "lucide-react";

type View = "command" | "rates" | "guest" | "agents" | "architecture";
type Depth = "simple" | "standard" | "expert";
type Theme = "calm" | "midnight" | "pixel";

const navGroups = [
  {
    label: "Operate",
    items: [
      ["command", "Command center", LayoutDashboard],
      ["frontdesk", "Front desk", BedDouble],
      ["reservations", "Reservations", CalendarDays],
      ["housekeeping", "Housekeeping", House],
    ],
  },
  {
    label: "Grow",
    items: [
      ["rates", "Rates & distribution", TrendingUp],
      ["guest", "Guest journey", Users],
      ["crm", "CRM & marketing", Megaphone],
      ["services", "F&B and services", ShoppingBag],
    ],
  },
  {
    label: "Control",
    items: [
      ["finance", "Finance", ReceiptText],
      ["agents", "AI workforce", Bot],
      ["reports", "Intelligence", BarChart3],
      ["architecture", "Architecture brief", Network],
      ["setup", "Property setup", Settings2],
    ],
  },
] as const;

const runStages = [
  { label: "Reading live hotel truth", detail: "Occupancy, arrivals, rates and balances", icon: Database },
  { label: "Coordinating specialist agents", detail: "Revenue, front office, housekeeping and finance", icon: Network },
  { label: "Checking rules and risk", detail: "Authority, policy, compliance and tenant boundaries", icon: ShieldCheck },
  { label: "Preparing your morning brief", detail: "Prioritised actions with explanations and undo paths", icon: WandSparkles },
] as const;

const arrivals = [
  { time: "09:40", guest: "Maya Kapoor", ref: "RES-8142", room: "Deluxe King · 803", status: "Ready", tone: "green" },
  { time: "11:15", guest: "Noah Williams", ref: "RES-8160", room: "Sky Suite · assign", status: "VIP arrival", tone: "gold" },
  { time: "12:30", guest: "Aarav Mehta", ref: "RES-8168", room: "Club Twin · 511", status: "Pickup due", tone: "blue" },
  { time: "14:20", guest: "Elena Rossi", ref: "RES-8191", room: "Deluxe King · 624", status: "ID missing", tone: "red" },
];

const agents = [
  { name: "Revenue", role: "Optimising tonight", metric: "+₹1.8L opportunity", x: "16%", y: "24%" },
  { name: "Front office", role: "Preparing arrivals", metric: "4 need attention", x: "74%", y: "20%" },
  { name: "Housekeeping", role: "Balancing floors", metric: "93% on plan", x: "12%", y: "69%" },
  { name: "Finance", role: "Reconciling activity", metric: "All journals balanced", x: "73%", y: "73%" },
  { name: "Distribution", role: "Watching channels", metric: "12 channels healthy", x: "45%", y: "8%" },
];

const rateModels = [
  { name: "Simple fixed", note: "One clear price with date overrides", cost: "Included", icon: CircleDollarSign },
  { name: "BAR linked", note: "Derived from your flexible public rate", cost: "Included", icon: GitBranch },
  { name: "Smart dynamic", note: "Demand, pace, events and occupancy", cost: "Included AI", icon: Sparkles },
  { name: "Contract", note: "Company, crew, wholesale or long stay", cost: "Included", icon: Building2 },
];

function App() {
  const [view, setView] = useState<View>("command");
  const [depth, setDepth] = useState<Depth>("simple");
  const [theme, setTheme] = useState<Theme>("calm");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [assistantOpen, setAssistantOpen] = useState(() => window.innerWidth > 760);
  const [runStage, setRunStage] = useState(-1);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    if (runStage < 0 || runStage >= runStages.length) return;
    const timer = window.setTimeout(() => setRunStage((stage) => stage + 1), 950);
    return () => window.clearTimeout(timer);
  }, [runStage]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setDrawer(null);
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pageTitle = useMemo(
    () => ({ command: "Command center", rates: "Universal rate studio", guest: "Guest journey", agents: "AI workforce", architecture: "Architecture brief" })[view],
    [view],
  );

  const navigate = (key: string) => {
    if (["command", "rates", "guest", "agents", "architecture"].includes(key)) setView(key as View);
    else setDrawer(`${key}-preview`);
  };

  return (
    <div className={`app theme-${theme} depth-${depth} ${sidebarOpen ? "" : "sidebar-collapsed"}`}>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`} aria-label="Primary navigation">
        <div className="brand-row">
          <button className="brand" onClick={() => setView("command")} aria-label="Open Yellow command center">
            <span className="brand-mark">Y</span>
            {sidebarOpen && <span><strong>Yellow</strong><small>Hospitality OS</small></span>}
          </button>
          <button className="icon-button collapse-button" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}>
            {sidebarOpen ? <PanelLeftClose size={18} /> : <Menu size={18} />}
          </button>
        </div>

        <div className="property-mini">
          <span className="property-logo">AD</span>
          {sidebarOpen && <span><strong>Acme Downtown</strong><small>Dubai · Open</small></span>}
          {sidebarOpen && <ChevronDown size={15} />}
        </div>

        <nav>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              {sidebarOpen && <p>{group.label}</p>}
              {group.items.map(([key, label, Icon]) => {
                const selected = key === view;
                return (
                  <button key={key} className={`nav-item ${selected ? "selected" : ""}`} onClick={() => navigate(key)} title={label}>
                    <Icon size={19} strokeWidth={1.8} />
                    {sidebarOpen && <span>{label}</span>}
                    {sidebarOpen && key === "agents" && <i className="live-dot" aria-label="Agents active" />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <button className="support-card" onClick={() => setDrawer("support")}>
          <span className="support-icon"><Headphones size={18} /></span>
          {sidebarOpen && <span><strong>Yellow support</strong><small>Systems healthy · 24/7</small></span>}
        </button>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="crumb">
            <span>Acme Downtown</span><span>/</span><strong>{pageTitle}</strong>
          </div>
          <button className="command-trigger" onClick={() => setCommandOpen(true)}>
            <Search size={17} /><span>Search, ask, or act…</span><kbd>Ctrl K</kbd>
          </button>
          <div className="top-actions">
            <label className="depth-control">
              <span>Detail</span>
              <select value={depth} onChange={(event) => setDepth(event.target.value as Depth)} aria-label="Interface detail level">
                <option value="simple">Simple</option>
                <option value="standard">Standard</option>
                <option value="expert">Expert</option>
              </select>
            </label>
            <button className="status-pill" onClick={() => setDrawer("health")}><Activity size={15} /><span>All systems healthy</span></button>
            <button className="icon-button" aria-label="Notifications"><Bell size={19} /><i className="notification-dot" /></button>
            <button className="avatar-button" aria-label="Open user menu">AK</button>
          </div>
        </header>

        <main id="main-content" className="main-content">
          {view === "command" && <CommandCenter depth={depth} onRun={() => setRunStage(0)} onOpen={setDrawer} runStage={runStage} />}
          {view === "rates" && <RateStudio depth={depth} onOpen={setDrawer} />}
          {view === "guest" && <GuestJourney depth={depth} onOpen={setDrawer} />}
          {view === "agents" && <AgentWorkforce depth={depth} onRun={() => setRunStage(0)} onOpen={setDrawer} runStage={runStage} />}
          {view === "architecture" && <ArchitectureBrief />}
        </main>
      </div>

      <AssistantRail open={assistantOpen} onToggle={() => setAssistantOpen(!assistantOpen)} onNavigate={setView} />

      <div className="theme-switcher" aria-label="Appearance selector">
        <button className={theme === "calm" ? "active" : ""} onClick={() => setTheme("calm")} aria-label="Apple calm appearance"><Sun size={16} /></button>
        <button className={theme === "midnight" ? "active" : ""} onClick={() => setTheme("midnight")} aria-label="Midnight glass appearance"><Moon size={16} /></button>
        <button className={theme === "pixel" ? "active" : ""} onClick={() => setTheme("pixel")} aria-label="Pixel bright appearance"><Zap size={16} /></button>
      </div>

      {drawer && <DetailDrawer title={drawer} onClose={() => setDrawer(null)} />}
      {commandOpen && <CommandPalette onClose={() => setCommandOpen(false)} onNavigate={(target) => { setView(target); setCommandOpen(false); }} />}
    </div>
  );
}

function CommandCenter({ depth, onRun, onOpen, runStage }: { depth: Depth; onRun: () => void; onOpen: (value: string) => void; runStage: number }) {
  return (
    <div className="page command-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">Sunday · 23 August · Business date open</p>
          <h1>Good morning, Ashish.</h1>
          <p>Your hotel is calm. Four decisions deserve your attention before arrivals build.</p>
        </div>
        <div className="intro-actions">
          <button className="secondary-button" onClick={() => onOpen("shift-handover")}><MessageSquareText size={17} /> Shift handover</button>
          <button className="primary-button" onClick={onRun}><Sparkles size={17} /> Run morning brief</button>
        </div>
      </section>

      <section className="journey-strip" aria-label="Hotel operating journey">
        {([
          ["Sell", "92% forecast", Globe2],
          ["Arrive", "38 today", CalendarDays],
          ["Stay", "214 in-house", BedDouble],
          ["Settle", "₹12.4L open", CreditCard],
          ["Learn", "7 insights", Sparkles],
        ] as const).map(([title, metric, Icon], index) => (
          <button key={String(title)} onClick={() => onOpen(`${String(title).toLowerCase()}-journey`)}>
            <span className="journey-icon"><Icon size={18} /></span>
            <span><strong>{title}</strong><small>{metric}</small></span>
            {index < 4 && <ArrowRight className="journey-arrow" size={15} />}
          </button>
        ))}
      </section>

      <div className="hero-grid">
        <AgentScene runStage={runStage} onRun={onRun} />
        <div className="attention-panel panel">
          <div className="panel-heading"><div><span className="kicker">NOW</span><h2>Needs your attention</h2></div><button className="icon-button" aria-label="More attention options"><MoreHorizontal size={18} /></button></div>
          <button className="attention-item urgent" onClick={() => onOpen("rate-opportunity")}>
            <span className="item-marker"><TrendingUp size={17} /></span><span><strong>Tonight is pricing below demand</strong><small>Revenue agent recommends +8% on Deluxe and Club.</small></span><b>₹1.8L</b>
          </button>
          <button className="attention-item" onClick={() => onOpen("vip-arrival")}>
            <span className="item-marker"><Users size={17} /></span><span><strong>VIP suite remains unassigned</strong><small>Noah Williams arrives at 11:15. Two best-fit rooms ready.</small></span><b>32 min</b>
          </button>
          <button className="attention-item" onClick={() => onOpen("pickup-task")}>
            <span className="item-marker"><Clock3 size={17} /></span><span><strong>Airport pickup needs a driver</strong><small>EK 510 arrival moved 20 minutes earlier.</small></span><b>10:55</b>
          </button>
          {depth !== "simple" && <button className="attention-item" onClick={() => onOpen("credit-review")}>
            <span className="item-marker"><CreditCard size={17} /></span><span><strong>Corporate credit threshold at 86%</strong><small>Acme Global account has three unsettled stays.</small></span><b>Review</b>
          </button>}
        </div>
      </div>

      <section className="metrics-grid" aria-label="Hotel key performance indicators">
        <Metric label="Occupancy" value="87.4%" delta="+4.2 vs forecast" graph={[28, 34, 31, 46, 52, 64, 72]} />
        <Metric label="Room revenue" value="₹18.6L" delta="+7.8% vs last Sunday" graph={[21, 30, 39, 36, 54, 60, 78]} />
        <Metric label="Guest sentiment" value="4.72" delta="96% positive" graph={[48, 45, 54, 59, 62, 68, 72]} />
        <Metric label="Operating readiness" value="94%" delta="6 rooms in progress" graph={[32, 44, 52, 61, 63, 71, 76]} />
      </section>

      <div className="lower-grid">
        <section className="panel arrivals-panel">
          <div className="panel-heading"><div><span className="kicker">NEXT</span><h2>Arrivals in motion</h2></div><button className="text-button" onClick={() => onOpen("all-arrivals")}>View all <ArrowRight size={15} /></button></div>
          <div className="arrival-list">
            {arrivals.map((arrival) => (
              <button key={arrival.ref} className="arrival-row" onClick={() => onOpen(arrival.ref)}>
                <time>{arrival.time}</time><span className="guest-avatar">{arrival.guest.split(" ").map((part) => part[0]).join("")}</span>
                <span className="arrival-main"><strong>{arrival.guest}</strong><small>{arrival.ref} · {arrival.room}</small></span>
                <span className={`badge ${arrival.tone}`}><i />{arrival.status}</span><ArrowRight size={15} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel readiness-panel">
          <div className="panel-heading"><div><span className="kicker">TONIGHT</span><h2>Day-close readiness</h2></div><span className="score-ring">82</span></div>
          <div className="readiness-list">
            <Readiness label="Cashier sessions" value="2 open" progress={76} tone="gold" />
            <Readiness label="Unresolved discrepancies" value="1 room" progress={88} tone="blue" />
            <Readiness label="Unsettled departures" value="₹43,200" progress={68} tone="red" />
            <Readiness label="System integrity" value="All clear" progress={100} tone="green" />
          </div>
          <button className="full-button" onClick={() => onOpen("night-audit")}>Open Night Audit workbench <ArrowRight size={16} /></button>
        </section>
      </div>
      <ManagementLens depth={depth} onOpen={onOpen} />
    </div>
  );
}

function ManagementLens({ depth, onOpen }: { depth: Depth; onOpen: (value: string) => void }) {
  const [lens, setLens] = useState("Market segments");
  const rows = [
    ["Retail transient", "312", "₹42.8L", "₹13,718", "68%", "₹5.1L"],
    ["Corporate negotiated", "184", "₹21.6L", "₹11,739", "54%", "₹3.8L"],
    ["OTA leisure", "146", "₹19.9L", "₹13,630", "72%", "₹2.9L"],
    ["Groups & events", "108", "₹11.4L", "₹10,556", "81%", "₹6.2L"],
  ];
  return <section className="panel management-lens">
    <div className="panel-heading management-head"><div><span className="kicker">MANAGEMENT INTELLIGENCE</span><h2>Ask for any view of the business</h2><p>Rooms, revenue and routed supplements remain reconcilable to the same financial truth.</p></div><button className="voice-button" onClick={() => onOpen("voice-analysis")}><span><MessageSquareText size={18} /></span>“Show who performed best and why”</button></div>
    <div className="lens-toolbar">
      <span>View performance by</span>
      {["Rooms", "Revenue sources", "Market segments", "Segment groups", "Companies", "Travel agents"].map((item) => <button className={lens === item ? "active" : ""} onClick={() => setLens(item)} key={item}>{item}</button>)}
      <button className="add-lens" onClick={() => onOpen("custom-analysis-dimensions")}><Plus size={14} /> Add dimension</button>
    </div>
    <div className="management-body">
      <div className="performance-chart" aria-label={`${lens} room and revenue performance chart`}>
        <div className="chart-y"><span>₹50L</span><span>₹25L</span><span>₹0</span></div>
        <div className="bar-set"><div style={{ height: "82%" }}><i>312 rooms</i><span>Retail</span></div><div style={{ height: "52%" }}><i>184 rooms</i><span>Corporate</span></div><div style={{ height: "44%" }}><i>146 rooms</i><span>OTA</span></div><div style={{ height: "31%" }}><i>108 rooms</i><span>Groups</span></div></div>
        <div className="chart-note"><Sparkles size={15} /><span><strong>Retail led revenue, but Groups led total hotel value</strong><small>₹6.2L of group package value was correctly routed to F&B and events.</small></span></div>
      </div>
      <div className="route-summary">
        <span className="kicker">REVENUE ROUTING</span>
        <div className="routing-donut"><span><strong>₹95.7L</strong><small>Total analysed</small></span></div>
        <div className="route-legend"><span><i className="rooms" />Rooms <b>₹77.7L</b></span><span><i className="fnb" />F&B / meals <b>₹12.4L</b></span><span><i className="other" />Other services <b>₹5.6L</b></span></div>
        <button className="text-button" onClick={() => onOpen("revenue-routing-proof")}>Trace to finance <ArrowRight size={15} /></button>
      </div>
    </div>
    {depth !== "simple" && <div className="management-table" role="table" aria-label={`${lens} performance details`}>
      <div role="row" className="table-head"><span>{lens}</span><span>Rooms sold</span><span>Room revenue</span><span>ADR</span><span>Channel share</span><span>Routed F&B</span></div>
      {rows.map((row) => <button role="row" key={row[0]} onClick={() => onOpen(String(row[0]))}>{row.map((cell) => <span role="cell" key={cell}>{cell}</span>)}</button>)}
    </div>}
    <div className="management-query"><Sparkles size={18} /><label className="sr-only" htmlFor="management-question">Ask a management question</label><input id="management-question" defaultValue="Compare this month’s ADR by company, market segment and room type. Include meal supplements separately." /><button onClick={() => onOpen("generated-management-report")}>Produce view <ArrowRight size={16} /></button></div>
  </section>;
}

function AgentScene({ runStage, onRun }: { runStage: number; onRun: () => void }) {
  const complete = runStage >= runStages.length;
  return (
    <section className={`agent-scene panel ${runStage >= 0 && !complete ? "running" : ""}`}>
      <div className="scene-copy">
        <span className="kicker"><i className="live-dot" /> YELLOW INTELLIGENCE</span>
        <h2>{complete ? "Your morning brief is ready" : runStage >= 0 ? runStages[runStage]?.label : "Your hotel, thinking as one"}</h2>
        <p>{complete ? "Four prioritised actions are ready, each with evidence and a safe execution path." : runStage >= 0 ? runStages[runStage]?.detail : "Every specialist sees the same live truth, works inside your rules, and brings decisions back to you."}</p>
        {complete ? <button className="scene-cta" onClick={onRun}><Check size={17} /> Open brief</button> : runStage < 0 && <button className="scene-cta" onClick={onRun}><Sparkles size={17} /> Watch agents coordinate</button>}
      </div>
      <div className="spatial-stage" aria-label="Animated AI agent network">
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="core-orb"><span>Y</span><i /></div>
        {agents.map((agent, index) => (
          <div className={`agent-node ${runStage === index % runStages.length ? "active" : ""}`} style={{ left: agent.x, top: agent.y }} key={agent.name}>
            <span>{agent.name[0]}</span><div><strong>{agent.name}</strong><small>{agent.role}</small></div>
          </div>
        ))}
        <svg className="connection-map" viewBox="0 0 500 310" preserveAspectRatio="none" aria-hidden="true">
          <path d="M250 150 L95 75 M250 150 L380 66 M250 150 L80 220 M250 150 L375 230 M250 150 L245 28" />
        </svg>
      </div>
      {runStage >= 0 && !complete && <div className="run-progress"><span style={{ width: `${((runStage + 1) / runStages.length) * 100}%` }} /></div>}
    </section>
  );
}

function RateStudio({ depth, onOpen }: { depth: Depth; onOpen: (value: string) => void }) {
  const [selected, setSelected] = useState(2);
  const [step, setStep] = useState(1);
  const [price, setPrice] = useState(12400);
  return (
    <div className="page rate-page">
      <section className="page-intro compact">
        <div><p className="eyebrow">Rates & distribution</p><h1>Build any commercial idea.</h1><p>Start simply. Zoom into every rule only when you need it.</p></div>
        <div className="intro-actions"><button className="secondary-button" onClick={() => onOpen("rate-library")}><Layers3 size={17} /> Rate library</button><button className="primary-button" onClick={() => onOpen("publish-review")}><Check size={17} /> Review & publish</button></div>
      </section>

      <section className="rate-flow panel">
        {[
          ["Create", "Name and intent"], ["Price", "Choose a model"], ["Who gets it", "Commercial access"], ["Where & when", "Scope and rules"], ["Review", "Conflicts and publish"],
        ].map(([name, note], index) => (
          <button key={name} className={step === index ? "active" : step > index ? "done" : ""} onClick={() => setStep(index)}>
            <span>{step > index ? <Check size={15} /> : index + 1}</span><div><strong>{name}</strong><small>{note}</small></div>
          </button>
        ))}
      </section>

      <div className="rate-layout">
        <section className="rate-builder panel">
          <div className="panel-heading"><div><span className="kicker">STEP 2 OF 5</span><h2>How should this rate behave?</h2></div><span className="autosave"><Check size={14} /> Saved</span></div>
          <div className="field-grid two">
            <label><span>Rate name</span><input value="Smart Flexible" readOnly /></label>
            <label><span>Public code</span><input value="SMART-BAR" readOnly /></label>
          </div>
          <div className="model-grid">
            {rateModels.map((model, index) => {
              const Icon = model.icon;
              return <button className={selected === index ? "selected" : ""} key={model.name} onClick={() => setSelected(index)}><span className="model-icon"><Icon size={19} /></span><strong>{model.name}</strong><small>{model.note}</small><em>{model.cost}</em>{selected === index && <i><Check size={13} /></i>}</button>;
            })}
          </div>

          <div className="pricing-sentence">
            <span>Price each room at</span>
            <select aria-label="Pricing base"><option>the best available rate</option><option>a fixed amount</option><option>another rate plan</option></select>
            <span>then let Yellow adjust by</span>
            <select aria-label="Adjustment strategy"><option>demand and booking pace</option><option>occupancy only</option><option>my own rules</option></select>
          </div>

          {depth !== "simple" && <div className="advanced-zone">
            <div className="zone-title"><span><Settings2 size={17} /> Advanced controls</span><small>Visible because Detail is {depth}</small></div>
            <div className="slider-row"><label htmlFor="floor">Floor</label><input id="floor" type="range" min="8000" max="18000" value={price} onChange={(event) => setPrice(Number(event.target.value))} /><b>₹{(price / 100).toFixed(0)}</b></div>
            <div className="rule-chips"><button>Day of week</button><button>Booking window</button><button>Occupancy</button><button>Length of stay</button>{depth === "expert" && <><button>Market segment</button><button>Distribution cost</button><button>CTA / CTD</button><button>Min / max stay</button></>}</div>
          </div>}
        </section>

        <aside className="rate-preview panel">
          <span className="kicker">LIVE EXPLANATION</span><h2>Tonight’s Deluxe King</h2>
          <div className="price-display"><strong>₹14,680</strong><small>per room · before tax</small></div>
          <div className="price-steps"><span><i />Base BAR <b>₹13,800</b></span><span><i />Demand is strong <b>+8%</b></span><span><i />Direct booking reward <b>−₹224</b></span></div>
          <div className="ai-note"><Sparkles size={17} /><p><strong>Why this price?</strong>Pickup is 11% ahead of comparable Sundays and only six Deluxe rooms remain. This stays below your ₹16,200 ceiling.</p></div>
          <div className="compute-note"><Gauge size={16} /><span><strong>Included AI</strong><small>Runs on Yellow shared fabric · no per-call fee</small></span></div>
          <button className="full-button" onClick={() => onOpen("rate-simulation")}>Simulate the next 30 days <ArrowRight size={16} /></button>
        </aside>
      </div>

      <section className="panel calendar-panel">
        <div className="panel-heading"><div><span className="kicker">PREVIEW</span><h2>Price calendar</h2></div><div className="legend"><span><i className="low" />Soft</span><span><i className="medium" />Balanced</span><span><i className="high" />Strong</span></div></div>
        <div className="calendar-grid">
          {Array.from({ length: 14 }, (_, index) => {
            const values = [138, 142, 146, 168, 184, 192, 162, 148, 152, 156, 179, 198, 212, 176];
            return <button key={index} className={values[index]! > 190 ? "high" : values[index]! > 160 ? "medium" : "low"}><small>{23 + index} Aug</small><strong>₹{values[index]!.toLocaleString("en-IN")}00</strong><span>{77 + (index % 5) * 4}% occ.</span></button>;
          })}
        </div>
      </section>
    </div>
  );
}

function GuestJourney({ depth, onOpen }: { depth: Depth; onOpen: (value: string) => void }) {
  const [active, setActive] = useState(2);
  return (
    <div className="page guest-page">
      <section className="page-intro compact"><div><p className="eyebrow">Guest journey</p><h1>One relationship, every moment.</h1><p>See what Maya sees—and what your team needs—without losing context.</p></div><div className="intro-actions"><button className="primary-button" onClick={() => onOpen("new-guest-journey")}><Plus size={17} /> Create journey</button></div></section>
      <section className="guest-profile panel">
        <div className="guest-identity"><span className="large-avatar">MK</span><div><span className="kicker">ARRIVING TODAY · 09:40</span><h2>Maya Kapoor</h2><p>Returning guest · Gold member · Prefers quiet high-floor rooms</p></div></div>
        <div className="guest-value"><span><small>Lifetime stays</small><strong>12</strong></span><span><small>Guest value</small><strong>₹4.8L</strong></span><span><small>Sentiment</small><strong>4.9</strong></span><button className="secondary-button" onClick={() => onOpen("maya-profile")}>Open profile <ArrowRight size={15} /></button></div>
      </section>

      <section className="journey-canvas panel">
        <div className="journey-line" />
        {([
          ["Discover", "Direct website", Globe2], ["Book", "Smart Flexible", CreditCard], ["Prepare", "Preferences ready", Sparkles], ["Arrive", "Room 803", BedDouble], ["Stay", "Services connected", ShoppingBag], ["Depart", "Express checkout", ArrowRight], ["Return", "Personal follow-up", Megaphone],
        ] as const).map(([title, note, Icon], index) => <button key={String(title)} className={active === index ? "active" : index < active ? "complete" : ""} onClick={() => setActive(index)}><span>{index < active ? <Check size={17} /> : <Icon size={18} />}</span><strong>{title}</strong><small>{note}</small></button>)}
      </section>

      <div className="guest-layout">
        <section className="panel moment-card">
          <div className="moment-visual"><div className="room-window"><span /><span /><span /></div><div className="welcome-card"><span className="brand-mark mini">Y</span><p>Welcome back, Maya.<br /><strong>Your room is ready.</strong></p></div></div>
          <div className="moment-copy"><span className="kicker">GUEST VIEW</span><h2>Arrival that feels remembered</h2><p>Early check-in confirmed, high-floor preference honoured, airport pickup tracked, and the registration card prepared.</p><div className="channel-row"><span><MessageSquareText size={16} /> WhatsApp</span><span><Globe2 size={16} /> Guest portal</span><span><CreditCard size={16} /> Wallet</span></div></div>
        </section>
        <section className="panel service-cart">
          <div className="panel-heading"><div><span className="kicker">CONNECTED COMMERCE</span><h2>Everything the hotel offers</h2></div><ShoppingBag size={19} /></div>
          {[
            ["Airport transfer", "Mercedes E-Class · confirmed", "₹2,800"], ["Spa recovery ritual", "Tomorrow · 16:00", "₹4,200"], ["In-room dining", "Saved favourite · Dal Khichdi", "Browse"], ["Late checkout", "Available until 16:00", "₹3,500"],
          ].map(([name, note, value]) => <button key={name} onClick={() => onOpen(name)}><span><strong>{name}</strong><small>{note}</small></span><b>{value}</b><ArrowRight size={15} /></button>)}
          {depth === "expert" && <div className="service-routing"><GitBranch size={16} /><span><strong>Automatic routing</strong><small>Charges post to RES-8142 · Window 1 · guest approval required</small></span></div>}
        </section>
      </div>
    </div>
  );
}

function AgentWorkforce({ depth, onRun, onOpen, runStage }: { depth: Depth; onRun: () => void; onOpen: (value: string) => void; runStage: number }) {
  const roles = ["Revenue manager", "Distribution manager", "Reservations manager", "Front office manager", "Housekeeping manager", "F&B manager", "Finance manager", "Credit manager", "CRM manager", "Success specialist", "Support engineer", "Analyst swarm"];
  return (
    <div className="page agents-page">
      <section className="page-intro compact"><div><p className="eyebrow">AI workforce</p><h1>An expert team that never loses context.</h1><p>Agents advise, simulate and prepare. Authority stays visible and under human control.</p></div><div className="intro-actions"><button className="secondary-button" onClick={() => onOpen("agent-policies")}><ShieldCheck size={17} /> Authority rules</button><button className="primary-button" onClick={onRun}><Network size={17} /> Coordinate agents</button></div></section>

      <div className="agents-layout">
        <AgentScene runStage={runStage} onRun={onRun} />
        <section className="panel fabric-card">
          <span className="kicker">YELLOW AI FABRIC</span><div className="fabric-health"><span><Zap size={20} /></span><div><h2>Included and ready</h2><p>Fast shared intelligence with private hotel memory.</p></div><b>24 ms</b></div>
          <div className="fabric-stack">
            <div><span><Gauge size={17} /></span><p><strong>Smart model router</strong><small>Uses the smallest capable model first</small></p><em>Saving 68%</em></div>
            <div><span><Database size={17} /></span><p><strong>Private hotel memory</strong><small>Encrypted, isolated, exportable and deletable</small></p><em>12,480 facts</em></div>
            <div><span><Network size={17} /></span><p><strong>Shared GPU inference</strong><small>Continuous batching across subscribed hotels</small></p><em>Included</em></div>
            <div><span><LockKeyhole size={17} /></span><p><strong>Optional Yellow Edge</strong><small>Offline/privacy appliance for selected hotels</small></p><em>Standby</em></div>
          </div>
          <button className="full-button" onClick={() => onOpen("ai-fabric")}>Open infrastructure & cost view <ArrowRight size={16} /></button>
        </section>
      </div>

      <section className="panel role-panel">
        <div className="panel-heading"><div><span className="kicker">YOUR DIGITAL TEAM</span><h2>Specialists working from one hotel truth</h2></div><button className="text-button" onClick={() => onOpen("agent-marketplace")}>Configure team <ArrowRight size={15} /></button></div>
        <div className="role-grid">
          {roles.map((role, index) => <button key={role} onClick={() => onOpen(role)}><span className="role-avatar">{role.split(" ").slice(0, 2).map((part) => part[0]).join("")}</span><span><strong>{role}</strong><small>{index % 3 === 0 ? "Working now" : index % 3 === 1 ? "Monitoring" : "Ready"}</small></span><i className={index % 3 === 2 ? "idle" : ""} /></button>)}
        </div>
      </section>

      <div className="learning-grid">
        <section className="panel learning-loop">
          <div className="panel-heading"><div><span className="kicker">SAFE LEARNING LOOP</span><h2>Gets better without absorbing raw guest data</h2></div><ShieldCheck size={20} /></div>
          <div className="loop-flow">
            {[["1", "Observe", "Authorised outcomes"], ["2", "Feedback", "Human edits and reasons"], ["3", "Evaluate", "Private test cases"], ["4", "Improve", "Versioned adapter"], ["5", "Approve", "Roll out or revert"]].map(([n, title, note], index) => <div key={title}><span>{n}</span><strong>{title}</strong><small>{note}</small>{index < 4 && <ArrowRight size={14} />}</div>)}
          </div>
          {depth !== "simple" && <p className="guardrail-note"><LockKeyhole size={15} /> No automatic training on raw production conversations. Every improvement is isolated, evaluated, approved and reversible.</p>}
        </section>
        <section className="panel provider-card">
          <div className="panel-heading"><div><span className="kicker">PROVIDER KNOWLEDGE</span><h2>Always current, never guessed</h2></div><Globe2 size={20} /></div>
          <div className="provider-cloud"><span>Booking.com</span><span>Expedia</span><span>Agoda</span><span>Google Hotel Ads</span><span>Oracle</span><span>Sabre</span><span>SiteMinder</span><span>Stripe</span><span>Adyen</span><span>+ 184 systems</span></div>
          <p>Versioned official documentation, certified connectors and regression tests. Agents declare when knowledge is stale or an action is unsupported.</p>
        </section>
      </div>
    </div>
  );
}

function ArchitectureBrief() {
  const [activeSection, setActiveSection] = useState("context");
  const sections = [
    ["context", "System context"], ["ai", "AI fabric"], ["data", "Data & safety"], ["capacity", "100-hotel capacity"], ["delivery", "Validation plan"],
  ];
  return <div className="page architecture-page">
    <section className="page-intro compact architecture-intro">
      <div><p className="eyebrow">Target-state technical dossier · 23 August 2026</p><h1>Yellow architecture briefing.</h1><p>A review package for product, IT, data, security and AI architects. Assumptions are explicit; unresolved decisions are not disguised as facts.</p></div>
      <div className="intro-actions"><button className="secondary-button" onClick={() => window.print()}><FileDown size={17} /> Print / save PDF</button></div>
    </section>

    <section className="truth-banner">
      <span><ShieldCheck size={20} /></span><div><strong>Prototype versus implementation truth</strong><p>This artifact describes the intended end state. The local repository snapshot used to produce it was <b>main · 61b0fd3</b>, and <code>state.ps1</code> reported Phase 0 cumulative review pending. Reviewers must run the state script and executable proofs from the exact branch they assess.</p></div>
    </section>

    <nav className="architecture-nav" aria-label="Architecture sections">
      {sections.map(([key, label]) => <button className={activeSection === key ? "active" : ""} onClick={() => { setActiveSection(key); document.getElementById(`arch-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} key={key}>{label}</button>)}
    </nav>

    <section id="arch-context" className="architecture-section">
      <div className="section-title"><span>01</span><div><p className="kicker">SYSTEM CONTEXT</p><h2>One operational truth, many human and machine surfaces</h2></div></div>
      <div className="context-map panel">
        <div className="context-column actors"><span className="map-label">People & channels</span>{[[Users, "Hotel staff"], [Building2, "Owners & management"], [Globe2, "Guests & partners"], [Bot, "Yellow agents"]].map(([Icon, label]) => <div key={String(label)}><Icon size={18} /><strong>{String(label)}</strong></div>)}</div>
        <ArrowRight className="context-arrow" size={22} />
        <div className="yellow-platform"><span className="brand-mark">Y</span><h3>Yellow hospitality OS</h3><p>One PWA · one API · one modular monolith</p><div><span>Deep-linked workbenches</span><span>Typed domain contracts</span><span>Outbox events</span><span>Audited actions</span></div></div>
        <ArrowRight className="context-arrow" size={22} />
        <div className="context-column truth"><span className="map-label">Authoritative systems</span><div><Database size={18} /><strong>PostgreSQL 16</strong><small>Hotel and financial truth</small></div><div><Cpu size={18} /><strong>AI inference fabric</strong><small>Advice, not authority</small></div><div><Cable size={18} /><strong>Certified adapters</strong><small>OTAs, payments, statutory</small></div></div>
      </div>
      <div className="architecture-grid three">
        <article className="arch-card"><span><Box size={19} /></span><h3>Application core</h3><p>TypeScript strict, Bun, Elysia, PostgreSQL 16 and a modular monolith. Thirteen bounded contexts expose only typed public surfaces.</p></article>
        <article className="arch-card"><span><Database size={19} /></span><h3>Truth boundary</h3><p>PostgreSQL decides inventory, money and state. Caches, projections and models can accelerate or explain; they cannot legalise an invalid write.</p></article>
        <article className="arch-card"><span><Workflow size={19} /></span><h3>Interaction contract</h3><p>Peek, drawer and workbench replace modal stacks. Every entity is deep-linkable; voice and command palette use the same authorised API.</p></article>
      </div>
      <div className="context-chips"><span>Identity & tenancy</span><span>Inventory & occupancy</span><span>Rates & policies</span><span>Reservations</span><span>Financials</span><span>Stay operations</span><span>Tax & fiscal</span><span>Distribution</span><span>CRM</span><span>Groups</span><span>Extensions</span><span>Reporting</span><span>AI control</span></div>
    </section>

    <section id="arch-ai" className="architecture-section">
      <div className="section-title"><span>02</span><div><p className="kicker">PRIVATE AI FABRIC</p><h2>Fixed-cost intelligence with visible authority</h2></div></div>
      <div className="pipeline panel">
        {[
          [Mic2, "Voice or text", "On-device audio gate"], [MessageSquareText, "Intent compiler", "Known actions avoid a large model"], [LockKeyhole, "Auth & policy", "Tenant, actor, role, approval"], [Database, "Grounding", "Live facts + private hotel memory"], [GitBranch, "Model router", "Smallest capable model"], [ShieldCheck, "Guard & preview", "Evidence, simulation, confirmation"], [Zap, "Domain command", "Typed API executes atomically"], [Activity, "Audit & learn", "Outcome, feedback, safe evaluation"],
        ].map(([Icon, title, note], index) => <div className="pipeline-node" key={String(title)}><span><Icon size={17} /></span><strong>{String(title)}</strong><small>{String(note)}</small>{index < 7 && <ArrowRight size={14} />}</div>)}
      </div>
      <div className="architecture-grid two">
        <article className="panel architecture-detail">
          <div className="panel-heading"><div><p className="kicker">MODEL ROUTING</p><h2>Do not spend 70B reasoning on a room lookup</h2></div><Gauge size={21} /></div>
          <div className="tier-table"><div><span>Deterministic</span><strong>Search, navigation, approved commands</strong><em>Lowest latency</em></div><div><span>Compact model</span><strong>Routine support, summaries, extraction</strong><em>Majority of requests</em></div><div><span>Reasoning model</span><strong>Revenue, finance, planning, exceptions</strong><em>Escalated selectively</em></div><div><span>Human gate</span><strong>High-risk or ambiguous actions</strong><em>Authority preserved</em></div></div>
        </article>
        <article className="panel architecture-detail">
          <div className="panel-heading"><div><p className="kicker">HOTEL-SPECIFIC LEARNING</p><h2>Retrieval first; training only after evidence</h2></div><Sparkles size={21} /></div>
          <div className="learning-stages"><span><b>1</b><p><strong>Private RAG</strong><small>SOPs, configuration, catalogues and authorised facts</small></p></span><span><b>2</b><p><strong>Structured feedback</strong><small>Accepted, edited, rejected and outcome reasons</small></p></span><span><b>3</b><p><strong>Offline evaluation</strong><small>Sanitised holdout cases prevent regression and poisoning</small></p></span><span><b>4</b><p><strong>Versioned adapter</strong><small>Optional tenant LoRA; reversible, exportable, deletable</small></p></span></div>
        </article>
      </div>
      <div className="deployment-map panel">
        <div className="deployment-node primary"><span><Server size={24} /></span><div><p className="kicker">PRIMARY · COLOCATION A</p><h3>2 × GPU inference nodes</h3><small>2 × 96 GB RTX PRO 6000 per node · load balanced · owned by Yellow</small></div></div>
        <div className="deployment-link"><i /><span>Encrypted private backbone</span><i /></div>
        <div className="deployment-node"><span><HardDrive size={24} /></span><div><p className="kicker">PLATFORM DATA PLANE</p><h3>Yellow application cluster</h3><small>PostgreSQL truth, API, outbox, observability and isolated hotel knowledge</small></div></div>
        <div className="deployment-link vertical"><i /><span>Failover / overflow only</span><i /></div>
        <div className="deployment-options"><div><Globe2 size={19} /><span><strong>Secondary cloud GPU</strong><small>Emergency capacity, not normal token billing</small></span></div><div><Box size={19} /><span><strong>Optional Yellow Edge</strong><small>Hotel-local privacy/offline inference</small></span></div></div>
      </div>
    </section>

    <section id="arch-data" className="architecture-section">
      <div className="section-title"><span>03</span><div><p className="kicker">DATA, TENANCY & ACTION SAFETY</p><h2>AI sees only what the authenticated actor may see</h2></div></div>
      <div className="architecture-grid three">
        <article className="arch-card critical"><span><LockKeyhole size={19} /></span><h3>Tenant isolation</h3><p>Transaction-local tenant context, RLS backstop, permission-filtered retrieval, encrypted per-hotel indexes and separately versioned adapters.</p></article>
        <article className="arch-card critical"><span><ShieldCheck size={19} /></span><h3>Action control</h3><p>Models never write databases. They prepare typed commands; the API checks actor, idempotency, state transition, approval and policy before committing.</p></article>
        <article className="arch-card critical"><span><ReceiptText size={19} /></span><h3>Financial truth</h3><p>Revenue reports reconcile to immutable postings. Rooms, F&B, spa and packages retain explicit routing; a user may change presentation, not history.</p></article>
      </div>
      <div className="invariant-board panel">
        <div className="panel-heading"><div><p className="kicker">NON-NEGOTIABLE ENGINE RULES</p><h2>Protected regardless of configuration or AI suggestion</h2></div><ShieldCheck size={22} /></div>
        <div>{["Occupancy writes only through database choke points", "PostgreSQL is authoritative for sellability", "Journal and audit surfaces remain insert-only", "Every journal balances in one currency", "Tenant context is transaction-local", "Money uses integer minor units", "Business dates use property timezone", "No PAN or CVV enters Yellow", "Material state changes write an outbox event", "Indexed JSON follows the defined query contract"].map((rule, index) => <span key={rule}><b>{String(index + 1).padStart(2, "0")}</b>{rule}</span>)}</div>
      </div>
      <div className="risk-grid">
        <div><strong>Prompt injection</strong><p>Separate instructions from retrieved content; allowlisted tools; typed parameters; no model-generated SQL; approval before risky effects.</p></div>
        <div><strong>Training leakage</strong><p>No raw online training. PII sanitisation, tenant-scoped datasets, opt-in global improvement and verifiable deletion.</p></div>
        <div><strong>Support access</strong><p>Time-limited least privilege, redacted diagnostics, sandbox reproduction, reviewed patch, staged release and audited rollback.</p></div>
        <div><strong>AI outage</strong><p>The PMS remains fully operable. Voice and recommendations degrade; check-in, posting, inventory and statutory work do not.</p></div>
      </div>
    </section>

    <section id="arch-capacity" className="architecture-section">
      <div className="section-title"><span>04</span><div><p className="kicker">100-HOTEL CAPACITY HYPOTHESIS</p><h2>Buy against measured concurrency, not customer count</h2></div></div>
      <div className="assumption-strip panel"><div><span>Hotels</span><strong>100</strong><small>Initial target</small></div><div><span>Registered staff</span><strong>2,000</strong><small>Planning assumption</small></div><div><span>Peak active sessions</span><strong>200</strong><small>To be load-tested</small></div><div><span>Sustained generations</span><strong>40–80</strong><small>With batching</small></div><div><span>Capacity reserve</span><strong>30%</strong><small>Failure and growth</small></div></div>
      <div className="architecture-grid two">
        <article className="panel architecture-detail cost-card">
          <div className="panel-heading"><div><p className="kicker">RECOMMENDED STARTING CLUSTER</p><h2>Two nodes, four professional GPUs</h2></div><Server size={22} /></div>
          <ul><li><b>4 ×</b> NVIDIA RTX PRO 6000 Blackwell, 96 GB ECC each</li><li><b>2 ×</b> rack servers with ECC RAM, redundant power and NVMe</li><li><b>1 ×</b> high-availability load balancer and encrypted object backup</li><li><b>Optional</b> separate compact speech workers if voice saturates model GPUs</li></ul>
          <p className="architecture-warning">This configuration is a pre-benchmark hypothesis. Purchase follows a rented equivalent replaying the measured Yellow workload.</p>
        </article>
        <article className="panel architecture-detail cost-card">
          <div className="panel-heading"><div><p className="kicker">PLANNING RANGE · INDIA</p><h2>Fixed-cost service economics</h2></div><CircleDollarSign size={22} /></div>
          <div className="cost-lines"><span><small>Landed cluster capital</small><strong>₹70L–₹1.05Cr</strong></span><span><small>Colocation, power, bandwidth, support</small><strong>₹2L–₹4L / month</strong></span><span><small>36-month cost at 100 hotels</small><strong>≈ ₹5k–₹8k / hotel / month</strong></span></div>
          <p>One shared base-model fleet serves all hotels. Customer data remains isolated in retrieval and adapters; full model copies are not allocated per hotel.</p>
        </article>
      </div>
      <div className="slo-table panel"><div className="table-head"><span>Experience target</span><span>Target SLO</span><span>Fallback behaviour</span><span>Validation</span></div>{[["Command acknowledgement", "< 150 ms", "Immediate local feedback", "Browser timing"], ["Partial voice transcript", "< 500 ms", "Typed command remains available", "Recorded noisy fixtures"], ["Routine answer first token", "< 1.5 s", "Queue position shown", "p95 production replay"], ["Complex analysis first token", "< 5 s", "Progress stages + cancel", "p95 32B/70B replay"], ["Core PMS during AI outage", "100% available", "Manual and deterministic flows", "AI-disabled acceptance suite"]].map((row) => <div key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}</div>
      <div className="source-note"><strong>Hardware basis:</strong> RTX PRO 6000 Server Edition provides 96 GB ECC GDDR7 and up to 1,597 GB/s bandwidth per GPU. NVIDIA currently lists the workstation card at US$13,250; landed system cost remains vendor-quote dependent. <a href="https://www.nvidia.com/en-us/data-center/rtx-pro-6000-blackwell-server-edition/" target="_blank" rel="noreferrer">Technical specification</a> · <a href="https://marketplace.nvidia.com/en-us/enterprise/laptops-workstations/nvidia-rtx-pro-6000-blackwell-workstation-edition/" target="_blank" rel="noreferrer">Reference price</a></div>
    </section>

    <section id="arch-delivery" className="architecture-section">
      <div className="section-title"><span>05</span><div><p className="kicker">VALIDATION & DELIVERY</p><h2>Evidence gates before hardware, training or autonomous action</h2></div></div>
      <div className="rollout panel">
        {[
          ["01", "Instrument", "Capture real command mix, context sizes, voice minutes and peak concurrency from the demo hotel."], ["02", "Benchmark", "Rent equivalent GPUs; replay 2× expected peak with cold/warm runs and 30% reserve."], ["03", "Pilot 5 hotels", "Human approvals on every write; measure correctness, latency, utilisation and support burden."], ["04", "Pilot 25 hotels", "Introduce controlled agent automation, failure drills and colocation failover."], ["05", "Scale to 100", "Purchase/expand only when evidence identifies the bottleneck; keep cloud as emergency overflow."],
        ].map(([number, title, text]) => <div key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></div>)}
      </div>
      <div className="decision-board">
        <div className="panel"><p className="kicker">EXPERT DECISIONS REQUESTED</p><h2>Recommendations needed</h2><ul><li>Peak-concurrency assumptions and voice duty cycle</li><li>RTX PRO versus alternative accelerator benchmark matrix</li><li>Colocation geography, data residency and disaster-recovery region</li><li>Open-model shortlist by role, language and licence</li><li>Tenant adapter lifecycle and deletion proof</li><li>Security review of agent tools and prompt-injection controls</li></ul></div>
        <div className="panel"><p className="kicker">ACCEPTANCE EVIDENCE</p><h2>What must be runnable</h2><ul><li>Fresh database referee and protected-hash verification</li><li>Two-tenant cross-access and retrieved-context isolation tests</li><li>Voice → intent → preview → action end-to-end fixtures</li><li>Model evaluation by role, country and adversarial prompt</li><li>GPU saturation, node-loss and cloud-overflow load tests</li><li>AI-disabled PMS operation and audited rollback drill</li></ul></div>
      </div>
      <footer className="architecture-footer"><span className="brand-mark">Y</span><div><strong>Yellow Hospitality OS · Architecture discussion draft</strong><small>Review the design, challenge the assumptions, and attach executable evidence to every production claim.</small></div></footer>
    </section>
  </div>;
}

function AssistantRail({ open, onToggle, onNavigate }: { open: boolean; onToggle: () => void; onNavigate: (view: View) => void }) {
  return (
    <aside className={`assistant-rail ${open ? "open" : "closed"}`} aria-label="Yellow assistant">
      <button className="assistant-toggle" onClick={onToggle} aria-label={open ? "Close Yellow assistant" : "Open Yellow assistant"}><Sparkles size={19} /></button>
      {open && <>
        <div className="assistant-head"><div><span className="assistant-orb">Y</span><span><strong>Ask Yellow</strong><small>Grounded in live hotel truth</small></span></div><button className="icon-button" onClick={onToggle} aria-label="Close assistant"><X size={17} /></button></div>
        <div className="assistant-body">
          <div className="assistant-message"><span>Y</span><p>Good morning. I found four decisions worth your attention. Nothing urgent is hidden.</p></div>
          <div className="suggestion-list">
            <button onClick={() => onNavigate("command")}><TrendingUp size={16} /><span>Explain tonight’s pricing opportunity</span></button>
            <button onClick={() => onNavigate("guest")}><Users size={16} /><span>Prepare all VIP arrivals</span></button>
            <button onClick={() => onNavigate("rates")}><Gauge size={16} /><span>Build a 3-night offer</span></button>
          </div>
          <div className="assistant-insight"><span className="kicker">WHAT CHANGED</span><p>Pickup accelerated after 06:20 and two competitors closed Deluxe inventory. Your current rate is now 8% below the safe opportunity band.</p><button>Show evidence <ArrowRight size={14} /></button></div>
        </div>
        <form className="assistant-input" onSubmit={(event) => event.preventDefault()}><button type="button" aria-label="Add context"><Plus size={17} /></button><label htmlFor="assistant-prompt" className="sr-only">Ask Yellow</label><input id="assistant-prompt" placeholder="Ask, analyse, or prepare an action…" /><button type="submit" aria-label="Send request"><ArrowRight size={17} /></button></form>
        <div className="assistant-foot"><ShieldCheck size={14} /> Actions require the authority you configure.</div>
      </>}
    </aside>
  );
}

function Metric({ label, value, delta, graph }: { label: string; value: string; delta: string; graph: number[] }) {
  const path = graph.map((point, index) => `${index === 0 ? "M" : "L"} ${index * 20} ${88 - point}`).join(" ");
  return <button className="metric-card" aria-label={`${label}: ${value}. ${delta}`}><span><small>{label}</small><strong>{value}</strong><em>{delta}</em></span><svg viewBox="0 0 120 80" preserveAspectRatio="none" aria-hidden="true"><path d={path} /></svg></button>;
}

function Readiness({ label, value, progress, tone }: { label: string; value: string; progress: number; tone: string }) {
  return <div className="readiness-row"><span><strong>{label}</strong><small>{value}</small></span><div><i className={tone} style={{ width: `${progress}%` }} /></div></div>;
}

function DetailDrawer({ title, onClose }: { title: string; onClose: () => void }) {
  const clean = title.replace(/-/g, " ");
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="detail-drawer" role="dialog" aria-modal="true" aria-label={`${clean} detail`}><div className="drawer-head"><div><span className="kicker">LIVE CONTEXT</span><h2>{clean.replace(/\b\w/g, (letter) => letter.toUpperCase())}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close detail"><X size={19} /></button></div><div className="drawer-hero"><span><Sparkles size={24} /></span><h3>This opens without losing your place.</h3><p>In the completed Yellow app this drawer will show the live entity, authorised actions, audit history and the exact reason behind every recommendation.</p></div><div className="drawer-facts"><div><span>Data source</span><strong>Live PostgreSQL truth</strong></div><div><span>Last verified</span><strong>Just now</strong></div><div><span>Authority</span><strong>Founder approval</strong></div></div><div className="drawer-timeline"><span><i /><p><strong>Yellow analysed the current state</strong><small>Tenant-scoped facts only</small></p></span><span><i /><p><strong>Policy and risk checks passed</strong><small>No compliance boundary crossed</small></p></span><span><i /><p><strong>Action is ready for your review</strong><small>Nothing has been changed yet</small></p></span></div><div className="drawer-actions"><button className="secondary-button" onClick={onClose}>Not now</button><button className="primary-button"><Check size={16} /> Review action</button></div></aside></div>;
}

function CommandPalette({ onClose, onNavigate }: { onClose: () => void; onNavigate: (view: View) => void }) {
  return <div className="command-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><div className="palette-search"><Search size={20} /><label htmlFor="command-search" className="sr-only">Search commands</label><input id="command-search" autoFocus placeholder="Ask anything or jump anywhere…" /><kbd>Esc</kbd></div><div className="palette-body"><span className="kicker">SUGGESTED</span>{[["command", "Show today’s hotel command center", LayoutDashboard], ["rates", "Build or change a rate plan", TrendingUp], ["guest", "Find a guest or reservation", Users], ["agents", "Coordinate the AI workforce", Bot]].map(([target, label, Icon]) => <button key={String(target)} onClick={() => onNavigate(target as View)}><span><Icon size={18} /></span><strong>{String(label)}</strong><kbd>↵</kbd></button>)}</div><div className="palette-foot"><span><Command size={14} /> Natural language and keyboard use the same safe action pipeline.</span></div></section></div>;
}

export default App;
