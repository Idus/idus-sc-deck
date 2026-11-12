// Local Star Citizen install on Windows, and the built-in tools that do there what Idus SC Toolbox
// does on Linux: kill, restart launcher, backup/restore keybinds, clear shaders, StarStrings.
// Same exports as game-linux.js; lib/game.js picks one.
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFile, execFileSync } = require("node:child_process");
const { STATE_DIR } = require("./paths");
const starstrings = require("./starstrings");

const CHANNELS = ["LIVE", "PTU", "EPTU", "TECH-PREVIEW", "HOTFIX"];
const TOOLBOX_URL = "https://github.com/Idus/idus-sc-toolbox";
const SYS32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32");
const TASKLIST = path.join(SYS32, "tasklist.exe");
const TASKKILL = path.join(SYS32, "taskkill.exe");
const POWERSHELL = path.join(SYS32, "WindowsPowerShell", "v1.0", "powershell.exe");
const LOCAL = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const ROAMING = process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
const BACKUP_DIR = process.env.SC_BACKUP_DIR || path.join(os.homedir(), "Documents", "SC-backups");
const RSI = ["Roberts Space Industries", "StarCitizen"];
const HIDE = { windowsHide: true };

// Case-insensitive path walk (returns the real names on disk)
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

// ---------------------------------------------------------------- where the game is
const isRoot = (p) => !!p && CHANNELS.some((c) => ifind(p, c, "build_manifest.id") || ifind(p, c, "Bin64", "StarCitizen.exe"));
function drives() {
  const out = [];
  for (let c = 67; c <= 90; c++) { const d = `${String.fromCharCode(c)}:\\`; try { fs.accessSync(d); out.push(d); } catch { /* none */ } }
  return out;
}
// The StarCitizen folder (the one holding LIVE, PTU …): the key's setting, SC_PREFIX, then the
// usual places on every drive. Checked again at most once a minute.
let rootCache = { at: 0, value: "" };
function detectPrefix(override) {
  if (override && override.trim()) return override.trim().replace(/[\\/]+$/, "");
  if (process.env.SC_PREFIX) return process.env.SC_PREFIX;
  if (Date.now() - rootCache.at < 60000 && rootCache.value) return rootCache.value;
  const cands = [];
  for (const d of drives()) {
    cands.push(path.join(d, "Program Files", ...RSI), path.join(d, ...RSI), path.join(d, "Games", ...RSI),
      path.join(d, "Program Files (x86)", ...RSI), path.join(d, "StarCitizen"));
  }
  const found = cands.find(isRoot) || path.join("C:\\", "Program Files", ...RSI);
  rootCache = { at: Date.now(), value: found };
  return found;
}

function channelDir(channel = "LIVE", override) { return ifind(detectPrefix(override), channel); }

function gameBuild(channel = "LIVE", override) {
  const f = ifind(detectPrefix(override), channel, "build_manifest.id");
  if (!f) return null;
  try {
    const d = JSON.parse(fs.readFileSync(f, "utf8")).Data || {};
    return { version: String(d.Branch || "").replace(/^sc-alpha-/, "").trim(), build: String(d.RequestedP4ChangeNum || "").trim() };
  } catch { return null; }
}

// ---------------------------------------------------------------- is the game running?
// tasklist runs in the background; findGame() returns the last answer (at most ~2 s old).
const proc = { pid: 0, startedMs: 0, busy: false };
function poll() {
  if (proc.busy) return;
  proc.busy = true;
  execFile(TASKLIST, ["/FI", "IMAGENAME eq StarCitizen.exe", "/FO", "CSV", "/NH"], { timeout: 5000, ...HIDE }, (err, stdout) => {
    proc.busy = false;
    const m = !err && /"StarCitizen\.exe","(\d+)"/i.exec(String(stdout));
    const pid = m ? Number(m[1]) : 0;
    if (pid && pid !== proc.pid) {
      proc.startedMs = Date.now();
      // real start time, once per new game process
      execFile(POWERSHELL, ["-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid}).StartTime.ToUniversalTime().ToString('o')`],
        { timeout: 8000, ...HIDE }, (e, out) => { const t = Date.parse(String(out).trim()); if (!e && Number.isFinite(t) && proc.pid === pid) proc.startedMs = t; });
    }
    proc.pid = pid;
  });
}
function findGame() { poll(); return proc.pid ? { pid: proc.pid, startedMs: proc.startedMs } : null; }
function runningNow() {
  try { return /StarCitizen\.exe/i.test(execFileSync(TASKLIST, ["/FI", "IMAGENAME eq StarCitizen.exe", "/NH"], { timeout: 5000, ...HIDE }).toString()); }
  catch { return false; }
}

// The tools are built in on Windows (no Toolbox needed)
const hasToolbox = () => true;

// ---------------------------------------------------------------- launch
function launcherExe(override) {
  const root = detectPrefix(override);
  const cands = [
    path.join(path.dirname(root), "RSI Launcher", "RSI Launcher.exe"),
    path.join("C:\\", "Program Files", "Roberts Space Industries", "RSI Launcher", "RSI Launcher.exe"),
    path.join(LOCAL, "Programs", "rsi-launcher", "RSI Launcher.exe"),
  ];
  return cands.find((p) => fs.existsSync(p)) || "";
}
// Start the RSI Launcher (it updates itself and starts the game), or the key's own command.
function launch({ command, prefix } = {}) {
  const opts = { detached: true, stdio: "ignore", cwd: os.homedir() };
  let child;
  if (command && command.trim()) child = spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", command], { ...opts, windowsHide: true });
  else {
    const exe = launcherExe(prefix);
    if (!exe) return { ok: false, why: "RSI Launcher.exe not found — set the game folder in the key's settings" };
    child = spawn(exe, [], { ...opts, cwd: path.dirname(exe) });
  }
  child.on("error", () => {});
  child.unref();
  return { ok: true };
}

// ---------------------------------------------------------------- tools
const taskkill = (image) => new Promise((resolve) => {
  execFile(TASKKILL, ["/F", "/T", "/IM", image], { timeout: 15000, ...HIDE }, (err) => resolve(!err));
});
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
const sizeOf = (p) => { let n = 0; try { for (const e of fs.readdirSync(p, { withFileTypes: true })) n += e.isDirectory() ? sizeOf(path.join(p, e.name)) : fs.statSync(path.join(p, e.name)).size; } catch { /* gone */ } return n; };
const mb = (n) => `${(n / 1048576).toFixed(n > 1048576 * 10 ? 0 : 1)} MB`;
const keep = (src) => !/[\\/]shaders([\\/]|$)/i.test(src) && !/\.log$/i.test(src);

async function kill() {
  const sc = await taskkill("StarCitizen.exe");
  const rl = await taskkill("RSI Launcher.exe");
  return { ok: true, out: `${sc ? "stopped Star Citizen" : "Star Citizen was not running"} · ${rl ? "stopped RSI Launcher" : "RSI Launcher was not running"}` };
}

async function restart(prefix) {
  await kill();
  await new Promise((r) => setTimeout(r, 1500));
  const r = launch({ prefix });
  return r.ok ? { ok: true, out: "RSI Launcher started again" } : { ok: false, out: r.why };
}

// Keybinds and settings: <channel>\user (without shader caches and logs) and USER.cfg of every
// channel, copied to Documents\SC-backups\sc-backup-<date>\<channel>\…
function backup(prefix, { quiet } = {}) {
  const root = detectPrefix(prefix);
  const dest = path.join(BACKUP_DIR, `sc-backup-${stamp()}`);
  let items = 0;
  for (const ch of CHANNELS) {
    const dir = ifind(root, ch);
    if (!dir) continue;
    const user = ifind(dir, "user"), cfg = ifind(dir, "user.cfg");
    if (user) { fs.cpSync(user, path.join(dest, ch, "user"), { recursive: true, filter: keep }); items++; }
    if (cfg) { fs.mkdirSync(path.join(dest, ch), { recursive: true }); fs.copyFileSync(cfg, path.join(dest, ch, "USER.cfg")); items++; }
  }
  if (!items) return { ok: false, out: `nothing to back up in ${root}` };
  return { ok: true, out: quiet ? dest : `backed up ${items} items → ${dest}` };
}

function backups() {
  try { return fs.readdirSync(BACKUP_DIR).filter((f) => /^sc-backup-\d{8}-\d{6}$/.test(f)).sort().reverse().map((f) => path.join(BACKUP_DIR, f)); }
  catch { return []; }
}

// Newest backup back into place; refuses while the game runs and takes a safety copy first.
function restore(prefix) {
  if (runningNow()) return { ok: false, out: "Star Citizen is running — close the game first" };
  const src = backups()[0];
  if (!src) return { ok: false, out: `no backup in ${BACKUP_DIR}` };
  const safety = backup(prefix, { quiet: true });
  const root = detectPrefix(prefix);
  let items = 0;
  for (const ch of fs.readdirSync(src)) {
    const from = path.join(src, ch), to = ifind(root, ch) || path.join(root, ch);
    if (!fs.statSync(from).isDirectory()) continue;
    if (fs.existsSync(path.join(from, "user"))) {
      const dst = ifind(to, "user") || path.join(to, "user");
      fs.rmSync(dst, { recursive: true, force: true });
      fs.cpSync(path.join(from, "user"), dst, { recursive: true });
      items++;
    }
    if (fs.existsSync(path.join(from, "USER.cfg"))) { fs.copyFileSync(path.join(from, "USER.cfg"), ifind(to, "user.cfg") || path.join(to, "USER.cfg")); items++; }
  }
  return { ok: items > 0, out: `restored ${items} items from ${path.basename(src)}${safety.ok ? ` (current state saved as ${path.basename(safety.out)})` : ""}` };
}

// Shader caches: %LOCALAPPDATA%\Star Citizen\<build>\{shaders,vulkanshadercache}, the channel's
// user\client\0\shaders and the launcher's own cache. Game must be closed.
function shaders(prefix, channel = "LIVE") {
  if (runningNow()) return { ok: false, out: "Star Citizen is running — close the game first" };
  const targets = [];
  const sc = ifind(LOCAL, "Star Citizen");
  if (sc) {
    for (const b of fs.readdirSync(sc, { withFileTypes: true })) {
      if (!b.isDirectory()) continue;
      for (const sub of ["shaders", "vulkanshadercache"]) { const d = ifind(path.join(sc, b.name), sub); if (d) targets.push(d); }
    }
    for (const sub of ["shaders", "vulkanshadercache"]) { const d = ifind(sc, sub); if (d) targets.push(d); }
  }
  const sec = ifind(detectPrefix(prefix), channel, "user", "client", "0", "shaders");
  if (sec) targets.push(sec);
  const rl = ifind(ROAMING, "rsilauncher", "shaders");
  if (rl) targets.push(rl);
  if (!targets.length) return { ok: true, out: "no shader cache found" };
  let total = 0;
  for (const t of targets) { total += sizeOf(t); fs.rmSync(t, { recursive: true, force: true }); }
  return { ok: true, out: `deleted ${targets.length} shader caches (${mb(total)}) — the next start takes longer` };
}

// Same entry point as on Linux: runToolbox("kill" | "restart" | "backup" | "restore" | "shaders" | "starstrings", channel, prefix)
async function runToolbox(flag, channel = "LIVE", prefix) {
  try {
    switch (flag) {
      case "kill": return await kill();
      case "restart": return await restart(prefix);
      case "backup": return backup(prefix);
      case "restore": return restore(prefix);
      case "shaders": return shaders(prefix, channel);
      case "starstrings": return await starstrings.update(channelDir(channel, prefix), { stateDir: STATE_DIR });
      default: return { ok: false, out: `${flag} is not available on Windows` };
    }
  } catch (e) {
    return { ok: false, out: e.message || String(e) };
  }
}

module.exports = { platform: "windows", CHANNELS, TOOLBOX_URL, BACKUP_DIR, detectPrefix, channelDir, gameBuild, findGame, hasToolbox, launch, runToolbox,
  _test: { ifind, backup, restore, backups, keep } };
