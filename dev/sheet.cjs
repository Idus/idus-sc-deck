// Renders every <name>.svg in a folder to one PNG sheet (what the keys actually showed).
// Usage: node dev/sheet.cjs <svg dir> <out.png> [title]
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const dir = path.resolve(process.argv[2]);
const outPng = path.resolve(process.argv[3]);
const title = process.argv[4] || "Idus SC Deck · test run";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
const cells = files.map((f) => {
  const uri = "data:image/svg+xml;base64," + fs.readFileSync(path.join(dir, f)).toString("base64");
  return `<figure><img src="${uri}" width="144" height="144"><figcaption>${f.replace(/\.svg$/, "")}</figcaption></figure>`;
}).join("");
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#16181d;color:#8a93a3;font:13px 'IBM Plex Sans',sans-serif}
.wrap{padding:22px 26px;width:max-content}
h1{font:700 26px Saira,sans-serif;color:#ffd9a0;margin:0 0 14px}
.grid{display:grid;grid-template-columns:repeat(6,150px);gap:14px}
figure{margin:0;display:grid;gap:6px;justify-items:center}img{border-radius:14px}
</style><div class="wrap"><h1>${title}</h1><div class="grid">${cells}</div></div>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 1100, height: 600 } });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await (await p.$(".wrap")).screenshot({ path: outPng });
  await b.close();
})();
