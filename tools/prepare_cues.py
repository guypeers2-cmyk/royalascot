"""Restore the FLAC compatibility copy from the two verified masters.
Optional authoring utility; not part of playing, hosting or the HTML build.
Use --ffmpeg /path/to/ffmpeg if the executable is not on PATH. No download.
"""
import argparse, hashlib, os, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; A=ROOT/'assets'

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--ffmpeg',default='ffmpeg');args=ap.parse_args()
    for name,digest in [('countdown-fanfare.m4a','73e5d6501e358c1408cc3c069eb92f1a'),('start-gate-metal-door.mp3','8693705e3622b7cd1fe961a1663291e5')]:
        if hashlib.md5((A/name).read_bytes()).hexdigest()!=digest:raise SystemExit('Not the verified supplied source: '+name)
    with tempfile.TemporaryDirectory(dir=A) as tmp:
        out=Path(tmp)/'call.flac'
        subprocess.run([args.ffmpeg,'-hide_banner','-loglevel','error','-i',str(A/'countdown-fanfare.m4a'),'-map','0:a:0','-vn','-map_metadata','-1','-c:a','flac','-sample_fmt','s16','-compression_level','8',str(out)],check=True)
        os.replace(out,A/'countdown-fanfare.flac')
    print('Supplied M4A and MP3 intact; created the 48 kHz mono FLAC compatibility copy.')

if __name__=='__main__':main()
