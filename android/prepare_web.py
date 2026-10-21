#!/usr/bin/env python3
"""Bundle the shared app and its exact audio catalog for Android's offline host."""
from pathlib import Path
import json, subprocess
root = Path(__file__).resolve().parent.parent
out = root / 'android/app/src/main/assets'
subprocess.run(['python3', str(root/'ios/prepare_web.py'), str(out)], check=True)
html = (out/'index.html').read_text().replace('<html lang="en">', '<html lang="en" class="android-host">').replace('<script src="touchline.js"></script>', '<script src="android-host.js"></script><script src="touchline.js"></script>')
(out/'index.html').write_text(html)
# The native parent already excludes system bars/cutouts, so do not apply them twice.
with (out/'styles.css').open('a') as css:
    css.write('\n:root.android-host{--safe-top:0px;--safe-right:0px;--safe-bottom:0px;--safe-left:0px}\n:root.android-host:has(#board.clock-view:not([hidden])){background:#183b30}\n.android-host #board.clock-view{inset:0;padding-top:max(12px,var(--safe-top));padding-bottom:max(20px,var(--safe-bottom))}\n')
(out/'android-host.js').write_text((root/'android/host.js').read_text())
# Derive this map from the same module as the web and iPad players.
source = subprocess.check_output(['node', '--input-type=module', '-e',
    "import {AUDIO_FILES} from './sounds.mjs'; console.log(JSON.stringify(AUDIO_FILES))"], cwd=root, text=True)
files = json.loads(source)
for name, file in files.items():
    if not (out/'audio'/file).is_file():
        raise FileNotFoundError(file)
(out/'audio-catalog.json').write_text(json.dumps(files, indent=2)+'\n')
print(f'Prepared Android app with {len(files)} audio clips.')
