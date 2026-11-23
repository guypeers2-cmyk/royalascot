"""Register the black-and-brass private salon behind the existing cabinet, not over the track.
Source: a generated room (see CREDITS), optically sampled for the same seated
rays, the floor plate and the wire camera. Old exposures use the original film.
Usage: python tools/salon_room.py --stock /path/to/5f19578/assets [--master room.jpg] [--lounge]
Without --master the checked-in club-room.webp is the panoramic master.
"""
import argparse
from pathlib import Path
import numpy as np, cv2 as cv
from PIL import Image,ImageDraw,ImageFilter
cv.setNumThreads(1);ROOT=Path(__file__).resolve().parents[1];A=ROOT/'assets'
P=argparse.ArgumentParser(description=__doc__);P.add_argument('--stock',type=Path,required=True);P.add_argument('--master',type=Path);P.add_argument('--lounge',action='store_true',help='Develop the dim bar, banquettes, cocktail tables and v9 wire strip.');P.add_argument('--private',action='store_true',help='Print the enclosed drawing room, preserving all earlier wire strips.');args=P.parse_args();private=args.private
def load(p):return np.asarray(Image.open(p).convert('RGB'))
def save(n,img,q):Image.fromarray(img).save(A/n,'WEBP',quality=q,method=6);print(n,(A/n).stat().st_size)
def sample(img,x,y):return cv.remap(img,x.astype('f'),y.astype('f'),cv.INTER_LINEAR,borderMode=cv.BORDER_REPLICATE)
def mix(a,b,w):return np.uint8(np.clip(a*(1-w[:,:,None])+b*w[:,:,None],0,255))
if args.master:
    # Fold only the far rear of the environment. Both sides of the longitude
    # seam meet at the same point, with no jump in ceiling/carpet exposure.
    src=load(args.master);y,x=np.mgrid[:900,:1800];yaw=(x+.5)/1800*360-180;pitch=(y+.5)/900*180-90;u=1-abs((yaw/180+.5)%2-1);v=.52+pitch/75
    pano=sample(src,u*(src.shape[1]-1),np.clip(v,0,1)*(src.shape[0]-1));pano=mix(pano,np.full_like(pano,[24,22,20]),np.clip(-v,0,1)*.9);pano=mix(pano,np.full_like(pano,[37,34,32]),np.clip(v-1,0,1)*.85);save('club-room.webp',pano,72 if private else 70)
room=load(A/'club-room.webp');stock=args.stock
# The orbit floor meets the machine banks at the same carpet. Rectify a
# clean patch in the aisle, then match opposite edges for a seamless weave.
def carpet():
    xy=np.float32([[.477,.795],[.567,.795],[.596,.974],[.437,.974]])
    uv=np.column_stack((.25+.5*xy[:,0],.5+(xy[:,1]-.52)*75/180))*[room.shape[1]-1,room.shape[0]-1]
    corners=np.float32([[0,0],[127,0],[127,127],[0,127]])
    tile=cv.warpPerspective(room,cv.getPerspectiveTransform(uv.astype('f'),corners),(128,128),flags=cv.INTER_CUBIC);band=np.concatenate((tile,tile[:,::-1]),axis=1);return np.concatenate((band,band[::-1]),axis=0)
save('carpet.webp',carpet(),76)
W,H,F=1150,1150*768/1376,407
# Only replace the room through the opening: retain enamel marquee, chrome
# uprights, the live wall CRT and every lip of the nearby satellite stations.
def mask(size,base,polys):
    m=Image.new('L',size);d=ImageDraw.Draw(m);sx,sy=size[0]/base[0],size[1]/base[1]
    for val,pts in polys:d.polygon([(round(x*sx),round(y*sy)) for x,y in pts],fill=val)
    return np.asarray(m.filter(ImageFilter.GaussianBlur(.7))).astype('f')/255

def environment(X,Y,Z):
    # Camera looks down onto the racetrack. Project a level casino horizon
    # into those rays; vertical columns remain vertical in the floor photo.
    t=np.deg2rad(16);z=Z*np.cos(t)-Y*np.sin(t);y=Y*np.cos(t)+Z*np.sin(t)
    u=(np.arctan2(X,z)/(2*np.pi)+.5)%1;v=.5+np.arctan2(y,np.hypot(X,z))/np.pi
    far=sample(room,u*(room.shape[1]-1),v*(room.shape[0]-1));az=np.abs(np.rad2deg(np.arctan2(X,Z)));z=np.maximum(Z,.34*np.hypot(X,Z));px=516+365*X/z;py=288+365*Y/z
    # Inner glass is rectilinear. Treat the fitted reference as an interior
    # across the aisle, not giant stretched machines wrapping the far rail.
    srcU=.5+(px-516)/(970 if args.lounge else 735);srcV=(.14+(py-98)/204) if args.lounge else (.32+(py-98)/355);
    if private:srcU=.5+(px-516)/1100;srcV=.23+(py-98)/271
    lon=(.25+.5*srcU)%1;lat=.5+(srcV-.52)*75/180
    front=sample(room,lon*(room.shape[1]-1),np.clip(lat,0,1)*(room.shape[0]-1));return mix(far,front,np.clip((79-az)/19,0,1)*np.clip((1.15-srcV)/.18,0,1)*np.clip((srcV+.15)/.2,0,1))
side=load(stock/'side-station.webp');h,w=side.shape[:2];ys,xs=np.mgrid[:h,:w];X=((xs+.5)/w-.5)*W/F;Y=((ys+.5)/h-.5)*H/F
polys=[(255,[(-2,95),(106,101),(302,103),(409,104),(600,103),(835,102),(975,98),(1034,96),(1034,265),(1004,264),(973,260),(934,244),(883,234),(874,238),(871,258),(793,258),(785,234),(778,232),(732,232),(726,222),(716,215),(696,213),(659,214),(648,217),(643,223),(641,245),(563,244),(557,221),(548,215),(525,212),(493,214),(474,217),(469,224),(469,234),(451,243),(436,249),(382,253),(389,240),(389,223),(382,217),(360,214),(330,215),(313,219),(307,233),(251,233),(245,239),(243,249),(153,259),(155,237),(106,249),(65,259),(58,250),(0,268)]),(0,[(27,94),(53,94),(67,238),(51,277),(35,281),(44,234)]),(0,[(973,93),(1002,92),(983,235),(995,277),(978,276),(962,244)]),(0,[(105,98),(273,98),(281,177),(109,182)]),(0,[(178,180),(184,179),(187,234),(181,254),(176,254),(181,234)])]
alpha=mask((w,h),(1032,576),polys);bg=environment(X,Y,np.ones_like(X));side=mix(side,bg,alpha);# Local fibre contrast, restricted to felt so chrome, chairs and silks are not tinted.
col=cv.cvtColor(side,cv.COLOR_RGB2HSV);felt=((col[:,:,0]>28)&(col[:,:,0]<87)&(col[:,:,1]>42)&(ys>h*.435)&(ys<h*.762)).astype('f');felt=cv.GaussianBlur(felt,(0,0),1.1);detail=side.astype('f')-cv.GaussianBlur(side,(0,0),2.4).astype('f');lit=np.clip(side.astype('f')*[.92,1.075,.96]+detail*.55,0,255).astype('uint8');side=mix(side,lit,felt);
if args.lounge or private:
    # Lower the marquee and carriage lights, not the playable turf or the CRTs.
    dim=.17*np.clip((h*.43-ys)/(h*.07),0,1)*(1-alpha);side=mix(side,np.uint8(side.astype('f')*[.24,.20,.20]),dim)
save('side-station.webp',side,77);side=load(A/'side-station.webp')
# Extend the ROOM into a consistent cube. The side stations protrude beyond
# its image boundary when the player turns: preserve those two silhouettes.
for key,s,q in [('front',640,62),('left',584,66),('right',584,66),('up',384,60),('down',448,65)]:
    yy,xx=np.mgrid[:s,:s];u=((xx+.5)/s*2-1)*1.003;v=((yy+.5)/s*2-1)*1.003;o=np.ones_like(u)
    X,Y,Z={'front':(u,v,o),'left':(-o,v,u),'right':(o,v,-u),'up':(u,-o,v),'down':(u,o,-v)}[key];out=environment(X,Y,Z)
    if key in ['left','right']:
        pts=[(354,320),(396,288),(430,293),(432,266),(500,260),(500,445),(442,408),(416,380)];pts=pts if key=='left' else [(500-x,y) for x,y in pts];old=cv.resize(load(stock/('seat-'+key+'.webp')),(s,s));out=mix(out,old,mask((s,s),(500,500),[(255,pts)]))
    # The instrument itself is drawn ONCE on the live registered seat-film,
    # not duplicated into every cube face. Only the surrounding room is static.
    save('seat-'+key+'.webp',out,q)
# A separate upper strip for v8. The v7 wire-casino, v6 wire-gallery and all older
# complete plates remain byte-for-byte intact for archived results.
wire=load(stock/'wire-gallery.webp');h,w=wire.shape[:2];y,x=np.mgrid[:h,:w];wall=sample(side,(.453+.512*x/w)*side.shape[1],(.165+.331*y/h)*side.shape[0]);wiremask=mask((w,h),(900,187),[(255,[(0,29),(170,32),(437,32),(698,30),(900,27),(900,159),(840,143),(801,139),(730,134),(633,132),(623,145),(515,146),(513,131),(505,127),(415,126),(403,120),(382,116),(301,114),(275,119),(269,133),(269,145),(130,145),(126,130),(119,120),(93,113),(7,111),(0,114)]),(0,[(851,19),(894,18),(873,124),(855,157),(833,157),(848,118)])]);save('wire-private.webp' if private else 'wire-lounge.webp' if args.lounge else 'wire-salon.webp',mix(wire,cv.GaussianBlur(wall,(0,0),.9),wiremask),81)
