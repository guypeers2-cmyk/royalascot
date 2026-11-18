from PIL import Image,ImageDraw,ImageFilter
import cv2,numpy as np
from pathlib import Path
root=Path(__file__).resolve().parents[1];q=root/'art-src';out=root/'assets';im=Image.open(q/'side-station-master.jpg').convert('RGB');w,h=im.size;s=w/1150.;im.save(out/'side-station.webp',quality=96,method=5);pix=np.asarray(im);R,G,B=[pix[:,:,i].astype(float) for i in range(3)];
# Stationary foreground occlusion: use actual photographed rail paint and posts,
# not a vector rail guessed over the race. Capture the terminal rim, too.
mask=Image.new('L',(w,h));d=ImageDraw.Draw(mask);arr=lambda pts:[(int(x*s),int(y*s))for x,y in pts];poly=[(24,373),(34,377),(40,389),(74,402),(118,412),(162,417),(989,417),(1035,411),(1097,397),(1117,382),(1120,371),(1130,373),(1134,399),(1121,419),(1070,438),(979,450),(165,450),(77,440),(26,420),(15,402)];d.polygon(arr(poly),fill=255)
sel=np.clip((R-108)/50,0,1)*np.clip((G-90)/47,0,1)*np.clip((B-42)/42,0,1);alpha=np.uint8(np.asarray(mask)*sel);extra=Image.new('L',(w,h));d=ImageDraw.Draw(extra);d.polygon(arr([(457,640),(455,463),(464,434),(473,429),(677,429),(684,434),(697,480),(750,641)]),fill=255);# exact upper rim: using the same plate means it cannot cover the near rail behind the console
alpha=np.maximum(alpha,np.asarray(extra));near=im.convert('RGBA');near.putalpha(Image.fromarray(alpha));near.save(out/'side-rail.webp',quality=96,method=5)
# The inner fence on the opposite straight is in front of the distant horses.
m=Image.new('L',(w,h));d=ImageDraw.Draw(m);d.polygon(arr([(152,351),(192,330),(254,313),(335,304),(810,303),(891,311),(955,329),(992,348),(989,359),(940,338),(883,323),(813,320),(330,321),(260,328),(201,345),(158,365)]),fill=255);aa=np.uint8(np.array(m)*sel);far=im.convert('RGBA');far.putalpha(Image.fromarray(aa));far.save(out/'side-back-rail.webp',quality=94,method=5)
