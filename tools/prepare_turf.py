"""Register a fine-cut sward to the existing rails; no live frame does this work.
The original plate is the input. Never run a second turf pass over the output.
The same repeating albedo / nap direction is used by the orbit table.
"""
from pathlib import Path
import json,subprocess
import numpy as np,cv2 as cv
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]; A=ROOT/'assets';F='f'; TAU=2*np.pi

def tile(root=ROOT):
    # Edge crossfade with a half-period shifted interior: an actual periodic
    # scan, not a conspicuous four-way mirror. Retain individual cut blades.
    rgb=np.float32(Image.open(root/'art-src/turf-study.jpg').convert('RGB').resize((640,640),Image.Resampling.LANCZOS));n=len(rgb);y,x=np.mgrid[:n,:n]
    for axis,v in [(0,y),(1,x)]:
        w=np.clip(1-np.minimum(v,n-1-v)/66,0,1);w=(w*w*(3-2*w))[:,:,None];rgb=rgb*(1-w)+np.roll(rgb,n//2,axis=axis)*w
    avg=rgb.mean((0,1));rgb=np.clip((rgb-avg)*.88+[85,116,62],0,255).astype('B');Image.fromarray(rgb).save(root/'assets/turf-fibre.webp',quality=89,method=6);return rgb

def surface(tex,X,Z,strength=.105,mip=1):
    # UVs in metres. Broad, soft alternating mowing directions are separate
    # from the blade detail; close and distant camera see the same scale.
    n=tex.shape[0];gx=(X/.44*n+97).astype(F);gy=(Z/.44*n+51).astype(F)
    g=cv.remap(cv.GaussianBlur(tex,(0,0),mip),gx,gy,cv.INTER_LINEAR,borderMode=cv.BORDER_WRAP).astype(F)
    waves=(.77*np.tanh(2.9*np.sin(TAU*(X/.73+.16*Z)))+.23*np.sin(TAU*Z/1.49+X*1.1))*strength
    return g*(1+waves[:,:,None])

def fillmap(shape,screen,world):
    h,w=shape[:2];X=np.zeros((h,w),F);Z=X.copy();mask=np.zeros((h,w),'B')
    for i in range(len(screen)-1):
        for tri in [(0,1,3),(0,3,2)]:
            ps=screen[i:i+2].reshape(4,2)[list(tri)].astype(F);ws=world[i:i+2].reshape(4,2)[list(tri)].astype(F)
            x0=max(0,int(np.floor(ps[:,0].min())));x1=min(w,int(np.ceil(ps[:,0].max()))+2);y0=max(0,int(np.floor(ps[:,1].min())));y1=min(h,int(np.ceil(ps[:,1].max()))+2)
            if y0>=y1 or x0>=x1:continue
            local=np.zeros((y1-y0,x1-x0),'B');cv.fillConvexPoly(local,np.int32(np.rint((ps-[x0,y0])*16)),255,cv.LINE_8,4);yy,xx=np.mgrid[y0:y1,x0:x1].astype(F);m=cv.getAffineTransform(ps,ws);at=local>0
            for dest,row in [(X,m[0]),(Z,m[1])]:dest[y0:y1,x0:x1][at]=(row[0]*xx+row[1]*yy+row[2])[at]
            mask[y0:y1,x0:x1][at]=255
    return X,Z,mask

def side(root=ROOT):
    files=root/'assets';tex=tile(root);src=np.asarray(Image.open(files/'side-station.webp').convert('RGB'));h,w=src.shape[:2];k=w/1150
    script="const C=require('./js/course');console.log(JSON.stringify(Array.from({length:241},(_,i)=>[-.036,1.032].map(l=>{const p=C.photo(i/240,l);return [p.x,p.y,...C.path(i/240,l)]}))))"
    a=np.float32(json.loads(subprocess.check_output(['node','-e',script],cwd=root)));X,Z,mask=fillmap(src.shape,a[:,:,:2]*k,a[:,:,2:]);yy,xx=np.mgrid[:h,:w];g=surface(tex,X,Z,mip=1.12)
    s=src.astype(F);r,green,b=s.transpose(2,0,1);lum=s@[.29,.57,.14];illum=np.clip(cv.GaussianBlur(lum,(0,0),10)/62,.68,1.48)
    g*=((.67+.25*illum)*(.86+.15*np.clip((yy/k-294)/148,0,1)))[:,:,None];cov=mask.astype(F)/255
    # Leave the measured cream rails, foreground console, colourful grass
    # island and lettering untouched. The two live occluders share this plate.
    near=Image.open(files/'side-rail.webp').getchannel('A');far=Image.open(files/'side-back-rail.webp').getchannel('A');covers=np.maximum(np.array(near),np.array(far))/255
    cov*=1-covers;cov*=np.clip((151-lum)/42,0,1);cov*=np.clip((r-green+9)/11,0,1);cov=cv.GaussianBlur(cov,(3,3),.39)
    out=Image.fromarray(np.uint8(np.clip(s+(g-s)*cov[:,:,None],0,255)));out.save(files/'side-station.webp',quality=94,method=5)
    for name,alpha in [('side-rail',near),('side-back-rail',far)]:
        im=out.convert('RGBA');im.putalpha(alpha);im.save(files/(name+'.webp'),quality=94,method=5)

def judges(root=ROOT,return_mask=False):
    tex=np.array(Image.open(root/'assets/turf-fibre.webp').convert('RGB'));src=np.float32(Image.open(root/'assets/tangent-rail.webp').convert('RGB'));h,w=src.shape[:2];y,x=np.mgrid[:h,:w].astype(F);a=np.arctan2(.54-.088,1.22);co=np.cos(a);si=np.sin(a);v=(y-360)/1380;dep=.54*(co-v*si)/np.maximum(.035,v*co+si);X=1.70+(x-844)*(dep*co+.54*si)/1380;Z=1.22-dep+.4998
    # Survey the visible turf apron in the authored tangent plate. The dark
    # green island, its fences and the far club must stay photographic.
    upper=np.interp(x,[0,130,310,860,968,1030,1120,1210,1279],[234,229,225,225,230,234,239,253,267]);cov=np.clip((y-upper)*.78+.5,0,1).astype(F)
    island=np.zeros((h,w),'B');pts=[(-2,252),(114,248),(230,245),(790,245),(862,246),(919,251),(957,257),(980,265),(994,275),(995,288),(986,302),(968,313),(947,324),(917,333),(879,340),(830,343),(-2,343)];cv.fillPoly(island,[np.int32(pts)],255,cv.LINE_AA);cov*=1-island/255
    r,gr,b=src.transpose(2,0,1);lum=src@[.29,.57,.14];# Keep pale rail paint only in the actual fence corridors, not every pale pebble.
    front=np.interp(x,[842,920,1005,1100,1190,1279],[557,554,546,533,520,501]);fence=((x>837)&(y>front-7)&(y<front+58))|((x<1012)&(y<344));pale=np.clip((lum-152)/34,0,1);cov*=1-pale*fence
    # Trace the foreground fence as a separate occluder. Its shadowed ivory
    # uprights are close in luminance to gravel; a brightness key loses them.
    px=np.array([842,890,948,998,1060,1130,1190,1250,1279]);top=np.array([554,555,553,549,542,531,519,506,499]);hi=np.interp(x,px,top);oc=np.clip(np.minimum(y-hi,hi+12-y)+.5,0,1)*np.clip(x-841,0,1)
    for cx,base,dx in [(846,609,-1),(917,607,-2),(991,602,-2),(1063,595,-3),(1131,585,-4),(1191,574,-6),(1248,561,-6)]:
        a=np.interp(cx,px,top)+8;mid=cx+dx*np.clip((y-a)/(base-a),0,1);post=np.clip(3.9-np.abs(x-mid),0,1)*np.clip(np.minimum(y-a,base-y)+.5,0,1);oc=np.maximum(oc,post)
    cov*=1-oc;cov*=np.where(y<345,np.clip((r-gr+10)/14,0,1),1)
    if return_mask:return src,cov
    base=surface(tex,X,Z,mip=.62);d=np.clip((y-210)/475,0,1);# Match illumination and hide the high-frequency gravel rather than merely tinting it green.
    light=(.86+.18*d)*np.clip(.85+.15*cv.GaussianBlur(lum,(0,0),19)/119,.85,1.13);base*=light[:,:,None];out=np.uint8(np.clip(src+(base-src)*cov[:,:,None],0,255));Image.fromarray(out).save(root/'assets/turf-wire.webp',quality=93,method=5)

if __name__=='__main__':
    import argparse
    ap=argparse.ArgumentParser();ap.add_argument('--lens-only',action='store_true');o=ap.parse_args()
    if not o.lens_only:side()
    judges()
