// Follows Star Citizen's Game.log (read-only) for the LOG keys.
// Line formats confirmed on a 4.10 Linux/LUG install (2026-11-12):
//   <ts> [Notice] <Join PU> address[…] port[…] shard[pub_euw1b_12881860_420] locationId[…]
//   <ts> [Notice] <Context Establisher Done> … gamerules="SC_Default"   (in the PU)  / "SC_Frontend" (menu)
//   <ts> [Notice] <SHUDEvent_OnNotification> Added notification "Entering Armistice Zone - …" / "Leaving Armistice Zone - …"
//   <ts> [Notice] <Channel Disconnected> cause=30016 reason="…" … gamerules="SC_Default" …
//   <ts> [Notice] <SystemQuit> CSystem::Quit invoked with - cause=30016 …
// The game replaces Game.log at every start; the follower notices and starts over.
"use strict";

const fs = require("node:fs");
const path = require("node:path");

// Disconnect causes that are not a 30K: 30016 player quit, 30028 inactive (AFK), 30010 routine teardown
const HARMLESS = new Set([30016, 30028, 30010]);

// Shard code region -> the same names the TIME keys use. Seen in logs: euw1 (Google Cloud
// europe-west1, Belgium), use1. Others follow the same pattern; unknown codes show as-is.
function regionName(code) {
  const c = String(code || "").toLowerCase();
  if (/^eu/.test(c)) return "EU";
  if (/^use|^usc|^na/.test(c)) return "US E";
  if (/^usw/.test(c)) return "US W";
  if (/^(apse|aus)/.test(c)) return "AUS";
  if (/^(ap|as)/.test(c)) return "ASIA";
  return c.toUpperCase() || "?";
}

function blank() {
  return { inPU: false, shard: "", region: "", shardCode: "", shardNo: "", build: "", joinedAt: 0,
    zone: "unknown", d30k: 0, last30k: 0, lastCause: 0, quit: false };
}

function parseShard(s) {
  const m = String(s).match(/^([a-z]+)_([a-z]+\d+)([a-z]?)_(\d+)_(\d+)$/i);
  if (!m) return { shardCode: s, region: "?", shardNo: s.split("_").pop(), build: "" };
  return { shardCode: `${m[1]}_${m[2]}${m[3]}`, region: regionName(m[2]), shardNo: m[5], build: m[4] };
}

const tsOf = (line) => { const m = line.match(/^<(\d{4}-\d\d-\d\dT[\d:.]+Z)>/); return m ? Date.parse(m[1]) : Date.now(); };

function apply(st, line) {
  if (line.includes("<Join PU>")) {
    const m = line.match(/shard\[([^\]]+)\]/);
    if (m) Object.assign(st, { shard: m[1], ...parseShard(m[1]), joinedAt: tsOf(line), inPU: true, zone: "unknown", quit: false });
  } else if (line.includes("<Context Establisher Done>")) {
    if (line.includes('gamerules="SC_Default"')) st.inPU = true;
    else if (line.includes('gamerules="SC_Frontend"')) st.inPU = false;
  } else if (line.includes("Armistice Zone")) {
    if (!line.includes("<SHUDEvent_OnNotification>") && !line.includes("<UpdateNotificationItem>")) return;
    if (line.includes("Entering Armistice Zone")) st.zone = "armistice";
    else if (line.includes("Leaving Armistice Zone")) st.zone = "outside";
  } else if (line.includes("<Channel Disconnected>")) {
    const cause = Number((line.match(/cause=(\d+)/) || [])[1]);
    const inGame = line.includes('gamerules="SC_Default"');
    if (!inGame) return;
    st.inPU = false; st.zone = "unknown";
    if (!HARMLESS.has(cause) && /isRemote=1/.test(line)) { st.d30k++; st.last30k = tsOf(line); st.lastCause = cause; }
  } else if (line.includes("<SystemQuit>")) {
    Object.assign(st, { inPU: false, zone: "unknown", quit: true });
  }
}

// One follower per file path; poll() reads what was appended since last time.
class Follower {
  constructor(file) { this.file = file; this.ino = 0; this.pos = 0; this.rest = ""; this.st = blank(); }
  poll() {
    let s;
    try { s = fs.statSync(this.file); } catch { this.ino = 0; this.pos = 0; this.st = blank(); return this.st; }
    if (s.ino !== this.ino || s.size < this.pos) { this.ino = s.ino; this.pos = 0; this.rest = ""; this.st = blank(); }
    if (s.size > this.pos) {
      const fd = fs.openSync(this.file, "r");
      try {
        const len = Math.min(s.size - this.pos, 32 * 1024 * 1024);
        const buf = Buffer.alloc(len);
        fs.readSync(fd, buf, 0, len, this.pos);
        this.pos += len;
        const text = this.rest + buf.toString("utf8");
        const lines = text.split("\n");
        this.rest = lines.pop();
        for (const l of lines) apply(this.st, l);
      } finally { fs.closeSync(fd); }
    }
    return this.st;
  }
}

const followers = new Map();
function state(gameDir) {
  const file = path.join(gameDir, "Game.log");
  if (!followers.has(file)) followers.set(file, new Follower(file));
  return followers.get(file).poll();
}

module.exports = { state, regionName, parseShard, HARMLESS };
