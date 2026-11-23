"""Optical registration of the authored cabinet photograph to the wider oval.
Move the photographed infield and its fence, without moving the plinth,
outer rail or physical controls. Reuse the inverse map for the foreground
masks; independent estimates would produce doubled rails.
"""
from pathlib import Path
import json, subprocess
import numpy as np
import cv2 as cv
from scipy.interpolate import RBFInterpolator

def camera_map(shape):
    root=Path(__file__).resolve().parents[1]
    js="const C=require('./js/course');console.log(JSON.stringify(Array.from({length:224},(_,i)=>[C.plateReference(i/224,0),C.plateReference(i/224,1-C.formerFactor),C.plateReference(i/224,1)].map(p=>[p.x,p.y]))))"
    edges=np.array(json.loads(subprocess.check_output(['node','-e',js],cwd=root)))
    h,w=shape[:2];k=w/1150.; pts={}
    def add(a,b):pts[tuple(np.round(b,5))]=a
    center=np.array([575.,354.]);nc=center+np.array([0.,-6.]);add(center,nc)
    # Use nested, smooth planar rings. Multiple foot/head constraints at the
    # same bend overlap in a low-angle photograph and would fold its texture.
    for i,j,o in edges[::3]:
        def midrail(v):return v-[0,(9+11*np.clip((v[1]-303)/139,0,1))*.46]
        a=midrail(i);b=midrail(o);shift=j-i
        for frac in [.63,.88]:add(center+frac*(a-center),nc+frac*(a+shift-nc))
        for lane,weight in [(0,1),(.16,.94),(.62,.35),(.88,0),(1.,0),(1.15,0)]:
            pt=a+lane*(b-a);add(pt,pt+shift*weight)
    for x in np.linspace(-2,1152,37):
        for y in [-2.,245.,452.,h/k+2.]:add([x,y],[x,y])
    for y in np.linspace(245,452,10):
        for x in [-2.,1152.]:add([x,y],[x,y])
    dst=np.array(list(pts.keys()));src=np.array(list(pts.values()))
    # Solve a smooth inverse displacement rather than letting thin camera-space
    # triangles kink the long, painted rail. Vertical image foreshortening is
    # undone for the interpolator. No full-frame high-resolution spline solve.
    aspect=np.array([1.,3.]);warp=RBFInterpolator(dst*aspect,src-dst,smoothing=4.)
    yy,xx=np.mgrid[0:h,0:w];mx=xx.astype('f');my=yy.astype('f');top=int(245*k);bt=int(453*k)
    gy,gx=np.mgrid[top:bt:3,0:w:3];q=np.column_stack([gx.ravel(),gy.ravel()])/k
    delta=np.vstack([warp(chunk*aspect) for chunk in np.array_split(q,16)]).reshape(*gx.shape,2).astype('f')*k
    dy,dx=np.mgrid[0:bt-top,0:w].astype('f')/3;delta=cv.remap(delta,dx,dy,cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE)
    # Nothing outside the casing is moved, including the nearest CRT and
    # upper rail paint. Feather only inside the fixed fence line.
    orig=edges[:,0];o=edges[:,2];edge=.09*orig+.91*o;edge[:,1]-=np.clip((o[:,1]-315)/85,0,1)*21
    clip=np.zeros((h,w),np.uint8);cv.fillPoly(clip,[np.int32(edge*k)],255);alpha=np.clip(cv.distanceTransform(clip,cv.DIST_L2,3)/max(1,4*k),0,1)[top:bt]
    mx[top:bt]+=delta[:,:,0]*alpha;my[top:bt]+=delta[:,:,1]*alpha
    return mx,my

def remap(a,m):return cv.remap(np.asarray(a),*m,cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE)
