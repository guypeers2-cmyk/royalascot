/* Form and the PRE-draw forecast share one handicap model. Forecast sampling
   has its own reproducible RNG; never use a ticket, today's rolls or outcome. */
(function(root){'use strict';const P=root.AscotPerformance||(typeof module!=='undefined'?require('./race-performance'):null),TRIALS=2048;
 function seedFor(field){let v=2166136261;for(const c of field.map(h=>[h.name,h.style,h.p,h.seed,...P.FIELDS.map(f=>h.stats[f.key])].join('|')).join('/'))v=Math.imul(v^c.charCodeAt(0),16777619)>>>0;return v;}
 const neutralGap=(roll,stretch)=>(.067+.178*roll)*stretch;
 const weights=field=>field.map(h=>.68*h.p+.32/field.length);
 // Write one weighted, without-replacement form draw into caller-owned buffers.
 // The real run and forecast share arithmetic, but never an RNG or outcome.
 function sample(w,rolls,stretch,pool,times){const n=w.length;for(let i=0;i<n;i++)pool[i]=i;
   let sec=(38.3+2.9*rolls[6])*stretch;for(let rank=0;rank<n;rank++){const left=n-rank;let sum=0;for(let k=0;k<left;k++)sum+=w[pool[k]];
     let hit=rolls[rank]*sum,j=0;while(j<left-1&&(hit-=w[pool[j]])>0)j++;if(rank)sec+=neutralGap(rolls[6+rank],stretch);times[pool[j]]=sec;
     for(let k=j;k<left-1;k++)pool[k]=pool[k+1];
   }return Math.min(3,Math.floor(4*rolls[5]));}
 function form(field,rolls,stretch){const times=[],rhythm=sample(weights(field),rolls,stretch,[],times);return {times,rhythm};}
 // Exactly the production crossing curves. One common scale preserves both
 // overtakes and finishing order while bounding the winner's wall-clock time.
 function draw(field,rolls,stretch,law=P.RUN_LAW){const {times,rhythm}=form(field,rolls,stretch),runs=field.map((h,i)=>P.run(h.stats,times[i],rhythm,h.seed,h.style,law)),first=Math.min(...runs.map(r=>r.t[P.COUNT])),scale=Math.max(37*stretch,Math.min(42*stretch,first))/first;
   if(scale!==1)for(const r of runs)P.rescaleClock(r,scale);return {rhythm,runs};}
 // A slower neutral clock never finishes earlier on the same plan: it
 // spends longer in each sector, so its reserve and usable speed cannot be
 // higher. Bound a trial using cached crossings; if bounds overlap, run the
 // actual stepper for the contenders. No rounded-bin or guessed winners.
 function reader(h,rhythm,law){const sim=P.prepareRun(h.stats,rhythm,h.seed,h.style,law),knots=new Map();return {sim,knot(k){if(!knots.has(k))knots.set(k,sim(k/8));return knots.get(k);}};}
 function forecast(field,law=P.RUN_LAW,stretch=3.35){let seed=seedFor(field);const rand=()=>((seed=(Math.imul(1664525,seed)+1013904223)>>>0)/4294967296),booked=law===2;
   const readers=field.map(h=>P.rhythms.map((_,k)=>booked?P.run(h.stats,100,k,h.seed,h.style,2).t.at(-1)/100:reader(h,k,law)));
   const wins=field.map(()=>0),w=weights(field),rolls=new Float64Array(12),pool=[],times=[],lo=[],possible=[];
   for(let i=0;i<TRIALS;i++){for(let k=0;k<12;k++)rolls[k]=rand();const rhythm=sample(w,rolls,booked?1:stretch,pool,times);let best=Infinity,win=0;
     if(booked){for(let j=0;j<times.length;j++){const at=times[j]*readers[j][rhythm];if(at<best){best=at;win=j;}}}
     else{possible.length=times.length;for(let j=0;j<times.length;j++)possible[j]=j;
       for(const stride of [8,1]){let upper=Infinity;for(const j of possible){const q=readers[j][rhythm],k=Math.floor(times[j]*8/stride)*stride;lo[j]=q.knot(k);upper=Math.min(upper,q.knot(k+stride));}
         let n=0;for(const j of possible)if(lo[j]<=upper)possible[n++]=j;possible.length=n;if(n===1)break;}
       if(possible.length===1)win=possible[0];else for(const j of possible){const at=readers[j][rhythm].sim(times[j]);if(at<best){best=at;win=j;}}
     }wins[win]++;}
   const raw=wins.map(n=>1000*n/TRIALS),parts=raw.map(Math.floor),by=raw.map((v,i)=>[i,v-parts[i]]).sort((a,b)=>b[1]-a[1]||a[0]-b[0]);const remaining=1000-parts.reduce((a,b)=>a+b,0);for(let k=0;k<remaining;k++)parts[by[k][0]]++;
   return parts.map(n=>n/10);
 }
 const api={forecastSeed:seedFor,neutralGap,form,draw,forecast,TRIALS};root.RaceDay=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
