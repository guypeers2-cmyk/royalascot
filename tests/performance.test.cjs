'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const math=require('../js/bet-math.js'),P=require('../js/race-performance.js'),{createMachine}=require('../js/engine.js');
const rng=seed=>()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const machine=n=>createMachine({random:rng(n)}),start=g=>{g.close();g.tick(10)},finish=g=>g.tick(g.remaining()+.5);
const book=g=>({runners:g.state.runners.map(h=>[h.name,h.p,h.winOdds,h.showOdds]),pairs:{...g.state.qPrices}});
const stats=(fitness,startStamina,sprintSpeed,pace)=>({fitness,startStamina,sprintSpeed,pace});

test('all 50 horses keep style-based sprint and pace across cloths and stations; fitness and starting stamina both change every start',()=>{
 const g=machine(17),known=new Map(),cloths=new Map();for(let round=0;round<160;round++){
   for(const h of g.state.runners){assert.ok(P.validRatings(h.stats));const previous=known.get(h.name);if(previous){assert.equal(h.style,previous[0]);for(const k of ['sprintSpeed','pace'])assert.equal(h.stats[k],previous[1][k]);for(const k of ['fitness','startStamina'])assert.notEqual(h.stats[k],previous[1][k]);}assert.ok([h.stats.fitness,h.stats.startStamina].every(n=>Number.isInteger(n)&&n>=80&&n<=100));assert.equal(h.stats.sprintSpeed+h.stats.pace,165);if(!cloths.has(h.name))cloths.set(h.name,new Set());cloths.get(h.name).add(h.num);known.set(h.name,[h.style,{...h.stats}]);assert.equal(h.run,undefined);}
   start(g);finish(g);g.next();
 }assert.equal(known.size,50);assert.ok([...cloths.values()].every(nums=>nums.size>1));const other=machine(307).state.studBook,skills=new Map();for(const [name,[style,a]] of known){assert.equal(a.sprintSpeed,other[name].lastRatings.sprintSpeed);assert.equal(a.pace,other[name].lastRatings.pace);if(!skills.has(style))skills.set(style,new Set());skills.get(style).add(a.sprintSpeed);}assert.ok([...skills.values()].every(values=>values.size>1),'there is individuality within each style');assert.ok(Math.max(...skills.get('Pace setter'))<Math.min(...skills.get('Steady pacer')));for(const style of ['Strong finisher','Late closer'])assert.ok(Math.min(...skills.get(style))>Math.max(...skills.get('Front runner')));assert.ok([...skills.get('All-rounder')].every(v=>Math.abs(v-82.5)<=3.5));
 // Before today's tempo and form, identical neutral ability gives all legal
 // named builds the same reference time averaged over the four rhythms.
 for(const [style,ratings] of known.values()){let sum=0;const samples=16,balanced={...ratings,fitness:90,startStamina:90};
   for(let j=0;j<samples;j++)for(let i=0;i<4;i++)sum+=P.run(balanced,134,i,2*Math.PI*j/samples,style).t.at(-1);const avg=sum/(4*samples);assert.ok(Math.abs(avg-134*(56+4/.75)/60)<.001,`${style}: ${avg} reference seconds`);}
});

test('each rating changes its intended part of a race, with a real cost for spending the budget differently',()=>{
 const sim=(s,r)=>P.run(s,134,r,2),lap=(r,k)=>r.t[k*P.PER_LAP],finalLap=r=>lap(r,4)-lap(r,3);
 const startHigh=sim(stats(90,100,80,80),0),startLow=sim(stats(90,80,80,80),0);
 assert.equal(startHigh.fuel[0],100);assert.equal(startLow.fuel[0],80);assert.ok(startHigh.t[8]<startLow.t[8]-.5,'stronger break');
 const fitHigh=sim(stats(100,90,80,80),1),fitLow=sim(stats(80,90,80,80),1);assert.ok(Math.abs(P.reserveAt(fitHigh,80)-P.reserveAt(fitLow,80))<1e-7,'same initial energy and elapsed saving seconds');assert.equal(fitHigh.t[8],fitLow.t[8],'FIT is not a flat speed multiplier at the gate');
 for(const [a,b] of [[40,48],[56,64]])assert.ok(fitHigh.t[b]-fitHigh.t[a]<fitLow.t[b]-fitLow.t[a],'more FIT sustains real speed in both late cruise and active sprint');assert.ok(finalLap(fitHigh)<finalLap(fitLow));
 const live=fit=>P.effectiveStats(fit,55);for(const key of ['pace','sprintSpeed'])assert.equal(live(stats(80,90,80,80))[key],live(stats(100,90,80,80))[key]);
 const fastPace=stats(90,90,60,100),fastKick=stats(90,90,100,60),cruise=sim(fastPace,2),patient=sim(fastKick,2);
 assert.ok(lap(cruise,3)-lap(cruise,1)<lap(patient,3)-lap(patient,1)-1);assert.ok(cruise.fuel[4]-cruise.fuel[48]<patient.fuel[4]-patient.fuel[48],'fewer seconds saving after the first sprint and before the bell');
 const drive=sim(fastKick,3),other=sim(fastPace,3);assert.ok(finalLap(drive)<finalLap(other)-1,'the final kick is faster');assert.ok(cruise.t.at(-1)<patient.t.at(-1)&&drive.t.at(-1)<other.t.at(-1),'different balanced builds win different rhythms');
 for(const r of [startHigh,startLow,fitHigh,fitLow,cruise,patient,drive,other]){assert.ok(P.validRun(r));for(let i=0;i<=P.COUNT;i++){assert.equal(P.sectorAt(r,r.t[i]),i);assert.equal(P.reserveAt(r,r.t[i]),r.fuel[i]);}}
});

test('swapping only two legal builds changes the actual winner and settlement, never the fixed Win, Show or Quinella prices',()=>{
 const a=machine(132),b=machine(132),before=book(a);assert.deepEqual(before,book(b));
 for(const g of [a,b]){assert.equal(g.place('win',[4],10),null);assert.equal(g.place('show',[1],5),null);assert.equal(g.place('quinella',[1,4],10),null);}
 const locked=structuredClone(a.state.bets),r=b.state.runners;[r[0].stats,r[3].stats]=[r[3].stats,r[0].stats];
 assert.deepEqual(math.priceField(a.state.runners,92,1),math.priceField(b.state.runners,92,1));assert.deepEqual(a.state.bets,b.state.bets);
 for(const g of [a,b])start(g);assert.equal(a.state.rhythm,b.state.rhythm);assert.deepEqual(a.state.order.slice(0,2),[4,1]);assert.deepEqual(b.state.order.slice(0,2),[1,2]);
 for(const g of [a,b]){assert.deepEqual(book(g),before);assert.deepEqual(g.state.bets,locked);const atLine=g.state.runners.slice().sort((x,y)=>x.run.t.at(-1)-y.run.t.at(-1)).map(h=>h.num);assert.deepEqual(g.state.order,atLine);finish(g);assert.deepEqual(g.state.history[0].order,atLine);}
 const paid=locked.reduce((tot,t)=>tot+t.odds*t.stake,0);assert.equal(a.state.balance,475+paid);assert.equal(b.state.balance,475);assert.deepEqual(a.state.history[0].bets.map(t=>t.odds),b.state.history[0].bets.map(t=>t.odds));
 a.next();b.next();assert.deepEqual(book(a),book(b),'even the next card uses the same market RNG');
});

test('the presence, number and size of wagers do not change any rhythm, reserve, crossing or finish',()=>{
 for(let i=0;i<16;i++){const a=machine(i),b=machine(i);b.place('win',[5],50);b.place('quinella',[1,6],25);start(a);start(b);assert.equal(a.state.rhythm,b.state.rhythm);assert.deepEqual(a.state.runners,b.state.runners);assert.deepEqual(a.state.order,b.state.order);}
});

test('reload reproduces positions, reserve and splits exactly; old paid tickets and active results are not redrawn',()=>{
 let data=JSON.stringify(require('./fixtures/pre-ratings-betting.json'));const storage={getItem:()=>data,setItem:(_,v)=>data=v};const a=createMachine({storage,random:rng(25)});const quotes=book(a);assert.equal(a.state.balance,490);assert.equal(a.state.runners.every(h=>P.validRatings(h.stats)),true);start(a);a.tick(35);a.save();
 const b=createMachine({storage,random:()=>{throw Error('A stored heat must not be drawn again')}});assert.deepEqual(book(b),quotes);assert.deepEqual(a.state.order,b.state.order);assert.deepEqual(a.state.rhythm,b.state.rhythm);
 for(let j=0;j<6;j++){const h=a.state.runners[j],k=b.state.runners[j];assert.equal(a.distance(h),b.distance(k));assert.equal(a.reserve(h),b.reserve(k));assert.deepEqual(h.run,k.run);}
 finish(a);finish(b);const r=b.state.history[0];assert.equal(r.rhythm,b.state.rhythm);assert.deepEqual(r.field,a.state.history[0].field);assert.equal(a.state.balance,b.state.balance);for(const h of r.field){assert.deepEqual(h.stats,b.state.runners[h.num-1].stats);assert.equal(h.energy[0],h.stats.startStamina);assert.equal(h.energy.length,5);assert.equal(h.splits[3],h.finish);}
 const legacy=require('./fixtures/pre-ratings-race.json');let old=JSON.stringify(legacy);const c=createMachine({storage:{getItem:()=>old,setItem:(_,v)=>old=v},random:()=>{throw Error('No redraw')}});assert.deepEqual(c.state.order,legacy.order);assert.equal(c.reserve(c.state.runners[0]),null);finish(c);assert.equal(c.state.balance,520);assert.ok(c.state.history[0].field.every(h=>!('stats' in h)&&!('energy' in h)));
});


test('new board shortens favourites and lengthens outsiders without changing field weights or live standings',()=>{
 const old=require('./fixtures/pre-ratings-betting.json'),g=machine(3),calls=require('../js/race-calls.js');
 assert.deepEqual(g.state.runners.map(h=>[h.name,h.p]),old.runners.map(h=>[h.name,h.p]));
 const winRank=g.state.runners.slice().sort((a,b)=>b.p-a.p);for(let i=1;i<winRank.length;i++)assert.ok(winRank[i-1].winOdds<=winRank[i].winOdds);const showRank=g.state.runners.map((h,i)=>({p:math.secondPlaceProbability(g.state.runners,i),odds:h.showOdds})).sort((a,b)=>b.p-a.p);for(let i=1;i<showRank.length;i++)assert.ok(showRank[i-1].odds<=showRank[i].odds);const pairRank=[];for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)pairRank.push({p:math.quinellaProbability(g.state.runners,i,j),odds:g.state.qPrices[`${i}-${j}`]});pairRank.sort((a,b)=>b.p-a.p);for(let i=1;i<pairRank.length;i++)assert.ok(pairRank[i-1].odds<=pairRank[i].odds);assert.equal(Object.keys(g.state.qPrices).length,15);start(g);
 assert.deepEqual(g.positions(),[1,2,3,4,5,6]);assert.notEqual(g.state.order[0],1);const at=calls.coverage(g),r=g.state.runners;
 const lap3=Math.min(...r.map(h=>g.crossing(h,3))),lead=r.find(h=>g.crossing(h,3)===lap3),event=at(lap3)[0];assert.equal(event.at,lap3);assert.equal(event.kind,'lap');assert.equal(event.line,lead.name+' leads into the final lap with '+Math.round(lead.run.fuel[48])+'% stamina left.');
 assert.ok(!at(lap3-.01).some(e=>e.at===lap3));g.state.clock=Math.max(...r.map(h=>h.finish));assert.deepEqual(g.positions(),g.state.order);
});

test('remaining reserve conditions all four usable figures, not the four figures printed at the gate',()=>{
 const s=Object.freeze(stats(84,68,87,61)),start=Object.freeze({...s});assert.deepEqual(P.effectiveStats(s,100),s);
 for(const {key} of P.FIELDS){let last=Infinity;for(const energy of [100,80,60,40,20,0]){const n=P.effectiveStats(s,energy)[key];assert.ok(n<last&&n>=s[key]*.75,`${key} at ${energy}%`);last=n;}}
 assert.deepEqual(s,start);const intel=require('../js/runner-intel'),g=machine(45);g.close();g.tick(10);const h=g.state.runners[3],atGate={...h.stats},a=intel.read(g,4);g.tick(77);const b=intel.read(g,4);assert.deepEqual(b.stats,atGate);for(const {key} of P.FIELDS)assert.ok(a.usable[key]>b.usable[key]);assert.match(intel.figures(b),/Current live ratings/);assert.ok(intel.figures(b).includes(`data-rating="${Math.round(b.usable.pace)}"`));finish(g);const past=intel.archived(g.state.history[0],4);assert.deepEqual(past.stats,atGate);assert.ok(!past.usable);assert.match(intel.figures(past),/at the start/);
});
// Independent integral over elapsed time, not per-sector fuel differences.
function expectedReserve(r,t){const elapsed=Math.max(0,Math.min(r.t.at(-1),t));let sprint=0;
 for(const [a,b] of r.drive.windows)sprint+=Math.max(0,Math.min(elapsed,r.t[b])-r.t[a]);
 return Math.max(0,r.fuel[0]-(r.drive.sprintRate??P.styleSprintDrain(r.drive.style,r.runLaw??3))*sprint-.025*(elapsed-sprint));}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
test('all six styles use calibrated sprint budgets, 0.025 saving drain, launch, intervals and exact rescaled energy integrals',()=>{
 assert.equal(P.SPRINT_DRAIN,3);assert.equal(P.SAVING_DRAIN,.025);let ranDry=0,afterLast=0;
 for(const style of ['Front runner','Strong finisher','All-rounder','Late closer','Pace setter','Steady pacer'])for(let k=0;k<4;k++){
   const s=P.ratings('Clock test',style),r=P.run(k===3?{...s,fitness:90,startStamina:80}:s,k===3?340:130+2*k,k,1.25,style);assert.ok(P.validRun(r));assert.equal(r.energyLaw,P.ENERGY_LAW);
   for(const t of [-12,0,r.t.at(-1),r.t.at(-1)+30])near(P.reserveAt(r,t),expectedReserve(r,t));
   for(let i=0;i<64;i++){const a=r.t[i],b=r.t[i+1],mode=P.driveAt(r,(a+b)/2),rate=mode==='active'?r.drive.sprintRate:.025;
     near(r.fuel[i+1],expectedReserve(r,b));near(r.fuel[i+1],Math.max(0,r.fuel[i]-(b-a)*rate));
     for(const fraction of [0,.07,.5,.97]){const t=a+fraction*(b-a);near(P.reserveAt(r,t),expectedReserve(r,t));}
     if(mode==='spent'&&r.fuel[i+1]>0)afterLast++;
     if(r.fuel[i]>.03&&r.fuel[i+1]===0){const empty=a+r.fuel[i]/rate;if(empty<b-.01){near(P.reserveAt(r,empty-.01),rate*.01);near(P.reserveAt(r,empty),0);near(P.reserveAt(r,(b+empty)/2),0);ranDry++;}}
   }
   // A final common clock correction must debit on the stored, corrected times.
   P.rescaleClock(r,1.05);for(let i=1;i<=64;i++){near(r.fuel[i],expectedReserve(r,r.t[i]));const t=(r.t[i]+r.t[i-1])/2;near(P.reserveAt(r,t),expectedReserve(r,t));}
 }assert.ok(ranDry&&afterLast,'exercise both mid-sector exhaustion and saving after the last sprint');
});
test('release and individual finish bound the energy clock; irregular frames, reload and settlement use the same reserve',()=>{
 let raw;const storage={getItem:()=>raw,setItem:(_,v)=>raw=v},g=createMachine({storage,random:()=>.13});const starts=g.state.runners.map(h=>h.stats.startStamina);
 g.close();g.tick(9.75);assert.ok(g.state.runners.every(h=>!h.run));g.tick(.25);assert.equal(g.state.clock,0);assert.deepEqual(g.state.runners.map(h=>g.reserve(h)),starts);
 g.tick(1);for(const h of g.state.runners.slice(0,2))near(g.reserve(h),h.stats.startStamina-h.run.drive.sprintRate);g.tick(6.375);g.save();
 const saved=createMachine({storage,random:()=>{throw Error('no redraw')}}),first=g.state.runners[g.state.order[0]-1].finish;
 for(const to of [20,50,74.375,105,first+.02]){let dt=to-g.state.clock;g.tick(dt);while(dt>1.75){saved.tick(1.75);dt-=1.75;}saved.tick(dt);
   for(const h of g.state.runners){const q=saved.state.runners[h.num-1],expected=expectedReserve(h.run,to);near(g.reserve(h),expected);near(saved.reserve(q),expected);}}
 for(const m of [g,saved])finish(m);const rec=g.state.history[0];assert.deepEqual(saved.state.history[0].field,rec.field);
 for(const f of rec.field){const r=g.state.runners[f.num-1].run;for(let lap=0;lap<=4;lap++)near(f.energy[lap],expectedReserve(r,r.t[16*lap]));}
});
test('the independent pre-draw forecast finds the same winners as 2,048 full-duration races, not a rescaled short run',()=>{
 const D=require('../js/race-day'),field=machine(71).state.runners;let seed=2166136261;
 for(const c of field.map(h=>[h.name,h.style,h.p,h.seed,...P.FIELDS.map(f=>h.stats[f.key])].join('|')).join('/'))seed=Math.imul(seed^c.charCodeAt(0),16777619)>>>0;
 const rand=rng(seed),wins=field.map(()=>0);for(let i=0;i<D.TRIALS;i++){const {runs}=D.draw(field,Array.from({length:12},rand),3.35),ends=runs.map(r=>r.t.at(-1));wins[ends.indexOf(Math.min(...ends))]++;}
 const parts=wins.map(n=>1000*n/D.TRIALS),whole=parts.map(Math.floor),ranks=parts.map((n,i)=>[i,n-whole[i]]).sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
 const left=1000-whole.reduce((a,b)=>a+b,0);for(let i=0;i<left;i++)whole[ranks[i][0]]++;assert.deepEqual(D.forecast(field),whole.map(n=>n/10));
});

test('booked pre-clock fields keep the six previous sprint schedules, full time/fuel curves and in-sector readings',()=>{
 // Golden digest recorded from b7a5d24, not computed by the new planner.
 const old=['Front runner','Strong finisher','Pace setter','Late closer','All-rounder','Steady pacer'].map((style,i)=>{const r=P.run(P.ratings('Checkpoint',style,true),131+i,i%4,.35+i*.44,style,2);return [r,[7.3,49.125,110,145].map(t=>[P.reserveAt(r,t),P.driveAt(r,t)])];});
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(old)).digest('hex'),'8b7862ba40370bbc14ba0ea70c9e2772fd6f7918a01db9a85351bf549cace2a3');
});
test('new sprints travel at three quarters of the preceding actual speed, not three quarters of the bonus or printed skill',()=>{
 const g=machine(31),gains=[],relative=[];assert.equal(g.state.runLaw,P.RUN_LAW);assert.equal(P.SPRINT_SPEED_FACTOR,.75);assert.ok(g.state.runners.some(h=>h.stats.sprintSpeed===100));assert.ok(g.state.runners.some(h=>h.stats.pace===100));
 for(const h of g.state.runners)for(let k=0;k<4;k++)for(const sec of [128,135,141]){const args=[h.stats,sec,k,h.seed,h.style],old=P.run(...args,5),r=P.run(...args,6),dt=(run,i)=>run.t[i+1]-run.t[i];assert.deepEqual(P.intervals(r),P.intervals(old));
   for(const [a,b] of P.intervals(r)){if(a)gains.push(dt(r,a-1)/dt(r,a));if(b<P.COUNT)gains.push(dt(r,b)/dt(r,b-1));for(let i=a;i<b;i++)relative.push(dt(old,i)/dt(r,i));if(!a)assert.ok(Math.abs(dt(old,0)/dt(r,0)-.75)<.000002,'exact same gate energy: real distance/second is down 25%');}}
 // Later reserves can differ under the new drain law. Measure equal-distance
 // sector travel on both curves, including every style’s last move.
 assert.ok(relative.every(v=>v>.735&&v<.765));assert.ok(gains.every(v=>v>1.15&&v<1.8));assert.ok(Math.abs(gains.reduce((a,b)=>a+b)/gains.length-1.5)<.10);
});
test('gate cards from fb06bcf still use the original elapsed drain AND the original actual sprint speed',()=>{
 const fixed=['Front runner','Strong finisher','Pace setter','Late closer','All-rounder','Steady pacer'].map((style,i)=>{const r=P.run(P.ratings('Checkpoint',style,true),131+i,i%4,.35+i*.44,style,3);return [r,[7.3,49.125,110,145].map(t=>[P.reserveAt(r,t),P.driveAt(r,t)])];});assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(fixed)).digest('hex'),'994056549ce95a21f609f2520af63de8246fd9abb16eea03249a1c655cecc402');
});

test('independent 80–100 gate condition spans both endpoints and every pair for the same named horse',()=>{
 const r=rng(5125),pairs=new Set,lo=80,hi=100,name='Waregem Flyer',style='Late closer';
 for(let i=0;i<12000;i++){const seed=r()*2*Math.PI,a=P.raceRatings(name,style,43,seed);assert.ok(P.validRatings(a));assert.ok(a.fitness>=lo&&a.fitness<=hi&&a.startStamina>=lo&&a.startStamina<=hi);assert.equal(a.sprintSpeed,100);pairs.add(a.fitness+':'+a.startStamina);
  if(i<200){const again=P.raceRatings(name,style,43,seed,{fitness:a.fitness,startStamina:0}),other=P.raceRatings(name,style,43,seed,{fitness:0,startStamina:a.startStamina});assert.notEqual(again.fitness,a.fitness);assert.equal(again.startStamina,a.startStamina);assert.equal(other.fitness,a.fitness);assert.notEqual(other.startStamina,a.startStamina);}}
 assert.equal(pairs.size,21*21);for(const key of ['80:80','80:100','100:80','100:100'])assert.ok(pairs.has(key));
});
test('48b5f64 cards keep their printed v4 figures, full time/fuel curves and 0.25 saving debit, including a rescaled clock',()=>{
 const fixed=['Front runner','Strong finisher','Pace setter','Late closer','All-rounder','Steady pacer'].map((style,i)=>{const s=P.ratings('Checkpoint',style,4),r=P.run(s,131+i,i%4,.35+i*.44,style,4),at=()=>[7.3,49.125,110,145].map(t=>[P.reserveAt(r,t),P.driveAt(r,t)]),first=[s,structuredClone(r),at()];P.rescaleClock(r,1.17);return [first,r,at()];});
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(fixed)).digest('hex'),'ee4ad82a67d24f0cafed770b4bfa2037f536123838a6157776c3b51d205bfaa3');
});

test('44f6d39 issued cards keep their exact fast sprints, 0.10 saving debit and in-sector readings, also after rescaling',()=>{
 const fixed=['Front runner','Strong finisher','Pace setter','Late closer','All-rounder','Steady pacer'].map((style,i)=>{const s=P.raceRatings('Checkpoint',style,49,.4+i*.74,null,5),r=P.run(s,131+i,i%4,.35+i*.44,style,5),at=()=>[7.3,49.125,110,145].map(t=>[P.reserveAt(r,t),P.driveAt(r,t)]),first=[s,structuredClone(r),at()];P.rescaleClock(r,1.17);return [first,r,at()];});
 assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(fixed)).digest('hex'),'cdd2cefc97519473651ab523938787968d121ae511746390b376c936fc940488');
});

test('current energy budgets balance all six running styles while retaining a close six-horse pack',()=>{
 const styles=['Front runner','Strong finisher','Pace setter','Late closer','All-rounder','Steady pacer'],reserves=new Map();
 for(const style of styles){let sum=0,n=0;for(let rhythm=0;rhythm<4;rhythm++)for(const phase of [.3,1.8,3.2,4.9]){const r=P.run({fitness:90,startStamina:90,sprintSpeed:83,pace:82},134,rhythm,phase,style);assert.equal(r.runLaw,P.RUN_LAW);assert.equal(r.energyLaw,P.ENERGY_LAW);assert.equal(r.drive.style,style);assert.ok(Number.isFinite(r.drive.sprintRate));sum+=r.fuel.at(-1);n++;}reserves.set(style,sum/n);}
 const means=[...reserves.values()];assert.ok(Math.min(...means)>=12&&Math.max(...means)<=36);assert.ok(Math.max(...means)-Math.min(...means)<=19,JSON.stringify(Object.fromEntries(reserves)));
 const g=machine(20261118),spreads=[];for(let heat=0;heat<32;heat++){g.close();g.tick(10);const times=g.state.runners.map(h=>h.finish).sort((a,b)=>a-b);spreads.push(times.at(-1)-times[0]);g.tick(g.remaining()+.01);g.next();}
 spreads.sort((a,b)=>a-b);assert.ok(spreads[16]<3.8);assert.ok(spreads[28]<4.5);assert.ok(spreads.at(-1)<5);
});
