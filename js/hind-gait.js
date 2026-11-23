/* Measured bind polylines of the photographed cast, in unscaled mould units.
   +X forward, +Y up; the +Z flank is the horse's right. At a fused shoulder
   interpolate the two solved limbs, NOT their clocks (which creates a third
   spurious footfall). See docs/diagonal-trot.md for references and tests. */
(function(root){'use strict';const tau=2*Math.PI,clamp=t=>Math.min(1,Math.max(0,t)),mix=(a,b,t)=>a+(b-a)*t,mod=t=>t-Math.floor(t),ease=v=>v*v*(3-2*v);
 const near=[[-.150,.311],[-.113,.222],[-.135,.149],[-.053,.060],[-.030,.022]],far=[[-.177,.311],[-.211,.249],[-.262,.190],[-.303,.140],[-.324,.097]];
 const hind=[near.slice(0,4).concat([[-.031,.02008]]),far.slice(0,4).concat([[-.329,.09320]])],fore=[[[.145,.310],[.203,.261],[.303,.176],[.346,.105],[.365,.07168]],[[.139,.310],[.150,.237],[.218,.165],[.281,.070],[.309,.02224]]];
 function intersect(a,b,A,B,side){const X=b[0]-a[0],Y=b[1]-a[1],d=Math.max(.0001,Math.hypot(X,Y)),h=Math.min(A,Math.max(-A,(d*d+A*A-B*B)/(2*d))),v=side*Math.sqrt(Math.max(0,A*A-h*h));return [a[0]+(X*h-Y*v)/d,a[1]+(Y*h+X*v)/d];}
 // Reconstruct the hind limb from a *reciprocal* flexion at the stifle
 // and tarsus. Origin is the hip, +X points towards the horse's nose. A
 // and C (femur and metatarsus) swing in concert; B (tibia) runs back
 // and down between them. Given their angular offset split, the two outer
 // bones add to one vector of known length L. Close the remaining triangle
 // on the cranial side, then recover the rear point of the hock from below.
 const femur=.113,tibia=.148,metatarsus=.105;
 function hindJoints(hip,fetlock,split){const X=fetlock[0]-hip[0],Y=hip[1]-fetlock[1],d=Math.hypot(X,Y),cs=metatarsus*Math.sin(split),cc=femur+metatarsus*Math.cos(split),L=Math.hypot(cc,cs),
   open=Math.acos(Math.max(-1,Math.min(1,(d*d+L*L-tibia*tibia)/(2*d*L)))),thigh=Math.atan2(X,Y)+open-Math.atan2(cs,cc),cannon=thigh+split;
   return [[hip[0]+femur*Math.sin(thigh),hip[1]-femur*Math.cos(thigh)],[fetlock[0]-metatarsus*Math.sin(cannon),fetlock[1]+metatarsus*Math.cos(cannon)]];}
 // A shorter four-beat step to the stalls. It shares the hind articulation,
 // not the race clock, foreleg rig, heel trajectory or stride length.
 function walking(u,side){u=mod(u+.50*side);const duty=.62,span=.32,reach=-.006,air=u>=duty,v=air?(u-duty)/(1-duty):u/duty,arch=air?Math.sin(Math.PI*v)**2:0;
   const x=air?reach-span+span*ease(v)-span*(1-duty)/duty*v*(1-v)*(1-2*v)+.045*arch*(1-v):reach-span*v,y=.024+.047*arch*(1+.32*Math.cos(Math.PI*v)),tilt=air?.72*Math.sin(tau*v)*Math.sin(Math.PI*v):0;
   const toe=[x,y],ankle=[x-.018*Math.cos(tilt)-.032*Math.sin(tilt),y+.032*Math.cos(tilt)-.018*Math.sin(tilt)],hip=[-.166+.006*Math.cos(tau*u),.325],j=hindJoints(hip,ankle,-.33);return [hip,...j,ankle,toe];}
 function binding(x,y,rest){let j=0;while(j<3&&y<rest[j+1][1])j++;let other=j,blend=0;for(let i=1;i<4;i++){const t=(rest[i][1]+.012-y)/.024;if(t>=0&&t<=1){j=i-1;other=i;blend=ease(t);break;}}
   const local=k=>{const [a,b]=[rest[k],rest[k+1]],dx=b[0]-a[0],dy=b[1]-a[1],d=Math.hypot(dx,dy),X=x-a[0],Y=y-a[1];return {k,u:(X*dx+Y*dy)/(d*d),v:(Y*dx-X*dy)/d};};return {a:local(j),b:blend?local(other):null,blend};}
 const between=(a,b,side)=>a.map((p,i)=>p.map((n,k)=>mix(n,b[i][k],side)));
 function bind(x,y,side){return binding(x,y,between(near,far,side));}
 function palette(p){return p.slice(0,-1).map((a,k)=>{const X=p[k+1][0]-a[0],Y=p[k+1][1]-a[1],d=Math.hypot(X,Y)||1;return {x:a[0],y:a[1],X,Y,nx:-Y/d,ny:X/d};});}
 function sample(p,b,out){const a=b.a,k=p[a.k];let x=k.x+a.u*k.X+a.v*k.nx,y=k.y+a.u*k.Y+a.v*k.ny;if(b.b){const z=b.b,m=p[z.k];x=mix(x,m.x+z.u*m.X+z.v*m.nx,b.blend);y=mix(y,m.y+z.u*m.Y+z.v*m.ny,b.blend);}out[0]=x;out[1]=y;}
 // Two diagonals exactly half a stride apart. 3/8 load + 1/8 flight per
 // beat. A full cycle covers one mould unit in AscotStride; therefore the
 // planted toe travels backwards exactly as fast as the horse goes forward.
 const duty=3/8,floor=.024;
 function trunk(t){return .008*Math.cos(2*tau*(t-.4375));}
 function flight(t){const h=mod(2*t)*.5;return h>duty?.012*Math.sin(Math.PI*(h-duty)/(.5-duty))**2:0;}
 // Lower convex edges of the four actual mould soles, in bind-toe units.
 // As the heel lifts, roll about each contacting corner until the following
 // edge lies flat. Integrating those pivots holds the contact in world space:
 // rotating about the hoof centre instead makes the toes skate into the felt.
 const rims=[[[.00628,0],[.01488,.00428]],[[-.00864,0],[.01288,.00536],[.01716,.00752]],[[.00704,0]],[[.00604,0],[.01036,.00108],[.01464,.00320]]];
 function roll(rim,a){let x=0,y=0,prev=0;for(let i=0;i<rim.length;i++){const [X,Y]=rim[i],n=rim[i+1],end=n?Math.min(a,Math.atan2(n[1]-Y,n[0]-X)):a;
   x+=X*(Math.cos(prev)-Math.cos(end))+Y*(Math.sin(prev)-Math.sin(end));y+=X*(Math.sin(end)-Math.sin(prev))+Y*(Math.cos(prev)-Math.cos(end));if(a<=end)break;prev=end;}return [x,y];}
 // A single hoof trace, translated from shoulder to hip. Both members of
 // each diagonal share stride reach, breakover, apex and return velocity.
 // Contact compensation alone depends on the measured outline of that shoe.
 function trace(u){u=mod(u);const air=u>duty,v=air?(u-duty)/(1-duty):u/duty,arch=air?Math.sin(Math.PI*v)**2:0,
   sweep=air?-duty/2+duty*ease(v)-(1-duty)*v*(1-v)*(1-2*v)+.0513*arch*v:duty/2-u,
   high=arch*(1+.61*Math.cos(Math.PI*v)),flip=air?Math.sin(Math.PI*clamp((v-.65)/.35))**2:0,
   lift=.100*high+.022*flip,load=air?0:Math.sin(Math.PI*v)**2,
   heel=.46*(air?1-ease(clamp(v/.52)):ease(clamp((v-.72)/.28))),
   pitch=-heel+(air?-.58*Math.sin(Math.PI*clamp(v/.57))**2+.32*Math.sin(Math.PI*clamp((v-.49)/.51))**2:0);
   return {air,v,arch,sweep,high,lift,load,heel,pitch};}
 function trot(t,front,side,amp=1){const u=mod(t+((front!==!!side)?.5:0)),{air,v,arch,sweep,high,lift,load,heel,pitch}=trace(u),
     c=Math.cos(pitch),s=Math.sin(pitch),rim=rims[(front?2:0)+Number(!!side)],off=roll(rim,heel),x=(front?.160:-.184)+sweep+off[0],y=floor+off[1]+lift+flight(t)-trunk(t);
   // A springy pastern, not a rubber cannon. With the carpus extended, the
   // fetlock descends to midstance and recoils while the hoof is still flat.
   const pastern=.049,angle=.37+.65*load+(air?.17*high:0),hx=-pastern*Math.sin(angle),hy=pastern*Math.cos(angle),
     toe=[x,y],fetlock=[x+c*hx-s*hy,y+s*hx+c*hy],rock=front?.009:.017,extension=front?0:Math.exp(-Math.pow(Math.sin(Math.PI*(u-.392))/.56,4)),
     carry=front?0:Math.exp(-Math.pow((u-.590)/.112,2)),fold=front?0:Math.exp(-Math.pow((u-.65)/.055,2)),root=[(front?.144:-.167-.012*extension-.042*carry+.012*Math.cos(tau*u)+.022*fold)+rock*Math.cos(tau*u),front?.347:.353+.014*arch-.052*extension+.050*carry+.008*fold];
   let hinge,upper;
   if(front){ // Load an extended carpus and unfold before touchdown.
     const A=.105,B=.133,C=.127,d=Math.hypot(fetlock[0]-root[0],fetlock[1]-root[1]);
     const flex=.10+2.0*high,L=Math.max(d-A+.0001,Math.min(d+A-.0001,Math.sqrt(B*B+C*C+2*B*C*Math.cos(flex))));
     upper=intersect(root,fetlock,A,L,-1);hinge=intersect(upper,fetlock,B,C,1);
   }else {
     // As the heel leaves the ground, the trailing cannon and the thigh
     // cannot be parallel. Let the pelvis settle over the leg and expose
     // the patella on the nose side of the hip *already at lift-off*.
     // The tibia still descends caudally to the hock; four fixed lengths.
     [upper,hinge]=hindJoints(root,fetlock,-.17-.91*extension-.36*carry+.25*fold);
   }
   let shoe=null;if(amp<1){const e=roll(rim,amp*heel);shoe=[e[0]-amp*off[0],e[1]-amp*off[1],Math.cos(amp*pitch)-(1-amp+amp*c),Math.sin(amp*pitch)-amp*s];}
   return {points:[root,upper,hinge,fetlock,toe],c,s,air,heel,pitch,load,shoe};}
 function trotBind(x,y,front,side){const bones=front?fore:hind,line=between(bones[0],bones[1],side),b=binding(x,y,line);b.toeX=x-line[4][0];b.toeY=y-line[4][1];b.shoe=1-ease(clamp((b.toeY-.014)/.036));return b;}
 function trotPose(a,b,side){const points=side===0?a.points:side===1?b.points:between(a.points,b.points,side);return {sole:a.shoe&&a.shoe.map((v,i)=>mix(v,b.shoe[i],side)),bones:palette(points),x:points[4][0],y:points[4][1],c:mix(a.c,b.c,side),s:mix(a.s,b.s,side)};}
 function trotSample(p,b,out){sample(p.bones,b,out);if(b.shoe){out[0]=mix(out[0],p.x+p.c*b.toeX-p.s*b.toeY,b.shoe);out[1]=mix(out[1],p.y+p.s*b.toeX+p.c*b.toeY,b.shoe);}}
 const chain=(t,side,walk)=>walk?walking(t,side):trot(t,false,side).points,pose=(theta,side,walk)=>palette(chain(theta/tau,side,walk));
 const api={trace,chain,bind,pose,sample,duty,floor,trunk,flight,trot,trotBind,trotPose,trotSample};root.AscotHindGait=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
