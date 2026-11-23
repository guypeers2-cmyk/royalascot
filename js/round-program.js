/* The station's three acts. These readouts subscribe to the original machine;
   they never draw a result, debit a second purse, or advance the race clock. */
(function(){'use strict';
window.RoundProgram=function(game,act){
 const $=id=>document.getElementById(id),s=game.state,cab=$('cabinet'),room=$('raceRoom'),tube=$('roundConsole');
 const I=RunnerIntel;let runnerDesk=null;
 const fmt=v=>Number(v).toLocaleString('en-US'),pad=v=>String(v).padStart(3,'0'),ord=['1st','2nd','3rd','4th','5th','6th'];
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const set=(id,v)=>{const el=$(id);if(el&&el.textContent!==String(v))el.textContent=v};
 const cloth=n=>`<i data-horse="${n}" class="cloth cloth-${n}">${n}</i>`,pic=n=>(window.ASCOT_ASSETS&&window.ASCOT_ASSETS['card-'+n+'.webp'])||'assets/card-'+n+'.webp';
 const names=nums=>nums.map(n=>s.runners[n-1].name).join(' + '),stamp=t=>String(Math.floor(t/60)).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0');
 const callInk=line=>esc(line).replace(/\b(100|[1-9]?\d)%/g,(_,n)=>RaceMonitor.energyValue(+n));
 const buttons=(q,root=tube)=>[...root.querySelectorAll(q)];
 const glass=AscotFieldBoard(tube),liveTickets=TrackTickets(game,n=>act('follow',n),()=>act('fieldView'));
 const slate=$('finishSlate'),tabs=$('finishTabs'),area=$('finishArea');let finishPage='places',receiptsPager=null;
 const starterPager=AscotPager($('starterList'),$('starterPager'),'starter');
 const recentPager=AscotPager($('recentFinishes'),$('recentPager'),'recent races',()=>[...$('recentFinishes').querySelectorAll('tbody tr')]);
 const brief=document.createElement('section');brief.id='briefFinish';brief.hidden=true;brief.innerHTML='<div id="briefRows"></div><div id="briefPages" class="glass-pager" aria-label="Finish pages" hidden></div>';area.append(brief);const briefPager=AscotPager($('briefRows'),$('briefPages'),'finish board');let briefKey='';
 function briefBoard(){const rec=s.history[0],k=rec.raceNo+':'+finishPage;if(briefKey===k)return;briefKey=k;let html='';if(finishPage==='bets'){const tmp=document.createElement('div');tmp.innerHTML=RaceReceipt.view(rec,s);html=[...tmp.querySelectorAll('.receipt-title,.market-winners,.receipt-count,.paid-tickets li,.receipt-empty,.players-results')].map(el=>`<div class="paper-receipt" data-heat="${rec.raceNo}">${el.tagName==='LI'?'<ul class="paid-tickets">'+el.outerHTML+'</ul>':el.outerHTML}</div>`).join('');}else if(finishPage==='recent'){html=AscotCalls.recent(s.history).map(r=>`<div class="paper-run" data-heat="${r.raceNo}"><header><b>R${pad(r.raceNo)}</b><small>${I.isWarm(r)?'Warm-up':'Official'}</small></header><div class="brief-podium">${r.order.slice(0,3).map((n,i)=>`<span data-horse="${n}" tabindex="0"><small>${ord[i]}</small>${cloth(n)} ${esc(r.field.find(h=>h.num===n).name)}</span>`).join('')}</div></div>`).join('');}else html=rec.order.map((n,i)=>{const h=rec.field.find(h=>h.num===n);return finishPage==='starters'?I.starter(rec,h,false):`<div class="paper-run" ${I.tag(n,rec.raceNo)} tabindex="0"><header><small>${ord[i]}</small>${cloth(n)} <b>${esc(h.name)}</b></header><time>${h.finish.toFixed(2)} s</time></div>`;}).join('');$('briefRows').innerHTML=html;briefPager.reset();}
 function fitFinish(){if(slate.hidden)return;if(!cab.classList.contains('station-full')){const top=Math.min(320,Math.max(0,Math.round(cab.getBoundingClientRect().top+window.scrollY)))+'px';if(cab.style.getPropertyValue('--finish-top')!==top)cab.style.setProperty('--finish-top',top);}
   const pocket=slate.clientWidth<430&&slate.clientHeight<26*(parseFloat(getComputedStyle(document.documentElement).fontSize)||16),compact=pocket||(slate.clientHeight<=435&&slate.clientWidth>=430);
   slate.dataset.pocket=String(pocket);slate.dataset.brief=String(compact);
   const places=slate.querySelector('.official-placings'),recent=$('officialRecent');
   const now=finishPage,mini=compact&&now!=='places';brief.hidden=!mini;tabs.hidden=false;
   for(const b of tabs.children)b.setAttribute('aria-current',b.dataset.official===now?'page':'false');
   $('officialGrid').hidden=mini||!['places','bets'].includes(now);places.hidden=now!=='places';$('finishReceipts').hidden=now!=='bets';$('finishMyBets').hidden=now!=='places';const grid=$('officialGrid');grid.dataset.paired=String(now==='places');grid.dataset.stacked=String(area.clientWidth<510&&area.clientHeight>240);
   $('officialStarters').hidden=mini||now!=='starters';recent.hidden=mini||now!=='recent';slate.dataset.short=String(area.clientHeight<335);
   if(mini){briefBoard();briefPager.fit();return;}
   if(now==='starters')starterPager.fit();if(now==='recent')recentPager.fit();if(!$('finishReceipts').hidden)receiptsPager?.fit();
 }
 tabs.onclick=e=>{const b=e.target.closest('[data-official]');if(b){finishPage=b.dataset.official;area.scrollTop=0;fitFinish();}};
 const resizeFinish=new ResizeObserver(fitFinish);resizeFinish.observe(area);document.fonts?.ready.then(fitFinish);
 let airPager=null,fitFrame=0;const fitAir=()=>{if(!fitFrame)fitFrame=requestAnimationFrame(()=>{fitFrame=0;airPager?.fit();});},airSizer=new ResizeObserver(fitAir);
 let camera=0,finishOpen=false,cardKey='',summaryKey='',lastSecond=-1,lastFinishers=-1,reportId=-1,timeline=null,reportKey='';
 function layers(){const main=s.phase==='betting'&&camera===4,finish=s.phase==='result'&&finishOpen,trackOnly=camera===7;
   tube.hidden=!main;$('finishSlate').hidden=!finish;cab.classList.toggle('console-stage',main);cab.classList.toggle('finish-stage',finish);cab.classList.toggle('track-only-view',trackOnly);cab.parentElement?.classList.toggle('track-only-layout',trackOnly);room.classList.toggle('program-wide',main||finish);
   $('recallFinish').hidden=s.phase!=='result'||finish;$('raceWire').hidden=s.phase!=='race';if(main)glass.queue();if(finish)fitFinish();
 }
 function setCamera(n,manual){camera=n;$('raceBug').hidden=true;lastSecond=-1;if(manual&&s.phase==='result')finishOpen=false;layers()}
 let warmJob=false;let inspectNo=null,selectionKey='',profileKey='',lastPicks=[],lastMarket='win';
 function paintProfiles(market,picks){
   lastPicks=picks.slice();lastMarket=market;
   const k=s.raceNo+'|'+market+'|'+picks.join();
   if(k!==selectionKey){selectionKey=k;inspectNo=picks.at(-1)??null;}
   const paintKey=k+':'+inspectNo;if(paintKey===profileKey)return;profileKey=paintKey;
   const el=$('terminalProfile'),had=el.contains(document.activeElement)?document.activeElement.closest('[data-inspect]')?.dataset.inspect:null;
   el.innerHTML=RunnerBook.view(s,picks,inspectNo,'terminal',market,market==='quinella'&&picks.length===2?game.odds(market,picks):null);
   if(had)el.querySelector(`[data-inspect="${had}"]`)?.focus({preventScroll:true});
 }

 function inspect(n){if(s.phase!=='betting'||!lastPicks.includes(n))return;inspectNo=n;paintProfiles(lastMarket,lastPicks);act('inspect',n);glass.queue();}
 function zoomPortrait(button){const card=button.closest('.scout'),open=button.getAttribute('aria-expanded')!=='true';card.classList.toggle('enlarged',open);button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',(open?'Reduce':'Enlarge')+' portrait of '+card.querySelector('h3').textContent);button.querySelector('.scout-zoom').textContent=open?'−':'+';
 }
 $('terminalProfile').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-inspect-zoom'))zoomPortrait(b);else if(b.dataset.inspect)inspect(+b.dataset.inspect)});
 function formStrip(name){const recent=StudBook.get(s,name).recent;return Array.from({length:5},(_,i)=>{const f=recent[i];return f?`<i title="${I.raceLabel(f)}: ${ord[f.place-1]}">${f.place}</i>`:'<i>–</i>';}).join('');}
 let ledgerKey='';
 function cashier(){const key=s.raceNo+':'+s.bets.map(b=>[b.market,b.nums,b.odds,b.stake].join('/')).join('|');if(key===ledgerKey)return;ledgerKey=key;const book=$('cashEntries'),focused=book.contains(document.activeElement)?+document.activeElement.dataset.voidSlip:null;
   set('cashCount',s.bets.length);set('cashTotal',fmt(game.stake()));book.innerHTML=s.bets.length?HippoBetMath.ticketRows(s.bets).map(({bet:b,index})=>{const name=b.nums.map(n=>s.runners[n-1].name).join(' + '),m={win:'Win',show:'Show',quinella:'Quinella'}[b.market];return `<article class="cash-entry" aria-label="${m}: ${esc(name)}, ${b.stake} at ${b.odds} times"><div class="cash-ticket"><b>${m}</b><span>${b.nums.map(cloth).join('')}</span></div><small class="cash-name" title="${esc(name)}">${esc(name)}</small><strong class="cash-terms">${b.stake} <i>@</i> ${b.odds}×</strong><button type="button" data-void-slip="${index}" title="Cancel and refund ${b.stake} medals" aria-label="Cancel ${m} on ${esc(name)}; refund ${b.stake} medals">×</button></article>`;}).join(''):'<p class="cash-empty"><b>No tickets yet</b><span>Double-click a runner to place your stake.</span></p>';if(focused!==null)(book.querySelector(`[data-void-slip="${Math.min(focused,s.bets.length-1)}"]`)||$('jumpTickets')).focus({preventScroll:true});}
 function ticket(market,picks,stake){if(s.phase!=='betting')return;cashier();if(s.bets.length&&!warmJob){warmJob=true;(window.requestIdleCallback||window.setTimeout)(()=>{warmJob=false;liveTickets.warm();});}paintProfiles(market,picks);
   const fullPair=market==='quinella',base=picks[0],odds=game.odds(market,picks),refill=s.balance<5&&!s.bets.length;
   if(cardKey!==s.raceNo){cardKey=s.raceNo;
     // The same deterministic pre-draw forecast as the runner file and gate
     // snapshot. Read once per field, not per selection, wager or animation.
     const chances=game.forecast();$('tubeRows').innerHTML=s.runners.map((h,i)=>{
       const p=chances?.[i],chance=Number.isFinite(p)?p.toFixed(1)+'%':'—';
       return `<button type="button" class="field-entry" data-tube-pick="${h.num}"><span class="entry-id">${cloth(h.num)}<img src="${pic(h.num)}" width="60" height="38" alt="" draggable="false"><b>${esc(h.name)}</b></span>
         <span class="entry-style">${esc(h.style||'—')}</span><span class="entry-chance" data-stat="winChance"><small><span class="chance-long">Win chance</span><span class="chance-short">Win %</span></small><strong>${chance}</strong><i aria-hidden="true" style="--win:${Number.isFinite(p)?p:0}%"></i></span>
         <span class="entry-prices"><span><small>Win</small><em></em></span><span><small class="quote-label">Show</small><em></em></span></span><span class="entry-record"><span class="field-form" data-stat="lastFive"><abbr>L5</abbr>${formStrip(h.name)}</span>${RaceMonitor.strip(h.stats)}</span></button>`;}).join('');$('tubeRows').scrollTop=0;
   }
   set('tubeTitle',s.title);set('tubeRace','RACE '+pad(s.raceNo));set('tubeMarket',market.toUpperCase());set('slipNumbers',picks.length?picks.map(n=>'#'+n).join(' + ')+(fullPair&&picks.length===1?' + ?':''):'Choose pair');set('fieldQuoteHead',fullPair?'Win / Pair':'Win / Show');
   set('tubeHint',fullPair?(picks.length===2?'Pair ready · Place bet, or double-click the second runner.':base?'Now choose a different runner to pair with #'+base+'.':'Choose two different horses from the field.'):market==='show'?'Show · Double-click to bet on exactly second.':'Win · Double-click a horse to bet, or select one and use Place bet.');
   buttons('[data-tube-market]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.tubeMarket===market));b.title=({win:'Your runner must finish first.',show:'Your runner must finish exactly second.',quinella:'Choose two horses from the field. Either order pays.'})[b.dataset.tubeMarket];});
   buttons('[data-tube-pick]').forEach(b=>{const n=+b.dataset.tubePick,h=s.runners[n-1],vals=b.querySelectorAll('em');let right=fullPair?(base&&n!==base?game.odds('quinella',[base,n])+'×':'—'):h.showOdds+'×';b.querySelector('.quote-label').textContent=fullPair?'Pair':'Show';vals[0].textContent=h.winOdds+'×';vals[1].textContent=right;vals[0].className=market==='win'?'quoted':'';vals[1].className=market!=='win'?'quoted':'';b.setAttribute('aria-pressed',String(picks.includes(n)));b.setAttribute('aria-label',`${n}, ${h.name}. ${h.style}. Estimated win chance: ${b.querySelector('.entry-chance strong').textContent}. Win ${h.winOdds} times. ${fullPair?'Pair':'Show'} ${right}. Last five finishes, newest first: ${StudBook.get(s,h.name).recent.map(f=>ord[f.place-1]+(I.isWarm(f)?' in a warm-up':'')).join(', ')||'no starts on file'}. ${RaceMonitor.fields.map((k,i)=>RaceMonitor.labels[i]+': '+(h.stats?.[k]??'not recorded')).join(', ')}.`)});
   buttons('[data-tube-coin]').forEach(b=>b.setAttribute('aria-pressed',String(+b.dataset.tubeCoin===stake)));
   set('tubeSelection',names(picks)+(fullPair&&picks.length===1?' + ?':'')||'Choose two runners');const slip=tube.querySelector('.slip-who');slip.setAttribute('aria-label','Change '+market+' selection: '+$('tubeSelection').textContent);slip.removeAttribute('aria-haspopup');$('tubeSelection').closest('button').dataset.horse=picks.join(',');$('tubeSelection').innerHTML=picks.map(n=>I.name(s.runners[n-1])).join(' + ')+(fullPair&&picks.length===1?' + ?':'')||'Choose two runners';set('tubeStake',fmt(stake));set('tubeOdds',odds?odds+'×':'—');set('tubeReturn',odds?fmt(odds*stake):'—');set('tubeCredit',fmt(s.balance));set('tubeStaked',fmt(game.stake()));set('slipCount',s.bets.length);$('jumpTickets').setAttribute('aria-label',`My bets: ${s.bets.length} open tickets, ${game.stake()} medals staked`);
   $('tubePlace').disabled=!odds&&!refill;set('tubePlace',refill?'Refill medals':!odds?'Select pair':'Place bet');
   glass.queue();
 }
 tube.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||s.phase!=='betting')return;const d=b.dataset;
   if(d.jump)glass.focus(picksForFocus());else if(d.voidSlip!==undefined)act('cancel',+d.voidSlip);
   else if(d.tubeMarket)act('market',d.tubeMarket);else if(d.tubePick)act('fieldClick',{n:+d.tubePick,b,e});else if(d.tube)act(d.tube,b);
 });
 function picksForFocus(){return lastPicks.at(-1)||1;}
 function drawFinish(){const rec=s.history[0];if(!rec)return;set('finishNumber','RACE '+pad(rec.raceNo));set('finishTitle',rec.title);slate.querySelector('[data-finish=details]').textContent=rec.photo?'Photo & result':'Full result';$('finishReceipts').innerHTML=RaceReceipt.view(rec,s);$('finishMyBets').innerHTML=RaceReceipt.side(rec,s);slate.scrollTop=area.scrollTop=0;recentPager.reset();starterPager.reset();$('starterList').innerHTML=rec.order.map(n=>I.starter(rec,rec.field.find(h=>h.num===n),false)).join('');finishPage='places';receiptsPager=null;const list=$('finishReceipts').querySelector('.paid-tickets');if(list){const nav=document.createElement('div');nav.className='glass-pager paid-pager';nav.hidden=true;list.previousElementSibling.append(nav);receiptsPager=AscotPager(list,nav,'settled ticket');}
   $('finishList').innerHTML=I.finishList(rec);
   const firstH=rec.field.find(h=>h.num===rec.order[0]),secondH=rec.field.find(h=>h.num===rec.order[1]);
   const pfBtn=$('finishPhotoReplay');if(pfBtn)pfBtn.hidden=!(firstH&&secondH&&Math.abs(secondH.finish-firstH.finish)<.10);
   const last=AscotCalls.recent(s.history);set('finishSaved',s.history.length===1?'1 RACE ON FILE':`LATEST ${last.length} / ${s.history.length} RACES`);
   $('recentFinishes').innerHTML='<table class="finish-archive"><thead><tr><th>Race</th><th>1st</th><th>2nd</th><th>3rd</th></tr></thead><tbody>'+last.map(r=>`<tr data-heat="${r.raceNo}"><th scope="row">${pad(r.raceNo)}${I.isWarm(r)?'<small class="warmup-mark">Warm-up</small>':''}</th>`+r.order.slice(0,3).map((n,i)=>`<td data-horse="${n}" tabindex="0"><span class="archive-place" aria-hidden="true">${ord[i]}</span>${cloth(n)}<span>${esc(r.field.find(h=>h.num===n).name)}</span></td>`).join('')+'</tr>').join('')+'</tbody></table>';
   set('finishCredit',rec.bets.length?`Your tickets · ${fmt(rec.stake)} staked / ${fmt(rec.return)} returned`:'No tickets on this race.');
 }
 $('finishSlate').addEventListener('click',e=>{const b=e.target.closest('[data-finish]');if(!b||s.phase!=='result')return;if(b.dataset.finish==='replay'||b.dataset.finish==='winner3d'){finishOpen=false;layers();}act(b.dataset.finish,b);});
 $('recallFinish').onclick=()=>{if(s.phase==='result'){finishOpen=true;layers()}};$('wireReport').onclick=()=>{runnerDesk?.open('calls');act('coverage')};
 $('watchPane').addEventListener('click',e=>{if(e.target.closest('#airStop')){act('fieldView');return;}const detail=e.target.closest('#airOrder [data-file-runner]');if(detail){runnerDesk?.open('files',+detail.dataset.fileRunner);$('airFile').querySelector('[aria-pressed=true]')?.focus({preventScroll:true});return;}const b=e.target.closest('button[data-follow-runner]');if(b&&s.phase==='race')act('follow',+b.dataset.followRunner);});
 function transition(){if(s.phase!=='race'&&s.phase!=='result')CabinetAudio.cutRadio();liveTickets.phase();$('raceBug').hidden=true;if(s.phase!=='race'){airSizer.disconnect();airPager=null;runnerDesk?.destroy();runnerDesk=null;}finishOpen=s.phase==='result';if(finishOpen)drawFinish();reportKey='';lastSecond=-1;summaryKey='';cab.dataset.phase=s.phase;layers();glass.queue();}
 let previewKey='';function paddock(){const e=PaddockRadio.cue(s,AscotEngine.names);if(e.key===previewKey)return;previewKey=e.key;
   const key=$('paddockReport');key.textContent=e.n?'Paddock mic · '+e.name+' ›':'Paddock mic · Full card ›';key.title=e.line+' Read all six introductions.';key.setAttribute('aria-label',key.title);
   for(const row of $('tubeRows').children)row.toggleAttribute('data-on-mic',+row.dataset.tubePick===e.n);
 }
 $('paddockReport').onclick=e=>act('paddock',e.currentTarget);
 function clock(t){if(s.phase==='betting')paddock();if(s.phase==='gates')liveTickets.phase();if(s.phase==='betting')set('tubeTime',t);else if(s.phase==='result')set('finishClock',t);}
 function report(force=false){if(s.phase!=='race')return;
   if(reportId!==s.raceNo||!timeline){reportId=s.raceNo;timeline=RaceRadio.create(game);reportKey='';lastSecond=-1;}
   const sample=Math.floor(s.clock*5);const finished=s.runners.reduce((bits,h,i)=>s.clock>=h.finish?bits|(1<<i):bits,0);if(!force&&sample===lastSecond&&finished===lastFinishers)return;lastSecond=sample;lastFinishers=finished;
   const bug=$('raceBug');if(bug)bug.hidden=true;
   const order=game.positions(),lead=s.runners[order[0]-1],dist=game.distance(lead),lap=game.lap?game.lap(lead):Math.min(4,Math.floor(dist)+1),events=timeline.read(s.clock),latest=events[0];let box=$('watchPane');
   if(!box.querySelector('.broadcast-panel')){box.innerHTML=`<div class="broadcast-panel"><div class="air-heading"><h3>Race report</h3><small id="airLap"></small></div><div class="rhythm-line" id="airRhythm" hidden></div><div id="airCalls" class="air-calls"></div><div class="air-heading ticket-heading"><h3>My bets</h3><small id="airCount"></small><button type="button" class="stop-follow" id="airStop" disabled>Stop follow</button><div class="glass-pager" id="airPages" aria-label="Live ticket pages" hidden></div></div><div class="air-tickets" id="airTickets" role="region" aria-label="My live tickets" tabindex="-1"></div><div class="watch-caption"><span>RUNNING ORDER · <time id="airTime"></time></span><span id="airReserveLabel" hidden>ODDS · FIT · STA</span></div><div id="airOrder"></div><div class="watch-progress"><i id="lapFill"></i></div></div>`;reportKey='';summaryKey='';airSizer.disconnect();airPager=AscotPager($('airTickets'),$('airPages'),'live tickets');airSizer.observe($('airTickets'));runnerDesk=RunnersDesk(game,box,n=>act('follow',n));}
   liveTickets.update(order,lap);CabinetAudio.announce(latest,s.raceNo,s.clock-latest.at);$('wireCall').dataset.level=String(latest.level);
   const energy=!!s.rhythm&&s.runners.every(h=>h.run);
   $('airReserveLabel').hidden=!energy;$('airRhythm').hidden=!energy;if(energy){set('airRhythm','Race tempo · '+s.rhythm);set('airReserveLabel','ODDS · FIT · STA');}
   if($('wireCall').textContent!==latest.line)$('wireCall').innerHTML=callInk(latest.line);const lapLabel=lap===0?'TO LAP 1':'LAP '+lap+' / 4';set('airLap',lapLabel);set('lapOrdinal',lap===0?'TO 1 / 4':lap+' / 4');set('deskLap',lap===0?'TO LAP 1':'LAP '+lap+'/4');for(const [i,b] of [...$('lapSteps').children].entries())b.dataset.state=i<lap-1?'done':i===lap-1?'live':'next';set('airTime',stamp(s.clock));$('lapFill').style.width=(dist/4*100)+'%';
   const k=order.join()+':'+order.map(n=>game.sprint(s.runners[n-1])).join()+':'+events.map(e=>e.at).join()+':'+order.filter(n=>s.clock>=s.runners[n-1].finish).join();if(force||reportKey!==k){reportKey=k;
     $('airCalls').innerHTML=events.map(e=>`<p ${e.n?I.tag(e.n):''}><time>${stamp(e.at)}</time><span>${callInk(e.line)}</span></p>`).join('');
     const focused=document.activeElement?.closest('#airOrder [data-file-runner]')?.dataset.fileRunner;
     $('airOrder').innerHTML=order.map((n,i)=>{const h=s.runners[n-1],done=s.clock>=h.finish;const drive=game.sprint(h);return `<div class="watch-row ${i===0?'lead':''}" data-horse="${n}" data-drive="${drive||''}"><i>${ord[i]}</i>${cloth(n)}<button type="button" class="air-name" data-file-runner="${n}"><b>${esc(h.name)}</b><span><span class="air-style">${esc(h.style||'Style —')}</span>${done?' · Finished':['active','spent','saving'].includes(drive)?` · <i class="drive-lozenge">${{active:'Sprint',spent:'Spent',saving:'Saving'}[drive]}</i>`:''}</span></button><span class="watch-vitals"><small class="win-odds" data-stat="winOdds" title="${esc(RaceMonitor.tip('winOdds'))}" aria-label="${esc(h.name)}: fixed win odds ${h.atStart?.winOdds??h.winOdds} to 1"><span>ODDS</span><b>${h.atStart?.winOdds??h.winOdds}×</b></small>${energy?`<small class="fitness-readout" data-stat="fitness" title="${esc(RaceMonitor.tip('fitness'))}" role="meter" aria-label="${esc(h.name)}: FIT, current fitness" aria-valuemin="0" aria-valuemax="100" data-fit="${n}"><span>FIT</span><b>—</b><i aria-hidden="true"><i></i></i></small><small class="reserve-readout" data-stat="energy" role="meter" aria-label="${esc(h.name)}: STA, remaining stamina" aria-valuemin="0" aria-valuemax="100" data-fuel="${n}"><span>STA</span><b></b><i aria-hidden="true"><i></i></i></small>`:''}</span></div>`}).join('');
     if(focused)$('airOrder').querySelector(`[data-file-runner="${focused}"]`)?.focus({preventScroll:true});
   }
   if(latest.n)$('wireCall').dataset.horse=latest.n;else delete $('wireCall').dataset.horse;runnerDesk?.update();
   if(energy){for(const el of $('airOrder').querySelectorAll('[data-fit]'))RaceMonitor.paintFitness(el,game.fitness(s.runners[+el.dataset.fit-1]));for(const el of $('airOrder').querySelectorAll('[data-fuel]'))RaceMonitor.paintFuel(el,game.reserve(s.runners[+el.dataset.fuel-1]));}
   // This is the monitor’s live Tickets page, not a cashier receipt. Use
   // the same followable silks as the rail, and keep a pair on one slip.
   const tk=s.raceNo+'|'+s.bets.map(b=>b.market+':'+b.nums).join('/');if(summaryKey!==tk){summaryKey=tk;
     set('airCount',s.bets.length===1?'1 ticket':s.bets.length+' tickets');
     liveTickets.mountDesk($('airTickets'));airPager?.fit();
   }

 }
 return{ticket,markTicket:liveTickets.mark,focusField:()=>glass.focus(picksForFocus()),setCamera,transition,report,clock,get inspected(){return inspectNo},get coversTrack(){return !tube.hidden||!$('finishSlate').hidden}};
};})();
