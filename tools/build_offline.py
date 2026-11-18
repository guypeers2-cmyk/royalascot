"""Build one strictly offline HTML edition. Usage: python tools/build_offline.py [output.html]"""
from pathlib import Path
import base64, re, sys, json
root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / 'royal-ascot.html'
types = {'.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff'}
def uri(path):
    return 'data:' + types[path.suffix] + ';base64,' + base64.b64encode(path.read_bytes()).decode()
html = (root/'index.html').read_text()
html = re.sub(r'<link rel="preload"[^>]+>', '', html)
html = html.replace('href="assets/emblem.svg"', 'href="'+uri(root/'assets/emblem.svg')+'"')
css = (root/'styles.css').read_text()
css = re.sub(r"url\('([^']+)'\)", lambda m: "url('"+uri(root/m[1])+"')", css)
html = html.replace('<link rel="stylesheet" href="styles.css">', '<style>\n'+css+'\n</style>')
assets = {p.name:uri(p) for p in sorted((root/'assets').glob('*.webp'))}
html = html.replace('<script src="js/art.js">', '<script>window.ASCOT_ASSETS='+json.dumps(assets,separators=(',',':'))+';</script>\n<script src="js/art.js">')
def inline(m):
    code=(root/m[1]).read_text().replace('</script', '<\\/script')
    return '<script>\n'+code+'\n</script>'
html = re.sub(r'<script src="(js/[^"\n]+)"></script>', inline, html)
notices = (root/'CREDITS.md').read_text()+'\n'+'\n'.join(p.read_text() for p in sorted((root/'licenses').glob('*.txt')))
html = html.replace('</body>', '<script type="text/plain" id="asset-notices">\n'+notices.replace('</script','<\\/script')+'\n</script>\n</body>')
out.write_text(html)
print(f'Created {out.name}: {out.stat().st_size:,} bytes; {len(assets)} inline image assets.')
