// Builds the Elgato Stream Deck (Windows) version from the same code as the OpenDeck plugin:
//   build/elgato/se.wolfpack.idusscdeck.sdPlugin/          the plugin folder
//   build/elgato/se.wolfpack.idusscdeck.streamDeckPlugin    double-click to install, or upload to Maker Console
// Differences: Elgato's SDK instead of lib/sdk.js (dev/elgato/sdk-elgato.cjs), key text drawn as
// outlines (dev/elgato/glyphs.json), white action-list icons, Windows settings pages, Elgato manifest.
// Once: cd dev && npm install.  Then: node dev/build-elgato.cjs
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const ID = "se.wolfpack.idusscdeck";
const SRC = path.join(ROOT, `${ID}.sdPlugin`);
const OUTDIR = path.join(ROOT, "build", "elgato");
const PLUG = path.join(OUTDIR, `${ID}.sdPlugin`);
const BIN = path.join(__dirname, "node_modules", ".bin");

const src = JSON.parse(fs.readFileSync(path.join(SRC, "manifest.json"), "utf8"));
// 1.0 -> 1.0.0.<build>; ELGATO_BUILD=n bumps the last part so a test build installs over the previous one
const VERSION = `${src.Version}.0.0`.split(".").slice(0, 3).concat(String(Number(process.env.ELGATO_BUILD || 0))).join(".");

const actions = [
  ["clock", "TIME · Server Clock", "Time in a server region (US W, US E, EU, Asia, Australia, your own or any city) or UTC with the date — patches and events are announced in UTC."],
  ["cz", "CZ · Exec Hangar", "Contested Zone executive hangar on one key: open/closed, countdown, the clock time of the next change and the five door lights. Press to re-sync."],
  ["servers", "STAT · Status & Stats", "One key, four views: RSI server status (press opens the status page), installed game version vs the newest release notes, crowdfunding total, or GPU memory in use."],
  ["logserver", "LOG · Game.log", "Live from your Game.log, one view per key: server (region + shard + time there), region, shard, Armistice zone, or 30K disconnects this session."],
  ["launch", "PLAY · Launch", "Starts the RSI Launcher. Shows RUNNING and the session time while the game runs."],
  ["toolbox", "TOOL · SC Tools", "Built-in tools: kill or restart the launcher, back up and restore keybinds, clear shaders, update StarStrings. Dangerous ones take three presses."],
];

const manifest = {
  $schema: "https://schemas.elgato.com/streamdeck/plugins/manifest.json",
  Name: src.Name,
  UUID: ID,
  Version: VERSION,
  Author: src.Author,
  Description: "Star Citizen keys in the Idus look: server-region clocks and UTC, a one-key Contested Zone hangar timer, RSI server status, game version, funding, your server/shard, Armistice zone and 30K counter from Game.log, a launch key and built-in tools including StarStrings updates. Unofficial fan project, not affiliated with Cloud Imperium Games.",
  URL: "https://github.com/Idus/idus-sc-deck",
  SupportURL: "https://github.com/Idus/idus-sc-deck/issues",
  Icon: "imgs/plugin",
  Category: src.Category,
  CategoryIcon: "imgs/category",
  CodePath: "bin/plugin.js",
  Nodejs: { Version: "24", Debug: "disabled" },
  SDKVersion: 3,
  Software: { MinimumVersion: "7.1" },
  OS: [{ Platform: "windows", MinimumVersion: "10" }],
  Actions: actions.map(([type, name, tip]) => ({
    Name: name, UUID: `${ID}.${type}`, Icon: `imgs/actions/${type}`, Tooltip: tip,
    Controllers: ["Keypad"], SupportedInMultiActions: false, DisableAutomaticStates: true, UserTitleEnabled: false,
    PropertyInspectorPath: `pi/${type}.html`, States: [{ Image: "imgs/key", ShowTitle: false }],
  })),
};

(async () => {
  fs.rmSync(OUTDIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(PLUG, "imgs"), { recursive: true });
  fs.writeFileSync(path.join(PLUG, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  // one bundled bin/plugin.js; lib/sdk.js is swapped for the Elgato adapter
  const esbuild = require("esbuild");
  await esbuild.build({
    entryPoints: [path.join(SRC, "plugin.js")],
    outfile: path.join(PLUG, "bin", "plugin.js"),
    bundle: true, platform: "node", target: "node24", format: "cjs", legalComments: "eof", logLevel: "warning",
    define: { __IDUS_ACTIONS__: JSON.stringify(manifest.Actions.map((a) => a.UUID)) },
    plugins: [{
      name: "elgato-sdk",
      setup(b) { b.onResolve({ filter: /^\.\/lib\/sdk(\.js)?$/ }, () => ({ path: path.join(__dirname, "elgato", "sdk-elgato.cjs") })); },
    }],
  });

  for (const f of ["plugin.png", "plugin@2x.png", "key.png", "key@2x.png"]) fs.copyFileSync(path.join(SRC, "imgs", f), path.join(PLUG, "imgs", f));
  execFileSync(process.execPath, [path.join(__dirname, "make-icons.cjs")], { env: { ...process.env, ICON_OUT: PLUG, ICON_STYLE: "white" }, stdio: "inherit" });
  for (const f of fs.readdirSync(path.join(PLUG, "imgs", "actions"))) {
    if (!actions.some(([t]) => `${t}.svg` === f)) fs.unlinkSync(path.join(PLUG, "imgs", "actions", f));
  }
  fs.mkdirSync(path.join(PLUG, "pi"));
  execFileSync(process.execPath, [path.join(__dirname, "make-pi.cjs"), path.join(PLUG, "pi")], { env: { ...process.env, PI_TARGET: "elgato" }, stdio: "inherit" });
  for (const f of ["pi.css", "pi.js"]) fs.copyFileSync(path.join(SRC, "pi", f), path.join(PLUG, "pi", f));
  fs.copyFileSync(path.join(SRC, "LICENSE"), path.join(PLUG, "LICENSE"));
  fs.writeFileSync(path.join(PLUG, "THIRD_PARTY_NOTICES.md"),
    fs.readFileSync(path.join(SRC, "THIRD_PARTY_NOTICES.md"), "utf8").replace(/## Fonts[\s\S]*$/,
      "## Fonts\n\nThe key text is drawn from glyph outlines of Saira, IBM Plex Sans and JetBrains Mono — SIL Open Font\n" +
      "License 1.1 (https://openfontlicense.org), from Google Fonts. The settings pages use the fonts if installed.\n\n" +
      "## Elgato Stream Deck SDK\n\n@elgato/streamdeck — MIT License, Corsair Memory Inc. (bundled in bin/plugin.js).\n"));

  // validate + pack with Elgato's CLI
  execFileSync(path.join(BIN, "streamdeck"), ["pack", PLUG, "-o", OUTDIR, "-f", "--no-update-check", "--no-file-list"], { stdio: "inherit" });
  console.log(`\n✓ ${path.relative(ROOT, OUTDIR)}/${ID}.streamDeckPlugin  (v${VERSION})`);
})().catch((e) => { console.error(e); process.exit(1); });
