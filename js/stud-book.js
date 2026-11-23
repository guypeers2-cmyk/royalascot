/* Compact station record, keyed by the horse's name, not its current cloth.
   Kept independently of the 40 receipt slots. Never generates fictional form. */
(function(root){'use strict';function entry(){return {starts:0,wins:0,recent:[]}}function count(book,rec){for(const h of rec.field||[]){const place=(rec.order||[]).indexOf(h.num)+1;if(!place||!h.name)continue;const e=book[h.name]||(book[h.name]=entry());if(!Array.isArray(e.recent)||(e.recent[0]?.source!=='qualifier'&&(e.recent[0]?.race??0)>=rec.raceNo))continue;if(h.atStart?.stats)e.lastRatings={...h.atStart.stats};e.starts++;if(place===1)e.wins++;e.recent.unshift({race:rec.raceNo,place,seconds:h.finish,...(rec.source==='warmup'?{source:'warmup'}:{})});e.recent.length=Math.min(5,e.recent.length);}}
 // Q numbers are in a separate, earlier meeting. They never block a real R001.
 function addQualifiers(book,earlier){for(const [name,q] of Object.entries(earlier)){
   const e=book[name]||(book[name]=entry());if(!e.starts&&q.lastRatings)e.lastRatings={...q.lastRatings};
   e.starts+=q.starts;e.wins+=q.wins;e.recent=e.recent.concat(q.recent.map(f=>({...f,source:'qualifier'}))).slice(0,5);
 }}
 const oldAfter=new WeakMap(),after=h=>h.stationAfter||oldAfter.get(h);
 function rebuild(history,attachReceipts=false){const b={};for(const r of (history||[]).slice().reverse()){count(b,r);if(attachReceipts)for(const h of r.field){const e=b[h.name];if(e&&!h.stationAfter)oldAfter.set(h,{wins:e.wins,starts:e.starts});}}return b;}
 // Recover known positions from the receipt file before simulating anything.
 // A short archive is not evidence that a larger lifetime total was wrong.
 function recover(book,known){let changed=false;for(const [name,k] of Object.entries(known)){
   const e=book[name];if(!e){book[name]=k;changed=true;continue;}if(e.recent?.length>=5)continue;
   const old=e.recent||[],real=old.filter(f=>f.source!=='qualifier'),missing=k.recent.filter(f=>!real.some(v=>v.race===f.race));
   if(!missing.length)continue;e.recent=real.concat(missing).sort((a,b)=>b.race-a.race).concat(old.filter(f=>f.source==='qualifier')).slice(0,5);
   e.starts=Math.max(k.starts,e.starts||0,e.recent.length);e.wins=Math.max(k.wins,e.wins||0);if(!e.lastRatings&&k.lastRatings)e.lastRatings={...k.lastRatings};changed=true;
 }return changed;}
 function get(state,name){return (state.studBook||rebuild(state.history))[name]||entry();}
 function copy(e){return {starts:e.starts,wins:e.wins,recent:e.recent.map(f=>({...f}))};}
 const api={entry,count,rebuild,get,copy,addQualifiers,after,recover};root.StudBook=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
