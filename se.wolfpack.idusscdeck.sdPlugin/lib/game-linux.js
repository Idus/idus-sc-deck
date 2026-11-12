// Local Star Citizen install on Linux (LUG Helper layout) and the Idus SC Toolbox CLI.
// Same exports as game-win.js; lib/game.js picks one.
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFile } = require("node:child_process");

const HOME = os.homedir();
const TOOLBOX = path.join(HOME, ".local/bin/idus-sc-toolbox");
const TOOLBOX_URL = "https://github.com/Idus/idus-sc-toolbox";
const CHANNELS = ["LIVE", "PTU", "EPTU", "TECH-PREVIEW", "HOTFIX"];

// Wine prefix, same order as the SC Toolbox installer:
// 1. SC_PREFIX  2. LUG config line with drive_c  3. ~/Games/star-citizen (LUG default)
let prefixCache = { at: 0, value: "" };
function detectPrefix(override) {
  if (override) return override;
  if (process.env.SC_PREFIX) return process.env.SC_PREFIX;
  if (Date.now() - prefixCache.at < 60000 && prefixCache.value) return prefixCache.value;
  let found = "";
  const lugDir = path.join(HOME, ".config/starcitizen-lug");
  try {
    for (const f of fs.readdirSync(lugDir)) {
      const text = fs.readFileSync(path.join(lugDir, f), "utf8");
      const line = text.split("\n").find((l) => l.includes("drive_c"));
      if (line) {
        const p = line.trim().replace(/\/drive_c.*$/, "");
        if (fs.existsSync(p)) { found = p; break; }
      }
    }
  } catch { /* no LUG config */ }
  if (!found) found = path.join(HOME, "Games/star-citizen");
  prefixCache = { at: Date.now(), value: found };
  return found;
}

// Case-insensitive path walk (Wine ignores case, ext4 does not)
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

function gameRoot(prefix) {
  return ifind(prefix, "drive_c", "Program Files", "Roberts Space Industries", "StarCitizen");
}

// <prefix>/drive_c/…/StarCitizen/<channel> (case-insensitive), or null
function channelDir(channel = "LIVE", prefixOverride) {
  const root = gameRoot(detectPrefix(prefixOverride));
  return root && ifind(root, channel);
}

// { version: "4.10.2", build: "12913470" } from <channel>/build_manifest.id, or null
function gameBuild(channel = "LIVE", prefixOverride) {
  const root = gameRoot(detectPrefix(prefixOverride));
  const f = root && ifind(root, channel, "build_manifest.id");
  if (!f) return null;
  try {
    const d = JSON.parse(fs.readFileSync(f, "utf8")).Data || {};
    return {
      version: String(d.Branch || "").replace(/^sc-alpha-/, "").trim(),
      build: String(d.RequestedP4ChangeNum || "").trim(),
    };
  } catch { return null; }
}

// The running game: { pid, startedMs } or null. Same match as `pgrep -f StarCitizen.exe`.
function findGame() {
  let pids;
  try { pids = fs.readdirSync("/proc").filter((d) => /^\d+$/.test(d)); } catch { return null; }
  for (const pid of pids) {
    let cmd;
    try { cmd = fs.readFileSync(`/proc/${pid}/cmdline`, "latin1"); } catch { continue; }
    if (cmd.includes("StarCitizen.exe") && !cmd.includes("idus-sc-toolbox")) {
      let startedMs = Date.now();
      try { startedMs = fs.statSync(`/proc/${pid}`).ctimeMs; } catch { /* keep now */ }
      return { pid: Number(pid), startedMs };
    }
  }
  return null;
}

const hasToolbox = () => { try { fs.accessSync(TOOLBOX, fs.constants.X_OK); return true; } catch { return false; } };

// Start the game: Toolbox (checks launcher updates first) > custom command > LUG sc-launch.sh
function launch({ command, prefix } = {}) {
  const opts = { detached: true, stdio: "ignore", cwd: HOME };
  let child;
  if (command && command.trim()) {
    child = spawn("sh", ["-c", command], opts);
  } else if (hasToolbox()) {
    child = spawn(TOOLBOX, ["--launch"], opts);
  } else {
    const sh = path.join(detectPrefix(prefix), "sc-launch.sh");
    if (!fs.existsSync(sh)) return { ok: false, why: `no sc-launch.sh in ${path.dirname(sh)}` };
    child = spawn(sh, [], opts);
  }
  child.on("error", () => {});
  child.unref();
  return { ok: true };
}

// Run one Toolbox CLI action; resolves { ok, out }
function runToolbox(flag, channel) {
  return new Promise((resolve) => {
    const args = [`--${flag}`];
    if (channel && channel !== "LIVE" && ["shaders", "starstrings"].includes(flag)) args.push("--env", channel);
    execFile(TOOLBOX, args, { timeout: 10 * 60 * 1000, cwd: HOME }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: String(stdout || stderr || (err && err.message) || "").slice(-2000) });
    });
  });
}

// Show a folder in the file manager (after the first StarStrings install)
function openFolder(p) {
  try { const c = spawn("xdg-open", [p], { detached: true, stdio: "ignore" }); c.on("error", () => {}); c.unref(); } catch { /* ignore */ }
}

module.exports = { platform: "linux", openFolder, CHANNELS, TOOLBOX_URL, detectPrefix, channelDir, gameBuild, findGame, hasToolbox, launch, runToolbox };
