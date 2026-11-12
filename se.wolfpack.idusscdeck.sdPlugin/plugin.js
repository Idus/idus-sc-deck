// Idus SC Deck  ·  v1.0  ·  build 2026-11-12
// Star Citizen keys for OpenDeck (Stream Deck on Linux) in the Idus look.
// Families: TIME · CZ · STAT · LOG · PLAY · TOOL — the orange tab on every key.
// Made by Idus · https://github.com/Idus/idus-sc-deck · MIT License
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const sdk = require("./lib/sdk");
const K = require("./lib/keys");
const rsi = require("./lib/rsi");
const game = require("./lib/game");
const cz = require("./lib/cz");
const vram = require("./lib/vram");
const gamelog = require("./lib/gamelog");
const starstrings = require("./lib/starstrings");

const APP_NAME = "Idus SC Deck";
const APP_VERSION = "1.0";
const BUILD = "2026-11-12";
const ID = "se.wolfpack.idusscdeck";

const img = (svg) => K.toDataUri(svg);
const asset = (f) => { try { return "data:image/png;base64," + fs.readFileSync(path.join(__dirname, "assets", f)).toString("base64"); } catch { return ""; } };
const TOOLBOX_ICON = asset("toolbox-64.png");
const TOOLBOX_ICON_BIG = asset("toolbox-144.png");

const STATE_DIR = path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local/state"), "idus-sc-deck");
const pad = (n) => String(n).padStart(2, "0");
const hhmm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const hmin = (ms) => { const m = Math.max(0, Math.floor(ms / 60000)); return `${Math.floor(m / 60)}:${pad(m % 60)}`; };
const SHORT_CH = { "TECH-PREVIEW": "TECH" };

// ---------------------------------------------------------------- instances
const instances = new Map(); // context -> { context, action, type, settings }
const typeOf = (action) => String(action || "").replace(`${ID}.`, "");
const all = (...types) => [...instances.values()].filter((i) => types.includes(i.type));

// ================================================================ TIME · Server Clock
const ZONES = {
  "us-west": { label: "US W", tz: "America/Los_Angeles" },
  "us-east": { label: "US E", tz: "America/New_York" },
  eu: { label: "EU", tz: "Europe/Brussels" },
  asia: { label: "ASIA", tz: "Asia/Tokyo" },
  aus: { label: "AUS", tz: "Australia/Sydney" },
  utc: { label: "UTC", tz: "UTC" },
  local: { label: "LOCAL", tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
};
function zoneOf(s) {
  if (s.zone === "custom" && s.customTz) {
    const city = s.customTz.split("/").pop().replace(/_/g, " ");
    return { label: String(s.customLabel || city).toUpperCase().slice(0, 9), tz: s.customTz };
  }
  return ZONES[s.zone] || ZONES["us-west"];
}
const parts = (opts) => Object.fromEntries(new Intl.DateTimeFormat("en-GB", opts).formatToParts(new Date()).map((p) => [p.type, p.value]));
const clockKey = {
  render(i) {
    const z = zoneOf(i.settings);
    let p;
    try {
      p = parts({ timeZone: z.tz, hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: i.settings.h12 ? "h12" : "h23", timeZoneName: "shortOffset" });
    } catch {
      return sdk.setImage(i.context, img(K.notice({ family: "TIME", label: "?", word: "Bad zone", sub: String(z.tz) })));
    }
    const time = `${p.hour}:${p.minute}`;
    const ampm = i.settings.h12 ? `${p.dayPeriod || ""} ` : "";
    // UTC is the reference for patches and events: always white, with the date
    if (z.tz === "UTC") {
      const d = parts({ timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
      return sdk.setImage(i.context, img(K.clock({ label: "UTC", time, sub: `${d.weekday} ${d.day} ${d.month}${i.settings.h12 ? ` ${p.dayPeriod || ""}` : ""}` })));
    }
    const h = Number(parts({ timeZone: z.tz, hour: "numeric", hourCycle: "h23" }).hour);
    const color = h >= 17 && h <= 22 ? K.C.warn : (h >= 23 || h <= 6) ? K.C.soft : K.C.fg;
    const off = String(p.timeZoneName || "").replace("GMT", "UTC").replace("-", "−").replace(/^UTC$/, "UTC±0");
    sdk.setImage(i.context, img(K.clock({ label: z.label, time, sub: `${p.weekday} · ${ampm}${off}`, color })));
  },
  tick(i) { clockKey.render(i); },
};

// ================================================================ CZ · Exec Hangar
const czKey = {
  render(i) {
    const p = cz.phaseAt();
    sdk.setImage(i.context, img(K.cz({ phase: cz.sync.busy && !cz.sync.syncedAt ? "sync" : p.phase, secs: p.secs, at: hhmm(p.nextChange), lights: p.lights })));
  },
  tick(i) { czKey.render(i); },
  applySettings(i) { if (cz.setPrimary(i.settings.primary || "cztimer")) cz.resync().then(() => pushInfo(i)); },
  async keyUp(i) {
    const ok = await cz.resync();
    czKey.render(i); pushInfo(i);
    ok ? sdk.showOk(i.context) : sdk.showAlert(i.context);
  },
};
setInterval(() => { if (all("cz").length) cz.resync().then(() => all("cz").forEach(pushInfo)); }, cz.SYNC_MS);

// ================================================================ STAT · Server Status
const rsiCache = { status: null, funding: null };
const rsiError = { status: "", funding: "" };
async function refreshStatus(force) {
  const c = await rsi.status(force);
  rsiCache.status = c.data; rsiError.status = c.error;
  statAll("status").forEach((i) => serversKey.render(i));
}
async function refreshFunding(force) {
  const c = await rsi.funding(force);
  rsiCache.funding = c.data; rsiError.funding = c.error;
  statAll("funding").forEach((i) => fundingKey.render(i));
}
const SHORT = { "Persistent Universe": "PU", "Arena Commander": "Arena Cmdr", Platform: "Platform" };
const LABEL = { "Persistent Universe": "PU", "Arena Commander": "AC", Platform: "PLAT" };
const serversKey = {
  render(i) {
    const c = rsiCache.status;
    const pick = i.settings.component || "all";
    if (!c || !c.systems || !c.systems.length) {
      return sdk.setImage(i.context, img(K.notice({ family: "STAT", label: pick === "all" ? "RSI" : LABEL[pick] || "RSI", word: "No data", sub: rsiError.status ? "offline" : "loading…" })));
    }
    if (pick === "all") return sdk.setImage(i.context, img(K.servers(c.systems.map((s) => ({ name: SHORT[s.name] || s.name, status: s.status })))));
    const s = c.systems.find((x) => x.name === pick) || { name: pick, status: "unknown" };
    sdk.setImage(i.context, img(K.component({ label: LABEL[s.name] || s.name.slice(0, 5).toUpperCase(), name: s.name, status: s.status, incident: s.incident })));
  },
  tick(i, t) { if (t % 30 === 0) refreshStatus(); },
  keyUp() { sdk.openUrl(rsi.STATUS_PAGE); refreshStatus(true); },
};

// ================================================================ STAT · Version
const SEEN_FILE = path.join(STATE_DIR, "seen.json");
let seen = {};
try { seen = JSON.parse(fs.readFileSync(SEEN_FILE, "utf8")); } catch { /* first run */ }
const saveSeen = () => { try { fs.mkdirSync(STATE_DIR, { recursive: true }); fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2)); } catch { /* ignore */ } };
// The newest version RSI has posted release notes for: LIVE by version number, PTU by build number.
// Only the launcher (logged in) knows for certain; this is the public estimate. Hotfixes that
// keep the version number are not seen on LIVE.
let releases = null, releasesError = "";
async function refreshReleases(force) {
  const c = await rsi.releases(force);
  releases = c.data; releasesError = c.error;
  statAll("version").forEach((i) => { versionKey.render(i); pushInfo(i); });
}
function latestFor(ch) { return !releases ? null : ch === "LIVE" ? releases.live : ch === "PTU" ? releases.ptu : null; }
// -> { state: "behind" | "latest" | "unknown", latest }
function compareVersion(ch, b) {
  const latest = latestFor(ch);
  if (!latest || !b) return { state: "unknown", latest };
  const behind = ch === "PTU"
    ? Number(b.build) > 0 && Number(b.build) < Number(latest.build)
    : rsi.cmpVersion(b.version, latest.version) < 0;
  return { state: behind ? "behind" : "latest", latest };
}
const versionKey = {
  render(i) {
    const ch = i.settings.channel || "LIVE";
    const label = SHORT_CH[ch] || ch;
    const b = game.gameBuild(ch, i.settings.prefix);
    if (!b || !b.version) return sdk.setImage(i.context, img(K.notice({ family: "STAT", label, word: "—", sub: "not installed" })));
    if (!seen[ch]) { seen[ch] = b.version; saveSeen(); }
    const cmp = compareVersion(ch, b);
    const sub = cmp.state === "behind"
      ? (cmp.latest.version !== b.version ? `${cmp.latest.version} out` : "new build")
      : cmp.state === "latest" ? "up to date" : `build ${b.build}`;
    const dot = cmp.state === "behind" ? K.C.warn : cmp.state === "latest" ? K.C.ok : null;
    sdk.setImage(i.context, img(K.version({ label, version: b.version, sub, dot, isNew: seen[ch] !== b.version })));
  },
  tick(i, t) {
    if (t % 60 === 0) versionKey.render(i);
    if (t % 1800 === 0) refreshReleases();
  },
  keyUp(i) {
    const ch = i.settings.channel || "LIVE";
    const b = game.gameBuild(ch, i.settings.prefix);
    if (b && b.version) { seen[ch] = b.version; saveSeen(); }
    const latest = latestFor(ch);
    if (i.settings.openNotes !== false && latest && latest.url) sdk.openUrl(latest.url);
    versionKey.render(i); sdk.showOk(i.context);
    refreshReleases(true);
  },
};

// ================================================================ STAT · Funding
const fundingKey = {
  render(i) {
    const f = rsiCache.funding;
    if (!f) return sdk.setImage(i.context, img(K.notice({ family: "STAT", label: "FUNDS", word: "No data", sub: rsiError.funding ? "offline" : "loading…" })));
    const yday = Number.isFinite(f.yesterday) ? `+${rsi.money(f.yesterday).slice(1)} yday` : `${rsi.count(f.fans)} citizens`;
    sdk.setImage(i.context, img(K.funding({ total: rsi.money(f.funds), today: yday })));
  },
  tick(i, t) { if (t % 900 === 0) refreshFunding(); },
  keyUp(i) { refreshFunding(true).then(() => sdk.showOk(i.context)); },
};

// ================================================================ STAT · VRAM
let vramData; // undefined = not read yet, null = no nvidia-smi
async function refreshVram() { vramData = await vram.read(); statAll("vram").forEach((i) => vramKey.render(i)); }
const vramKey = {
  render(i) {
    if (vramData === undefined) return sdk.setImage(i.context, img(K.notice({ family: "STAT", label: "VRAM", word: "…", sub: "reading" })));
    if (vramData === null) return sdk.setImage(i.context, img(K.notice({ family: "STAT", label: "VRAM", word: "No GPU", sub: "needs nvidia-smi" })));
    sdk.setImage(i.context, img(K.vram({ used: vramData.usedGB, total: vramData.totalGB, top: vramData.top || "—" })));
  },
  tick(i, t) { if (t % 5 === 0 && i === statAll("vram")[0]) refreshVram(); },
  keyUp() { refreshVram(); },
};

// ================================================================ LOG · Game.log (server / region / shard / zone / 30K)
let running = null; // { pid, startedMs } while StarCitizen.exe runs
function logState(i) {
  const dir = game.channelDir(i.settings.channel || "LIVE", i.settings.prefix);
  const st = dir ? gamelog.state(dir) : null;
  return { st, running: !!running && !!st };
}
// One action, five views (setting "show"): server · region · shard · zone · 30k.
// Keys placed before the merge (actions logzone / log30k) still work and default to their view.
const LOG_VIEW = { logserver: "server", logzone: "zone", log30k: "30k" };
const logKey = {
  render(i) {
    const { st, running: on } = logState(i);
    const show = i.settings.show || LOG_VIEW[i.type] || "server";
    if (show === "zone") {
      return sdk.setImage(i.context, img(K.zone({ zone: st ? st.zone : "unknown", running: on, inPU: !!(st && st.inPU) })));
    }
    if (show === "30k") {
      return sdk.setImage(i.context, img(K.thirtyK({ count: st ? st.d30k : 0, last: st && st.last30k ? hhmm(st.last30k) : "", running: on })));
    }
    const where = st ? { running: on, inPU: on && st.inPU, region: st.region, shardNo: st.shardNo, shardCode: st.shardCode,
      build: st.build, since: hmin(Date.now() - st.joinedAt) } : { running: false, inPU: false };
    sdk.setImage(i.context, img(K.server({ show, where })));
  },
  tick(i, t) { if (t % 2 === 0) logKey.render(i); },
  keyUp(i) { logKey.render(i); pushInfo(i); },
};

// ================================================================ PLAY · Launch
function customImage(p) {
  if (!p) return "";
  try {
    const ext = path.extname(p).toLowerCase();
    const mime = ext === ".svg" ? "image/svg+xml" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
    return `data:${mime};base64,` + fs.readFileSync(p).toString("base64");
  } catch { return ""; }
}
const launchKey = {
  render(i) {
    const ch = i.settings.channel || "LIVE";
    const image = customImage(i.settings.image);
    if (running) return sdk.setImage(i.context, img(K.launch({ running: true, channel: SHORT_CH[ch] || ch, image, session: hmin(Date.now() - running.startedMs) })));
    sdk.setImage(i.context, img(K.launch({ running: false, channel: SHORT_CH[ch] || ch, image })));
  },
  tick(i, t) { if (t % 2 === 0) launchKey.render(i); },
  keyUp(i) {
    if (running) return sdk.showAlert(i.context);
    const r = game.launch({ command: i.settings.command, prefix: i.settings.prefix });
    if (!r.ok) { sdk.log(`${APP_NAME}: launch failed — ${r.why}`); return sdk.showAlert(i.context); }
    sdk.showOk(i.context);
  },
};

// ================================================================ TOOL · Toolbox Action
const TB = {
  kill: { flag: "kill", word: "Kill SC", sub: "SC + launcher", short: "kill SC", steps: 2 },
  restart: { flag: "restart", word: "Restart", sub: "RSI launcher", short: "restart", steps: 2 },
  patch: { flag: "restart-patch", word: "Patch", sub: "verify launcher", short: "patch", steps: 2 },
  backup: { flag: "backup", word: "Backup", sub: "keybinds + cfg" },
  restore: { flag: "restore", word: "Restore", sub: "latest backup", short: "restore", steps: 2 },
  shaders: { flag: "shaders", word: "Shaders", sub: "clear cache" },
  starstrings: { flag: "starstrings", word: "Strings", sub: "StarStrings" },
  fixwindows: { flag: "fix-windows", word: "Windows", sub: "to main screen" },
};
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
let ssLatest = null;
// StarStrings: "4.10 · 12 Nov" = the game version it was made for + install date.
// Green dot = no newer release on GitHub; amber = a newer release exists or it is for an older patch.
function starStringsSub(i) {
  const ch = i.settings.channel || "LIVE";
  const info = starstrings.installed(game.channelDir(ch, i.settings.prefix));
  if (!info.installed) return { sub: "not installed", subColor: K.C.dim };
  const d = new Date(info.mtimeMs);
  const sub = `${info.target || "?"} · ${d.getDate()} ${MON[d.getMonth()]}`;
  const b = game.gameBuild(ch, i.settings.prefix);
  const gameMinor = b && b.version ? b.version.split(".").slice(0, 2).join(".") : "";
  const old = (info.target && gameMinor && !gameMinor.startsWith(info.target.split(".").slice(0, 2).join("."))) ||
    (ssLatest && ssLatest.published > info.mtimeMs + 3600 * 1000);
  return { sub, subColor: old ? K.C.warn : ssLatest ? K.C.ok : null };
}
const toolboxKey = {
  render(i) {
    if (!game.hasToolbox()) return sdk.setImage(i.context, img(K.getToolbox({ icon: TOOLBOX_ICON_BIG })));
    const a = TB[i.settings.tbAction] || TB.kill;
    const step = i.stepUntil && Date.now() < i.stepUntil ? i.step : 0;
    const extra = a.flag === "starstrings" ? starStringsSub(i) : {};
    sdk.setImage(i.context, img(K.toolbox({ word: a.word, sub: a.sub, ...extra, icon: TOOLBOX_ICON, step, short: a.short, busy: i.busy })));
  },
  tick(i, t) {
    if (i.stepUntil && Date.now() >= i.stepUntil) { i.step = 0; i.stepUntil = 0; }
    if ((TB[i.settings.tbAction] || {}).flag === "starstrings" && t % 3600 === 1) starstrings.latestRelease().then((r) => { ssLatest = r; });
    toolboxKey.render(i);
  },
  async keyUp(i) {
    if (!game.hasToolbox()) return sdk.openUrl(game.TOOLBOX_URL);
    if (i.busy) return;
    const a = TB[i.settings.tbAction] || TB.kill;
    const step = i.stepUntil && Date.now() < i.stepUntil ? i.step : 0;
    if (a.steps && step < a.steps) {          // "Really?" -> "Sure?" -> run; 3 s per step
      i.step = step + 1; i.stepUntil = Date.now() + 3000;
      return toolboxKey.render(i);
    }
    i.step = 0; i.stepUntil = 0; i.busy = true; toolboxKey.render(i);
    const r = await game.runToolbox(a.flag, i.settings.channel);
    i.busy = false;
    if (a.flag === "starstrings") ssLatest = await starstrings.latestRelease();
    toolboxKey.render(i);
    if (!r.ok) sdk.log(`${APP_NAME}: idus-sc-toolbox --${a.flag} failed: ${r.out}`);
    r.ok ? sdk.showOk(i.context) : sdk.showAlert(i.context);
  },
};

// ================================================================ STAT · one action, four views
// Setting "show": status · version · funding · vram. The action keeps the UUID "servers"; keys placed
// before the merge (actions version / funding / vram) still work and default to their own view.
const STAT_VIEWS = { status: serversKey, version: versionKey, funding: fundingKey, vram: vramKey };
const STAT_DEFAULT = { servers: "status", version: "version", funding: "funding", vram: "vram" };
function statView(i) { return STAT_VIEWS[i.settings.show] ? i.settings.show : STAT_DEFAULT[i.type] || "status"; }
function statAll(view) { return all("servers", "version", "funding", "vram").filter((i) => statView(i) === view); }
const STAT_REFRESH = { status: () => refreshStatus(), version: () => refreshReleases(), funding: () => refreshFunding(), vram: () => refreshVram() };
const statKey = {
  applySettings(i) { STAT_REFRESH[statView(i)](); }, // on appear and after every settings change
  render(i) { STAT_VIEWS[statView(i)].render(i); },
  tick(i, t) { const k = STAT_VIEWS[statView(i)]; if (k.tick) k.tick(i, t); },
  keyUp(i) { const k = STAT_VIEWS[statView(i)]; return k.keyUp && k.keyUp(i); },
};

// ================================================================ dispatch
const TYPES = {
  clock: clockKey, cz: czKey, servers: statKey, version: statKey, funding: statKey, vram: statKey,
  logserver: logKey, logzone: logKey, log30k: logKey, launch: launchKey, toolbox: toolboxKey,
};

function info(i) {
  const base = { app: APP_NAME, version: APP_VERSION, build: BUILD };
  switch (i.type) {
    case "cz": return { ...base, from: cz.sync.from, syncedAt: cz.sync.syncedAt, error: cz.sync.error, primary: cz.sync.primary };
    case "servers": case "version": case "funding": case "vram":
    case "launch": case "logserver": case "logzone": case "log30k": {
      const ch = i.settings.channel || "LIVE";
      const dir = game.channelDir(ch, i.settings.prefix);
      const st = dir ? gamelog.state(dir) : null;
      const b = game.gameBuild(ch, i.settings.prefix);
      return { ...base, prefix: game.detectPrefix(i.settings.prefix), toolbox: game.hasToolbox(), game: b,
        log: dir ? path.join(dir, "Game.log") : "", shard: st ? st.shard : "", running: !!running,
        latest: latestFor(ch), compare: compareVersion(ch, b).state, releasesError,
        statusError: rsiError.status, fundingError: rsiError.funding, vramOk: !!vramData };
    }
    case "toolbox": return { ...base, toolbox: game.hasToolbox() };
    default: return base;
  }
}
function pushInfo(i) { sdk.toInspector(i.context, i.action, { type: "info", ...info(i) }); }

function upsert(msg) {
  const type = typeOf(msg.action);
  if (!TYPES[type]) return null;
  let i = instances.get(msg.context);
  if (!i) { i = { context: msg.context, action: msg.action, type, settings: {} }; instances.set(msg.context, i); }
  i.settings = (msg.payload && msg.payload.settings) || i.settings || {};
  return i;
}

sdk.on("willAppear", (msg) => {
  const i = upsert(msg); if (!i) return;
  if (i.type === "toolbox" && i.settings.tbAction === "starstrings" && !ssLatest) starstrings.latestRelease().then((r) => { ssLatest = r; });
  const T = TYPES[i.type];
  if (all("launch", "logserver", "logzone", "log30k").length) running = game.findGame();
  if (T.applySettings) T.applySettings(i);
  T.render(i);
  // OpenDeck sends willAppear before a newly added key is fully placed, and its default image can
  // land on top of ours (the key looked empty until it was moved). Draw it again a moment later.
  for (const ms of [400, 1500]) setTimeout(() => {
    if (instances.get(i.context) !== i) return;
    sdk.forget(i.context);
    try { T.render(i); } catch (e) { console.error("redraw", i.type, e); }
  }, ms);
});
sdk.on("willDisappear", (msg) => { instances.delete(msg.context); sdk.forget(msg.context); });
sdk.on("didReceiveSettings", (msg) => {
  const i = upsert(msg); if (!i) return;
  const T = TYPES[i.type];
  if (T.applySettings) T.applySettings(i);
  T.render(i); pushInfo(i);
});
sdk.on("keyUp", (msg) => {
  const i = upsert(msg); if (!i) return;
  const T = TYPES[i.type];
  if (T.keyUp) Promise.resolve(T.keyUp(i)).catch((e) => console.error("keyUp", e));
});
sdk.on("propertyInspectorDidAppear", (msg) => { const i = instances.get(msg.context); if (i) pushInfo(i); });
sdk.on("sendToPlugin", (msg) => {
  const i = instances.get(msg.context); if (!i) return;
  const p = msg.payload || {};
  if (p.cmd === "info") pushInfo(i);
  if (p.cmd === "resync" && i.type === "cz") cz.resync().then(() => { czKey.render(i); pushInfo(i); });
});

// One clock for everything. The process scan only runs while a PLAY or LOG key is visible.
let t = 0;
setInterval(() => {
  t++;
  if (t % 2 === 0 && all("launch", "logserver", "logzone", "log30k").length) running = game.findGame();
  for (const i of instances.values()) {
    try { TYPES[i.type].tick && TYPES[i.type].tick(i, t); } catch (e) { console.error("tick", i.type, e); }
  }
}, 1000);

if (!cz.sync.syncedAt || Date.now() - cz.sync.syncedAt > cz.SYNC_MS) cz.resync();
sdk.connect();
