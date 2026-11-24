/* One trackside instrument. Stalls and racing share the very same six rows and
   locked slips. In the boxes there is no running order, sprint or finish yet. */
(function(root){'use strict';root.TrackTickets=function(game,follow,stopFollow){
 const $=id=>document.getElementById(id),track=$('viewWindow'),panel=$('livePanel'),el=$('trackTickets'),paper=$('trackPaper'),monitor=$('trackMonitor'),board=$('railBoard'),
   list=board.querySelector('ol'),legend=board.querySelector('.rail-legend'),lap=monitor.querySelector('.rail-lap'),count=el.querySelector('.track-count'),slipKey=el.querySelector('button'),boardKey=monitor.querySelector('button'),I=RunnerIntel;
 const drives={boxed:['Ready','Ready','Standing in the starting stall'],saving:['Saving','Save','Saving: cruising between sprints; reserve drains slowly.'],active:['Sprint','Sprint','Sprint: racing at sprint speed and using reserve faster.'],spent:['Spent','Spent','Spent: all scheduled sprints are over. This does not mean the tank is empty.'],finished:['Finished','Fin','Finished'],unknown:['—','—','Sprint not recorded']};
 const cab=$('cabinet'),dockKey=$('railDock'),stopKey=$('railStop'),bay=document.createElement('div');bay.id='railBay';bay.hidden=true;cab.insertBefore(bay,track.nextSibling);
 const isCompact=()=>{const d=document.documentElement?.dataset?.device;return d==='mobile'||(d!=='desktop'&&d!=='tablet'&&window.innerWidth<=680);};
 let docked=isCompact(),manualDock=false;try{const savedDock=localStorage.getItem('ascot-live-position');if(savedDock==='docked'||savedDock==='overlay'){docked=savedDock==='docked';manualDock=true;}}catch{}
 let race=-1,model=null,marketKey='',modelNo=-1,gateWins=null,rows=[],deskRows=[],readings=[],folded=false,boardFolded=false,pin=null,job=0,legKeys=[],deskLegs=[],slots=[];
 try{boardFolded=sessionStorage.getItem('ascot-rail-board')==='folded';}catch{}
 const text=(e,t)=>{if(e.textContent!==t)e.textContent=t;};
 function fit(){job=0;if(panel.hidden||!track.clientHeight||!track.clientWidth)return;
   const h=docked?bay.clientHeight:track.clientHeight;
   let room=h-(docked?6:12);if(!docked){const rect=track.getBoundingClientRect(),left=panel.getBoundingClientRect().left,header=track.querySelector('.feed-top').getBoundingClientRect();
     const caps=[$('raceBug'),$('announcement')].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect()).filter(r=>r.right>left-4);
     room=Math.max(48,rect.bottom-Math.max(header.bottom,...caps.map(r=>r.bottom))-12);}
   const zoom=parseFloat(getComputedStyle(panel).zoom)||1,em=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
   const monW=monitor.clientWidth,elW=el.clientWidth,pRect=!docked?panel.getBoundingClientRect():null;
   const width=monW*2.08;
   panel.style.setProperty('--rail-room',Math.floor(room/zoom)+'px');
   el.dataset.paper=elW<185?'narrow':elW<Math.max(280,19*em)?'slim':'table';
   monitor.dataset.compact=String(monW<320||room<215);panel.dataset.size=width<445?'pocket':width<660?'compact':'full';panel.dataset.shallow=String(room<210);
   if(pRect){track.style.setProperty('--live-height',pRect.height+'px');track.style.setProperty('--live-width',pRect.width+'px');}
 }
 function position(on){panel.removeAttribute('data-on-horse');const outside=on&&docked;bay.hidden=!outside;cab.classList.toggle('docked-rail',outside);const host=outside?bay:track;
   if(panel.parentElement!==host)host.append(panel);track.classList.toggle('has-live-panel',on&&!outside);dockKey.setAttribute('aria-pressed',String(outside));
   dockKey.querySelector('span').textContent=outside?'Overlay':'Dock';dockKey.title=dockKey.ariaLabel=outside?'Return panel to bottom right of track':'Dock panel outside track view';queue();}
 dockKey.onclick=()=>{docked=!docked;manualDock=true;try{localStorage.setItem('ascot-live-position',docked?'docked':'overlay');}catch{}position(true);dockKey.focus({preventScroll:true});};
 window.addEventListener('resize',()=>{if(manualDock)return;const want=isCompact();if(want!==docked){docked=want;if(!panel.hidden)position(true);}});
 function queue(){if(!job)job=requestAnimationFrame(fit);}
 const ro=new ResizeObserver(queue);for(const e of [panel,bay,track,track.querySelector('.feed-top'),track.querySelector('.feed-bottom'),$('raceBug'),$('announcement')])ro.observe(e);document.fonts?.ready.then(queue);
 function show(){const size=game.state.bets.length;paper.hidden=!size||folded;slipKey.disabled=!size;slipKey.setAttribute('aria-expanded',String(!paper.hidden));
   text(count,!size?'0 slips':size===1?'1 slip':size+' slips');el.querySelector('.bet-guide').hidden=!size||folded;$('betBasis').hidden=!size||folded;el.querySelector('.rail-empty').hidden=!!size||folded;board.hidden=boardFolded;boardKey.setAttribute('aria-expanded',String(!boardFolded));queue();}
 function warm(){const s=game.state;if(!s.bets.length||modelNo===s.raceNo)return;modelNo=s.raceNo;gateWins=game.forecast();model=LiveBook.create(s.runners.map(h=>({num:h.num,name:h.name,style:h.style,stats:h.atStart?.stats||h.stats,p:h.p,seed:h.seed})),s.runLaw??s.energyLaw??2,s.racePace||3.35);}
 const signed=n=>(n>0?'+':n<0?'−':'')+Math.abs(n).toLocaleString('en-GB');
 const marketName={win:'Win',show:'Show',quinella:'Quinella'},marketRule={win:'first place',show:'exactly second',quinella:'first two in either order'};
 function cells(b,detail=false){const names=b.nums.map(n=>game.state.runners[n-1].name),silks=b.nums.map((n,i)=>I.liveSilk(n).replace('<button ',`<button title="${I.esc(names[i])} · #${n}" `)).join('');return `<div class="rb-pick"><b class="rb-type" title="${marketRule[b.market]}">${marketName[b.market]}</b><div class="track-legs">${silks}</div>${detail?`<span class="rb-names">${names.map(I.esc).join(' + ')}</span>`:''}</div><span class="rb-metric rb-stake" data-label="Stake">${b.stake}</span><span class="rb-metric rb-odds" data-label="Odds" title="Locked decimal odds">${b.odds}×</span><strong class="rb-metric rb-net" data-label="Net¹" title="Net profit if this ticket hits">${signed(HippoBetMath.gross(b.stake,b.odds)-b.stake)}</strong><b class="rb-chance" data-label="Chance">—</b>`;}
 function paint(row,v){if(!row||!v)return;const chance=row.querySelector('.rb-chance');text(chance,v.label);row.dataset.result=v.result;chance.title=v.basis;row.ariaLabel=v.a11y;}
 function prices(boxed,order){const s=game.state;if(!rows.length)return;const t=boxed?0:Math.floor(s.clock),landed=boxed?[]:order.filter(n=>game.distance(s.runners[n-1])>=4),key=(boxed?'gate':t)+':'+landed.join();if(key===marketKey)return;marketKey=key;warm();
   const ds=boxed?null:s.runners.map(h=>game.distance(h,t)),matrix=model?.estimate(t,ds,landed,boxed?-1:AscotPerformance.rhythms.indexOf(s.rhythm));text($('betBasis').firstElementChild,'¹ Net if hit · '+(boxed||!t?'gate estimate':landed.length>=2?'finish confirmed':'live estimate'));
   text(el.querySelector('.stub-note i'),boxed||!t?'gate chance':landed.length>=2?'confirmed':'live chance');
   readings=s.bets.map(b=>{const v=LiveBook.chance(matrix,b,landed),issued=!t&&b.market==='win'&&gateWins?.[b.nums[0]-1],label=typeof issued==='number'&&issued>0&&issued<100?issued.toFixed(1)+'%':LiveBook.label(v),basis=v.known===null?(!t?'Gate':'Live')+' estimate for this whole ticket':v.known?'Hit confirmed':'Miss confirmed';return {label,basis,result:v.known===null?'open':v.known?'hit':'miss',a11y:`${marketName[b.market]}: ${b.nums.map(n=>s.runners[n-1].name+', number '+n).join(' and ')}; ${marketRule[b.market]}; stake ${b.stake}, locked odds ${b.odds} times, net profit if hit ${signed(HippoBetMath.gross(b.stake,b.odds)-b.stake)} medals. ${basis}: ${label}.`};});
   for(const [i,v] of readings.entries()){paint(rows[i],v);paint(deskRows[i],v);}}
 function mountDesk(box){const bets=game.state.bets;box.innerHTML=bets.length?bets.map(b=>`<div class="air-ticket" data-market="${b.market}" role="group">${cells(b,true)}</div>`).join(''):'<p>Watching without a ticket.</p>';deskRows=[...box.querySelectorAll('.air-ticket')];deskRows.forEach((r,i)=>paint(r,readings[i]));deskLegs=[...box.querySelectorAll('[data-follow-runner]')];mark();}
 function build(s){race=s.raceNo;folded=false;pin=null;marketKey='';deskRows=[];deskLegs=[];readings=[];
   paper.innerHTML=s.bets.map(b=>`<li class="track-slip" data-market="${b.market}">${cells(b)}</li>`).join('');rows=[...paper.children];legKeys=[...paper.querySelectorAll('[data-follow-runner]')];
   list.innerHTML=I.places.map(()=>'<li><small></small><i></i><b></b><span class="rail-style"></span><span class="rail-fit" data-stat="fitness"></span><em data-stat="energy"></em><span class="rail-drive"><span></span><abbr></abbr></span></li>').join('');slots=[...list.children];show();}
 function surface(mode){const hidden=!mode;if(panel.hidden!==hidden){panel.hidden=hidden;position(!hidden);}if(hidden){delete panel.dataset.mode;return;}if(race!==game.state.raceNo)build(game.state);
   if(panel.dataset.mode!==mode){panel.dataset.mode=mode;const boxed=mode==='boxed';stopKey.hidden=boxed;mark();for(const b of legKeys){b.disabled=boxed;b.setAttribute('aria-label',I.silkLabel(+b.dataset.followRunner,!boxed));}text(legend.firstElementChild,boxed?'Stall · Runner':'Rank · Runner');text(legend.lastElementChild,boxed?'FIT · STA · Status':'FIT · STA · Sprint');list.setAttribute('aria-label',boxed?'Six horses in their own starting stalls':'Live running order, first to sixth');queue();}}
 function draw(order,boxed,lapNo){const s=game.state;surface(boxed?'boxed':'race');const sec=boxed?Math.ceil(game.remaining()):0;text(lap,boxed?'Boxed · '+sec+'s':'L'+lapNo+'/4');lap.setAttribute('aria-label',boxed?`In the boxes, ${sec} seconds to release`:`Lap ${lapNo} of 4`);
   prices(boxed,order);if(boardFolded)return;
   for(const [i,n] of order.entries()){const row=slots[i],h=s.runners[n-1],done=!boxed&&s.clock>=h.finish,[place,cloth,name,style,fitEl,reading,badge]=row.children;text(place,boxed?'Box':I.places[i]);
     if(row.dataset.horse!==String(n)){row.dataset.horse=n;cloth.className='cloth cloth-'+n;text(cloth,String(n));text(name,h.name);text(style,h.style||'—');style.title=h.style?'Running style: '+h.style:'Running style not recorded';}
     const fitVal=game.fitness?game.fitness(h):h.stats?.fitness,fv=Number.isFinite(fitVal)?String(Math.round(fitVal)):'—',fitInk=RaceMonitor.fitness(fitVal).color;text(fitEl,fv);if(fitEl.dataset.ink!==fitInk){fitEl.dataset.ink=fitInk;fitEl.style.color=fitInk;}
     const value=boxed?h.stats?.startStamina:game.reserve(h),v=done?'FIN':Number.isFinite(value)?Math.round(value)+'%':'—';const ink=done?'':RaceMonitor.fuel(value).color;text(reading,v);if(reading.dataset.ink!==ink){reading.dataset.ink=ink;reading.style.color=ink;}
     const status=boxed?'boxed':done?'finished':game.sprint(h)||'unknown',words=drives[status];if(row.dataset.drive!==status){row.dataset.drive=status;text(badge.firstElementChild,words[0]);text(badge.lastElementChild,words[1]);badge.title=words[2];}
     const label=`${boxed?'Stall '+n:I.places[i]+': number '+n}, ${h.name}, ${h.style||'style not recorded'}, FIT ${fv}, ${done?'across the line':v==='—'?'STA not recorded':v+(boxed?' starting stamina':' STA, remaining stamina')}, ${words[2]}`;if(row.title!==label){row.title=label;row.setAttribute('aria-label',label);}}
 }
 function phase(){const s=game.state;if(s.phase==='gates'&&AscotMarshal.boxed(s))draw(s.runners.map(h=>h.num),true,0);else if(s.phase==='race'){const order=game.positions();draw(order,false,Math.min(4,Math.floor(game.distance(s.runners[order[0]-1]))+1));}else surface(null);}
 slipKey.onclick=()=>{folded=!folded;show();};boardKey.onclick=()=>{boardFolded=!boardFolded;try{sessionStorage.setItem('ascot-rail-board',boardFolded?'folded':'open');}catch{}show();phase();};
 paper.onclick=e=>{const b=e.target.closest('[data-follow-runner]');if(b&&game.state.phase==='race')follow(+b.dataset.followRunner);};
 stopKey.onclick=stopFollow;
 function mark(n=pin){pin=n;for(const b of [...legKeys,...deskLegs])b.setAttribute('aria-pressed',String(+b.dataset.followRunner===pin));
   for(const b of [stopKey,$('airStop')])if(b){b.disabled=game.state.phase!=='race'||!pin;b.title=pin?'Stop following '+game.state.runners[pin-1].name+'; return to the field':'No runner is being followed';}}

 return {warm,mountDesk,update:(order,lapNo)=>draw(order,false,lapNo),mark,phase};
};})(globalThis);
