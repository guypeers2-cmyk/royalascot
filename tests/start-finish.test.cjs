const test=require('node:test'),assert=require('node:assert/strict');
require('../js/bet-math');const {createMachine}=require('../js/engine'),G=require('../js/start-gate'),R=require('../js/race-receipt'),A=require('../js/audio');
const fixed=()=>.10,near=(a,b)=>Math.abs(a-b)<1e-9;
test('six pairs stay latched through positioning, swing forward without changing length, then clear the track',()=>{
 const model=t=>G.pose({phase:'race',clock:t});assert.equal(G.pose({phase:'betting',clock:50}),null);assert.equal(G.pose({phase:'result',clock:0}),null);assert.equal(G.leaves.length,12);
 const closed=G.pose({phase:'gates',clock:9.999});assert.equal(closed.angle,0);assert.equal(closed.released,false);assert.equal(model(0).angle,0);assert.equal(model(0).released,true);
 assert.ok(model(.04).angle>0&&model(.04).angle<model(.12).angle);assert.ok(near(model(G.OPEN).angle,Math.PI/2));assert.equal(model(G.CLEAR).lift,0);assert.ok(model(G.CLEAR+.1).lift>0);assert.equal(model(G.PARK),null);
 const slats=pose=>{const out=[];G.lines(pose,(a,b,w,m)=>{assert.ok(a[1]>=-1e-9&&b[1]>=-1e-9);if(m==='door')out.push([a,b]);});return out};const at=slats(closed),go=slats(model(G.OPEN));assert.equal(at.length,12*7);assert.equal(at.length,go.length);for(let i=0;i<at.length;i++){const length=([a,b])=>Math.hypot(...a.map((x,k)=>x-b[k]));assert.ok(near(length(at[i]),length(go[i])));assert.ok(at[i].every(q=>q[0]>=G.FRONT&&q[0]<=G.FRONT+.0081));assert.ok(go[i][1][0]>=G.FRONT-1e-9);assert.ok(Math.abs(go[i][0][2]-go[i][1][2])<.000001);}slats(model(3.08));
 assert.deepEqual(A.BELL.map(n=>n.slice(0,2)),[[784,0],[988,.11],[587,.27]]);
});
const run=g=>{g.close();g.tick(10);g.tick(g.remaining()+.5);};
test('read-only finish receipt snapshots all three winning prices and every accepted ticket at its locked odds',()=>{
 let save;const storage={getItem:()=>save,setItem:(_,v)=>save=v},g=createMachine({storage,random:fixed});for(const [m,p,v] of [['win',[1],10],['show',[2],10],['quinella',[2,1],20],['show',[1],5],['win',[6],5],['quinella',[1,3],5]])assert.equal(g.place(m,p,v),null);
 const board=[g.odds('win',[1]),g.odds('show',[2]),g.odds('quinella',[1,2])];run(g);const saved=JSON.stringify(g.state),rec=g.state.history[0],d=R.info(rec,g.state);assert.deepEqual(d.markets.map(m=>m.nums),[[1],[2],[1,2]]);assert.deepEqual(d.markets.map(m=>m.odds),board);assert.deepEqual(d.tickets.map(t=>t.hit),[true,true,true,false,false,false]);assert.equal(d.stake,55);assert.equal(d.paid,372);assert.equal(d.net,317);assert.equal(g.state.balance,817);
 for(let i=0;i<5;i++){assert.equal((R.view(rec,g.state).match(/data-outcome=/g)||[]).length,6);assert.equal(JSON.stringify(g.state),saved);}
 const view=R.view(rec,g.state);for(const [i,row] of [...view.matchAll(/<li class="(?:hit|miss)"[^>]*>(.*?)<\/li>/g)].entries()){const ticket=d.tickets[i];assert.deepEqual([...row[1].matchAll(/class="cloth cloth-(\d)"[^>]*>(\d)<\/i>/g)].map(m=>[+m[1],+m[2]]),ticket.nums.map(n=>[n,n]));for(const name of ticket.names)assert.ok(row[1].includes(name));}
 const reloaded=createMachine({storage,random:fixed});assert.equal(reloaded.state.balance,817);assert.deepEqual(R.info(reloaded.state.history[0],reloaded.state),d);reloaded.next();assert.equal(reloaded.state.balance,817);assert.deepEqual(R.info(reloaded.state.history[0],reloaded.state),d);
});
test('no-ticket, all-loss and pre-receipt archives never invent bets, dividends or payments',()=>{
 let g=createMachine({random:fixed});run(g);assert.equal(g.state.balance,500);let rec=g.state.history[0];assert.match(R.view(rec,g.state),/No tickets placed/);assert.equal(R.info(rec).net,0);const old=structuredClone(rec);delete old.winningPrices;assert.deepEqual(R.info(old,g.state).markets.map(m=>m.odds),[3.6,9.6,12]);g.next();assert.deepEqual(R.info(old,g.state).markets.map(m=>m.odds),[undefined,undefined,undefined]);
 g=createMachine({random:fixed});g.place('show',[1],5);run(g);rec=g.state.history[0];assert.equal(R.info(rec).paid,0);assert.equal(R.info(rec).net,-5);assert.match(R.view(rec),/−5/);
 g=createMachine({random:fixed});g.place('quinella',[1,2],5);run(g);rec=structuredClone(g.state.history[0]);delete rec.winningPrices;g.next();assert.deepEqual(R.info(rec,g.state).markets.map(m=>m.odds),[undefined,undefined,12]);
});
