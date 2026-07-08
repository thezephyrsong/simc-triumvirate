// server.js — Express API wrapping the simc binary
// POST /api/simulate  { profile: string, options: { ... } }
// GET  /api/health

const express = require("express");
const cors    = require("cors");
const { execFile } = require("child_process");
const fs   = require("fs");
const path = require("path");
const os   = require("os");
const crypto = require("crypto");

const app  = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_ORIGINS = [
  /^https:\/\/[\w-]+\.github\.io$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const ok = ALLOWED_ORIGINS.some(r => r.test(origin));
    cb(ok ? null : new Error("Not allowed by CORS"), ok);
  }
}));

app.use(express.json({ limit: "64kb" }));

const SIMC_BIN = process.env.SIMC_BIN
  || path.join(__dirname, "..", "simc");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sanitizeInt(val, def, min, max) {
  const n = parseInt(val, 10);
  if (isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
}

function sanitizeFloat(val, def, min, max) {
  const n = parseFloat(val);
  if (isNaN(n)) return def;
  return Math.min(Math.max(n, min), max);
}

function sanitizeBool(val, def) {
  if (typeof val === "boolean") return val;
  if (val === "1" || val === 1) return true;
  if (val === "0" || val === 0) return false;
  return def;
}

// NOTE: this engine is a WotLK-era (simc-335-1) fork. It has no "fight_style"
// concept (that was added to SimulationCraft much later) and no global
// "skill" option (the global knob is "default_skill"; "skill" only exists as
// a per-player / per-raid-event option). Both of those were the source of
// the "Unknown option/value pair" errors. Instead, encounter variety here is
// achieved via `raid_events=`, so we translate a friendly "fight style" name
// into a raid_events string understood by sc_raid_event.cpp.
const FIGHT_STYLE_RAID_EVENTS = {
  Patchwerk:      "",
  HelterSkelter:  "movement,cooldown=20,cooldown_stddev=3,duration=4,duration_stddev=1/stun,cooldown=45,duration=2",
  Ultraxion:      "movement,cooldown=40,duration=5/stun,cooldown=90,duration=3",
  LightMovement:  "movement,cooldown=30,duration=3,players_only=1",
  HeavyMovement:  "movement,cooldown=12,duration=5,players_only=1",
};
const VALID_FIGHT_STYLES = new Set(Object.keys(FIGHT_STYLE_RAID_EVENTS));

// Only these characters are allowed in a user-supplied raid_events string:
// letters, numbers, comma, equals, slash/backslash, period, underscore, minus.
const RAID_EVENTS_SAFE = /^[a-zA-Z0-9,=\/\\._\-\s>]*$/;

// target_race values that are actually implemented correctly in
// util_t::race_type_string (demon/elemental are registered as options but
// fall through to "unknown" in this fork, so they're deliberately excluded).
const VALID_TARGET_RACES = new Set(["none", "humanoid", "beast", "dragonkin", "giant", "undead"]);

// Every `override.*` buff/debuff option registered in sim_t::get_options().
// (hellscreams_warsong / strength_of_wrynn are registered but hardcoded to 0
// inside use_optimal_buffs_and_debuffs — i.e. non-functional in this fork —
// so they're intentionally left out here. expose_armor is set by that same
// function but was never given a CLI option, so it can't be toggled at all.)
const VALID_BUFF_KEYS = new Set([
  "abominations_might", "arcane_brilliance", "arcane_empowerment", "battle_shout",
  "bleeding", "blessing_of_kings", "blessing_of_might", "blessing_of_wisdom",
  "blood_frenzy", "blood_plague", "bloodlust", "celerity", "commanding_shout",
  "crypt_fever", "curse_of_elements", "devotion_aura", "divine_spirit",
  "earth_and_moon", "ebon_plaguebringer", "elemental_oath", "faerie_fire",
  "ferocious_inspiration", "flametongue_totem", "focus_magic", "fortitude",
  "frost_fever", "heart_of_the_crusader", "heroic_presence", "horn_of_winter",
  "hunters_mark", "improved_faerie_fire", "improved_icy_talons",
  "improved_moonkin_aura", "improved_scorch", "improved_shadow_bolt",
  "infected_wounds", "insect_swarm", "judgement_of_wisdom",
  "judgements_of_the_just", "leader_of_the_pack", "mana_spring_totem",
  "mangle", "mark_of_the_wild", "master_poisoner", "misery", "moonkin_aura",
  "poisoned", "rampage", "replenishment", "sanctified_retribution",
  "savage_combat", "scorpid_sting", "strength_of_earth", "sunder_armor",
  "swift_retribution", "thunder_clap", "totem_of_wrath", "trauma",
  "trueshot_aura", "unleashed_rage", "windfury_totem", "winters_chill",
  "wrath_of_air",
]);

// Parse simc stdout for DPS and scale factors.
// simc 335-1 outputs scale factors in the format:
//   Gains (EP):
//     Agi=1.23  AP=0.45  Hit=2.34 ...
function parseSimcOutput(stdout) {
  const result = { dps: null, weights: {}, raw: stdout };

  // DPS: look for "DPS=12345.67" anywhere in output
  const dpsMatch = stdout.match(/\bDPS=([0-9.]+)/);
  if (dpsMatch) result.dps = parseFloat(dpsMatch[1]);

  // Scale factors — try "Scale Factors:" block first (space-separated key=val)
  const sfBlock = stdout.match(/Scale Factors:([\s\S]*?)(?:\n\n|\nSimulation|\nDPS Ranking|$)/);
  if (sfBlock) {
    const tokens = sfBlock[1].match(/(\w+)=([0-9.+-]+)/g) || [];
    tokens.forEach(t => {
      const [k, v] = t.split("=");
      result.weights[k] = parseFloat(v);
    });
  }

  // Fallback: "Gains (EP):" columnar table
  if (Object.keys(result.weights).length === 0) {
    const epMatch = stdout.match(/Gains \(EP\):([\s\S]*?)(?:\n\n|$)/);
    if (epMatch) {
      const tokens = epMatch[1].match(/(\w+)=([0-9.+-]+)/g) || [];
      tokens.forEach(t => {
        const [k, v] = t.split("=");
        result.weights[k] = parseFloat(v);
      });
      // Also try whitespace-separated rows
      if (Object.keys(result.weights).length === 0) {
        epMatch[1].split("\n").forEach(row => {
          const parts = row.trim().split(/\s+/);
          if (parts.length >= 2 && !isNaN(parseFloat(parts[1]))) {
            result.weights[parts[0]] = parseFloat(parts[1]);
          }
        });
      }
    }
  }

  return result;
}

// Build the full .simc profile from the user's TopFit export + sim options.
// All simc global options go in the header before the character block.
function buildProfile(exportText, options) {
  const {
    targetLevel,
    iterations,
    threads,
    scaleOnly,
    maxTime,
    varyCombatLength,
    raidEvents,
    defaultSkill,
    calculateWeights,
    seed,
    deterministic,
    smoothRng,
    gcdLag,
    queueLag,
    channelLag,
    targetRace,
    targetArmor,
    targetHealth,
    bloodlustEarly,
    buffs,
  } = options;

  const lines = [
    `# Generated by simc-triumvirate`,
    `iterations=${iterations}`,
    `threads=${threads}`,
    `target_level=${targetLevel}`,
    `max_time=${maxTime}`,
    `vary_combat_length=${varyCombatLength}`,
    `default_skill=${defaultSkill.toFixed(2)}`,
  ];

  if (raidEvents) {
    lines.push(`raid_events=${raidEvents}`);
  }

  // Lag / reaction settings
  lines.push(`gcd_lag=${gcdLag}`);
  lines.push(`queue_lag=${queueLag}`);
  lines.push(`channel_lag=${channelLag}`);

  // RNG determinism (useful for reproducible A/B gear comparisons)
  lines.push(`smooth_rng=${smoothRng ? 1 : 0}`);
  if (deterministic) {
    lines.push(`deterministic_roll=1`);
    lines.push(`seed=${seed}`);
  }

  // Target overrides
  if (targetRace) lines.push(`target_race=${targetRace}`);
  if (targetArmor > 0) lines.push(`target_armor=${targetArmor}`);
  if (targetHealth > 0) lines.push(`target_health=${targetHealth}`);

  // Raid buff / debuff overrides (only emit keys the client actually sent,
  // sanitized against the whitelist of options the engine registers)
  if (buffs && typeof buffs === "object") {
    for (const key of Object.keys(buffs)) {
      if (!VALID_BUFF_KEYS.has(key)) continue;
      lines.push(`override.${key}=${buffs[key] ? 1 : 0}`);
    }
  }
  if (bloodlustEarly > 0) {
    lines.push(`override.bloodlust_early=${bloodlustEarly}`);
  }

  if (calculateWeights) {
    lines.push(`calculate_scale_factors=1`);
    if (scaleOnly && scaleOnly !== "none") {
      lines.push(`scale_only=${scaleOnly}`);
    }
  } else {
    lines.push(`calculate_scale_factors=0`);
  }

  lines.push(``); // blank line before character block
  return lines.join("\n") + exportText;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, simc: SIMC_BIN });
});

app.post("/api/simulate", (req, res) => {
  const { profile: rawProfile, options: rawOptions = {} } = req.body || {};

  if (!rawProfile || typeof rawProfile !== "string") {
    return res.status(400).json({ error: "Missing profile text" });
  }
  if (rawProfile.length > 32768) {
    return res.status(400).json({ error: "Profile too large (max 32KB)" });
  }

  // Sanitize and validate all options
  const fightStyle = VALID_FIGHT_STYLES.has(rawOptions.fight_style)
    ? rawOptions.fight_style
    : "Patchwerk";

  // Custom raid_events string (advanced/optional), character-whitelisted.
  let customRaidEvents = "";
  if (typeof rawOptions.raid_events === "string" && rawOptions.raid_events.length <= 500) {
    if (RAID_EVENTS_SAFE.test(rawOptions.raid_events)) {
      customRaidEvents = rawOptions.raid_events.trim();
    }
  }
  const presetRaidEvents = FIGHT_STYLE_RAID_EVENTS[fightStyle] || "";
  const raidEvents = [presetRaidEvents, customRaidEvents].filter(Boolean).join("/");

  const targetRace = VALID_TARGET_RACES.has(rawOptions.target_race)
    ? rawOptions.target_race
    : "";

  // Sanitize buffs map: only pass through recognized override.* keys
  const buffs = {};
  if (rawOptions.buffs && typeof rawOptions.buffs === "object") {
    for (const [key, val] of Object.entries(rawOptions.buffs)) {
      if (VALID_BUFF_KEYS.has(key)) buffs[key] = sanitizeBool(val, true);
    }
  }

  const options = {
    targetLevel:      sanitizeInt(rawOptions.targetLevel,       63,   1,  83),
    iterations:       sanitizeInt(rawOptions.iterations,        5000, 100, 50000),
    threads:          sanitizeInt(rawOptions.threads,           2,    1,  8),
    maxTime:          sanitizeInt(rawOptions.max_time,          300,  30, 3600),
    varyCombatLength: sanitizeFloat(rawOptions.vary_combat_length, 0, 0, 60),
    defaultSkill:     sanitizeFloat(rawOptions.player_skill, 100, 1, 100) / 100,
    raidEvents,
    scaleOnly:        typeof rawOptions.scaleOnly === "string" ? rawOptions.scaleOnly : "",
    calculateWeights: rawOptions.calculateWeights !== false,
    seed:             sanitizeInt(rawOptions.seed, 0, 0, 2147483647),
    deterministic:    sanitizeBool(rawOptions.deterministic, false),
    smoothRng:        sanitizeBool(rawOptions.smooth_rng, false),
    gcdLag:           sanitizeFloat(rawOptions.gcd_lag, 0.150, 0, 2),
    queueLag:         sanitizeFloat(rawOptions.queue_lag, 0.075, 0, 2),
    channelLag:       sanitizeFloat(rawOptions.channel_lag, 0.250, 0, 2),
    targetRace,
    targetArmor:      sanitizeInt(rawOptions.target_armor, 0, 0, 20000),
    targetHealth:     sanitizeInt(rawOptions.target_health, 0, 0, 100000000),
    bloodlustEarly:   sanitizeInt(rawOptions.bloodlust_early, 0, 0, 20),
    buffs,
  };

  const profileText = buildProfile(rawProfile, options);

  // Write temp file, run simc, cleanup
  const tmpFile = path.join(os.tmpdir(), `simc-${crypto.randomUUID()}.simc`);
  fs.writeFileSync(tmpFile, profileText, "utf8");

  // Timeout: more iterations + scale factors = more time needed
  const sfMultiplier = options.calculateWeights ? (options.scaleOnly.split(",").length || 1) + 1 : 1;
  const timeout = Math.max(60000, options.iterations * sfMultiplier * 5);

  console.log(`[sim] ${fightStyle} ${options.maxTime}s target=${options.targetLevel} iter=${options.iterations} sf=${options.calculateWeights}`);

  execFile(SIMC_BIN, [tmpFile], { timeout }, (err, stdout, stderr) => {
    fs.unlink(tmpFile, () => {});

    if (err && !stdout) {
      console.error("simc error:", err.message, stderr?.slice(0, 500));
      return res.status(500).json({
        error: "Simulation failed",
        detail: stderr || err.message,
      });
    }

    const parsed = parseSimcOutput(stdout);
    res.json({
      ok: true,
      dps: parsed.dps,
      weights: parsed.weights,
      rawOutput: stdout,
    });
  });
});

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`simc-triumvirate backend running on port ${PORT}`);
  console.log(`simc binary: ${SIMC_BIN}`);
});
