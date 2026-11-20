/* Local medal machine. Race draws are independent of tickets. Times and open tickets
   are checkpointed together, so reopening the cabinet cannot debit a bet twice. */
(function(root){
'use strict';
const marshal=root.AscotMarshal||(typeof module!=='undefined'?require('./marshal'):null),C=root.AscotCourse||(typeof module!=='undefined'?require('./course'):null);
const math=root.HippoBetMath,KEY='hippodrome-cabinet-3',LAPS=4,OPEN=marshal.OPEN,RESULT=24,RACE_STRETCH=3.35;
const perf=root.AscotPerformance||(typeof module!=='undefined'&&module.exports?require('./race-performance.js'):null);
const day=root.RaceDay||(typeof module!=='undefined'?require('./race-day'):null),stud=root.StudBook||(typeof module!=='undefined'?require('./stud-book'):null);
const meet=root.OpeningMeet||(typeof module!=='undefined'?require('./opening-meet'):null);
const NAMES=['Silver Birch','Nightwatch','Susy Spitfire','Waregem Flyer','Golden Spur','Leie Runner','Gaverbeek','Northern Lace','Karreweg King','Barons Court','Vlaamse Leeuw','Copper Beech','Tierney’s Ghost','Post Road','Marble Arch','Zonnebloem','Bleu d’Argent','Slate & Gold','Harbour Light','Witte Donderdag','Gallant Hour','Sablon','Two Rivers','Iron Duke','Halve Maan','Pale Rider','Kortrijk Lad','Dampoort','Little Fathom','Ypres Blue','Sunday Best','Bruges Rain','Cardinal Sin','Third Lantern','Old Bailey','Scheldt Star','Quiet Money','Raven’s Wing','Lace Curtain','Saltmarsh','Diksmuide','Winter Count','Last Post','Beaufort','Perpetual','Hazel Nut','Tram 4','Black Velvet','Ostend Pier','Final Bell'];
const STYLES=['Front runner','Strong finisher','Pace setter','Late closer','All-rounder','Steady pacer'];
const COLORS=['#e5dfcf','#b0a8a4','#d26b59','#638dbd','#d6b35b','#6eaa89'];
const TITLES=['The Crown Stakes','The Flemish Cup','The Emerald Mile','The Silver Derby','The Heritage Cup','The Grand Circuit'];
const mod=a=>((a%1)+1)%1,clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
// Before clock-based drain there was no law tag on an issued card. It is
// still a booked field, even if the player saved before placing a ticket.
const runLaw=heat=>heat.runLaw??heat.energyLaw??2;
function createMachine({storage=null,random=Math.random}={}){
 let state,changed=()=>{};const r=random;let saveAt=0;
 function assignForm(h,no,station=state){const entry=station.studBook[h.name];let last=entry?.lastRatings;
   // A legacy stud book had no lastRatings. Recover a known start from
   // its saved receipt; never rewrite that receipt or change the old field.
   if(!last&&entry)for(const rec of station.history){last=rec.field.find(x=>x.name===h.name)?.atStart?.stats;if(last)break;}
   h.stats=perf.raceRatings(h.name,h.style,no,h.seed,last);}
 function card(no,{opening=false,names,roll=r,station=state}={}){names=names||(opening?NAMES.slice(0,6):meet.shuffle(NAMES,roll).slice(0,6));const w=opening?[.285,.151,.184,.135,.108,.137]:names.map(()=>.6+roll()*1.6);let sum=w.reduce((a,b)=>a+b,0);let runners=names.map((name,i)=>({num:i+1,name,p:w[i]/sum,style:STYLES[NAMES.indexOf(name)%STYLES.length],seed:roll()*Math.PI*2,lane:(i+.5)/6}));// The book sees only the original market weights. Ratings consume no field RNG.
 let prices=math.medalBoard(runners);runners.forEach((h,i)=>{h.winOdds=prices.winOdds[i];h.showOdds=prices.showOdds[i];if(!opening)assignForm(h,no,station);});return {edition:2,courseStartLaw:2,filmStock:17,runLaw:perf.RUN_LAW,energyLaw:perf.ENERGY_LAW,formMode:perf.FORM_MODE,rhythm:null,racePace:RACE_STRETCH,raceNo:no,title:TITLES[opening?0:(no-1)%TITLES.length],runners,qPrices:prices.qPrices,phase:'betting',openSeconds:OPEN,clock:0,bets:[],order:[],payout:0,gate:marshal.LOCK,gateHold:marshal.HOLD,boxCall:false,settled:false};}
 function valid(s){return s&&s.v===3&&Number.isFinite(s.balance)&&s.balance<=Number.MAX_SAFE_INTEGER&&s.balance>=0&&Number.isInteger(s.raceNo)&&s.raceNo>0&&Array.isArray(s.runners)&&s.runners.length===6&&s.runners.every((h,i)=>h.num===i+1&&NAMES.includes(h.name)&&h.p>0&&h.winOdds>=2&&h.showOdds>=2&&Number.isFinite(h.seed))&&['betting','gates','race','result'].includes(s.phase)&&Number.isFinite(s.clock)&&s.clock>=0&&Array.isArray(s.history)&&Array.isArray(s.bets)&&s.bets.every(b=>Number.isSafeInteger(b.stake)&&b.stake>0&&['win','show','quinella'].includes(b.market)&&b.nums.every(n=>Number.isInteger(n)&&n>0&&n<7));}
 try{const saved=JSON.parse(storage?.getItem(KEY)||'null');if(valid(saved))state=saved;}catch(e){}
 // Translate progress on the old 80-second paddock clock just once. This
 // preserves the parade position and leaves every already-posted price alone.
 const retimed=!!state&&state.phase==='betting'&&state.openSeconds!==OPEN;
 if(retimed){state.clock=OPEN*clamp(state.clock/(state.openSeconds>0?state.openSeconds:80),0,1);state.openSeconds=OPEN;}
 // Preserve distance, ticket odds and the drawn order when resuming an older fast race.
 if(state&&state.racePace!==RACE_STRETCH){if(state.phase==='race'){const f=RACE_STRETCH/(state.racePace||1);state.clock*=f;state.runners.forEach(h=>{h.finish*=f;if(perf.validRun(h.run))perf.rescaleClock(h.run,f);});}state.racePace=RACE_STRETCH;}
 // A paid-for race already on the track has a contract: retain its old curve,
 // order and tickets. Only undrawn legacy fields acquire ratings at load time.
 if(state){for(const h of state.runners){
   if(state.phase==='betting'||state.phase==='gates'){
     if(state.edition!==2||!perf.validRatings(h.stats)){h.style=STYLES[NAMES.indexOf(h.name)%STYLES.length];h.stats=perf.ratings(h.name,h.style,runLaw(state));}
   }else if(h.run&&!perf.validRun(h.run)){delete h.run;}
 }}
 if(state&&['betting','gates'].includes(state.phase))state.edition=2;
 // An older station may have real tickets, historical receipts and a paid
 // race already on the track. Never insert races into that numbered series.
 // Run missing pre-season qualifiers on a separate ledger, then append only
 // older positions behind the saved form; the active race stays byte-identical.
 const fresh=!state;
 if(fresh)state={v:3,balance:500,history:[],studBook:{},sound:false,...card(1,{opening:true})};
 let repaired=false;
 if(!fresh&&(NAMES.some(n=>(state.studBook?.[n]?.recent?.length||0)<meet.DEPTH)||state.history.some(r=>r.field.some(h=>!h.stationAfter)))){
   const known=stud.rebuild(state.history,true);if(!state.studBook){state.studBook=known;repaired=true;}else repaired=stud.recover(state.studBook,known);
 }
 const ledger=fresh?state:{studBook:{},history:[]},depth=(book,n)=>book[n]?.recent?.length||0;
 const staged=meet.stage(NAMES,state.runners,n=>depth(state.studBook,n)+(fresh?0:depth(ledger.studBook,n)),(no,names,roll)=>{
   const heat=card(no,{names,roll,station:ledger});drawHeat(heat,roll,day.forecast(heat.runners,runLaw(heat),RACE_STRETCH),ledger);
   archive(heat,[],{source:'warmup'},ledger);
 });
 if(fresh){state.raceNo=staged+1;for(const h of state.runners)assignForm(h,state.raceNo);}
 else if(staged)stud.addQualifiers(state.studBook,ledger.studBook);
 // Do not reissue an already printed field, even if its ticket tray is
 // empty. Existing editions switch rating rules on their next new card.
 if(fresh||staged||repaired||retimed)save();
 function save(){try{storage?.setItem(KEY,JSON.stringify(state))}catch{}saveAt=0;}
 function emit(t){save();changed(t)}
 function quote(heat,m,nums){if(m==='quinella')return nums.length===2?heat.qPrices[math.pairKey(...nums)]:0;let h=heat.runners[nums[0]-1];return h?(m==='win'?h.winOdds:h.showOdds):0;}
 function odds(m,nums){return quote(state,m,nums);}
 function stake(){return state.bets.reduce((s,b)=>s+b.stake,0)}
 function place(m,nums,amount){if(state.phase!=='betting')return 'Betting has closed for this race.';if(!['win','show','quinella'].includes(m)||!Array.isArray(nums)||nums.some(n=>!Number.isInteger(n)||n<1||n>6))return 'Choose a runner.';if((m!=='quinella'&&nums.length!==1)||(m==='quinella'&&(nums.length!==2||nums[0]===nums[1])))return 'Choose two different runners.';const check=math.validateStake(amount,state.balance);if(!check.ok)return state.balance<amount?'Not enough medals for this stake.':check.error;let picks=nums.slice().sort((a,b)=>a-b);let existing=state.bets.find(b=>b.market===m&&b.nums.join()===picks.join());if(!existing&&state.bets.length>=6)return 'Six selections are open. Remove a ticket to add another.';if(existing)existing.stake+=amount;else state.bets.push({market:m,nums:picks,stake:amount,odds:odds(m,picks)});state.balance-=amount;emit('bet');return null;}
 function cancel(i){if(state.phase!=='betting'||!state.bets[i])return false;state.balance+=state.bets[i].stake;state.bets.splice(i,1);emit('bet');return true;}
 function parade(h,clock=state.clock){return mod(marshal.paddock(h,clock,state.filmStock??0));}
 function distance(h,sec=state.clock){if(h.run)return perf.sectorAt(h.run,sec)/perf.PER_LAP;const u=clamp(sec/h.finish,0,1),wave=Math.sin(Math.PI*u)*(.014*Math.sin(u*Math.PI*3.5+h.seed)+.006*Math.sin(u*8+h.num));return LAPS*clamp(u+wave,0,1);}
 function courseLength(heat=state){return heat.courseStartLaw===1?C.legacyRaceDistance:heat.courseStartLaw>=2?C.raceDistance:LAPS;}
 function courseDistance(h,sec=state.clock){return distance(h,sec)/LAPS*courseLength(state);}
 function courseAt(h,sec=state.clock){const origin=state.courseStartLaw?C.startT:0;if(state.phase==='betting')return origin+parade(h,sec);if(state.phase==='gates')return origin+marshal.approach(state,h);if(state.phase==='race')return sec<h.finish?origin+courseDistance(h,sec):origin+courseLength(state)+.024*(1-Math.exp(-.7*(sec-h.finish)/RACE_STRETCH));const end=Math.max(...state.runners.map(x=>x.finish))+.38,after=.024*(1-Math.exp(-.7*(end-h.finish+state.clock)/RACE_STRETCH))+Math.min(state.clock,7)*.0048;return origin+courseLength(state)+after;}
 function posAt(h,sec=state.clock){return mod(courseAt(h,sec));}
 function pos(h){return posAt(h,state.clock);}
 function lap(h,sec=state.clock){if(!state.courseStartLaw)return Math.min(LAPS,Math.floor(distance(h,sec))+1);const d=courseDistance(h,sec);if(state.courseStartLaw>=2)return Math.min(LAPS,Math.floor(Math.max(0,d+1e-8))+1);const first=C.legacyStartToFinish;if(d<first-1e-8)return 0;return Math.min(LAPS,1+Math.floor(Math.max(0,d-first-1e-8)+1e-8));}
 function close(){if(state.phase!=='betting')return;state.runners.forEach(h=>h.gateFrom=parade(h));state.phase='gates';state.clock=0;state.gate=marshal.LOCK;state.gateHold=marshal.HOLD;state.boxCall=false;emit('gates');}
 let forecastKey='',percentages=null;
 function forecast(){if(state.phase==='race'||state.phase==='result')return state.runners.every(h=>Number.isFinite(h.atStart?.winPct))?state.runners.map(h=>h.atStart.winPct):null;const key=state.raceNo+':'+runLaw(state)+':'+state.runners.map(h=>[h.name,h.style,h.seed,h.p,...perf.FIELDS.map(f=>h.stats?.[f.key])].join('|')).join('/');if(key!==forecastKey){percentages=state.runners.every(h=>perf.validRatings(h.stats))?day.forecast(state.runners,runLaw(state),RACE_STRETCH):null;forecastKey=key;}return percentages;}
 // Warm-ups and paid races use exactly the same timing curves, tie-breaker
 // and pre-draw snapshots. Only a live race changes phase or opens a cashier.
 function drawHeat(heat,roll,predicted,station=state){
   for(const [i,h] of heat.runners.entries())h.atStart={style:h.style,stats:{...h.stats},winOdds:h.winOdds,showOdds:h.showOdds,winPct:predicted[i],station:stud.copy(stud.get(station,h.name))};
   const {rhythm,runs}=day.draw(heat.runners,Array.from({length:12},roll),RACE_STRETCH,runLaw(heat));
   heat.runners.forEach((h,i)=>{h.run=runs[i];h.finish=h.run.t[perf.COUNT];});
   heat.rhythm=perf.rhythms[rhythm];heat.order=heat.runners.slice().sort((a,b)=>a.finish-b.finish||a.num-b.num).map(h=>h.num);
 }
 function go(){drawHeat(state,r,forecast());state.phase='race';state.clock=0;emit('race');}
 function crossing(h,lap,heat=state){
   if(h.run&&heat.courseStartLaw){const route=courseLength(heat),first=heat.courseStartLaw===1?C.legacyStartToFinish:1,target=lap===LAPS?route:first+lap-1,x=Math.min(perf.COUNT,target/route*perf.COUNT),i=Math.floor(x);if(i>=perf.COUNT)return h.finish;return h.run.t[i]+(h.run.t[i+1]-h.run.t[i])*(x-i);}
   if(h.run)return h.run.t[lap*perf.PER_LAP];
   if(lap===LAPS)return h.finish;
   // Match the original recorder for pre-ratings races already on the track.
   let lo=0,hi=h.finish;for(let i=0;i<24;i++){const t=(lo+hi)/2;if(distance(h,t)<lap)lo=t;else hi=t;}return hi;
 }
 function raceRecord(h,heat=state){
   const out={num:h.num,name:h.name,finish:h.finish,splits:[1,2,3,4].map(lap=>crossing(h,lap,heat))};
   if(h.run){out.stats={...(h.atStart?.stats||h.stats)};out.energy=h.run.fuel.filter((_,i)=>i%perf.PER_LAP===0);if(h.run.fitness)out.fitness=h.run.fitness.filter((_,i)=>i%perf.PER_LAP===0);}
   if(h.atStart)out.atStart=JSON.parse(JSON.stringify(h.atStart));
   else if(h.run&&perf.validRatings(h.stats))out.atStart={style:h.style,stats:{...h.stats},winOdds:h.winOdds,showOdds:h.showOdds}; // Known legacy contract; no retrospective forecast.
   const firstSprint=perf.intervals(h.run)[0];if(firstSprint)out.sprintAt=h.run.t[firstSprint[0]];
   if(h.run?.drive?.windows)out.sprints=h.run.drive.windows.map(([a,b])=>[h.run.t[a],h.run.t[b]]);
   return out;
 }
 function archive(heat,tickets,origin,station=state){
   const [a,b]=heat.order,rec={...origin,courseStartLaw:heat.courseStartLaw||0,raceNo:heat.raceNo,title:heat.title,order:heat.order.slice(),winningPrices:{win:quote(heat,'win',[a]),show:quote(heat,'show',[b]),quinella:quote(heat,'quinella',[a,b])},...(heat.rhythm?{rhythm:heat.rhythm}:{}),field:heat.runners.map(h=>raceRecord(h,heat)),stake:tickets.reduce((n,t)=>n+t.stake,0),return:heat.payout,bets:tickets};
   if(heat.runners.every(h=>h.run)){const at=heat.runners[a-1].finish;rec.photo={courseStartLaw:heat.courseStartLaw||0,v:(heat.filmStock===17||heat.filmStock===16||heat.filmStock===15||heat.filmStock===14||heat.filmStock===13||heat.filmStock===12||heat.filmStock===11)&&runLaw(heat)>=10?heat.filmStock:runLaw(heat)>=10?10:runLaw(heat)>=8?9:runLaw(heat)>=7?8:runLaw(heat)>=4?7:6,at,field:heat.runners.map(h=>({num:h.num,lane:h.lane,seed:h.seed,distance:(heat.courseStartLaw?C.startT:0)+perf.sectorAt(h.run,at)/perf.COUNT*courseLength(heat),travelled:perf.sectorAt(h.run,at)/perf.COUNT*courseLength(heat)}))};}
   stud.count(station.studBook,rec);for(const h of rec.field){const e=station.studBook[h.name];h.stationAfter={wins:e.wins,starts:e.starts};}
   station.history.unshift(rec);if(station.history.length>40)station.history.length=40;
 }
 function settle(){if(state.settled)return;state.settled=true;
   // Settle the ACTUAL crossings at each accepted ticket's locked gross price.
   // The pricing model and the live ratings are never rerun at the cashier.
   const [winner,second]=state.order,tickets=state.bets.map(b=>{
     const hit=b.market==='win'?b.nums[0]===winner:b.market==='show'?b.nums[0]===second:b.nums.includes(winner)&&b.nums.includes(second);
     const quote=Number.isFinite(b.odds)?b.odds:odds(b.market,b.nums);
     return {...b,odds:quote,names:b.nums.map(n=>state.runners[n-1].name),returned:hit?math.gross(b.stake,quote):0};
   });
   state.payout=Math.round(tickets.reduce((sum,b)=>sum+b.returned,0)*100)/100;state.balance=Math.round((state.balance+state.payout)*100)/100;
   archive(state,tickets,{at:Date.now()});state.phase='result';state.clock=0;emit('result');}
 function next(){if(state.phase!=='result')return;Object.assign(state,card(state.raceNo+1));emit('new');}
 function tick(dt){if(!Number.isFinite(dt)||dt<=0)return;
   // Cross exact starter edges even on a dropped frame. Checkpoint and emit
   // once at each boundary; carry overshoot into the next phase's clock.
   if(state.phase==='betting'&&state.clock+dt>=OPEN){dt=state.clock+dt-OPEN;state.clock=OPEN;close();if(!dt)return;}
   if(state.phase==='gates'){
     const end=state.clock+dt,edge=marshal.load(state);
     if(state.gateHold===marshal.HOLD&&!state.boxCall&&end>=edge){state.clock=edge;state.boxCall=true;emit('boxed');}
     if(end>=state.gate){dt=end-state.gate;go();if(!dt)return;}
     else {state.clock=end;saveAt+=dt;if(saveAt>=3)save();return;}
   }
   state.clock+=dt;saveAt+=dt;
   if(state.phase==='race'&&state.clock>=Math.max(...state.runners.map(h=>h.finish))+.38)settle();
   else if(state.phase==='result'&&state.clock>=RESULT)next();else if(saveAt>=3)save();
 }
 function positions(){if(state.phase==='result')return state.order.slice();if(state.phase!=='race')return state.runners.map(h=>h.num);return state.runners.slice().sort((a,b)=>distance(b)-distance(a)||(state.clock>=Math.max(a.finish,b.finish)?a.finish-b.finish:0)||a.num-b.num).map(h=>h.num)}
 function refill(){if(state.balance>=5||state.bets.length||state.phase!=='betting')return false;state.balance=500;emit('refill');return true;}
 function hydrate(snapshot){if(!snapshot||!Array.isArray(snapshot.runners))return false;const fresh=JSON.parse(JSON.stringify(snapshot));for(const k of Object.keys(state))if(!(k in fresh))delete state[k];Object.assign(state,fresh);forecastKey='';return true;}
 return {get state(){return state},set onChange(f){changed=f},runners:()=>state.runners,save,tick,place,cancel,close,next,pos,posAt,courseAt,courseDistance,lap,odds,stake,positions,distance,crossing,forecast,sprint:(h,t=state.clock)=>perf.driveAt(h.run,t),fitness:(h,t=state.clock)=>perf.fitnessAt(h.run,t),reserve:(h,t=state.clock)=>h.run?perf.reserveAt(h.run,t):null,refill,hydrate,remaining(){return Math.max(0,(state.phase==='betting'?OPEN:state.phase==='gates'?state.gate:state.phase==='result'?RESULT:Math.max(...state.runners.map(h=>h.finish)))-state.clock)},toggleSound(){state.sound=!state.sound;emit('sound');return state.sound}};
}
const api={names:Object.freeze(NAMES.slice()),createMachine,LAPS,OPEN,RESULT,RACE_STRETCH,COLORS,STYLES};root.AscotEngine=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
