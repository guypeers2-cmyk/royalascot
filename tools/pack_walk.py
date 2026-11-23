"""Studio only: pack one walk matte and five half-size pigment grades.
Input: RGBA sheet from the live rig on stdin. No old exposure is rewritten.
"""
import io, sys
from pathlib import Path
import numpy as np
from PIL import Image

im=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGBA')
w,h=im.width,im.height//6
assert (w,h)==(960,96)
master=np.array(im.crop((0,0,w,h)))
a=master[:,:,3:4].astype('f')/255
base=(master[:,:,:3].astype('f')/255)*a+(128/255)*(1-a)
master[:,:,3]=np.uint8(np.round(master[:,:,3]/17)*17)
ww,hh=w//2,h//2
page=Image.new('RGBA',(w,h+hh*3),(128,128,128,255))
page.paste(Image.fromarray(master),(0,0))
for i in range(5):
    t=np.array(im.crop((0,(i+1)*h,w,(i+2)*h)).convert('RGB'),dtype='f')/255
    grade=.5*np.where(t<=base,t/np.maximum(.001,base),2-(1-t)/np.maximum(.001,1-base))
    small=Image.fromarray(np.uint8(np.clip(np.where(a>.05,grade,.5)*255,0,255))).resize((ww,hh),Image.Resampling.LANCZOS)
    page.paste(small,(ww*(i%2),h+hh*(i//2)))
page.save(Path(__file__).resolve().parents[1]/'assets/loading-walk.webp','WEBP',quality=78,method=6)
