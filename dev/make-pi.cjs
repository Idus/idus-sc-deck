// Writes the settings panels (pi/*.html) from one template. Run: node dev/make-pi.cjs
// Elgato / Windows variant: PI_TARGET=elgato node dev/make-pi.cjs <out dir>  (used by build-elgato.cjs)
const fs = require("node:fs");
const path = require("node:path");
const ELG = process.env.PI_TARGET === "elgato";
const OUT = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, "..", "se.wolfpack.idusscdeck.sdPlugin", "pi");
const VERSION = "v1.0";

const channel = (def = "LIVE") => `<label>Game channel
  <select data-setting="channel" data-default="${def}">
    <option>LIVE</option><option>PTU</option><option>EPTU</option><option>TECH-PREVIEW</option><option>HOTFIX</option>
  </select></label>`;
const prefix = ELG
  ? `<label>Game folder (the one with LIVE, PTU …) — leave empty to find it automatically
  <input type="text" data-setting="prefix" placeholder="C:\\Program Files\\Roberts Space Industries\\StarCitizen"></label>`
  : `<label>Game folder (Wine prefix) — leave empty to detect it from LUG Helper
  <input type="text" data-setting="prefix" placeholder="auto"></label>`;
const tile = (id, label) => `<div class="tile"><span class="tile-label">${label}</span><span class="tile-value mono" id="${id}">—</span></div>`;

// about = extra content for the description card (between the lede and the footer)
const page = (family, title, lede, body, script = "", about = "") => `<!doctype html>
<html lang="en" data-target="${ELG ? "elgato" : "opendeck"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${family} · ${title} · Idus SC Deck</title><link rel="stylesheet" href="pi.css"></head>
<body><div class="layout">
<aside class="about">
<header><span class="eyebrow">Idus SC Deck · ${VERSION}</span>
<div class="titlerow"><span class="tab">${family}</span><h1>${title}</h1></div></header>
<p class="lede">${lede}</p>
${about}
${ELG ? "" : "<footer data-idus></footer>"}
</aside>
<main class="settings">
${body}
</main>
</div>
${ELG ? '<footer data-idus class="below"></footer>' : ""}
<script src="pi.js"></script>
<script>
const $ = (id) => document.getElementById(id);
const ago = (ms) => { if (!ms) return "never"; const s = Math.round((Date.now() - ms) / 1000); return s < 90 ? s + " s ago" : Math.round(s / 60) + " min ago"; };
${script}
</script></body></html>
`;

// Shared "Game.log" block for the three LOG keys
const logBlock = `<section class="group"><div class="head">Game.log</div>
<div class="tiles">${tile("log", "File")}${tile("shard", "Last shard")}</div>
${channel()}
${prefix}
<p class="hint">Read-only, on this PC only — nothing is sent anywhere. The game replaces Game.log at every start; the key follows the new one automatically.</p>
</section>`;
const logScript = `PI.onInfo((i) => { $("log").textContent = i.log || "not found — check the game folder"; $("shard").textContent = i.shard || "none yet"; });`;

// ---- STAT: one action, four views (setting "show")
const statPage = (def) => page("STAT", "Status & Stats",
  "Facts about the game, RSI and your PC on one key. Pick what this key shows — put several STAT keys side by side for several views.",
  `<section class="group"><div class="head">Show</div>
<label>On the key
  <select data-setting="show" data-default="${def}">
    <option value="status">STATUS — RSI server status</option>
    <option value="version">VERSION — installed game vs the newest</option>
    <option value="funding">FUNDING — crowdfunding total</option>
    <option value="vram">VRAM — GPU memory in use</option>
  </select></label>
<div data-show="status" class="sub">
<label>Which service
  <select data-setting="component" data-default="all">
    <option value="all">RSI — all three on one key</option>
    <option value="Platform">PLAT — Platform (website, login, launcher)</option>
    <option value="Persistent Universe">PU — Persistent Universe</option>
    <option value="Arena Commander">AC — Arena Commander</option>
  </select></label>
<p class="hint">Press the key to open RSI's status page. Checked every two minutes.</p></div>
<div data-show="version" class="sub">${channel()}
<label class="check"><input type="checkbox" data-setting="openNotes" data-default="true"> Press opens the release notes of the newest version</label>
<p class="hint">Pressing always marks the version as seen (the orange lamp goes out).</p></div>
<p class="hint" data-show="funding">The total from RSI's public crowdfunding stats, refreshed every 15 minutes; the bottom line is what came in yesterday. Press to refresh.</p>
<p class="hint" data-show="vram">GPU memory in use and the biggest other program using it — handy before you launch. Press to refresh.</p>
</section>

<section class="group" data-show="status"><div class="head">Colours</div>
<div class="legend"><span><b class="ok">●</b> operational</span><span><b class="warn">●</b> degraded or partial outage</span><span><b class="error">●</b> major outage</span><span><b class="soft">●</b> maintenance</span></div>
<p class="hint">An open incident's title shows at the bottom of a single-service key.</p>
<div class="tiles">${tile("statusErr", "Last check")}</div>
<p class="hint">Data: <a href="https://status.robertsspaceindustries.com/">status.robertsspaceindustries.com</a></p></section>

<section class="group" data-show="version"><div class="head">Installed and newest</div><div class="tiles">${tile("ver", "Installed · build")}${tile("latest", "Newest on RSI")}${tile("pfx", "Game folder")}</div>
<div class="legend"><span><b class="ok">●</b> up to date — same version as the newest release notes</span><span><b class="warn">●</b> a newer version is out — the launcher will download it</span><span><b>no dot</b> unknown — offline, or EPTU / Tech-Preview</span></div>
<p class="hint">Only the RSI Launcher knows for certain — it asks RSI with your login. This key reads the titles in RSI's public <a href="https://robertsspaceindustries.com/spectrum/community/SC/forum/190048">Patch Notes forum</a> every 30 minutes instead: LIVE is compared by version number, PTU by build number. A LIVE hotfix that keeps the same version number is not seen.</p>
${prefix}</section>

<section class="group" data-show="funding"><div class="head">Source</div><div class="tiles">${tile("fundErr", "Last check")}</div>
<p class="hint">Data: RSI's public crowdfunding stats (robertsspaceindustries.com).</p></section>

<section class="group" data-show="vram"><div class="head">How it works</div><div class="tiles">${tile("vramOk", "nvidia-smi")}</div>
<p class="hint">Reads <code>nvidia-smi</code> every five seconds (NVIDIA cards only). The bar turns amber above 85 %. Star Citizen itself is left out of the "biggest other" line.</p></section>`,
  `const okTile = (id, err) => { $(id).textContent = err ? "error: " + err : "ok"; $(id).className = "tile-value mono " + (err ? "error" : "ok"); };
PI.onInfo((i) => {
  okTile("statusErr", i.statusError); okTile("fundErr", i.fundingError);
  $("vramOk").textContent = i.vramOk ? "found" : "not found — NVIDIA only"; $("vramOk").className = "tile-value mono " + (i.vramOk ? "ok" : "warn");
  $("pfx").textContent = i.prefix || "—";
  $("ver").textContent = i.game && i.game.version ? i.game.version + " · " + i.game.build : "not found in this channel";
  const l = i.latest;
  $("latest").textContent = l ? l.version + (l.build ? " · " + l.build : "") + (i.compare === "behind" ? " — update" : i.compare === "latest" ? " — you have it" : "") : (i.releasesError ? "error: " + i.releasesError : "only for LIVE and PTU");
  $("latest").className = "tile-value mono " + (i.compare === "behind" ? "warn" : i.compare === "latest" ? "ok" : "");
});
document.addEventListener("pi-settings", () => PI.send({ cmd: "info" }));`);

// ---- LOG: one action, five views (setting "show")
const logPage = (def) => page("LOG", "Game.log",
  "Live facts from Star Citizen's own Game.log on this PC. Pick what this key shows — put several LOG keys side by side for several views.",
  `<section class="group"><div class="head">Show</div>
<label>On the key
  <select data-setting="show" data-default="${def}">
    <option value="server">SERVER — region + shard + time there</option>
    <option value="region">REGION — region only, big</option>
    <option value="shard">SHARD — shard number + full shard name</option>
    <option value="zone">ZONE — inside or outside an Armistice zone</option>
    <option value="30k">30K — unexpected disconnects this session</option>
  </select></label>
<p class="hint" data-show="server region shard">Green lamp = you are in the game world (PU). Grey = in the menu or the game is not running. Region names match the TIME keys: EU, US E, US W, ASIA, AUS.</p>
<p class="hint" data-show="zone">Green frame inside (weapons locked), amber outside (weapons hot), grey when you are not in the game world. Right after you join a server it shows "no zone yet" until the first change.</p>
<p class="hint" data-show="30k">Green at 0, amber from 1, red from 3. Not counted: your own quit (30016), AFK kick (30028) and the routine menu teardown (30010). Starts over when the game restarts.</p>
</section>${logBlock}`, logScript);

const pages = {
  clock: page("TIME", "Server Clock",
    "The time where the servers are — and UTC, which patches and events are announced in. Put one key per region side by side.",
    `<section class="group"><div class="head">Region</div>
<label>Time zone
  <select data-setting="zone" data-default="us-west">
    <optgroup label="Server regions — west to east">
      <option value="us-west" data-tz="America/Los_Angeles">US W — US West (Pacific)</option>
      <option value="us-east" data-tz="America/New_York">US E — US East (Eastern)</option>
      <option value="utc">UTC — patches and events</option>
      <option value="eu" data-tz="Europe/Brussels">EU — Europe (servers in Belgium)</option>
      <option value="asia" data-tz="Asia/Tokyo">ASIA — Asia (Tokyo time)</option>
      <option value="aus" data-tz="Australia/Sydney">AUS — Australia (Sydney)</option>
    </optgroup>
    <optgroup label="Other">
      <option value="local" data-tz="local">LOCAL — my own time</option>
      <option value="custom">Pick a city…</option>
    </optgroup>
  </select></label>
<div id="custom" style="display:none;gap:10px">
<div class="row2">
<label>Part of the world<select id="area"></select></label>
<label>City<select id="city" data-setting="customTz"></select></label>
</div>
<label>Label on the key (up to 9 characters)<input type="text" id="label" data-setting="customLabel" maxlength="9" placeholder="the city name"></label></div>
<label class="check"><input type="checkbox" data-setting="h12"> 12-hour clock (am/pm on the bottom line)</label>
</section>
<section class="group"><div class="head">Colours</div>
<div class="legend"><span><b class="warn">17–22</b> evening — usually the busiest time</span><span><b class="soft">23–06</b> night — usually quiet</span><span><b>07–16</b> daytime</span></div>
<p class="hint">The colour comes from the clock in that region, not from live server data — RSI does not publish load per region. The UTC key always stays white and shows the date instead.</p></section>`,
    `// UTC offset of a zone right now, e.g. "UTC+1" (follows summer time)
const offset = (tz) => {
  try {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const v = (p.find((x) => x.type === "timeZoneName") || {}).value || "";
    return v.replace("GMT", "UTC").replace("-", "−").replace(/^UTC$/, "UTC±0");
  } catch (e) { return ""; }
};
const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
document.querySelectorAll("option[data-tz]").forEach((o) => {
  const o2 = offset(o.dataset.tz === "local" ? localTz : o.dataset.tz);
  if (o2) o.textContent += " · " + o2;
});

// Every time zone the system knows, as part of the world → city (no IANA codes to type)
let zones = [];
try { zones = Intl.supportedValuesOf("timeZone"); } catch (e) {}
const AREA = { America: "Americas", Europe: "Europe", Asia: "Asia", Australia: "Australia", Pacific: "Pacific", Africa: "Africa", Atlantic: "Atlantic", Indian: "Indian Ocean", Antarctica: "Antarctica", Arctic: "Arctic" };
const byArea = {};
for (const z of zones) {
  const [area, ...rest] = z.split("/");
  if (!AREA[area] || !rest.length) continue;
  const city = rest.reverse().map((x) => x.replace(/_/g, " ")).join(", ");
  (byArea[area] = byArea[area] || []).push({ tz: z, city });
}
const areaSel = $("area"), citySel = $("city");
if (!zones.length) {
  // Very old webview without the zone list: fall back to typing the code
  const inp = document.createElement("input");
  inp.type = "text"; inp.id = "city"; inp.dataset.setting = "customTz"; inp.placeholder = "e.g. America/Chicago";
  citySel.replaceWith(inp); areaSel.closest("label").style.display = "none";
} else {
  Object.keys(AREA).filter((a) => byArea[a]).forEach((a) => areaSel.add(new Option(AREA[a], a)));
}
function fillCities(area) {
  const list = (byArea[area] || []).slice().sort((x, y) => x.city.localeCompare(y.city));
  citySel.innerHTML = "";
  for (const c of list) citySel.add(new Option(c.city + " · " + offset(c.tz), c.tz));
}
function showTz(tz) {
  if (!zones.length) return;
  const area = (tz || "").split("/")[0];
  if (byArea[area]) { areaSel.value = area; fillCities(area); citySel.value = tz; }
  const city = (tz || "").split("/").pop().replace(/_/g, " ").toUpperCase();
  $("label").placeholder = city ? city.slice(0, 9) + " (from the city)" : "the city name";
}
areaSel.addEventListener("change", () => {
  fillCities(areaSel.value);
  citySel.dispatchEvent(new Event("change"));
});
function sync() {
  const custom = PI.settings.zone === "custom";
  $("custom").style.display = custom ? "grid" : "none";
  if (!custom) return;
  if (!PI.settings.customTz) {
    // First time: start on your own city so the key shows something sensible right away
    const known = zones.includes(localTz) && byArea[localTz.split("/")[0]];
    showTz(known ? localTz : "Europe/Brussels");
    if (zones.length && citySel.value) citySel.dispatchEvent(new Event("change"));
    return;
  }
  showTz(PI.settings.customTz);
}
document.addEventListener("pi-settings", sync); sync();`),
  cz: page("CZ", "Exec Hangar",
    "The executive hangar on one key: open or closed, countdown, the clock time of the next change and the five door lights.",
    `<section class="group"><div class="head">Timer source</div>
<label>Primary timer
  <select data-setting="primary" data-default="cztimer">
    <option value="cztimer">cztimer.com (recommended)</option>
    <option value="xyxyll">exec.xyxyll.com</option>
  </select></label>
<p class="hint">The other one is the secondary. If neither answers, the key uses the last good copy on disk, then built-in values. Syncs every 15 minutes; press the key to sync now.</p>
<div class="tiles">${tile("from", "Using")}${tile("when", "Last sync")}</div>
<button class="btn" type="button" onclick="PI.send({ cmd: 'resync' })">Sync now</button>
</section>
<section class="group"><div class="head">Lights</div>
<div class="legend"><span><b class="error">●</b> red / <b class="ok">●</b> green — lit, as in game</span><span><b style="color:#5a6270">○</b> empty ring — dark</span>
<span>Closed: five red, one turns green every 24 min. Open: five green, one goes dark every 12 min; the last 5 min are CLOSING.</span></div></section>
<section class="group"><div class="head">Credits</div>
<p class="hint">Cycle math and light table adapted from <a href="https://github.com/NyleGarcia/cztimer-opendeck">CZ Timer for OpenDeck</a> by Nyle Garcia (MIT). Timer data from <a href="https://cztimer.com/">cztimer.com</a> and <a href="https://exec.xyxyll.com/">exec.xyxyll.com</a> — thank you!</p></section>`,
    `PI.onInfo((i) => { $("from").textContent = i.from || "—"; $("when").textContent = ago(i.syncedAt) + (i.error ? " · " + i.error : ""); $("when").className = "tile-value mono " + (i.error ? "warn" : ""); });`),

  servers: statPage("status"),
  logserver: logPage("server"),
  // Settings pages for keys placed before STAT and LOG became one action each (OpenDeck keeps the
  // page path of a placed key): same page, opening on that key's view.
  ...(ELG ? {} : { version: statPage("version"), funding: statPage("funding"), vram: statPage("vram"),
    logzone: logPage("zone"), log30k: logPage("30k") }),

  ...(ELG ? {
  launch: page("PLAY", "Launch",
    "Starts the RSI Launcher, which updates itself and starts the game. While the game runs, the key turns green and counts your session time.",
    `<section class="group"><div class="head">Start with</div>
<div class="tiles">${tile("via", "Starts via")}${tile("pfx", "Game folder")}</div>
<label>Custom command — optional, overrides the RSI Launcher
  <input type="text" data-setting="command" placeholder="e.g. &quot;D:\\Games\\RSI Launcher\\RSI Launcher.exe&quot;"></label>
${prefix}
<p class="hint">Without a custom command the key starts <code>RSI Launcher.exe</code> next to the game folder, or from its usual place in Program Files.</p>
</section>
<section class="group"><div class="head">Look</div>
${channel()}
<label>Own image above the button — optional PNG/SVG path
  <input type="text" data-setting="image" placeholder="C:\\Users\\you\\Pictures\\emblem.png"></label>
<p class="hint">Leave empty for the Idus rocket. Use only images you have the right to use.</p>
</section>`,
    `PI.onInfo((i) => { $("pfx").textContent = i.prefix || "—"; $("via").textContent = PI.settings.command ? "custom command" : "RSI Launcher"; });
document.addEventListener("pi-settings", () => PI.send({ cmd: "info" }));`),

  } : {
  launch: page("PLAY", "Launch",
    "Starts Star Citizen. While the game runs, the key turns green and counts your session time.",
    `<section class="group"><div class="head">Start with</div>
<div class="tiles">${tile("via", "Starts via")}${tile("pfx", "Game folder")}</div>
<label>Custom command — optional, overrides the above
  <input type="text" data-setting="command" placeholder="e.g. lutris lutris:rungame/star-citizen"></label>
${prefix}
<p class="hint">With <a href="https://github.com/Idus/idus-sc-toolbox">Idus SC Toolbox</a> installed the key runs <code>idus-sc-toolbox --launch</code>, which checks for a newer RSI Launcher first. Without it the key runs LUG Helper's <code>sc-launch.sh</code>.</p>
</section>
<section class="group"><div class="head">Look</div>
${channel()}
<label>Own image above the button — optional PNG/SVG path
  <input type="text" data-setting="image" placeholder="/home/you/Pictures/emblem.png"></label>
<p class="hint">Leave empty for the Idus rocket. Use only images you have the right to use.</p>
</section>`,
    `PI.onInfo((i) => { $("pfx").textContent = i.prefix || "—"; $("via").textContent = PI.settings.command ? "custom command" : (i.toolbox ? "Idus SC Toolbox (--launch)" : "LUG sc-launch.sh"); });
document.addEventListener("pi-settings", () => PI.send({ cmd: "info" }));`),

  }),
  ...(ELG ? {
  toolbox: page("TOOL", "SC Tools",
    "Runs one tool from the key. The tools are built in — nothing else to install.",
    `<section class="group"><div class="head">Action</div>
<label>The key runs
  <select data-setting="tbAction" data-default="kill">
    <option value="kill">Kill SC + RSI Launcher ⚠</option>
    <option value="restart">Restart RSI Launcher ⚠</option>
    <option value="backup">Back up keybinds + cfg</option>
    <option value="restore">Restore latest backup ⚠</option>
    <option value="shaders">Clear shader cache</option>
    <option value="starstrings">Update StarStrings</option>
  </select></label>
${channel()}
<p class="hint">⚠ = takes three presses. The channel matters for shaders and StarStrings.</p>
<p class="hint">StarStrings shows the game version the installed strings were made for and the install date, e.g. "4.10 · 8 Nov". Green dot = no newer release on GitHub, amber = a newer release exists or the strings are for an older patch.</p>
${prefix}
</section>
<section class="group wide"><div class="head">What the actions do</div>
<div class="acts">${[
  ["kill", "Kill SC ⚠", "Force-stops Star Citizen and the RSI Launcher — for a game that hangs."],
  ["restart", "Restart launcher ⚠", "Stops both, then starts the RSI Launcher again."],
  ["backup", "Back up", "Copies keybinds and settings (the user folder without shader caches, and USER.cfg of every channel) to Documents\\SC-backups."],
  ["restore", "Restore ⚠", "Puts back the newest backup. Only when the game is closed, and it saves the current state first."],
  ["shaders", "Clear shaders", "Deletes the shader caches in %LOCALAPPDATA%\\Star Citizen (game closed). The next start takes longer while they rebuild."],
  ["starstrings", "StarStrings", "Downloads the newest StarStrings (MrKraken) from GitHub into the channel, keeps the old file as a backup and adds g_language = english to user.cfg."],
].map(([v, name, text]) => `<div class="act" data-act="${v}" role="button" tabindex="0"><b>${name}</b><span>${text}</span></div>`).join("")}</div>
<p class="hint">Click a line to pick it.</p>
</section>`,
    `const actSel = document.querySelector('select[data-setting="tbAction"]');
function markAct() { const v = PI.settings.tbAction || actSel.value || "kill"; document.querySelectorAll(".act").forEach((el) => el.classList.toggle("on", el.dataset.act === v)); }
document.querySelectorAll(".act").forEach((el) => {
  const pick = () => { actSel.value = el.dataset.act; actSel.dispatchEvent(new Event("change")); };
  el.addEventListener("click", pick);
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
});
document.addEventListener("pi-settings", markAct); markAct();`),
  } : {
  toolbox: page("TOOL", "Toolbox Action",
    "Runs one Idus SC Toolbox action from the key.",
    `<section class="group"><div class="head">Action</div>
<div id="tbInstall" class="sub install" hidden>
<p class="hint"><b class="warn">Install Idus SC Toolbox first.</b> On Arch / CachyOS, paste this in a terminal:</p>
<div class="cmd"><pre id="tbCmd">sudo pacman -S --needed python-gobject gtk4
d=$(mktemp -d) &amp;&amp; cd "$d" &amp;&amp; for f in idus-sc-toolbox.py install-idus-sc-toolbox.sh idus-sc-toolbox.png; do curl -fsSLO "https://github.com/Idus/idus-sc-toolbox/releases/latest/download/$f"; done &amp;&amp; bash install-idus-sc-toolbox.sh</pre></div>
<div class="btnrow"><button class="btn primary" type="button" data-copy-pre="tbCmd">Copy install command</button></div>
<p class="hint">Other distributions: install the GTK4 Python bindings (python-gobject / python3-gi and gtk4), then run the second line.</p>
</div>
<label>The key runs
  <select data-setting="tbAction" data-default="kill">
    <option value="kill">Kill SC + launcher + wineserver ⚠</option>
    <option value="restart">Restart launcher ⚠</option>
    <option value="patch">Patch / verify launcher ⚠</option>
    <option value="backup">Back up keybinds + cfg</option>
    <option value="restore">Restore latest backup ⚠</option>
    <option value="shaders">Clear shader cache</option>
    <option value="starstrings">Update StarStrings</option>
    <option value="fixwindows">Fix windows (main screen)</option>
  </select></label>
${channel()}
<p class="hint">⚠ = takes three presses. The channel matters for shaders and StarStrings.</p>
<p class="hint">StarStrings shows the game version the installed strings were made for and the install date, e.g. "4.10 · 8 Nov". Green dot = no newer release on GitHub, amber = a newer release exists or the strings are for an older patch.</p>
</section>
<section class="group wide"><div class="head">What the actions do</div>
<div class="acts">${[
  ["kill", "Kill SC ⚠", "Force-stops Star Citizen, the RSI Launcher and Wine (wineserver) in the game folder — for a game that hangs."],
  ["restart", "Restart launcher ⚠", "Stops everything, then starts the RSI Launcher again with LUG's sc-launch.sh."],
  ["patch", "Patch / verify ⚠", "Like restart, but on the PATCH runner — for game updates and Verify. Needs patch mode in sc-launch.sh (see the Toolbox README)."],
  ["backup", "Back up", "Saves keybinds and settings (the user folder and USER.cfg of every channel) plus sc-launch.sh to a dated backup."],
  ["restore", "Restore ⚠", "Puts back the newest backup. Only when the game is closed, and it takes a safety copy of the current state first."],
  ["shaders", "Clear shaders", "Deletes the shader cache for the channel (game closed). The next launch takes longer while it rebuilds."],
  ["starstrings", "StarStrings", "Downloads the newest StarStrings (MrKraken) from GitHub into the channel."],
  ["fixwindows", "Fix windows", "Centres the RSI Launcher and moves Star Citizen to the main screen (KDE)."],
].map(([v, name, text]) => `<div class="act" data-act="${v}" role="button" tabindex="0"><b>${name}</b><span>${text}</span></div>`).join("")}</div>
<p class="hint">Click a line to pick it.</p>
</section>`,
    `PI.onInfo((i) => {
  $("tbInstall").hidden = !!i.toolbox;
  $("tbPill").textContent = i.toolbox ? "● installed" : "○ not installed";
  $("tbPill").className = "pill " + (i.toolbox ? "ok" : "");
});
const actSel = document.querySelector('select[data-setting="tbAction"]');
function markAct() { const v = PI.settings.tbAction || actSel.value || "kill"; document.querySelectorAll(".act").forEach((el) => el.classList.toggle("on", el.dataset.act === v)); }
document.querySelectorAll(".act").forEach((el) => {
  const pick = () => { actSel.value = el.dataset.act; actSel.dispatchEvent(new Event("change")); };
  el.addEventListener("click", pick);
  el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
});
document.addEventListener("pi-settings", markAct); markAct();`,
    `<div class="tbbox">
<div class="tbhead"><b>Idus SC Toolbox</b><span class="pill" id="tbPill">checking…</span></div>
<p class="hint">A separate, free app for Star Citizen on <b>Linux</b> (KDE Plasma 6), a companion to the LUG Helper. The TOOL keys run its actions, so it has to be installed on this PC — all other keys work without it.</p>
<p class="hint"><a href="https://github.com/Idus/idus-sc-toolbox">Idus SC Toolbox on GitHub</a> · <a href="#" onclick="PI.send({ cmd: 'info' }); return false;">check again</a></p>
<p class="hint">Built on the Star Citizen <b>Linux Users Group</b>: <a href="https://github.com/starcitizen-lug/lug-helper">LUG Helper</a> · <a href="https://github.com/starcitizen-lug/knowledge-base">knowledge base</a> · <a href="https://starcitizen-lug.github.io">wiki</a> · <a href="https://robertsspaceindustries.com/orgs/LUG">LUG on RSI</a></p>
</div>`),
  }),
};

for (const f of fs.readdirSync(OUT)) if (f.endsWith(".html")) fs.unlinkSync(path.join(OUT, f));
for (const [name, html] of Object.entries(pages)) fs.writeFileSync(path.join(OUT, `${name}.html`), html);
console.log("wrote", Object.keys(pages).join(", "));
