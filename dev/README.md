# Dev tools (not shipped)

```bash
cd dev && npm install                 # ws for the fake host; Playwright must be installed separately
node make-icons.cjs                   # action glyphs, key image, plugin icon (needs Playwright + Saira font)
node make-pi.cjs                      # writes ../se.wolfpack.idusscdeck.sdPlugin/pi/*.html
node fake-opendeck.cjs /tmp/run 10    # starts the plugin like OpenDeck, shows every key, presses some
node sheet.cjs /tmp/run run.png       # renders what the keys showed
node test-pi.cjs /tmp/pi              # loads each settings panel against a fake host + screenshots
bash package.sh                       # dist/se.wolfpack.idusscdeck.sdPlugin.zip for the release
```
