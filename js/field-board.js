/* One real field, not multiple console pages. The same six focusable rows
   keep their identity when the glass, enlarged text, or active market changes. */
(function(root){'use strict';root.AscotFieldBoard=function(tube){
 const by=id=>document.getElementById(id),field=by('tubeField'),list=by('tubeRows'),cab=by('cabinet');let raf=0,last='',first=null;
 function sync(){if(tube.hidden||!list.firstElementChild)return;
   if(!cab.classList.contains('station-full')){const top=Math.min(320,Math.max(0,Math.round(cab.getBoundingClientRect().top+scrollY)))+'px';if(cab.style.getPropertyValue('--station-top')!==top)cab.style.setProperty('--station-top',top);}
   const rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16,full=field.clientWidth,w=list.clientWidth,h=field.clientHeight,rows=[...list.children];
   const key=[w,full,h,rem,innerHeight,by('tubeMarket').textContent,rows.map(b=>b.querySelector('.entry-prices').textContent).join('/')].join('|');if(first===rows[0]&&key===last)return;first=rows[0];last=key;
   field.dataset.tight=String(h<18*rem);field.dataset.ribbon=String(full>=50*rem||full>=20*rem&&h<14*rem);list.removeAttribute('data-scroll');
   function tryFit(mode,cols){field.dataset.sheet=mode;list.style.setProperty('--cols',cols);const bounds=list.getBoundingClientRect();return list.scrollHeight<=list.clientHeight+1&&list.scrollWidth<=list.clientWidth+1&&rows.every(b=>{const r=b.getBoundingClientRect();return r.right<=bounds.right+.6&&r.bottom<=bounds.bottom+.6&&b.scrollWidth<=b.clientWidth+1&&b.scrollHeight<=b.clientHeight+1;});}
   // Preserve full ratings and L5 while they fit. Never trade away the name,
   // running style, win estimate or active-market price just to fit a screen.
   if(w>=51*rem&&tryFit('table',1))return;
   const wide=w>=31*rem,cols=wide?[2,3,1]:[1,2];
   for(const n of cols)if(w/n>=13.8*rem&&tryFit('card',n))return;
   for(const n of (w>=23*rem?[2,3,1]:[1,2]))if(w/n>=7*rem&&tryFit('compact',n))return;
   const order=w>=3*Math.min(5*rem,93)?[3,2,1]:[2,1];for(const n of order)if(w/n>=Math.min(5*rem,93)&&tryFit('pocket',n))return;
   // Very small embeds / extreme text zoom: scroll the field only. The
   // denominations, active market and Place bet key stay fixed to the glass.
   tryFit('pocket',Math.max(1,Math.min(3,Math.floor(w/(7*rem)))));list.dataset.scroll='true';
 }
 function queue(){if(!raf)raf=requestAnimationFrame(()=>{raf=0;sync();});}
 const observer=new ResizeObserver(queue);[tube,field,by('viewWindow'),document.documentElement].forEach(el=>observer.observe(el));window.addEventListener('resize',queue);document.fonts?.ready.then(()=>{last='';queue();});
 return {queue,focus(n){const b=list.querySelector(`[data-tube-pick="${n}"]`);if(b){b.focus({preventScroll:true});if(list.dataset.scroll)b.scrollIntoView({block:'nearest'});}}};
};})(globalThis);
