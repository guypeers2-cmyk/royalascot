"""Studio-only intra-stock prediction. Entire rectangles, never separately
retimed legs, may be borrowed from a developed shutter of the SAME bearing.
Compare the true colour and alpha before deciding. WebP retains new detail;
the game blits reused patches once at decode. No video decoder or readback.
"""
from base64 import b64encode,b64decode
import json, math
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
ROOT=Path(__file__).resolve().parents[1]; MAP=ROOT/'js/trot-reels.js'
# cell width,height, columns, bearings, horizontal/vertical subdivisions
# All dimensions (including pigment plates) have integral cell boundaries.
SPEC={'turn':[[132,105,14,28,11,7],[44,35,14,28,11,7]],'hd':[[308,245,6,2,7,7],[105,84,6,2,7,7]]}
def index(key,p,a):return p*28+a if key=='turn' else a*12+p
def origin(key,i,s):w,h,c,*_=s;return (i%c*w,i//c*h)
def coords(key,p,a,s):return origin(key,index(key,p,a),s)
def shift(p,h):return math.floor(.5-.008*math.cos(4*math.pi*(p/12-.4375))*h*.991/(.72*1.44))
def grid(im,key,p,a,s):x,y=coords(key,p,a,s);return np.asarray(im.crop((x,y,x+s[0],y+s[1]))).astype('int16')
def measure(im):
 if im.shape[2]==3:return im
 alpha=im[:,:,3:4];black=(im[:,:,:3].astype('int32')*alpha+127)//255
 return np.concatenate([black,255-alpha+black,alpha],axis=2).astype('int16')
def develop(key,plates):
 s=SPEC[key][0];w,h,c,angles,nx,ny=s;ids=np.full((12,angles,ny,nx),15,dtype='uint8');out=[q.copy() for q in plates];skips=visible=0
 for a in range(angles):
  originals=[[grid(q,key,p,a,SPEC[key][int(n!=0)]) for p in range(12)] for n,q in enumerate(plates)]
  raw=[[measure(q) for q in stack] for stack in originals];built=[[q.copy() for q in stack] for stack in raw]
  for p in range(1,12):
   # The other diagonal is generally the closest trunk. Also test the other
   # heights to avoid reprinting a still head or tail in all twelve shutters.
   order=sorted(range(p),key=lambda r:(r!=(p+6)%12,abs(math.cos(4*math.pi*(p/12-.4375))-math.cos(4*math.pi*(r/12-.4375)))))
   for ty in range(ny):
    for tx in range(nx):
     x=tx*w//nx;y=ty*h//ny;master=originals[0][p][y:y+h//ny,x:x+w//nx];
     if not np.any(master[:,:,3]>10):continue
     visible+=1
     for r in order:
      views=[]
      for n,stack in enumerate(raw):
       W,H,_,_,_,_=SPEC[key][int(n!=0)];X,Y=tx*W//nx,ty*H//ny;right,bottom=X+W//nx,Y+H//ny;dy=shift(r,H)-shift(p,H)
       if Y+dy<0 or bottom+dy>H:break
       target=stack[p][Y:bottom,X:right];previous=built[n][r][Y+dy:bottom+dy,X:right];d=target-previous
       # Tight alpha/edge bound: a swinging hoof cannot be copied from its
       # opposite load. Pigment is a low-frequency correction to the master.
       if not n:
        # The same half-cycle has identical trunk geometry; independently
        # compressed studio takes differ slightly in colour. Never exchange
        # two visibly different silhouettes, even on the return diagonal.
        if np.max(np.abs(d[:,:,-1]))>28 or np.mean(d.astype('float32')**2)>(50 if r==p-6 else 24):break
       elif np.mean(d.astype('float32')**2)>(75 if r==p-6 else 45):break
       views.append((target,previous,Y,bottom,X,right))
      if len(views)==len(raw):
       ids[p,a,ty,tx]=r;skips+=1
       for n,(_,prev,Y,B,X,R) in enumerate(views):built[n][p][Y:B,X:R]=prev
       break
  for n,im in enumerate(out):
   W,H,_,_,_,_=SPEC[key][int(n!=0)];bg=(128,128,128) if n else (0,0,0,0)
   for p in range(1,12):
    X,Y=coords(key,p,a,SPEC[key][int(n!=0)]);small=Image.fromarray(np.uint8(ids[p,a]!=15)*255);skip=small.resize((W,H),Image.Resampling.NEAREST)
    # Leave a one-pixel codec guard inside the copied region so the new
    # adjacent chroma and alpha encode against their real neighbours.
    skip=skip.filter(ImageFilter.MinFilter(3));im.paste(bg,(X,Y,X+W,Y+H),skip)
 packed=ids.ravel();data=b64encode(bytes((packed[::2]|(packed[1::2]<<4)))).decode();print(key,'copied',skips,'/',visible,'occupied interframe patches',flush=True)
 return out,{'spec':SPEC[key],'data':data}
def maps():return json.loads(MAP.read_text().split('globalThis.AscotTrotReels=')[1].split(';')[0])
def write_maps(m):MAP.write_text('/* Authored by tools/pack_gait.py. One nibble per shutter patch. */\nglobalThis.AscotTrotReels='+json.dumps(m,separators=(',',':'))+';\n')
def unroll(im,key,n=0):
 meta=maps()[key];s=meta['spec'][int(n!=0)];w,h,c,angles,nx,ny=s;raw=b64decode(meta['data']);out=im.copy();tw=w//nx;th=h//ny
 for p in range(12):
  for a in range(angles):
   X,Y=coords(key,p,a,s)
   for ty in range(ny):
    for tx in range(nx):
     i=((p*angles+a)*ny+ty)*nx+tx;r=(raw[i//2]>>(4*(i%2)))&15
     if r==15:continue
     x=tx*tw;y=ty*th;U,V=coords(key,r,a,s);dy=shift(r,h)-shift(p,h)
     out.paste(out.crop((U+x,V+y+dy,U+x+tw,V+y+th+dy)),(X+x,Y+y))
 return out
