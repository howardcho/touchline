#!/usr/bin/env python3
"""Package the shared web UI for a native host (optional output directory argument)."""
from pathlib import Path
import re, shutil, sys
root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else root/'ios/Touchline/Web'
out.mkdir(parents=True,exist_ok=True)
modules=['session','engine','preferences','sounds','native-audio','app']
parts=['(()=>{const modules={};const load=name=>modules[name];']
for name in modules:
    source=(root/f'{name}.mjs').read_text()
    source=re.sub(r"import \{([^}]+)\} from '\./([^']+)\.mjs';",lambda m:f'const {{{m[1]}}}=load("{m[2]}");',source)
    exports=re.findall(r'export (?:const|let|function|class) (\w+)',source)
    source=source.replace('export ','')
    # import.meta is only used by the browser's audio loader, bypassed in native mode.
    source=source.replace('import.meta.url',"document.baseURI")
    parts.append(f'modules["{name}"]=(()=>{{\n{source}\nreturn {{{",".join(exports)}}};\n}})();')
parts.append('})();')
(out/'touchline.js').write_text('\n'.join(parts))
html=(root/'index.html').read_text().replace('<script type="module" src="app.mjs"></script>','<script src="touchline.js"></script>')
(out/'index.html').write_text(html)
for file in ['styles.css','icon.svg','manifest.webmanifest','apple-touch-icon.png','icon-192.png','icon-512.png']:
    shutil.copy2(root/file,out/file)
shutil.copytree(root/'audio',out/'audio',dirs_exist_ok=True)
print('Prepared offline Touchline resources.')
