from PIL import Image, ImageDraw, ImageFont, ImageFilter
import cv2,numpy as np,math,base64
from scipy.spatial import Delaunay
from scipy.ndimage import distance_transform_edt,gaussian_filter
from pathlib import Path
root=Path(__file__).resolve().parents[1];q=root/'art-src';out=root/'assets';W,H=1150,642
im=np.asarray(Image.open(q/'runner-master.png').convert('RGB').resize((W,H),Image.Resampling.LANCZOS)).copy();a=im.astype(float);r,g,b=a.transpose(2,0,1);y,x=np.mgrid[0:H,0:W]
ex=np.minimum(r,b)-g;bg=(ex>45)&(b>r*.66);mask=(~bg).astype('uint8');mask[y<35]=0;mask[(y>565)&~(((x>516)&(x<564)&(y<586))|((x>823)&(x<877)&(y<584)))]=0;mask[(x>605)&(x<632)&(y>381)&(y<425)]=0
# Keep the enclosed spaces between stirrups and legs transparent. Remove only loose green sled/shadow pixels.
n,lb,st,ce=cv2.connectedComponentsWithStats(mask);keep=1+np.argmax(st[1:,cv2.CC_STAT_AREA]);mask=(lb==keep).astype('uint8');
# Remove chroma fringing at the antialiased outline using the nearest uncontaminated pigment.
core=(mask>0)&(ex<19);idx=distance_transform_edt(~core,return_distances=False,return_indices=True);pix=np.where(((ex>15)&(mask>0))[...,None],im[idx[0],idx[1]],im).astype(np.uint8);a=pix.astype(float)/255.;R,G,B=a.transpose(2,0,1);hsv=cv2.cvtColor(pix,cv2.COLOR_RGB2HSV);hu,sa,va=hsv.transpose(2,0,1);silk=(hu>94)&(hu<137)&(sa>62)&(y<198)&(mask>0)
# A raised face and pale reins should not be recoloured with the coat.
main=((x<511)&(y>185))|((x>665)&(y>193))|((x>732)&(y>63))|((y>307)&(x>421));coat=main&(R>1.12*G)&(sa>66)&(hu<24)&(mask>0);coatmask=gaussian_filter(coat.astype(float),.5)
# The saddle panel is part of the painted figure, not a floating race badge.
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',51)
keys=[[213,207,184],[32,35,33],[178,51,38],[39,83,145],[211,163,47],[40,110,67]]
dye=[[1.06,1.10,1.04],[.53,.67,.77],[1.12,.96,.90],[1.84,2.28,2.35],[.94,.95,.88],[.77,.83,.84]]
box=(145,41,966,590);images=[]
for i in range(6):
 c=a.copy();v=va.astype(float)/255.;# Keep the moulded highlight, fold and boot detail.
 lum=np.dot(a,[.31,.50,.19]);highlight=np.clip((v-.42)/.5,0,1)**1.45
 kk=np.array(keys[i])/255.;paint=kk[None,None,:]*np.clip((v/.53)**.80,.21,1.18)[:,:,None]+(1-kk[None,None,:])*highlight[:,:,None]*.48
 if i!=3:c=np.where(silk[...,None],paint,c)
 other=np.clip(c*np.array(dye[i]),0,1)
 cm=coatmask
 if i in (1,3):
  horsepart=((x<509)&(y>182))|((x>664)&(y>191))|((x>734)&(y>58))|((y>307)&(x>400)); ivory=(R>.55)&(G>.435)&(B>.29)&(sa<133);cm=gaussian_filter((horsepart&~ivory&(mask>0)).astype(float),.8)
  l=np.clip((lum+.003)**(.72 if i==3 else .93),0,1);other=np.stack([l*1.29,l*1.26,l*1.20],-1) if i==3 else np.stack([l*.87,l*.83,l*.80],-1)
 c=c*(1-cm[...,None])+other*cm[...,None];# neutralize light chroma bounce from the product-photo matte
 under=(y>295)&(mask>0)&(R>G*1.33)&(B>G*.99);c[:,:,2]=np.where(under,np.minimum(c[:,:,2],c[:,:,1]*.93),c[:,:,2]);
 s=Image.fromarray(np.uint8(np.clip(c,0,1)*255)).convert('RGBA');s.putalpha(Image.fromarray(mask*255));
 fronts=[]
 for reverse in [False,True]:
  skin=s.copy();glyph=Image.new('RGBA',(56,65));d=ImageDraw.Draw(glyph);d.text((28,32),str(i+1),font=font,anchor='mm',fill=(27,26,22,255));
  if reverse:glyph=glyph.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
  glyph=glyph.rotate(-5.0,Image.Resampling.BICUBIC,expand=False);skin.alpha_composite(glyph,(519,218));fronts.append(skin.crop(box))
 full=Image.new('RGBA',(fronts[0].width*2,fronts[0].height));full.paste(fronts[0],(0,0));full.paste(fronts[1],(fronts[0].width,0));# Provide an opaque nearest-pigment gutter around the sculpt for watertight edge sampling.
 rgba=np.array(full);alpha=rgba[:,:,3]>200;ind=distance_transform_edt(~alpha,return_distances=False,return_indices=True);rgb=rgba[:,:,:3].copy();rgb[~alpha]=rgb[ind[0][~alpha],ind[1][~alpha]];Image.fromarray(rgb).save(out/f'cast-{i+1}.webp',quality=94,method=5);portrait=fronts[0].copy();portrait.thumbnail((310,195),Image.Resampling.LANCZOS);portrait.save(out/f'card-{i+1}.webp',quality=92,method=5);images.append(portrait)
# A watertight two-sided sculpt of the photographic mould. The broad flanks and narrow lower
# limbs carry distinct thicknesses; front and rear legs alternate across the depth axis.
cont,hi=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_NONE);points=[]
for cnt in cont:
 if cv2.contourArea(cnt)<6:continue
 ct=cnt[:,0,:];points.extend(ct[::4].tolist())
for yy in range(48,587,6):
 for xx in range(149+(yy//6%2)*3,961,6):
  if mask[yy,xx]:points.append([xx,yy])
pts=np.unique(np.array(points),axis=0);tris=Delaunay(pts).simplices;good=[]
for tri in tris:
 a,b,c=pts[tri];v=[(a+b+c)/3,(a+b)/2,(b+c)/2,(a+c)/2,(2*a+b+c)/4,(a+2*b+c)/4,(a+b+2*c)/4];V=np.int32(np.rint(v));
 if np.all(mask[V[:,1],V[:,0]]): good.append(tri)
tri=np.array(good);used=np.unique(tri);remap=np.full(len(pts),-1);remap[used]=np.arange(len(used));tri=remap[tri];pts=pts[used];N=len(pts);X,Y=pts.T;dist=cv2.distanceTransform(mask,cv2.DIST_L2,5)[Y,X];
gauss=lambda xx,yy,rx,ry:np.exp(-(((X-xx)/rx)**4+((Y-yy)/ry)**4));radius=6+53*gauss(544,274,189,115)+23*gauss(760,215,80,105)+18*gauss(872,149,86,76)+18*gauss(613,135,80,65)+15*gauss(694,78,46,38)+16*gauss(543,174,65,40);z=radius*np.sqrt(1-(1-np.clip((dist-.5)/radius,0,1))**2);leg=np.clip((Y-311)/140,0,1);rear=X<605;far=np.where(rear,X<405+(Y-350)*.22,X<720+(Y-361)*.66);zc=leg*np.where(far,-29,30)
xx=(X-568)/930;yy=(586-Y)/930+.019;pos=np.r_[np.stack([xx,yy,(zc+z)/930],-1),np.stack([xx,yy,(zc-z)/930],-1)];U=(X-box[0])/(box[2]-box[0]);V=1-(Y-box[1])/(box[3]-box[1]);uv=np.r_[np.stack([U*.5,V],1),np.stack([.5+U*.5,V],1)]
# Normals on the front surface point toward the side camera (+Z).
tri=tri[:,::-1];idx=list(map(list,tri))+list(map(list,tri[:,::-1]+N));edges={}
for t in tri:
 for a,b in [(t[0],t[1]),(t[1],t[2]),(t[2],t[0])]:
  k=tuple(sorted((a,b)));edges[k]=None if k in edges else (a,b)
# Duplicate boundary vertices so a rim triangle never interpolates from the first
# UV island all the way through the second photographic skin.
perimeter=np.unique([u for pair in edges.values() if pair is not None for u in pair]);shift={u:2*N+i for i,u in enumerate(perimeter)};pos=np.concatenate([pos,pos[N+perimeter]]);uv=np.concatenate([uv,uv[perimeter]]);
for v in edges.values():
 if v is not None:
  a,b=v;idx.extend([[a,shift[b],b],[a,shift[a],shift[b]]])
base64str=lambda a:base64.b64encode(np.ascontiguousarray(a).tobytes()).decode();idx=np.array(idx,dtype='<u2');
# Store the four leg motion weights and a per-vertex phase as compact bytes.
weights=np.clip((Y-np.where(rear,312,340))/255,0,1)**1.18;phase=np.where(rear,0,math.pi)+np.where(far,1.72,0);weights=np.r_[weights,weights,weights[perimeter]];phase=np.r_[phase,phase,phase[perimeter]];
js="/* Textured mechanical carrier derived from the new side-profile mould. Geometry, pigment and motion are shared by the photographic and orbit cameras. */\n"+"window.CarrierMeshData=function(){const b=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));return {pos:Float32Array.from(new Int16Array(b('"+base64str(np.int16(np.rint(pos*25000)))+"').buffer),v=>v/25000),uv:Float32Array.from(new Uint16Array(b('"+base64str(np.uint16(np.clip(np.rint(uv*65535),0,65535)))+"').buffer),v=>v/65535),idx:new Uint16Array(b('"+base64str(idx)+"').buffer),weights:Float32Array.from(b('"+base64str(np.uint8(weights*255))+"'),v=>v/255),phase:Float32Array.from(b('"+base64str(np.uint8(phase/6.283185*255))+"'),v=>v/255*6.283185)}};\n";(root/'js/mould.js').write_text(js)
print('mould',N*2,'vertices',len(idx),'triangles')
