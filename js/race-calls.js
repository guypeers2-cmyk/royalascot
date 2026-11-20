/* Deterministic coverage from actual race distances. Build once per draw; only
   release calls whose timestamps have passed. Reloading produces the same report. */
(function(root){'use strict';
function coverage(game){const runners=game.state.runners,events=[];if(!runners.every(h=>Number.isFinite(h.finish)))return()=>[];
 const end=Math.min(...runners.map(h=>h.finish)),ln=h=>h.name;
 const push=(at,kind,line)=>events.push({at,kind,line,n:runners.find(h=>line.startsWith(h.name+' '))?.num});
 const leader=t=>runners.reduce((a,b)=>game.distance(a,t)>=game.distance(b,t)?a:b);
 push(0,'start','They’re off. Six runners away on the first circuit.');
 let prev=leader(2),last=2;push(2,'lead',ln(prev)+' sets the early pace.');
 for(let t=2.5;t<end;t+=.5){const h=leader(t);if(h!==prev&&t-last>=3){push(t,'lead',ln(h)+' heads the field.');prev=h;last=t;}}
 for(let lap=1;lap<4;lap++){const pass=runners.map(h=>({h,t:game.crossing(h,lap)})).sort((a,b)=>a.t-b.t)[0];const fuel=game.reserve?.(pass.h,pass.t);let line=ln(pass.h)+(lap===3?' leads into the final lap':' leads at the end of lap '+lap);if(lap>=2&&Number.isFinite(fuel))line+=' with '+Math.round(fuel)+'% stamina left';push(pass.t,'lap',line+'.');}
 // Report a genuine rally, once per horse, only after two places have
 // changed since the bell. No future crossing is named in an on-air call.
 const bell=Math.min(...runners.map(h=>game.crossing(h,3))),rankAt=t=>runners.slice().sort((a,b)=>game.distance(b,t)-game.distance(a,t)||a.num-b.num).map(h=>h.num),atBell=rankAt(bell),called=new Set();
 for(let t=bell+1;t<end;t+=.8){const order=rankAt(t);for(const h of runners){const ix=order.indexOf(h.num),was=atBell.indexOf(h.num);if(was>=3&&was-ix>=2&&ix<=2&&!called.has(h.num)){called.add(h.num);push(t,'rally',h.name+' rallies from '+['first','second','third','fourth','fifth','sixth'][was]+' at the bell to '+['first','second','third'][ix]+'.');}}}
 const P=root.AscotPerformance||(typeof module!=='undefined'?require('./race-performance'):null);for(const h of runners)for(const [j,[a]] of P.intervals(h.run).entries()){push(h.run.t[a],'sprint',h.name+(j?' kicks again':' sprints')+' on lap '+(game.lap?game.lap(h,h.run.t[a]):1+Math.floor(a/P.PER_LAP))+'.');}
 runners.slice().sort((a,b)=>a.finish-b.finish).forEach((h,i)=>push(h.finish,'finish',ln(h)+(i===0?' wins in '+h.finish.toFixed(2)+'s.':' crosses '+['','2nd','3rd','4th','5th','6th'][i]+' in '+h.finish.toFixed(2)+'s.')));
 events.sort((a,b)=>a.at-b.at);return t=>events.filter(e=>e.at<=t).slice(-3).reverse();}
const api={coverage,recent:history=>history.slice(0,3)};root.AscotCalls=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
