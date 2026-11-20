/* Royal Ascot Long Course, in model metres. Race fraction 0/1 is exactly
   the tangent at the END of the near, left-to-right home straight. The return
   bend, backstretch, far bend and home straight follow in that order. */
(function(root){'use strict';const L=1.70,oldL=1.05,referenceR=.585,referenceB=.213,formerFactor=1.4,outerSurvey=1.18,TAU=2*Math.PI,straight=2*L,wireX=L;
 const mod=t=>(t%1+1)%1,clamp=(v,l,h)=>Math.min(h,Math.max(l,v));
 function oval(R,B){const arc=Math.PI*R,length=2*straight+2*arc;
   function centerline(t,off=0){let d=mod(t)*length,rr=R+off;if(d<arc){const a=d/R;return[L+rr*Math.sin(a),rr*Math.cos(a)];}d-=arc;if(d<straight)return [L-d,-rr];d-=straight;if(d<arc){const a=d/R;return[-L-rr*Math.sin(a),-rr*Math.cos(a)];}return[-L+d-arc,rr];}
   function odometer(t,lane){const k=Math.floor(t),d=(t-k)*length,rr=R+(2*lane-1)*B,bends=Math.min(d,arc)+clamp(d-arc-straight,0,arc);return k*(2*straight+TAU*rr)+(d-bends)+bends*rr/R;}
   return Object.freeze({R,B,arc,length,innerRadius:R-B,outerRadius:R+B,centerline,path:(t,lane)=>centerline(t,(2*lane-1)*B),odometer});}
 // v1–v3 negatives and the cabinet photograph have a fixed original survey.
 // Do not let a wider modern bend move an old winner or change its gait.
 const formerB=referenceB*formerFactor,former=oval(referenceR+referenceB-formerB,formerB),oldLength=4*oldL+TAU*former.R;
 // v16: from outside cap to outside cap, not tyre tread or sprite width.
 const bike=Object.freeze({size:.219*(.8*1.20),spread:.170,cap:.012+.005*Math.sin(3*Math.PI/7),wheelR:1/(3.5*Math.PI),axle:-.620,factor:1.2}),teamScale=.8,turnScale=1.2;
 // Keep the six surveyed pitches at their established width while shrinking
 // the visible horse, driver, sulky and running envelope together by 20%.
 const surveyedTeamWidth=2*(bike.spread+bike.cap)*bike.size,teamWidth=surveyedTeamWidth*teamScale,laneWidth=surveyedTeamWidth*bike.factor,broad=oval(.575,referenceB*2),half=3*laneWidth,widthFactor=half/referenceB;
 // Six running strips plus two unused half-pitches. The wider turning radius
 // grows the whole oval outward without narrowing a lane or shoulder.
 const shoulder=laneWidth/2,railB=half+shoulder,rails=oval((broad.outerRadius-railB)*turnScale,railB),sixteen=oval(broad.outerRadius-half,half),current=oval(rails.R,half),{arc,length}=current,chartExtent=Object.freeze([L+rails.outerRadius+.06,rails.outerRadius+.10]);
 // The current race starts and finishes on one shared marker three-quarters
 // down the home straight from the bend. New cards run four complete circuits.
 // Preserve the prior short-run geometry for already-issued course law 1.
 const legacyStartToFinish=.25*straight/length,startT=1-legacyStartToFinish,startX=wireX-.25*straight,
   startToFinish=0,finishT=startT,finishX=startX,raceDistance=4,legacyRaceDistance=3+legacyStartToFinish;
 const railL=Object.freeze([-1/12,13/12]),edgeLane=j=>railL[j],activeOuter=outerSurvey-shoulder/(2*referenceB);const stops=[0,arc/length,(arc+straight)/length,(2*arc+straight)/length,1];
 const inside=[[575,398],[684,398,809,398,909,398],[973,398,996,387,996,367],[996,342,909,318,806,317],[645,317,506,317,345,317],[241,318,155,343,155,367],[155,390,178,398,243,398],[341,398,468,398,575,398]],outside=[[575,442],[705,442,844,442,969,442],[1056,442,1123,426,1124,398],[1124,352,951,303,818,303],[658,303,492,303,332,303],[199,303,26,352,26,398],[26,426,92,442,179,442],[309,442,447,442,575,442]];
 function survey(a,seg,u){const f=1-u,s=a[seg-1],b=a[seg];return{x:f*f*f*s.at(-2)+3*f*f*u*b[0]+3*f*u*u*b[2]+u*u*u*b[4],y:f*f*f*s.at(-1)+3*f*f*u*b[1]+3*f*u*u*b[3]+u*u*u*b[5]};}
 // Fixed original lens survey for the plate-authoring mesh. Its sampling
 // distribution must not change merely because the playable race got longer.
 function plateReference(t,lane){const half=oldL/oldLength,turn=(1-4*half)/4,q=[0,half,half+turn,half+2*turn,3*half+2*turn,3*half+3*turn,1-half,1];t=mod(t);let k=1;while(k<7&&t>q[k])k++;const u=(t-q[k-1])/(q[k]-q[k-1]),a=survey(inside,k,u),b=survey(outside,k,u);return {x:a.x+(b.x-a.x)*lane,y:a.y+(b.y-a.y)*lane};}
 function section(t){let d=mod(t)*length;if(d<arc/2)return [2,d*2/arc];if(d<arc)return [3,(d-arc/2)*2/arc];d-=arc;if(d<straight)return [4,d/straight];d-=straight;if(d<arc/2)return [5,d*2/arc];if(d<arc)return [6,(d-arc/2)*2/arc];d-=arc;return d<L?[7,d/L]:[1,(d-L)/L];}
 function raw(t,lane){const [k,u]=section(t),a=survey(inside,k,u),b=survey(outside,k,u);return {x:a.x+(b.x-a.x)*lane,y:a.y+(b.y-a.y)*lane};}
 // A registered horizontal reframe of the bed. The end tangencies move
 // towards the rounded ends; the physical screen and the station eye do not.
 function reframe(x){const u=(x-575)/575;return 575+575*(u+.34*u*(1-u*u));}
 const sideField=.925,sideX=x=>575+sideField*(reframe(x)-575);
 function reference(t,lane){return raw(t,lane);}function photo(t,lane){const p=raw(t,activeOuter+(lane-1)*widthFactor);return{x:sideX(p.x),y:p.y};}
 function gateFoot(x,lane){const p=photo(0,lane),b=photo(-.02/length,lane);return{x:p.x+(p.x-b.x)*x/.02,y:p.y+(p.y-b.y)*x/.02};}
 // Register a point on the infield to the two *inner* photographed rails.
 // Use the same survey for pedestal, plinth, flower heads and depth sorting.
 function gardenPoint(x,y,z){const d=(L-x)/length,near=photo(1-d,railL[0]),far=photo(stops[1]+d,railL[0]),u=.5+z/(2*rails.innerRadius);return {x:far.x+(near.x-far.x)*u,y:far.y+(near.y-far.y)*u-y*(197+22*u)};}
 // Ease direction AND linear speed into the first/last 20 degrees of a
 // turn. The drawn oval stays put. A lane-centred wheelset gets a tiny
 // outward easement (<2.2 mm); its normal acceleration starts at zero.
 // At the tangent dθ/ds=1/r_lane, not 1/r_reference: no speed step.
 const blend=.35,pi=Math.PI,rr=l=>current.R+(2*l-1)*half;
 const easing=.225,skirt=a=>a<easing?(1-Math.cos(a))*(1-a/easing)**5:0;
 const speed=a=>{if(a>=easing)return 1;const k=1-a/easing,d=Math.sin(a)*k**5-5*(1-Math.cos(a))*k**4/easing;return Math.hypot(1+skirt(a),d);};
 const N=192,increment=blend/N,dist=new Float64Array(N+1);for(let i=0;i<N;i++)dist[i+1]=dist[i]+increment*(speed(i*increment)+4*speed((i+.5)*increment)+speed((i+1)*increment))/6;
 const extra=dist[N]-blend,integral=u=>{if(u>=blend)return u+extra;const v=Math.max(0,u)/increment,i=Math.min(N-1,Math.floor(v));return dist[i]+(v-i)*(dist[i+1]-dist[i]);};
 function sectionAt(t,l){const d=mod(t)*length,k=d<arc?0:d<arc+straight?1:d<2*arc+straight?2:3,from=d-[0,arc,arc+straight,2*arc+straight][k],r=rr(l);if(k%2)return {k,from,t,l,r};const theta=from/current.R,z=Math.min(theta,pi-theta),u=clamp(z/blend,0,1),envelope=1-u*u*u*(10-15*u+6*u*u),a=z+(current.R/r-1)*z*envelope,A=theta>pi/2?pi-a:a;
   return {k,from,t:t+(A-theta)*current.R/length,l:l+r*skirt(a)/(2*half),a:A,r};}
 function run(t,l){const q=sectionAt(t,l);return current.path(q.t,q.l);}function rawRunPhoto(t,l){const q=sectionAt(t,l);return photo(q.t,q.l);}
 // The original photograph has seven independently registered cubic spans.
 // Their endpoints coincide but their derivatives do not. Match each side's
 // screen velocity AND acceleration locally, preserving the wire and every
 // rail registration knot exactly. No per-frame filter that lags a horse.
 const opticalKnots=[0,arc/(2*length),stops[1],stops[2],stops[2]+arc/(2*length),stops[3],1-L/length],opticalCache=new Map(),feather=.013;
 function optical(l){if(opticalCache.has(l))return opticalCache.get(l);const eps=.000012,rows=opticalKnots.map(t=>{const p=rawRunPhoto(t,l),a=rawRunPhoto(t-eps,l),b=rawRunPhoto(t+eps,l),aa=rawRunPhoto(t-2*eps,l),bb=rawRunPhoto(t+2*eps,l);return ['x','y'].map(k=>{const left=(3*p[k]-4*a[k]+aa[k])/(2*eps),right=(4*b[k]-bb[k]-3*p[k])/(2*eps),accL=(p[k]-2*a[k]+aa[k])/(eps*eps),accR=(p[k]-2*b[k]+bb[k])/(eps*eps);return [(right-left)/2,(accR-accL)/4];});});if(opticalCache.size>64)opticalCache.clear();opticalCache.set(l,rows);return rows;}
 function runPhoto(t,l){const p=rawRunPhoto(t,l),u=mod(t);for(let j=0;j<opticalKnots.length;j++){let d=u-opticalKnots[j];if(d>.5)d-=1;if(d<-.5)d+=1;if(Math.abs(d)>=feather)continue;const v=Math.abs(d)/feather,fade=1-v*v*v*(10-15*v+6*v*v),row=optical(l)[j],sign=d<0?1:-1;for(const [i,k] of ['x','y'].entries())p[k]+=sign*fade*d*(row[i][0]+d*row[i][1]);break;}return p;}
 function runOdometer(t,l){const q=sectionAt(t,l),turn=q.r*(pi+2*extra),base=Math.floor(t)*(2*straight+2*turn)+[0,turn,turn+straight,2*turn+straight][q.k];return base+(q.k%2?q.from:q.r*(q.a<=pi/2?integral(q.a):pi+2*extra-integral(pi-q.a)));}
 // Fixed-length shaft chord. Use the analytic solution in the long middle
 // sections and bracket the two transitions (including the lap wrap).
 function tow(t,lane){const d=-bike.axle*bike.size*teamScale,q=sectionAt(t,lane);if(q.k%2&&q.from>=d)return t-d/length;
   const angle=2*Math.asin(d/(2*q.r));if(!(q.k%2)&&q.a>=blend+angle&&q.a<=pi-blend)return t-angle*current.R/length;
   const p=run(t,lane);let lo=0,hi=d*Math.max(1.4,2.4*current.R/q.r)/length;for(let j=0;j<24;j++){const m=(lo+hi)/2,a=run(t-m,lane);if(Math.hypot(p[0]-a[0],p[1]-a[1])<d)lo=m;else hi=m;}return t-(lo+hi)/2;}
 function steering(t,l){const p=run(t,l),a=run(tow(t,l),l);return Math.atan2(a[1]-p[1],p[0]-a[0]);}
 const api={sideField,sideX,rails,railB,railL,edgeLane,activeOuter,shoulder,sixteen,run,runPhoto,runOdometer,steering,blend,bike,teamScale,turnScale,surveyedTeamWidth,teamWidth,laneWidth,broad,tow,gardenPoint,startToFinish,legacyStartToFinish,startT,startX,finishT,finishX,raceDistance,legacyRaceDistance,...current,chartExtent,L,straight,oldLength,wireX,former,formerFactor,referenceB,referenceR,widthFactor,outerSurvey,stops,photo,raw,reference,plateReference,reframe,gateFoot,landmarks:Object.freeze([[.25,'¼'],[.5,'½'],[.75,'¾']])};root.AscotCourse=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
