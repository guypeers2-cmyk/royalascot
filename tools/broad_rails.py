"""Two depth-ordered fence masks and an undistorted infield for Broad Turf.
Cream enamel rail with underside, steel joining collars and bolted footpads.
Use the very same sampled rail centrelines and 80 post stations as the orbit.
"""
import numpy as np,cv2 as cv
from PIL import Image,ImageDraw,ImageFont
from pathlib import Path

def gardens(root,plate,k):
    master=Image.open(root/'art-src/side-station-master.jpg').convert('RGB');sk=master.width/1150
    # Author-drawn foliage silhouettes, in local 4x survey coordinates. Do
    # not stretch a tree with the ground-plane optical warp.
    beds=[((305,301,455,362),[(73,204),(75,181),(111,168),(94,152),(89,112),(98,84),(115,65),(143,59),(172,65),(191,87),(199,110),(224,104),(250,110),(260,115),(260,86),(266,64),(287,44),(307,42),(328,55),(341,75),(350,86),(348,112),(333,125),(349,140),(360,126),(380,117),(406,121),(426,111),(450,109),(473,117),(487,134),(486,157),(523,165),(543,177),(550,191),(538,201),(497,208),(377,208),(327,207),(233,215),(125,218),(82,213)],(309,349),.81),((695,295,840,365),[(60,212),(67,196),(107,183),(120,171),(149,165),(177,161),(213,171),(235,181),(232,158),(250,137),(271,130),(286,127),(308,137),(311,100),(321,72),(332,50),(347,36),(362,34),(375,46),(383,62),(391,91),(396,119),(405,111),(424,108),(447,115),(463,131),(472,156),(490,156),(511,165),(523,184),(519,199),(534,213),(537,226),(524,237),(478,242),(424,235),(337,227),(248,227),(164,234),(104,231),(68,222)],(827,345),.74)]
    for (x0,y0,x1,y1),pts,(cx,base),size in beds:
        box=tuple(int(round(i*sk)) for i in [x0,y0,x1,y1]);crop=master.crop(box).convert('RGBA');ah,aw=crop.height,crop.width;mask=np.zeros((ah,aw),'B');pt=np.float32(pts)*[aw/((x1-x0)*4),ah/((y1-y0)*4)];cv.fillPoly(mask,[np.int32(pt*16)],255,cv.LINE_AA,4);crop.putalpha(Image.fromarray(cv.GaussianBlur(mask,(3,3),.39)));out=crop.resize((round((x1-x0)*size*k),round((y1-y0)*size*k)),Image.Resampling.LANCZOS);plate.alpha_composite(out,(round(cx*k-out.width/2),round(base*k-out.height*.88)))

def finish(root,s,b,mapped,lock,c,k):
    h,w=s.shape[:2];j,i=np.mgrid[:h,:w];xx=i/k;yy=j/k;ra=np.asarray(c['rail'],dtype=float);ip=ra[:,0,:2];op=ra[:,1,:2];outer=op.copy();dx=np.gradient(op[:,0]);dz=ra[:,1,3];outer[:,1]-=np.clip(-dz/.10,0,1)*(9.3+2*np.cos(np.pi*np.clip((yy.min()+op[:,1]-302)/140,0,1)));outer[:,0]+=np.sign(op[:,0]-575)*2*np.clip((abs(op[:,0]-575)-455)/85,0,1);outer[:,1]+=np.clip(dz/.09,0,1)*1.5
    def polygon(r):
        m=np.zeros((h,w),'B');cv.fillPoly(m,[np.int32(np.rint(r*k*16))],255,cv.LINE_AA,4);return m.astype('f')/255
    whole=polygon(outer);isle=polygon(ip);blend=lambda a,b,alpha:a*(1-alpha[:,:,None])+b*alpha[:,:,None]
    rnd=np.random.default_rng(521);nap=cv.GaussianBlur(rnd.normal(0,1,(h,w)).astype('f'),(0,0),.57)
    side=np.clip((yy-293)/153,0,1);under=np.stack([50+8*side,81+14*side,55+1.5*side],2)+nap[:,:,None]*4
    surf=blend(under,b,mapped/255);inside=(.92+.08*np.cos((xx-520)/301)+.024*np.sin(xx*.030+yy*.036)+.024*nap)[:,:,None]*np.array([61.,97.,63.]);surf=blend(surf,inside,isle);pic=blend(s,surf,whole);base=Image.fromarray(np.uint8(np.clip(pic,0,255))).convert('RGBA');
    # Four transparent films, split at the turn extrema. The complete picture
    # is the stationary shot; only two films occlude moving horses at runtime.
    high=2;scale=k*high;dims=(w*high,h*high);px=lambda x:tuple(np.round(np.asarray(x)*scale).astype(int));blank=lambda:Image.new('RGBA',dims);layers=[[blank(),blank()] for _ in range(2)];
    for lane in range(2):
        pts=ra[:,lane];N=len(pts)-1
        for near in range(2):
            target=layers[lane][near];g=ImageDraw.Draw(target);proj=lambda t:pts[t,:2];f=lambda y:.56+.59*np.clip((y-298)/152,0,1);region=lambda v:int(v[3]>=0)==near
            def line(a,b,width,col):g.line((px(a),px(b)),fill=col,width=max(1,round(width*scale)))
            def el(x,y,rx,ry,col):g.ellipse([px((x-rx,y-ry)),px((x+rx,y+ry))],fill=col)
            for t in range(0,N,8):
                p=pts[t];x,y=p[:2];m=f(y);height=16.1*m
                if not region(p):continue
                # Low contact shoe and bolt, solid shaded vertical on each post.
                el(x+.6*m,y+.15*m,2*m,1.0*m,(69,77,56,255));el(x,y-.1*m,1.75*m,.78*m,(165,164,137,255));line((x+.42*m,y-.3*m),(x+.42*m,y-height),1.65*m,(120,123,99,255));line((x-.27*m,y-.4*m),(x-.27*m,y-height),1.05*m,(227,220,187,255))
            for height,width in [(9.5,1.35),(16.1,2.60)]:
                for t in range(N):
                    a,b=pts[t],pts[t+1];mid=(a+b)/2
                    if not region(mid):continue
                    m=f(mid[1]);p0=a[:2]-[0,f(a[1])*height];p1=b[:2]-[0,f(b[1])*height];line(p0+[0,.65*m],p1+[0,.65*m],width*m+.4*m,(122,125,97,255));line(p0,p1,width*m,(228,222,193,255));line(p0-[0,width*.31*m],p1-[0,width*.31*m],.60*m,(248,241,213,255))
                for t in range(0,N,40):
                    p=pts[t];x,y=p[:2];m=f(y);z=y-height*m
                    if not region(p):continue
                    # Nickel ferrule and its pinpoint rivet.
                    line((x-1.5*m,z),(x+1.5*m,z),width*m+.7*m,(166,165,135,255));el(x,z-.22*m,.43*m,.44*m,(244,233,203,255))
            layers[lane][near]=target.resize((w,h),Image.Resampling.LANCZOS)
    base.alpha_composite(layers[1][0]);base.alpha_composite(layers[0][0]);gardens(root,base,k);base.alpha_composite(layers[0][1]);base.alpha_composite(layers[1][1]);static=Image.fromarray(np.uint8(s)).convert('RGBA');base.paste(static,(0,0),Image.fromarray(lock));near=np.maximum(np.array(layers[1][1].getchannel('A')),lock);far=np.array(layers[0][0].getchannel('A'));return base.convert('RGB'),[near,far]

def wire_fence(root,c,exposure):
    """A separate calibrated film for the rail between the judges and lane 6.
    Paint it *after* all six figures, including on saved v4 exposures. Contact
    shadows are part of the ground plate and lie behind the runners instead.
    """
    W,H=exposure.size;k=W/1280;hi=2;S=k*hi;size=(W*hi,H*hi);steel=Image.new('RGBA',size);shadow=Image.new('L',size);g=ImageDraw.Draw(steel);h=ImageDraw.Draw(shadow);pts=np.float64(c['rail'])[:,1,2:];a=np.arctan2(.54-.088,1.22);co,si=np.cos(a),np.sin(a)
    def pr(p,y=0):
        x,z=p;d=(1.22-z+c['R'])*co+(.54-y)*si;k=1380/d;return np.array([844+(x-c['L'])*k,360+k*((.54-y)*co-(1.22-z+c['R'])*si)]),k
    pix=lambda p:tuple(np.rint(np.asarray(p)*S).astype(int))
    def line(p,q,r,col,pen=g):pen.line((pix(p),pix(q)),fill=col,width=max(1,round(r*S)))
    def ellipse(p,rx,ry,col):g.ellipse([pix(p-[rx,ry]),pix(p+[rx,ry])],fill=col)
    # Work in model space. Only the near fence can occlude this side of the wire.
    relevant=lambda p: p[1]>.2 and -100<pr(p)[0][0]<1400
    for i in range(0,len(pts)-1,8):
        p=pts[i];foot,z=pr(p)
        if not relevant(p):continue
        top,_=pr(p,.047);heel,_=pr(p,.002);boot=.0064*z;sh,_=pr(p+[.021,-.016]);line(foot,sh,boot*.9,93,h);ellipse(foot,boot,boot*.34,(91,97,77,255));ellipse(heel,boot,boot*.33,(170,174,147,255));ellipse(heel+[-boot*.61,0],.72,.44,(207,206,175,255));line(top,heel,.0064*z,(138,144,118,255));line(top-[.0013*z,0],heel-[.0013*z,0],.0028*z,(216,214,182,255));line(heel-[0,.006*z],heel-[0,.003*z],.0082*z,(143,150,126,255))
    for y,w in [(.030,.0054),(.047,.0071)]:
        for i in range(len(pts)-1):
            p,q=pts[i:i+2];mid=(p+q)/2
            if not relevant(mid):continue
            a,r=pr(p,y);b,_=pr(q,y);rad=w*r*.5
            aa,_=pr(p+[.014,-.018]);bb,_=pr(q+[.014,-.018]);line(aa,bb,rad*.96,74,h);line(a,b,2*rad,(149,149,120,255));line(a-[0,.21*rad],b-[0,.21*rad],1.5*rad,(211,209,175,255));line(a-[0,.57*rad],b-[0,.57*rad],.57*rad,(235,230,198,255))
        for i in range(0,len(pts)-1,40):
            p=pts[i];
            if not relevant(p):continue
            a,r=pr(p,y);u=(pts[i+1]-pts[i-1]) if i else (pts[1]-pts[-2]);u=u/np.linalg.norm(u);x,_=pr(p-.0067*u,y);z,_=pr(p+.0067*u,y);line(x,z,(w+.0014)*r,(144,150,124,255));line(x-[0,.22*w*r],z-[0,.22*w*r],.39*w*r,(204,208,179,255));ellipse(a,.85,.78,(238,234,201,255))
    from PIL import ImageFilter
    film=steel.resize(exposure.size,Image.Resampling.LANCZOS);film.save(root/'assets/wide-fence.webp',quality=94,method=5);shade=shadow.resize(exposure.size,Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(1.6*k));exposure.paste(Image.new('RGB',exposure.size,(40,54,37)),(0,0),shade);return exposure
