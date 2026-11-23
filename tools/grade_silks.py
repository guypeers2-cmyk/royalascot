"""One illumination master, five silk grades. Run ONCE after pack_cast has
printed the full RGB turntables. Invert the Canvas hard-light operator, then
store a slightly smaller transfer layer, not the same barrel, hooves, lights
and rider over and over. The high-definition flanks stay independent.
"""
from PIL import Image
from pathlib import Path
import numpy as np
A=Path(__file__).resolve().parents[1]/'assets';base=np.asarray(Image.open(A/'runner-1.webp').convert('RGBA'));h,w=base.shape[:2]
for n in range(2,7):
    p=A/f'runner-{n}.webp';im=np.asarray(Image.open(p).convert('RGB'));assert im.shape[:2]==(h,w),'Input must be a full RGB turntable, not an already packed grade';out=np.empty_like(im);before=p.stat().st_size
    for y in range(0,h,140):
        sl=slice(y,y+140);t=im[sl].astype('f')/255;b=base[sl,:,:3].astype('f')/255;a=base[sl,:,3:4].astype('f')/255;b=(128/255)*(1-a)+b*a
        grade=.5*np.where(t<=b,t/np.maximum(b,.001),2-(1-t)/np.maximum(1-b,.001));out[sl]=np.clip(np.where(a>.05,grade*255,128),0,255)
    Image.fromarray(out).resize((w//2,h//2),Image.Resampling.LANCZOS).save(p,'WEBP',quality=62,method=6);print(p.name,before,'→',p.stat().st_size)
