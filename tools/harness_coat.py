"""Carve the saddle rider out of the original photographic casting. Restore
an uninterrupted back and barrel before meshing; the harness/driver are 3-D.
Run with an optional path to the original runner-master.png in a sparse tree.
"""
from pathlib import Path
import math,sys,cv2,numpy as np
from PIL import Image
from scipy.interpolate import PchipInterpolator
from scipy.ndimage import gaussian_filter,distance_transform_edt
from scipy.spatial import Delaunay
from mould_pack import write_mould
root=Path(__file__).resolve().parents[1];src=Path(sys.argv[1]) if len(sys.argv)>1 else root/'art-src/runner-master.png';W,H=1150,642
im=np.array(Image.open(src).convert('RGB').resize((W,H),Image.Resampling.LANCZOS));y,x=np.mgrid[:H,:W];r,g,b=im.astype('f').transpose(2,0,1);ex=np.minimum(r,b)-g;mask=(~((ex>45)&(b>r*.66))).astype('B');mask[y<35]=0;mask[(y>565)&~(((x>516)&(x<564)&(y<586))|((x>823)&(x<877)&(y<584)))]=0;mask[(x>605)&(x<632)&(y>381)&(y<425)]=0
for yy in range(567,586):
 a,b=np.interp(yy,[567,575,580,585],[521,522,525,532]),np.interp(yy,[567,575,580,585],[552,557,555,547]);c,d=np.interp(yy,[567,575,580,585],[834,835,840,848]),np.interp(yy,[567,575,580,585],[867,871,869,861]);mask[yy]*=((x[yy]>=a)&(x[yy]<=b))|((x[yy]>=c)&(x[yy]<=d))
# Pin the contour sampling of the four legs to the original plate. Changing
# the head/top of a contour must not move a single heel or toe pixel.
n,lab,st,_=cv2.connectedComponentsWithStats(mask);original=(lab==1+np.argmax(st[1:,cv2.CC_STAT_AREA])).astype('B')
pts=np.array([[475,195],[497,198],[519,201],[552,203],[583,203],[615,199],[643,193],[668,183],[691,165],[710,143],[733,119],[752,103],[769,92]]);line=PchipInterpolator(pts[:,0],pts[:,1])(np.clip(x,475,769));mask[(x>=493)&(x<=755)&(y<line)]=0;mask[(x>513)&(x<707)&(y>=line)&(y<239)]=1
n,lb,st,ce=cv2.connectedComponentsWithStats(mask);mask=(lb==1+np.argmax(st[1:,cv2.CC_STAT_AREA])).astype('B');core=(mask>0)&(ex<18);ind=distance_transform_edt(~core,return_distances=False,return_indices=True);pix=im.copy();pix[(mask>0)&~core]=im[ind[0],ind[1]][(mask>0)&~core]
# Rebuild the obscured ribcage with untouched coat grain sampled on haunch,
# then shade across ribs and shoulder. Preserve the original neck, head, legs.
u=np.clip((x-480)/205,0,1);depth=np.clip((y-line)/(361-line),0,1);px=397+55*u+7*np.sin(depth*4.8);py=215+depth*86+10*u;ref=cv2.remap(pix,px.astype('f'),py.astype('f'),cv2.INTER_CUBIC).astype('f');low=gaussian_filter(ref,(6,6,0));grain=(ref-low)*.66;shade=(.82+.18*np.sin(np.pi*(depth+.04))-.45*depth**3+.12*np.cos(np.pi*u))*np.clip(1+.06*np.sin(5*u+3*depth),.86,1.16);coat=np.clip((low*.43+np.array([117,61,40])*.57)*shade[...,None]+grain,0,255)
left=np.interp(y[:,0],[160,208,300,345,378],[501,506,493,558,579]);right=np.interp(y[:,0],[110,170,205,305,351,372],[737,731,707,681,642,638]);alpha=np.clip((x-left[:,None]+7)/13,0,1)*np.clip((right[:,None]+10-x)/15,0,1);pix=np.uint8(pix*(1-alpha[:,:,None])+coat*alpha[:,:,None]);# clear the former short horizontal reins on the neck
rein=np.zeros((H,W),'B');cv2.polylines(rein,[np.int32([[700,184],[749,187],[814,193],[866,199],[904,203]])],False,255,10);pix=cv2.inpaint(pix,rein,6,cv2.INPAINT_TELEA)
box=(145,41,966,590);ind=distance_transform_edt(mask==0,return_distances=False,return_indices=True);pix=pix[ind[0],ind[1]];tone=pix.astype('f')/255;lum=np.sum(tone*np.array([.30,.54,.16]),axis=2);hsv=cv2.cvtColor(pix,cv2.COLOR_RGB2HSV);bridle=((x>789)&(y<214)&(hsv[:,:,1]<86));cm=gaussian_filter((~bridle).astype(float),1.)[:,:,None];palette=[(1.06,1.03,.98),(.64,.71,.79),(1.25,1.0,.89),(1.26,1.23,1.16),(.94,.87,.80),(.83,.91,.89)]
for k,col in enumerate(palette):
 grade=(np.maximum(lum,.001)**(.60 if k==3 else .96))[:,:,None]*col if k in (1,3) else tone*col;img=np.uint8(np.clip(tone*(1-cm)+grade*cm,0,1)*255);Image.fromarray(img).crop(box).save(root/'assets'/f'cast-{k+1}.webp',quality=87,method=6)
points=[]
for source,upper in [(original,False),(mask,True)]:
 for cnt in cv2.findContours(source,cv2.RETR_LIST,cv2.CHAIN_APPROX_NONE)[0]:
  if cv2.contourArea(cnt)<6:continue
  for xx,yy in cnt[::4,0,:]:
   changed= (486<=xx<=761 and yy<247)
   if changed==upper and mask[yy,xx]:points.append([xx,yy])
for yy in range(48,587,6):
 for xx in range(149+(yy//6%2)*3,961,6):
  if mask[yy,xx]:points.append([xx,yy])
def triangulate(points,mask):
 pts=np.unique(np.int32(points),axis=0);tris=Delaunay(pts).simplices;good=[]
 for tri in tris:
  a,b,c=pts[tri];V=np.int32(np.rint([(a+b+c)/3,(a+b)/2,(b+c)/2,(a+c)/2,(2*a+b+c)/4,(a+2*b+c)/4,(a+b+2*c)/4]));
  if np.all(mask[V[:,1],V[:,0]]):good.append(tri)
 return pts,np.int32(good)
# Changing the upper outline can break QHull ties on the same four distant
# pixels. Preserve the untouched master triangles below the ribcage instead
# of letting the new back reorder a toe, rim normal or contour on a foreleg.
oldpts=[]
for ct in cv2.findContours(original,cv2.RETR_LIST,cv2.CHAIN_APPROX_NONE)[0]:
 if cv2.contourArea(ct)>=6:oldpts.extend(ct[::4,0,:].tolist())
for yy in range(48,587,6):
 for xx in range(149+(yy//6%2)*3,961,6):
  if original[yy,xx]:oldpts.append([xx,yy])
org,prior=triangulate(oldpts,original);pts,new=triangulate(points,mask);lookup={tuple(pt):i for i,pt in enumerate(pts)}
level=324;past=prior[np.min(org[prior,1],axis=1)>=level];good=new[np.min(pts[new,1],axis=1)<level].tolist()+[[lookup[tuple(org[i])] for i in tri] for tri in past]
tri=np.array(good);used=np.unique(tri);remap=np.full(len(pts),-1);remap[used]=np.arange(len(used));tri=remap[tri];pts=pts[used];N=len(pts);X,Y=pts.T;dist=cv2.distanceTransform(mask,cv2.DIST_L2,5)[Y,X];
gauss=lambda xx,yy,rx,ry:np.exp(-(((X-xx)/rx)**4+((Y-yy)/ry)**4));radius=6+53*gauss(544,274,189,115)+23*gauss(760,215,80,105)+18*gauss(872,149,86,76)+18*gauss(613,135,80,65)+15*gauss(694,78,46,38)+16*gauss(543,174,65,40);z=radius*np.sqrt(1-(1-np.clip((dist-.5)/radius,0,1))**2);leg=np.clip((Y-311)/140,0,1);rear=X<605;# Splines follow the AIR GAP between legs, not straight lines through knees
# or fetlocks. At a merged shoulder blend depth and phase over the root.
rearSplit=np.interp(Y,[312,373,380,405,451,503,586],[419,420,419,395,378,371,370]);foreSplit=np.interp(Y,[340,380,408,420,440,465,490,510,531,586],[710,752,779,792,811,824,839,850,865,926]);split=np.where(rear,rearSplit,foreSplit);blend=np.where(rear,np.clip((380-Y)*.46+4,4,20),np.clip((409-Y)*.44+4,4,22));far=np.clip(.5+(split-X)/(2*blend),0,1);far=far*far*(3-2*far);zc=leg*(30-59*far)
xx=(X-568)/930;yy=(586-Y)/930+.019;pos=np.r_[np.stack([xx,yy,(zc+z)/930],-1),np.stack([xx,yy,(zc-z)/930],-1)];U=(X-box[0])/(box[2]-box[0]);V=1-(Y-box[1])/(box[3]-box[1]);uv=np.r_[np.stack([U,V],1),np.stack([U,V],1)]
# Normals on the front surface point toward the side camera (+Z).
tri=tri[:,::-1];idx=list(map(list,tri))+list(map(list,tri[:,::-1]+N));edges={}
for t in tri:
 for a,b in [(t[0],t[1]),(t[1],t[2]),(t[2],t[0])]:
  k=tuple(sorted((a,b)));edges[k]=None if k in edges else (a,b)
# Keep separate rim normals on the two flanks of the same rider-free coat.
perimeter=np.unique([u for pair in edges.values() if pair is not None for u in pair]);shift={u:2*N+i for i,u in enumerate(perimeter)};pos=np.concatenate([pos,pos[N+perimeter]]);uv=np.concatenate([uv,uv[perimeter]]);
for v in edges.values():
 if v is not None:
  a,b=v;idx.extend([[a,shift[b],b],[a,shift[a],shift[b]]])
idx=np.array(idx,dtype='<u2');
# Store the four leg motion weights and a per-vertex phase as compact bytes.
weights=np.clip((Y-np.where(rear,312,340))/255,0,1)**1.18;phase=np.where(rear,0,math.pi)+1.72*far;weights=np.r_[weights,weights,weights[perimeter]];phase=np.r_[phase,phase,phase[perimeter]];
write_mould(root,np.int16(np.rint(pos*25000)),np.uint16(np.clip(np.rint(uv*65535),0,65535)),idx,
            np.uint8(weights*255),np.uint8(phase/6.283185*255),N,len(tri))
print('Harness mould',len(pos),'vertices',len(idx),'triangles')
