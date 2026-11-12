# Dev tools (not shipped)

```bash
cd dev && npm install                 # ws, esbuild, Elgato SDK + CLI; Playwright must be installed separately
                                      # on a network share (no symlinks): npm install --no-bin-links
node make-icons.cjs                   # action glyphs, key image, plugin icon (needs Playwright + Saira font)
node make-pi.cjs                      # writes ../se.wolfpack.idusscdeck.sdPlugin/pi/*.html
node fake-opendeck.cjs /tmp/run 10    # starts the plugin like OpenDeck, shows every key, presses some
node sheet.cjs /tmp/run run.png       # renders what the keys showed
node test-pi.cjs /tmp/pi              # loads each settings panel against a fake host + screenshots
bash package.sh                       # dist/se.wolfpack.idusscdeck.sdPlugin.zip for the release
```

## Elgato Stream Deck (Windows)

The same plugin code, built for Elgato's Stream Deck app:

```bash
node build-elgato.cjs                 # → build/elgato/se.wolfpack.idusscdeck.streamDeckPlugin (+ the .sdPlugin folder)
python3 elgato/make-glyphs.py         # only when the fonts or the character set change → elgato/glyphs.json
```

- `elgato/sdk-elgato.cjs` replaces `lib/sdk.js` in the bundle: Elgato's SDK (`@elgato/streamdeck` v2, needed for
  Marketplace DRM) behind the same small interface.
- `elgato/textpaths.cjs` turns the key text into outlines from `elgato/glyphs.json` (Saira, IBM Plex Sans,
  JetBrains Mono, OFL), so keys look the same on a PC without those fonts.
- `lib/game-win.js` is the Windows side of `lib/game.js`: finds the install, tasklist instead of /proc, starts the
  RSI Launcher, and has the tools built in (kill, restart launcher, backup/restore, shaders, StarStrings).
- Settings pages: `PI_TARGET=elgato node make-pi.cjs <dir>` — Windows texts, GitHub-only footer and a
  "Star Citizen on Linux? Read more" box.
- Test the bundle against the fake host: `FAKE_PLUGIN_DIR=../build/elgato/se.wolfpack.idusscdeck.sdPlugin FAKE_ENTRY=bin/plugin.js node fake-opendeck.cjs /tmp/run 10`
  and the pages: `PI_DIR=../build/elgato/se.wolfpack.idusscdeck.sdPlugin/pi node test-pi.cjs /tmp/pi`.
