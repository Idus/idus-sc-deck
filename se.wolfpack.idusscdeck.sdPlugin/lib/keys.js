// Idus SC Deck — key renderer.
// Every key is a 144×144 SVG in the Idus palette. The orange tab top-left names the family
// (TIME, CZ, STAT, LOG, PLAY, TOOL) and is on every key. OpenDeck draws SVG data URIs through
// its webview, so the Idus fonts are used when installed and fall back otherwise.
"use strict";

const C = {
  bg: "#16181d", surface: "#1e222b", deep: "#0f1115", line: "#2a2f3a",
  fg: "#e8eaed", muted: "#8a93a3", soft: "#9fb4d4", dim: "#5a6270",
  title: "#ffd9a0", accent: "#ff9a3c", ok: "#46d160", warn: "#ffb13c", error: "#e0525b",
  btn: "#262b36",
};
const DISPLAY = "Saira, 'Segoe UI', sans-serif";
const BODY = "'IBM Plex Sans', 'Noto Sans', sans-serif";
const MONO = "'JetBrains Mono', 'DejaVu Sans Mono', monospace";

// RSI status words -> Idus status colour + short word that fits a key
const STATE = {
  operational: { color: C.ok, word: "Online" },
  degraded: { color: C.warn, word: "Degraded" },
  partial: { color: C.warn, word: "Partial" },
  maintenance: { color: C.soft, word: "Maint." },
  major: { color: C.error, word: "Outage" },
  unknown: { color: C.dim, word: "No data" },
};
const state = (s) => STATE[String(s || "").toLowerCase()] || STATE.unknown;

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const clip = (t, n) => (String(t).length > n ? String(t).slice(0, n - 1) + "…" : String(t));

function frame(inner, { fill = C.deep, stroke = C.line, strokeWidth = 1.5 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">` +
    `<rect width="144" height="144" fill="${C.bg}"/>` +
    `<rect x="4.5" y="4.5" width="135" height="135" rx="16" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>` +
    inner + `</svg>`;
}

// ---- header: orange family tab + short label (+ optional status lamp)
function tab(family) {
  const w = String(family).length * 7.3 + 14;
  return { w, svg: `<rect x="13" y="15" width="${w.toFixed(1)}" height="21" rx="6" fill="${C.surface}" stroke="${C.accent}" stroke-width="1.3"/>` +
    `<text x="${(13 + w / 2).toFixed(1)}" y="29.5" text-anchor="middle" font-family="${MONO}" font-weight="700" font-size="11" letter-spacing="0.8" fill="${C.accent}">${esc(family)}</text>` };
}
// Keeps the label at 14 px as long as possible: tightens the spacing first, never below 11 px.
function fitLabel(label, x, maxX) {
  const n = String(label).length, max = maxX - x;
  let size = 14, ls = 1;
  while (ls > 0.3 && n * (size * 0.6 + ls) > max) ls -= 0.1;
  while (size > 11 && n * (size * 0.6 + ls) > max) size -= 0.5;
  return `<text x="${x.toFixed(1)}" y="31" font-family="${MONO}" font-weight="600" font-size="${size}" letter-spacing="${ls.toFixed(1)}" fill="${C.muted}">${esc(label)}</text>`;
}
const lamp = (color) => `<circle cx="124" cy="26" r="10.5" fill="${color}" opacity="0.18"/><circle cx="124" cy="26" r="6" fill="${color}"/>`;
function head(family, label, lampColor) {
  const t = tab(family);
  return t.svg + (label ? fitLabel(label, 13 + t.w + 7, lampColor ? 106 : 132) : "") + (lampColor ? lamp(lampColor) : "");
}

// ---- body helpers
function sairaWidth(text) {
  let w = 0;
  for (const ch of String(text)) {
    if (".:,'·".includes(ch)) w += 0.26;
    else if (/[0-9A-Z$+%#]/.test(ch)) w += 0.6;
    else if (/[mw]/.test(ch)) w += 0.78;
    else if (ch === " ") w += 0.25;
    else w += 0.52;
  }
  return w;
}
function value(text, size = 30, color = C.fg, y = 84) {
  const fit = Math.max(16, Math.min(size, Math.floor(108 / Math.max(sairaWidth(text), 0.1))));
  return `<text x="18" y="${y}" font-family="${DISPLAY}" font-weight="700" font-size="${fit}" fill="${color}">${esc(text)}</text>`;
}
function detail(text, dotColor, y = 118) {
  const x = dotColor ? 33 : 18;
  return (dotColor ? `<circle cx="22" cy="${y - 5}" r="5" fill="${dotColor}"/>` : "") +
    `<text x="${x}" y="${y}" font-family="${BODY}" font-weight="500" font-size="13" fill="${C.soft}">${esc(clip(text, dotColor ? 14 : 16))}</text>`;
}
const mono = (text, y, color = C.soft, size = 12) =>
  `<text x="18" y="${y}" font-family="${MONO}" font-weight="600" font-size="${size}" fill="${color}">${esc(clip(text, 15))}</text>`;

// Generic notice (no data, not installed, errors)
function notice({ family, label, word, sub, color = C.dim }) {
  return frame(head(family, label, color) + value(word, 26) + detail(sub));
}

// ================================================================ TIME
// World clock for a server region. Digit colour follows the region's time of day (clock-based,
// not live load data): evening 17–22 = warn, night 23–06 = soft, day = fg. UTC stays fg.
// Time and day line are centred; the digits are as big as the key allows. Saira's own digit
// widths (per em) give the natural width, textLength pins it so it never touches the frame —
// also when Saira is missing and a fallback font is used.
const SAIRA_DIGIT = { 0: 0.66, 1: 0.40, 2: 0.61, 3: 0.61, 4: 0.65, 5: 0.63, 6: 0.66, 7: 0.57, 8: 0.68, 9: 0.66, ":": 0.30 };
function bigTime(text, color, { size = 48, y = 88, max = 118, squeeze = 0.93 } = {}) {
  let w = 0;
  for (const ch of String(text)) w += (SAIRA_DIGIT[ch] ?? 0.6) * size;
  const len = Math.min(w * squeeze, max);
  return `<text x="${(72 - len / 2).toFixed(1)}" y="${y}" font-family="${DISPLAY}" font-weight="700" font-size="${size}" ` +
    `textLength="${len.toFixed(1)}" lengthAdjust="spacingAndGlyphs" fill="${color}">${esc(text)}</text>`;
}
function clock({ label, time, sub, color = C.fg }) {
  return frame(head("TIME", label) + bigTime(time, color) +
    `<text x="72" y="118" text-anchor="middle" font-family="${BODY}" font-weight="500" font-size="13.5" fill="${C.soft}">${esc(clip(sub, 18))}</text>`);
}

// ================================================================ CZ
// Executive hangar on ONE key. phase: closed | open | closing | sync; secs to next change;
// at: local clock time of it; lights: five of green | red | off.
// (Cycle math and light table follow cztimer.com, via CZ Timer for OpenDeck, MIT.)
function cz({ phase, secs, at, lights }) {
  const P = {
    closed: { label: "CLOSED", color: C.error, verb: "OPENS" },
    open: { label: "OPEN", color: C.ok, verb: "CLOSES" },
    closing: { label: "CLOSING", color: C.warn, verb: "CLOSES" },
    sync: { label: "SYNC…", color: C.dim, verb: "" },
  }[phase] || { label: "—", color: C.dim, verb: "" };
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const pad = (n) => String(n).padStart(2, "0");
  const big = h > 0 ? `${h}:${pad(m)}` : `${pad(m)}:${pad(s)}`;
  const small = h > 0 ? `:${pad(s)}` : "";
  const t = tab("CZ");
  const px = 13 + t.w + 6;
  const plate = `<rect x="${px.toFixed(1)}" y="15" width="${(131 - px).toFixed(1)}" height="21" rx="10.5" fill="${C.surface}" stroke="${P.color}" stroke-width="1.5"/>` +
    `<text x="${((px + 131) / 2).toFixed(1)}" y="30" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="12" letter-spacing="0.5" fill="${P.color}">${P.label}</text>`;
  const clockText = `<text x="72" y="81" text-anchor="middle" font-family="${DISPLAY}" font-weight="700" fill="${C.fg}">` +
    `<tspan font-size="38">${big}</tspan>` + (small ? `<tspan font-size="22" fill="${C.muted}">${small}</tspan>` : "") + `</text>`;
  const when = P.verb ? `<text x="72" y="104" text-anchor="middle">` +
    `<tspan font-family="${MONO}" font-weight="600" font-size="11" letter-spacing="1" fill="${C.muted}">${P.verb} </tspan>` +
    `<tspan font-family="${DISPLAY}" font-weight="700" font-size="18" fill="${C.soft}">${esc(at)}</tspan></text>` : "";
  const dots = lights.slice(0, 5).map((l, i) => {
    const x = 30 + i * 21;
    if (l === "green") return `<circle cx="${x}" cy="123" r="7" fill="${C.ok}"/>`;
    if (l === "red") return `<circle cx="${x}" cy="123" r="7" fill="${C.error}"/>`;
    return `<circle cx="${x}" cy="123" r="6" fill="none" stroke="${C.dim}" stroke-width="2"/>`;
  }).join("");
  return frame(t.svg + plate + clockText + when + dots);
}

// ================================================================ STAT
// One RSI service per key: PU / AC / PLAT
function component({ label, name, status, incident }) {
  const st = state(status);
  return frame(head("STAT", label, st.color) + value(st.word) + detail(incident || name));
}
// All three services on one key
function servers(rows) {
  const colors = rows.map((r) => state(r.status).color);
  const worst = colors.find((c) => c === C.error) || colors.find((c) => c === C.warn) || C.ok;
  const body = rows.slice(0, 3).map((r, i) => {
    const y = 62 + i * 26;
    return `<circle cx="22" cy="${y - 5}" r="5.5" fill="${state(r.status).color}"/>` +
      `<text x="35" y="${y}" font-family="${BODY}" font-weight="600" font-size="16" fill="${C.fg}">${esc(clip(r.name, 11))}</text>`;
  }).join("");
  return frame(head("STAT", "RSI", worst) + body);
}
// Installed game version per channel; orange lamp = patched since you last pressed it
// dot: green = same as the newest release notes, amber = a newer version is out, none = unknown
function version({ label, version: v, sub, dot, isNew }) {
  return frame(head("STAT", label, isNew ? C.accent : null) + value(v || "—", 34) +
    detail(isNew ? "new · press" : sub, isNew ? C.accent : dot));
}
// Crowdfunding total with yesterday's amount
function funding({ total, today }) {
  return frame(head("STAT", "FUNDS") + value(total, 27) + detail(today, C.soft));
}
// VRAM in use (nvidia-smi) with bar; detail = biggest non-SC consumer
function vram({ used, total, top }) {
  const pct = Math.max(0, Math.min(1, used / total));
  const fill = pct > 0.85 ? C.warn : C.soft;
  return frame(head("STAT", "VRAM", pct > 0.85 ? C.warn : null) +
    value(`${used.toFixed(1)}/${total} GB`, 26) +
    `<rect x="18" y="94" width="108" height="8" rx="4" fill="${C.line}"/>` +
    `<rect x="18" y="94" width="${Math.round(108 * pct)}" height="8" rx="4" fill="${fill}"/>` +
    `<text x="18" y="124" font-family="${BODY}" font-weight="500" font-size="13" fill="${C.soft}">${esc(clip(top, 16))}</text>`);
}

// ================================================================ LOG (from Game.log)
// where: { inPU, running, region, shardNo, shardCode, build, since } ; show: server | region | shard
function server({ show = "server", where }) {
  const label = { server: "SERVER", region: "REGION", shard: "SHARD" }[show] || "SERVER";
  if (!where.running || !where.inPU) {
    const why = !where.running ? "game not running" : "in menu";
    return frame(head("LOG", label, C.dim) + value("—", 34, C.dim, 72) + detail(why));
  }
  if (show === "region") return frame(head("LOG", label, C.ok) + value(where.region, 40) + detail(`#${where.shardNo} · ${where.since}`));
  if (show === "shard") {
    return frame(head("LOG", label, C.ok) + value(`#${where.shardNo}`, 40, C.fg, 82) +
      mono(where.shardCode, 104) + mono(where.build, 120, C.muted));
  }
  return frame(head("LOG", label, C.ok) + value(where.region, 34, C.fg, 72) +
    mono(`Shard ${where.shardNo}`, 96, C.fg, 14) + detail(`here for ${where.since}`));
}
// zone: armistice | outside | unknown
function zone({ zone: z, running, inPU }) {
  if (!running || !inPU || z === "unknown") {
    return frame(head("LOG", "ZONE", C.dim) + value("—", 30, C.dim) + detail(!running ? "game not running" : !inPU ? "in menu" : "no zone yet"));
  }
  if (z === "armistice") {
    return frame(head("LOG", "ZONE", C.ok) + value("Armistice", 30) + detail("weapons locked", C.ok), { stroke: C.ok, strokeWidth: 2 });
  }
  return frame(head("LOG", "ZONE", C.warn) + value("Outside", 30) + detail("weapons hot", C.warn));
}
// Unexpected disconnects this game session
function thirtyK({ count, last, running }) {
  const color = count >= 3 ? C.error : count >= 1 ? C.warn : running ? C.ok : C.dim;
  return frame(head("LOG", "30K", color) + value(String(count), 44) +
    detail(count ? `last ${last}` : running ? "none yet" : "game not running", count ? color : null));
}

// ================================================================ PLAY
// Original emblem: a small rocket (echoes the Idus SC Toolbox icon motif). Not a game logo.
function rocket(cx = 72, cy = 62, scale = 1) {
  return `<g transform="translate(${cx} ${cy}) rotate(45) scale(${scale})">` +
    `<path d="M-9 4 L-18 19 L-9 16 Z M9 4 L18 19 L9 16 Z" fill="${C.soft}"/>` +
    `<path d="M-5 16 L0 28 L5 16 Z" fill="${C.title}"/>` +
    `<path d="M0 -32 C10 -21 11 -6 9 16 L-9 16 C-11 -6 -10 -21 0 -32 Z" fill="${C.fg}"/>` +
    `<circle cx="0" cy="-11" r="4.5" fill="${C.deep}"/></g>`;
}
// Optional user image instead of the rocket (data: URI)
function emblem(image) {
  return image ? `<image href="${image}" x="40" y="40" width="64" height="52" preserveAspectRatio="xMidYMid meet"/>` : rocket();
}
// Launch key: dark key with emblem; only the bottom plate is orange (the one primary action)
function launch({ running, channel = "LIVE", session, image }) {
  const top = head("PLAY", channel) + emblem(image);
  if (!running) {
    return frame(top +
      `<rect x="12" y="97" width="120" height="33" rx="10" fill="${C.accent}"/>` +
      `<path d="M24 105.5 L24 121.5 L37 113.5 Z" fill="${C.bg}"/>` +
      `<text x="84" y="119.5" text-anchor="middle" font-family="${DISPLAY}" font-weight="700" font-size="18" letter-spacing="1" fill="${C.bg}">LAUNCH</text>`);
  }
  return frame(top +
    `<rect x="12" y="97" width="120" height="33" rx="10" fill="${C.surface}" stroke="${C.ok}" stroke-width="1.5"/>` +
    `<circle cx="25" cy="113.5" r="4" fill="${C.ok}"/>` +
    `<text x="34" y="117.5" font-family="${MONO}" font-weight="600" font-size="10" fill="${C.ok}">RUNNING</text>` +
    `<text x="124" y="119.5" text-anchor="end" font-family="${DISPLAY}" font-weight="700" font-size="18" fill="${C.fg}">${esc(session)}</text>`,
    { stroke: C.ok, strokeWidth: 2 });
}

// ================================================================ TOOL
// Idus SC Toolbox action (runs `idus-sc-toolbox --<flag>`); Toolbox icon top right.
// Dangerous actions take three presses: step 1 "Really?", step 2 "Sure?" (red), then it runs.
function toolbox({ word, sub, subColor, icon, step = 0, short = "", busy }) {
  const top = head("TOOL", "") + (icon ? `<image href="${icon}" x="104" y="10" width="30" height="30"/>` : "");
  if (step) {
    const left = step === 1 ? "2 more" : "1 more";
    return frame(top + value(step === 1 ? "Really?" : "Sure?", 32, C.error) +
      `<text x="18" y="118" font-family="${BODY}" font-weight="600" font-size="13" fill="${C.error}">${esc(clip(`${short} · ${left}`, 17))}</text>`,
      { stroke: C.error, strokeWidth: 2 });
  }
  if (busy) return frame(top + value(word) + detail("running…", C.soft));
  return frame(top + value(word) + detail(sub, subColor));
}
// Shown on TOOL keys when the app is not installed: press opens the GitHub page
function getToolbox({ icon }) {
  return frame(head("TOOL", "") +
    `<image href="${icon}" x="40" y="38" width="64" height="58"  preserveAspectRatio="xMidYMid meet"/>` +
    `<rect x="12" y="99" width="120" height="31" rx="10" fill="${C.btn}" stroke="${C.line}" stroke-width="1"/>` +
    `<text x="72" y="119" text-anchor="middle" font-family="${MONO}" font-weight="600" font-size="12" letter-spacing="1" fill="${C.soft}">GET TOOLBOX</text>`);
}

const toDataUri = (svg) => "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");

module.exports = { C, clock, cz, component, servers, version, funding, vram, server, zone, thirtyK, launch, toolbox, getToolbox, notice, toDataUri };
