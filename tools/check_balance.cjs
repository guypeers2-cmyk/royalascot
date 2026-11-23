/* Fixed-seed calibration: identical field weights, six different profiles,
   equal exposures to all form draws and rhythms. Also run a neutral control. */
'use strict';
const dir=require('node:path').resolve(process.argv[2]||__dirname+'/../js');require(dir+'/bet-math');const P=require(dir+'/race-performance'),{createMachine,RACE_STRETCH:S}=require(dir+'/engine'),day=require(dir+'/race-day');
const station=createMachine({random:()=>.13}).state,gate=P.RUN_LAW>=5?90:75,runners=station.runners.map(h=>P.RUN_LAW>=5?{...h,stats:{...h.stats,fitness:gate,startStamina:gate}}:h),halfSkill=Math.floor((P.SKILL_TOTAL||150)/2),neutral={fitness:gate,startStamina:gate,sprintSpeed:halfSkill,pace:(P.SKILL_TOTAL||150)-halfSkill};
let seed=42017;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const groups=500,heats=6*4*groups,wins=P.rhythms.map(()=>Array(6).fill(0)),changed={winner:0,order:0};
const shape=runners.map(()=>({first:0,bell:0,line:0,led:0,gap:0,gained:0}));
const rank=v=>[0,1,2,3,4,5].sort((a,b)=>v[a]-v[b]||a-b);
for(let k=0;k<groups;k++){
  const slots=[0,1,2,3,4,5];for(let j=5;j>0;j--){const ix=Math.floor(random()*(j+1));[slots[ix],slots[j]]=[slots[j],slots[ix]];}
  let sec=(38.3+2.9*random())*S;const baseline=slots.map((_,i)=>{if(i)sec+=day.neutralGap(random(),S);return {sec,phase:random()*Math.PI*2};});
  for(let rhythm=0;rhythm<4;rhythm++)for(let shift=0;shift<6;shift++){
    const t=[],first=[],bell=[],ref=[];for(let i=0;i<6;i++){const h=slots[(i+shift)%6],b=baseline[i];const run=P.run(runners[h].stats,b.sec,rhythm,b.phase,runners[h].style);first[h]=run.t[16];bell[h]=run.t[48];t[h]=run.t[64];ref[h]=P.run(neutral,b.sec,rhythm,b.phase,runners[h].style).t.at(-1);}
    const one=rank(first),three=rank(bell),out=rank(t),control=rank(ref);
    const leader=shape[one[0]];leader.led++;leader.gap+=first[one[1]]-first[one[0]];
    shape.forEach((a,i)=>{const x=one.indexOf(i)+1,y=three.indexOf(i)+1,z=out.indexOf(i)+1;a.first+=x;a.bell+=y;a.line+=z;if(z<y)a.gained++;});wins[rhythm][out[0]]++;if(out[0]!==control[0])changed.winner++;if(out.join()!==control.join())changed.order++;
  }
}
const pct=(n,d)=>(100*n/d).toFixed(1)+'%';console.log(`${heats} paired races · matched neutral form · equal field weights · six opening profiles`);
const rows=runners.map((h,i)=>{const w=wins.reduce((n,r)=>n+r[i],0);if(w/heats<.13||w/heats>.21)throw Error(h.style+' outside balance band');return Object.fromEntries([['Style',h.style],['Overall',pct(w,heats)],...P.rhythms.map((n,k)=>[n,pct(wins[k][i],heats/4)])]);});console.table(rows);if(P.RUN_LAW>=12){for(const r of wins)for(const n of r)if(n/(heats/4)<.095||n/(heats/4)>.30)throw Error('Meeting rhythm decides too many or too few wins for one style');for(const i of [0,1,2,3,4,5]){const n=wins.reduce((v,r)=>v+r[i],0);if(n/heats<.15||n/heats>.185)throw Error('Unbalanced matched opening style');}}
console.log(`Compared with ${gate}/${gate}/${halfSkill}/${neutral.pace}: winner changed in ${pct(changed.winner,heats)}; full order in ${pct(changed.order,heats)}.`);if(changed.winner<.07*heats)throw Error('Ratings have too little influence');

console.table(shape.map((a,i)=>({Style:runners[i].style,'Lead after lap 1':pct(a.led,heats),'Mean rank L1':(a.first/heats).toFixed(2),'Mean rank at bell':(a.bell/heats).toFixed(2),'Mean finish rank':(a.line/heats).toFixed(2),'Gained on lap 4':pct(a.gained,heats),'Mean places gained L4':((a.bell-a.line)/heats).toFixed(2)})));
console.log(`Front runner’s mean lead when first through lap 1: ${(shape[0].gap/shape[0].led).toFixed(2)} s.`);
if(shape[0].led<.55*heats||shape[0].led>=.99*heats||shape[0].gap/shape[0].led<.3||[1,3].some(i=>shape[i].gained<.60*heats||shape[i].bell-shape[i].line<heats))throw Error('Opening lead or final-lap rally not visible in matched splits.');

// Unmatched, priced fields: use precisely the same race-day sampling and
// crossing function as the live cabinet, no wager and no special catch-up.
const sample=6000,placed=runners.map(()=>({wins:0,passed:0,deep:0}));let min=Infinity,max=-Infinity,frontLed=0;seed=42017;
for(let k=0;k<sample;k++){
 const field=runners.map(h=>{const seed=random()*2*Math.PI;h.stats=P.raceRatings(h.name,h.style,k+21,seed,h.stats);return {...h,seed};}),{runs}=day.draw(field,Array.from({length:12},random),S),order=at=>[0,1,2,3,4,5].sort((a,b)=>runs[a].t[at]-runs[b].t[at]);
 if(order(16)[0]===0)frontLed++;const w=order(64)[0],bell=order(48).indexOf(w),d=placed[w],time=runs[w].t[64];d.wins++;if(bell)d.passed++;if(bell>=3)d.deep++;min=Math.min(min,time);max=Math.max(max,time);
}
console.table(placed.map((d,i)=>({Runner:runners[i].name,Price:runners[i].winOdds+'×','Share of wins':pct(d.wins,sample),'Won after not leading into lap 4':d.passed,'Won after entering lap 4 in 4th–6th':d.deep})));
console.log(`${sample} opening-lineup fields with fresh race-day condition at their posted prices. First crossing: ${min.toFixed(2)}–${max.toFixed(2)} s (release to line).`);
console.log(`Front runner led lap 1 on ${pct(frontLed,sample)} of the real entry draws.`);
if(frontLed>=.99*sample||min<120||placed.some(d=>d.wins<sample*.075)||[1,3].some(i=>placed[i].deep<100))throw Error('Insufficient duration, outsider wins or genuine closing runs.');

// Repeat the matched experiment across the entire named roster, not just
// the six opening entries. One horse per style; rotate all six neutral slots
// in each rhythm. Every name meets every slot with the same day’s condition.
const namesByStyle=new Map(runners.map(h=>[h.style,new Map()]));for(const race of station.history)for(const h of race.field)namesByStyle.get(h.atStart.style).set(h.name,h.atStart.stats);
if([...namesByStyle.values()].reduce((n,a)=>n+a.size,0)!==50)throw Error('Incomplete named roster');
const families=[...namesByStyle.values()].map(a=>[...a.keys()].sort()),last=new Map(),byStyle=Array(6).fill(0),perHorse=new Map();seed=77117;
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
for(let k=0;k<groups;k++){
 const field=families.map((names,i)=>{if(k%names.length===0)shuffle(names);const name=names[k%names.length],style=runners[i].style,stats=P.raceRatings(name,style,k+43,random()*Math.PI*2,last.get(name));last.set(name,stats);return {name,style,stats};});
 let sec=(38.3+2.9*random())*S;const slots=field.map((_,i)=>{if(i)sec+=day.neutralGap(random(),S);return [sec,random()*2*Math.PI]});shuffle(slots); // Rotate shuffled slots, not a fixed circle of opponents.
 for(let rhythm=0;rhythm<4;rhythm++)for(let shift=0;shift<6;shift++){
   const ts=field.map((h,i)=>{const [t,phase]=slots[(i+shift)%6];return P.run(h.stats,t,rhythm,phase,h.style).t[P.COUNT];}),winner=rank(ts)[0];byStyle[winner]++;field.forEach((h,i)=>{const rec=perHorse.get(h.name)||[0,0];rec[0]++;if(i===winner)rec[1]++;perHorse.set(h.name,rec);});
 }
}
console.log(`${heats} further matched races · ${perHorse.size} horses · varying condition. `+byStyle.map((n,i)=>`${runners[i].style}: ${pct(n,heats)}`).join(' | '));
const fractions=[...perHorse.values()].map(([starts,won])=>won/starts);console.log(`Individual win shares: ${pct(Math.min(...fractions),1)}–${pct(Math.max(...fractions),1)}.`);
if(byStyle.some(n=>n/heats<.13||n/heats>.21)||fractions.some(p=>p<.10||p>.24))throw Error('Roster contains an out-of-band style or horse');
