// Where Idus SC Deck keeps its own small state files (last timer sync, seen versions, StarStrings copy).
// Linux: $XDG_STATE_HOME or ~/.local/state/idus-sc-deck · Windows: %LOCALAPPDATA%\Idus SC Deck
"use strict";

const os = require("node:os");
const path = require("node:path");

const STATE_DIR = process.platform === "win32"
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "Idus SC Deck")
  : path.join(process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local/state"), "idus-sc-deck");

module.exports = { STATE_DIR };
