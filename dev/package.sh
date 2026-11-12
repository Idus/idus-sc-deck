#!/usr/bin/env bash
# Builds dist/se.wolfpack.idusscdeck.sdPlugin.zip (the release asset OpenDeck's store and the installer download).
set -euo pipefail
cd "$(dirname "$0")/.."
ID="se.wolfpack.idusscdeck"
rm -rf dist && mkdir -p dist
python3 - "$ID" <<'PY'
import os, sys, zipfile
root = sys.argv[1] + ".sdPlugin"
with zipfile.ZipFile(f"dist/{root}.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for d, _, files in os.walk(root):
        for f in sorted(files):
            p = os.path.join(d, f)
            info = zipfile.ZipInfo.from_file(p, p)
            info.external_attr = (0o755 if f.endswith(".sh") else 0o644) << 16
            with open(p, "rb") as fh:
                z.writestr(info, fh.read(), zipfile.ZIP_DEFLATED)
PY
ls -la dist
