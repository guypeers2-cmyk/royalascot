"""Register the original photographic straight to today's wider head-on lens.
The ground line and the two straight boundaries follow the new projection. The
unoccupied room above the bend and gravel below the stalls fill the overscan;
no old starting doors, horses, or second inner rail are baked into the shot.
"""
from pathlib import Path
import json, subprocess
import numpy as np
import cv2 as cv
from PIL import Image
from scipy.interpolate import PchipInterpolator
root=Path(__file__).resolve().parents[1]
cam,oldB,newB=json.loads(subprocess.check_output(['node','-e',"const c=require('./js/course');console.log(JSON.stringify([require('./js/gate-feed').cam,c.referenceB,c.B]))"],cwd=root))
w,h=cam['w'],cam['h'];f0=h/2/np.tan(np.deg2rad(22.8)/2);f=h/2/np.tan(np.deg2rad(cam['fov'])/2);a=np.arctan2(cam['y']-cam['aim'],cam['x'])
raw=Image.open(root/'art-src/start-lane-master.jpg').convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
y,x=np.mgrid[0:h,0:w];mid=h/2
# Keep the exact focal transform across the stall, its approach and release.
y0=np.array([0.,205.,255.,340.,445.,490.,528.,550.,h-1]);y1=(y0-mid)*f0/f+mid;y1[[0,-1]]=[0,h-1];sy=PchipInterpolator(y0,y1)(y)
def span(y,lens,B):return B*(lens*np.sin(a)+(y-mid)*np.cos(a))/cam['y']
# At the bottom of the frame the near gravel fills the lens. Sample it from
# inside the old borders instead of stretching or duplicating fence posts.
ratio=np.ones_like(sy);near=y>520;ratio[near]=span(sy[near],f0,oldB)/span(y[near],f,newB);sx=w/2+(x-w/2)*ratio
out=cv.remap(np.asarray(raw),sx.astype('f'),sy.astype('f'),cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE)
Image.fromarray(out).save(root/'assets/gate-lane.webp','WEBP',quality=94,method=6)
