// What StarStrings is installed, for the TOOL · StarStrings key.
// StarStrings' global.ini has no release number, but it names the game version it was made
// for in its main-menu line, e.g. "Frontend_PU_Version=Alpha 4.10: … | MrKraken Community …".
// We show that + the install date, and compare the date with the newest GitHub release.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const API = "https://api.github.com/repos/MrKraken/StarStrings/releases/latest";
const UA = "Idus-SC-Deck (+https://github.com/Idus/idus-sc-deck)";

function ifind(base, ...parts) {
  let cur = base;
  for (const part of parts) {
    let entries;
    try { entries = fs.readdirSync(cur); } catch { return null; }
    const hit = entries.find((e) => e.toLowerCase() === part.toLowerCase());
    if (!hit) return null;
    cur = path.join(cur, hit);
  }
  return cur;
}

const fileCache = new Map(); // path -> { mtimeMs, info }
// -> { installed: false } or { installed: true, mine: bool, target: "4.10", mtimeMs }
function installed(channelDir) {
  const f = channelDir && ifind(channelDir, "data", "Localization", "english", "global.ini");
  if (!f) return { installed: false };
  let st;
  try { st = fs.statSync(f); } catch { return { installed: false }; }
  const c = fileCache.get(f);
  if (c && c.mtimeMs === st.mtimeMs) return c.info;
  let text = "";
  try { text = fs.readFileSync(f, "utf8"); } catch { /* unreadable */ }
  const line = (text.match(/^Frontend_PU_Version(?:,P)?=(.*)$/m) || [])[1] || "";
  const info = {
    installed: true,
    mine: /MrKraken|StarStrings/i.test(text.slice(0, 2_000_000)) || /MrKraken/i.test(line),
    target: (line.match(/(\d+\.\d+(?:\.\d+)?)/) || [])[1] || "",
    mtimeMs: st.mtimeMs,
  };
  fileCache.set(f, { mtimeMs: st.mtimeMs, info });
  return info;
}

// Newest release on GitHub, checked at most every 6 hours (the API allows 60 calls/hour).
const latest = { at: 0, data: null, busy: null };
function latestRelease() {
  if (latest.data && Date.now() - latest.at < 6 * 3600 * 1000) return Promise.resolve(latest.data);
  if (latest.busy) return latest.busy;
  latest.busy = fetch(API, { headers: { "user-agent": UA, accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(15000) })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => { latest.at = Date.now(); if (j && j.published_at) latest.data = { tag: j.tag_name, published: Date.parse(j.published_at) }; return latest.data; })
    .catch(() => { latest.at = Date.now(); return latest.data; })
    .finally(() => { latest.busy = null; });
  return latest.busy;
}

module.exports = { installed, latestRelease };
