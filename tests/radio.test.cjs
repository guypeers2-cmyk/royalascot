'use strict';const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
require('../js/bet-math');const E=require('../js/engine'),D=require('../js/race-day'),P=require('../js/race-performance'),C=require('../js/course'),book=require('../js/radio-book'),R=require('../js/race-radio'),B=require('../js/live-book');
const rng=s=>()=>((s=Math.imul(s,1664525)+1013904223>>>0)/4294967296),near=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,`${a} != ${b}`);
test('136 distinct eligible templates, 50 named runner recordings and six numbered fallback cues',()=>{
 assert.equal(book.lines.length,136);assert.equal(new Set(book.lines.map(x=>x[1])).size,136);assert.equal(new Set(book.lines.map(x=>x[0])).size,24);assert.equal(E.names.length,50);assert.equal(book.clips.length,book.lines.length+E.names.length+6);assert.equal(book.clips.filter(v=>v[2]===1).length,36);
 for(const [bank,file] of book.files.entries()){
   const cues=book.clips.filter(v=>(v[2]||0)===bank).sort((a,b)=>a[0]-b[0]);assert.ok(cues.length);
   for(const [i,[offset,duration]] of cues.entries()){assert.ok(duration>.1&&duration<7);if(i)assert.ok(cues[i-1][0]+cues[i-1][1]<offset-.03);}
   const raw=fs.readFileSync(require.resolve('../assets/'+file));assert.equal(raw.toString('ascii',0,4),'OggS');assert.ok(raw.indexOf('OpusHead')>=0);
 }
 R.levels.forEach((l,i)=>{if(i){assert.ok(l.rate>R.levels[i-1].rate);assert.ok(l.gain>R.levels[i-1].gain);}});
});
test('lap one starts at the shared start line; the first post call begins lap two without leaking future observations',()=>{
 const g=E.createMachine({random:rng(1)}),seen=new Set(),expected=new Set(book.lines.map((_,i)=>i));for(let heat=0;heat<350;heat++){
   g.close();g.tick(10);let now=0;const real=g.state.runners,order=t=>real.slice().sort((a,b)=>g.distance(b,t)-g.distance(a,t)||a.num-b.num);
   const field=real.map(({name,seed,num})=>({name,seed,num})),allowed=t=>assert.ok(t<=now+1e-9,'future observation'),facade={state:{raceNo:g.state.raceNo,runners:field,courseStartLaw:g.state.courseStartLaw},distance(h,t){allowed(t);return g.distance(real[h.num-1],t);},sprint(h,t){allowed(t);return g.sprint(real[h.num-1],t);},crossing(h,lap){const t=g.crossing(real[h.num-1],lap);allowed(t);return t;}};
   const radio=R.create(facade),first=Math.min(...real.map(h=>h.finish));for(now=0;now<first;now+=1.83)assert.ok(radio.read(now).every(e=>e.at<=now&&e.kind!=='wire'));now=first;assert.equal(radio.read(now)[0].kind,'wire');
   const once=R.create(g);once.read(first+2);assert.deepEqual(radio.history.map(e=>[e.id,e.n,e.kind]),once.history.map(e=>[e.id,e.n,e.kind]),'frame-rate dependent call');
   assert.equal(new Set(radio.history.map(e=>e.id)).size,radio.history.length);let bell=[];let prev=null;
   for(const e of radio.history){const o=order(e.at),gap=g.distance(o[0],e.at)-g.distance(o[1],e.at),d=g.distance(o[0],e.at),f=g.state.courseStartLaw?((C.startT+d/4*C.raceDistance)%1+1)%1:d%1;if(e.id<0)assert.fail('lap one must begin at the shared start line, not be delayed to the post');
     seen.add(e.id);const [kind,tpl]=book.lines[e.id],role=tpl.match(/\{(.)\}/)?.[1];assert.equal(e.kind,kind);assert.ok(!prev||e.at>=prev.at);
     if(role){assert.equal(e.line,tpl.replace(/\{.\}/,real[e.n-1].name));const n={L:0,S:1,T:2,F:3,Z:5}[role];if(n!==undefined)assert.equal(e.n,o[n].num);}
     if(kind==='lap2')near(e.at,Math.min(...real.map(h=>g.crossing(h,g.state.courseStartLaw>=2?1:2))));if(kind==='lap3'&&g.state.courseStartLaw>=2)near(e.at,Math.min(...real.map(h=>g.crossing(h,2))));if(kind==='bell')near(e.at,Math.min(...real.map(h=>g.crossing(h,3))));if(kind==='bell')bell=o;
     if(kind==='home')near(d,g.state.courseStartLaw===1?4*(3+C.stops[3]-C.startT)/C.legacyRaceDistance:g.state.courseStartLaw>=2?3+C.stops[3]:3+C.stops[3],1e-6);if(e.level===5)assert.ok(d>=(g.state.courseStartLaw===1?4*(3+C.stops[3]-C.startT)/C.legacyRaceDistance:3+C.stops[3])-1e-8);if(kind==='wire'){assert.equal(e.at,first);assert.equal(e.n,g.state.order[0]);}
     if(kind==='bend')assert.ok(f<C.stops[1]||(f>=C.stops[2]&&f<C.stops[3]));if(kind==='sprint')assert.equal(g.sprint(real[e.n-1],e.at),'active');
     if(['gap','free','clear'].includes(kind))assert.ok(gap>.034);if(['duel','tight'].includes(kind))assert.ok(gap<=.013);
     if(kind==='rally'){const b=bell.findIndex(h=>h.num===e.n),k=o.findIndex(h=>h.num===e.n);assert.ok(b>=3&&k<=2&&b-k>=2);}
     if(kind==='change')assert.notEqual(order(prev.at)[0].num,e.n);if(kind==='gain')assert.ok(order(prev.at).findIndex(h=>h.num===e.n)>o.findIndex(h=>h.num===e.n));prev=e;
   }
   g.tick(200);g.next();if(seen.size===expected.size)break;
 }assert.deepEqual([...seen].sort((a,b)=>a-b),[...expected].sort((a,b)=>a-b));
});
test('legacy radio keeps its original lap-two, lap-three and bell crossing calls',()=>{
 const g=E.createMachine({random:rng(87)});g.close();g.tick(10);let now=0;const real=g.state.runners,field=real.map(({name,seed,num})=>({name,seed,num})),legacy={...g.state,courseStartLaw:0},facade={state:{raceNo:g.state.raceNo,runners:field,courseStartLaw:0},distance(h,t){assert.ok(t<=now+1e-9);return g.distance(real[h.num-1],t);},sprint(h,t){return g.sprint(real[h.num-1],t);},crossing(h,lap){const t=g.crossing(real[h.num-1],lap,legacy);assert.ok(t<=now+1e-9);return t;}};const radio=R.create(facade),end=Math.min(...real.map(h=>h.finish));for(now=0;now<end;now+=.5)radio.read(now);for(const [kind,lap] of [['lap2',1],['lap3',2],['bell',3]])near(radio.history.find(e=>e.kind===kind).at,Math.min(...real.map(h=>g.crossing(h,lap,legacy))));
});
test('complete ordered forecast: same gate draws, exact-second marginals and reciprocal pairs, no influence on bets, price or RNG',()=>{
 let draws=0;const next=rng(17),g=E.createMachine({random:()=>{draws++;return next();}}),field=g.state.runners;g.place('quinella',[2,1],20);const state=JSON.stringify(g.state),start=draws,book=B.create(field),gate=book.estimate(0),ref=new Float64Array(36),roll=rng(D.forecastSeed(field));
 for(let i=0;i<D.TRIALS;i++){const {runs}=D.draw(field,Array.from({length:12},roll),E.RACE_STRETCH),o=[0,1,2,3,4,5].sort((a,b)=>runs[a].t[64]-runs[b].t[64]||a-b);ref[o[0]*6+o[1]]+=1/D.TRIALS;}
 assert.deepEqual(gate,ref);assert.equal(draws,start);assert.equal(JSON.stringify(g.state),state);assert.equal(g.state.bets[0].odds,12);
 let sum=[0,0,0];for(let i=1;i<=6;i++){const q=(m,ns)=>B.chance(gate,{market:m,nums:ns}).p;sum[0]+=q('win',[i]);sum[1]+=q('show',[i]);for(let j=i+1;j<=6;j++){sum[2]+=q('quinella',[i,j]);near(q('quinella',[i,j]),q('quinella',[j,i]));}}
 sum.forEach(p=>near(p,1));const slip={market:'quinella',nums:[3,6]},p=B.chance(gate,slip).p;assert.notEqual(p,B.chance(gate,{market:'win',nums:[3]}).p*B.chance(gate,{market:'win',nums:[6]}).p);
});
test('held-out draws: at the run-in the whole-ticket estimates beat the gate Brier score for all three markets',()=>{
 const g=E.createMachine({random:rng(479)}),field=g.state.runners,model=B.create(field),gate=model.estimate(0),roll=rng(18393),score=[[0,0,0],[0,0,0]];
 for(let i=0;i<96;i++){const {runs,rhythm}=D.draw(field,Array.from({length:12},roll),E.RACE_STRETCH),o=[0,1,2,3,4,5].sort((a,b)=>runs[a].t[64]-runs[b].t[64]),t=runs[o[0]].t[64]-3,ds=runs.map(r=>P.sectorAt(r,t)/16),live=model.estimate(t,ds,[],rhythm);near(live.reduce((a,b)=>a+b),1);
   [gate,live].forEach((m,j)=>{for(let n=1;n<=6;n++){const q=(market,nums,hit,k)=>score[j][k]+=(B.chance(m,{market,nums}).p-Number(hit))**2;q('win',[n],n===o[0]+1,0);q('show',[n],n===o[1]+1,1);for(let b=n+1;b<=6;b++)q('quinella',[n,b],[o[0]+1,o[1]+1].every(v=>v===n||v===b),2);}});
 }for(let k=0;k<3;k++)assert.ok(score[1][k]<score[0][k]*.92);
});
test('ticket decisions use confirmed places only, including all outcomes at one and two crossings',()=>{
 const model=B.create(Array.from({length:6},(_,i)=>({num:i+1,p:1/6}))),ds=[4,3.99,3.8,3.4,3.6,3.3];for(const places of [[],[1],[1,2]]){
   const m=model.estimate(133,ds,places);near(m.reduce((a,b)=>a+b),1);const q=(market,nums)=>B.chance(m,{market,nums},places);
   assert.equal(q('win',[1]).known,places.length?true:null);assert.equal(q('win',[3]).known,places.length?false:null);assert.equal(q('show',[1]).known,places.length?false:null);assert.equal(q('show',[2]).known,places.length===2?true:null);
   assert.equal(q('quinella',[2,1]).known,places.length===2?true:null);assert.equal(q('quinella',[5,6]).known,places.length?false:null);assert.equal(q('quinella',[1,3]).known,places.length===2?false:null);
   assert.equal(B.label(q('win',[1]))==='100%',!!places.length);
 }assert.equal(B.label({p:0,known:null}),'<0.1%');assert.equal(B.label({p:1,known:null}),'>99.9%');
});
