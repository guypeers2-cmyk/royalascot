"""Build one strictly offline HTML edition. Usage: python tools/build_offline.py [output.html]"""
from pathlib import Path
import base64, re, sys, json, zlib, subprocess
root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]) if len(sys.argv) > 1 else root.parent / 'royal-ascot.html'
types = {'.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.m4a':'audio/mp4', '.flac':'audio/flac', '.mp3':'audio/mpeg', '.ogg':'audio/ogg'}
def uri(path):
    return 'data:' + types[path.suffix] + ';base64,' + base64.b64encode(path.read_bytes()).decode()
html = (root/'index.html').read_text()
html = re.sub(r'<link rel="preload"[^>]+>', '', html)
html = html.replace('href="assets/emblem.svg"', 'href="'+uri(root/'assets/emblem.svg')+'"')
# The stage backdrop and panel grain also appear in the runtime art registry.
# Use the same embedded bytes for CSS instead of repeating megabytes of URLs.
css_art=set()
def css_url(sheet, match):
    art=(root/sheet).parent/match[1]
    if art.suffix=='.webp':
        assert art.resolve().parent==(root/'assets').resolve()
        css_art.add(art.name)
        return f'var(--plate-{art.stem})'
    return "url('"+uri(art)+"')"
for sheet in ('styles.css', 'assets/console.css','assets/programme.css','assets/long-course.css','assets/compact-field.css','assets/runner-slip.css','assets/trackside.css'):
    css = (root/sheet).read_text()
    css = re.sub(r"url\('([^']+)'\)", lambda m: css_url(sheet,m), css)
    html = html.replace(f'<link rel="stylesheet" href="{sheet}">', '<style>\n'+css+'\n</style>')
# Printable basE91 for exact local media. Excluding a tag opener and the
# two JSON escape characters keeps the payload safe inside a script tag.
alphabet=''.join(chr(n) for n in range(33,127) if n not in (34,60,92))
def base91(data):
    out=[]; acc=bits=0
    for b in data:
        acc|=b<<bits;bits+=8
        if bits>13:
            v=acc&8191;n=13 if v>88 else 14;v=acc&((1<<n)-1);acc>>=n;bits-=n
            out.extend((alphabet[v%91],alphabet[v//91]))
    if bits:
        out.append(alphabet[acc%91]);
        if bits>7 or acc>90:out.append(alphabet[acc//91])
    return ''.join(out)
def deflate(b):
    codec=zlib.compressobj(9,wbits=-15);return codec.compress(b)+codec.flush()
def piece(b):
    z=deflate(b) if len(b)>256 else b
    return [len(b),base91(z),len(z)] if len(z)+20<len(b) else [len(b),base91(b)]
# Identical alpha planes occur in several numbered silks. Intern complete
# RIFF chunks, including padding, so archived photographs decode byte-for-byte.
assets, pieces, where = {}, [], {}
# Keep a sparse local checkout valid without penalizing a regular source ZIP:
# only the deliberately skipped, immutable old stocks need Node/Git here.
sealed=json.loads((root/'tools/registered-plates.json').read_text())
missing={}
if any(not (root/'assets'/n).is_file() for n in sealed):
    missing={n:base64.b64decode(b) for n,b in json.loads(subprocess.check_output(['node',str(root/'tools/sparse-plates.cjs')])).items()}
for name in sorted({p.name for p in (root/'assets').glob('*.webp')}|missing.keys()):
    p=root/'assets'/name;data=missing[name] if name in missing else p.read_bytes(); pos=12; chunks=[data[:pos]]
    assert data[:4]==b'RIFF' and data[8:12]==b'WEBP'
    while pos<len(data):
        n=int.from_bytes(data[pos+4:pos+8],'little'); end=pos+8+n+(n%2)
        chunks.append(data[pos:end]);pos=end
    assert b''.join(chunks)==data
    ids=[]
    for part in chunks:
        if part not in where:
            where[part]=len(pieces); pieces.append(piece(part))
        ids.append(where[part])
    assets[p.name]=[len(data),ids]
def registry(records,parts,tag):
    return ('''window.TAG=(()=>{const map={},pieces=CHUNKS;
for(const [key,[len,ids,mime]] of Object.entries(PAYLOAD))Object.defineProperty(map,key,{enumerable:true,configurable:true,get(){
 const bytes=new Uint8Array(len);let j=0;for(const id of ids){const [size,src,zip]=pieces[id],v=ascot91(src,zip||size);bytes.set(zip?AscotInflater.unpack(v):v,j);j+=size;}
 let uri='data:'+(mime||'image/webp')+';base64,';for(let i=0;i<len;i+=24576)uri+=btoa(String.fromCharCode(...bytes.subarray(i,i+24576)));
 Object.defineProperty(map,key,{value:uri,enumerable:true});return uri;}});return map;})();'''.replace('TAG',tag).replace('PAYLOAD',json.dumps(records,separators=(',',':'))).replace('CHUNKS',json.dumps(parts,separators=(',',':'))))
sheet_vars=('for(const n of '+json.dumps(sorted(css_art))+')'
            'document.documentElement.style.setProperty("--plate-"+n.slice(0,-5),"url("+window.ASCOT_ASSETS[n]+")");')
html = html.replace('<script src="js/art.js">', '<script>'+registry(assets,pieces,'ASCOT_ASSETS')+sheet_vars+'</script>\n<script src="js/art.js">')
# Losslessly pack the audio as well. This keeps the self-contained edition
# below ten MiB without changing a note, frame, font or archived negative.
audio={};sound=[]
for n in ('countdown-fanfare.m4a','countdown-fanfare.flac','start-gate-metal-door.mp3','race-radio.ogg','race-encore.ogg','paddock-radio.ogg',*(f'rail-hoof-{i}.mp3' for i in range(1,7))):
    art=root/'assets'/n;raw=art.read_bytes();audio[n]=[len(raw),[len(sound)],types[art.suffix]];sound.append(piece(raw))
html=html.replace('<script src="js/audio.js">','<script>'+registry(audio,sound,'ASCOT_AUDIO')+'</script>\n<script src="js/audio.js">')
# Synchronous local inflate. No fetch, blob worker, eval, CDN or special
# native codec; the ordinary hosted source remains directly readable.
loader=(root/'tools/inline-inflate.js').read_text()+'''
const ascotDigits=new Uint8Array(128);[...ALPHABET].forEach((c,i)=>ascotDigits[c.charCodeAt(0)]=i);
function ascot91(src,n){const out=new Uint8Array(n);let i=0,j=0,acc=0,bits=0;for(;i+1<src.length;i+=2){const v=ascotDigits[src.charCodeAt(i)]+91*ascotDigits[src.charCodeAt(i+1)];acc|=v<<bits;bits+=(v&8191)>88?13:14;while(bits>=8){out[j++]=acc;acc>>>=8;bits-=8;}}if(i<src.length)out[j++]=(acc|ascotDigits[src.charCodeAt(i)]<<bits)&255;return out;}
function ascotUnpack(s,n,tag){const b=AscotInflater.unpack(ascot91(s,n)),el=document.createElement(tag);el.textContent=new TextDecoder().decode(b);document.head.append(el);}
'''.replace('ALPHABET',json.dumps(alphabet))
html=html.replace('</title>','</title><script>'+loader+'</script>',1)
def packed(code,tag):
    data=deflate(code.encode())
    return '<script>ascotUnpack("'+base91(data)+'",'+str(len(data))+',"'+tag+'")</script>'
html=re.sub(r'<style>(.*?)</style>',lambda m:packed(m[1],'style'),html,flags=re.S)
html=re.sub(r'<script src="(js/[^"\n]+)"></script>',lambda m:packed((root/m[1]).read_text(),'script'),html)
notices = (root/'CREDITS.md').read_text()+'\n'+'\n'.join(p.read_text() for p in sorted((root/'licenses').glob('*.txt')))
html = html.replace('</body>', '<script type="text/plain" id="asset-notices">\n'+notices.replace('</script','<\\/script')+'\n</script>\n</body>')
out.write_text(html)
print(f'Created {out.name}: {out.stat().st_size:,} bytes; {len(assets)} inline images; 2 start cues and 6 runner recordings plus English commentary ({len(audio)} audio files).')
