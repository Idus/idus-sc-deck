// GPU memory via nvidia-smi (NVIDIA only), same queries as Idus SC Toolbox.
"use strict";

const { execFile } = require("node:child_process");

const run = (args) => new Promise((resolve) => {
  execFile("nvidia-smi", args, { timeout: 5000 }, (err, stdout) => resolve(err ? "" : String(stdout)));
});

// 'Z:\...\StarCitizen.exe' -> 'Star Citizen'; '/opt/brave-bin/brave --type=...' -> 'brave'
function shortName(raw) {
  raw = String(raw || "").trim();
  const m = raw.match(/(.*?\.exe)/i);
  const p = m ? m[1] : raw.split(/\s+-/)[0];
  const base = p.split(/[\\/]/).pop().replace(/\.exe$/i, "");
  const pretty = { starcitizen: "Star Citizen", "rsi launcher": "RSI Launcher", kwin_wayland: "KWin",
    plasmashell: "Plasma", xwayland: "Xwayland", "orca-slicer": "OrcaSlicer" };
  return pretty[base.toLowerCase()] || base || raw.slice(0, 20);
}

// -> { usedGB, totalGB, top: "OrcaSlicer 1.9G" } or null without nvidia-smi
async function read() {
  const q = (await run(["--query-gpu=memory.used,memory.total", "--format=csv,noheader,nounits"])).trim();
  if (!q) return null;
  const [used, total] = q.split("\n")[0].split(",").map((x) => Number(x.trim()));
  if (!Number.isFinite(used) || !Number.isFinite(total)) return null;

  let procs = (await run(["--query-compute-apps=pid,used_memory,process_name", "--format=csv,noheader,nounits"]))
    .trim().split("\n").map((l) => l.split(",").map((c) => c.trim()))
    .filter((c) => c.length >= 3 && Number.isFinite(Number(c[1])))
    .map((c) => ({ mib: Number(c[1]), name: shortName(c.slice(2).join(",")) }));
  if (!procs.length) {
    // compute-apps misses pure graphics apps on some drivers: parse the process table instead
    for (const line of (await run([])).split("\n")) {
      const m = line.match(/\|\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\S+\s+(.+?)\s+(\d+)MiB\s+\|/);
      if (m) procs.push({ mib: Number(m[3]), name: shortName(m[2]) });
    }
  }
  procs = procs.filter((p) => p.name !== "Star Citizen").sort((a, b) => b.mib - a.mib);
  const top = procs[0] ? `${procs[0].name} ${(procs[0].mib / 1024).toFixed(1)}G` : "";
  return { usedGB: used / 1024, totalGB: Math.round(total / 1024), top };
}

module.exports = { read };
