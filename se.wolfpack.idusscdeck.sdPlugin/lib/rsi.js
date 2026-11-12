// RSI public data: service status (status.robertsspaceindustries.com), crowdfunding stats and the
// newest LIVE / PTU version from the titles in RSI's own Patch Notes forum on Spectrum.
"use strict";

const STATUS_URL = "https://status.robertsspaceindustries.com/index.json";
const STATUS_PAGE = "https://status.robertsspaceindustries.com/";
const FUNDING_URL = "https://robertsspaceindustries.com/api/stats/getCrowdfundStats";
const NOTES_URL = "https://robertsspaceindustries.com/api/spectrum/forum/channel/threads";
const NOTES_CHANNEL = "190048"; // Spectrum › Star Citizen › Patch Notes
const thread = (slug) => `https://robertsspaceindustries.com/spectrum/community/SC/forum/${NOTES_CHANNEL}/thread/${slug}`;
const UA = "Idus-SC-Deck (+https://github.com/Idus/idus-sc-deck)";

const cache = {
  status: { at: 0, data: null, error: "", busy: null },
  funding: { at: 0, data: null, error: "", busy: null },
  releases: { at: 0, data: null, error: "", busy: null },
};

// cState words -> our states
function normalise(s) {
  s = String(s || "").toLowerCase();
  if (["operational", "ok"].includes(s)) return "operational";
  if (["disrupted", "degraded", "partial", "degraded_performance", "partial_outage"].includes(s)) return "degraded";
  if (["down", "major", "major_outage", "outage"].includes(s)) return "major";
  if (["maintenance", "notice", "under_maintenance"].includes(s)) return "maintenance";
  return "unknown";
}

async function getJson(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { "user-agent": UA, ...(init.headers || {}) },
    signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function cached(slot, maxAgeMs, loader, force) {
  const c = cache[slot];
  if (!force && c.data && Date.now() - c.at < maxAgeMs) return Promise.resolve(c);
  if (c.busy) return c.busy;
  c.busy = loader().then((data) => { Object.assign(c, { at: Date.now(), data, error: "" }); return c; })
    .catch((e) => { c.error = e.message || String(e); c.at = Date.now(); return c; })
    .finally(() => { c.busy = null; });
  return c.busy;
}

// -> { summary, systems: [{ name, status, incident }] }
function status(force = false) {
  return cached("status", 120000, async () => {
    const d = await getJson(STATUS_URL);
    return {
      summary: normalise(d.summaryStatus),
      systems: (d.systems || []).map((s) => ({
        name: s.name,
        status: normalise(s.status),
        incident: (s.unresolvedIssues || [])[0] ? String(s.unresolvedIssues[0].title || "") : "",
      })),
    };
  }, force);
}

// -> { funds (USD), fans, yesterday (USD) }
function funding(force = false) {
  return cached("funding", 15 * 60000, async () => {
    const d = (await getJson(FUNDING_URL, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ chart: "day", fans: true, funds: true, alpha_slots: false, fleet: false }),
    })).data || {};
    const days = Object.keys(d.chart || {}).sort();
    const last = days.length ? Number(d.chart[days[days.length - 1]].gross) / 100 : NaN;
    return { funds: Number(d.funds) / 100, fans: Number(d.fans), yesterday: last };
  }, force);
}

// "4.10" vs "4.10.2" -> -1 / 0 / 1 (missing parts count as 0)
function cmpVersion(a, b) {
  const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number);
  for (let k = 0; k < Math.max(x.length, y.length, 3); k++) {
    const d = (x[k] || 0) - (y[k] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

// Thread titles -> { live: { version, url }, ptu: { version, build, url } }
//   "Star Citizen Alpha 4.10.2 LIVE Release Notes"
//   "[All Waves] Star Citizen Alpha 4.10.3 PTU RC1 Patch Notes 13160301"
// Hotfix threads and closed / Evocati / tech-preview tests are skipped.
function parseReleases(threads) {
  let live = null, ptu = null;
  for (const t of threads || []) {
    const s = String(t.subject || "");
    let m = s.match(/Alpha\s+(\d+\.\d+(?:\.\d+)?)\s+LIVE\s+Release\s+Notes/i);
    if (m && (!live || cmpVersion(m[1], live.version) > 0)) live = { version: m[1], url: thread(t.slug) };
    m = s.match(/Alpha\s+(\d+\.\d+(?:\.\d+)?)\s+PTU\b.*?\b(\d{7,9})\b/i);
    if (m && !/now closed|evocati|\bnda\b|tech[- ]?preview/i.test(s) && (!ptu || Number(m[2]) > Number(ptu.build))) {
      ptu = { version: m[1], build: m[2], url: thread(t.slug) };
    }
  }
  return { live, ptu };
}
function releases(force = false) {
  return cached("releases", 30 * 60000, async () => {
    const d = await getJson(NOTES_URL, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel_id: NOTES_CHANNEL, page: 1, sort: "newest", label_id: null }),
    });
    const r = parseReleases(((d && d.data) || {}).threads);
    if (!r.live && !r.ptu) throw new Error("no release threads found");
    return r;
  }, force);
}

function money(usd) {
  if (!Number.isFinite(usd)) return "—";
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(3)}B`;
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`;
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(0)}k`;
  return `$${usd.toFixed(0)}`;
}

function count(n) {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`;
  return String(n);
}

module.exports = { STATUS_PAGE, status, funding, releases, parseReleases, cmpVersion, money, count };
