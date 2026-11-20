/* Distances (model metres), not RAF counts, drive every leg and exposure.
   Sprite bounds, the maquette and both contact shadows use one linear scale. */
(function(root){'use strict';const TAU=Math.PI*2,A={w:176,h:140,angles:28,poses:12,cols:14};
 const C=root.AscotCourse||(typeof module!=='undefined'?require('./course'):null),M=root.AscotMarshal||(typeof module!=='undefined'?require('./marshal'):null);
 // The v12 trot's load stroke is measured in mould units: one full
 // revolution covers modelSize on every lane. Never re-time a dated print.
 const historicScale=.8,scale=historicScale*1.20*C.teamScale,modelSize=C.bike.size*C.teamScale,oldStep=h=>.224+.011*Math.sin(h.seed+h.num),sealedStep=h=>historicScale*oldStep(h),stepLength=()=>modelSize,walkStep=h=>.53*scale*oldStep(h);
 function travel(g,h){const s=g.state;if(s.courseStartLaw&&g.courseAt)return g.courseAt(h);if(s.phase==='race')return g.distance(h)+(s.clock>=h.finish?g.pos(h):0);if(s.phase==='gates')return M.approach(s,h);return s.phase==='result'?4+g.pos(h):M.paddock(h,s.clock,s.filmStock??0);}
 const walking=s=>s.phase==='betting'||s.phase==='gates';
 function cycles(g,h){let d=C.runOdometer(travel(g,h),h.lane);if(g.state.courseStartLaw)d-=C.runOdometer(C.startT,h.lane);return d/(walking(g.state)?walkStep(h):stepLength(h));}
 const offset=h=>(h.seed/TAU+(h.num-1)*.2236)%1,cell=(t,n)=>((Math.round(t*n)%n)+n)%n,frameFor=t=>cell(t,A.poses),routeExposure=(h,d)=>frameFor((C.runOdometer(C.startT+d,h.lane)-C.runOdometer(C.startT,h.lane))/stepLength(h)+offset(h));
 const HD={w:308,h:245,cols:6},hdRect=(phase,left=false)=>{const i=Number(left)*A.poses+phase;return [i%HD.cols*HD.w,Math.floor(i/HD.cols)*HD.h,HD.w,HD.h];};
 const WALK={w:120,h:96,poses:8};
 // Ease the last half-step into a four-foot stance and leave it on the
 // first push. This only deforms the cast; its timing datum never shifts.
 function effort(s){if(s.phase==='gates')return M.smooth((M.load(s)-s.clock)/.54);if(s.phase==='race')return M.smooth(s.clock/.33);return 1;}
 function bank(g,h){const s=g.state;if(s.phase!=='race'||s.clock<=0||s.clock>=h.finish)return 0;
   const t=g.pos(h),e=.009,a=C.run(t-e,h.lane),p=C.run(t,h.lane),b=C.run(t+e,h.lane),dx=p[0]-a[0],dz=p[1]-a[1],fx=b[0]-p[0],fz=b[1]-p[1];
   const len=Math.hypot(dx,dz)+Math.hypot(fx,fz),curve=2*Math.atan2(dx*fz-dz*fx,dx*fx+dz*fz)/len;
   const from=Math.max(0,s.clock-.06),now=g.courseAt?g.courseAt(h):g.distance(h),before=g.courseAt?g.courseAt(h,from):g.distance(h,from),v=(C.runOdometer(now,h.lane)-C.runOdometer(before,h.lane))/(s.clock-from);
   return Math.max(-.095,Math.min(.095,curve*v*v*.33))*effort(s);
 }
 const api={A,HD,WALK,historicScale,scale,modelSize,hdRect,cycles,offset,travel,stepLength,walkStep,walking,effort,bank,inBox:M.boxed,
   legacyExposure:(h,d)=>frameFor(d*Math.round(31.8+Math.sin(h.seed+h.num)*1.5)+offset(h)),narrowExposure:(h,d)=>frameFor(C.former.odometer(d,h.lane)/oldStep(h)+offset(h)),sealedExposure:(h,d)=>frameFor(C.broad.odometer(d,h.lane)/sealedStep(h)+offset(h)),broadExposure:(h,d)=>frameFor(C.broad.odometer(d,h.lane)/oldStep(h)+offset(h)),sulky16Exposure:(h,d)=>frameFor(C.sixteen.odometer(d,h.lane)/stepLength(h)+offset(h)),sulky15Exposure:(h,d)=>frameFor(C.broad.odometer(d,h.lane)/stepLength(h)+offset(h)),mountedExposure:(h,d)=>frameFor(C.broad.odometer(d,h.lane)/(.219*historicScale)+offset(h)),exposure:(h,d)=>frameFor(C.runOdometer(d,h.lane)/stepLength(h)+offset(h)),routeExposure,stance:h=>frameFor(offset(h)),theta:(g,h)=>(cycles(g,h)+offset(h))*TAU,walkFrame:(g,h)=>cell(cycles(g,h)+offset(h),WALK.poses),frame:(g,h)=>frameFor(cycles(g,h)+offset(h))};root.AscotStride=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
