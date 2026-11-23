"""Print the v17 racing strip. Run in a FULL authoring tree; first argument is
an unmodified v16 assets directory. Preserve the private room, casing and CRT.
Previous judges' plates remain on disk, and are never saved over. No network.
"""
from pathlib import Path
import json, shutil, subprocess, sys
import numpy as np
import cv2 as cv
from PIL import Image
from scipy.interpolate import PchipInterpolator
import broad_turf as turf
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'assets';V=Path(sys.argv[1]).resolve();assert V!=A
# Use an isolated, complete workspace for this authoring pass, not a live
# production server. prepare_side_plate prints the sward and both occluders.
subprocess.run([sys.executable,str(ROOT/'tools/prepare_side_plate.py')],cwd=ROOT,check=True)
c=turf.spec(ROOT);new=Image.open(A/'side-station.webp').convert('RGB');w,h=new.size;k=w/1150
old=Image.open(V/'side-station.webp').convert('RGB').resize(new.size);mask=np.zeros((h,w),'B');edge=np.array(c['rail'])[:,1,:2];oldedge=edge.copy();oldedge[:,0]=575+(edge[:,0]-575)/c['sideField'];cv.fillPoly(mask,[np.int32(np.rint(oldedge*k))],255,cv.LINE_AA);cv.fillPoly(mask,[np.int32(np.rint(edge*k))],255,cv.LINE_AA);rad=round(k*10);mask=cv.dilate(mask,np.ones((2*rad+1,2*rad+1),'B'));mask=cv.GaussianBlur(mask,(0,0),1.3*k);side=Image.composite(new,old,Image.fromarray(mask));side.save(A/'side-station.webp',quality=80,method=6)
# Clip depth mattes from the selfsame finished shot, no ghost of the old curb.
for name in ('side-rail','side-back-rail'):
 f=A/(name+'.webp');alpha=Image.open(f).getchannel('A');out=side.convert('RGBA');out.putalpha(alpha);out.save(f,quality=88,method=5)
# Position the two rails on the judges' actual focal plane. Print a new live
# face, leaving all issued negatives and the broad-lens foreground untouched.
# Fill the gallery from the most recent unoccupied lounge. Its cutoff remains
# above the inner rail; feather the seam in the dark background, not the turf.
from prepare_turf import judges as narrow
from broad_rails import wire_fence
w,h=1440,810;k=w/1280;W,H=w,h;F=np.float32;yy,xx=np.mgrid[:h,:w].astype(F)/k
cam="const C=require('./js/course'),p=require('./js/finish-lens').project;console.log(JSON.stringify([-C.railB,C.railB].flatMap(z=>[p(0,.047,z).y,p(0,0,z).y])))"
a,b,d,e=json.loads(subprocess.check_output(['node','-e',cam],cwd=ROOT));sy=PchipInterpolator([0,178,211,242,a,b,445.5,d,e,861],[0,178,216,248,303.63,341.945,445.5,549.273,604.15,719],extrapolate=True)(yy).astype(F)
src=np.array(Image.open(V/'turf-wire.webp').convert('RGB'));out=cv.remap(src,xx,sy,cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE).astype(F)
_,m=narrow(ROOT,return_mask=True);m=cv.remap(m.astype(F),xx,sy,cv.INTER_LINEAR,borderMode=cv.BORDER_REPLICATE);v=(yy-360)/1380;angle=np.arctan2(.54-.088,1.22);co,si=np.cos(angle),np.sin(angle);dep=.54*(co-v*si)/np.maximum(.035,v*co+si);X=c['L']+(xx-844)*(dep*co+.54*si)/1380;Z=1.22-dep+c['R'];base=turf.dressed(np.array(Image.open(A/'course-cut.webp')),turf.texture(ROOT),X,Z,c,.64);base*=((.85+.18*np.clip((yy-210)/475,0,1))*(1-.09*np.clip(abs(xx-620)/840,0,1)**2))[:,:,None];rr=np.hypot(np.maximum(np.abs(X)-c['L'],0),Z);apron=np.clip((rr-c['R']-c['B']-.01)/.014,0,1);base*=1-.26*apron[:,:,None];m=np.maximum(m,np.clip((yy-453)/38,0,1));out+=(base-out)*m[:,:,None];
# The part beyond the far rail is the existing gallery, not a second race.
gallery=Image.open(V/'wide-wire.webp').convert('RGB');gallery.paste(Image.open(V/'wire-private.webp'),(0,0));ga=np.array(gallery.resize((w,h),Image.Resampling.LANCZOS));fade=np.clip((258-yy)/24,0,1)[:,:,None];out=out*(1-fade)+ga*fade;im=wire_fence(ROOT,c,Image.fromarray(np.uint8(np.clip(out,0,255))));im.save(A/'turn-wire.webp',quality=77,method=6);shutil.move(A/'wide-fence.webp',A/'turn-fence.webp');shutil.copyfile(V/'wide-fence.webp',A/'wide-fence.webp');print('Printed both live rails, six racing lines, course chart and judges’ shot.')
