#!/usr/bin/env python3
"""Writes dev/elgato/glyphs.json: outline + advance of every character the keys use, for the Idus
fonts at the weights the keys use. The Elgato build draws key text as paths from this file, so the
keys look the same on a PC without Saira, IBM Plex Sans or JetBrains Mono installed.
Needs fontTools and the fonts (the variable TTFs the installer puts in ~/.local/share/fonts/idus).
Usage: python3 dev/elgato/make-glyphs.py [font dir]"""
import json, sys
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen

FONT_DIR = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / ".local/share/fonts/idus")
FACES = {  # key -> (file, axes)
    "saira-600": ("Saira.ttf", {"wght": 600, "wdth": 100}),
    "saira-700": ("Saira.ttf", {"wght": 700, "wdth": 100}),
    "plex-400": ("IBMPlexSans.ttf", {"wght": 400, "wdth": 100}),
    "plex-500": ("IBMPlexSans.ttf", {"wght": 500, "wdth": 100}),
    "plex-600": ("IBMPlexSans.ttf", {"wght": 600, "wdth": 100}),
    "plex-700": ("IBMPlexSans.ttf", {"wght": 700, "wdth": 100}),
    "mono-500": ("JetBrainsMono.ttf", {"wght": 500}),
    "mono-600": ("JetBrainsMono.ttf", {"wght": 600}),
    "mono-700": ("JetBrainsMono.ttf", {"wght": 700}),
}
CHARS = [chr(c) for c in range(32, 127)] + [chr(c) for c in range(160, 256)] + list("·−…→←–—°×✓▶⚠±€’‘“”•")
OUT = Path(__file__).with_name("glyphs.json")

data = {}
for key, (file, axes) in FACES.items():
    font = instancer.instantiateVariableFont(TTFont(FONT_DIR / file), axes)
    cmap, gs, hmtx = font.getBestCmap(), font.getGlyphSet(), font["hmtx"]
    face = {"upm": font["head"].unitsPerEm, "g": {}}
    for ch in CHARS:
        name = cmap.get(ord(ch))
        if not name:
            continue
        pen = SVGPathPen(gs, lambda v: str(round(v)))
        gs[name].draw(pen)
        face["g"][ch] = [hmtx[name][0], pen.getCommands()]
    data[key] = face
    print(key, len(face["g"]), "glyphs")
OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print("wrote", OUT, OUT.stat().st_size // 1024, "KB")
