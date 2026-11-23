"""All six runners use the identical mould and motion. Store a shared matte
in cloth 1 instead of sending exactly the same edge pixels six times. Pad the
RGB colours under that matte to keep fringe-free interpolation on phone GPUs."""
from pathlib import Path
import numpy as np,cv2 as cv
from PIL import Image
import sys
assets=Path(__file__).resolve().parents[1]/'assets'
for filename in sys.argv[1:]:
    path=assets/filename;src=np.asarray(Image.open(path).convert('RGBA')).copy();before=path.stat().st_size
    a=src[:,:,3];rgb=src[:,:,:3].copy();empty=a<9;rgb[empty]=cv.dilate(rgb,np.ones((5,5),'B'))[empty]
    ref=filename in ['runner-1.webp','cast-hd.webp'];step=17 if filename!='cast-hd.webp' else 8.2258
    img=Image.fromarray(np.dstack([rgb,np.uint8(np.clip(np.round(a/step)*step,0,255))])) if ref else Image.fromarray(rgb)
    img.save(path,'WEBP',quality=77 if filename=='cast-hd.webp' else 72,method=6);print(filename,before,'→',path.stat().st_size)
