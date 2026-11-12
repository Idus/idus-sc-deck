// Writes manifest.json. Order = order in OpenDeck's action list: TIME, CZ, STAT, LOG, PLAY, TOOL.
const fs = require("node:fs");
const path = require("node:path");
const ID = "se.wolfpack.idusscdeck";

const actions = [
  ["clock", "TIME · Server Clock", "Time in a server region (US W, US E, EU, Asia, Australia, your own or any city) or UTC with the date — patches and events are announced in UTC. Amber = local evening, blue = night (by the clock, not live load)."],
  ["cz", "CZ · Exec Hangar", "Contested Zone executive hangar on one key: open/closed, countdown, the clock time of the next change and the five door lights. Press to re-sync."],
  ["servers", "STAT · Status & Stats", "One key, four views: RSI server status (all or one service — press opens the status page), installed game version vs the newest release notes, crowdfunding total, or GPU memory in use."],
  ["logserver", "LOG · Game.log", "Live from your Game.log, one view per key: server (region + shard + time there), region, shard, Armistice zone, or 30K disconnects this session."],
  ["launch", "PLAY · Launch", "Starts Star Citizen (through Idus SC Toolbox if installed, else LUG's sc-launch.sh). Shows RUNNING and the session time."],
  ["toolbox", "TOOL · Toolbox Action", "Runs an Idus SC Toolbox action: kill, restart or patch the launcher, backup, restore, shaders, StarStrings, fix windows. Dangerous ones take three presses (Really? → Sure? → run)."],
];

const manifest = {
  Name: "Idus SC Deck",
  UUID: ID,
  Version: "1.0",
  Author: "Idus",
  Description: "Star Citizen keys for OpenDeck on Linux, grouped as TIME, CZ, STAT, LOG, PLAY and TOOL: server-region clocks and UTC, a one-key Contested Zone hangar timer, STAT views (RSI server status, game version vs newest, funding, VRAM), Game.log views (server/shard, Armistice zone, 30K counter), a launch key and Idus SC Toolbox actions. Made by Idus with AI assistance (Claude). Unofficial fan project, not affiliated with Cloud Imperium Games.",
  URL: "https://github.com/Idus/idus-sc-deck",
  Icon: "imgs/plugin",
  Category: "Idus SC Deck",
  CategoryIcon: "imgs/category",
  SDKVersion: 2,
  CodePath: "plugin.js",
  CodePathLin: "plugin.js",
  Software: { MinimumVersion: "6.5" },
  OS: [{ Platform: "linux", MinimumVersion: "0" }],
  Actions: actions.map(([type, name, tip]) => ({
    Name: name, UUID: `${ID}.${type}`, Icon: `imgs/actions/${type}`, Tooltip: tip,
    Controllers: ["Keypad"], SupportedInMultiActions: false, DisableAutomaticStates: true,
    PropertyInspectorPath: `pi/${type}.html`, States: [{ Image: "imgs/key", ShowTitle: false }],
  })),
};
fs.writeFileSync(path.join(__dirname, "..", `${ID}.sdPlugin`, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log("manifest:", actions.length, "actions");
