/* Stage genuine six-runner heats until the least experienced horse has five
   recorded finishes. Reading the book after every heat is the stop condition. */
(function(root){'use strict';
 const DEPTH=5;
 function shuffle(list,roll){const a=list.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(roll()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
 function stage(roster,openingField,depth,run){
   // A private stream seeded by the *existing* field: no market, ticket or
   // live outcome draws, including when repairing a partially stocked save.
   let seed=0xcab107;for(const h of openingField)seed=Math.imul(seed^Math.floor(h.seed*0x10000000),16777619)>>>0;
   const roll=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);let heats=0;
   while(roster.some(n=>depth(n)<DEPTH)){
     const pool=shuffle(roster,roll).sort((a,b)=>depth(a)-depth(b));
     run(++heats,shuffle(pool.slice(0,6),roll),roll);
   }return heats;
 }
 const api=Object.freeze({DEPTH,stage,shuffle});root.OpeningMeet=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
