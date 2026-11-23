"""Twelve registration-matched head-on poses per silk, with a stationary
spindle and sled. The turntable atlas takes over away from the face-on lens."""
from pathlib import Path
import cv2 as cv,numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt
root=Path(__file__).resolve().parents[1];a=np.array(Image.open(root/'art-src/head-on-carrier.jpg').convert('RGB'));r,g,b=a.transpose(2,0,1).astype(float);mask=~((np.minimum(r,b)-g>38)&(b>r*.52));_,l,st,_=cv.connectedComponentsWithStats(mask.astype('B'));label=1+np.argmax(st[1:,cv.CC_STAT_AREA]);yy,xx=np.nonzero(l==label);xs=slice(xx.min()-3,xx.max()+4);ys=slice(yy.min()-3,yy.max()+4);a=a[ys,xs].copy();mask=(l[ys,xs]==label);h,w=mask.shape;y,x=np.mgrid[0:h,0:w];u=x/w;v=y/h;r,g,b=a.transpose(2,0,1).astype(float);fringe=(np.minimum(r,b)-g>16)&(b>r*.65);idx=distance_transform_edt(~(mask&~fringe),return_distances=False,return_indices=True);a[fringe]=a[idx[0],idx[1]][fringe];hsv=cv.cvtColor(a,cv.COLOR_RGB2HSV);hu,sa,val=hsv.transpose(2,0,1);silk=(hu>91)&(hu<139)&(sa>42)&(v<.48)&mask;coat=(v>.14)&(v<.918)&(hu<27)&(sa>40)&mask&~silk;alpha=mask.astype('B')*255
keys=np.array([[218,212,193],[48,48,51],[181,53,40],[49,94,154],[214,165,48],[49,117,75]])/255.;lum=np.sum(a*np.array([.30,.52,.18]),axis=-1)/255.;cw,ch=122,266;atlas=Image.new('RGBA',(cw*12,ch*6));smt=lambda a,b,t:np.clip((t-a)/(b-a),0,1)**2*(3-2*np.clip((t-a)/(b-a),0,1));lock=1-smt(.895,.94,v);leg=smt(.47,.75,v)*lock*(.35+.65*smt(.03,.12,abs(u-.5)));side=np.where(u>.49,1,-1)
for i,k in enumerate(keys):
 c=a/255.;paint=k[None,None,:]*np.clip((val.astype(float)/155)**.8,.23,1.24)[:,:,None]+(1-k[None,None,:])*np.clip((val.astype(float)-139)/116,0,1)[:,:,None]*.56;c=np.where(silk[:,:,None],paint,c)
 if i in (1,3):
  z=lum**(.59 if i==3 else .96);pig=z[:,:,None]*(np.array([1.38,1.36,1.31]) if i==3 else np.array([.72,.70,.68]));c=np.where(coat[:,:,None],pig,c)
 elif i in (2,4,5):c=np.where(coat[:,:,None],c*np.array({2:[1.14,.94,.90],4:[.97,.99,.89],5:[.8,.84,.81]}[i]),c)
 rgba=np.dstack((np.uint8(np.clip(c,0,1)*255),alpha))
 for j in range(12):
  t=j*2*np.pi/12;wave=np.sin(t+(side+1)*1.37);xy=x-lock*(.011*w*np.sin(t)*smt(.47,.05,v) + .041*w*leg*wave);y2=y+lock*((.008*h*np.sin(2*t-.4)+.007*h*np.sin(t))*(1-smt(.48,.76,v)))+.065*h*leg*np.maximum(0,wave);frm=cv.remap(rgba,xy.astype('f'),y2.astype('f'),cv.INTER_LINEAR,borderMode=cv.BORDER_CONSTANT);im=Image.fromarray(frm);im.thumbnail((cw-4,ch-7),Image.Resampling.LANCZOS);atlas.paste(im,(j*cw+(cw-im.width)//2,i*ch+ch-im.height-2));
atlas.save(root/'assets/front-cast.webp',quality=91,method=6);print('Front cast:',w,h,atlas.size)
