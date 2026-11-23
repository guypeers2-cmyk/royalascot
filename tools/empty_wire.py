"""v6 judges' gallery: register the original EMPTY room to the upper strip
of the broad lens. Leave the v1–5 film stock, turf, wire and horses untouched.
The cut follows the far table edge; carry only the narrow rail paint through.
"""
from pathlib import Path
import cv2 as cv, numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def gallery(root=ROOT):
    plate=np.asarray(Image.open(root/'assets/wide-wire.webp').convert('RGB'))[:320];h,w=plate.shape[:2];assert w==1536
    room=np.asarray(Image.open(root/'art-src/side-station-master.jpg').convert('RGB'))
    # The common wall lamps, CRT bezels and chrome uprights supply six
    # stationary registration points. Lower the empty gallery to the surveyed lip.
    y,x=np.mgrid[:h,:w].astype('f');xs=[0,160,420,730,930,1075,1170,1295,1397,1472,1535]
    lip=np.interp(x,xs,[255,252,251,250,251,252,254,260,269,278,288]).astype('f');source=np.interp(x,xs,[278,276,274,273,273,278,289,308,327,339,351]).astype('f')
    Y=y+np.clip((y-65)/(lip-65),0,1)**1.4*(source-lip);inv=cv.invertAffineTransform(np.float32([[2.2165,.0098,-1441.88],[.00335,1.1173,-113.26]]));uv=lambda v:v[0]*x+v[1]*Y+v[2];wall=cv.remap(room,uv(inv[0]),uv(inv[1]),cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE)
    wall=cv.GaussianBlur(wall,(0,0),1.6).astype('f')*.96;old=plate.astype('f');mix=np.clip((lip+2-y)/3,0,1)
    # Preserve the isolated outer fence on the far bend, not the old
    # background between its bars. Levels here are those of actual rail paint.
    rail=np.interp(x,[1081,1120,1200,1280,1360,1440,1500,1535],[234,234,235,237,242,251,261,268]);corridor=(x>=1082)&(y>=rail-4)&(y<lip+4);r,g,b=old.transpose(2,0,1);ivory=np.clip((np.minimum(g,b*1.16)-119)/57,0,1);mix*=1-corridor*ivory
    out=Image.fromarray(np.uint8(np.clip(wall*mix[:,:,None]+old*(1-mix[:,:,None]),0,255)));out.save(root/'assets/wire-gallery.webp',quality=88,method=6)
if __name__=='__main__':gallery()
