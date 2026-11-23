/* A receipt for the actual picture, not a comparison of two model constants.
   Read the ink of each quiet team from its emitted drawImage crop and the
   front/rear posts from Canvas strokes after all drawing transforms. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), {chromium} = require('playwright');
function instrument() {
  let E, V;
  Object.defineProperty(window,'AscotEngine',{get:()=>E,set:v=>E={...v,createMachine(opts){const g=window.heat=v.createMachine({...opts,random:()=>.1});window.step=g.tick;g.tick=()=>{};return g;}}});
  Object.defineProperty(window,'CabinetScene',{get:()=>V,set:v=>V={...v,makeScene(...args){return window.camera=v.makeScene(...args);}}});
  const P=CanvasRenderingContext2D.prototype, move=P.moveTo, line=P.lineTo, stroke=P.stroke, draw=P.drawImage, paths=new WeakMap(), crops=new WeakMap();
  const pt=(m,x,y)=>[m.a*x+m.c*y+m.e, m.b*x+m.d*y+m.f];
  P.moveTo=function(x,y){if(window.exposure)paths.set(this,[pt(this.getTransform(),x,y)]);return move.apply(this,arguments);};
  P.lineTo=function(x,y){if(window.exposure&&paths.has(this))paths.get(this).push(pt(this.getTransform(),x,y));return line.apply(this,arguments);};
  P.stroke=function(){if(window.exposure&&this.strokeStyle===AscotGate.colors.frame){const q=paths.get(this);if(q?.length===2){const [a,b]=q,dy=a[1]-b[1];if(dy>8*Math.abs(this.getTransform().d)&&Math.abs(a[0]-b[0])<dy*.08)exposure.posts.push(b);}}return stroke.apply(this,arguments);};
  P.drawImage=function(im,...a){if(window.exposure&&a.length===8&&im instanceof HTMLImageElement&&im.naturalWidth===1848&&im.naturalHeight===245&&this.globalAlpha>.995){
    const [sx,sy,sw,sh,x,y,w,h]=a;
    let cache=crops.get(im);if(!cache){cache=new Map();crops.set(im,cache);}let ink=cache.get(sx);
    if(!ink){const c=document.createElement('canvas');c.width=sw;c.height=sh;const cg=c.getContext('2d',{willReadFrequently:true});draw.call(cg,im,sx,sy,sw,sh,0,0,sw,sh);const rgba=cg.getImageData(0,0,sw,sh).data;
      let l=sw,r=-1,t=sh,b=-1;for(let j=0;j<sh;j++)for(let i=0;i<sw;i++)if(rgba[(j*sw+i)*4+3]>12){l=Math.min(l,i);r=Math.max(r,i);t=Math.min(t,j);b=Math.max(b,j);}ink=[l/sw,t/sh,(r+1)/sw,(b+1)/sh];cache.set(sx,ink);}
    if(!exposure.srcs)exposure.srcs=Array.from({length:6},(_,i)=>{const n='standing-'+(i+1)+'.webp';return window.ASCOT_ASSETS?.[n]||new URL('assets/'+n,location.href).href;});
    const n=1+exposure.srcs.indexOf(im.src),m=this.getTransform();exposure.teams[n]=[...pt(m,x+w*ink[0],y+h*ink[1]),...pt(m,x+w*ink[2],y+h*ink[3])];
  }return draw.call(this,im,...a);};
}
(async()=>{const off=process.env.ASCOT_OFFLINE,b=await chromium.launch({args:['--no-sandbox','--disable-webgl']});try{
  const p=await b.newPage({viewport:{width:1280,height:760},reducedMotion:'reduce'}),errors=[],requests=[];p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(instrument);let f=p;
  if(off){await p.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort();});await p.setContent('<style>*{margin:0}iframe{width:100vw;height:100dvh;border:0}</style><iframe sandbox="allow-scripts"></iframe>');const ready=p.waitForEvent('framenavigated',v=>v.url()==='about:srcdoc');await p.evaluate(s=>document.querySelector('iframe').srcdoc=s,fs.readFileSync(off,'utf8'));f=await ready;}else await p.goto(process.env.ASCOT_URL||'http://127.0.0.1:3000/');
  await f.locator('#tubeRows button').first().waitFor();await f.locator('[data-tube=start]').click();await f.evaluate(()=>step(7));await f.locator('#livePanel[data-mode=boxed]').waitFor();
  const mins=[1,1];let count=0;
  for(const [w,h] of [[1280,760],[390,844],[568,320]]){await p.setViewportSize({width:w,height:h});for(const cam of [1,0,5]){
    await f.evaluate(n=>{camera.setCamera(n);camera.size();},cam);
    await f.waitForFunction(()=>{window.exposure={posts:[],teams:{}};try{camera.draw(performance.now(),null,true);if(Object.keys(exposure.teams).length!==6||!exposure.posts.length)return false;window.recorded={teams:exposure.teams,posts:exposure.posts};return true;}finally{window.exposure=null;}});
    const {teams,posts}=await f.evaluate(()=>recorded);assert.equal(posts.length,14,`${w}x${h} camera ${cam}: seven pairs of actually painted uprights`);assert.equal(Object.keys(teams).join(), '1,2,3,4,5,6');posts.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
    const walls=Array.from({length:7},(_,i)=>posts.slice(2*i,2*i+2).sort((a,b)=>a[0]-b[0]));
    for(let i=0;i<6;i++){const [wheel,top,nose]=teams[i+1],[a,c]=walls[i],[b,d]=walls[i+1],back=(a[0]+b[0])/2,front=(c[0]+d[0])/2,roof=(a[1]+b[1])/2;
      const rear=(wheel-back)/(front-back),lead=(front-nose)/(front-back);assert.ok(rear>.025&&lead>.025&&top>roof+1,`${w}×${h} camera ${cam}, bay ${i+1}: wheel ${rear}, nose ${lead}, roof ${roof}, ears ${top}`);mins[0]=Math.min(mins[0],rear);mins[1]=Math.min(mins[1],lead);count++;}
  }}assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);console.log(`PASS ${count} actual parked teams, Rail/seat/table and three screen sizes. Smallest rear/front ink margins: ${mins.map(n=>(100*n).toFixed(1)+'%').join(' / ')} of a bay. ${off?'Opaque offline, zero network.':'Hosted.'}`);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1);});
