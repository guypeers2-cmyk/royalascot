"""Reframe the completed wide-bed photograph and its two occlusion mattes
as one. Keep the near player CRT, far wall display and eye exactly registered.
The new finish is a model-space timing stripe drawn live at the tangent.
Input is the output of prepare_side_plate.py, not this script's own output."""
from pathlib import Path
import numpy as np,cv2 as cv
from PIL import Image

def finish(root):
 A=root/'assets';pix=np.asarray(Image.open(A/'side-station.webp').convert('RGB')).copy();h,w=pix.shape[:2];k=w/1150
 # The original matching optical plate already contains the empty stools,
 # wall CRT, canopy and brass uprights. Never composite patrons onto it.
 yy,xx=np.mgrid[:h,:w].astype('f');y=yy/k;x=xx/k;u=(x-575)/575;edge=282+42*np.abs(u)**2.3
 # Remove the former midfield post and its painted stripe without painting
 # across the long parallel rail. Clone neighbouring ballast row for row.
 mask=(np.abs(x-575)<11)&(y>331)&(y<440);dark=np.clip((12-np.abs(x-575))/3,0,1)*mask;pix=np.uint8(pix*(1-dark[:,:,None])+np.roll(pix,int(23*k),axis=1)*dark[:,:,None]);
 ux=np.linspace(-1,1,2801);warped=ux+.34*ux*(1-ux**2);inv=np.interp(u,warped,ux).astype('f');amount=np.clip((y-edge+9)/14,0,1)*np.clip((449-y)/10,0,1);
 # Do not relocate the central nine-slice rim or front physical buttons.
 rim=np.clip((y-398)/23,0,1)*np.clip((240-np.abs(x-575))/37,0,1);amount*=1-rim;mx=(xx+k*575*(inv-u)*amount).astype('f');
 for f in ['side-station','side-rail','side-back-rail']:
  im=Image.open(A/(f+'.webp'));rgb=cv.remap(pix,mx,yy,cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE);out=Image.fromarray(rgb)
  if f!='side-station':out=out.convert('RGBA');out.putalpha(Image.fromarray(cv.remap(np.asarray(im.getchannel('A')),mx,yy,cv.INTER_LINEAR,borderMode=cv.BORDER_REPLICATE)))
  out.save(A/(f+'.webp'),quality=94,method=5)
if __name__=='__main__':finish(Path(__file__).resolve().parents[1])
