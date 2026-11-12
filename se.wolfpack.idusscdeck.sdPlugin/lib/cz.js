// Contested Zone executive-hangar cycle.
//
// The cycle math, light table, source parsing and sanity checks are adapted from CZ Timer for
// OpenDeck (https://github.com/NyleGarcia/cztimer-opendeck), Copyright (c) 2026 Nyle Garcia,
// used under the MIT License. The full license text is in THIRD_PARTY_NOTICES.md.
//
// Cycle data comes from cztimer.com and exec.xyxyll.com (primary/secondary, user's choice),
// then the last good copy on disk, then the built-in values below.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const UA = "Idus-SC-Deck (+https://github.com/Idus/idus-sc-deck)";
const SYNC_MS = 15 * 60 * 1000;
const NOMINAL_OPEN = 65 * 60 * 1000;
const NOMINAL_CLOSE = 120 * 60 * 1000;
// Values both sources reported on 2026-11-12. Only used until the first successful sync.
const BUILTIN = { initialOpenTime: Date.parse("2026-10-29T22:01:09.073Z"), openDuration: 3900123, closeDuration: 7200227 };

const { STATE_DIR } = require("./paths");
const STATE_FILE = path.join(STATE_DIR, "cz.json");

function validConfig(c) {
  return !!c && Number.isFinite(c.openDuration) && Math.abs(c.openDuration - NOMINAL_OPEN) < NOMINAL_OPEN * 0.05 &&
    Number.isFinite(c.closeDuration) && Math.abs(c.closeDuration - NOMINAL_CLOSE) < NOMINAL_CLOSE * 0.05 &&
    Number.isFinite(c.initialOpenTime) && c.initialOpenTime > Date.UTC(2020, 0, 1) &&
    c.initialOpenTime < Date.now() + 366 * 86400000;
}
const pick = (c) => ({ initialOpenTime: c.initialOpenTime, openDuration: c.openDuration, closeDuration: c.closeDuration });

const parseCztimer = (text) => pick(JSON.parse(text));

// exec.xyxyll.com has no JSON feed: read the constants out of its app.js and redo its math.
function parseXyxyll(src) {
  const constant = (name) => {
    const m = src.match(new RegExp(`const\\s+${name}\\s*=\\s*(-?[\\d.]+)\\s*;`));
    return m ? Number(m[1]) : NaN;
  };
  const on = constant("DESIGN_ONLINE_MIN");
  const off = constant("DESIGN_OFFLINE_MIN");
  const drift = constant("CYCLE_DRIFT_MS") || 0;
  const at = src.match(/INITIAL_OPEN_TIME\s*=\s*new Date\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  if (!at || !(on > 0) || !(off > 0)) throw new Error("constants not found");
  const design = (on + off) * 60000;
  const cycle = design + drift;
  const open = Math.round(cycle * (on * 60000) / design);
  return { initialOpenTime: Date.parse(at[1]), openDuration: open, closeDuration: cycle - open };
}

const SOURCES = {
  cztimer: { url: "https://cztimer.com/timer-config.json", parse: parseCztimer, name: "cztimer.com" },
  xyxyll: { url: "https://exec.xyxyll.com/app.js", parse: parseXyxyll, name: "exec.xyxyll.com" },
};

const sync = { config: { ...BUILTIN }, from: "built-in", syncedAt: 0, error: "", primary: "cztimer", busy: null };

function load() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (validConfig(s.config)) Object.assign(sync, { config: pick(s.config), from: `${s.from || "?"} (saved)`, syncedAt: Number(s.syncedAt) || 0 });
    if (SOURCES[s.primary]) sync.primary = s.primary;
  } catch { /* first run */ }
}
function save() {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ config: sync.config, from: sync.from.replace(/ \(saved\)$/, ""),
      syncedAt: sync.syncedAt, primary: sync.primary }, null, 2));
  } catch { /* read-only home? keep going */ }
}

async function fetchText(url) {
  const res = await fetch(url, { cache: "no-store", headers: { "user-agent": UA }, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Primary first, then the other source. Concurrent calls share one attempt.
function resync() {
  if (sync.busy) return sync.busy;
  const order = sync.primary === "xyxyll" ? ["xyxyll", "cztimer"] : ["cztimer", "xyxyll"];
  sync.busy = (async () => {
    const errors = [];
    for (const key of order) {
      const src = SOURCES[key];
      try {
        const c = src.parse(await fetchText(src.url));
        if (!validConfig(c)) throw new Error("values out of range");
        Object.assign(sync, { config: c, from: src.name, syncedAt: Date.now(), error: "" });
        save();
        return true;
      } catch (e) { errors.push(`${src.name}: ${e.message}`); }
    }
    sync.error = errors.join("; ");
    return false;
  })().finally(() => { sync.busy = null; });
  return sync.busy;
}

function setPrimary(p) {
  if (!SOURCES[p] || p === sync.primary) return false;
  sync.primary = p;
  save();
  return true;
}

// Light table (fixed ms into the cycle): open 0–60 min five green, one dark every 12 min;
// 60–65 min all dark; closed from 65 min five red, one green every 24 min.
const LIGHTS = 5, OPEN_STEP = 720000, OPEN_LIT_END = 3600000, CLOSED_START = 3900000, CLOSED_STEP = 1440000;
const CLOSED_END = CLOSED_START + CLOSED_STEP * LIGHTS;
const row = (fn) => Array.from({ length: LIGHTS }, (_, i) => fn(i));
function lightsAt(e) {
  if (e < OPEN_LIT_END) { const lit = LIGHTS - Math.floor(e / OPEN_STEP); return row((i) => (i < lit ? "green" : "off")); }
  if (e < CLOSED_START) return row(() => "off");
  if (e < CLOSED_END) { const g = Math.floor((e - CLOSED_START) / CLOSED_STEP); return row((i) => (i < g ? "green" : "red")); }
  return row(() => "off");
}

// -> { phase: open|closing|closed, secs, nextChange (ms epoch), lights }
function phaseAt(now = Date.now()) {
  const { initialOpenTime: t0, openDuration: open, closeDuration: close } = sync.config;
  const cycle = open + close;
  const e = (((now - t0) % cycle) + cycle) % cycle;
  const online = e < open;
  const remaining = online ? open - e : cycle - e;
  return {
    phase: online ? (e >= OPEN_LIT_END ? "closing" : "open") : "closed",
    secs: Math.max(0, Math.ceil(remaining / 1000)),
    nextChange: now + remaining,
    lights: lightsAt(e),
  };
}

load();
module.exports = { sync, SYNC_MS, resync, setPrimary, phaseAt, SOURCES };
