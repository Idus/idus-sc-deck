// Fake OpenDeck host for testing: starts the plugin the way OpenDeck does (node <CodePath>,
// cwd = plugin folder, -port/-pluginUUID/-registerEvent/-info), shows every key type, presses
// some, plays a scripted Game.log session and saves each key's image at checkpoints:
//   <out>/<key>.svg (last image) and <out>/cp<N>-<key>.svg (at checkpoint N).
// Usage: HOME=<fake home with LUG config + prefix> node dev/fake-opendeck.cjs <out dir> [seconds]
// Env: WS_MODULE (path to the ws package), GAMELOG (path of the fake Game.log to write)
const { WebSocketServer } = require(process.env.WS_MODULE || "ws");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PLUGIN = path.join(__dirname, "..", "se.wolfpack.idusscdeck.sdPlugin");
const out = path.resolve(process.argv[2] || "out");
const seconds = Number(process.argv[3] || 16);
fs.mkdirSync(out, { recursive: true });
const port = 28150 + Math.floor(Math.random() * 40);
const ID = "se.wolfpack.idusscdeck";

const keys = [
  ["time-uswest", "clock", { zone: "us-west" }],
  ["time-eu", "clock", { zone: "eu" }],
  ["time-utc", "clock", { zone: "utc" }],
  ["time-custom", "clock", { zone: "custom", customTz: "America/Chicago", customLabel: "us c" }],
  ["time-stockholm", "clock", { zone: "custom", customTz: "Europe/Stockholm" }],
  ["cz", "cz", { primary: "cztimer" }],
  ["stat-rsi", "servers", { show: "status" }],
  ["stat-pu", "servers", { show: "status", component: "Persistent Universe" }],
  ["stat-version", "servers", { show: "version", channel: "LIVE" }],
  ["stat-ptu", "servers", { show: "version", channel: "PTU" }],
  ["stat-funding", "servers", { show: "funding" }],
  ["stat-vram", "servers", { show: "vram" }],
  ["stat-legacy-version", "version", { channel: "LIVE" }],
  ["log-server", "logserver", { show: "server" }],
  ["log-region", "logserver", { show: "region" }],
  ["log-shard", "logserver", { show: "shard" }],
  ["log-zone", "logserver", { show: "zone" }],
  ["log-30k", "logserver", { show: "30k" }],
  ["log-legacy-zone", "logzone", {}],
  ["play-launch", "launch", { channel: "LIVE" }],
  ["tool-kill", "toolbox", { tbAction: "kill" }],
  ["tool-backup", "toolbox", { tbAction: "backup" }],
  ["tool-strings", "toolbox", { tbAction: "starstrings" }],
];

// Scripted Game.log (synthetic lines in the real 4.10 format; no real player data)
const iso = () => new Date().toISOString();
const L = {
  menu: () => `<${iso()}> [Notice] <Context Establisher Done> establisher="Network" runningTime=1.8 map="megamap" gamerules="SC_Frontend" sessionId="x" [Team_Network]`,
  join: (shard) => `<${iso()}> [Notice] <Join PU> address[192.0.2.10] port[64382] shard[${shard}] locationId[-1] [Team_GameServices][GIM][Matchmaking]\n` +
    `<${iso()}> [Notice] <Context Establisher Done> establisher="Network" runningTime=45.2 map="megamap" gamerules="SC_Default" sessionId="x" [Team_Network]`,
  enter: () => `<${iso()}> [Notice] <SHUDEvent_OnNotification> Added notification "Entering Armistice Zone - Combat Prohibited: " [9] to queue. New queue size: 1 [Team_CoreGameplayFeatures]`,
  leave: () => `<${iso()}> [Notice] <SHUDEvent_OnNotification> Added notification "Leaving Armistice Zone - Caution Advised: " [11] to queue. New queue size: 1 [Team_CoreGameplayFeatures]`,
  k30: () => `<${iso()}> [Notice] <Channel Disconnected> cause=30000 reason="Remote Disconnect - Server shutdown" frame=1 isRemote=1 viewState=eCVS_InGame map="megamap" gamerules="SC_Default" hostType="Replicant" nickname="Tester" [Team_Network]`,
  quit: () => `<${iso()}> [Notice] <Channel Disconnected> cause=30016 reason="Remote Disconnect - Player requested disconnect" frame=1 isRemote=1 viewState=eCVS_InGame map="megamap" gamerules="SC_Default" hostType="Replicant" nickname="Tester" [Team_Network]`,
};
const GAMELOG = process.env.GAMELOG;
const writeLog = (s) => GAMELOG && fs.appendFileSync(GAMELOG, s + "\n");
if (GAMELOG) fs.writeFileSync(GAMELOG, L.menu() + "\n");
const script = [
  [3000, () => writeLog(L.join("pub_euw1b_12881860_420")), "joined EU shard 420"],
  [5000, () => writeLog(L.enter()), "entered armistice"],
  [7000, () => writeLog(L.leave()), "left armistice"],
  [9000, () => writeLog(L.k30()), "30K"],
  [11000, () => writeLog(L.join("pub_use1b_12660092_180")), "rejoined US E shard 180"],
  [13000, () => writeLog(L.quit()), "quit to menu (30016, must not count)"],
];

const latest = {};
const log = [];
const t0 = Date.now();
const ts = () => ((Date.now() - t0) / 1000).toFixed(1).padStart(5);
const counts = {};

const wss = new WebSocketServer({ port });
wss.on("connection", (ws) => {
  const send = (o) => ws.send(JSON.stringify(o));
  const press = (name, at) => setTimeout(() => {
    const k = keys.find((x) => x[0] === name);
    log.push(`${ts()} PRESS ${name}`);
    const p = { settings: k[2], coordinates: { column: 0, row: 0 }, isInMultiAction: false };
    send({ event: "keyDown", action: `${ID}.${k[1]}`, context: name, device: "dev", payload: p });
    send({ event: "keyUp", action: `${ID}.${k[1]}`, context: name, device: "dev", payload: p });
    setTimeout(() => { if (latest[name]) fs.writeFileSync(path.join(out, `press${at}-${name}.svg`), latest[name]); }, 300);
  }, at);
  ws.on("message", (buf) => {
    const m = JSON.parse(String(buf));
    if (m.event === "registerPlugin") {
      for (const [name, type, settings] of keys) {
        send({ event: "willAppear", action: `${ID}.${type}`, context: name, device: "dev",
          payload: { controller: "Keypad", settings, coordinates: { column: 0, row: 0 }, isInMultiAction: false } });
      }
      press("stat-rsi", 2000);
      press("tool-kill", 2500);
      press("tool-kill", 3500);
      press("tool-kill", 4500);
      press("tool-backup", 4500);
      press("stat-ptu", 6000);
      script.forEach(([at, fn, what], n) => {
        setTimeout(() => { fn(); log.push(`${ts()} LOG: ${what}`); }, at);
        setTimeout(() => { // checkpoint 2.5 s later (the LOG keys poll every 2 s)
          for (const [k, svg] of Object.entries(latest)) if (k.startsWith("log-")) fs.writeFileSync(path.join(out, `cp${n + 1}-${k}.svg`), svg);
          log.push(`${ts()} CHECKPOINT ${n + 1} (${what})`);
        }, at + 2500 > seconds * 1000 ? seconds * 1000 - 200 : at + 1900);
      });
      return;
    }
    counts[m.event] = (counts[m.event] || 0) + 1;
    if (m.event === "setImage") {
      const svg = Buffer.from(m.payload.image.split(",")[1], "base64").toString();
      latest[m.context] = svg;
      fs.writeFileSync(path.join(out, `${m.context}.svg`), svg);
      counts[`img:${m.context}`] = (counts[`img:${m.context}`] || 0) + 1;
    } else {
      log.push(`${ts()} ${m.event} ${m.context || ""} ${m.payload ? JSON.stringify(m.payload).slice(0, 140) : ""}`);
    }
  });
});

const info = { application: { font: "", language: "en", platform: "linux", platformVersion: "Rolling", version: "2.14.2" },
  plugin: { uuid: ID, version: "1.0" }, devicePixelRatio: 2, colors: {}, devices: [] };
const child = spawn(process.execPath, ["plugin.js", "-port", String(port), "-pluginUUID", ID, "-registerEvent", "registerPlugin",
  "-info", JSON.stringify(info)], { cwd: PLUGIN, env: process.env });
let errs = "";
child.stderr.on("data", (d) => { errs += d; });
child.stdout.on("data", (d) => { errs += d; });
setTimeout(() => {
  fs.writeFileSync(path.join(out, "log.txt"), log.join("\n") + "\n\nCOUNTS " + JSON.stringify(counts, null, 1) + "\n\nSTDERR\n" + errs);
  console.log(log.join("\n"));
  console.log("COUNTS", JSON.stringify(counts));
  if (errs.trim()) console.log("STDERR:", errs.slice(0, 2000));
  child.kill(); wss.close(); process.exit(0);
}, seconds * 1000);
