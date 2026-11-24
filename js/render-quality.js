/* Render policy only. The race model neither imports this module nor reads
   browser, frame rate, camera, local preference or capability information. */
(function(root){'use strict';const names=['high','medium','low'],key='ascot-render-quality';
 const profiles=[
   {dpr:2,canvas:3600000,film:1400000,orbit:3200000,chase:2400000,seat:2},
   {dpr:1.35,canvas:740000,film:350000,orbit:720000,chase:520000,seat:1.15},
   {dpr:1,canvas:340000,film:145000,orbit:280000,chase:210000,seat:.75}
 ].map(Object.freeze);
 function density(w,h,dpr,level,surface){const p=profiles[level],limit=surface==='chase'?1.85:surface==='orbit'?2:surface==='film'?1.6:2;return Math.min(dpr||1,p.dpr,limit,Math.sqrt(p[surface]/Math.max(1,w*h)));}
 function hint(memory,cores){const dev=typeof document!=='undefined'?document.documentElement?.dataset?.device:'';const compact=dev==='mobile'||dev==='tablet'||(dev!=='desktop'&&typeof window!=='undefined'&&((window.innerWidth&&window.innerWidth<=760)||window.matchMedia?.('(pointer:coarse)').matches));if(memory>0&&memory<=2||cores>0&&cores<=2)return 2;if(!compact&&dev==='desktop')return 0;if(!compact&&(memory==null||memory>=4)&&(cores==null||cores>=4))return 0;return 1;}
 function create(storage,{deviceMemory,hardwareConcurrency}={}){let initial=hint(deviceMemory,hardwareConcurrency);const best=deviceMemory>0&&deviceMemory<=2?1:0;let mode='auto',floor=0,auto=initial,last=null,n=0,slow=0,ms=0,headroom=0,cool=0;
   try{const v=storage?.getItem(key);if(names.includes(v))mode=v;}catch{}const level=()=>mode==='auto'?Math.max(auto,floor):names.indexOf(mode);
   function windowReset(){ms=n=slow=0;}function reset(){windowReset();last=null;headroom=0;}
   function set(v){if(v!=='auto'&&!names.includes(v))return false;mode=v;auto=initial;cool=0;reset();try{storage?.setItem(key,v);}catch{}return true;}
   function refreshHint(){initial=hint(deviceMemory,hardwareConcurrency);if(mode==='auto'){auto=initial;cool=0;reset();return true;}return false;}
   // Observe uninterrupted *race* frames, not menu pauses, test-clock seeks,
   // browser switches or output frame caps. Require a window, not one hitch.
   function sample(now,clock){if(mode!=='auto'||floor===2)return false;const prev=last;last={now,clock};if(!prev)return false;const dt=now-prev.now,dc=(clock-prev.clock)*1000;
     if(dt<=0||dc<=0||Math.abs(dt-dc)>Math.max(14,dt*.16)){windowReset();headroom=0;return false;}
     const threshold=[22,30,44][auto];ms+=dt;n++;if(dt>threshold)slow++;if(ms<500||n<4)return false;
     const overloaded=slow/n>=.68,fast=ms/n<19&&slow===0;headroom=fast?headroom+ms:0;windowReset();
     if(overloaded&&auto<2){auto++;cool=now+14000;reset();return true;}if(auto>best&&now>=cool&&headroom>=9000){auto--;cool=now+14000;reset();return true;}return false;}
   return {get mode(){return mode;},get level(){return level();},get label(){return names[level()];},set,reset,sample,refreshHint,software(on){floor=on?2:0;reset();}};}
 const api={profiles,names,hint,density,create};root.AscotQuality=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
