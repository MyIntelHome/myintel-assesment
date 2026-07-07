import { useState, useCallback } from "react";

// ─── DATA ───────────────────────────────────────────────────────────────────

const ROOMS = [
  {
    id: "entryway", label: "Entryway", icon: "🚪",
    items: [
      { id: "e1", name: "Door threshold", hint: "Raised vs flush — trip hazard present?" },
      { id: "e2", name: "Entry lighting", hint: "Adequate brightness at night?" },
      { id: "e3", name: "Non-slip surface at entry", hint: "Mat secured, flush tile, or textured?" },
      { id: "e4", name: "Step / ramp condition", hint: "Stable, no cracks or frost heaving?" },
      { id: "e5", name: "Handrails at steps", hint: "Present, graspable, anchored securely?" },
      { id: "e6", name: "Door hardware", hint: "Lever vs round knob — operable one-handed?" },
      { id: "e7", name: "Visible house numbers", hint: "Emergency responders can locate quickly?" },
    ],
    recs: ["Non-Slip Entry Mat","Handrail Installation","Threshold Ramp","Motion-Sensor Light","Smart Doorbell","Lever Door Handle","Illuminated House Numbers"],
  },
  {
    id: "living", label: "Living Room", icon: "🛋️",
    items: [
      { id: "l1", name: "Throw rugs / loose mats", hint: "Unsecured rugs — trip hazard?" },
      { id: "l2", name: "Furniture pathway clearance", hint: ">24\" clear paths between pieces?" },
      { id: "l3", name: "Lighting adequacy", hint: "Bright enough, switches accessible?" },
      { id: "l4", name: "Power cord management", hint: "Cords crossing walking paths?" },
      { id: "l5", name: "Chair/sofa transfer height", hint: "Appropriate for safe sit-to-stand?" },
      { id: "l6", name: "Emergency device accessible", hint: "Phone/alert within reach from seating?" },
      { id: "l7", name: "Fall detection coverage", hint: "Sensor or wearable alert device present?" },
    ],
    recs: ["Remove Throw Rugs","Furniture Rearrangement","Traction Pads for Chairs","Smart Lighting","Fall Detection Sensor","Echo Show / Smart Display","Cord Covers","Chair Lift Assist Rail"],
  },
  {
    id: "kitchen", label: "Kitchen", icon: "🍳",
    items: [
      { id: "k1", name: "Flooring slip resistance", hint: "Wet floor risk — surface texture adequate?" },
      { id: "k2", name: "Cabinet/shelf reach zones", hint: "Frequently used items within safe reach?" },
      { id: "k3", name: "Counter clearance", hint: "Workspace clear, stable for support if needed?" },
      { id: "k4", name: "Stove control placement", hint: "Front vs rear controls — burn/lean risk?" },
      { id: "k5", name: "Smoke / CO detectors", hint: "Present, functional, dated?" },
      { id: "k6", name: "Task lighting", hint: "Adequate lighting over work surfaces?" },
      { id: "k7", name: "Step stool use", hint: "Using a rated stool vs unsafe substitute?" },
    ],
    recs: ["Non-Slip Kitchen Mat","Reorganize Cabinet Reach","Smart Stove Shutoff","Cabinet Pull Handles","Under-Cabinet Lighting","Smoke Detector Upgrade","Grab Bar at Counter"],
  },
  {
    id: "stairs", label: "Stairs", icon: "🪜",
    items: [
      { id: "s1", name: "Handrails — both sides", hint: "Continuous, graspable, anchored?" },
      { id: "s2", name: "Stair tread condition", hint: "Worn, loose, or smooth surface risk?" },
      { id: "s3", name: "Tread edge contrast", hint: "Visible contrast — adequate for low vision?" },
      { id: "s4", name: "Lighting at top and bottom", hint: "Switch accessible from both landings?" },
      { id: "s5", name: "Clear stair width", hint: "Min 36\" for safe navigation?" },
      { id: "s6", name: "Clutter on stairs", hint: "Items stored on treads?" },
      { id: "s7", name: "Stair lift evaluation", hint: "Clinically appropriate to assess?" },
    ],
    recs: ["Non-Slip Stair Treads","Stair Edge Contrast Tape","Handrail Extension","Automatic Stair Lighting","Stair Lift Referral","Clear Stair Clutter"],
  },
  {
    id: "bathroom", label: "Primary Bathroom", icon: "🚿",
    items: [
      { id: "b1", name: "Grab bars at toilet", hint: "Properly anchored, correct height?" },
      { id: "b2", name: "Grab bars in shower/tub", hint: "Entry, back wall, and side wall?" },
      { id: "b3", name: "Non-slip in shower/tub", hint: "Mat secured or textured surface?" },
      { id: "b4", name: "Shower seat / bench", hint: "Present and rated for client weight?" },
      { id: "b5", name: "Toilet height", hint: "Standard vs comfort height — transfer risk?" },
      { id: "b6", name: "Night light path", hint: "Path lit from bedroom to toilet at night?" },
      { id: "b7", name: "Faucet controls", hint: "Lever vs knob, anti-scald protection?" },
      { id: "b8", name: "Floor when wet", hint: "Slip hazard exiting shower onto floor?" },
    ],
    recs: ["Grab Bar Installation","Fold-Down Shower Seat","Raised Toilet Seat","Non-Slip Bath Mat","Automatic Night Light","Handheld Showerhead","Anti-Scald Valve","MyIntel Motion Sensor (Bathroom)"],
  },
  {
    id: "bedroom", label: "Primary Bedroom", icon: "🛏️",
    items: [
      { id: "br1", name: "Bed height for transfer", hint: "Appropriate height for safe sit-to-stand?" },
      { id: "br2", name: "Path to bathroom clear", hint: "Furniture-free nighttime route?" },
      { id: "br3", name: "Night lighting / switch reach", hint: "Light switch or sensor accessible from bed?" },
      { id: "br4", name: "Emergency device in reach", hint: "Phone or alert device reachable from bed?" },
      { id: "br5", name: "Bed rail / assist device", hint: "Support for bed mobility and transfer?" },
      { id: "br6", name: "Clutter / equipment mgmt", hint: "O2 tanks, cords creating trip hazard?" },
      { id: "br7", name: "Closet accessibility", hint: "Safe reach — no step stool needed?" },
    ],
    recs: ["Bed Cane / Rail","Automatic Night Light","Bedside Phone / Alert Device","MyIntel Motion Sensor (Bedroom)","O2 Equipment Repositioning","Closet Organization","Bed Height Adjustment"],
  },
  {
    id: "exterior", label: "Exterior", icon: "🏡",
    items: [
      { id: "ex1", name: "Pathway condition", hint: "Cracks, uneven surfaces, frost heaving?" },
      { id: "ex2", name: "Exterior lighting", hint: "Motion-activated, adequate coverage?" },
      { id: "ex3", name: "Driveway / parking surface", hint: "Safe surface, fall risk?" },
      { id: "ex4", name: "Exterior handrails", hint: "All steps have sturdy rails?" },
      { id: "ex5", name: "Mailbox accessibility", hint: "Safe path and reach to mailbox?" },
      { id: "ex6", name: "Entry ramp condition", hint: "Non-slip, stable, correct slope?" },
    ],
    recs: ["Pathway Repair","Motion-Sensor Exterior Lights","Exterior Handrail","Entry Ramp","Mailbox Relocation"],
  },
];

const CONCERNS = [
  { id: "neuro", label: "Neurological Issues" },
  { id: "falls", label: "History of Falls" },
  { id: "visual", label: "Visual Deficits" },
  { id: "cognitive", label: "Cognitive Changes" },
  { id: "cardiac", label: "Cardiac / Cardiopulmonary" },
  { id: "mobility", label: "Mobility Impairment" },
  { id: "pain", label: "Chronic Pain" },
  { id: "meds", label: "High-Risk Medications" },
];

const PAGES = ["intake", ...ROOMS.map(r => r.id), "report"];

// ─── HELPERS ────────────────────────────────────────────────────────────────

function getRoomScore(roomData, roomDef) {
  if (!roomDef?.items) return null;
  const total = roomDef.items.length;
  const rated = roomDef.items.filter(i => roomData.items[i.id] !== undefined).length;
  const passed = roomDef.items.filter(i => roomData.items[i.id] === "pass").length;
  const flags = roomDef.items.filter(i => roomData.items[i.id] === "flag").length;
  const warnings = roomDef.items.filter(i => roomData.items[i.id] === "warn").length;
  const accessScore = total > 0 ? Math.round((passed / total) * 100) : 0;
  return { accessScore, flags, warnings, passed, rated, total };
}

function scoreColor(val) {
  if (val >= 75) return "#10B981";
  if (val >= 50) return "#F59E0B";
  return "#EF4444";
}

function statusForRoom(roomData, roomDef) {
  const s = getRoomScore(roomData, roomDef);
  if (!s || s.rated === 0) return "idle";
  if (s.flags > 0) return "flagged";
  if (s.warnings > 0) return "warned";
  if (s.rated === s.total) return "done";
  return "partial";
}

const initRoom = () => ({
  items: {}, safetyRating: 80,
  recs: [], notes: "", photos: [],
  aiFindings: null, aiLoading: false,
});

// ─── AI CALL ────────────────────────────────────────────────────────────────
// The API key never touches the browser. This posts the photos to our own
// serverless endpoint (api/analyze.js), which calls Claude server-side.

async function analyzePhotos(roomLabel, photos) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomLabel,
      photos: photos.slice(0, 3).map(p => ({ mimeType: p.mimeType, data: p.data })),
    }),
  });

  if (!response.ok) throw new Error(`API error ${response.status}`);
  return await response.json();
}

// ─── STYLES ─────────────────────────────────────────────────────────────────

const S = {
  app: { display: "flex", height: "100vh", fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14, color: "#1A2332", background: "#F0F4F8", overflow: "hidden" },
  sidebar: { width: 230, background: "#fff", borderRight: "1px solid #DCE5EF", display: "flex", flexDirection: "column", overflowY: "auto", flexShrink: 0 },
  sidebarHeader: { padding: "16px 16px 8px", background: "#1B3A5C", color: "white" },
  logoMark: { width: 28, height: 28, background: "linear-gradient(135deg,#38BDF8,#0EA5E9)", borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white", marginRight: 8 },
  logoText: { fontWeight: 700, fontSize: 14, color: "white", letterSpacing: -0.3 },
  logoSub: { fontSize: 10, color: "#94A3B8" },
  main: { flex: 1, overflowY: "auto", padding: "24px 28px" },
  pageTitle: { fontFamily: "Georgia, serif", fontSize: 24, color: "#1B3A5C", fontWeight: 400, marginBottom: 4 },
  pageSub: { fontSize: 13, color: "#64748B", marginBottom: 24 },
  card: { background: "#fff", border: "1px solid #DCE5EF", borderRadius: 12, padding: "18px 20px", marginBottom: 16 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: "#1B3A5C", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 },
  label: { fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748B", marginBottom: 4, display: "block" },
  input: { border: "1px solid #DCE5EF", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, color: "#1A2332", background: "white", width: "100%", outline: "none", boxSizing: "border-box" },
  textarea: { border: "1px solid #DCE5EF", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, color: "#1A2332", background: "white", width: "100%", resize: "vertical", minHeight: 80, outline: "none", boxSizing: "border-box" },
  select: { border: "1px solid #DCE5EF", borderRadius: 8, padding: "8px 10px", fontFamily: "inherit", fontSize: 13, color: "#1A2332", width: "100%", background: "white", outline: "none" },
  btn: (variant) => ({
    padding: variant === "sm" ? "6px 14px" : "9px 20px",
    borderRadius: 8,
    fontFamily: "inherit",
    fontSize: variant === "sm" ? 12 : 13,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    transition: "all 0.15s",
  }),
};

// ─── COMPONENTS ─────────────────────────────────────────────────────────────

function NavItem({ label, icon, status, active, score, onClick }) {
  const dotColor = { idle: "#CBD5E1", partial: "#94A3B8", done: "#10B981", flagged: "#EF4444", warned: "#F59E0B" }[status];
  const bg = active ? "#E0F2FE" : "transparent";
  const labelColor = active ? "#0891B2" : "#64748B";
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: bg, marginBottom: 2, transition: "background 0.15s" }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0, transition: "background 0.2s" }} />
      <span style={{ fontSize: 13, color: labelColor, fontWeight: active ? 600 : 400, flex: 1 }}>{icon} {label}</span>
      {score !== null && score !== undefined && (
        <span style={{ fontSize: 10, fontWeight: 700, color: score >= 75 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444" }}>{score}%</span>
      )}
    </div>
  );
}

function RatingBtn({ label, variant, active, onClick }) {
  const colors = { pass: { bg: "#10B981", border: "#10B981" }, warn: { bg: "#F59E0B", border: "#F59E0B" }, flag: { bg: "#EF4444", border: "#EF4444" } };
  const c = colors[variant];
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
      background: active ? c.bg : "white", color: active ? "white" : "#64748B",
      border: `1px solid ${active ? c.border : "#DCE5EF"}`, transition: "all 0.15s",
    }}>{label}</button>
  );
}

function Tag({ label, selected, onClick }) {
  return (
    <div onClick={onClick} style={{
      padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
      background: selected ? "#1B3A5C" : "white", color: selected ? "white" : "#64748B",
      border: `1px solid ${selected ? "#1B3A5C" : "#DCE5EF"}`, transition: "all 0.15s", userSelect: "none",
    }}>{selected ? "✓ " : "+ "}{label}</div>
  );
}

function AIPanel({ aiFindings, aiLoading, showSensors }) {
  if (!aiLoading && !aiFindings) return null;
  return (
    <div style={{ background: "linear-gradient(135deg,#0F1E35,#1B3A5C)", borderRadius: 10, padding: 16, marginTop: 12, color: "white" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#38BDF8", animation: "pulse 2s infinite" }} />
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#38BDF8" }}>AI Safety Analysis</span>
      </div>
      {aiLoading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#94A3B8", fontSize: 12 }}>
          <div style={{ width: 16, height: 16, border: "2px solid rgba(56,189,248,0.3)", borderTopColor: "#38BDF8", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Analyzing photos for safety hazards...
        </div>
      ) : (
        <>
          {(aiFindings.findings || []).length === 0 && (
            <div style={{ fontSize: 12, color: "#94A3B8" }}>No significant hazards detected. Continue with manual checklist.</div>
          )}
          {(aiFindings.findings || []).map((f, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, padding: "8px 10px", borderRadius: 7, marginBottom: 6, fontSize: 12, alignItems: "flex-start",
              background: f.severity === "danger" ? "rgba(239,68,68,0.15)" : f.severity === "warning" ? "rgba(245,158,11,0.15)" : "rgba(8,145,178,0.15)",
              borderLeft: `2px solid ${f.severity === "danger" ? "#EF4444" : f.severity === "warning" ? "#F59E0B" : "#38BDF8"}`,
            }}>
              <span>{f.severity === "danger" ? "🔴" : f.severity === "warning" ? "🟡" : "🔵"}</span>
              <span style={{ color: "#E2E8F0", lineHeight: 1.4 }}>{f.text}</span>
            </div>
          ))}
          {showSensors && (aiFindings.myintel || []).length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 7, background: "rgba(56,189,248,0.12)", border: "1px solid rgba(56,189,248,0.2)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#38BDF8", marginBottom: 6 }}>MyIntel Sensor Recommendations</div>
              {aiFindings.myintel.map((m, i) => <div key={i} style={{ fontSize: 11, color: "#BAE6FD", marginBottom: 3 }}>→ {m}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState("intake");
  const [mode, setMode] = useState("myintel"); // "myintel" | "standard"
  const [client, setClient] = useState({ name: "", dob: "", address: "", housing: "Single Family", floors: "1", veteran: "", tenant: "Owner", hoa: "No", livesWith: "", height: "", weight: "", assistive: "", referred: "", inaccessible: "" });
  const [fallInfo, setFallInfo] = useState({ injury: "No", hospital: "No", rehab: "No", where: "", room: "", cause: "", notes: "" });
  const [concerns, setConcerns] = useState({});
  const [concernNotes, setConcernNotes] = useState({});
  const [rooms, setRooms] = useState(() => Object.fromEntries(ROOMS.map(r => [r.id, initRoom()])));
  const [assessor, setAssessor] = useState({ name: "", org: "" });
  const [activeTab, setActiveTab] = useState({});

  const updateRoom = useCallback((id, updater) => {
    setRooms(prev => ({ ...prev, [id]: updater(prev[id]) }));
  }, []);

  const handlePhotos = useCallback(async (roomId, files) => {
    const loaded = await Promise.all(Array.from(files).map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = e => res({ url: e.target.result, mimeType: f.type, data: e.target.result.split(",")[1], name: f.name });
      r.readAsDataURL(f);
    })));

    updateRoom(roomId, prev => ({ ...prev, photos: [...prev.photos, ...loaded], aiLoading: true }));

    try {
      const allPhotos = [...rooms[roomId].photos, ...loaded];
      const roomDef = ROOMS.find(r => r.id === roomId);
      const result = await analyzePhotos(roomDef?.label || roomId, allPhotos);
      updateRoom(roomId, prev => ({ ...prev, aiFindings: result, aiLoading: false }));
    } catch {
      const msg = "Photos saved. AI analysis is unavailable right now — complete the checklist assessment manually.";
      updateRoom(roomId, prev => ({ ...prev, aiFindings: { findings: [{ severity: "info", text: msg }], myintel: [] }, aiLoading: false }));
    }
  }, [rooms, updateRoom]);

  // Overall progress
  let totalItems = 0, ratedItems = 0, flaggedTotal = 0, passedTotal = 0;
  ROOMS.forEach(r => {
    const rd = rooms[r.id];
    r.items.forEach(item => {
      totalItems++;
      const v = rd.items[item.id];
      if (v) { ratedItems++; if (v === "pass") passedTotal++; if (v === "flag") flaggedTotal++; }
    });
  });
  const progress = totalItems > 0 ? Math.round((ratedItems / totalItems) * 100) : 0;
  const overallAccess = totalItems > 0 ? Math.round((passedTotal / totalItems) * 100) : 0;

  const pageIdx = PAGES.indexOf(page);

  return (
    <div className="mi-app" style={S.app}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        input:focus,select:focus,textarea:focus { border-color: #0891B2 !important; outline: none; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
        @media (max-width: 768px) {
          .mi-app { flex-direction: column !important; height: auto !important; min-height: 100vh; overflow: visible !important; }
          .mi-sidebar { width: 100% !important; border-right: none !important; border-bottom: 1px solid #DCE5EF; overflow: visible !important; }
          .mi-nav { display: flex !important; overflow-x: auto; padding: 8px !important; }
          .mi-nav > * { flex-shrink: 0; }
          .mi-nav-label, .mi-sep, .mi-stats { display: none !important; }
          .mi-main { padding: 16px !important; overflow: visible !important; }
          .mi-grid3 { grid-template-columns: 1fr 1fr !important; }
          .mi-grid2 { grid-template-columns: 1fr !important; }
          .mi-roomgrid { grid-template-columns: 1fr !important; }
          .mi-hero { flex-direction: column !important; align-items: flex-start !important; gap: 14px !important; }
          .mi-roomrow { flex-wrap: wrap !important; }
        }
        @media print {
          body { background: white !important; }
          .mi-app { display: block !important; height: auto !important; overflow: visible !important; }
          .mi-sidebar, .no-print { display: none !important; }
          .mi-main { overflow: visible !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* SIDEBAR */}
      <div className="mi-sidebar" style={S.sidebar}>
        <div style={S.sidebarHeader}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={S.logoMark}>{mode === "myintel" ? "MI" : "OT"}</div>
            <div>
              <div style={S.logoText}>{mode === "myintel" ? "MyIntel" : "Home Safety"}</div>
              <div style={S.logoSub}>OT Assessment Tool</div>
            </div>
          </div>
          {/* Progress */}
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#94A3B8", marginBottom: 6 }}>Assessment Progress</div>
          <div style={{ height: 4, background: "rgba(255,255,255,0.15)", borderRadius: 4, overflow: "hidden", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg,#38BDF8,#0EA5E9)", borderRadius: 4, transition: "width 0.4s" }} />
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>{progress}% complete</div>
        </div>

        <div className="mi-nav" style={{ padding: "12px 10px 8px" }}>
          <div className="mi-nav-label" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#94A3B8", padding: "0 8px", marginBottom: 6 }}>Sections</div>
          <NavItem label="Client Intake" icon="👤" status={client.name ? "done" : "idle"} active={page === "intake"} onClick={() => setPage("intake")} />
          <div className="mi-sep" style={{ height: 1, background: "#F0F4F8", margin: "8px 0" }} />
          {ROOMS.map(r => {
            const s = getRoomScore(rooms[r.id], r);
            return (
              <NavItem key={r.id} label={r.label} icon={r.icon}
                status={statusForRoom(rooms[r.id], r)}
                active={page === r.id}
                score={s && s.rated > 0 ? s.accessScore : null}
                onClick={() => setPage(r.id)} />
            );
          })}
          <div className="mi-sep" style={{ height: 1, background: "#F0F4F8", margin: "8px 0" }} />
          <NavItem label="Assessment Report" icon="📋" status={progress > 0 ? "partial" : "idle"} active={page === "report"} onClick={() => setPage("report")} />
        </div>

        {/* Quick stats */}
        <div className="mi-stats" style={{ margin: "auto 0 0", padding: "12px 14px", borderTop: "1px solid #F0F4F8" }}>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1, background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#10B981" }}>{overallAccess}%</div>
              <div style={{ fontSize: 9, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Accessibility</div>
            </div>
            <div style={{ flex: 1, background: flaggedTotal > 0 ? "#FEF2F2" : "#ECFDF5", border: `1px solid ${flaggedTotal > 0 ? "#FECACA" : "#A7F3D0"}`, borderRadius: 8, padding: "8px 6px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: flaggedTotal > 0 ? "#EF4444" : "#10B981" }}>{flaggedTotal}</div>
              <div style={{ fontSize: 9, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>Flags</div>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="mi-main" style={S.main}>
        {page === "intake" && <IntakePage mode={mode} setMode={setMode} client={client} setClient={setClient} fallInfo={fallInfo} setFallInfo={setFallInfo} concerns={concerns} setConcerns={setConcerns} concernNotes={concernNotes} setConcernNotes={setConcernNotes} assessor={assessor} setAssessor={setAssessor} onNext={() => setPage(ROOMS[0].id)} />}
        {ROOMS.map(r => page === r.id && (
          <RoomPage key={r.id} mode={mode} roomDef={r} roomData={rooms[r.id]} updateRoom={(fn) => updateRoom(r.id, fn)} onPhotos={(files) => handlePhotos(r.id, files)} activeTab={activeTab[r.id] || "checklist"} setActiveTab={(t) => setActiveTab(prev => ({ ...prev, [r.id]: t }))} onPrev={() => setPage(PAGES[pageIdx - 1])} onNext={() => setPage(PAGES[pageIdx + 1])} pageIdx={pageIdx} totalPages={PAGES.length} />
        ))}
        {page === "report" && <ReportPage mode={mode} rooms={rooms} client={client} fallInfo={fallInfo} concerns={concerns} concernNotes={concernNotes} assessor={assessor} onPrev={() => setPage(PAGES[pageIdx - 1])} />}
      </div>
    </div>
  );
}

// ─── INTAKE PAGE ─────────────────────────────────────────────────────────────

function IntakePage({ mode, setMode, client, setClient, fallInfo, setFallInfo, concerns, setConcerns, concernNotes, setConcernNotes, assessor, setAssessor, onNext }) {
  const uc = (f, v) => setClient(p => ({ ...p, [f]: v }));
  const uf = (f, v) => setFallInfo(p => ({ ...p, [f]: v }));

  return (
    <div>
      <div style={S.pageTitle}>Client Intake</div>
      <div style={S.pageSub}>Capture client background, fall history, and clinical concerns before beginning room assessments.</div>

      {/* Assessment Type */}
      <div style={S.card}>
        <div style={S.cardTitle}>📋 Assessment Type</div>
        <div className="mi-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { id: "myintel", label: "MyIntel Assessment", desc: "Includes MyIntel / Talius smart sensor recommendations in room pages and the final report." },
            { id: "standard", label: "Standard OT Assessment", desc: "General home safety assessment. Sensor integration sections are hidden and the report stays neutral." },
          ].map(opt => (
            <div key={opt.id} onClick={() => setMode(opt.id)} style={{
              padding: "12px 14px", borderRadius: 10, cursor: "pointer", transition: "all 0.15s",
              border: `2px solid ${mode === opt.id ? "#0891B2" : "#DCE5EF"}`,
              background: mode === opt.id ? "#F0F9FF" : "white",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", border: `2px solid ${mode === opt.id ? "#0891B2" : "#CBD5E1"}`, background: mode === opt.id ? "#0891B2" : "white", boxShadow: mode === opt.id ? "inset 0 0 0 2.5px white" : "none", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: mode === opt.id ? "#0891B2" : "#1A2332" }}>{opt.label}</span>
              </div>
              <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>{opt.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Info */}
      <div style={S.card}>
        <div style={S.cardTitle}>👤 Client Information</div>
        <div className="mi-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[["name","Client Name","Full name"],["dob","Date of Birth",null,"date"],["address","Address","Street address"],["referred","Referred By","Family, physician..."]].map(([f,lbl,ph,t]) => (
            <div key={f}>
              <label style={S.label}>{lbl}</label>
              <input type={t||"text"} style={S.input} value={client[f]} placeholder={ph||""} onChange={e => uc(f, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      {/* Housing */}
      <div style={S.card}>
        <div style={S.cardTitle}>🏠 Housing Profile</div>
        <div className="mi-grid3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Housing Type</label>
            <select style={S.select} value={client.housing} onChange={e => uc("housing", e.target.value)}>
              {["Single Family","Condo","Apartment","Mobile Home","Assisted Living","Townhome"].map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Floors</label>
            <input type="number" min="1" max="5" style={S.input} value={client.floors} onChange={e => uc("floors", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Tenant Type</label>
            <select style={S.select} value={client.tenant} onChange={e => uc("tenant", e.target.value)}>
              {["Owner","Renter","Family Home"].map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Veteran</label>
            <select style={S.select} value={client.veteran} onChange={e => uc("veteran", e.target.value)}>
              <option value="">Select</option>
              <option>Yes</option><option>No</option>
            </select>
          </div>
          <div>
            <label style={S.label}>Lives With</label>
            <input style={S.input} value={client.livesWith} placeholder="Alone, Spouse..." onChange={e => uc("livesWith", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>HOA</label>
            <select style={S.select} value={client.hoa} onChange={e => uc("hoa", e.target.value)}>
              {["No","Yes","N/A"].map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Height</label>
            <input style={S.input} value={client.height} placeholder={`5'7"`} onChange={e => uc("height", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Weight</label>
            <input style={S.input} value={client.weight} placeholder="155 lbs" onChange={e => uc("weight", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Assistive Devices</label>
            <input style={S.input} value={client.assistive} placeholder="Cane, walker, none..." onChange={e => uc("assistive", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>Inaccessible Areas</label>
            <input style={S.input} value={client.inaccessible} placeholder="Areas not assessed today and why..." onChange={e => uc("inaccessible", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Fall History */}
      <div style={S.card}>
        <div style={S.cardTitle}>⚠️ Fall History</div>
        <div className="mi-grid3" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[["injury","Resulted in Injury?"],["hospital","Resulted in Hospitalization?"],["rehab","Fall Rehab Received?"]].map(([f,lbl]) => (
            <div key={f}>
              <label style={S.label}>{lbl}</label>
              <select style={S.select} value={fallInfo[f]} onChange={e => uf(f, e.target.value)}>
                <option>No</option><option>Yes</option>
              </select>
            </div>
          ))}
          <div>
            <label style={S.label}>Where Did Fall Occur?</label>
            <select style={S.select} value={fallInfo.where} onChange={e => uf("where", e.target.value)}>
              <option value="">Select</option>
              {["Inside the Home","Outside the Home","Both"].map(h => <option key={h}>{h}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>What Room?</label>
            <input style={S.input} value={fallInfo.room} placeholder="Kitchen, bathroom..." onChange={e => uf("room", e.target.value)} />
          </div>
          <div>
            <label style={S.label}>Cause of Fall</label>
            <input style={S.input} value={fallInfo.cause} placeholder="Environmental, medical..." onChange={e => uf("cause", e.target.value)} />
          </div>
          <div style={{ gridColumn: "1/-1" }}>
            <label style={S.label}>Fall Notes</label>
            <textarea style={S.textarea} value={fallInfo.notes} placeholder="Describe circumstances, spouse account, actions taken..." onChange={e => uf("notes", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Concerns */}
      <div style={S.card}>
        <div style={S.cardTitle}>🩺 Clinical Concerns</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {CONCERNS.map(c => (
            <Tag key={c.id} label={c.label} selected={!!concerns[c.id]}
              onClick={() => setConcerns(p => ({ ...p, [c.id]: !p[c.id] }))} />
          ))}
        </div>
        {CONCERNS.filter(c => concerns[c.id]).map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "#FEF2F2", border: "1px solid #FECACA", marginBottom: 8 }}>
            <span>⚠️</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#991B1B", minWidth: 120 }}>{c.label}</span>
            <input style={{ ...S.input, border: "none", background: "transparent", color: "#7F1D1D", fontSize: 12 }} value={concernNotes[c.id] || ""} placeholder="Add clinical note..." onChange={e => setConcernNotes(p => ({ ...p, [c.id]: e.target.value }))} />
          </div>
        ))}
      </div>

      {/* Assessor */}
      <div style={S.card}>
        <div style={S.cardTitle}>🩻 Assessor</div>
        <div className="mi-grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={S.label}>Assessor Name + Credentials</label>
            <input style={S.input} value={assessor.name} placeholder="Jane Smith, OTR/L, CAPS" onChange={e => setAssessor(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label style={S.label}>Organization</label>
            <input style={S.input} value={assessor.org} placeholder="Rosarium Health / MyIntel Co." onChange={e => setAssessor(p => ({ ...p, org: e.target.value }))} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8 }}>
        <button onClick={onNext} style={{ ...S.btn(), background: "#1B3A5C", color: "white" }}>Begin Room Assessment →</button>
      </div>
    </div>
  );
}

// ─── ROOM PAGE ───────────────────────────────────────────────────────────────

function RoomPage({ mode, roomDef, roomData, updateRoom, onPhotos, activeTab, setActiveTab, onPrev, onNext, pageIdx, totalPages }) {
  const score = getRoomScore(roomData, roomDef);
  const isLast = pageIdx === totalPages - 2;
  const recOptions = mode === "standard" ? roomDef.recs.filter(r => !r.includes("MyIntel")) : roomDef.recs;

  const rateItem = (itemId, val) => {
    updateRoom(prev => {
      const newItems = { ...prev.items };
      if (newItems[itemId] === val) delete newItems[itemId];
      else newItems[itemId] = val;
      return { ...prev, items: newItems };
    });
  };

  const toggleRec = (rec) => {
    updateRoom(prev => {
      const idx = prev.recs.indexOf(rec);
      const newRecs = [...prev.recs];
      if (idx === -1) newRecs.push(rec); else newRecs.splice(idx, 1);
      return { ...prev, recs: newRecs };
    });
  };

  const tabs = ["checklist", "photos", "notes"];
  const tabLabels = { checklist: "☑ Checklist", photos: "📷 Photos & AI", notes: "📝 Notes & Recs" };

  return (
    <div>
      <div style={S.pageTitle}>{roomDef.icon} {roomDef.label}</div>
      <div style={S.pageSub}>Rate each item, capture photos for AI analysis, and document your clinical findings.</div>

      <div className="mi-roomgrid" style={{ display: "grid", gridTemplateColumns: "1fr 260px", gap: 16 }}>
        <div>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 4, background: "#F0F4F8", padding: 4, borderRadius: 10, marginBottom: 16 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                flex: 1, padding: "7px 4px", textAlign: "center", borderRadius: 7, fontSize: 12, fontWeight: activeTab === t ? 700 : 500,
                cursor: "pointer", color: activeTab === t ? "#1B3A5C" : "#64748B",
                border: "none", background: activeTab === t ? "white" : "transparent", fontFamily: "inherit",
                boxShadow: activeTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>{tabLabels[t]}</button>
            ))}
          </div>

          {/* Checklist */}
          {activeTab === "checklist" && roomDef.items.map(item => {
            const val = roomData.items[item.id];
            const bg = val === "flag" ? "#FEF2F2" : val === "warn" ? "#FFFBEB" : val === "pass" ? "#ECFDF5" : "white";
            const border = val === "flag" ? "#FECACA" : val === "warn" ? "#FDE68A" : val === "pass" ? "#A7F3D0" : "#DCE5EF";
            return (
              <div key={item.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "11px 14px", borderRadius: 8, border: `1px solid ${border}`, background: bg, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.name}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{item.hint}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <RatingBtn label="✓ Pass" variant="pass" active={val === "pass"} onClick={() => rateItem(item.id, "pass")} />
                  <RatingBtn label="! Concern" variant="warn" active={val === "warn"} onClick={() => rateItem(item.id, "warn")} />
                  <RatingBtn label="✕ Flag" variant="flag" active={val === "flag"} onClick={() => rateItem(item.id, "flag")} />
                </div>
              </div>
            );
          })}

          {/* Photos */}
          {activeTab === "photos" && (
            <div>
              <label htmlFor={`photo_${roomDef.id}`} style={{
                display: "block", border: "2px dashed #DCE5EF", borderRadius: 10, padding: 24, textAlign: "center",
                cursor: "pointer", background: "#FAFBFC", transition: "all 0.2s",
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 4 }}>Tap to capture or upload photos</div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>Use device camera or upload from gallery · AI analysis runs automatically</div>
              </label>
              <input id={`photo_${roomDef.id}`} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => { onPhotos(e.target.files); e.target.value = ""; }} />

              {roomData.photos.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 12 }}>
                  {roomData.photos.map((p, i) => (
                    <div key={i} style={{ aspectRatio: "4/3", borderRadius: 8, overflow: "hidden", position: "relative", border: "1px solid #DCE5EF" }}>
                      <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button onClick={() => updateRoom(prev => ({ ...prev, photos: prev.photos.filter((_, j) => j !== i), aiFindings: null }))}
                        style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.6)", color: "white", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <AIPanel aiFindings={roomData.aiFindings} aiLoading={roomData.aiLoading} showSensors={mode === "myintel"} />
            </div>
          )}

          {/* Notes & Recs */}
          {activeTab === "notes" && (
            <div>
              <div style={S.card}>
                <div style={S.cardTitle}>Assessment Notes</div>
                <textarea style={S.textarea} value={roomData.notes} placeholder="Document clinical observations, client behavior, spouse/caregiver input, nuances not in checklist..." onChange={e => updateRoom(prev => ({ ...prev, notes: e.target.value }))} />
              </div>
              <div style={S.card}>
                <div style={S.cardTitle}>Recommendations</div>
                <div style={{ fontSize: 11, color: "#64748B", marginBottom: 10 }}>Select all that apply. These appear in the final report.</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {recOptions.map(rec => <Tag key={rec} label={rec} selected={roomData.recs.includes(rec)} onClick={() => toggleRec(rec)} />)}
                </div>
                <input style={S.input} placeholder="+ Custom recommendation (press Enter)" onKeyDown={e => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    updateRoom(prev => ({ ...prev, recs: [...prev.recs, e.target.value.trim()] }));
                    e.target.value = "";
                  }
                }} />
              </div>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Scoring</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              {[
                { label: "Client Safety Perception", val: roomData.safetyRating, sub: "Verbally reported", field: "safetyRating", editable: true },
                { label: "OT Accessibility Rating", val: score ? score.accessScore : 0, sub: "From checklist", editable: false },
              ].map(({ label, val, sub, field, editable }) => (
                <div key={label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#64748B", marginBottom: 8 }}>{label}</div>
                  <div style={{ width: 62, height: 62, borderRadius: "50%", margin: "0 auto 6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 700, border: `3px solid ${scoreColor(val)}`, color: scoreColor(val) }}>{val}%</div>
                  <div style={{ fontSize: 10, color: "#64748B", marginBottom: editable ? 6 : 0 }}>{sub}</div>
                  {editable && <input type="range" min="0" max="100" value={roomData.safetyRating} style={{ width: "100%", accentColor: "#0891B2" }} onChange={e => updateRoom(prev => ({ ...prev, safetyRating: parseInt(e.target.value) }))} />}
                </div>
              ))}
            </div>
            {score && score.rated > 0 && (
              <div style={{ display: "flex", gap: 8, fontSize: 11 }}>
                {[["Flagged", score.flags, "#FEF2F2", "#EF4444"], ["Concerns", score.warnings, "#FFFBEB", "#B45309"], ["Passed", score.passed, "#ECFDF5", "#065F46"]].map(([lbl, val, bg, color]) => (
                  <div key={lbl} style={{ flex: 1, background: bg, borderRadius: 6, padding: "6px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color }}>{val}</div>
                    <div style={{ color: "#64748B" }}>{lbl}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {roomData.aiFindings && !roomData.aiLoading && (
            <div style={{ ...S.card, background: "linear-gradient(135deg,#0F1E35,#1B3A5C)", border: "1px solid #1E3A5C" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#38BDF8" }} />
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#38BDF8" }}>AI Analysis</span>
              </div>
              <div style={{ fontSize: 12, color: "#E2E8F0" }}>
                {(roomData.aiFindings.findings || []).filter(f => f.severity === "danger").length > 0
                  ? <span style={{ color: "#FCA5A5", fontWeight: 600 }}>{(roomData.aiFindings.findings).filter(f => f.severity === "danger").length} high-risk finding(s) in photos</span>
                  : "No major hazards detected in photos"}
              </div>
              <div style={{ fontSize: 10, color: "#64748B", marginTop: 5 }}>See Photos tab for full analysis</div>
            </div>
          )}

          {mode === "myintel" && (
            <div style={{ ...S.card, background: "#F0F9FF", border: "1px solid #BAE6FD" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#0891B2", marginBottom: 8 }}>MyIntel Integration</div>
              <div style={{ fontSize: 11, color: "#0C4A6E", lineHeight: 1.5 }}>Flagged items in this room will map to Talius sensor placement recommendations in the final report.</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid #DCE5EF", marginTop: 8 }}>
        <button onClick={onPrev} style={{ ...S.btn(), background: "white", color: "#1B3A5C", border: "1px solid #DCE5EF" }}>← Back</button>
        <div style={{ fontSize: 12, color: "#64748B" }}>{score ? `${score.rated}/${score.total} items rated` : "Not started"}</div>
        <button onClick={onNext} style={{ ...S.btn(), background: "#1B3A5C", color: "white" }}>{isLast ? "📋 View Report" : "Next Room →"}</button>
      </div>
    </div>
  );
}

// ─── REPORT PAGE ─────────────────────────────────────────────────────────────

function ReportPage({ mode, rooms, client, fallInfo, concerns, concernNotes, assessor, onPrev }) {
  let totalItems = 0, passedItems = 0, flaggedItems = 0;
  ROOMS.forEach(r => r.items.forEach(item => {
    totalItems++;
    const v = rooms[r.id].items[item.id];
    if (v === "pass") passedItems++;
    if (v === "flag") flaggedItems++;
  }));
  const overallAccess = totalItems > 0 ? Math.round((passedItems / totalItems) * 100) : 0;
  const flaggedRooms = ROOMS.filter(r => getRoomScore(rooms[r.id], r)?.flags > 0);
  const warnRooms = ROOMS.filter(r => {
    const s = getRoomScore(rooms[r.id], r);
    return s && s.warnings > 0 && s.flags === 0;
  });
  const allRecs = [];
  ROOMS.forEach(r => rooms[r.id].recs.forEach(rec => allRecs.push({ room: r.label, icon: r.icon, rec })));
  const activeConcerns = CONCERNS.filter(c => concerns[c.id]);

  const exportPDF = () => window.print();

  const shareReport = async () => {
    const lines = [
      `${mode === "myintel" ? "MyIntel " : ""}Home Safety Assessment — ${client.name || "Client"}`,
      `${client.address || "Address not entered"} · ${client.housing}`,
      `Assessed by ${assessor.name || "Assessor"}${assessor.org ? ` · ${assessor.org}` : ""}`,
      "",
      `Overall Accessibility: ${overallAccess}% · Flagged items: ${flaggedItems}`,
      flaggedRooms.length > 0 ? `High-risk areas: ${flaggedRooms.map(r => r.label).join(", ")}` : "No high-risk areas flagged",
      "",
      ...ROOMS.map(r => {
        const s = getRoomScore(rooms[r.id], r);
        if (!s || s.rated === 0) return `${r.label}: not assessed`;
        return `${r.label}: ${s.accessScore}% accessibility · ${s.flags} flagged · ${s.warnings} concerns`;
      }),
    ];
    if (allRecs.length > 0) {
      lines.push("", "Recommendations:");
      allRecs.forEach(({ room, rec }) => lines.push(`• ${room}: ${rec}`));
    }
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ title: `${mode === "myintel" ? "MyIntel " : ""}Home Safety Assessment`, text });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Report summary copied to clipboard.");
      }
    } catch { /* user cancelled the share sheet */ }
  };

  return (
    <div>
      <div style={S.pageTitle}>Assessment Report</div>
      <div style={S.pageSub}>{mode === "myintel" ? "Summary of all room findings, clinical concerns, and MyIntel sensor recommendations." : "Summary of all room findings, clinical concerns, and recommendations."}</div>

      {/* Hero */}
      <div className="mi-hero" style={{ background: "linear-gradient(135deg,#1B3A5C,#2563EB)", borderRadius: 14, padding: 24, color: "white", marginBottom: 20, display: "flex", gap: 24, alignItems: "center" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#93C5FD", marginBottom: 6 }}>{mode === "myintel" ? "Home Safety Assessment · MyIntel Co." : "Home Safety Assessment"}</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: 22, marginBottom: 4 }}>{client.name || "Client Name"}</div>
          <div style={{ color: "#93C5FD", fontSize: 13, marginBottom: 4 }}>{client.address || "Address not entered"} · {client.housing}</div>
          <div style={{ color: "#93C5FD", fontSize: 12, marginBottom: 10 }}>Assessed by {assessor.name || "Assessor"}{assessor.org ? ` · ${assessor.org}` : ""}</div>
          {flaggedRooms.length > 0 ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", fontSize: 11, fontWeight: 700, color: "#FCA5A5" }}>
              ⚠ High Risk: {flaggedRooms.map(r => r.label).join(", ")}
            </div>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.4)", fontSize: 11, fontWeight: 700, color: "#6EE7B7" }}>
              ✓ No high-risk areas flagged
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[["Accessibility", `${overallAccess}%`, overallAccess > 75 ? "#6EE7B7" : overallAccess > 50 ? "#FDE68A" : "#FCA5A5"], ["Flags", flaggedItems, flaggedItems > 3 ? "#FCA5A5" : flaggedItems > 0 ? "#FDE68A" : "#6EE7B7"]].map(([lbl, val, color]) => (
            <div key={lbl} style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "14px 20px", textAlign: "center", border: "1px solid rgba(255,255,255,0.15)", minWidth: 90 }}>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 28, fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: 10, color: "#BAE6FD", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 2 }}>{lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Concerns */}
      {activeConcerns.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>🩺 Clinical Concerns</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {activeConcerns.map(c => (
              <div key={c.id} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#EF4444" }}>{c.label}</div>
                {concernNotes[c.id] && <div style={{ fontSize: 11, color: "#7F1D1D", marginTop: 3 }}>{concernNotes[c.id]}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room summary */}
      <div style={S.card}>
        <div style={S.cardTitle}>📊 Room-by-Room Summary</div>
        {ROOMS.map(r => {
          const s = getRoomScore(rooms[r.id], r);
          if (!s || s.rated === 0) {
            return <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#F8FAFC", marginBottom: 6 }}>
              <span style={{ minWidth: 130, fontWeight: 600, fontSize: 13 }}>{r.icon} {r.label}</span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>Not assessed</span>
            </div>;
          }
          const color = scoreColor(s.accessScore);
          return (
            <div key={r.id} className="mi-roomrow" style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, background: "#F8FAFC", marginBottom: 6 }}>
              <span style={{ minWidth: 130, fontWeight: 600, fontSize: 13 }}>{r.icon} {r.label}</span>
              <div style={{ flex: 2 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748B", marginBottom: 3 }}>
                  <span>Accessibility</span>
                  <span style={{ fontWeight: 700, color }}>{s.accessScore}%</span>
                </div>
                <div style={{ height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${s.accessScore}%`, background: color, borderRadius: 3, transition: "width 0.6s" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {s.flags > 0 && <span style={{ background: "#FEF2F2", color: "#EF4444", border: "1px solid #FECACA", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{s.flags} ✕</span>}
                {s.warnings > 0 && <span style={{ background: "#FFFBEB", color: "#B45309", border: "1px solid #FDE68A", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>{s.warnings} !</span>}
                {s.flags === 0 && s.warnings === 0 && <span style={{ background: "#ECFDF5", color: "#065F46", border: "1px solid #A7F3D0", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20 }}>✓ Clear</span>}
              </div>
              <span style={{ fontSize: 11, color: "#64748B", minWidth: 80 }}>Safety: {rooms[r.id].safetyRating}%</span>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {allRecs.length > 0 && (
        <div style={S.card}>
          <div style={S.cardTitle}>📋 Recommendations</div>
          {allRecs.map(({ room, icon, rec }, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid #F0F4F8" }}>
              <span style={{ fontSize: 11, color: "#64748B", minWidth: 120 }}>{icon} {room}</span>
              <span style={{ fontSize: 13 }}>→ {rec}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {ROOMS.filter(r => rooms[r.id].notes).map(r => (
        <div key={r.id} style={S.card}>
          <div style={S.cardTitle}>{r.icon} {r.label} Notes</div>
          <div style={{ fontSize: 13, color: "#1A2332", lineHeight: 1.6, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8 }}>{rooms[r.id].notes}</div>
        </div>
      ))}

      {/* MyIntel sensor recs */}
      {mode === "myintel" && (
        <div style={{ ...S.card, background: "linear-gradient(135deg,#F0F9FF,#E0F2FE)", border: "1px solid #BAE6FD" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: "#0891B2", marginBottom: 10 }}>MyIntel / Talius Sensor Recommendations</div>
          <div style={{ fontSize: 12, color: "#0C4A6E", lineHeight: 1.8 }}>
            {flaggedRooms.length === 0 && warnRooms.length === 0
              ? "Standard baseline monitoring package appropriate for this home."
              : <>
                {flaggedRooms.map(r => <div key={r.id}>• <strong>{r.label}:</strong> Motion sensor + fall detection coverage recommended (high risk)</div>)}
                {warnRooms.map(r => <div key={r.id}>• <strong>{r.label}:</strong> Activity monitoring sensor recommended</div>)}
              </>
            }
          </div>
        </div>
      )}

      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid #DCE5EF", marginTop: 8 }}>
        <button onClick={onPrev} style={{ ...S.btn(), background: "white", color: "#1B3A5C", border: "1px solid #DCE5EF" }}>← Back</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={exportPDF} style={{ ...S.btn("sm"), background: "white", color: "#1B3A5C", border: "1px solid #DCE5EF" }}>⬇ Export PDF</button>
          <button onClick={shareReport} style={{ ...S.btn("sm"), background: "#0891B2", color: "white" }}>🔗 Share Report</button>
        </div>
      </div>
    </div>
  );
}
