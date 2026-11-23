"""Print two densities of the actual studio cast, preserving the alpha silhouette."""
from pathlib import Path
from PIL import Image,ImageFilter
import io,sys
root=Path(__file__).resolve().parents[1];n=int(sys.argv[1]);im=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert('RGBA');bbox=im.getbbox();assert min(bbox[0],bbox[1],im.width-bbox[2],im.height-bbox[3])>=8,'Keep the helmet, tail and the whole sled in the negative';im=im.crop((max(0,bbox[0]-9),max(0,bbox[1]-7),min(im.width,bbox[2]+9),min(im.height,bbox[3]+7)))
for name,size,quality in [('profile',(625,390),91),('card',(310,195),87)]:
 out=im.copy();out.thumbnail(size,Image.Resampling.LANCZOS);out.save(root/'assets'/f'{name}-{n}.webp',quality=quality,method=5)
