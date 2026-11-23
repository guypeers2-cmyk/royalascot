"""Develop the shared live trot matte and five illumination grades. Studio
only; keep the recorded flank/negative stocks intact. Input = bake_carriers.
"""
import sys
from pathlib import Path
from PIL import Image,ImageFilter
import numpy as np
src=Path(sys.argv[1]);dest=Path(__file__).resolve().parents[1]/'assets';L=Image.Resampling.LANCZOS

def grade(ref,im):
 w,h=im.size;out=np.empty((h,w,3),dtype='uint8')
 for y in range(0,h,140):
  rect=(0,y,w,min(y+140,h));q=np.array(ref.crop(rect),dtype='f')/255;a=q[:,:,3:4];b=q[:,:,:3]*a+(128/255)*(1-a);t=np.array(im.crop(rect).convert('RGB'),dtype='f')/255
  # Match the original shaded texels, not a flat tint on six identical horses.
  v=.5*np.where(t<=b,t/np.maximum(b,.001),2-(1-t)/np.maximum(1-b,.001));out[y:rect[3]]=np.uint8(np.clip(np.where(a>.05,v,.5)*255,0,255))
 return Image.fromarray(out)
def ink(im,size):
 # Keep edges, engraving and luminance in the master. The five pigment maps
 # only need low-frequency hue: suppressing subpixel grain here is lossless
 # for the shared silhouette and avoids storing the same paint texture twice.
 return im.resize(size,L).filter(ImageFilter.GaussianBlur(.62)).point([min(255,4*round(v/4)) for v in range(256)]*3)
from trot_stock import develop,write_maps
base=Image.open(src/'runner-1.webp').convert('RGBA');w,h=base.size;master=base.resize((1848,2520),L);master.putalpha(master.getchannel('A').point([round(v/17)*17 for v in range(256)]));standard=[master]
for n in range(2,7):standard.append(ink(grade(base,Image.open(src/f'runner-{n}.webp')),(616,840)))
stock,m1=develop('turn',standard)
for i,im in enumerate(stock):im.save(dest/f'runner-{i+1}.webp','WEBP',quality=73 if not i else 62,method=6)
del stock,standard,master,base
source=Image.open(src/'flanks.webp').convert('RGBA');cw,ch=308,245;w,h=6*cw,4*ch

def plate(n):
 im=Image.new('RGBA',(w,h));
 for i in range(24):
  x=(i%12)*cw;y=(n*2+i//12)*ch;im.paste(source.crop((x,y,x+cw,y+ch)),((i%6)*cw,(i//6)*ch))
 return im
base=plate(0);gw,gh=105*6,84*4;plates=[base]+[ink(grade(base,plate(i+1)),(gw,gh)) for i in range(5)];stock,m2=develop('hd',plates)
page=Image.new('RGBA',(w,h+3*gh),(128,128,128,255));page.paste(stock[0],(0,0))
for i in range(5):page.paste(stock[i+1],(i%2*gw,h+i//2*gh))
page.save(dest/'flank-trot.webp','WEBP',quality=78,method=6);write_maps({'turn':m1,'hd':m2});print('Live six-silk trot printed. Dated sensor stocks untouched.')
