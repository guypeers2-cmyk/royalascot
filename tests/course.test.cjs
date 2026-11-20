'use strict';
const test=require('node:test'),assert=require('node:assert/strict');require('../js/bet-math');
const E=require('../js/engine'),D=require('../js/race-day'),P=require('../js/race-performance'),M=require('../js/opening-meet'),B=require('../js/stud-book'),C=require('../js/course'),S=require('../js/seat-pov'),G=require('../js/start-gate'),K=require('../js/gate-feed'),I=require('../js/runner-intel'),R=require('../js/race-receipt');
const rng=s=>()=>((s=(Math.imul(1664525,s)+1013904223)>>>0)/4294967296),near=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<tol,`${a} vs ${b}`),key='hippodrome-cabinet-3';
function store(raw=null){return {raw,writes:0,getItem(k){assert.equal(k,key);return this.raw;},setItem(k,v){assert.equal(k,key);this.raw=v;this.writes++;}};}
function newCourseSplits(run){return [1,2,3,4].map(lap=>{const d=lap===4?C.raceDistance:lap,x=d/C.raceDistance*P.COUNT,i=Math.floor(x);return i>=P.COUNT?run.t[P.COUNT]:run.t[i]+(run.t[i+1]-run.t[i])*(x-i);});}

test('first load runs until every horse has five finishes; all 252 named starts, forecasts, crossings and form snapshots come from those heats',()=>{
 const r=rng(42),disk=store(),draw=D.draw,count=B.count,seen=[],records=[];B.count=(book,rec)=>{records.push(rec);return count(book,rec);};let liveRolls=0,g;
 D.draw=function(field,rolls,stretch){const result=draw(field,rolls,stretch);seen.push({names:field.map(h=>h.name),chance:D.forecast(field),runs:result.runs,rhythm:P.rhythms[result.rhythm]});return result;};
 try{g=E.createMachine({storage:disk,random:()=>{liveRolls++;return r()}});}finally{D.draw=draw;B.count=count;}
 const s=g.state;assert.equal(liveRolls,6,'warm-ups do not spend today’s form rolls');assert.equal(seen.length,42);assert.equal(disk.writes,1);assert.deepEqual(JSON.parse(disk.raw),s);
 assert.deepEqual([s.raceNo,s.phase,s.clock,g.remaining(),s.balance,g.stake(),s.payout,s.history.length],[43,'betting',0,60,500,0,0,40]);assert.deepEqual(s.bets,[]);assert.deepEqual(s.order,[]);assert.ok(s.runners.every(h=>!h.atStart&&!h.run));
 assert.deepEqual(s.history,records.slice(-40).reverse());const past=new Map(),prior=new Map();const entry=(name,s)=>{assert.equal(s.sprintSpeed+s.pace,165);assert.ok([s.fitness,s.startStamina].every(n=>Number.isInteger(n)&&n>=80&&n<=100));const prev=prior.get(name);if(prev){assert.equal(s.sprintSpeed,prev.sprintSpeed);assert.equal(s.pace,prev.pace);assert.notEqual(s.fitness,prev.fitness);assert.notEqual(s.startStamina,prev.startStamina);}prior.set(name,s);};for(const [idx,rec] of records.entries()){
   const d=seen[idx];assert.equal(rec.raceNo,idx+1);assert.equal(rec.source,'warmup');assert.deepEqual([rec.bets,rec.stake,rec.return],[[],0,0]);assert.equal(rec.at,undefined,'no invented wall-clock play time');assert.equal(rec.rhythm,d.rhythm);assert.equal(new Set(d.names).size,6);assert.deepEqual(rec.field.map(h=>h.name),d.names);
   assert.deepEqual(rec.order,d.runs.map((_,i)=>i+1).sort((a,b)=>d.runs[a-1].t[64]-d.runs[b-1].t[64]||a-b));assert.match(R.view(rec,s),/Simulated warm-up/);assert.ok(!R.view(rec,s).includes('Betting results'));
   for(const h of rec.field){const a=h.atStart,n=h.num,i=n-1,old=past.get(h.name)||[];assert.equal(a.winPct,d.chance[i]);assert.ok(P.validRatings(a.stats));entry(h.name,a.stats);assert.deepEqual(h.splits,newCourseSplits(d.runs[i]));assert.deepEqual(h.energy,[0,16,32,48,64].map(sector=>d.runs[i].fuel[sector]));assert.equal(h.finish,h.splits[3]);
     assert.equal(a.station.starts,old.length);assert.equal(a.station.wins,old.filter(f=>f.place===1).length);assert.deepEqual(a.station.recent,old.slice(-5).reverse());old.push({race:rec.raceNo,place:rec.order.indexOf(n)+1,seconds:h.finish,source:'warmup'});past.set(h.name,old);assert.equal(h.stationAfter.starts,old.length);assert.equal(h.stationAfter.wins,old.filter(f=>f.place===1).length);assert.ok(I.archived(rec,n).warmup);
   }
 }
 for(const h of s.runners)entry(h.name,h.stats);assert.equal(past.size,50);const starts=Array.from(past.values(),v=>v.length);assert.equal(starts.reduce((a,b)=>a+b),252);assert.equal(starts.filter(n=>n===5).length,48);assert.equal(starts.filter(n=>n===6).length,2);assert.deepEqual(B.rebuild(records.slice().reverse()),s.studBook);
});

test('balanced scheduling guarantees roster coverage even with extreme seeds, distinct horses and varied fields',()=>{
 const roster=Array.from({length:50},(_,i)=>`H${i}`),schedules=[];for(let k=0;k<100;k++){const r=rng(k),field=Array.from({length:6},()=>({seed:k<2?k*6:r()*Math.PI*2})),counts=new Map(roster.map(n=>[n,0])),first=[];M.stage(roster,field,n=>counts.get(n),(no,names)=>{assert.equal(names.length,6);assert.equal(new Set(names).size,6);for(const n of names)counts.set(n,counts.get(n)+1);if(no===1)first.push(names.join('/'));});assert.deepEqual([...new Set(counts.values())].sort(),[5,6]);schedules.push(first[0]);}assert.ok(new Set(schedules).size>90);
});

test('complete saves never seed again; a partial paid checkpoint gains only earlier real qualifying positions',()=>{
 const disk=store(),g=E.createMachine({storage:disk,random:rng(9)}),saved=structuredClone(g.state),stop=()=>{throw Error('No live draw while loading a checkpoint')},load=()=>E.createMachine({storage:disk,random:stop});assert.deepEqual(load().state,saved);assert.equal(disk.writes,1);
 g.place('win',[3],15);g.close();g.tick(53);const old=structuredClone(g.state);old.history=old.history.slice(-8);old.studBook=B.rebuild(old.history);const name=old.history[0].field[0].name;delete old.studBook[name];disk.raw=JSON.stringify(old);
 const known=B.rebuild(old.history),records=[],count=B.count;B.count=(book,r)=>{records.push(r);return count(book,r);};let s;try{s=load().state;}finally{B.count=count;}
 assert.deepEqual({...s,studBook:old.studBook},old);assert.equal(Object.keys(s.studBook).length,50);assert.ok(records.length>0&&records.length<42);
 for(const [n,e] of Object.entries(s.studBook)){const prev=known[n]||B.entry(),q=records.filter(r=>r.field.some(h=>h.name===n));assert.equal(e.starts,prev.starts+q.length);assert.equal(e.wins,prev.wins+q.filter(r=>r.field.find(h=>h.num===r.order[0]).name===n).length);assert.equal(e.recent.length,5);assert.deepEqual(e.recent.slice(0,prev.recent.length),prev.recent);
   for(const f of e.recent.slice(prev.recent.length)){const r=records[f.race-1],h=r.field.find(h=>h.name===n);assert.equal(f.source,'qualifier');assert.equal(f.place,r.order.indexOf(h.num)+1);assert.equal(f.seconds,h.finish);}}
 const writes=disk.writes;assert.deepEqual(load().state,s);assert.equal(writes,disk.writes);
 // Even a station at R001 with no book gets genuine earlier starts. The Q
 // numbers must not prevent the next numbered receipt from counting.
 disk.raw=JSON.stringify({...saved,raceNo:1,history:[],studBook:{}});const first=load();assert.equal(first.state.raceNo,1);assert.equal(first.state.history.length,0);const h=first.state.runners[0],pre=first.state.studBook[h.name].starts;first.close();const resumed=E.createMachine({storage:disk,random:rng(4)});resumed.tick(10);resumed.tick(200);const e=resumed.state.studBook[h.name];assert.equal(e.starts,pre+1);assert.equal(e.recent[0].race,1);assert.equal(e.recent[0].source,undefined);assert.equal(e.recent[1].source,'qualifier');
});

test('all six lanes retain their surveyed width; both photo edges use the same long-course reframe and the old service lens is local to the new wire',()=>{
 near(2*C.former.B,.5964);near(2*C.broad.B,.852);near(2*C.B,6*1.5*C.teamWidth);near(C.rails.outerRadius,(C.broad.outerRadius-C.railB)*C.turnScale+C.railB);near(C.outerRadius,C.rails.outerRadius-C.shoulder);near(C.innerRadius,C.outerRadius-6*C.laneWidth);near(C.sixteen.length,11.312097529965522);near(C.length,C.sixteen.length+2*Math.PI*(C.R-C.sixteen.R));near(G.B,C.B);const gap=2*C.B/6;
 for(let k=0;k<=256;k++){const t=k/256,[x0,z0]=C.path(t,0),[x1,z1]=C.path(t,1);near(Math.hypot(x1-x0,z1-z0),2*C.B);const a=C.photo(t,0),b=C.photo(t,1),c=C.reference(t,C.activeOuter-C.widthFactor),d=C.reference(t,C.activeOuter);near(b.x,C.sideX(d.x));near(b.y,d.y);near(a.x,C.sideX(c.x));near(a.y,c.y);
   for(let i=0;i<6;i++){const l=(i+.5)/6,q=C.path(t,l),p=K.path(t,l);near(C.run(t,l)[0]-C.startX,p[0]);near(C.run(t,l)[1]-C.R,p[2]);near(Math.hypot(q[0]-x0,q[1]-z0),(i+.5)*gap);}}
 const bounds=[K.project([G.FRONT,G.TOP+.02,G.B+.01]),K.project([G.FRONT,G.TOP+.02,-G.B-.01])];near(bounds[0].y,bounds[1].y);near(bounds[0].x+bounds[1].x,K.cam.w);assert.ok(bounds[0].x>0&&bounds[1].x<K.cam.w);
});

test('lap one starts on the shared start/finish line; four full circuits end there',()=>{
 near(C.startX,C.wireX-.25*C.straight);near(C.finishX,C.startX);near(C.finishT,C.startT);near(C.legacyStartToFinish+C.startT,1);near(C.raceDistance,4);near(C.legacyRaceDistance,3+C.legacyStartToFinish);near(((C.startT+C.raceDistance)%1),C.finishT);
 const [x,z]=C.path(C.startT,.5);near(x,C.startX);near(z,C.R);near(K.path(C.startT,.5)[0],0);const g=E.createMachine({random:()=>.13});assert.equal(g.state.courseStartLaw,2);g.close();g.tick(10);for(const h of g.state.runners){g.state.clock=0;near(g.pos(h),C.startT);assert.equal(g.lap(h),1);const first=g.crossing(h,1);g.state.clock=first-1e-5;assert.equal(g.lap(h),1);g.state.clock=first;near(g.pos(h),C.finishT);near(C.run(g.pos(h),h.lane)[0],C.finishX);assert.equal(g.lap(h),2);g.state.clock=h.finish;near(g.pos(h),C.finishT);near(C.run(g.pos(h),h.lane)[0],C.finishX);assert.equal(g.lap(h),4);near(g.crossing(h,4),h.finish);}
});

test('the closer seat magnifies scene and hit targets by 1.5× about the same gaze axis at every aspect ratio',()=>{
 const d=Math.PI/180;for(const [w,h] of [[900,450],[812,375],[320,568],[390,210]])for(const [x,y] of [[575,380],[208,356],[942,355],[576,486]]){const a=S.angles(x,y),fr=S.frame(a.yaw,a.pitch,w,h),old={...fr,f:Math.max(w/(2*Math.tan(39*d)),h/(2*Math.tan(34*d)))};near(fr.f/old.f,1.5);const mid=S.screenPoint(fr,x,y);near(mid.x,w/2);near(mid.y,h/2);const p=S.screenPoint(fr,x+9,y-7),q=S.screenPoint(old,x+9,y-7);near(p.x-mid.x,1.5*(q.x-mid.x));near(p.y-mid.y,1.5*(q.y-mid.y));const hit=S.pick(fr,p.x,p.y);near(hit.x,x+9);near(hit.y,y-7);}
});
