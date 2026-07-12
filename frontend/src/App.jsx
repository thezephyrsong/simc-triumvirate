import { useState, useCallback, useEffect, useMemo } from "react";

// Set this to your Render/Railway backend URL after deploying.
// During local dev, set VITE_API_URL in a .env.local file.
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

// ─── Stat display config ─────────────────────────────────────────────────────
const STAT_LABELS = {
  Str:      "Strength",
  Agi:      "Agility",
  Int:      "Intellect",
  Spi:      "Spirit",
  Sta:      "Stamina",
  AP:       "Attack Power",
  SP:       "Spell Power",
  Hit:      "Hit Rating",
  Crit:     "Crit Rating",
  Haste:    "Haste Rating",
  Exp:      "Expertise",
  ArPen:    "Armor Penetration",
  Wdps:     "Main-Hand Weapon DPS",
  WOHdps:   "Off-Hand Weapon DPS",
  WOHspeed: "Off-Hand Weapon Speed"
};

const SPEC_PRESETS = {
  // Death Knight
  "Blood Death Knight":    { targetLevel: 63, scaleOnly: "hit_rating,strength,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  "Frost Death Knight":    { targetLevel: 63, scaleOnly: "hit_rating,strength,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  "Unholy Death Knight":   { targetLevel: 63, scaleOnly: "hit_rating,strength,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  
  // Druid
  "Balance Druid":         { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  "Feral Cat Druid":       { targetLevel: 63, scaleOnly: "hit_rating,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  "Feral Bear Druid":      { targetLevel: 63, scaleOnly: "hit_rating,agility,strength,attack_power,stamina,crit_rating,haste_rating,expertise_rating" },
  
  // Hunter
  "Beast Mastery Hunter":  { targetLevel: 63, scaleOnly: "hit_rating,agility,attack_power,stamina,crit_rating,haste_rating,armor_penetration_rating" },
  "Marksmanship Hunter":   { targetLevel: 63, scaleOnly: "hit_rating,agility,attack_power,stamina,crit_rating,haste_rating,armor_penetration_rating" },
  "Survival Hunter":       { targetLevel: 63, scaleOnly: "hit_rating,agility,attack_power,stamina,crit_rating,haste_rating" },
  
  // Mage
  "Arcane Mage":           { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  "Fire Mage":             { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  "Frost Mage":            { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  
  // Paladin
  "Retribution Paladin":   { targetLevel: 63, scaleOnly: "hit_rating,strength,attack_power,stamina,crit_rating,haste_rating,expertise_rating" },
  "Protection Paladin":    { targetLevel: 63, scaleOnly: "hit_rating,strength,attack_power,stamina,crit_rating,haste_rating,expertise_rating" },
  
  // Priest
  "Shadow Priest":         { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  
  // Rogue
  "Assassination Rogue":   { targetLevel: 63, scaleOnly: "hit_rating,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating" },
  "Combat Rogue":          { targetLevel: 63, scaleOnly: "hit_rating,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  "Subtlety Rogue":        { targetLevel: 63, scaleOnly: "hit_rating,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  
  // Shaman
  "Elemental Shaman":      { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  "Enhancement Shaman":    { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,agility,attack_power,stamina,crit_rating,haste_rating,expertise_rating" },
  
  // Warlock
  "Affliction Warlock":    { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  "Demonology Warlock":    { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  "Destruction Warlock":   { targetLevel: 63, scaleOnly: "hit_rating,intellect,spell_power,stamina,crit_rating,haste_rating" },
  
  // Warrior
  "Arms Warrior":          { targetLevel: 63, scaleOnly: "hit_rating,strength,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  "Fury Warrior":          { targetLevel: 63, scaleOnly: "hit_rating,strength,attack_power,stamina,crit_rating,haste_rating,expertise_rating,armor_penetration_rating" },
  
  "Custom":                { targetLevel: 63, scaleOnly: "" },
};

// ─── Raid buff/debuff overrides ──────────────────────────────────────────────
// Mirrors the `override.*` options registered in the engine's sc_sim.cpp.
// Default `true` matches the engine's own default (sim_t starts with
// optimal_raid=1, i.e. every buff/debuff assumed present) — uncheck the ones
// your raid comp doesn't actually bring.
// NOTE: hellscreams_warsong / strength_of_wrynn are registered options but are
// hardcoded off in this engine fork and have no effect either way, so they're
// left out here rather than shown as a checkbox that silently does nothing.
const RAID_BUFF_GROUPS = [
  {
    title: "Raid Buffs — Physical",
    buffs: [
      ["battle_shout", "Battle Shout"],
      ["blessing_of_might", "Blessing of Might"],
      ["strength_of_earth", "Strength of Earth Totem"],
      ["horn_of_winter", "Horn of Winter"],
      ["abominations_might", "Abomination's Might"],
      ["unleashed_rage", "Unleashed Rage"],
      ["trueshot_aura", "Trueshot Aura"],
      ["ferocious_inspiration", "Ferocious Inspiration"],
      ["sanctified_retribution", "Sanctified Retribution"],
      ["swift_retribution", "Swift Retribution"],
      ["blessing_of_kings", "Blessing of Kings"],
      ["windfury_totem", "Windfury Totem"],
      ["improved_icy_talons", "Improved Icy Talons"],
      ["leader_of_the_pack", "Leader of the Pack"],
    ],
  },
  {
    title: "Raid Buffs — Caster / Stamina",
    buffs: [
      ["arcane_brilliance", "Arcane Brilliance"],
      ["divine_spirit", "Divine Spirit"],
      ["blessing_of_wisdom", "Blessing of Wisdom"],
      ["mana_spring_totem", "Mana Spring Totem"],
      ["totem_of_wrath", "Totem of Wrath"],
      ["elemental_oath", "Elemental Oath"],
      ["moonkin_aura", "Moonkin Aura"],
      ["improved_moonkin_aura", "Improved Moonkin Aura"],
      ["wrath_of_air", "Wrath of Air Totem"],
      ["arcane_empowerment", "Arcane Empowerment"],
      ["flametongue_totem", "Flametongue Totem"],
      ["fortitude", "Power Word: Fortitude"],
      ["mark_of_the_wild", "Mark of the Wild"],
      ["commanding_shout", "Commanding Shout"],
      ["devotion_aura", "Devotion Aura"],
      ["heroic_presence", "Heroic Presence"],
      ["replenishment", "Replenishment"],
      ["bloodlust", "Bloodlust / Heroism"],
    ],
  },
  {
    title: "Target Debuffs — Physical",
    buffs: [
      ["faerie_fire", "Faerie Fire"],
      ["improved_faerie_fire", "Improved Faerie Fire"],
      ["sunder_armor", "Sunder Armor"],
      ["blood_frenzy", "Blood Frenzy"],
      ["savage_combat", "Savage Combat"],
      ["trauma", "Trauma"],
      ["mangle", "Mangle"],
      ["thunder_clap", "Thunder Clap"],
      ["infected_wounds", "Infected Wounds"],
      ["poisoned", "Poisoned (Wound Poison)"],
      ["master_poisoner", "Master Poisoner"],
      ["hunters_mark", "Hunter's Mark"],
      ["scorpid_sting", "Scorpid Sting"],
      ["winters_chill", "Winter's Chill"],
      ["judgements_of_the_just", "Judgements of the Just"],
      ["rampage", "Rampage"],
      ["bleeding", "Bleeding (physical DoT active)"],
    ],
  },
  {
    title: "Target Debuffs — Spell",
    buffs: [
      ["curse_of_elements", "Curse of the Elements"],
      ["earth_and_moon", "Earth and Moon"],
      ["heart_of_the_crusader", "Heart of the Crusader"],
      ["judgement_of_wisdom", "Judgement of Wisdom"],
      ["misery", "Misery"],
      ["insect_swarm", "Insect Swarm"],
      ["crypt_fever", "Crypt Fever"],
      ["ebon_plaguebringer", "Ebon Plaguebringer"],
      ["blood_plague", "Blood Plague"],
      ["frost_fever", "Frost Fever"],
      ["improved_scorch", "Improved Scorch"],
      ["improved_shadow_bolt", "Shadow & Flame"],
    ],
  },
  {
    title: "Situational (off by default)",
    buffs: [
      ["celerity", "Celerity"],
      ["focus_magic", "Focus Magic"],
    ],
    defaultOff: true,
  },
];

// Flattened default state for all buffs, keyed by option name.
const DEFAULT_BUFF_STATE = RAID_BUFF_GROUPS.reduce((acc, group) => {
  group.buffs.forEach(([key]) => { acc[key] = !group.defaultOff; });
  return acc;
}, {});

const FIGHT_STYLE_OPTIONS = [
  { value: "Patchwerk",     label: "Patchwerk (Static)" },
  { value: "HelterSkelter", label: "Helter Skelter (Movement + Stuns)" },
  { value: "Ultraxion",     label: "Ultraxion (Movement + Raid Stun)" },
  { value: "LightMovement", label: "Light Movement" },
  { value: "HeavyMovement", label: "Heavy Movement" },
];

// Hyper-robust text summary parser to accurately build out spell arrays from standard console log structures
const parseSpellBreakdown = (rawLog) => {
  if (!rawLog || typeof rawLog !== "string") return [];
  const spells = [];
  const lines = rawLog.split("\n");
  
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Ignore layout definitions or full text headers
    if (/^(name|total|player|constant|options|simulation|metadata|actions|abilities|spells|target|baseline)/i.test(trimmed) || 
        trimmed.startsWith("-") || trimmed.startsWith("=")) {
      continue;
    }
    
    // Target entries containing a percentage indicator and a numeric DPS block
    const pctMatch = trimmed.match(/([0-9\.]+)%/);
    const dpsMatch = trimmed.match(/DPS[=:\s]+([0-9\.]+)/i);
    
    if (pctMatch && dpsMatch) {
      const percentage = parseFloat(pctMatch[1]);
      const dps = parseFloat(dpsMatch[1]);
      
      // Cleanly isolate the ability string name by stripping metric numbers down
      let namePart = trimmed.split(/DPS|Count|Vort|:\s*=|[=\s]\s*[0-9\.]+/i)[0].trim();
      namePart = namePart.replace(/[:\-–—\s]+$/, "").trim(); // Clear trailing syntax dividers
      
      if (namePart && dps > 0 && percentage > 0 && !/^(total|player)$/i.test(namePart)) {
        if (!spells.some(s => s.name.toLowerCase() === namePart.toLowerCase())) {
          spells.push({ name: namePart, dps, percentage });
        }
      }
    }
  }
  
  return spells.sort((a, b) => b.dps - a.dps);
};

// Helper function to format weights into a valid Pawn import string mapping short keys to Pawn fields
function generatePawnString(specName, weights) {
  const pawnStatMapping = {
    Str:      "Strength",
    Agi:      "Agility",
    Int:      "Intellect",
    Spi:      "Spirit",
    Sta:      "Stamina",
    AP:       "Ap",
    SP:       "SpellPower",
    Hit:      "HitRating",
    Crit:     "CritRating",
    Haste:    "HasteRating",
    Exp:      "ExpertiseRating",
    ArPen:    "ArmorPenetration",
    Wdps:     "MeleeDps",
    WOHdps:   "OffHandDps",
    WOHspeed: "OffHandSpeed"
  };

  const parts = [];
  Object.entries(weights).forEach(([stat, val]) => {
    if (val === 0 || ["ub", "gm", "gb", "wt", "wtv"].includes(stat.toLowerCase())) return;
    const pawnKey = pawnStatMapping[stat] || stat;
    parts.push(`${pawnKey}=${val.toFixed(4)}`);
  });

  return `( Pawn: v1: "${specName} - SimC": ${parts.join(", ")} )`;
}

// Helper function to format weights into a valid TopFit import string matching client structures
function generateTopFitString(specName, weights) {
  const topFitStatMapping = {
    Str:      "Strength",
    Agi:      "Agility",
    Int:      "Intellect",
    Spi:      "Spirit",
    Sta:      "Stamina",
    AP:       "Ap",
    SP:       "SpellPower",
    Hit:      "HitRating",
    Crit:     "CritRating",
    Haste:    "Haste",
    Exp:      "ExpertiseRating",
    ArPen:    "ArmorPenetration",
    Wdps:     "Dps",
    WOHdps:   "OffHandDps",
    WOHspeed: "OffHandSpeed"
  };

  const cleanParts = [];
  Object.entries(weights).forEach(([stat, val]) => {
    if (val === 0 || ["ub", "gm", "gb", "wt", "wtv"].includes(stat.toLowerCase())) return;
    const tfKey = topFitStatMapping[stat] || stat;
    cleanParts.push(`${tfKey}=${val.toFixed(4)}`);
  });

  const baseWeights = cleanParts.join(", ");

  // ─── UNIVERSAL CAP MAPPING MATRIX ──────────────────────────────────────
  let capSuffix = "";

  const name = specName.toLowerCase();

  // Physical Melee (Yellow hit 8% / Expertise 26)
  if (name.includes("fury") || name.includes("assassination") || name.includes("subtlety") || name.includes("retribution")) {
    capSuffix = " : HitRating=64; Hard, ExpertiseRating=26; Hard";
  } 
  // Death Knights (Specialized Expertise rules)
  else if (name.includes("death knight") || name.includes("combat")) {
    capSuffix = " : HitRating=64; Soft, ExpertiseRating=21; Hard";
  }
  // Feral Druids (Specialized Expertise rules)
  else if (name.includes("feral")) {
    capSuffix = " : HitRating=64; Soft, ExpertiseRating=16; Hard";
  }
  // Enhancement Shaman
  else if (name.includes("enhancement")) {
    // Note: Enhancement uses your server's custom 9% talent + DW penalty
    capSuffix = " : HitRating=32; Soft, ExpertiseRating=11; Hard";
  }
  // Hunters (Physical Ranged only, Expertise irrelevant)
  else if (name.includes("hunter")) {
    capSuffix = " : HitRating=64; Hard";
  }
  // Pure Casters (17% Spell hit cap)
  else if (name.includes("mage") || name.includes("warlock") || name.includes("priest") || name.includes("balance") || name.includes("elemental")) {
    capSuffix = " : HitRating=136; Hard";
  }
  // Protection Paladin and Warrior (Tanking expertise and hit)
  else if (name.includes("protection")) {
    capSuffix = " : HitRating=64; Hard, ExpertiseRating=20; Hard";
  }

  return `( TopFit: v1: "${specName} - SimC": ${baseWeights}${capSuffix} )`;
}

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

function DetailsMeter({ spells }) {
  if (!spells || spells.length === 0) return null;

  const maxDps = spells[0].dps;

  const formatSpellName = (name) => {
    return name
      .replace(/_/g, " ")
      .replace(/\bmh\b/gi, "(Main Hand)")
      .replace(/\boh\b/gi, "(Off Hand)")
      .replace(/\b([a-z])/g, (char) => char.toUpperCase());
  };

  return (
    <div style={{
      marginTop: 20,
      background: "#161b22",
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: 16,
      fontFamily: "var(--mono), monospace",
      marginBottom: 24
    }}>
      <h3 style={{ 
        fontSize: 13, 
        color: "var(--text-dim)", 
        margin: "0 0 14px 0", 
        textTransform: "uppercase", 
        letterSpacing: "0.05em",
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontWeight: 600
      }}>
        📊 Spell Damage Breakdown (Details! Mode)
      </h3>
      
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {spells.map((spell, index) => {
          const barWidth = maxDps > 0 ? (spell.dps / maxDps) * 100 : 0;

          return (
            <div key={index} style={{
              position: "relative",
              height: 28,
              background: "#21262d",
              borderRadius: 4,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              justifyContent: "space-between",
              fontSize: 13,
              color: "#c9d1d9",
              border: "1px solid rgba(255,255,255,0.02)"
            }}>
              {/* Dynamic width absolute background progress fills */}
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: `${barWidth}%`,
                background: "linear-gradient(90deg, #1f6feb 0%, #388bfd 100%)",
                opacity: 0.25,
                zIndex: 1,
                transition: "width 0.4s ease-out"
              }} />

              {/* Explicit alignment label text row metadata values */}
              <span style={{ zIndex: 2, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{index + 1}.</span>
                {formatSpellName(spell.name)}
              </span>
              
              <span style={{ zIndex: 2 }}>
                <strong style={{ color: "var(--amber)" }}>
                  {Math.round(spell.dps).toLocaleString()}
                </strong>{" "}
                <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
                  ({spell.percentage.toFixed(1)}%)
                </span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EPTable({ weights }) {
  const entries = Object.entries(weights)
    .filter(([stat, v]) => v !== 0 && !["ub", "gm", "gb", "wt", "wtv"].includes(stat))
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

// Collapsible grid of buff/debuff checkboxes for one category group.
function BuffPanel({ group, state, onChange }) {
  const allOn = group.buffs.every(([key]) => state[key]);
  const allOff = group.buffs.every(([key]) => !state[key]);

  const setAll = (val) => {
    const next = {};
    group.buffs.forEach(([key]) => { next[key] = val; });
    onChange(next);
  };

  return (
    <details style={{ marginBottom: 8, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}>
      <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-dim)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{group.title}</span>
        <span style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "2px 8px", fontSize: 11 }}
            onClick={(e) => { e.preventDefault(); setAll(true); }}
            disabled={allOn}
          >
            All
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: "2px 8px", fontSize: 11 }}
            onClick={(e) => { e.preventDefault(); setAll(false); }}
            disabled={allOff}
          >
            None
          </button>
        </span>
      </summary>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "4px 12px",
        marginTop: 10,
      }}>
        {group.buffs.map(([key, label]) => (
          <label key={key} className="checkbox-container" style={{ fontSize: 12.5 }}>
            <input
              type="checkbox"
              checked={!!state[key]}
              onChange={(e) => onChange({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
    </details>
  );
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [profile,         setProfile]         = useState("");
  const [spec,            setSpec]            = useState("Enhancement Shaman");
  const [targetLvl,       setTargetLvl]       = useState(63);
  const [iterations,      setIterations]      = useState(500);
  const [calculateWeights, setCalculateWeights] = useState(true);
  
  // Extended configuration parameters
  const [fightLength,      setFightLength]     = useState(300);
  const [varyLength,       setVaryLength]      = useState(0);
  const [fightStyle,       setFightStyle]      = useState("Patchwerk");
  const [playerSkill,      setPlayerSkill]     = useState(100);
  const [threads,          setThreads]         = useState(2);
  const [customRaidEvents, setCustomRaidEvents] = useState("");

  // Advanced: lag & RNG
  const [gcdLag,           setGcdLag]          = useState(0.150);
  const [queueLag,         setQueueLag]        = useState(0.075);
  const [channelLag,       setChannelLag]      = useState(0.250);
  const [deterministic,    setDeterministic]   = useState(false);
  const [seed,             setSeed]            = useState(0);
  const [smoothRng,        setSmoothRng]       = useState(false);

  // Advanced: target overrides
  const [targetRace,       setTargetRace]      = useState("");
  const [targetArmor,      setTargetArmor]     = useState(0);
  const [targetHealth,     setTargetHealth]    = useState(0);

  // Raid buffs/debuffs (defaults mirror the engine's own optimal_raid=1 default)
  const [buffState,        setBuffState]       = useState(DEFAULT_BUFF_STATE);
  const [bloodlustEarly,   setBloodlustEarly]  = useState(0);
  const updateBuffs = useCallback((patch) => {
    setBuffState(prev => ({ ...prev, ...patch }));
  }, []);

  const [result,           setResult]          = useState(null);
  const [loading,          setLoading]         = useState(false);
  const [error,            setError]           = useState(null);
  const [showRaw,          setShowRaw]         = useState(false);

  // State to track background cold-starts: "waking", "ready", or "failed"
  const [backendStatus, setBackendStatus] = useState("waking");

  // Automatically ping the health check to wake up Render on page load
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

  // Filter spell tracking logs cleanly when standard run configurations complete
  const spellBreakdown = useMemo(() => {
    if (!result) return [];
    return parseSpellBreakdown(result.rawOutput || result.stdout || "");
  }, [result]);

  // ─── NEW: Robust Client-Side Total DPS Parser ────────────────────────────
  const displayedDps = useMemo(() => {
    if (!result) return "0";
    const rawText = result.rawOutput || result.stdout || "";
    const lines = rawText.split("\n");
    
    for (let i = 0; i < lines.length; i++) {
      // Look explicitly for the block identifying your character sheet
      if (lines[i].trim().startsWith("Player:")) {
        // Inspect the next 2 rows for the core engine DPS statement
        for (let j = 1; j <= 2; j++) {
          if (i + j < lines.length) {
            const match = lines[i + j].trim().match(/DPS:\s*([0-9.]+)/i);
            if (match) {
              return parseFloat(match[1]).toLocaleString(undefined, { 
                minimumFractionDigits: 1, 
                maximumFractionDigits: 1 
              });
            }
          }
        }
      }
    }
    
    // Fallback to the backend value if the regex fails to find the line
    return result.dps || "0";
  }, [result]);

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

    const activePreset = SPEC_PRESETS[spec];
    const scalingParameter = calculateWeights ? (activePreset ? activePreset.scaleOnly : "") : "none";

    try {
      const res = await fetch(`${API_URL}/api/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          options: {
            targetLevel: targetLvl,
            iterations,
            threads,
            scaleOnly: scalingParameter,
            max_time: fightLength,
            vary_combat_length: varyLength,
            fight_style: fightStyle,
            raid_events: customRaidEvents,
            player_skill: playerSkill,
            gcd_lag: gcdLag,
            queue_lag: queueLag,
            channel_lag: channelLag,
            deterministic,
            seed,
            smooth_rng: smoothRng,
            target_race: targetRace,
            target_armor: targetArmor,
            target_health: targetHealth,
            bloodlust_early: bloodlustEarly,
            buffs: buffState,
          },
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
  }, [
    profile, targetLvl, iterations, spec, calculateWeights, fightLength, varyLength,
    fightStyle, playerSkill, threads, customRaidEvents, gcdLag, queueLag, channelLag,
    deterministic, seed, smoothRng, targetRace, targetArmor, targetHealth,
    bloodlustEarly, buffState,
  ]);

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: "0 20px", fontFamily: "var(--sans)", color: "#fff" }}>
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
        .btn-primary:hover:not(:disabled) { opacity: 0.9; }
        .btn-secondary { background: #21262d; color: #c9d1d9; border: 1px solid var(--border); margin-top: 16px; }
        .btn-secondary:hover:not(:disabled) { background: #30363d; }
        .form-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
        .input-field { padding: 8px 12px; border-radius: 6px; background: #1c2128; border: 1px solid var(--border); color: #fff; font-size: 14px; box-sizing: border-box; }
        .input-field:focus { outline: 1px solid var(--amber); border-color: var(--amber); }
        .checkbox-container { display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none; font-size: 14px; color: #fff; grid-column: span 3; margin-top: 8px; }
        .checkbox-container input { cursor: pointer; width: 16px; height: 16px; accent-color: var(--amber); }
      `}</style>

      {/* --- APP HEADER WITH RENDER COLD-START DETECTOR --- */}
      <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: "var(--amber)" }}>SimC Triumvirate Matrix</h1>
        <div style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--text-dim)" }}>
          Server: {backendStatus === "ready" ? "🟢 Ready" : backendStatus === "waking" ? "🟡 Waking Engine..." : "🔴 Disconnected"}
        </div>
      </header>

      {/* --- 1. CLASS SPEC PRESET DROPDOWN MATRIX --- */}
      <div className="form-group">
        <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Class Specialization Preset</label>
        <select 
          value={spec} 
          onChange={(e) => handleSpecChange(e.target.value)}
          className="input-field"
        >
          <optgroup label="Death Knight">
            <option value="Blood Death Knight">Blood</option>
            <option value="Frost Death Knight">Frost</option>
            <option value="Unholy Death Knight">Unholy</option>
          </optgroup>
          <optgroup label="Druid">
            <option value="Balance Druid">Balance</option>
            <option value="Feral Cat Druid">Feral Cat</option>
            <option value="Feral Bear Druid">Feral Bear</option>
          </optgroup>
          <optgroup label="Hunter">
            <option value="Beast Mastery Hunter">Beast Mastery</option>
            <option value="Marksmanship Hunter">Marksmanship</option>
            <option value="Survival Hunter">Survival</option>
          </optgroup>
          <optgroup label="Mage">
            <option value="Arcane Mage">Arcane</option>
            <option value="Fire Mage">Fire</option>
            <option value="Frost Mage">Frost</option>
          </optgroup>
          <optgroup label="Paladin">
            <option value="Retribution Paladin">Retribution</option>
            <option value="Protection Paladin">Protection</option>
          </optgroup>
          <optgroup label="Priest">
            <option value="Shadow Priest">Shadow</option>
          </optgroup>
          <optgroup label="Rogue">
            <option value="Assassination Rogue">Assassination</option>
            <option value="Combat Rogue">Combat</option>
            <option value="Subtlety Rogue">Subtlety</option>
          </optgroup>
          <optgroup label="Shaman">
            <option value="Elemental Shaman">Elemental</option>
            <option value="Enhancement Shaman">Enhancement</option>
          </optgroup>
          <optgroup label="Warlock">
            <option value="Affliction Warlock">Affliction</option>
            <option value="Demonology Warlock">Demonology</option>
            <option value="Destruction Warlock">Destruction</option>
          </optgroup>
          <optgroup label="Warrior">
            <option value="Arms Warrior">Arms</option>
            <option value="Fury Warrior">Fury</option>
          </optgroup>
          <optgroup label="Custom Options">
            <option value="Custom">Custom / Pure DPS Check</option>
          </optgroup>
        </select>
      </div>

      {/* --- 2. COMBAT VARIABLE ADJUSTMENTS --- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px 16px", marginBottom: 16 }}>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Target Level</label>
          <input 
            type="number" 
            value={targetLvl} 
            onChange={(e) => setTargetLvl(parseInt(e.target.value) || 63)} 
            className="input-field" 
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Simulation Iterations</label>
          <input 
            type="number" 
            value={iterations} 
            onChange={(e) => setIterations(parseInt(e.target.value) || 100)} 
            className="input-field" 
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Fight Style</label>
          <select 
            value={fightStyle} 
            onChange={(e) => setFightStyle(e.target.value)} 
            className="input-field"
            style={{ height: "38px" }}
          >
            {FIGHT_STYLE_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Fight Length (sec)</label>
          <input 
            type="number" 
            value={fightLength} 
            onChange={(e) => setFightLength(parseInt(e.target.value) || 150)} 
            className="input-field" 
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Length Variance (sec)</label>
          <input 
            type="number" 
            value={varyLength} 
            onChange={(e) => setVaryLength(parseInt(e.target.value) || 0)} 
            className="input-field" 
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Player Skill (%)</label>
          <input 
            type="number" 
            min="1" 
            max="100" 
            value={playerSkill} 
            onChange={(e) => setPlayerSkill(parseInt(e.target.value) || 100)} 
            className="input-field" 
          />
        </div>
        <div className="form-group" style={{ margin: 0 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Threads</label>
          <input
            type="number"
            min="1"
            max="8"
            value={threads}
            onChange={(e) => setThreads(parseInt(e.target.value) || 1)}
            className="input-field"
          />
        </div>

        <label className="checkbox-container">
          <input 
            type="checkbox" 
            checked={calculateWeights} 
            onChange={(e) => setCalculateWeights(e.target.checked)} 
          />
          Calculate Stat Weights
        </label>
      </div>

      {/* --- 2b. ADVANCED: RAID EVENTS, LAG, RNG, TARGET --- */}
      <details style={{ marginBottom: 16, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-dim)" }}>
          Advanced: Raid Events, Lag &amp; Target Overrides
        </summary>

        <div className="form-group" style={{ marginTop: 12 }}>
          <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>
            Custom Raid Events <span style={{ opacity: 0.6 }}>(appended after the Fight Style preset, e.g. "adds,count=2,cooldown=60,duration=15")</span>
          </label>
          <input
            type="text"
            value={customRaidEvents}
            onChange={(e) => setCustomRaidEvents(e.target.value)}
            placeholder="adds,count=2,cooldown=60,duration=15/stun,cooldown=90,duration=3"
            className="input-field"
            style={{ fontFamily: "var(--mono)", fontSize: 12 }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px 16px", marginTop: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>GCD Lag (sec)</label>
            <input type="number" step="0.01" value={gcdLag} onChange={(e) => setGcdLag(parseFloat(e.target.value) || 0)} className="input-field" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Queue Lag (sec)</label>
            <input type="number" step="0.01" value={queueLag} onChange={(e) => setQueueLag(parseFloat(e.target.value) || 0)} className="input-field" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Channel Lag (sec)</label>
            <input type="number" step="0.01" value={channelLag} onChange={(e) => setChannelLag(parseFloat(e.target.value) || 0)} className="input-field" />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Target Race</label>
            <select value={targetRace} onChange={(e) => setTargetRace(e.target.value)} className="input-field" style={{ height: "38px" }}>
              <option value="">Default (none)</option>
              <option value="humanoid">Humanoid</option>
              <option value="beast">Beast</option>
              <option value="dragonkin">Dragonkin</option>
              <option value="giant">Giant</option>
              <option value="undead">Undead</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Target Armor Override</label>
            <input type="number" value={targetArmor} onChange={(e) => setTargetArmor(parseInt(e.target.value) || 0)} placeholder="0 = engine default" className="input-field" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Target Health Override</label>
            <input type="number" value={targetHealth} onChange={(e) => setTargetHealth(parseInt(e.target.value) || 0)} placeholder="0 = engine default" className="input-field" />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Bloodlust Early Casts</label>
            <input type="number" min="0" max="20" value={bloodlustEarly} onChange={(e) => setBloodlustEarly(parseInt(e.target.value) || 0)} className="input-field" />
          </div>
          <label className="checkbox-container">
            <input type="checkbox" checked={smoothRng} onChange={(e) => setSmoothRng(e.target.checked)} />
            Smooth RNG
          </label>
          <label className="checkbox-container">
            <input type="checkbox" checked={deterministic} onChange={(e) => setDeterministic(e.target.checked)} />
            Deterministic Roll (fixed seed)
          </label>
          {deterministic && (
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>Seed</label>
              <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value) || 0)} className="input-field" />
            </div>
          )}
        </div>
      </details>

      {/* --- 2c. RAID BUFFS / DEBUFFS --- */}
      <details style={{ marginBottom: 16, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px" }} open>
        <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-dim)" }}>
          Raid Buffs &amp; Debuffs <span style={{ opacity: 0.6, fontWeight: 400 }}>(all assumed present by default — uncheck what your raid doesn't bring)</span>
        </summary>
        <div style={{ marginTop: 12 }}>
          {RAID_BUFF_GROUPS.map((group) => (
            <BuffPanel key={group.title} group={group} state={buffState} onChange={updateBuffs} />
          ))}
        </div>
      </details>

      {/* --- 3. PROFILE DATA INPUT --- */}
      <div className="form-group">
        <label style={{ fontSize: 12, color: "var(--text-dim)", fontWeight: 500 }}>TopFit / SimulationCraft Profile Text</label>
        <textarea 
          rows="8" 
          value={profile} 
          onChange={(e) => setProfile(e.target.value)} 
          placeholder="Paste string profile data here..." 
          className="input-field"
          style={{ fontFamily: "var(--mono)", fontSize: 12, resize: "vertical" }}
        />
      </div>

      {/* --- 4. ACTION CONTROLS --- */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 8 }}>
        <button 
          className="btn btn-primary" 
          onClick={handleSimulate} 
          disabled={loading || backendStatus !== "ready"}
        >
          Execute Simulation Matrix
        </button>
        {loading && <Spinner />}
      </div>

      {/* --- 5. RUNTIME ERROR DISPLAY --- */}
      {error && (
        <div style={{ 
          background: "rgba(248,113,113,0.1)", border: "1px solid var(--red)", 
          color: "var(--red)", padding: 12, borderRadius: 6, marginTop: 16, 
          fontFamily: "var(--mono)", fontSize: 13 
        }}>
          Error Matrix: {error}
        </div>
      )}

      {/* --- 6. VISUAL RESULT CARD & STAT WEIGHT TABLES --- */}
      {result && (
        <div style={{ marginTop: 24, border: "1px solid var(--border)", borderRadius: 8, padding: 20, background: "#0d1117" }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 16px 0" }}>Analysis Complete</h2>
          
          <div style={{ fontSize: 32, fontWeight: 800, color: "var(--green)", marginBottom: 20 }}>
            {displayedDps} <span style={{ fontSize: 14, color: "var(--text-dim)", fontWeight: 400 }}>Simulated DPS</span>
          </div>

          {/* Details Spell breakdown panel displays here */}
          <DetailsMeter spells={spellBreakdown} />
          
          {calculateWeights && result.weights && (
            <div style={{ marginTop: 20 }}>
              <h3 style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12, fontWeight: 600 }}>Stat Weights (EP Priorities)</h3>
              <EPTable weights={result.weights} />

              {/* Pawn Import String Export Box */}
              {Object.keys(result.weights).length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <label htmlFor="pawn-string-output" style={{ display: "block", fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: 6 }}>
                    Pawn Import String
                  </label>
                  <textarea
                    id="pawn-string-output"
                    readOnly
                    value={generatePawnString(spec, result.weights)}
                    onClick={(e) => e.target.select()}
                    className="input-field"
                    style={{
                      width: "100%",
                      height: "60px",
                      fontSize: "12px",
                      fontFamily: "var(--mono)",
                      background: "#161b22",
                      color: "var(--amber)",
                      cursor: "pointer",
                      resize: "none"
                    }}
                    placeholder="Pawn string will appear here..."
                  />

                  <label htmlFor="topfit-string-output" style={{ display: "block", fontSize: 12, color: "var(--text-dim)", fontWeight: 500, marginBottom: 6, marginTop: 16 }}>
                    TopFit Import String
                  </label>
                  <textarea
                    id="topfit-string-output"
                    readOnly
                    value={generateTopFitString(spec, result.weights)}
                    onClick={(e) => e.target.select()}
                    className="input-field"
                    style={{
                      width: "100%", height: "60px", fontSize: "12px", fontFamily: "var(--mono)",
                      background: "#161b22", color: "var(--amber)", cursor: "pointer", resize: "none"
                    }}
                  />

                  <span style={{ fontSize: 11, color: "var(--text-dim)", display: "block", marginTop: 6 }}>
                    💡 Click inside the box to highlight and copy for your addon.
                  </span>
                </div>
              )}
            </div>
          )}
          
          <button className="btn btn-secondary" onClick={() => setShowRaw(!showRaw)}>
            {showRaw ? "Hide Raw Debug Log" : "View Raw Console Log"}
          </button>
          
          {showRaw && (
            <pre style={{ 
              background: "#161b22", padding: 12, borderRadius: 6, marginTop: 12, 
              overflowX: "auto", fontSize: 12, fontFamily: "var(--mono)", color: "#c9d1d9" 
            }}>
              {result.rawOutput || result.stdout || JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}