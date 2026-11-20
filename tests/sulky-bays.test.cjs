/* Measure real stall parts against the two rolling wheels in gate coordinates.
   No camera zoom, outcome change or new gate positions in the saved heat. */
'use strict';const test=require('node:test'),A=require('node:assert/strict');
require('../js/bet-math');const E=require('../js/engine'),C=require('../js/course'),M=require('../js/sulky'),S=require('../js/stride'),G=require('../js/start-gate'),marshal=require('../js/marshal');
const size=S.modelSize,tyre=M.wheelR*size,hub=(M.wheelR+.0015)*size-.0003;
test('the rack is dimensioned from the off-centre team, not the canvas cell or just the horse',()=>{
  const e=M.envelope;A.ok(G.FRONT-size*e.nose>=.035&&G.FRONT-size*e.nose<.05);
  A.ok(size*e.rear-G.BACK>=.043&&size*e.rear-G.BACK<.055);
  A.ok(Math.abs(G.step/2-e.halfWidth*size-.25*C.teamWidth)<1e-9&&G.step/2-.005-e.halfWidth*size>.0025);A.ok(G.TOP-.028-e.top*size>.037);
  A.ok(G.sill>hub+tyre+.009);A.equal(G.badges.length,6);
  for(const l of G.doors){A.ok(l.pads.every(f=>f.q.every(q=>q[1]>=G.sill-1e-9)));}
  // The closed rear wicket has a genuine sightline at driver-seat height,
  // not one large green tailboard painted over the sulky.
  for(const l of G.rears)A.ok(l.pads.every(f=>f.q.every(q=>q[1]<.087)||f.q.every(q=>q[1]>.087)));
});
// Conservative solid envelopes: compare the bounding box of every low piece
// of real painted gate geometry to an entire oriented wheel disc, plus hub.
// Inflating a rotated beam to its enclosing box can only reduce clearance.
function check(g){const s=g.state,p=G.pose(s),low=[];
  function box(points,pad,material){let x=Infinity,y=x,z=x,X=-x,Y=X,Z=X;for(const v of points){x=Math.min(x,v[0]);y=Math.min(y,v[1]);z=Math.min(z,v[2]);X=Math.max(X,v[0]);Y=Math.max(Y,v[1]);Z=Math.max(Z,v[2]);}if(y-pad>hub+tyre+.0003)return;low.push({x:(x+X)/2,z:(z+Z)/2,hx:(X-x)/2+pad,hz:(Z-z)/2+pad,dy:Math.max(0,y-pad-hub,hub-Y-pad),material});}
  G.lines(p,(a,b,w,m)=>box([a,b],w*.71,m));G.skins(p,(q,m)=>box(q,0,m));
  for(const h of s.runners){const t=g.pos(h),a=C.run(t,h.lane),b=C.run(C.tow(t,h.lane),h.lane),yaw=Math.atan2(a[1]-b[1],a[0]-b[0]),co=Math.cos(yaw),si=Math.sin(yaw);
    for(const side of [-1,1]){const x=a[0]-C.startX+size*(co*M.axle-si*side*M.spread),z=a[1]-C.R+size*(si*M.axle+co*side*M.spread);
      for(const f of low){const dx=f.x-x,dz=f.z-z,hw=.0171*size+.0003,rr=tyre+.0003;
        if(Math.abs(dx)>f.hx+Math.abs(co)*rr+Math.abs(si)*hw||Math.abs(dz)>f.hz+Math.abs(si)*rr+Math.abs(co)*hw)continue;
        const u=Math.max(0,Math.abs(dx*co+dz*si)-Math.abs(co)*f.hx-Math.abs(si)*f.hz),v=Math.abs(-dx*si+dz*co)-Math.abs(si)*f.hx-Math.abs(co)*f.hz;
        const radius=v<.0053*size+.0003?tyre:v<.0171*size+.0003?.0141*size:0;
        if(radius)A.ok(u*u+f.dy*f.dy>(radius+.0003)**2,`#${h.num} wheel ${side}, ${s.phase} ${s.clock.toFixed(3)}, ${f.material}`);
      }
    }
  }
}
test('all 12 tyres and hubs clear the real shutters and guides on entry and the first bend, for early and automatic lock',()=>{
  for(const early of [true,false]){const g=E.createMachine({random:()=>.10});if(early)g.close();else g.tick(marshal.OPEN);
    const s=g.state;A.equal(s.phase,'gates');let swung=false;
    for(let t=0;t<=5.05;t+=.04){s.clock=t;const p=G.pose(s);if(p.rear<Math.PI/2-1e-8){swung=true;for(const h of s.runners){const tail=C.length*marshal.approach(s,h)+size*M.envelope.rear;A.ok(tail>G.BACK+.0079,'rear paddles swept into a rolling tyre');}}check(g);}
    A.ok(swung);s.clock=0;g.tick(s.gate);A.equal(s.phase,'race');
    for(let t=0;t<G.PARK;t+=.017){s.clock=t;check(g);}s.clock=G.PARK;A.equal(G.pose(s),null);
  }
});
