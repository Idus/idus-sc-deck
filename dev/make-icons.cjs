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

// Plugin / app icon in the style of the other Idus app icons (GitHub Updater, SC Toolbox, Elgato
// Light, Hamster Wheel): glossy rounded frame, dark teal glow, faint reticle and code lines, teal
// haze at the bottom — with a small deck of six keys in the middle, the rocket on the centre key.
const deckKey = (x, y, inner, glow = false) =>
  `<rect x="${x}" y="${y}" width="74" height="74" rx="15" fill="#0f1115" stroke="${glow ? "#ff9a3c" : "#2a2f3a"}" stroke-width="${glow ? 2.5 : 2}"/>` +
  `<g transform="translate(${x + 37} ${y + 37}) scale(1.45) translate(-20 -20)">${inner}</g>`;
const orange = (d) => `<g fill="none" stroke="#ff9a3c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${d}</g>`;
const rocketBig = `<g transform="translate(20 20) rotate(45) scale(0.74)"><path d="M-9 4 L-18 19 L-9 16 Z M9 4 L18 19 L9 16 Z" fill="#9fb4d4"/><path d="M-5 16 L0 28 L5 16 Z" fill="#ffd9a0"/><path d="M0 -32 C10 -21 11 -6 9 16 L-9 16 C-11 -6 -10 -21 0 -32 Z" fill="#e8eaed"/><circle cx="0" cy="-11" r="4.5" fill="#0f1115"/></g>`;
const CODE_L = ["shard[euw1b_420]", "if (zone) lock();", "cz.open = true", "  utc.tick()", "30k = 0;"];
const CODE_R = ["// o7", "status: ok", "  launch()", "brb.never()", "{ SC DECK }"];
const DX = 256 - (3 * 74 + 2 * 14) / 2, DY = 286 - (2 * 74 + 14) / 2; // 3 × 2 keys, centred
const big = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs>
  <clipPath id="sq"><rect x="14" y="14" width="484" height="484" rx="118"/></clipPath>
  <radialGradient id="bg" cx="0.5" cy="0.54" r="0.62"><stop offset="0" stop-color="#134846"/><stop offset="0.42" stop-color="#0b2427"/><stop offset="1" stop-color="#04080a"/></radialGradient>
  <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#2ad1b2" stop-opacity="0.32"/><stop offset="1" stop-color="#2ad1b2" stop-opacity="0"/></radialGradient>
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6f9"/><stop offset="0.55" stop-color="#c3c9d1"/><stop offset="1" stop-color="#7d8590"/></linearGradient>
  <filter id="haze" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2"/></filter>
  <filter id="txt" x="-20%" y="-40%" width="140%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="7" flood-color="#ff9a3c" flood-opacity="0.35"/></filter>
</defs>
<g clip-path="url(#sq)">
  <rect width="512" height="512" fill="url(#bg)"/>
  <ellipse cx="256" cy="540" rx="300" ry="120" fill="#27c2a8" opacity="0.5" filter="url(#haze)"/>
  <ellipse cx="256" cy="508" rx="190" ry="10" fill="#7ff0dc" opacity="0.35" filter="url(#haze)"/>
  <g stroke="#57d6c4" fill="none" stroke-width="1.4">
    <circle cx="256" cy="286" r="172" opacity="0.16"/><circle cx="256" cy="286" r="128" opacity="0.1" stroke-dasharray="3 7"/>
    <path d="M28 286 H484 M256 150 V430" opacity="0.14"/>
    <path d="M84 286 v-8 M428 286 v-8 M256 114 h8 M256 458 h8" opacity="0.3"/>
    <path d="M40 200 h44 l18 18 h30 M472 200 h-44 l-18 18 h-30 M40 372 h52 l14 -14 h26 M472 372 h-52 l-14 -14 h-26" opacity="0.2"/>
  </g>
  <g fill="#57d6c4"><rect x="62" y="282" width="8" height="8" opacity="0.45"/><rect x="442" y="282" width="8" height="8" opacity="0.45"/></g>
  <g font-family="JetBrains Mono" font-size="12.5" fill="#7fe0d0" opacity="0.2" filter="url(#soft)">
    ${CODE_L.map((t, i) => `<text x="38" y="${158 + i * 18}">${t}</text>`).join("")}
    ${CODE_R.map((t, i) => `<text x="474" y="${392 + i * 18}" text-anchor="end">${t}</text>`).join("")}
  </g>
  <circle cx="256" cy="286" r="175" fill="url(#glow)"/>
  <rect x="${DX - 16}" y="${DY - 16}" width="${3 * 74 + 2 * 14 + 32}" height="${2 * 74 + 14 + 32}" rx="26" fill="#1e222b" stroke="#3a4150" stroke-width="2.5"/>
  ${deckKey(DX, DY, orange(glyphs.clock))}
  ${deckKey(DX + 88, DY, rocketBig, true)}
  ${deckKey(DX + 176, DY, orange(glyphs.servers))}
  ${deckKey(DX, DY + 88, orange(glyphs.cz))}
  ${deckKey(DX + 88, DY + 88, orange(glyphs.logserver).replace('fill="#262b36"', 'fill="#0f1115"'))}
  ${deckKey(DX + 176, DY + 88, orange(glyphs.toolbox))}
  <text x="256" y="120" text-anchor="middle" font-family="Saira" font-weight="700" font-size="96" letter-spacing="3" fill="#ff9a3c" filter="url(#txt)">IDUS</text>
  <text x="256" y="458" text-anchor="middle" font-family="IBM Plex Sans" font-weight="700" font-size="56" letter-spacing="2" fill="#ff9a3c" filter="url(#txt)">SC DECK</text>
</g>
<rect x="18.5" y="18.5" width="475" height="475" rx="114" fill="none" stroke="#0a1012" stroke-width="3"/>
<rect x="14" y="14" width="484" height="484" rx="118" fill="none" stroke="url(#rim)" stroke-width="9"/>
</svg>`;
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
