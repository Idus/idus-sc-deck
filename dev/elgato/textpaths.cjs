// Turns the <text> elements of a key SVG into <path> outlines from glyphs.json, so a Stream Deck on
// Windows draws them in the Idus fonts without having them installed. Handles what lib/keys.js
// writes: x/y, text-anchor, font-family/weight/size, letter-spacing, fill, textLength (stretched as
// lengthAdjust="spacingAndGlyphs") and <tspan> runs with their own font/size/fill.
"use strict";

const GLYPHS = require("./glyphs.json");

const FAMILY = (f) => (/jetbrains|mono/i.test(f) ? "mono" : /plex|noto/i.test(f) ? "plex" : "saira");
const WEIGHTS = { saira: [600, 700], plex: [400, 500, 600, 700], mono: [500, 600, 700] };
function face(family, weight) {
  const fam = FAMILY(family || "");
  const w = Number(weight) || 400;
  const best = WEIGHTS[fam].reduce((a, b) => (Math.abs(b - w) < Math.abs(a - w) ? b : a));
  return GLYPHS[`${fam}-${best}`];
}
const attrs = (s) => {
  const o = {};
  for (const m of String(s).matchAll(/([\w:-]+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
};
const decode = (t) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&amp;/g, "&");
const n = (v) => Math.round(v * 100) / 100;

// One <text>…</text> -> <g> with one <path> per glyph
function convert(textAttrs, inner) {
  const base = attrs(textAttrs);
  const runs = [];
  const re = /<tspan([^>]*)>([^<]*)<\/tspan>|([^<]+)/g;
  for (const m of inner.matchAll(re)) {
    const a = m[1] !== undefined ? { ...base, ...attrs(m[1]) } : base;
    const text = decode(m[1] !== undefined ? m[2] : m[3]);
    if (text) runs.push({ text, a });
  }
  if (!runs.length) return "";
  // lay out all runs on one baseline
  let x = 0;
  const glyphs = [];
  for (const r of runs) {
    const f = face(r.a["font-family"], r.a["font-weight"]);
    const size = Number(r.a["font-size"] || base["font-size"] || 16);
    const k = size / f.upm, ls = Number(r.a["letter-spacing"] || 0);
    for (const ch of r.text) {
      const g = f.g[ch] || f.g["?"];
      glyphs.push({ x, k, d: g[1], fill: r.a.fill || base.fill || "#000" });
      x += g[0] * k + ls;
    }
  }
  const width = x;
  const stretch = base.textLength ? Number(base.textLength) / width : 1;
  const anchor = base["text-anchor"] || "start";
  const x0 = Number(base.x || 0) - (anchor === "middle" ? (width * stretch) / 2 : anchor === "end" ? width * stretch : 0);
  const y = Number(base.y || 0);
  const out = glyphs.filter((g) => g.d).map((g) =>
    `<path transform="translate(${n(x0 + g.x * stretch)} ${n(y)}) scale(${n(g.k * stretch * 10000) / 10000} ${-n(g.k * 10000) / 10000})" fill="${g.fill}" d="${g.d}"/>`);
  return `<g>${out.join("")}</g>`;
}

function textToPaths(svg) {
  return String(svg).replace(/<text([^>]*)>([\s\S]*?)<\/text>/g, (_, a, inner) => convert(a, inner));
}

module.exports = { textToPaths };
