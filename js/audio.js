/* Local station mix: a lock call, release cue, and six real trackside recordings.
   The microphone perspective never changes a race draw. */
(function(root){'use strict';
 const BELL=[[784,0,.16],[988,.11,.16],[587,.27,.24]];
 function voice(c,bus){
   const active=new Set(),rate=c.sampleRate,noise=c.createBuffer(1,Math.ceil(rate*.40),rate),samples=noise.getChannelData(0);let seed=1873;
   for(let i=0;i<samples.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;samples[i]=seed/2147483648-1;}
   function send(src,filter,t,len,vol,attack=.004,sustain=0){const g=c.createGain(),chain=filter?[src,filter,g]:[src,g];for(let i=1;i<chain.length;i++)chain[i-1].connect(chain[i]);g.connect(bus);g.gain.setValueAtTime(.00001,t);g.gain.exponentialRampToValueAtTime(vol,t+attack);if(sustain)g.gain.setValueAtTime(vol*.72,t+sustain);g.gain.exponentialRampToValueAtTime(.00004,t+len);const end=t+len+.012;src.onended=()=>{active.delete(src);chain.forEach(n=>n.disconnect())};active.add(src);src.start(t);src.stop(end);}
   function tone(f,len,v,w='sine',delay=0,end=0,attack=.004,sustain=0){const t=c.currentTime+delay,o=c.createOscillator();o.type=w;o.frequency.setValueAtTime(f,t);if(end)o.frequency.exponentialRampToValueAtTime(end,t+len);send(o,null,t,len,v,attack,sustain);}
   function hit(d,len,hz,q,vol){const src=c.createBufferSource(),f=c.createBiquadFilter();src.buffer=noise;f.type='bandpass';f.frequency.value=hz;f.Q.value=q;send(src,f,c.currentTime+d,len,vol,.0018);}
   function call(){// A compact, original two-horn call when the cashier locks.
     for(const [d,f,l] of [[0,392,.12],[.145,392,.12],[.31,523.25,.24],[.58,659.25,.32],[.96,523.25,.27]]){tone(f,l,.065,'triangle',d,0,.020,l*.52);tone(f*2,l*.83,.019,'sawtooth',d+.008,0,.017,l*.4);tone(f*.75,l,.032,'triangle',d+.012,0,.02,l*.45);}}
   function release(){for(const [f,d,l] of BELL)tone(f,l,.084,'triangle',d); // shared t=0 with opening leaves
     hit(0,.04,3100,.7,.32);tone(126,.10,.13,'triangle',0,54);for(const [i,d] of [0,.011,.024,.039,.056,.078].entries()){hit(d+.018,.062,950+i*210,1.1,.125);tone(420+i*89,.092,.026,'sine',d+.008);}
     hit(.092,.18,1750,1.1,.13);hit(.239,.07,725,.85,.18);tone(283,.16,.074,'sine',.245,206);hit(.303,.055,2600,1.2,.095);tone(817,.22,.024,'sine',.302);}
   function clip(buffer,level=.75){const o=c.createBufferSource(),g=c.createGain();g.gain.value=level;o.buffer=buffer;o.connect(g).connect(bus);active.add(o);o.onended=()=>{active.delete(o);o.disconnect();g.disconnect()};o.start();}
   return {tone,call,release,clip,stop(){for(const n of active)try{n.stop()}catch{}active.clear();}};
 }
 let ac=null,bus=null,mix=null,enabled=false,paused=false;
 const cues={call:{buffer:null,name:'',version:0,maxMB:16,maxS:60},release:{buffer:null,name:'',version:0,maxMB:4,maxS:10}};
 // These are local, verified recordings. FLAC preserves the decoded fanfare
 // in browsers without an AAC decoder. A missing codec never holds the race.
 const radioBook=root.RadioBook||(typeof require==='function'?require('./radio-book'):null);
 const masters={call:{files:['countdown-fanfare.m4a','countdown-fanfare.flac'],name:'Countdown fanfare',gain:1.5},release:{files:['start-gate-metal-door.mp3'],name:'Metal opening gates',gain:.75}};const hoof=Array.from({length:6},(_,i)=>({files:[`rail-hoof-${i+1}.mp3`]})),booth=[...radioBook.files,(root.PaddockRadio||(typeof require==='function'?require('./paddock-radio'):null)).file].map(file=>({files:[file]})),assets=[...Object.values(masters),...hoof,...booth];let preparation=null,decodedVersion=0;
 function dataBytes(uri){const raw=atob(uri.slice(uri.indexOf(',')+1)),a=new Uint8Array(raw.length);for(let j=0;j<a.length;j++)a[j]=raw.charCodeAt(j);return a.buffer;}
 async function prepare(){if(preparation)return preparation;return preparation=(async()=>{
   const C=root.OfflineAudioContext||root.webkitOfflineAudioContext;let dec;try{dec=new C(1,1,44100);}catch{assets.forEach(m=>m.missing=true);return false;}
   const aac=document.createElement('audio').canPlayType('audio/mp4; codecs="mp4a.40.2"');
   await Promise.all(assets.map(async m=>{for(const file of m.files){if(!aac&&file.endsWith('.m4a'))continue;
     try{const uri=root.ASCOT_AUDIO?.[file];let data;if(uri)data=dataBytes(uri);else{const res=await fetch('assets/'+file);if(!res.ok)continue;data=await res.arrayBuffer();}
       const decoder=booth.includes(m)?new C(1,1,16000):dec,buffer=await decoder.decodeAudioData(data);if(buffer.duration>.05){m.buffer=buffer;m.loaded=file;decodedVersion++;return;}}
     catch{/* The original AAC may be unsupported. Try its local FLAC twin. */}
   }m.missing=true;}));return assets.every(m=>!!m.buffer);
 })();}
 function signal(k){cutRadio();stopField();mix.stop();const custom=cues[k].buffer,m=masters[k];if(custom||m.buffer)mix.clip(custom||m.buffer,custom ? .75 : m.gain);else if(k==='call')mix.call();else mix.release();}
 function defaultName(k){const m=masters[k];return m.missing?(k==='call'?'Synthesized pre-start call':'Synthesized release'):m.name+' · recording';}
 function init(){if(ac)return;const C=root.AudioContext||root.webkitAudioContext;if(!C)throw Error('Audio is unavailable in this browser.');ac=new C();bus=ac.createGain();bus.gain.value=.00001;bus.connect(ac.destination);mix=voice(ac,bus);const motor=ac.createOscillator(),g=ac.createGain();motor.frequency.value=52;g.gain.value=.016;motor.connect(g).connect(bus);motor.start();}
 async function resume(){if(enabled&&!document.hidden&&!paused&&ac)await ac.resume().catch(()=>{});}
 async function set(on){enabled=on;try{if(on){init();await Promise.all([resume(),prepare()]);}else {cutRadio();stopField();mix?.stop();}if(ac){bus.gain.cancelScheduledValues(ac.currentTime);bus.gain.setTargetAtTime(enabled ? .60 : .00001,ac.currentTime,.025);}return true;}catch{enabled=false;return false;}}
 function play(type){if(!enabled||!ac||ac.state!=='running'||paused||document.hidden)return;const t=mix.tone;
   if(type==='bet'){t(1684,.16,.12);t(2473,.12,.055,'sine',.025);t(2070,.13,.06,'sine',.072);}else if(type==='tap')t(427,.048,.07,'sine',0,190);
   else if(type==='gates')signal('call');else if(type==='race')signal('release');else if(type==='result'){if(!air.winner)cutRadio();stopField();[523,659,784].forEach((f,i)=>t(f,.53,.09,'sine',[0,.14,.34][i]));}}
 // One independently stoppable source per cloth. The mic follows the horse's
 // actual position, speed and sprint; it never sees a future finish order.
 const field=new Map();let heatId=null,lastSample=-1,lastPin=null,lastDecode=-1,nextFinish=Infinity;
 function stopRunner(n){const v=field.get(n);if(!v)return;field.delete(n);try{v.src.stop();}catch{}v.src.disconnect();v.g.disconnect();v.pan?.disconnect();}
 function stopField(){for(const n of field.keys())stopRunner(n);heatId=null;lastSample=-1;nextFinish=Infinity;}
 function tick(game,pin=null){const s=game.state;if(s.phase!=='race'||!enabled){if(field.size)stopField();if(s.phase==='betting'&&enabled&&!paused&&ac?.state==='running'&&!document.hidden)preview(s);return;}
   if(paused||document.hidden||!ac||ac.state!=='running')return;
   if(heatId!==s.raceNo){stopField();heatId=s.raceNo;}
   // No ticking oscillators and no repeated starts on each animation frame.
   const sample=Math.floor(s.clock*12);if(sample===lastSample&&pin===lastPin&&lastDecode===decodedVersion&&s.clock<nextFinish)return;
   lastSample=sample;lastPin=pin;lastDecode=decodedVersion;nextFinish=Infinity;
   for(const h of s.runners){const n=h.num,buf=hoof[n-1].buffer;if(s.clock>=h.finish){stopRunner(n);continue;}if(!buf)continue;nextFinish=Math.min(nextFinish,h.finish);
     let v=field.get(n);const t=ac.currentTime,d=game.distance(h),u=d%1,angle=2*Math.PI*u;
     const from=Math.max(0,s.clock-.12),speed=s.clock>from?(d-game.distance(h,from))/(s.clock-from):.030;
     const rate=Math.min(1.24,Math.max(.80,.95+(speed-.030)*9+(game.sprint(h)==='active' ? .065 : 0)));
     const gain=(ac.currentTime<air.until ? .63 : 1)*(pin===n ? .57 : pin ? .12 : .25)*(.68+.32*Math.cos(angle));
     const pan=Math.max(-.83,Math.min(.83,.52*Math.sin(angle)+.46*(h.lane-.5)));
     if(!v){const src=ac.createBufferSource(),g=ac.createGain(),p=ac.createStereoPanner?.();
       src.buffer=buf;src.loop=true;src.playbackRate.value=rate;g.gain.value=0;src.connect(g);if(p){p.pan.value=pan;g.connect(p).connect(bus);}else g.connect(bus);
       v={src,g,pan:p};field.set(n,v);src.start(0,(s.clock*rate+h.seed*.11+n*.087)%buf.duration);
     }
     v.g.gain.setTargetAtTime(gain,t,.06);v.src.playbackRate.setTargetAtTime(rate,t,.08);v.pan?.pan.setTargetAtTime(pan,t,.08);
   }
 }
 // One voice on air. Name and call use the same local, aligned recording.
 // Change level and pace of the actual sound, not just the caption styling.
 const air={nodes:[],until:0,gain:null,winner:false,key:'',level:0,native:false};
 function cutRadio(){if(air.key.startsWith('preview:'))air.key='';const old=air.nodes;air.nodes=[];for(const src of old)try{src.stop();}catch{}if(air.native)try{root.speechSynthesis?.cancel()}catch{}air.native=false;air.gain?.disconnect();air.gain=null;air.until=0;air.winner=false;air.level=0;}
 function announce(e,heat,age){const key=heat+':'+e.id;if(air.key===key)return;air.key=key;if(e.silent)return;
   if(age>1.15||age<-.001||!enabled||!ac||ac.state!=='running'||paused||document.hidden)return;
   const level=RaceRadio.levels[e.level-1],t=ac.currentTime;if(e.dynamic){cutRadio();air.level=e.level;speak([],e.line,level,t,.018,1+(e.level-1)*.035);return;}if(t<air.until&&e.level<=air.level&&e.kind!=='wire')return;cutRadio();air.level=e.level;air.winner=e.kind==='wire';
   const firstName=radioBook.lines.length,names=AscotEngine.names,v=names.indexOf(e.name),name=firstName+(v<0?names.length+e.n-1:v),ids=!e.n?[e.id]:e.prefix?[name,e.id]:[e.id,name];
   speak(ids.map(i=>radioBook.clips[i]),e.line,level,t,e.kind==='start'?.22:.018,1+(e.level-1)*.035);
 }
 let cardNo=-1,review=[];const previewLevel={gain:.54,rate:1};
 function preview(s){if(s.raceNo!==cardNo){cardNo=s.raceNo;review=[];}
   // A late unmute joins the current introduction only if it can finish.
   // Never queue six stale introductions under the gates or the opening call.
   const P=root.PaddockRadio,idx=Math.max(0,Math.min(6,Math.floor((s.clock-P.OPENING)/P.SLOT))),e=review[idx]||(review[idx]=P.cue(s,root.AscotEngine.names));
   if(air.key===e.key||s.clock<e.at||s.clock+e.clips.reduce((n,c)=>n+c[1]+.025,0)>e.end||!e.clips.every(c=>booth[c[2]||0].buffer||booth[c[2]||0].missing))return;
   cutRadio();air.key=e.key;air.level=1;speak(e.clips,e.line,previewLevel,ac.currentTime,.025,1);
 }
 function speak(clips,line,level,t,delay,pitch){
   if(!clips.length||clips.some(c=>!booth[c[2]||0].buffer)){const synth=root.speechSynthesis,voices=synth?.getVoices().filter(v=>v.localService&&/^en/i.test(v.lang));if(!voices?.length||!root.SpeechSynthesisUtterance)return;const u=new SpeechSynthesisUtterance(line);u.voice=voices.find(v=>/^en-GB/i.test(v.lang))||voices[0];u.rate=level.rate;u.volume=level.gain;u.pitch=pitch;air.native=true;air.until=t+2;synth.speak(u);return;}
   const gain=ac.createGain();gain.gain.value=level.gain;gain.connect(bus);air.gain=gain;let when=t+delay;
   for(const [start,seconds,bank=0] of clips){const src=ac.createBufferSource();src.buffer=booth[bank].buffer;src.playbackRate.value=level.rate;src.connect(gain);air.nodes.push(src);src.onended=()=>{src.disconnect();if(air.gain===gain&&air.nodes.at(-1)===src){gain.disconnect();air.gain=null;air.nodes=[];}};src.start(when,start,seconds);when+=seconds/level.rate+.025;}air.until=when;
 }
 // Independent, session-only slots. A slow decode must not overwrite a more
 // recent choice/reset; an invalid import never replaces the last good file.
 async function useCue(kind,file){const slot=cues[kind];if(!slot)throw Error('Unknown audio cue.');const version=++slot.version;if(!file){slot.buffer=null;slot.name='';return;}if(file.size>slot.maxMB*1024*1024)throw Error(`Choose an audio clip under ${slot.maxMB} MB.`);const C=root.OfflineAudioContext||root.webkitOfflineAudioContext;if(!C)throw Error('Audio import is unavailable here.');const decoder=new C(1,1,44100);let data;try{data=await decoder.decodeAudioData(await file.arrayBuffer());}catch{if(slot.version!==version)return;throw Error('This browser could not read that audio file.');}if(slot.version!==version)return;if(data.duration>slot.maxS||data.duration<.05)throw Error(`Choose a clip between 0.05 and ${slot.maxS} seconds.`);slot.buffer=data;slot.name=file.name;}
 if(typeof document!=='undefined'){if(root.requestIdleCallback)root.requestIdleCallback(prepare,{timeout:700});else setTimeout(prepare,50);document.addEventListener('visibilitychange',()=>{if(document.hidden){cutRadio();ac?.suspend().catch(()=>{});}else resume();});root.CabinetAudio={set,play,tick,prepare,announce,cutRadio,defaultName,builtinFile:k=>masters[k]?.loaded||'',useCue,useGate:f=>useCue('release',f),get gateName(){return cues.release.name},cueName:k=>cues[k]?.name||'',pause(){paused=true;cutRadio();ac?.suspend().catch(()=>{})},resume(){paused=false;resume()}};}
 root.GateSoundDesign={voice,BELL};if(typeof module!=='undefined'&&module.exports)module.exports=root.GateSoundDesign;
})(globalThis);
