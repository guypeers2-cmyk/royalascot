/* Real elapsed frames in a race, not a frozen-clock camera-position test.
   Requires Playwright/Chromium (QA only). Run on a quiet host. ASCOT_SITE
   optionally routes a source tree locally; the default is the running game. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const env=process.env,renderer=env.ASCOT_RENDERER||'software',picture=env.ASCOT_ACTION_PICTURE||'auto',quality=env.ASCOT_QUALITY||'auto';
const flags={software:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],disabled:['--disable-webgl'],native:[]};
if(!['high','medium','low','auto'].includes(quality)||!flags[renderer]||!['auto','3d','film'].includes(picture))throw Error('Unknown renderer or Action picture');
function hook({raw,picture,quality}){
 if(raw){const s=JSON.parse(raw);if(s.phase!=='race')throw Error('Use a saved race checkpoint');s.clock=12;s.sound=false;localStorage.setItem('hippodrome-cabinet-3',JSON.stringify(s));}
 localStorage.setItem('ascot-render-quality',quality);localStorage.setItem('ascot-view-preference','6');localStorage.setItem('ascot-action-picture',picture);
 const watch=window.pacer={go:false,frames:[],raf:[],gl:false};let engine,cloth;
 Object.defineProperty(window,'AscotEngine',{get:()=>engine,set:v=>engine={...v,createMachine(o){let rng=42;const g=watch.game=v.createMachine({...o,random:()=>((rng=Math.imul(1664525,rng)+1013904223>>>0)/4294967296)});watch.step=g.tick;g.tick=t=>watch.go&&watch.step(t);return g;}}});
 Object.defineProperty(window,'AscotCloth',{get:()=>cloth,set:v=>cloth={...v,mark(ctx,n,...a){if(watch.go&&n===6&&ctx.canvas.id==='tableCanvas')watch.frames.push([performance.now(),'film']);return v.mark(ctx,n,...a);}}});
 let installed=false;function frame(){if(!installed&&window.THREE?.Scene){installed=true;const proto=THREE.Scene.prototype,was=proto.onAfterRender;proto.onAfterRender=function(r,...a){if(r.domElement.id==='orbitCanvas'){watch.gl=true;if(watch.go)watch.frames.push([performance.now(),'3d']);}return was?.call(this,r,...a);};}if(watch.go)watch.raf.push(performance.now());requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
function summary(times){if(times.length<3)return {frames:times.length};const dt=times.slice(1).map((v,i)=>v-times[i]).sort((a,b)=>a-b),q=n=>+dt[Math.min(dt.length-1,Math.floor(n*dt.length))].toFixed(1);return {frames:times.length,fps:+((times.length-1)*1000/(times.at(-1)-times[0])).toFixed(1),medianMs:q(.5),p95Ms:q(.95)};}
(async()=>{const browser=await chromium.launch({args:['--no-sandbox',...flags[renderer]]});try{
 const p=await browser.newPage({viewport:{width:1050,height:740},reducedMotion:'no-preference'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(hook,{raw:env.ASCOT_CHECKPOINT?fs.readFileSync(env.ASCOT_CHECKPOINT,'utf8'):null,picture,quality});
 if(env.ASCOT_SITE){await p.route('https://race-audit.test/**',r=>r.fulfill({path:path.join(path.resolve(env.ASCOT_SITE),new URL(r.request().url()).pathname.slice(1)||'index.html')}));await p.goto('https://race-audit.test/');}else await p.goto(env.ASCOT_URL||'http://127.0.0.1:3000/');
 await p.waitForFunction(()=>pacer.game);await p.evaluate(()=>{const g=pacer.game;if(g.state.phase==='betting'){g.close();pacer.step(10);pacer.step(12);}});
 await p.waitForFunction(()=>document.querySelector('#cameraName')?.textContent==='Action cam'&&(pacer.gl||document.querySelector('#orbitCanvas').hidden),null,{timeout:80000});
 await p.waitForTimeout(1600);await p.evaluate(()=>pacer.go=true);await p.waitForTimeout((+env.ASCOT_SECONDS||18.5)*1000);
 const {frames,raf,clock,size,tier}=await p.evaluate(()=>{pacer.go=false;const c=document.querySelector(document.querySelector('#orbitCanvas').hidden?'#tableCanvas':'#orbitCanvas');return {tier:document.querySelector('#viewWindow').dataset.renderTier,frames:pacer.frames,raf:pacer.raf,clock:pacer.game.state.clock,size:[c.width,c.height]};});
 if(errors.length||frames.length<2)throw Error(errors.join('; ')||'No moving action frames');const times=frames.map(v=>v[0]);console.log(JSON.stringify({renderer,picture,quality,tier,paths:[...new Set(frames.map(v=>v[1]))],all:summary(times),lastEightSeconds:summary(times.filter(t=>t>=times.at(-1)-8000)),animationCallbacks:summary(raf),raster:size,clock},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
