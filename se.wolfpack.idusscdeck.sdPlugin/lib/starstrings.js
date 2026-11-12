// What StarStrings is installed, for the TOOL · StarStrings key.
// StarStrings' global.ini has no release number, but it names the game version it was made
// for in its main-menu line, e.g. "Frontend_PU_Version=Alpha 4.10: … | MrKraken Community …".
// We show that + the install date, and compare the date with the newest GitHub release.
// update() installs the newest release itself (used on Windows; on Linux Idus SC Toolbox does it).
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

// ---------------------------------------------------------------- install the newest release
// Minimal ZIP reader (stored or deflated entries, no ZIP64): the bytes of english/global.ini.
function globalIniFromZip(buf) {
  const zlib = require("node:zlib");
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a zip file");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const hits = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("broken zip directory");
    const method = buf.readUInt16LE(off + 10), size = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28), extraLen = buf.readUInt16LE(off + 30), commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    if (/(^|\/)global\.ini$/i.test(name)) hits.push({ name, method, size, local });
    off += 46 + nameLen + extraLen + commentLen;
  }
  const e = hits.find((h) => /english\/global\.ini$/i.test(h.name)) || hits[0];
  if (!e) return null;
  if (buf.readUInt32LE(e.local) !== 0x04034b50) throw new Error("broken zip entry");
  const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28);
  const raw = buf.subarray(start, start + e.size);
  if (e.method === 0) return Buffer.from(raw);
  if (e.method === 8) return zlib.inflateRawSync(raw);
  throw new Error(`zip method ${e.method} not supported`);
}

async function download(url, accept) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept }, redirect: "follow", signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return Buffer.from(await r.arrayBuffer());
}

const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

// Downloads the newest StarStrings, keeps the old global.ini as global.ini.BAK-<date>, installs the
// new one and makes sure user.cfg in the channel folder says g_language = english (added, never
// overwritten). A pristine copy is kept in stateDir. -> { ok, out }
async function update(channelDir, { stateDir } = {}) {
  const out = [];
  if (!channelDir || !fs.existsSync(channelDir)) return { ok: false, out: "game folder not found — set it in the key's settings" };
  let rel;
  try { rel = JSON.parse((await download(API, "application/vnd.github+json")).toString("utf8")); }
  catch (e) { return { ok: false, out: `could not reach GitHub: ${e.message} (60 checks per hour)` }; }
  out.push(`latest release: ${rel.tag_name || "?"}`);
  let data = null;
  try {
    const assets = rel.assets || [];
    const ini = assets.find((a) => a.name.toLowerCase() === "global.ini");
    if (ini) data = await download(ini.browser_download_url, "application/octet-stream");
    else {
      const zip = assets.find((a) => a.name.toLowerCase().endsWith(".zip"));
      const src = zip ? zip.browser_download_url : rel.zipball_url;
      if (!src) return { ok: false, out: "the release has neither global.ini nor a zip" };
      data = globalIniFromZip(await download(src, "application/octet-stream"));
    }
  } catch (e) { return { ok: false, out: `download failed: ${e.message}` }; }
  if (!data || data.length < 100000) return { ok: false, out: "no usable global.ini in the release" };

  const eng = ifind(channelDir, "data", "Localization", "english") || path.join(channelDir, "data", "Localization", "english");
  try { fs.mkdirSync(eng, { recursive: true }); } catch (e) { return { ok: false, out: `cannot create ${eng}: ${e.message}` }; }
  const target = ifind(eng, "global.ini") || path.join(eng, "global.ini");
  try {
    if (fs.existsSync(target)) { const bak = path.join(eng, `global.ini.BAK-${stamp()}`); fs.renameSync(target, bak); out.push(`old file kept as ${path.basename(bak)}`); }
    fs.writeFileSync(target, data);
  } catch (e) { return { ok: false, out: `cannot write ${target}: ${e.message}` }; }
  out.push(`installed ${target} (${Math.round(data.length / 1024)} KB)`);

  const cfg = ifind(channelDir, "user.cfg") || path.join(channelDir, "user.cfg");
  try {
    const text = fs.existsSync(cfg) ? fs.readFileSync(cfg, "utf8") : "";
    const lang = (text.match(/^\s*g_language\s*=\s*(\S+)/im) || [])[1];
    if (!lang) { fs.writeFileSync(cfg, (text && !text.endsWith("\n") ? text + "\n" : text) + "g_language = english\n"); out.push(`${path.basename(cfg)}: added g_language = english`); }
    else if (lang.toLowerCase() !== "english") out.push(`${path.basename(cfg)} says g_language = ${lang} — StarStrings needs english`);
  } catch (e) { out.push(`could not update user.cfg: ${e.message}`); }

  if (stateDir) {
    try { fs.mkdirSync(stateDir, { recursive: true }); fs.writeFileSync(path.join(stateDir, `starstrings-${path.basename(channelDir)}.ini`), data); } catch { /* optional */ }
  }
  fileCache.delete(target);
  latest.at = 0; // let the key re-check GitHub
  return { ok: true, out: out.join("\n") };
}

module.exports = { installed, latestRelease, update, globalIniFromZip };
