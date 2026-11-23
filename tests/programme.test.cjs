'use strict';
const test=require('node:test'),assert=require('node:assert/strict');require('../js/bet-math');const {createMachine,RACE_STRETCH:S}=require('../js/engine'),P=require('../js/race-performance'),D=require('../js/race-day'),B=require('../js/stud-book'),I=require('../js/runner-intel'),K=require('../js/gate-feed'),G=require('../js/start-gate'),stride=require('../js/stride');
const rng=s=>()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296),near=(x,y,e=1e-8)=>assert.ok(Math.abs(x-y)<e,`${x} != ${y}`),restore=raw=>{let v=JSON.stringify(raw);return {getItem:()=>v,setItem:(_,n)=>v=n}},go=g=>{g.close();g.tick(10);},finish=g=>g.tick(g.remaining()+.5);

test('six pre-draw estimates sum to 100%, never spend a game roll, and remain the same after settlement or reload',()=>{
 let n=0;const g=createMachine({random:()=>{n++;return .13}}),f=g.state.runners,before=n,q=g.forecast().slice();assert.equal(n,before);near(q.reduce((a,b)=>a+b),100);assert.ok(q.every(x=>x>0&&x<100));assert.notDeepEqual(q,f.map(h=>Math.round(h.p*1000)/10));assert.deepEqual(q,D.forecast(f));g.place('win',[1],10);g.place('show',[3],10);assert.deepEqual(g.forecast(),q);go(g);assert.equal(n,before+12);assert.deepEqual(f.map(h=>h.atStart.winPct),q);const copies=structuredClone(f.map(h=>h.atStart));assert.ok(copies.every(a=>a.station.starts>=5&&a.station.starts<=6&&a.station.recent.length===5));
 // Even if the live panel object changes, never use it as the archive.
 f[0].stats.sprintSpeed+=1;finish(g);const r=g.state.history[0];assert.deepEqual(r.field.map(h=>h.atStart),copies);assert.deepEqual(r.field[0].stats,copies[0].stats);for(const h of r.field){const before=copies[h.num-1].station,n=h.num;assert.equal(h.stationAfter.starts,before.starts+1);assert.equal(h.stationAfter.wins,before.wins+(n===r.order[0]?1:0));assert.equal(I.read(g,n,r.raceNo).chance,q[n-1]);assert.equal(I.read(g,n,r.raceNo).station.wins,h.stationAfter.wins);}const re=createMachine({storage:restore(g.state)});re.next();re.state.runners[0].name='Changed name in today’s field';assert.deepEqual(I.read(re,1,r.raceNo),I.archived(r,1));assert.equal(I.read(re,1,90),null);
});

test('edition migration preserves the original live ratings, position, reserve, locked prices and payouts; no made-up historical forecasts or sprint intervals',()=>{
 const old=require('./fixtures/pre-programme-race.json'),done=require('./fixtures/pre-programme-result.json'),store=restore(old),g=createMachine({storage:store,random:()=>{throw Error('redraw')}}),scale=S/old.racePace;
 assert.equal(g.forecast(),null);assert.deepEqual(g.state.bets,old.bets);assert.deepEqual(g.state.qPrices,old.qPrices);assert.equal(g.state.balance,old.balance);assert.deepEqual(g.state.order,old.order);near(g.state.clock,old.clock*scale);
 for(const h of g.state.runners){const p=old.runners[h.num-1];assert.deepEqual(h.stats,p.stats);near(g.distance(h),P.sectorAt(p.run,old.clock)/16);near(g.reserve(h),P.reserveAt(p.run,old.clock));near(h.finish,p.finish*scale);assert.equal(g.sprint(h),null);}g.save();const re=createMachine({storage:store});assert.deepEqual(re.state,g.state);finish(re);assert.equal(re.state.balance,done.balance);assert.equal(re.state.payout,done.payout);for(const h of re.state.history[0].field){assert.deepEqual(h.atStart.stats,old.runners[h.num-1].stats);assert.equal(h.atStart.winPct,undefined);assert.equal(h.sprintAt,undefined);}
 const r=createMachine({storage:restore(done)});const pure=structuredClone(r.state.history);for(const rec of pure)for(const h of rec.field)delete h.stationAfter;assert.deepEqual(pure,done.history);assert.equal(I.rate(I.read(r,1,1).station),'100%');assert.equal(r.state.balance,done.balance);assert.deepEqual(r.state.runners.map(h=>h.finish),done.runners.map(h=>h.finish));assert.equal(r.forecast(),null);r.next();assert.ok(r.state.studBook['Silver Birch'].starts>=5);assert.equal(r.state.studBook['Silver Birch'].recent[0].race,1);assert.deepEqual(I.read(r,2,1).stats,done.history[0].field[1].stats);assert.equal(I.read(r,2,1).chance,undefined);
});

test('the six styles actually accelerate in their own sector windows: exact boundaries, repeat efforts and receipt timestamps',()=>{
 const g=createMachine({random:rng(8)});go(g);const fixed={'Front runner':[[0,8]],'Strong finisher':[[0,4],[48,64]],'Late closer':[[40,48],[56,64]],'All-rounder':[[24,28],[40,44]]};
 for(const h of g.state.runners){const r=h.run,w=P.intervals(r),dt=k=>r.t[k+1]-r.t[k];if(fixed[h.style])assert.deepEqual(w,fixed[h.style]);
   for(const [j,[a,b]] of w.entries()){assert.ok(a>=0&&a<b&&b<=64);if(a){assert.equal(g.sprint(h,r.t[a]-.00001),'saving');assert.ok(dt(a)<dt(a-1),'actually faster on entry: '+h.style);}assert.equal(g.sprint(h,r.t[a]),'active');assert.equal(g.sprint(h,r.t[b]-.00001),'active');assert.ok(r.fuel[a]>r.fuel[b]);
     assert.equal(g.sprint(h,r.t[b]),b===64?'finished':j+1<w.length?'saving':'spent');if(b<64)assert.ok(dt(b)>dt(b-1),'returns to cruising speed: '+h.style);}
   for(let k=0;k<64;k++)assert.equal(g.sprint(h,(r.t[k]+r.t[k+1])*.5)==='active',w.some(([a,b])=>a<=k&&b>k));assert.equal(g.sprint(h,r.t[64]),'finished');
 }finish(g);for(const h of g.state.history[0].field){const r=g.state.runners[h.num-1].run;assert.deepEqual(h.sprints,P.intervals(r).map(([a,b])=>[r.t[a],r.t[b]]));assert.equal(h.sprintAt,h.sprints[0][0]);}
});

test('pace setters can move on any lap; steady pacers can use every sector, in four separate, seeded bursts',()=>{
 for(const style of ['Pace setter','Steady pacer']){const sectors=new Set,plans=new Set;for(let n=0;n<512;n++){const w=P.sprintWindows(style,n*Math.PI/109,n%4);assert.deepEqual(w,P.sprintWindows(style,n*Math.PI/109,n%4));plans.add(JSON.stringify(w));assert.equal(w.length,style==='Pace setter'?1:4);let last=-1;
   w.forEach(([a,b],i)=>{assert.ok(a>last&&b>a&&b<=64);if(w.length===4){assert.equal(a>>4,i);assert.equal((b-1)>>4,i);}last=b;for(let k=a;k<b;k++)sectors.add(k);});}assert.equal(sectors.size,64);assert.ok(plans.size>50);}
});

test('a named horse keeps a real lifetime station record and only its own five newest finishes after old receipts expire',()=>{
 const g=createMachine({random:()=>.13}),counts=new Map(),prior=new Map();for(const [name,e] of Object.entries(g.state.studBook)){const last=e.recent.map(f=>f.place).reverse();counts.set(name,last);prior.set(name,{starts:e.starts-last.length,wins:e.wins-last.filter(p=>p===1).length});}for(let k=0;k<49;k++){go(g);for(const h of g.state.runners){const past=counts.get(h.name)||[];assert.equal(h.atStart.station.starts,prior.get(h.name).starts+past.length);assert.deepEqual(h.atStart.station.recent.map(r=>r.place),past.slice(-5).reverse());}finish(g);for(const h of g.state.runners){if(!counts.has(h.name))counts.set(h.name,[]);counts.get(h.name).push(g.state.order.indexOf(h.num)+1);}if(k!==48)g.next();}
 assert.equal(g.state.history.length,40);const re=createMachine({storage:restore(g.state)});for(const [name,results] of counts){const b=B.get(re.state,name);assert.equal(b.starts,prior.get(name).starts+results.length);assert.equal(b.wins,prior.get(name).wins+results.filter(x=>x===1).length);assert.deepEqual(b.recent.map(x=>x.place),results.slice(-5).reverse());}const before=structuredClone(re.state.studBook);B.count(re.state.studBook,re.state.history[0]);assert.deepEqual(before,re.state.studBook);
});

test('level start lens registers all six horses to their own stalls; parked horses do not gallop in place',()=>{
 const proj=(x,y,z)=>K.project([x,y,z]),top=proj(G.FRONT,G.TOP,-G.B);for(let i=0;i<7;i++){const p=proj(G.FRONT,G.TOP,-G.B+2*G.B*i/6);near(p.y,top.y);near(p.d,top.d);}const g=createMachine({random:()=>.13});g.close();g.tick(9.6);for(const h of g.state.runners){const q=K.path(g.pos(h),h.lane),pos=K.project(q),i=h.num-1;near(q[0],0);assert.ok(pos.x<proj(0,0,-G.B+2*G.B*i/6).x&&pos.x>proj(0,0,-G.B+2*G.B*(i+1)/6).x);near(stride.cycles(g,h),0);}const atGate=g.state.runners.map(h=>stride.theta(g,h));g.tick(.4);for(const h of g.state.runners)near(stride.theta(g,h),atGate[h.num-1]);assert.ok(new Set(atGate).size>3);const frames=new Set();for(let i=0;i<160;i++){g.tick(.02);frames.add(stride.frame(g,g.state.runners[0]));}assert.equal(frames.size,12);assert.equal(stride.A.angles,28);
});

test('randomised cards: every runner is still racing at 120 seconds and clock-to-line equals the last split',()=>{
 const g=createMachine({random:rng(911)});for(let k=0;k<180;k++){go(g);g.tick(119.999);assert.equal(g.state.phase,'race');assert.ok(g.state.runners.every(h=>h.finish>=120&&g.distance(h)<4));for(const h of g.state.runners){near(g.distance(h,h.finish),4);near(g.crossing(h,4),h.finish);}finish(g);g.next();}
});

test('one runner file shows the actual entry, named form and posted odds without inventing starts or a pair quote',()=>{
 const book=require('../js/runner-book'),g=createMachine({random:()=>.13}),s=structuredClone(g.state),h=s.runners[1];
 h.stats={fitness:85,startStamina:61,sprintSpeed:88,pace:66};s.studBook[h.name]={starts:0,wins:0,recent:[]};
 const empty=book.view(s,[2],2,'glass','win');assert.match(empty,/No starts on file/);assert.doesNotMatch(empty,/data-sheet=|<li title="(?:Warm-up|Race)/);for(const v of [85,61,88,66])assert.ok(empty.includes(`<strong>${v}</strong>`));
 s.studBook[h.name].recent=[{race:19,place:3,seconds:135.14,source:'warmup'},{race:9,place:1,seconds:124.3}];
 const before=JSON.stringify(s),p=g.odds('quinella',[2,4]),html=book.view(s,[2,4],2,'glass','quinella',p);assert.match(html,/Warm-up 019: 3rd/);assert.match(html,/Race 009: 1st/);assert.equal((html.match(/class="no-run"/g)||[]).length,3);assert.ok(html.includes(`<dt>Pair #2 + #4</dt><dd>${p}×</dd>`));assert.match(book.view(s,[2],2,'glass','quinella'),/<dt>Pair odds<\/dt><dd>—<\/dd>/);assert.equal(JSON.stringify(s),before);
});

test('an existing single-drive save, including an early exhaustion, retains its exact sectors and drive states; the next draw alone gets windows',()=>{
 const raw=JSON.parse(require('node:zlib').gunzipSync(require('node:fs').readFileSync(require('node:path').join(__dirname,'fixtures/pre-broad-race.json.gz')))),g=createMachine({storage:restore(raw),random:rng(37)});assert.equal(g.state.phase,'race');assert.deepEqual(g.state.runners,raw.runners);assert.deepEqual(g.state.bets,raw.bets);assert.ok(g.state.runners.some(h=>h.run.drive.to<64));
 for(const h of g.state.runners){const {from,to}=h.run.drive;assert.equal(h.run.drive.windows,undefined);for(let sector=0;sector<=64;sector++){const clock=h.run.t[sector];assert.equal(g.sprint(h,clock),sector===64?'finished':sector<from?'saving':sector<to?'active':'spent');near(g.distance(h,clock),sector/16);}}
 finish(g);assert.ok(g.state.history[0].field.every(h=>h.sprints===undefined));g.next();go(g);assert.ok(g.state.runners.every(h=>Array.isArray(h.run.drive.windows)));
});
