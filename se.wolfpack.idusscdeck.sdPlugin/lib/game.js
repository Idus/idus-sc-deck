// The local Star Citizen install: Linux (LUG Helper + Idus SC Toolbox) or Windows (built-in tools).
"use strict";

module.exports = process.platform === "win32" ? require("./game-win") : require("./game-linux");
