// Builds the plugin's icons: action-list glyphs (SVG), the default key image and the
// plugin/category icons (SVG + PNG via Playwright). Run: node dev/make-icons.cjs
// Action-list style: orange glyph on the Idus blue-grey (button colour) — OpenDeck rounds the
// corners and adds its own grey border. ICON_STYLE=white gives plain white glyphs on transparent
// (what Elgato's guidelines ask for in the Stream Deck app; for the Windows build later).
const fs = require("node:fs");
const path = require("node:path");

// ICON_OUT=<plugin dir>: only write the action-list icons there (used by build-elgato.cjs)
const P = process.env.ICON_OUT ? path.resolve(process.env.ICON_OUT) : path.join(__dirname, "..", "se.wolfpack.idusscdeck.sdPlugin");
const WHITE = process.env.ICON_STYLE === "white";
// White style: Elgato's sizes (action 20 px, category 28 px) and no blue-grey masks
const W = (d, scale = 0.8, px = scale === 1 ? 28 : 20) => WHITE
  ? `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 40 40" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d.replace(/fill="#262b36"/g, 'fill="none"')}</svg>`
  : `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
    `<rect width="40" height="40" fill="#262b36"/>` +
    `<g transform="translate(20 20) scale(${scale}) translate(-20 -20)" stroke="#ff9a3c" stroke-width="2.75">${d}</g></svg>`;

const rocketPath = `<g transform="translate(20 20) rotate(45)"><path d="M0 -15 C5 -10 5.5 -3 4.5 8 L-4.5 8 C-5.5 -3 -5 -10 0 -15 Z"/><circle cx="0" cy="-5" r="2"/><path d="M-4.5 2 L-9 10 L-4.5 8.5 M4.5 2 L9 10 L4.5 8.5 M-2 9 L0 14 L2 9"/></g>`;
const glyphs = {
  clock: `<circle cx="20" cy="20" r="13"/><path d="M20 12 V20 L26 23"/>`,
  cz: `<path d="M7 33 V14 L20 7 L33 14 V33"/><path d="M12 33 V20 H28 V33"/><path d="M13 16h.01M16.5 16h.01M20 16h.01M23.5 16h.01M27 16h.01" stroke-width="3"/>`,
  // bar chart: the STAT action (server status, version, funding or VRAM)
  servers: `<path d="M7 33h26"/><rect x="9.5" y="19" width="5.5" height="14" rx="1.5"/><rect x="17.25" y="9" width="5.5" height="24" rx="1.5"/><rect x="25" y="14" width="5.5" height="19" rx="1.5"/>`,
  // server + map pin: "which server you landed on" (the LOG action shows server, zone or 30K)
  logserver: `<rect x="5" y="9" width="20" height="8" rx="2"/><rect x="5" y="21" width="20" height="8" rx="2"/><path d="M9 13h.01M9 25h.01"/><path d="M30.5 33s6-5.3 6-10a6 6 0 0 0-12 0c0 4.7 6 10 6 10z" fill="#262b36"/><circle cx="30.5" cy="23" r="2"/>`,
  launch: rocketPath,
  toolbox: `<path d="M24.5 8.5a6 6 0 0 0-7.6 7.6L8.5 24.5a2.8 2.8 0 0 0 4 4l8.4-8.4a6 6 0 0 0 7.6-7.6l-3.7 3.7-3.4-.6-.6-3.4z"/>`,
};
fs.mkdirSync(path.join(P, "imgs/actions"), { recursive: true });
for (const f of fs.readdirSync(path.join(P, "imgs/actions"))) fs.unlinkSync(path.join(P, "imgs/actions", f));
for (const [name, d] of Object.entries(glyphs)) fs.writeFileSync(path.join(P, "imgs/actions", `${name}.svg`), W(d));
fs.writeFileSync(path.join(P, "imgs", "category.svg"), W(rocketPath, 1)); // shown at 20 px: glyph full size
if (process.env.ICON_OUT) { console.log("list icons →", P); process.exit(0); }

// Default key image (shown for a moment before the plugin draws)
const keySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="#16181d"/><rect x="4.5" y="4.5" width="135" height="135" rx="16" fill="#0f1115" stroke="#2a2f3a" stroke-width="1.5"/><circle cx="20" cy="26" r="3.5" fill="#ff9a3c"/></svg>`;
fs.writeFileSync(path.join(P, "imgs", "key.svg"), keySvg);

// Plugin icon: IDUS / rocket / SC DECK, like the SC Toolbox icon layout
const big = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<rect x="16" y="16" width="480" height="480" rx="96" fill="#0f1115" stroke="#2a2f3a" stroke-width="6"/>
<text x="256" y="138" text-anchor="middle" font-family="Saira" font-weight="700" font-size="104" letter-spacing="4" fill="#ff9a3c">IDUS</text>
<g transform="translate(256 262) rotate(45) scale(3.1)"><path d="M-9 4 L-18 19 L-9 16 Z M9 4 L18 19 L9 16 Z" fill="#9fb4d4"/><path d="M-5 16 L0 28 L5 16 Z" fill="#ffd9a0"/><path d="M0 -32 C10 -21 11 -6 9 16 L-9 16 C-11 -6 -10 -21 0 -32 Z" fill="#e8eaed"/><circle cx="0" cy="-11" r="4.5" fill="#0f1115"/></g>
<g fill="#ff9a3c"><circle cx="150" cy="300" r="7"/><circle cx="362" cy="300" r="7" fill="#46d160"/></g>
<text x="256" y="452" text-anchor="middle" font-family="Saira" font-weight="700" font-size="72" letter-spacing="6" fill="#ff9a3c">SC DECK</text></svg>`;
fs.writeFileSync(path.join(__dirname, "..", "idus-sc-deck.svg"), big);

(async () => {
  const { chromium } = require("playwright"); // only for the PNGs below, not for ICON_OUT (Elgato build)
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  const shot = async (svg, size, out, scale = 1) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`)}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  };
  await shot(big, 512, path.join(__dirname, "..", "idus-sc-deck.png"));
  await shot(big, 256, path.join(P, "imgs", "plugin.png"));
  await shot(big, 512, path.join(P, "imgs", "plugin@2x.png"));
  await shot(keySvg, 72, path.join(P, "imgs", "key.png"));
  await shot(keySvg, 144, path.join(P, "imgs", "key@2x.png"));
  await browser.close();
})();
