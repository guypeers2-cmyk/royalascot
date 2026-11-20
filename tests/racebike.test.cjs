/* Independently measure the printed maquette; no nominal trailer width or
   sprite-cell sizes in the acceptance measurement. */
'use strict';const {test}=require('node:test'),A=require('node:assert/strict');global.window=global;
const T=global.THREE=require('../js/three.min');T.TextureLoader.prototype.load=()=>new T.Texture();require('../js/mould');require('../js/hind-gait');const M=require('../js/sulky'),S=require('../js/stride'),C=require('../js/course'),G=require('../js/start-gate'),B=require('../js/infield').board;require('../js/horse-rig');
const near=(a,b,t=2e-7)=>A.ok(Math.abs(a-b)<t,`${a} / ${b}`);
test('six full-size pitches stay unchanged around the smaller whole team, with wheels inside every lane for an entire revolution',()=>{
 const fig=CabinetFigurines(new T.Group())(1),rim=fig.mesh.getObjectByName('Sixteen-spoke racing wheels'),pts=rim.geometry.attributes.position,box=new T.Box3().setFromBufferAttribute(pts),actual=(box.max.z-box.min.z)*S.modelSize;
 near(actual,C.teamWidth,2e-8);near(G.step,1.5*actual,2e-8);near((G.step-actual)/2,.25*actual,2e-8);
 const d=-M.axle*S.modelSize,rr=M.wheelR*S.modelSize;let min=Infinity;
 for(let j=0;j<=1536;j++)for(let i=0;i<6;i++){const t=j/1536,l=(i+.5)/6,p=C.run(t,l),a=C.run(C.tow(t,l),l),dx=p[0]-a[0],dz=p[1]-a[1],n=Math.hypot(dx,dz);near(n,d);const co=dx/n,si=dz/n;
   for(const sign of [-1,1])for(const side of [C.bike.spread-C.bike.cap,C.bike.spread+C.bike.cap])for(const f of [-1,-.5,0,.5,1]){const z=sign*side*S.modelSize,x=p[0]+co*(f*rr-d)-si*z,y=p[1]+si*(f*rr-d)+co*z,rad=Math.hypot(Math.max(Math.abs(x)-C.L,0),y);min=Math.min(min,rad-(C.innerRadius+i*G.step),C.innerRadius+(i+1)*G.step-rad);}}
 A.ok(min>.005,`wheel exclusion margin ${min}`);
});
test('driver sits behind horse with both long booted legs reaching forward to inboard, load-bearing stirrups',()=>{const f=CabinetFigurines(new T.Group())(4),seat=f.mesh.getObjectByName('Driver seat'),legs=seat.getObjectByName('Extended legs on forward stirrups'),steels=f.mesh.getObjectByName('Twin-shaft sulky chassis'),P=M.pose;A.ok(legs&&steels);const points=m=>{const v=m.geometry.attributes.position;return Array.from({length:v.count},(_,i)=>[v.getX(i),v.getY(i),v.getZ(i)]);},cloth=points(legs),metal=points(steels);
 for(const z of [1,-1]){const toe=.308+P.seat[0],y=P.seat[1]+.030;A.ok(cloth.some(([x,b,c])=>x>.309&&Math.abs(b-.030)<.016&&Math.abs(c-z*.121)<.016));A.ok(metal.some(([x,b,c])=>Math.abs(x-toe)<.03&&b<y-.007&&b>y-.035&&Math.abs(c-z*.121)<.021));A.ok(P.ankle[0]-P.hip[0]>.28&&Math.abs(P.ankle[1]-P.hip[1])<.04);A.ok(P.knee[0]>P.hip[0]&&P.ankle[0]>P.knee[0]&&P.ankle[2]<M.spread-.035);}
 for(let i=0;i<24;i++){f.move(i*Math.PI/12,1,false,0);near(seat.rotation.z,0);A.ok(seat.getObjectByName('Helmeted seated driver').parent.rotation.z>.48);}
});
test('the lowered number strip leaves clear air below even the nearest backstretch hooves behind it',()=>{A.ok(B.top<.12&&B.top-B.height>.03);const edge=Math.min(...[-B.width/2,0,B.width/2].map(x=>C.gardenPoint(x,B.top,B.cz+B.z).y));for(let i=0;i<=20;i++)for(let lane=0;lane<6;lane++){const x=B.width*(i/20-.5),t=C.stops[1]+(C.L-x)/C.length;A.ok(C.photo(t,(lane+.5)/6).y+9<edge);}});
