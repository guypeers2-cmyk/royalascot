"""Bake the stationary photographic surround. Only run while authoring art.
The race, horses, gate and live screens are NOT baked. Every face shares the
same optical centre as the registered front plate in js/scene.js.
"""
from pathlib import Path
import cv2 as cv, numpy as np
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / 'assets'
photo = cv.imread(str(assets/'side-station.webp'))
room = cv.imread(str(assets/'club-room.webp'))
surround = cv.imread(str(root/'art-src'/'seat-surround.jpg'))
W, H, F = 1150., 1150*768/1376, 407.
PW, PH = 1920, 1100

def sample(img,x,y,wrap=False):
    return cv.remap(img, x.astype('f'), y.astype('f'), cv.INTER_LINEAR, borderMode=cv.BORDER_WRAP if wrap else cv.BORDER_REPLICATE)

def front(x,y,z):
    den=np.maximum(.01,z); a=W/2+F*x/den; b=H/2+F*y/den
    edge=np.minimum(np.minimum(a,W-a),np.minimum(b,H-b)); alpha=np.clip(edge/10,0,1)*(z>0)
    return sample(photo, a/W*photo.shape[1]-.5,b/H*photo.shape[0]-.5),alpha

def bake_faces():
    y,x=np.mgrid[0:PH,0:PW]; az=np.deg2rad(-102+(x+.5)/PW*204); el=np.deg2rad(-57+(y+.5)/PH*117)
    cen,mask=front(np.sin(az)*np.cos(el),np.sin(el),np.cos(az)*np.cos(el))
    # The extended artwork preserves the centre composition. Register it to
    # its guide by central cabinet features, not the invented side scenery.
    ext=cv.resize(surround,(PW,PH),interpolation=cv.INTER_CUBIC)
    sift=cv.SIFT_create(nfeatures=3200); ka,da=sift.detectAndCompute(ext,None);kb,db=sift.detectAndCompute(cen,(mask>.98).astype('B')*255)
    ms=[a for a,b in cv.BFMatcher().knnMatch(da,db,k=2) if a.distance<.73*b.distance];cv.setRNGSeed(7)
    if len(ms)>=15:
        M,ok=cv.estimateAffine2D(np.float32([ka[m.queryIdx].pt for m in ms]),np.float32([kb[m.trainIdx].pt for m in ms]),method=cv.RANSAC,ransacReprojThreshold=4)
        if M is not None and ok.sum()>=15 and abs(np.linalg.det(M[:,:2])-1)<.2:
            ext=cv.warpAffine(ext,M,(PW,PH),flags=cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE)
    for side,s in [('front',1280),('left',960),('right',960),('up',512),('down',512)]:
        yy,xx=np.mgrid[0:s,0:s];u=((xx+.5)/s*2-1)*1.003;v=((yy+.5)/s*2-1)*1.003;one=np.ones_like(u)
        X,Y,Z={'front':(u,v,one),'right':(one,v,-u),'left':(-one,v,u),'up':(u,-one,v),'down':(u,one,-v)}[side]
        yaw=np.rad2deg(np.arctan2(X,Z));tilt=np.rad2deg(np.arctan2(Y,np.hypot(X,Z)));px=(yaw+102)/204*PW-.5;py=(tilt+57)/117*PH-.5
        margin=np.minimum(np.minimum(px,PW-1-px),np.minimum(py,PH-1-py));w=np.clip(margin/34.,0,1)[:,:,None]
        far=sample(room,((yaw/360+.55)%1)*room.shape[1],(tilt/180+.5)*room.shape[0],True);base=sample(ext,px,py)*w+far*(1-w)
        centre,opacity=front(X,Y,Z);op=opacity[:,:,None];out=np.uint8(np.clip(centre*op+base*(1-op),0,255));f=assets/('seat-'+side+'.webp');Image.fromarray(out[:,:,::-1]).save(f,'WEBP',quality=88,method=6);print(f.name,s,f.stat().st_size)
if __name__=='__main__':bake_faces()
