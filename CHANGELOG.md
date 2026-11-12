# Changelog

All notable changes to Idus SC Deck. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.1] - 2026-11-12

### Changed
- **StarStrings is built in on Linux too** and works without Idus SC Toolbox: it adds `g_language = english` to `user.cfg` (Toolbox only warned about it), and the first install opens the StarStrings guide and the game folder (`xdg-open`). The other TOOL actions still use Idus SC Toolbox on Linux.
- The installer uses the plugin zip lying next to it (the release files, as [Idus GitHub Updater](https://github.com/Idus/idus-github-updater) downloads and verifies them) instead of downloading the latest release again. Piped from `curl` it still downloads the latest.

## [1.1] - 2026-11-12

### Added
- **Elgato Stream Deck (Windows) build** from the same code (`node dev/build-elgato.cjs`): Elgato's SDK, key text drawn as outlines so no fonts are needed, white action-list icons, Windows settings pages with a "Star Citizen on Linux? Read more" box.
- On Windows the TOOL key has the tools built in: kill or restart the RSI Launcher, back up and restore keybinds (Documents\SC-backups), clear shader caches and **update StarStrings** (keeps the old file, adds `g_language = english` to user.cfg).
- PLAY · Launch on Windows starts the RSI Launcher.
- A tool that fails shows the reason in red on the key for a few seconds.
- Settings footer and manifest say the plugin was made with AI assistance (Claude).

### Changed
- `lib/game.js` now picks `lib/game-linux.js` or `lib/game-win.js`; state files live in `lib/paths.js`'s folder (%LOCALAPPDATA%\Idus SC Deck on Windows).

## [1.0] - 2026-11-12

### Added
- Six key families, each with its own orange tab on the key and prefix in OpenDeck's action list: **TIME, CZ, STAT, LOG, PLAY, TOOL**.
- **TIME · Server Clock**: US W, US E, EU (Belgium), Asia, Australia, local or any IANA zone, digits coloured by the region's time of day — plus a **UTC** clock with the date for patch and event times. Regions listed west to east with their current UTC offset; any other city can be picked from a list.
- **CZ · Exec Hangar**: the Contested Zone executive hangar on one key, with cztimer.com or exec.xyxyll.com as primary timer and automatic fallback. Adapted from CZ Timer for OpenDeck (MIT).
- **STAT · Status & Stats**: one action with four views — RSI server status (Platform, PU and Arena Commander on one key or one service with open incident titles; press opens the status page), installed game version compared with the newest LIVE / PTU release notes in RSI's Patch Notes forum (green = up to date, amber = newer version out; orange lamp after a patch until pressed; press opens the release notes), crowdfunding total with yesterday's amount, and GPU memory in use with the biggest other consumer (NVIDIA).
- **LOG · Game.log**: one action with five views from your own Game.log — server (region + shard), region, shard, Armistice zone, and 30K (unexpected disconnects this session; own quits, AFK and menu teardown excluded).
- **PLAY · Launch**: starts the game via Idus SC Toolbox (`--launch`), a custom command or LUG's `sc-launch.sh`; shows RUNNING and the session time. Optional own image.
- **TOOL · Toolbox Action**: kill, restart launcher, patch/verify, backup, restore, shaders, StarStrings, fix windows — dangerous actions take three presses (red **Really?** → **Sure?** → run). The StarStrings key shows the game version the strings were made for and the install date, amber when a newer release exists. Shows GET TOOLBOX and links to it when Idus SC Toolbox is missing. The settings explain every action (click a line to pick it), what Idus SC Toolbox is (a separate Linux app) with a copy-ready install command, and link to the Star Citizen Linux Users Group (LUG).
- Settings panels in the Idus style with the family tab, credits and support links — laid out for OpenDeck's wide, low settings area: description card on the left, settings in columns beside it.
- Action-list icons in the Idus colours: orange glyphs on blue-grey.
- Installer for native and Flatpak OpenDeck, with the Idus fonts.

### Fixed
- A key added in OpenDeck stayed blank until it was moved: OpenDeck can draw its default image over the first one, so every key is drawn again 0.4 s and 1.5 s after it appears.
