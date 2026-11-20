/* Reserve spans the full 0–100 scale. Printed trait ratings keep their
   own scale; a missing reading is never displayed as an empty tank. */
(function(root){'use strict';
 const clamp=v=>Math.max(0,Math.min(100,v)),color=h=>`hsl(${h.toFixed(1)} 78% 62%)`;
 const ratingColor=v=>color(v<=60?5:v<=80?5+(v-60)*29/20:34+(clamp(v)-80)*104/20);
 function fuel(percent){if(!Number.isFinite(percent))return {width:'0.0%',number:null,color:''};const v=clamp(percent);
   // Red through 20%, orange in between, green from 80%. The percentage is
   // printed alongside the colour, so colour vision is never required.
   return {width:v.toFixed(1)+'%',number:Math.round(v),color:color(v<=20?0:v<80?32:132)};}
 function paintFuel(el,percent){const f=fuel(percent),unrecorded=f.number===null,key=unrecorded?'missing':f.width+'/'+f.number+'/'+f.color;
   if(el.dataset.level===key)return;el.dataset.level=key;el.style.setProperty('--energy-ink',f.color);
   el.querySelector('i i').style.width=f.width;el.querySelector('b').textContent=unrecorded?'—':f.number+'%';
   if(unrecorded){delete el.dataset.percent;el.removeAttribute('aria-valuenow');el.setAttribute('aria-valuetext','not recorded');return;}
   el.dataset.percent=String(f.number);el.setAttribute('aria-valuenow',String(f.number));el.setAttribute('aria-valuetext',f.number+' percent');}
 function fitness(percent){if(!Number.isFinite(percent))return {number:null,color:''};const number=Math.round(clamp(percent));return {number,color:ratingColor(number)};}
 function paintFitness(el,percent){const f=fitness(percent),key=f.number===null?'missing':String(f.number)+'/'+f.color;if(el.dataset.level===key)return;el.dataset.level=key;el.style.setProperty('--stat-ink',f.color);el.querySelector('b').textContent=f.number===null?'—':String(f.number);const fill=el.querySelector('i i');if(fill)fill.style.width=f.number===null?'0%':f.number+'%';if(f.number===null){el.removeAttribute('aria-valuenow');el.setAttribute('aria-valuetext','not recorded');return;}el.setAttribute('aria-valuenow',String(f.number));el.setAttribute('aria-valuetext',f.number+' out of 100');}
 const fields=['fitness','startStamina','sprintSpeed','pace'],labels=['Fitness','Start stamina','Sprint speed','Pace'],short=['FIT','STA','SPR','PAC'];
 const ink=v=>Number.isFinite(v)?`style="--stat-ink:${ratingColor(v)}" data-rating="${Number(v)}"`:'';
 const value=(v,label,suffix='')=>`<b class="stat-number" ${ink(v)}${label?` aria-label="${label}: ${Number.isFinite(v)?v+suffix:'not recorded'}"`:''}>${Number.isFinite(v)?v+suffix:'—'}</b>`;
 function energyValue(v,label='STA, remaining stamina'){const f=fuel(v);return f.number===null?'—':`<b class="stat-number" style="--stat-ink:${f.color}" aria-label="${label}: ${f.number} percent">${f.number}%</b>`;}
 const rules=(root.AscotPerformance||(typeof module!=='undefined'?require('./race-performance'):null)).FIELDS;
 const glossary=Object.fromEntries(rules.map(r=>[r.key,[r.label+' · / 100',r.effect]]));Object.assign(glossary,{winChance:['Win chance','Estimated chance of finishing first, calculated from the field and its gate ratings. Not a payout or a historical win rate.'],lastFive:['Last five','Finishing places from the last five starts, newest first. A dash means no start is on file.'],energy:['STA · remaining stamina','The actual reserve left in the tank, not the starting rating. Sprinting uses it faster than saving.'],winOdds:['Fixed win odds','The pre-race win quote for this runner, shown as a multiplier.'],stationRate:['Station win rate','Recorded wins divided by starts on this station. This is history, not a forecast.']});
 const tip=key=>glossary[key]?.join(' — ')||'';
 const strip=a=>`<span class="mini-stats" aria-label="Ratings out of 100">${fields.map((f,i)=>`<span data-stat="${f}" title="${tip(f)}"><small>${short[i]}</small>${value(a?.[f],labels[i])}</span>`).join('')}</span>`;
 const api={fuel,paintFuel,fitness,paintFitness,ratingColor,ink,value,energyValue,strip,fields,labels,short,glossary,tip};root.RaceMonitor=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
 // A small text-only tooltip, in the same fullscreen or modal layer as its stat.
 if(typeof document!=='undefined'){let box=null,anchor=null;const hide=()=>{if(box)box.hidden=true;if(anchor?.getAttribute('aria-describedby')==='statHelp')anchor.removeAttribute('aria-describedby');anchor=null;};
 const show=(el,x,y)=>{if(!el||!glossary[el.dataset.stat]){hide();return;}if(!box){box=document.createElement('aside');box.id='statHelp';box.setAttribute('role','tooltip');box.innerHTML='<strong></strong><span></span>';}
   const host=el.closest('dialog[open],#cabinet.station-full')||document.body;if(box.parentNode!==host)host.append(box);if(anchor!==el){hide();anchor=el;el.setAttribute('aria-describedby','statHelp');}const [label,note]=glossary[el.dataset.stat];box.firstChild.textContent=label;box.lastChild.textContent=note;box.hidden=false;
   const r=box.getBoundingClientRect();box.style.left=Math.max(6,Math.min(innerWidth-r.width-6,x+12))+'px';box.style.top=Math.max(6,Math.min(innerHeight-r.height-6,y+16+r.height<innerHeight?y+16:y-r.height-10))+'px';};
 document.addEventListener('pointerover',e=>{if(e.pointerType!=='touch')show(e.target.closest?.('[data-stat]'),e.clientX,e.clientY);});document.addEventListener('pointerout',e=>{if(anchor&&!anchor.contains(e.relatedTarget))hide();});document.addEventListener('focusin',e=>{const el=e.target.closest?.('[data-stat]');if(el){const b=el.getBoundingClientRect();show(el,b.left,b.bottom);}else hide();});for(const k of ['pointerdown','scroll','visibilitychange','focusout'])document.addEventListener(k,hide,true);document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});window.addEventListener('blur',hide);
 // Read a small trait on touch without selecting its runner or charging a chip.
 let press=null,swallow=false;const stop=()=>{if(press)clearTimeout(press.timer);press=null;};document.addEventListener('pointerdown',e=>{stop();swallow=false;const el=e.target.closest?.('[data-stat]');if(!el||e.pointerType!=='touch'||!e.isPrimary)return;const x=e.clientX,y=e.clientY;press={x,y,timer:setTimeout(()=>{show(el,x,y);swallow=true;},470)};},true);document.addEventListener('pointermove',e=>{if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>8)stop();},{passive:true});for(const k of ['pointerup','pointercancel','scroll','visibilitychange'])document.addEventListener(k,stop,true);document.addEventListener('click',e=>{if(swallow){swallow=false;e.preventDefault();e.stopImmediatePropagation();}},true);}
})(globalThis);
