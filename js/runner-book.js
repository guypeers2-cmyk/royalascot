/* A read-only runner card. Silks belong to this race's number, form belongs
   to the named horse. Never infer a past placing from a reused lane/number. */
(function (root) {
  'use strict';
  const performanceModel=root.AscotPerformance||(typeof module!=='undefined'&&module.exports?require('./race-performance.js'):null);
  const M=root.RaceMonitor||(typeof module!=='undefined'?require('./race-monitor'):null);
  const silks = Object.freeze(['Ivory', 'Black', 'Red', 'Blue', 'Gold', 'Green']);
  const ord = ['1st', '2nd', '3rd', '4th', '5th', '6th'];
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function profile(state, number) {
    const h = state.runners.find(r => r.num === number);
    if (!h) return null;
    const book=(root.StudBook||(typeof module!=='undefined'?require('./stud-book'):null)).get(state,h.name),form=book.recent.slice(0,5);
    return {num:h.num, name:h.name, style:h.style, silk:silks[h.num-1], win:h.winOdds,
      show:h.showOdds, marketPercent:Math.round(h.p*1000)/10, stats:h.stats?{...h.stats}:null, form};
  }
  // One betting file, not a collection of mutually exclusive sheets. All
  // values come from the current entry or its named horse's real stud book.
  function panel(stats,mode) {
    const fresh=mode===performanceModel.FORM_MODE,fixed=fresh||['fixed-skills-v1','fixed-skills-160'].includes(mode);
    const valid=performanceModel.validRatings(stats),short=['Fitness','Stamina','Sprint','Pace'];
    const budget=valid?stats.sprintSpeed+stats.pace:(fresh?performanceModel.SKILL_TOTAL:160);
    const heading=fixed?'<div class="trait-head" data-pairs><h4 class="runner-sr">Gate ratings out of 100</h4><b title="'+(fresh?'Fitness and starting stamina are drawn separately, each from 80 to 100':'Fitness and starting stamina share 150 on this card')+'">'+(fresh?'Form · 80–100':'Form · 150')+'</b><b title="Sprint speed and pace stay with the named horse">Fixed skill · '+budget+'</b></div>':'<div class="trait-head"><h4>Race ratings</h4><span>/ 100</span></div>';
    return `<section class="trait-panel" aria-label="${fixed?'Gate ratings out of 100. Daily condition: '+(fresh?'fitness and starting stamina are independently drawn from 80 to 100':'fitness and stamina share 150')+'. Fixed skills: sprint and pace share '+budget+'.':'Race ratings out of 100; 300 points across four traits'}">${heading}<ul class="trait-grid">${performanceModel.FIELDS.map(({key,label,effect},i)=>{
      const n=valid?stats[key]:null;
      return `<li tabindex="0" data-stat="${key}" data-trait="${key}" ${M.ink(n)} title="${esc((fixed?(i<2?'Race-day condition · ':'Fixed skill · '):'')+label+': '+effect)}"><div><abbr aria-label="${esc(label)}">${short[i]}</abbr><strong>${n??'—'}</strong></div><i aria-hidden="true"><b style="width:${n??0}%"></b></i></li>`;
    }).join('')}</ul></section>`;
  }
  function formLine(h) {
    const places=h.form.map(f=>{const warm=f.source==='warmup',qual=f.source==='qualifier',no=String(f.race).padStart(3,'0'),source=(qual?'Qualifier ':warm?'Warm-up ':'Race ')+no,place=ord[f.place-1]||'—',note=source+': '+place+(Number.isFinite(f.seconds)?', '+f.seconds.toFixed(2)+' s':'');
      return `<li title="${esc(note)}" aria-label="${esc(note)}"><b>${place}</b><small aria-hidden="true">${qual?'Q':warm?'W':'R'}${esc(no)}</small><span class="runner-sr">${esc(source)}</span></li>`;
    });
    const empty='<li class="no-run" aria-hidden="true">–</li>';
    return `<section class="scout-form" aria-label="Last five station finishes, newest first"><h4>Form <small>Last 5</small></h4>${places.length?`<ol class="scout-form-list">${places.join('')+empty.repeat(5-places.length)}</ol>`:'<p>No starts on file</p>'}</section>`;
  }
  function prices(h,market,picks,pairOdds) {
    const q=(id,label,value,hint)=>`<div data-quote="${id}"${(id===market||id==='pair'&&market==='quinella')?' class="active-price"':''} title="${esc(hint)}"><dt>${label}</dt><dd${id==='weight'?' '+M.ink(h.marketPercent):''}>${esc(value)}</dd></div>`;
    const pair=market==='quinella',complete=picks.length===2&&Number.isFinite(pairOdds)&&pairOdds>0;
    return `<section class="runner-odds" aria-label="Odds"><h4>Odds</h4><dl class="scout-quotes" aria-label="Posted prices for this field">${q('win','Win',h.win+'×','Win: must finish first')}${q('show','Show <small>(2nd)</small>',h.show+'×','Show: must finish exactly second')}${pair?q('pair',complete?'Pair #'+picks.join(' + #'):'Pair odds',complete?pairOdds+'×':'—',complete?'Quinella: these two in either order':'Select a second runner for a pair price'):q('weight','Pricing weight',h.marketPercent+'%','Pricing weight used for the odds; not a race forecast')}</dl></section>`;
  }
  function view(state,picks,inspected,surface,market,pairOdds) {
    const h=picks.includes(inspected)?profile(state,inspected):null;
    if(!h)return '<article class="scout scout-empty"><p>Choose a runner to see its ratings, form and odds.</p></article>';
    const file='profile-'+h.num+'.webp',src=(root.ASCOT_ASSETS&&root.ASCOT_ASSETS[file])||'assets/'+file;
    const pair=picks.length===2?`<div class="scout-pair" role="group" aria-label="Inspect either selected runner without changing the ticket">${picks.map(n=>`<button type="button" data-inspect="${n}" aria-pressed="${n===inspected}" aria-label="Inspect number ${n}, ${esc(state.runners[n-1].name)}">#${n}</button>`).join('')}</div>`:'';
    return `<article class="scout runner-card" data-runner-profile="${h.num}"><header class="scout-hero"><button type="button" class="scout-portrait" data-inspect-zoom aria-expanded="false" aria-label="Enlarge portrait of ${esc(h.name)}"><img src="${src}" width="583" height="390" alt="Number ${h.num}, ${h.silk.toLowerCase()} silks" draggable="false"><span class="scout-zoom" aria-hidden="true">+</span></button><div class="scout-id"><div class="name-line"><i class="cloth cloth-${h.num}">${h.num}</i><h3 tabindex="-1">${esc(h.name)}</h3></div><p><span class="silk-text">${h.silk} silks</span><i aria-hidden="true"> · </i>${esc(h.style)}</p></div>${pair}</header>${panel(h.stats,state.formMode)}${formLine(h)}${prices(h,market,picks,pairOdds)}</article>`;
  }
  const api={profile,view,silks};root.RunnerBook=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
