/* The synthetic six-runner checkpoint used by the High GL benches. No user
   save is required. Run directly to emit a portable checkpoint on stdout. */
'use strict';
module.exports=function traceCard(){
 const now=Date.now;let raw,seed=6107;
 try{Date.now=()=>1979000000000;require('../js/bet-math');const E=require('../js/engine');
  const storage={getItem:()=>raw,setItem:(_,v)=>{raw=v;}};
  const game=E.createMachine({storage,random:()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296)});
  for(let i=0;i<3;i++){game.close();game.tick(10);game.tick(200);game.next();}
  game.tick(27.3);game.place('win',[3],100);game.place('show',[4],50);game.place('quinella',[6,4],100);game.close();
  for(const dt of [4.9,1.35,3.75,42.125])game.tick(dt);game.save();return raw;
 }finally{Date.now=now;}
};if(require.main===module)process.stdout.write(module.exports());
