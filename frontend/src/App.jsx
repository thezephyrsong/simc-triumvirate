import { useState, useCallback } from "react";

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
        .btn-primary:hover:not(:disabled) { opacity: .85; }
        .btn-ghost    { background: transparent; color: var(--text-dim); border: 1px solid var(--border); }
        .btn-ghost:hover:not(:disabled) { color: var(--text); border-color: var(--text-dim); }
        label { display: block; margin-bottom: 4px; color: var(--text-dim); font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
        input, select, textarea {
          width: 100%; padding: 8px 10px; border-radius: 6px;
          border: 1px solid var(--border); background: var(--bg);
          color: var(--text); font-family: var(--mono); font-size: 13px;
          outline: none; transition: border-color .15s;
        }
        input:focus, select:focus, textarea:focus { border-color: var(--amber); }
        select option { background: var(--surface); }
      `}</style>

      {/* Header */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "16px 24px",
        display: "flex", alignItems: "center", gap: 14,
      }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>⚔️</span>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 600, letterSpacing: ".03em" }}>
            Triumvirate SimC
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-dim)" }}>
            SimulationCraft EP weights for Triumvirate WoW — level 60 cap
          </p>
        </div>
      </header>

      {/* Main layout */}
      <main style={{
        maxWidth: 960, margin: "0 auto", padding: "28px 20px",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24,
      }}>

        {/* Left — input */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

          <div>
            <label>Spec</label>
            <select value={spec} onChange={e => handleSpecChange(e.target.value)}
              style={{ fontFamily: "var(--sans)" }}>
              {Object.keys(SPEC_PRESETS).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label>Boss level</label>
              <input type="number" min="60" max="83" value={targetLvl}
                onChange={e => setTargetLvl(Number(e.target.value))} />
            </div>
            <div>
              <label>Iterations</label>
              <input type="number" min="1000" max="50000" step="1000" value={iterations}
                onChange={e => setIterations(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <label>TopFit export</label>
            <textarea
              value={profile}
              onChange={e => setProfile(e.target.value)}
              placeholder={`Paste your TopFit export here, e.g.:\n\nshaman=Zaenith\nlevel=60\nrace=night_elf\n...`}
              style={{
                height: 320, resize: "vertical",
                fontFamily: "var(--mono)", fontSize: 12, lineHeight: 1.7,
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-primary" onClick={handleSimulate} disabled={loading || !profile.trim()}>
              {loading ? "Running..." : "▶ Run Sim"}
            </button>
            <button className="btn btn-ghost" onClick={() => { setProfile(""); setResult(null); setError(null); }}>
              Clear
            </button>
          </div>
        </div>

        {/* Right — results */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, padding: 20,
          display: "flex", flexDirection: "column", gap: 16, minHeight: 300,
        }}>
          {!loading && !result && !error && (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--text-dim)" }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>📊</div>
              <p>Paste your TopFit export and hit <strong style={{ color: "var(--text)" }}>Run Sim</strong></p>
              <p style={{ fontSize: 12, marginTop: 6 }}>EP weights will appear here</p>
            </div>
          )}

          {loading && (
            <div style={{ margin: "auto" }}>
              <Spinner />
              <p style={{ marginTop: 12, color: "var(--text-dim)", fontSize: 12, fontFamily: "var(--mono)" }}>
                {iterations.toLocaleString()} iterations · this takes ~{Math.round(iterations / 1000 * 2)}s
              </p>
            </div>
          )}

          {error && (
            <div style={{
              background: "#2d1518", border: "1px solid var(--red)",
              borderRadius: 6, padding: "12px 14px",
              color: "var(--red)", fontFamily: "var(--mono)", fontSize: 12,
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {result && !loading && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <p style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em" }}>Simulated DPS</p>
                  <p style={{ fontSize: 28, fontFamily: "var(--mono)", color: "var(--amber)", fontWeight: 700 }}>
                    {result.dps ? result.dps.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
                  </p>
                </div>
                <button className="btn btn-ghost" style={{ fontSize: 12 }}
                  onClick={() => setShowRaw(r => !r)}>
                  {showRaw ? "Hide" : "Raw"} output
                </button>
              </div>

              <div>
                <p style={{ fontSize: 11, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 10 }}>
                  EP Weights
                </p>
                <EPTable weights={result.weights} />
              </div>

              {showRaw && (
                <textarea
                  readOnly value={result.raw}
                  style={{ height: 200, fontSize: 11, lineHeight: 1.5, color: "var(--text-dim)" }}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "1px solid var(--border)", padding: "12px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        color: "var(--text-dim)", fontSize: 11,
      }}>
        <span>SimulationCraft 335-1 · Triumvirate WoW patch</span>
        <span>
          Powered by <a href="https://github.com/simulationcraft/simc">SimC</a>
        </span>
      </footer>
    </>
  );
}
