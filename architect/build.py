"""Pak de drie gegevensbronnen in één netwerkvrij HTML-werkboek."""
from pathlib import Path
import json
base=Path(__file__).resolve().parent
s=(base/'workbook.tmpl').read_text()
for k in ['roles','presets','bench']:
    raw=json.dumps(json.loads((base/(k+'.json')).read_text()),ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
    s=s.replace('@@'+k.upper()+'@@',raw)
assert '@@' not in s
(base/'index.html').write_text(s)
