import { useState, useCallback, useEffect } from "react"; // 1. Added useEffect here

// Set this to your Render/Railway backend URL after deploying.
// During local dev, set VITE_API_URL in a .env.local file.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ─── Stat display config ─────────────────────────────────────────────────────
const STAT_LABELS = {
  Agility:             "Agility",
  Strength:            "Strength",
  Intellect:           "Intellect",
  Spirit:              "Spirit",
  Stamina:             "Stamina",
  AttackPower:         "Attack Power",
  SpellPower:          "Spell Power",
  MeleeHit:            "Hit (Melee)",
  SpellHit:            "Hit (Spell)",
  MeleeCrit:           "Crit (Melee)",
  SpellCrit:           "Crit (Spell)",
  MeleeHaste:          "Haste (Melee)",
  SpellHaste:          "Haste (Spell)",
  Expertise:           "Expertise",
  ArmorPenetration:    "Armor Pen",
};

const SPEC_PRESETS = {
  "Enhancement Shaman":  { targetLevel: 63, scaleOnly: "hit,agi,ap,sta,crit,haste,expertise" },
  "Elemental Shaman":    { targetLevel: 63, scaleOnly: "hit,int,sp,sta,crit,haste" },
  "Marksmanship Hunter": { targetLevel: 63, scaleOnly: "hit,agi,ap,sta,crit,haste,arpen" },
  "Survival Hunter":     { targetLevel: 63, scaleOnly: "hit,agi,ap,sta,crit,haste" },
  "Combat Rogue":        { targetLevel: 63, scaleOnly: "hit,agi,ap,sta,crit,haste,expertise,arpen" },
  "Fury Warrior":        { targetLevel: 63, scaleOnly: "hit,str,ap,sta,crit,haste,expertise,arpen" },
  "Custom":              { targetLevel: 63, scaleOnly: "" },
};

// ─── Components ──────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--amber)", fontFamily: "var(--mono)" }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        style={{ animation: "spin 1s linear infinite" }}>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
      </svg>
      Simulating...
    </div>
  );
}

function EPTable({ weights }) {
  const entries = Object.entries(weights)
    .filter(([, v]) => v !== 0)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

  if (entries.length === 0) {
    return <p style={{ color: "var(--text-dim)", fontFamily: "var(--mono)" }}>No scale factors found in output.</p>;
  }

  const max = Math.max(...entries.map(([, v]) => Math.abs(v)));

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--mono)", fontSize: 13 }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--border)" }}>
          <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text-dim)", fontWeight: 500 }}>Stat</th>
          <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text-dim)", fontWeight: 500 }}>EP Weight</th>
          <th style={{ padding: "6px 8px", width: "40%" }}></th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([stat, val]) => {
          const label = STAT_LABELS[stat] || stat;
          const pct   = Math.abs(val) / max;
          const pos   = val >= 0;
          return (
            <tr key={stat} style={{ borderBottom: "1px solid var(--border)" }}>
              <td style={{ padding: "7px 8px" }}>{label}</td>
              <td style={{ textAlign: "right", padding: "7px 8px", color: pos ? "var(--green)" : "var(--red)" }}>
                {val.toFixed(4)}
              </td>
              <td style={{ padding: "7px 8px" }}>
                <div style={{
                  height: 6, borderRadius: 3,
                  width: `${pct * 100}%`,
                  background: pos ? "var(--green)" : "var(--red)",
                  opacity: 0.7,
                }}/>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [profile,    setProfile]    = useState("");
  const [spec,       setSpec]       = useState("Enhancement Shaman");
  const [targetLvl,  setTargetLvl]  = useState(63);
  const [iterations, setIterations] = useState(5000);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [showRaw,    setShowRaw]    = useState(false);

  // 2. State to track background cold-starts: "waking", "ready", or "failed"
  const [backendStatus, setBackendStatus] = useState("waking");

  // 2. Automatically ping the health check to wake up Render on page load
  useEffect(() => {
    const wakeBackend = async () => {
      try {
        const res = await fetch(`${API_URL}/api/health`);
        if (res.ok) {
          setBackendStatus("ready");
        } else {
          setBackendStatus("failed");
        }
      } catch (err) {
        console.error("Backend wake-up failed:", err);
        setBackendStatus("failed");
      }
    };
    wakeBackend();
  }, []);

  // Apply spec preset
  const handleSpecChange = useCallback((s) => {
    setSpec(s);
    const preset = SPEC_PRESETS[s];
    if (preset) setTargetLvl(preset.targetLevel);
  }, []);

  const handleSimulate = useCallback(async () => {
    if (!profile.trim()) {
      setError("Paste your TopFit export first.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(`${API_URL}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          options: { targetLevel: targetLvl, iterations, threads: 2 },
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || data.detail || "Simulation failed");
      setResult(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [profile, targetLvl, iterations]);

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 9px 20px; border-radius: 6px; border: none;
          font-family: var(--sans); font-size: 14px; font-weight: 600;
          cursor: pointer; transition: opacity .15s;
        }
        .btn:disabled { opacity: .4; cursor: not-allowed; }
        .btn-primary  { background: var(--amber); color: #0d1117; }
        .btn-primary:hover:not(:disabled
