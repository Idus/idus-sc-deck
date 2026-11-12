// Loads each settings panel in Chromium, connects it to a fake host, checks that settings load,
// that a change is saved on the ACTION context, that plugin info is shown and that links go
// through window.open, and screenshots it the size OpenDeck shows it (full width, at most 384 px
// high; PI_W / PI_H to change). Reports how far each panel scrolls.
// Usage: node dev/test-pi.cjs <out dir>
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { WebSocketServer } = require(process.env.WS_MODULE || "ws");

const PI = process.env.PI_DIR ? path.resolve(process.env.PI_DIR) : path.join(__dirname, "..", "se.wolfpack.idusscdeck.sdPlugin", "pi");
const out = path.resolve(process.argv[2] || "pi-shots");
fs.mkdirSync(out, { recursive: true });

const cases = {
  clock: { settings: { zone: "custom", customTz: "America/Chicago", customLabel: "" }, info: {}, change: ["select", "eu"] },
  cz: { settings: { primary: "cztimer" }, info: { from: "cztimer.com", syncedAt: Date.now() - 120000, error: "", primary: "cztimer" }, change: ["select", "xyxyll"] },
  servers: { settings: { show: "status", component: "all" }, info: { statusError: "", fundingError: "", vramOk: true, prefix: "/games/star-citizen", game: { version: "4.10.2", build: "12881860" }, latest: { version: "4.10.2" }, compare: "latest" }, change: ["select", "version"] },
  version: { settings: { channel: "LIVE" }, info: { prefix: "/games/star-citizen", game: { version: "4.10.2", build: "12881860" }, latest: { version: "4.10.2" }, compare: "latest" }, change: ["select", "funding"] },
  funding: { settings: {}, info: { fundingError: "" } },
  vram: { settings: {}, info: { vramOk: true } },
  logzone: { settings: {}, info: { log: "/games/star-citizen/…/LIVE/Game.log", shard: "pub_euw1b_12881860_420" } },
  logserver: { settings: { show: "server" }, info: { log: "/games/star-citizen/…/LIVE/Game.log", shard: "pub_euw1b_12881860_420" }, change: ["select", "zone"] },
  launch: { settings: { channel: "LIVE" }, info: { prefix: "/games/star-citizen", toolbox: true }, change: ["select", "PTU"] },
  toolbox: { settings: { tbAction: "starstrings" }, info: { toolbox: true }, change: ["select", "backup"] },
};

(async () => {
  const browser = await chromium.launch();
  const results = [];
  let port = 28300;
  for (const [name, c] of Object.entries(cases)) {
    if (!fs.existsSync(path.join(PI, name + ".html"))) continue;
    port++;
    const got = [];
    const wss = new WebSocketServer({ port });
    wss.on("connection", (ws) => ws.on("message", (b) => {
      const m = JSON.parse(String(b)); got.push(m);
      if (m.event === "sendToPlugin" && m.payload.cmd === "info") {
        ws.send(JSON.stringify({ event: "sendToPropertyInspector", context: "ctx-" + name, payload: { type: "info", app: "Idus SC Deck", ...c.info } }));
      }
    }));
    const W = Number(process.env.PI_W || 1100), H = Number(process.env.PI_H || 384);
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() => { window.__opened = []; window.open = (u, t) => { window.__opened.push([u, t]); }; });
    await page.goto("file://" + path.join(PI, name + ".html"));
    await page.evaluate(([port, name, settings]) => {
      window.connectElgatoStreamDeckSocket(port, "ctx-" + name, "registerPropertyInspector", "{}",
        JSON.stringify({ action: "se.wolfpack.idusscdeck." + name, context: "ctx-" + name, payload: { settings } }));
    }, [port, name, c.settings]);
    await page.waitForTimeout(500);
    const views = await page.evaluate(() => [...document.querySelectorAll("[data-show]")].filter((e) => !e.hidden).map((e) => e.dataset.show).join(" | "));
    let changed = "n/a";
    if (c.change) {
      await page.selectOption("select[data-setting]", c.change[1]);
      await page.waitForTimeout(200);
      const set = got.filter((m) => m.event === "setSettings").pop();
      changed = set ? `${set.context} ${JSON.stringify(set.payload)}` : "NOT SAVED";
    }
    await page.click("footer a[href*='github']");
    await page.waitForTimeout(100);
    // OpenDeck: window.open; Elgato: an openUrl message on the socket
    const opened = (await page.evaluate(() => window.__opened)).concat(got.filter((m) => m.event === "openUrl").map((m) => [m.payload.url, "openUrl"]));
    await page.evaluate(() => document.fonts.ready);
    const scroll = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    await page.screenshot({ path: path.join(out, name + ".png"), fullPage: true });
    const viewsAfter = await page.evaluate(() => [...document.querySelectorAll("[data-show]")].filter((e) => !e.hidden).map((e) => e.dataset.show).join(" | "));
    results.push({ name, scroll, views, viewsAfter, registered: got.some((m) => m.event === "registerPropertyInspector"), changed, opened: opened.map((o) => o.join(" ")), errors });
    await page.close(); wss.close();
  }
  await browser.close();
  for (const r of results) console.log(JSON.stringify(r));
})();
