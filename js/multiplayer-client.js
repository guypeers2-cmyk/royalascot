/* Authoritative shared-table & per-player medal persistence controller.
   Starts with display choice (Mobile / Tablet / Desktop), then Username + 4-digit PIN login.
   Saves medals per player on the server (Cloudflare Worker / Node) or locally when offline. */
(function(root){'use strict';
 const KEY='ascot-multiplayer-seat-v1',CODE='ascot-multiplayer-code-v1',NAME='ascot-multiplayer-name-v1',DEVICE='ascot-device-mode-v1',LOCAL_PLAYERS='ascot-local-players-v1';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 async function hashPin(pin){
   const raw='ascot-pin:'+String(pin??'').trim();
   try{
     if(root.crypto?.subtle&&typeof TextEncoder!=='undefined'){
       const buf=await root.crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
       return Array.from(new Uint8Array(buf),b=>b.toString(16).padStart(2,'0')).join('');
     }
   }catch{}
   let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619);}return 'fnv-'+(h>>>0).toString(16);
 }
 function readLocalDb(){try{const raw=JSON.parse(localStorage.getItem(LOCAL_PLAYERS)||'{}');return raw&&typeof raw==='object'?raw:{};}catch{return {};}}
 function writeLocalDb(db){try{localStorage.setItem(LOCAL_PLAYERS,JSON.stringify(db));}catch{}}
 function attach(game){
   const original={tick:game.tick,place:game.place,cancel:game.cancel,close:game.close,next:game.next,refill:game.refill,save:game.save,toggleSound:game.toggleSound,onChange:Object.getOwnPropertyDescriptor(game,'onChange')};
   let enabled=false,serverChecked=false,probeInFlight=null,joined=false,localUser=null,token='',tableCode='',polling=false,lastFresh=0,callback=null,oldState=null,profile=null,revision=-1,gate=null,onlineNames=[],gateStep='device',playersPinnedOpen=true;
   try{token=localStorage.getItem(KEY)||'';tableCode=localStorage.getItem(CODE)||'';}catch{}
   const $=id=>document.getElementById(id);
   const deviceLabelMap={mobile:'Mobile',tablet:'Tablet',desktop:'Desktop'};
   function recommendDevice(){const w=root.innerWidth||1280;return w<=580?'mobile':w<=1024?'tablet':'desktop';}
   function getDeviceMode(){try{const v=localStorage.getItem(DEVICE);if(v==='mobile'||v==='tablet'||v==='desktop')return v;}catch{}return recommendDevice();}
   let currentDevice=getDeviceMode();
   function applyDeviceMode(mode){
     if(mode!=='mobile'&&mode!=='tablet'&&mode!=='desktop')mode=recommendDevice();
     currentDevice=mode;
     if(typeof document!=='undefined'){
       document.documentElement.dataset.device=mode;
       const lbl=$('deviceLabel');if(lbl)lbl.textContent=deviceLabelMap[mode];
     }
     try{localStorage.setItem(DEVICE,mode);}catch{}
     try{root.dispatchEvent(new Event('resize'));}catch{}
   }
   applyDeviceMode(currentDevice);

   function saveLocalProfile(){
     if(enabled||!localUser)return;
     const db=readLocalDb(),key=localUser.name.toLocaleLowerCase();
     const s=game.state;
     db[key]={
       id:localUser.id,
       name:localUser.name,
       pinHash:localUser.pinHash,
       raceNo:s.raceNo,
       balance:Math.round((Number(s.balance)||0)*100)/100,
       bets:JSON.parse(JSON.stringify(s.bets||[])),
       history:JSON.parse(JSON.stringify((s.history||[]).slice(0,40))),
       payout:Number(s.payout)||0,
       updatedAt:Date.now()
     };
     writeLocalDb(db);
     updateLocalPlayersList(db);
   }
   function updateLocalPlayersList(){
     if(enabled)return;
     const s=game.state;
     onlineNames=localUser?[{id:localUser.id,name:localUser.name,balance:Math.round((Number(s.balance)||0)*100)/100,online:true,bets:JSON.parse(JSON.stringify(s.bets||[]))}]:[];
     setStatus(false);
   }

   Object.defineProperty(game,'onChange',{configurable:true,get:()=>callback,set:f=>{
     callback=f;
     if(!enabled)original.onChange?.set?.call(game,kind=>{saveLocalProfile();f?.(kind);});
   }});

   const notify=(text)=>root.dispatchEvent(new CustomEvent('ascot:network-error',{detail:text}));
   const headers=()=>({'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})});
   async function post(url,data){const r=await fetch(url,{method:'POST',headers:headers(),body:JSON.stringify(data),cache:'no-store'});const x=await r.json().catch(()=>({error:'The table returned an unreadable response.'}));if(!r.ok)throw Error(x.error||'The table request failed.');return x;}

   function updatePlayerBadge(){
     const badge=$('playerBadge');if(!badge)return;
     const name=profile?.name||localUser?.name||'';
     badge.textContent=name?`${name} · Switch`:'';
     badge.hidden=!name;
   }

   function syncPlayersMenuOpen(){
     const menu=$('playersMenu'),btn=$('playersButton'),isSignedIn=enabled?joined:!!localUser;
     if(!menu||!btn)return;
     if(!isSignedIn){menu.hidden=true;btn.setAttribute('aria-expanded','false');return;}
     menu.hidden=!playersPinnedOpen;
     btn.setAttribute('aria-expanded',String(playersPinnedOpen));
   }

   let hoveredPlayerId='';
   function renderHoveredBets(){
     const menu=$('playersMenu'),list=$('playersList');
     if(!menu||!list)return;
     let tip=$('playerBetsTip');
     if(!tip){
       tip=document.createElement('div');
       tip.id='playerBetsTip';
       tip.className='player-bets-tip';
       tip.hidden=true;
       list.after(tip);
     }
     if(!hoveredPlayerId){tip.hidden=true;tip.innerHTML='';return;}
     const player=onlineNames.find(x=>x&&x.online!==false&&x.id===hoveredPlayerId);
     if(!player){hoveredPlayerId='';tip.hidden=true;tip.innerHTML='';return;}
     const bets=Array.isArray(player.bets)?player.bets:[];
     const runners=game.state?.runners||[];
     const mName={win:'Win',show:'Show',quinella:'Quinella'};
     const items=bets.map(b=>{
       const picks=(b.nums||[]).map(n=>{const r=runners[n-1];return r?`#${n} ${esc(r.name)}`:`#${n}`;}).join(' + ');
       const odds=Number.isFinite(b.odds)?` @ ${Number(b.odds).toFixed(1)}×`:'';
       return `<li><b>${esc(mName[b.market]||b.market)}</b><span>${picks}</span><em>${Math.round(b.stake)}m${odds}</em></li>`;
     }).join('');
     tip.innerHTML=`<header><strong>${esc(player.name)} · Bets</strong><span>${bets.length}</span></header>${bets.length?`<ul>${items}</ul>`:'<p>No open bets on this race</p>'}`;
     tip.hidden=false;
   }

   function setStatus(offline=false){
     updatePlayerBadge();
     const wrap=$('playersWrap'),btn=$('playersButton'),cnt=$('playersCount'),list=$('playersList'),codeEl=$('playersTableCode'),copy=$('playersCopyCode');
     if(!wrap||!btn)return;
     const active=enabled||!!localUser;
     wrap.hidden=!active;
     if(!active)return;
     btn.dataset.offline=String(offline);
     if(copy)copy.hidden=!enabled;
     const isSignedIn=enabled?joined:!!localUser;
     if(!isSignedIn){if(cnt)cnt.textContent='Login';if(list)list.innerHTML='';hoveredPlayerId='';renderHoveredBets();syncPlayersMenuOpen();return;}
     const activePlayers=onlineNames.filter(x=>x&&x.online!==false);
     const n=activePlayers.length;
     if(cnt)cnt.textContent=enabled?`${n} active`:'Local only';
     if(codeEl)codeEl.textContent=enabled?(tableCode||''):'OFFLINE · NO SERVER';
     btn.title=enabled?`Active players (${n}). Hover a player to view bets.`:'Offline single-device mode (no shared multiplayer server detected).';
     btn.setAttribute('aria-label',btn.title);
     if(list){
       const meId=profile?.id||localUser?.id;
       const rows=activePlayers.map(x=>{
         const me=meId&&x.id===meId;
         const bal=Number.isFinite(x.balance)?`${Math.round(x.balance)}m`:'';
         const betCount=Array.isArray(x.bets)?x.bets.length:0;
         return `<li class="${me?'is-me':''}${hoveredPlayerId===x.id?' is-hover':''}" data-player-id="${esc(x.id)}" tabindex="0" title="Hover to view ${esc(x.name)}'s bets"><i class="players-dot" aria-hidden="true"></i><span class="p-name">${esc(x.name)}${me?' (you)':''}</span><span class="p-medals">${betCount?`${betCount}b · `:''}${esc(bal)}</span></li>`;
       }).join('')||'<li><span class="p-name">No active players</span></li>';
       list.innerHTML=enabled?rows:`${rows}<li class="players-offline-note"><span class="p-name">Single-device only — deploy Worker/server to share a table</span></li>`;
       renderHoveredBets();
     }
     syncPlayersMenuOpen();
   }

   function sendLeave(tok){
     if(!enabled||!tok||typeof fetch!=='function')return;
     try{fetch('/api/leave',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok},body:'{}',keepalive:true});}catch{}
   }

   function switchPlayerPrompt(msg='Enter your username and 4-digit PIN.'){
     const menu=$('playersMenu'),btn=$('playersButton');
     playersPinnedOpen=true;
     if(menu){menu.hidden=true;btn?.setAttribute('aria-expanded','false');}
     if(enabled){const oldTok=token;joined=false;token='';profile=null;try{localStorage.removeItem(KEY);}catch{}sendLeave(oldTok);}
     else{localUser=null;}
     setStatus(false);
     if(gate){const pinEl=gate.querySelector('input[name="pin"]');if(pinEl){pinEl.value='';syncPinDots(pinEl);}}
     showGate('login',msg);
   }

   function bindPlayersMenu(){
     const btn=$('playersButton'),menu=$('playersMenu'),copy=$('playersCopyCode'),sw=$('playersSwitchSeat'),devBtn=$('deviceButton'),badge=$('playerBadge');
     if(devBtn&&!devBtn.dataset.bound){
       devBtn.dataset.bound='1';
       devBtn.addEventListener('click',()=>showGate('device'));
     }
     if(badge&&!badge.dataset.bound){
       badge.dataset.bound='1';
       badge.addEventListener('click',()=>switchPlayerPrompt('Switch player: choose or type username & 4-digit PIN.'));
     }
     if(!btn||btn.dataset.bound)return;
     btn.dataset.bound='1';
     btn.addEventListener('click',()=>{
       const open=menu.hidden;
       playersPinnedOpen=open;
       for(const [mId,bId] of [['cameraMenu','cameraButton'],['qualityMenu','qualityButton'],['actionMenu','actionButton']]){
         const m=$(mId);if(m&&!m.hidden){m.hidden=true;$(bId)?.setAttribute('aria-expanded','false');}
       }
       menu.hidden=!open;btn.setAttribute('aria-expanded',String(open));
     });
     copy?.addEventListener('click',async()=>{
       if(!tableCode)return;
       try{await navigator.clipboard.writeText(tableCode);copy.textContent='Copied!';setTimeout(()=>{copy.textContent='Copy code';},1400);}catch{notify('Table join code: '+tableCode);}
     });
     sw?.addEventListener('click',()=>switchPlayerPrompt('Log in with your username & 4-digit PIN to load your medals.'));
     const list=$('playersList');
     if(list&&!list.dataset.hoverBound){
       list.dataset.hoverBound='1';
       const pick=e=>{
         const li=e.target.closest('li[data-player-id]');
         const id=li?.dataset?.playerId||'';
         if(id&&id!==hoveredPlayerId){
           hoveredPlayerId=id;
           list.querySelectorAll('li[data-player-id]').forEach(el=>el.classList.toggle('is-hover',el.dataset.playerId===id));
           renderHoveredBets();
         }
       };
       list.addEventListener('mouseover',pick);
       list.addEventListener('focusin',pick);
       list.addEventListener('mouseleave',()=>{
         if(!hoveredPlayerId)return;
         hoveredPlayerId='';
         list.querySelectorAll('li.is-hover').forEach(el=>el.classList.remove('is-hover'));
         renderHoveredBets();
       });
       list.addEventListener('focusout',e=>{
         if(!list.contains(e.relatedTarget)){
           hoveredPlayerId='';
           list.querySelectorAll('li.is-hover').forEach(el=>el.classList.remove('is-hover'));
           renderHoveredBets();
         }
       });
     }
   }

   function syncPinDots(input){
     if(!gate)return;
     const len=(input?.value||'').length;
     gate.querySelectorAll('#pinDots i').forEach((dot,idx)=>dot.classList.toggle('filled',idx<len));
   }

   function buildGate(){
     if(gate)return;
     gate=document.createElement('section');
     gate.id='sharedTableGate';
     gate.setAttribute('role','dialog');
     gate.setAttribute('aria-modal','true');
     gate.setAttribute('aria-labelledby','sharedGateTitle');
     gate.innerHTML=`
       <div class="shared-gate-card">
         <div class="shared-gate-top">
           <span class="shared-gate-kicker">HIPPODROME · ROYAL ASCOT</span>
           <span class="shared-gate-step" id="sharedGateStepBadge">STEP 1 OF 2</span>
         </div>
         <div id="gateStepDevice">
           <h1 id="sharedGateTitle">Choose your display</h1>
           <p>Select Mobile, Tablet, or Desktop to tune the racing cabinet and betting console before logging in.</p>
           <div class="device-grid" role="group" aria-label="Screen layout">
             <button type="button" class="device-card" data-device-pick="mobile">
               <span class="device-ico" aria-hidden="true">📱</span>
               <strong>Mobile</strong>
               <small>Compact vertical · thumb controls</small>
               <em class="device-rec">Recommended</em>
             </button>
             <button type="button" class="device-card" data-device-pick="tablet">
               <span class="device-ico" aria-hidden="true">📲</span>
               <strong>Tablet</strong>
               <small>Balanced studio · touch ready</small>
               <em class="device-rec">Recommended</em>
             </button>
             <button type="button" class="device-card" data-device-pick="desktop">
               <span class="device-ico" aria-hidden="true">🖥️</span>
               <strong>Desktop</strong>
               <small>Full widescreen · side terminal</small>
               <em class="device-rec">Recommended</em>
             </button>
           </div>
         </div>
         <div id="gateStepLogin" hidden>
           <div class="gate-device-pill">
             <span>Layout: <strong id="gateChosenDevice">Desktop</strong></span>
             <button type="button" id="gateBackDevice">Change</button>
           </div>
           <h1 id="sharedLoginTitle">Player login</h1>
           <div id="gateServerMode" class="gate-server-mode" data-mode="checking">Checking shared table server…</div>
           <p id="sharedLoginDesc">Enter your username and 4-digit PIN. Medals are saved separately for each player.</p>
           <div id="savedPlayerChips" class="saved-chips" hidden></div>
           <form id="sharedJoinForm" novalidate>
             <label>Username
               <input name="name" autocomplete="username" minlength="2" maxlength="20" placeholder="Enter your username" required>
             </label>
             <label><span class="pin-label-row"><span>4-digit PIN <small>(0–9)</small></span><span class="pin-dots" id="pinDots" aria-hidden="true"><i></i><i></i><i></i><i></i></span></span>
               <div class="pin-row">
                 <input name="pin" type="password" inputmode="numeric" pattern="[0-9]{4}" autocomplete="current-password" minlength="4" maxlength="4" placeholder="••••" required>
                 <button type="button" id="togglePinVis" aria-label="Show PIN">Show</button>
               </div>
             </label>
             <details class="gate-code-details" id="gateCodeRow" hidden>
               <summary>Table code: <b id="gateCodeSummary">ASCOT26</b></summary>
               <label>Table join code
                 <input name="code" autocomplete="off" autocapitalize="characters" minlength="4" maxlength="12" value="ASCOT26">
               </label>
             </details>
             <button type="submit" id="sharedLoginBtn">Log in &amp; Play</button>
             <output id="sharedGateError" aria-live="polite"></output>
           </form>
         </div>
         <small class="shared-gate-foot">New username = creates 500-medal account · Existing username = unlocks with 4-digit PIN</small>
       </div>`;
     document.body.append(gate);
     const style=document.createElement('style');
     style.textContent=`
       #sharedTableGate{position:fixed;inset:0;z-index:10000;display:grid;place-items:center;padding:18px;background:rgba(7,14,11,.92);backdrop-filter:blur(8px);font-family:system-ui,sans-serif;color:#f3ecd8;overflow-y:auto}
       #sharedTableGate[hidden]{display:none}
       .shared-gate-card{box-sizing:border-box;width:min(100%,520px);padding:clamp(20px,4vw,34px);background:linear-gradient(145deg,#1b3025,#101c17);border:1px solid #a88b58;border-radius:14px;box-shadow:0 24px 90px #0009}
       .shared-gate-top{display:flex;align-items:center;justify-content:space-between;gap:10px}
       .shared-gate-kicker,.shared-gate-step{font-size:.72rem;letter-spacing:.14em;color:#d8bd83;font-weight:600}
       .shared-gate-step{color:#a8b89f}
       .shared-gate-card h1{font:500 clamp(1.5rem,5vw,2.15rem)/1.1 Georgia,serif;margin:12px 0 8px}
       .shared-gate-card p{color:#d4d8ca;line-height:1.48;margin:0 0 14px;font-size:.92rem}
       .device-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:6px 0 4px}
       @media(max-width:520px){.device-grid{grid-template-columns:1fr}}
       .device-card{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;padding:16px 10px;border-radius:10px;border:1px solid #596c5b;background:#122019;color:#f5efd9;cursor:pointer;transition:border-color .15s,background-color .15s,transform .15s}
       .device-card:hover,.device-card.is-selected{border-color:#e2c280;background:#1d3126;transform:translateY(-1px)}
       .device-ico{font-size:1.75rem;line-height:1}
       .device-card strong{font-size:1rem;color:#f8e8c0}
       .device-card small{font-size:.74rem;line-height:1.3;color:#b8c3b1}
       .device-rec{display:none;font:600 .64rem/1 system-ui;letter-spacing:.08em;text-transform:uppercase;padding:3px 6px;border-radius:4px;background:#3a442d;color:#f1d796;border:1px solid #8a7a4a;margin-top:2px}
       .device-card.is-rec .device-rec{display:inline-block}
       .gate-device-pill{display:inline-flex;align-items:center;gap:10px;margin-top:12px;padding:5px 10px;border-radius:6px;background:#132119;border:1px solid #485848;font-size:.8rem;color:#cbd4c4}
       .gate-device-pill strong{color:#ebd197}
       .gate-device-pill button{padding:2px 8px;border-radius:4px;border:1px solid #756b4e;background:#223025;color:#f1dfb3;font-size:.75rem;cursor:pointer}
       .gate-server-mode{margin:0 0 10px;padding:7px 10px;border-radius:7px;font-size:.79rem;line-height:1.35;border:1px solid #485848;background:#132119;color:#cbd4c4}
       .gate-server-mode[data-mode="online"]{border-color:#5f8c67;background:#162d20;color:#b8e5be}
       .gate-server-mode[data-mode="offline"]{border-color:#9b6f41;background:#2b1f13;color:#f3cb96}
       .players-offline-note .p-name{font-size:.72rem;color:#e4be82;white-space:normal;line-height:1.3}
       .saved-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
       .saved-chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;border:1px solid #6a755f;background:#15251d;color:#f2e7ca;font-size:.8rem;cursor:pointer}
       .saved-chip:hover,.saved-chip.active{border-color:#e2c280;background:#22362b}
       .saved-chip b{color:#d8bd83;font-family:ui-monospace,monospace;font-size:.75rem}
       .shared-gate-card form{display:grid;gap:12px}
       .shared-gate-card label{display:grid;gap:5px;font-size:.88rem;color:#e8dfc8}
       .pin-label-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
       .pin-label-row small{color:#aeb7a7;font-size:.78rem}
       .pin-dots{display:inline-flex;gap:5px;align-items:center}
       .pin-dots i{width:8px;height:8px;border-radius:50%;border:1px solid #8a8e7a;background:transparent;transition:background-color .12s,border-color .12s}
       .pin-dots i.filled{background:#e2c280;border-color:#e2c280}
       .shared-gate-card input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #718071;border-radius:7px;background:#0e1914;color:#fff;font:inherit}
       .shared-gate-card input[name="pin"]{letter-spacing:.35em;font-family:ui-monospace,monospace;font-size:1.05rem}
       .shared-gate-card input:focus{outline:2px solid #e0c17f;outline-offset:2px}
       .pin-row{display:flex;gap:8px}
       .pin-row input{flex:1}
       .pin-row button{padding:0 12px;border:1px solid #637162;border-radius:7px;background:#192820;color:#e5dcc0;font-size:.82rem;cursor:pointer}
       .gate-code-details{font-size:.8rem;color:#b8c2b0}
       .gate-code-details summary{cursor:pointer;list-style:none;color:#c8c9b4;padding:2px 0}
       .gate-code-details summary b{color:#e6cb8e;font-family:ui-monospace,monospace}
       .gate-code-details label{margin-top:8px}
       .shared-gate-card form button[type=submit]{padding:12px;border:0;border-radius:7px;background:#d8b977;color:#1d2119;font:700 1rem system-ui;cursor:pointer}
       .shared-gate-card form button[type=submit]:hover{background:#e5c888}
       .shared-gate-card output{min-height:1.3em;color:#ffb4a8;font-size:.86rem}
       .shared-gate-foot{display:block;margin-top:10px;color:#aeb7a7;font-size:.78rem}`;
     document.head.append(style);

     gate.querySelectorAll('[data-device-pick]').forEach(btn=>{
       btn.addEventListener('click',()=>{
         applyDeviceMode(btn.dataset.devicePick);
         showGate('login');
       });
     });
     gate.querySelector('#gateBackDevice').addEventListener('click',()=>showGate('device'));
     const pinBtn=gate.querySelector('#togglePinVis'),pinInput=gate.querySelector('input[name="pin"]'),codeInput=gate.querySelector('input[name="code"]');
     pinInput.addEventListener('input',()=>{
       const clean=pinInput.value.replace(/\D/g,'').slice(0,4);
       if(pinInput.value!==clean)pinInput.value=clean;
       syncPinDots(pinInput);
     });
     codeInput?.addEventListener('input',()=>{
       const sum=gate.querySelector('#gateCodeSummary');
       if(sum)sum.textContent=(codeInput.value||'ASCOT26').trim().toUpperCase();
     });
     pinBtn.addEventListener('click',()=>{
       const show=pinInput.type==='password';
       pinInput.type=show?'text':'password';
       pinBtn.textContent=show?'Hide':'Show';
     });
     gate.querySelector('form').addEventListener('submit',joinSubmit);
   }

   function renderSavedChips(form){
     const box=gate?.querySelector('#savedPlayerChips');if(!box)return;
     if(enabled){box.hidden=true;box.innerHTML='';return;}
     const list=Object.values(readLocalDb()).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).slice(0,6);
     if(!list.length){box.hidden=true;box.innerHTML='';return;}
     box.hidden=false;
     const cur=(form.elements.name.value||'').trim().toLocaleLowerCase();
     box.innerHTML=list.map(p=>`<button type="button" class="saved-chip ${p.name.toLocaleLowerCase()===cur?'active':''}" data-fill-user="${esc(p.name)}"><span>${esc(p.name)}</span><b>${Math.round(p.balance)}m</b></button>`).join('');
     box.querySelectorAll('[data-fill-user]').forEach(btn=>{
       btn.addEventListener('click',()=>{
         form.elements.name.value=btn.dataset.fillUser;
         form.elements.pin.value='';
         syncPinDots(form.elements.pin);
         gate.querySelector('output').textContent=`Enter 4-digit PIN for ${btn.dataset.fillUser}`;
         box.querySelectorAll('.saved-chip').forEach(c=>c.classList.toggle('active',c===btn));
         form.elements.pin.focus();
       });
     });
   }

   function refreshGateState(error=''){
     if(!gate)return;
     const devStep=gate.querySelector('#gateStepDevice'),loginStep=gate.querySelector('#gateStepLogin'),badge=gate.querySelector('#sharedGateStepBadge');
     const isDevice=gateStep==='device';
     devStep.hidden=!isDevice;
     loginStep.hidden=isDevice;
     badge.textContent=isDevice?'STEP 1 OF 2 · DISPLAY':'STEP 2 OF 2 · LOGIN';
     const rec=recommendDevice();
     gate.querySelectorAll('[data-device-pick]').forEach(b=>{
       b.classList.toggle('is-rec',b.dataset.devicePick===rec);
       b.classList.toggle('is-selected',b.dataset.devicePick===currentDevice);
     });
     gate.querySelector('#gateChosenDevice').textContent=deviceLabelMap[currentDevice];
     const codeRow=gate.querySelector('#gateCodeRow'),codeInput=gate.querySelector('input[name="code"]'),codeSummary=gate.querySelector('#gateCodeSummary'),desc=gate.querySelector('#sharedLoginDesc'),modeBanner=gate.querySelector('#gateServerMode');
     if(codeRow){codeRow.hidden=!enabled;codeInput.required=enabled;}
     if(modeBanner){
       modeBanner.dataset.mode=enabled?'online':serverChecked?'offline':'checking';
       modeBanner.textContent=enabled
         ?'Shared table online · All players with the table code join the same live race'
         :serverChecked
           ?'Offline single-device mode — no multiplayer server at /api/info. Players on other browsers/devices will NOT be on the same table (deploy as Cloudflare Workers *.workers.dev, Vercel+Postgres, or npm start).'
           :'Checking shared table server…';
     }
     if(desc)desc.textContent=enabled
       ?'Log in with your username and 4-digit PIN. Races run continuously on the server and your medals stay saved.'
       :'Log in with your username and 4-digit PIN. Your medal balance is saved only in this browser until hosted on a multiplayer server.';
     const form=gate.querySelector('form'),errorOut=gate.querySelector('output');
     errorOut.textContent=error;
     let savedName='';try{savedName=localStorage.getItem(NAME)||'';}catch{}
     const urlCode=new URLSearchParams(location.search).get('code')||'';
     if(form.elements.name&&!form.elements.name.value)form.elements.name.value=savedName;
     if(form.elements.code&&!form.elements.code.value)form.elements.code.value=(urlCode||tableCode||'ASCOT26').toUpperCase();
     if(codeSummary&&form.elements.code)codeSummary.textContent=form.elements.code.value;
     syncPinDots(form.elements.pin);
     renderSavedChips(form);
     if(!isDevice)setTimeout(()=>form.elements[form.elements.name.value?'pin':'name'].focus(),20);
   }

   function showGate(step='device',error=''){
     buildGate();
     gateStep=step==='login'?'login':'device';
     gate.hidden=false;
     if(!enabled&&gateStep==='login')probeServer();
     refreshGateState(error);
   }

   function applySnapshot(snapshot){
     if(!snapshot)return false;
     if(typeof game.hydrate==='function')return game.hydrate(snapshot);
     if(!Array.isArray(snapshot.runners))return false;
     const fresh=JSON.parse(JSON.stringify(snapshot));
     for(const k of Object.keys(game.state))if(!(k in fresh))delete game.state[k];
     Object.assign(game.state,fresh);
     return true;
   }

   function activateLocalPlayer(record){
     localUser={id:record.id,name:record.name,pinHash:record.pinHash};
     const sameRace=record.raceNo===game.state.raceNo;
     if(!sameRace){record.bets=[];record.raceNo=game.state.raceNo;}
     const db=readLocalDb();
     db[record.name.toLocaleLowerCase()]=record;
     writeLocalDb(db);
     try{localStorage.setItem(NAME,record.name);}catch{}
     const sound=game.state.sound;
     applySnapshot({
       ...game.state,
       balance:Number.isFinite(record.balance)?record.balance:500,
       bets:sameRace&&Array.isArray(record.bets)?record.bets:[],
       history:Array.isArray(record.history)?record.history:[],
       payout:Number(record.payout)||0,
       sound
     });
     if(gate)gate.hidden=true;
     updateLocalPlayersList(db);
     callback?.('bet');
     callback?.(game.state.phase==='betting'?'new':game.state.phase);
   }

   async function joinSubmit(e){
     e.preventDefault();
     const form=e.currentTarget,btn=form.querySelector('#sharedLoginBtn'),out=form.querySelector('output');
     const name=form.elements.name.value.trim().replace(/\s+/g,' '),pin=form.elements.pin.value.replace(/\D/g,''),code=(form.elements.code?.value||'ASCOT26').trim().toUpperCase();
     if(name.length<2){out.textContent='Username must be at least 2 characters.';form.elements.name.focus();return;}
     if(!/^\d{4}$/.test(pin)){out.textContent='Enter an exact 4-digit PIN (0–9).';form.elements.pin.focus();return;}
     btn.disabled=true;btn.textContent='Logging in…';out.textContent='';
     try{
       await probeServer();
       if(enabled){
         const data=await post('/api/join',{name,pin,code});
         token=data.token;tableCode=data.tableCode||code;
         try{localStorage.setItem(KEY,token);localStorage.setItem(CODE,tableCode);localStorage.setItem(NAME,name);}catch{}
         accept(data.state);
       }else{
         const pHash=await hashPin(pin);
         const db=readLocalDb(),key=name.toLocaleLowerCase(),existing=db[key];
         if(existing){
           if(existing.pinHash&&existing.pinHash!==pHash)throw Error(`Incorrect 4-digit PIN for ${existing.name}.`);
           if(!existing.pinHash)existing.pinHash=pHash;
           existing.updatedAt=Date.now();
           activateLocalPlayer(existing);
         }else{
           const created={
             id:Math.random().toString(16).slice(2,14),
             name,
             pinHash:pHash,
             raceNo:game.state.raceNo,
             balance:500,
             bets:[],
             history:[],
             payout:0,
             updatedAt:Date.now()
           };
           activateLocalPlayer(created);
         }
       }
     }catch(err){
       out.textContent=err.message;
     }finally{
       btn.disabled=false;btn.textContent='Log in & Play';
     }
   }

   function phaseEvent(before,after){if(!before)return after.phase==='betting'?'new':after.phase==='gates'?'gates':after.phase==='race'?'race':'result';if(before.raceNo!==after.raceNo)return 'new';if(before.phase!==after.phase){if(after.phase==='betting')return 'new';return after.phase;}if(after.phase==='gates'&&before.boxCall!==after.boxCall&&after.boxCall)return 'boxed';if(before.balance!==after.balance||JSON.stringify(before.bets)!==JSON.stringify(after.bets))return 'bet';return '';}
   let pollTimer=null;function startPolling(){if(!pollTimer)pollTimer=setInterval(poll,220);}
   function accept(payload){if(!payload?.state)return;const state=payload.state;onlineNames=payload.players||[];profile=payload.player||profile;tableCode=payload.tableCode||tableCode;const sound=game.state.sound;const previous=oldState?JSON.parse(JSON.stringify(oldState)):null;applySnapshot({...state,sound});oldState=game.state;revision=payload.revision??revision;lastFresh=Date.now();joined=true;enabled=true;setStatus(false);if(gate)gate.hidden=true;const type=phaseEvent(previous,state);if(type&&callback)callback(type);startPolling();}
   async function poll(){if(!joined||polling)return;polling=true;try{const r=await fetch('/api/state',{headers:headers(),cache:'no-store'});if(r.status===401){joined=false;enabled=true;setStatus(true);showGate('login','Your saved seat is no longer available. Log in with username & 4-digit PIN.');return;}if(!r.ok)throw Error('Connection to the table was interrupted.');const data=await r.json();accept(data);}catch(err){setStatus(true);if(Date.now()-lastFresh>10000&&gate){gate.hidden=false;gate.querySelector('output').textContent='Reconnecting to the host…';}}finally{polling=false;}}
   async function command(action,data={}){if(!joined)return;try{const result=await post('/api/action',{action,data});accept(result);}catch(err){notify(err.message);}}
   function activateServer(){if(enabled)return;enabled=true;game.remote=true;bindPlayersMenu();setStatus(true);}

   game.tick=dt=>{if(!enabled){if(gate&&!gate.hidden)return;return original.tick(dt);}if(joined&&Date.now()-lastFresh<900&&Number.isFinite(dt)&&dt>0)game.state.clock+=Math.min(dt,.08);};
   game.place=(market,nums,amount)=>{if(!enabled){const res=original.place(market,nums,amount);if(!res)saveLocalProfile();return res;}command('place',{market,nums,amount});return null;};
   game.cancel=i=>{if(!enabled){const ok=original.cancel(i);if(ok)saveLocalProfile();return ok;}if(!joined)return false;command('cancel',{index:i});return true;};
   game.close=(...args)=>enabled?command('close'):original.close(...args);
   game.next=(...args)=>enabled?command('next'):original.next(...args);
   game.refill=(...args)=>{if(enabled){command('refill');return true;}const ok=original.refill(...args);if(ok)saveLocalProfile();return ok;};
   game.save=(...args)=>{if(enabled)return undefined;saveLocalProfile();return original.save(...args);};
   game.toggleSound=()=>{game.state.sound=!game.state.sound;if(callback)callback('sound');return game.state.sound;};

   if(typeof document!=='undefined'){
     bindPlayersMenu();
     showGate('device');
     root.addEventListener?.('pagehide',()=>{if(enabled&&joined&&token)sendLeave(token);});
   }

   function probeServer(){
     if(enabled)return Promise.resolve(true);
     if(typeof fetch!=='function'){serverChecked=true;return Promise.resolve(false);}
     if(probeInFlight)return probeInFlight;
     probeInFlight=fetch('/api/info',{cache:'no-store'}).then(r=>{
       const ct=r.headers?.get?.('content-type')||'';
       return r.ok&&ct.includes('application/json')?r.json():null;
     }).then(info=>{
       if(info?.enabled)activateServer();
       return enabled;
     }).catch(()=>false).finally(()=>{
       serverChecked=true;
       probeInFlight=null;
       if(gate&&!gate.hidden)refreshGateState();
     });
     return probeInFlight;
   }
   probeServer();

   return game;
 }
 root.AscotMultiplayer={attach};
})(globalThis);
