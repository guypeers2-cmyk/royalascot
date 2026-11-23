"""Cut six cloth voices from the credited CC0 field recordings (never foley).
Optional audio-authoring tool only. Supply the six Freesound HQ MP3 previews
as <id>.mp3 in one directory. Requires numpy, scipy, soundfile and ffmpeg.
Usage: python tools/prepare_hoofbeats.py previews/ [path/to/ffmpeg]
"""
from pathlib import Path
import hashlib, subprocess, sys
import numpy as np, soundfile as sf
from scipy import signal as sig, ndimage as nd

# Two short real stride groups per loop. M/S selection and a soft percussive
# mask suppress track announcers and wind instead of looping the whole crowd.
CUTS = [
    ('392235', 1.83, .930, .14, .72), ('392237', 2.42, 1.037, .22, .77),
    ('392236', 2.18, .907, .12, .76), ('392234', 9.93, 1.168, .26, .91),
    ('204950',32.18,1.294, .68, .99), ('508504',248.64,1.120, .42, .94),
]

def main():
    raw=Path(sys.argv[1]); ff=sys.argv[2] if len(sys.argv)>2 else 'ffmpeg'
    dest=Path(__file__).resolve().parents[1]/'assets';rate=22050
    for n,(src,at,span,side,wet) in enumerate(CUTS,1):
        with sf.SoundFile(raw/(src+'.mp3')) as source:
            sr=source.samplerate;source.seek(round((at-.25)*sr));st=source.read(round((span+.55)*sr))
        mono=st.mean(1)*(1-side)+(st[:,0]-st[:,1])*.5*side
        x=sig.resample_poly(mono,rate,sr);x=sig.sosfiltfilt(sig.butter(3,[65,3400],fs=rate,btype='bandpass',output='sos'),x)
        _,_,X=sig.stft(x,rate,nperseg=512,noverlap=384);A=abs(X);per=nd.median_filter(A,size=(15,1));harm=nd.median_filter(A,size=(1,23));mask=per**2/(per**2+2.8*harm**2+1e-18)
        _,y=sig.istft(X*((1-wet)+wet*mask),rate,nperseg=512,noverlap=384)
        start=round(rate*.25);tail=round(rate*.027);l=round(rate*span);y=y[start:start+l+tail].copy();w=np.linspace(0,1,tail);y[:tail]=y[l:]*(1-w)+y[:tail]*w;y=y[:l]
        y*=.12/max(1e-6,np.sqrt(np.mean(y*y)));y=.88*np.tanh(y/.88)
        out=dest/f'rail-hoof-{n}.mp3';subprocess.run([ff,'-loglevel','error','-y','-f','f32le','-ar',str(rate),'-ac','1','-i','pipe:0','-c:a','libmp3lame','-b:a','48k','-write_xing','1','-map_metadata','-1',str(out)],input=y.astype('<f4').tobytes(),check=True)
        print(n,src,out.stat().st_size,hashlib.sha256(out.read_bytes()).hexdigest())
if __name__=='__main__':main()
