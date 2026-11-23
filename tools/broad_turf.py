"""Author the Broad Turf optical surfaces from the fixed, surveyed cabinet.
One metre-space cut chart for rail, chair, plan, orbit and the judges' camera.
No per-frame noise, pasted stripes in screen space, or game RNG. v1–3 plates
are immutable. Called by prepare_side_plate/prepare_judges_plate.
"""
from pathlib import Path
import json,subprocess
import numpy as np,cv2 as cv
from PIL import Image,ImageDraw,ImageFont
from scipy.interpolate import RBFInterpolator,PchipInterpolator
from prepare_turf import fillmap
ROOT=Path(__file__).resolve().parents[1]; A=ROOT/'assets'; F=np.float32; TAU=np.pi*2

def spec(root=ROOT):
    q="""const C=require('./js/course');const pr=(t,k)=>{const p=C.raw(t,k);return [C.reframe(p.x),p.y]};console.log(JSON.stringify({L:C.L,R:C.R,B:C.railB,pitch:C.laneWidth,sideField:C.sideField,extent:C.chartExtent,rail:Array.from({length:641},(_,i)=>C.railL.map(l=>{const p=C.photo(i/640,l);return [p.x,p.y,...C.path(i/640,l)]})),edges:Array.from({length:321},(_,i)=>{const t=i/320;return [pr(t,1-C.formerFactor),pr(t,1),...[...C.railL].map(l=>{const p=C.photo(t,l);return [p.x,p.y]}),...[C.railL[0]-.027,C.railL[1]+.027].map(l=>{const p=C.photo(t,l);return [p.x,p.y,...C.path(t,l)]})]}),boards:C.landmarks.map(([t,label])=>({...C.photo(t,C.railL[0]-.036),label})),seams:Array.from({length:40},(_,i)=>[C.railL[0]-.002,C.railL[1]+.002].map(l=>C.photo((i+.32)/40,l)))}))"""
    return json.loads(subprocess.check_output(['node','-e',q],cwd=root))

def texture(root=ROOT):
    return np.asarray(Image.open(root/'assets/turf-fibre.webp').convert('RGB'))

def cut_chart(root=ROOT):
    c=spec(root);L,R,B=c['L'],c['R'],c['B'];hx,hz=c['extent'];w,h=1536,608
    j,i=np.mgrid[:h,:w].astype(F);x=((i+.5)/w*2-1)*hx;z=((j+.5)/h*2-1)*hz
    rr=np.hypot(np.maximum(np.abs(x)-L,0),z);lap=4*L+TAU*R
    s=np.where(x>L,R*np.arctan2(x-L,z),np.where(x<-L,np.pi*R+2*L+R*np.arctan2(-x-L,-z),np.where(z<0,np.pi*R+L-x,lap-L+x)))
    u=(rr-R+B)/(2*B);edge=np.minimum(u,1-u)*2*B; smooth=lambda a,b,t:np.clip((t-a)/(b-a),0,1)**2*(3-2*np.clip((t-a)/(b-a),0,1))
    # The mower turns with the oval. Faint nap changes at the wheel overlap;
    # a double-length stripe spans two adjacent passes, including wrap at t=0.
    phase=TAU*14*s/lap+.26*np.sin(3.2*rr)+.055*np.sin(10*x+7*z)
    mow=.13*np.tanh(3*np.sin(phase)); overlap=.032*np.exp(-(np.sin(phase)/.15)**2)
    collar=(1-smooth(.026,.035,edge));hem=np.exp(-((edge-.038)/.006)**2)
    grain=.017*np.sin(x*12+z*8)+.012*np.cos(19*z-5*x)+.009*np.sin(32*x-27*z)
    te=texture(root);n=te.shape[0];sample=cv.remap(cv.GaussianBlur(te,(0,0),1.9),(x/.38*n).astype(F),(z/.38*n).astype(F),cv.INTER_LINEAR,borderMode=cv.BORDER_WRAP).astype(F);fibre=np.clip((sample[:,:,1]-116)/110,-.32,.37)
    # Six used lines; the two half-lane shoulders have no hoof or tyre wear.
    pitch=c['pitch'];active=smooth(.5*pitch,.5*pitch+.005,edge);wear=active*np.exp(-((np.sin(np.pi*7*u+.16*np.sin(4*s)))/.33)**2)*(.5+.5*np.sin(6*s+7*u))
    curb=np.exp(-((edge-.5*pitch)/.0025)**2);wheel=(7*u+.026*np.sin(3.7*s)+.012*np.cos(12*s))%1-.5
    twin=np.exp(-((np.abs(wheel)-.118)/.030)**2)*active*(.42+.34*np.sin(6.4*s+11*u)+.14*np.cos(9*s))
    base=np.clip((1+mow+overlap+grain+.31*fibre-.035*wear-.12*collar-.08*hem-.115*(1-active)-.045*twin+.15*curb)[:,:,None]*np.array([81,117,64])+collar[:,:,None]*[6,2,-2]+wear[:,:,None]*[4,1,-2],0,255).astype('B')
    # Shallow, irregular pairs of hoof scuffs, part way around the six actual
    # running lines. A lighter raised lip, not mud holes or a painted lane net.
    rnd=np.random.default_rng(7281);js="const C=require('./js/course');console.log(JSON.stringify(JSON.parse(process.argv[1]).map(([t,l])=>[C.run(t,l),C.run(t+.0003,l)])))";runs=[]
    for k in range(62):
        t=rnd.random();lane=(rnd.integers(6)+rnd.uniform(.27,.72))/6
        for _ in range(rnd.integers(2,5)):
            runs.append([t,lane+rnd.uniform(-.009,.009)]);t+=rnd.uniform(.0031,.0051)
    xy=json.loads(subprocess.check_output(['node','-e',js,json.dumps(runs)],cwd=root))
    for (x0,z0),(xn,zn) in xy:
        px=int((x0/hx+1)*w/2);py=int((z0/hz+1)*h/2);co=base[py,px].astype(F);angle=np.rad2deg(np.arctan2(zn-z0,xn-x0));rad=int(rnd.integers(1,3));cv.ellipse(base,(px,py),(rad+1,rad),angle,65,295,tuple(map(int,co*[.88,.86,.84])),1,cv.LINE_AA);cv.line(base,(px,py+rad+1),(px+1,py+rad+1),tuple(map(int,np.clip(co*[1.09,1.05,.99],0,255))),1,cv.LINE_AA)
    Image.fromarray(base).save(root/'assets/course-cut.webp',quality=88,method=6)
    return base

def dressed(chart,tex,X,Z,c,mip):
    hx,hz=c['extent'];h,w=chart.shape[:2];base=cv.remap(chart,((X/hx+1)*w/2-.5).astype(F),((Z/hz+1)*h/2-.5).astype(F),cv.INTER_LINEAR,borderMode=cv.BORDER_REPLICATE).astype(F)
    k=tex.shape[0]/.38;micro=cv.remap(cv.GaussianBlur(tex,(0,0),mip),(X*k+83).astype(F),(Z*k+47).astype(F),cv.INTER_LINEAR,borderMode=cv.BORDER_WRAP).astype(F)
    v=np.clip((micro[:,:,1]+23)/139,.53,1.62);return base*(.21+.79*v)[:,:,None]

def registration(src,c):
    # Counterwarp both photographed fence lines and the wood/green apron as
    # one. Static crest, seated figures, and the real console screens stay put.
    h,w=src.shape[:2];k=w/1150;anchors={};put=lambda a,b:anchors.update({tuple(np.round(b,5)):np.asarray(a)})
    for row in c['edges'][::5]:
        i,o,ni,no=np.float64(row[:4]);rh=lambda p:(9+11*np.clip((p[1]-303)/139,0,1))*.5
        a=i-[0,rh(i)];b=o-[0,rh(o)];na=ni-[0,rh(i)];nb=no-[0,rh(o)]
        for l in [0,.42,1]:put(a+(b-a)*l,na+(nb-na)*l)
        ctr=np.array([575,344]);new=np.array([575,340]);put(ctr+.67*(a-ctr),new+.67*(na-new));
    for x in np.linspace(-12,1162,43):
        for y in [235,268,482,508]:put([x,y],[x,y])
    put([575,344],[575,340]);dest=np.array(list(anchors));orig=np.array(list(anchors.values()));ratio=np.array([1.,2.75]);rb=RBFInterpolator(dest*ratio,orig-dest,smoothing=1.2)
    yy,xx=np.mgrid[:h,:w].astype(F);top=int(262*k);bot=int(488*k);v,u=np.mgrid[top:bot:3,0:w:3];qs=np.c_[u.ravel(),v.ravel()]/k
    d=np.vstack([rb(block*ratio) for block in np.array_split(qs,12)]).reshape(*u.shape,2).astype(F)*k
    v,u=np.mgrid[0:bot-top,0:w].astype(F)/3;d=cv.remap(d,u,v,cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE);mx=xx.copy();my=yy.copy();mx[top:bot]+=d[:,:,0];my[top:bot]+=d[:,:,1]
    # The three bezel silhouettes are foreground, not strips of racetrack.
    lock=np.zeros((h,w),'B');polys=[[(397,650),(444,518),(458,451),(464,430),(474,426),(676,426),(686,432),(702,483),(749,650)], [(-10,424),(31,425),(89,450),(169,478),(169,650),(-10,650)],[(1160,424),(1119,425),(1061,450),(981,478),(981,650),(1160,650)]]
    for pts in polys:cv.fillPoly(lock,[np.int32(np.rint(np.float32(pts)*k))],255,cv.LINE_AA)
    l=cv.GaussianBlur(lock.astype(F)/255,(0,0),1.0*k);return (mx*(1-l)+xx*l).astype(F),(my*(1-l)+yy*l).astype(F),lock

def side(root=ROOT):
    c=spec(root);d=root/'assets';chart=cut_chart(root);tex=texture(root);orig=np.array(Image.open(d/'side-station.webp').convert('RGB'));mx,my,lock=registration(orig,c);oldh,oldw=orig.shape[:2];w,h=1720,960;k=w/1150
    remap=lambda im:cv.resize(cv.remap(im,mx,my,cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE),(w,h),interpolation=cv.INTER_CUBIC)
    s=remap(orig).astype(F);yy,xx=np.mgrid[:h,:w];edges=np.float32([v[4:] for v in c['edges']]);X,Z,mask=fillmap(s.shape,edges[:,:,:2]*k,edges[:,:,2:]);b=dressed(chart,tex,X,Z,c,.94);lum=s@[.29,.57,.14];illum=np.clip(cv.GaussianBlur(lum,(0,0),12)/63,.65,1.48);b*=((.69+.24*illum)*(.85+.16*np.clip((yy/k-294)/148,0,1)))[:,:,None]
    from broad_rails import finish as optical_rails
    out,m=optical_rails(root,s,b,mask,cv.resize(lock,(w,h)),c,k);g=ImageDraw.Draw(out)
    # Enamel distance boards and their stems live inside the rail. Horses and
    # occlusion mattes are composited above these live (never photographic) runners.
    for p in c['boards']:
        x,y=p['x']*k,p['y']*k;f=k*(.58+.56*np.clip((p['y']-299)/110,0,1));y-=2*f
        g.line((x+2*f,y+1*f,x+9*f,y+2*f),fill=(69,83,53),width=max(1,round(2*f)));g.rectangle((x-1*f,y-21*f,x+1.5*f,y),fill=(211,203,170));g.line((x+2*f,y-21*f,x+2*f,y),fill=(98,102,79),width=max(1,round(f)));g.rounded_rectangle((x-9*f,y-26*f,x+9*f,y-14*f),radius=2*f,fill=(42,67,52),outline=(209,195,145),width=max(1,round(f)));ft=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',max(7,round(10*f)));g.text((x,y-20*f),p['label'],font=ft,fill=(251,242,215),anchor='mm')
    out.save(d/'side-station.webp',quality=90,method=6)
    for name,alpha in zip(['side-rail','side-back-rail'],m):
        # Use the actual enlarged plate for foreground rail paint and the rim.
        im=out.convert('RGBA');im.putalpha(Image.fromarray(alpha));im.save(d/(name+'.webp'),quality=92,method=5)
    # The console now windows the same clean side-station plate via CSS.

# The old lens perspective remains calibrated. With a wider track, both rail
# feet move in the exposure; the room above the table is not stretched.
def judges(root=ROOT):
    from prepare_turf import judges as narrow
    c=spec(root);d=root/'assets';chart=np.array(Image.open(d/'course-cut.webp'));tex=texture(root)
    src=np.array(Image.open(d/'turf-wire.webp').convert('RGB'));w,h=1536,864;k=w/1280;y,x=np.mgrid[:h,:w].astype(F)/k
    sy=PchipInterpolator([0,178,211,239,271.8,307.8,445.5,640.94,701.27,861],[0,178,216,248,303.63,341.945,445.5,549.273,604.15,719],extrapolate=True)(y).astype(F)
    # At the bend the foreground paint flares out to the apron rather than
    # cutting across an outer lane. Inverse warp preserves its posts and lip.
    sx=x;out=cv.remap(src,sx,sy,cv.INTER_CUBIC,borderMode=cv.BORDER_REPLICATE).astype(F)
    _,mask=narrow(root,return_mask=True);m=cv.remap(mask.astype(F),sx,sy,cv.INTER_LINEAR,borderMode=cv.BORDER_REPLICATE)
    a=np.arctan2(.54-.088,1.22);co=np.cos(a);si=np.sin(a);v=(y-360)/1380;dep=.54*(co-v*si)/np.maximum(.035,v*co+si);X=c['L']+(x-844)*(dep*co+.54*si)/1380;Z=1.22-dep+c['R'];base=dressed(chart,tex,X,Z,c,.58);base*=((.85+.18*np.clip((y-210)/475,0,1))*(1-.09*np.clip(abs(x-620)/840,0,1)**2))[:,:,None];rr=np.hypot(np.maximum(np.abs(X)-c['L'],0),Z);apron=np.clip((rr-c['R']-c['B']-.01)/.014,0,1);base=base*(1-.26*apron[:,:,None]);m=np.maximum(m,np.clip((y-453)/38,0,1));out=out+(base-out)*m[:,:,None];out=Image.fromarray(np.uint8(np.clip(out,0,255)))
    from broad_rails import wire_fence
    out=wire_fence(root,c,out);out.save(d/'wide-wire.webp',quality=92,method=5)

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--lens-only',action='store_true');a=p.parse_args()
    if not a.lens_only:
        import sys
        subprocess.run([sys.executable,str(ROOT/'tools/prepare_side_plate.py')],cwd=ROOT,check=True)
    judges()
