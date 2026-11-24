'use strict';
// One authoritative race shared by nickname-based players. Wagers and medal
// balances stay personal; the race draw, clock and finish are table-wide.
// Includes exclusive administrator account, permanent history archive, and server reset.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('./js/bet-math.js');require('./js/race-performance.js');require('./js/race-day.js');require('./js/stud-book.js');require('./js/opening-meet.js');require('./js/course.js');require('./js/marshal.js');
const Engine=require('./js/engine.js'),Maths=globalThis.HippoBetMath;
const clone=v=>JSON.parse(JSON.stringify(v));
function makeCode(){return crypto.randomBytes(4).toString('hex').slice(0,6).toUpperCase();}
function cleanName(v){return String(v??'').replace(/[<>\u0000-\u001f]/g,'').trim().replace(/\s+/g,' ').slice(0,20);}
function cleanAdminName(v){return String(v??'').replace(/[<>\u0000-\u001f]/g,'').trim().replace(/\s+/g,' ').slice(0,24);}
function hashPin(v){const s=String(v??'').trim();return s?crypto.createHash('sha256').update('ascot-pin:'+s).digest('hex'):'';}
function checkPinFormat(pin){if(pin&&!/^\d{4}$/.test(pin))throw Error('PIN must be exactly 4 digits (0-9).');}
function hashAdminSecret(secret,salt){let buf=Buffer.from(`${salt}:${secret}`,'utf8');for(let i=0;i<4096;i++)buf=crypto.createHash('sha256').update(buf).digest();return buf.toString('hex');}
function sha256Hex(v){return crypto.createHash('sha256').update(String(v??''),'utf8').digest('hex');}
function safeEqualHex(a,b){if(typeof a!=='string'||typeof b!=='string'||!a.length||a.length!==b.length)return false;try{return crypto.timingSafeEqual(Buffer.from(a,'utf8'),Buffer.from(b,'utf8'));}catch{return false;}}
const ADMIN_SESSION_TTL=24*60*60*1000;
function createRoom({dataDir=path.join(__dirname,'data'),joinCode=process.env.ASCOT_TABLE_CODE||makeCode(),capacity=50,initialDb=null,autoTick=true,onPersist=null,adminUser=process.env.ASCOT_ADMIN_USER||'',adminPassword=process.env.ASCOT_ADMIN_PASSWORD||''}={}){
 const file=dataDir?path.join(dataDir,'table.json'):null;if(dataDir)fs.mkdirSync(dataDir,{recursive:true});let db=initialDb&&initialDb.version===1&&initialDb.players?clone(initialDb):{version:1,cabinet:null,players:{}};
 if(file)try{const raw=JSON.parse(fs.readFileSync(file,'utf8'));if(raw?.version===1&&raw.players&&typeof raw.players==='object')db=raw;}catch{}
 function normalizeDb(target){
   if(!target||typeof target!=='object')target={version:1,cabinet:null,players:{}};
   if(!target.players||typeof target.players!=='object')target.players={};
   if(target.admin===undefined)target.admin=null;
   if(!target.archive||typeof target.archive!=='object')target.archive={sessionNo:1,races:[],resets:[],auditLog:[]};
   if(!Number.isInteger(target.archive.sessionNo)||target.archive.sessionNo<1)target.archive.sessionNo=1;
   if(!Array.isArray(target.archive.races))target.archive.races=[];
   if(!Array.isArray(target.archive.resets))target.archive.resets=[];
   if(!Array.isArray(target.archive.auditLog))target.archive.auditLog=[];
   return target;
 }
 db=normalizeDb(db);
 let activeJoinCode=(typeof db.joinCode==='string'&&db.joinCode.trim())?db.joinCode.trim().toUpperCase():String(joinCode||makeCode()).trim().toUpperCase();
 db.joinCode=activeJoinCode;
 const envAdminPass=String(adminPassword||'').trim();
 const envAdminUser=cleanAdminName(adminUser||'admin')||'admin';
 let persisting=false;function persist(){onPersist?.(clone(db));if(!file||persisting)return;persisting=true;try{const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(db));fs.renameSync(tmp,file);}finally{persisting=false;}}
 const storage={getItem:key=>key==='hippodrome-cabinet-3'?db.cabinet:null,setItem:(key,value)=>{if(key==='hippodrome-cabinet-3'){db.cabinet=value;persist();}}};
 let game=null;
 function bindGame(){
   game=Engine.createMachine({storage});
   game.onChange=kind=>{if(kind==='result')settlePlayers();persist();};
 }
 bindGame();
 let revision=0,lastTime=Date.now();const online=new Map();
 const failedAdminAttempts=[];
 function touch(token){const now=Date.now();online.set(token,now);if(db.players[token])db.players[token].lastSeen=now;}
 function leave(token){if(typeof token!=='string')return false;online.delete(token);if(db.players[token]){db.players[token].lastSeen=0;db.players[token].readyRaceNo=0;maybeStartWhenAllReady();revision++;persist();return true;}return false;}
 function authenticated(token){if(typeof token!=='string'||token.length<32)return null;const p=db.players[token];if(!p)return null;touch(token);return p;}
 function activeEntries(now=Date.now()){return Object.entries(db.players).filter(([t,x])=>now-(online.get(t)||x.lastSeen||0)<15000);}
 function maybeStartWhenAllReady(now=Date.now()){if(game.state.phase!=='betting')return false;const active=activeEntries(now);if(!active.length)return false;if(active.every(([,x])=>x.readyRaceNo===game.state.raceNo)){for(const p of Object.values(db.players))p.readyRaceNo=0;game.close();return true;}return false;}
 function createPlayer(name,pin=''){name=cleanName(name);if(name.length<2)throw Error('Please enter a username of at least two characters.');if(Object.keys(db.players).length>=capacity)throw Error('This table is full. Ask the host to increase its player limit.');const cleanPin=String(pin??'').trim();checkPinFormat(cleanPin);const existing=db.players&&Object.values(db.players).find(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase());if(existing)throw Error(existing.pinHash?'That username is already registered — check your 4-digit PIN or pick another username.':'That nickname is already at this table. Choose another or enter your PIN.');const token=crypto.randomBytes(32).toString('base64url');db.players[token]={id:crypto.randomBytes(6).toString('hex'),name,pinHash:hashPin(cleanPin),balance:500,bets:[],receipts:{},lastPayout:0,joinedAt:Date.now()};touch(token);revision++;persist();return {token,player:db.players[token]};}
 function validateToken(token){return typeof token==='string'&&token.length<=128;}
 function register({name,code,token,pin}){if(token&&validateToken(token)){const prior=authenticated(token);if(prior)return {token,player:prior,reconnected:true};}if(typeof code!=='string'||code.trim().toUpperCase()!==activeJoinCode)throw Error('That table code is not correct.');const cleaned=cleanName(name),cleanPin=String(pin??'').trim();checkPinFormat(cleanPin);const existing=Object.entries(db.players).find(([,p])=>p.name.toLocaleLowerCase()===cleaned.toLocaleLowerCase());if(existing&&cleanPin&&existing[1].pinHash&&existing[1].pinHash===hashPin(cleanPin)){touch(existing[0]);revision++;persist();return {token:existing[0],player:existing[1],reconnected:true};}const made=createPlayer(name,cleanPin);return {...made,reconnected:false};}
 function personalReceipt(p,record){return p.receipts[String(record.raceNo)]||{stake:0,return:0,bets:[]};}
 function racePlayerResults(raceNo,now=Date.now()){const key=String(raceNo),out=[];for(const [t,x] of Object.entries(db.players)){const rec=x.receipts?.[key],isOnline=now-(online.get(t)||x.lastSeen||0)<15000,stake=Number(rec?.stake)||0,ret=Number(rec?.return)||0,bets=Array.isArray(rec?.bets)?rec.bets:[];if(!isOnline&&!bets.length&&stake===0)continue;out.push({id:x.id,name:x.name,balance:x.balance,stake,return:ret,net:Math.round((ret-stake)*100)/100,bets:clone(bets)});}return out;}
 function archiveRaceRecord(record,coreState,now=Date.now()){
   if(!record||!Number.isInteger(record.raceNo)||record.source==='warmup')return;
   const sessionNo=db.archive.sessionNo;
   if(db.archive.races.some(r=>r.sessionNo===sessionNo&&r.raceNo===record.raceNo))return;
   const key=String(record.raceNo),playerResults=[];
   for(const p of Object.values(db.players)){
     const rec=p.receipts?.[key];
     const stake=Number(rec?.stake)||0,ret=Number(rec?.return)||0,bets=Array.isArray(rec?.bets)?clone(rec.bets):[];
     if(!bets.length&&stake===0)continue;
     playerResults.push({id:p.id,name:p.name,balance:p.balance,stake,return:ret,net:Math.round((ret-stake)*100)/100,bets});
   }
   const totalStake=Math.round(playerResults.reduce((n,x)=>n+x.stake,0)*100)/100;
   const totalReturn=Math.round(playerResults.reduce((n,x)=>n+x.return,0)*100)/100;
   const runnersSource=Array.isArray(record.field)&&record.field.length===6?record.field:(coreState?.runners||[]);
   db.archive.races.unshift({
     uid:`s${sessionNo}-r${record.raceNo}-${now}`,
     sessionNo,
     raceNo:record.raceNo,
     title:record.title||coreState?.title||'',
     settledAt:now,
     order:Array.isArray(record.order)?record.order.slice():(coreState?.order||[]).slice(),
     runners:runnersSource.map((r,idx)=>({
       num:r.num||idx+1,
       name:r.name,
       style:r.style||r.atStart?.style||'',
       winOdds:r.winOdds??r.atStart?.winOdds??null,
       showOdds:r.showOdds??r.atStart?.showOdds??null,
       finish:r.finish??null
     })),
     prices:record.prices?clone(record.prices):null,
     totalStake,
     totalReturn,
     playerResults
   });
   if(db.archive.races.length>5000)db.archive.races.length=5000;
 }
 function syncHistoryToArchive(now=Date.now()){
   const list=Array.isArray(game.state?.history)?game.state.history.slice().reverse():[];
   for(const rec of list)archiveRaceRecord(rec,game.state,now);
 }
 syncHistoryToArchive();
 function snapshot(token){const p=authenticated(token);if(!p)return null;const now=Date.now(),state=clone(game.state);state.playerId=p.id;state.balance=p.balance;state.bets=clone(p.bets);state.payout=p.lastPayout;state.history=state.history.map(r=>({...r,...personalReceipt(p,r),playerResults:racePlayerResults(r.raceNo,now)}));const isBetting=game.state.phase==='betting';const players=activeEntries(now).map(([,x])=>({id:x.id,name:x.name,online:true,balance:x.balance,ready:isBetting&&x.readyRaceNo===game.state.raceNo,bets:clone(x.bets||[])}));return {revision,serverTime:now,player:{id:p.id,name:p.name,balance:p.balance,ready:isBetting&&p.readyRaceNo===game.state.raceNo},players,state};}
 function ticketReturn(t,order){const [winner,second]=order;const hit=t.market==='win'?t.nums[0]===winner:t.market==='show'?t.nums[0]===second:t.nums.includes(winner)&&t.nums.includes(second);return hit?Maths.gross(t.stake,t.odds):0;}
 function settlePlayers(){const core=game.state,record=core.history[0],order=core.order.slice(),now=Date.now();for(const p of Object.values(db.players)){const bets=p.bets.map(t=>({...t,odds:Number.isFinite(t.odds)?t.odds:game.odds(t.market,t.nums),names:t.nums.map(n=>core.runners[n-1].name),returned:ticketReturn(t,order)}));const stake=bets.reduce((n,t)=>n+t.stake,0),returned=Math.round(bets.reduce((n,t)=>n+t.returned,0)*100)/100;p.balance=Math.round((p.balance+returned)*100)/100;p.lastPayout=returned;p.receipts[String(core.raceNo)]={stake,return:returned,bets};p.bets=[];const keys=Object.keys(p.receipts).sort((a,b)=>+a-+b);while(keys.length>60)delete p.receipts[keys.shift()];}archiveRaceRecord(record,core,now);revision++;persist();}
 function place(token,market,nums,amount){const p=authenticated(token),s=game.state;if(!p)throw Error('Your seat expired. Rejoin with the table code.');if(s.phase!=='betting')throw Error('Betting is closed for this race. You can watch and bet when the next race opens.');if(!['win','show','quinella'].includes(market)||!Array.isArray(nums)||nums.some(n=>!Number.isInteger(n)||n<1||n>6))throw Error('Choose a valid runner.');if((market!=='quinella'&&nums.length!==1)||(market==='quinella'&&(nums.length!==2||nums[0]===nums[1])))throw Error('Choose a valid runner or pair.');const checked=Maths.validateStake(amount,p.balance);if(!checked.ok)throw Error(p.balance<amount?'Not enough medals for that stake.':checked.error);const picks=nums.slice().sort((a,b)=>a-b),existing=p.bets.find(b=>b.market===market&&b.nums.join()===picks.join());if(!existing&&p.bets.length>=6)throw Error('Six selections are open. Cancel a ticket to add another.');const odds=game.odds(market,picks);if(!Number.isFinite(odds)||odds<=0)throw Error('Those odds are unavailable.');if(existing)existing.stake+=amount;else p.bets.push({market,nums:picks,stake:amount,odds});p.balance=Math.round((p.balance-amount)*100)/100;revision++;persist();return snapshot(token);}
 function action(token,kind,data={}){const p=authenticated(token);if(!p)throw Error('Your seat expired. Rejoin with the table code.');switch(kind){case'place':return place(token,data.market,data.nums,data.amount);case'cancel':if(game.state.phase!=='betting'||!Number.isInteger(data.index)||!p.bets[data.index])throw Error('That ticket can no longer be cancelled.');p.balance+=p.bets[data.index].stake;p.bets.splice(data.index,1);revision++;persist();break;case'ready':if(game.state.phase!=='betting')throw Error('Betting is closed for this race.');{const next=typeof data.ready==='boolean'?data.ready:p.readyRaceNo!==game.state.raceNo;p.readyRaceNo=next?game.state.raceNo:0;maybeStartWhenAllReady();revision++;persist();}break;case'close':if(game.state.phase==='betting'){for(const x of Object.values(db.players))x.readyRaceNo=0;game.close();}break;case'next':if(game.state.phase==='result')game.next();break;case'refill':if(game.state.phase!=='betting'||p.bets.length||p.balance>=5)throw Error('Refill is available only when no tickets are open and your balance is below five medals.');p.balance=500;revision++;persist();break;default:throw Error('Unknown table action.');}return snapshot(token);}
 function logAudit(kind,actor,detail=''){db.archive.auditLog.unshift({id:crypto.randomBytes(4).toString('hex'),at:Date.now(),kind,actor,detail:String(detail||'').slice(0,200)});if(db.archive.auditLog.length>400)db.archive.auditLog.length=400;}
 function pruneAdminSessions(now=Date.now()){if(!db.admin?.sessions)return;for(const [tok,s] of Object.entries(db.admin.sessions)){if(!s||s.expiresAt<=now)delete db.admin.sessions[tok];}const keys=Object.keys(db.admin.sessions).sort((a,b)=>db.admin.sessions[a].createdAt-db.admin.sessions[b].createdAt);while(keys.length>10)delete db.admin.sessions[keys.shift()];}
 function adminStatus(){const envLocked=!!envAdminPass;const configured=envLocked||!!(db.admin&&db.admin.passHash);return {configured,envLocked};}
 function checkAdminRateLimit(now=Date.now()){while(failedAdminAttempts.length&&now-failedAdminAttempts[0]>60000)failedAdminAttempts.shift();if(failedAdminAttempts.length>=10)throw Error('Too many failed administrator attempts. Please wait 60 seconds.');}
 function issueAdminSession(username,now=Date.now()){if(!db.admin)db.admin={username,envOnly:!!envAdminPass,sessions:{}};if(!db.admin.sessions||typeof db.admin.sessions!=='object')db.admin.sessions={};pruneAdminSessions(now);const token=crypto.randomBytes(36).toString('base64url');const expiresAt=now+ADMIN_SESSION_TTL;db.admin.sessions[token]={username,createdAt:now,expiresAt};return {token,username,expiresAt};}
 function adminSetup({username,password}={}){
   if(envAdminPass)throw Error('Administrator credentials are configured by server environment variables.');
   if(db.admin&&db.admin.passHash)throw Error('Administrator account has already been claimed.');
   const cleanUser=cleanAdminName(username);if(cleanUser.length<3)throw Error('Administrator username must be at least 3 characters.');
   const pass=String(password??'');if(pass.length<6||pass.length>128)throw Error('Administrator password must be 6 to 128 characters.');
   const salt=crypto.randomBytes(16).toString('hex'),passHash=hashAdminSecret(pass,salt);
   db.admin={username:cleanUser,salt,passHash,createdAt:Date.now(),sessions:{}};
   const sess=issueAdminSession(cleanUser);
   logAudit('admin_setup',cleanUser,'Exclusive administrator account claimed');
   persist();
   return sess;
 }
 function adminLogin({username,password}={}){
   const now=Date.now();checkAdminRateLimit(now);
   const cleanUser=cleanAdminName(username),pass=String(password??'');
   if(envAdminPass){
     const userOk=cleanUser.toLocaleLowerCase()===envAdminUser.toLocaleLowerCase();
     const passOk=safeEqualHex(sha256Hex(pass),sha256Hex(envAdminPass));
     if(!userOk||!passOk){failedAdminAttempts.push(now);throw Error('Invalid administrator username or password.');}
     const sess=issueAdminSession(envAdminUser,now);
     logAudit('admin_login',envAdminUser,'Signed in (env)');
     persist();
     return sess;
   }
   if(!db.admin||!db.admin.passHash)throw Error('No administrator account exists yet. Complete setup first.');
   const userOk=cleanUser.toLocaleLowerCase()===String(db.admin.username||'').toLocaleLowerCase();
   const passOk=safeEqualHex(hashAdminSecret(pass,db.admin.salt),db.admin.passHash);
   if(!userOk||!passOk){failedAdminAttempts.push(now);throw Error('Invalid administrator username or password.');}
   const sess=issueAdminSession(db.admin.username,now);
   logAudit('admin_login',db.admin.username,'Signed in');
   persist();
   return sess;
 }
 function adminAuth(token){
   if(typeof token!=='string'||token.length<32)return null;
   const now=Date.now();pruneAdminSessions(now);
   const sess=db.admin?.sessions?.[token];
   if(!sess||sess.expiresAt<=now)return null;
   return {username:sess.username||(envAdminPass?envAdminUser:db.admin?.username)||'admin',expiresAt:sess.expiresAt};
 }
 function adminLogout(token){
   if(typeof token!=='string'||!db.admin?.sessions?.[token])return false;
   const actor=db.admin.sessions[token].username||'admin';
   delete db.admin.sessions[token];
   logAudit('admin_logout',actor,'Signed out');
   persist();
   return true;
 }
 function adminSnapshot(token){
   const auth=adminAuth(token);if(!auth)return null;
   const now=Date.now();syncHistoryToArchive(now);
   const allPlayers=Object.entries(db.players).map(([tok,p])=>({
     id:p.id,
     name:p.name,
     hasPin:!!p.pinHash,
     balance:p.balance,
     openBetsCount:(p.bets||[]).length,
     openBets:clone(p.bets||[]),
     ready:game.state.phase==='betting'&&p.readyRaceNo===game.state.raceNo,
     online:now-(online.get(tok)||p.lastSeen||0)<15000,
     lastSeen:online.get(tok)||p.lastSeen||0,
     joinedAt:p.joinedAt||0,
     racesPlayed:Object.keys(p.receipts||{}).length
   })).sort((a,b)=>Number(b.online)-Number(a.online)||b.balance-a.balance);
   const totalWageredAllTime=Math.round(db.archive.races.reduce((s,r)=>s+(Number(r.totalStake)||0),0)*100)/100;
   const totalReturnedAllTime=Math.round(db.archive.races.reduce((s,r)=>s+(Number(r.totalReturn)||0),0)*100)/100;
   return {
     serverTime:now,
     admin:{username:auth.username,envLocked:!!envAdminPass,expiresAt:auth.expiresAt},
     table:{
       joinCode:activeJoinCode,
       sessionNo:db.archive.sessionNo,
       revision,
       raceNo:game.state.raceNo,
       title:game.state.title,
       phase:game.state.phase,
       clock:game.state.clock,
       openSeconds:game.state.openSeconds||60,
       runners:clone(game.state.runners||[]),
       order:clone(game.state.order||[])
     },
     stats:{
       archivedRaces:db.archive.races.length,
       totalResets:db.archive.resets.length,
       totalWageredAllTime,
       totalReturnedAllTime,
       registeredPlayers:allPlayers.length,
       onlinePlayers:allPlayers.filter(p=>p.online).length
     },
     players:allPlayers,
     archive:{
       sessionNo:db.archive.sessionNo,
       races:clone(db.archive.races),
       resets:clone(db.archive.resets),
       auditLog:clone(db.archive.auditLog)
     }
   };
 }
 function adminResetServer(token,{mode='archive_reset_wallets',reason=''}={}){
   const auth=adminAuth(token);if(!auth)throw Error('Administrator authentication required.');
   if(!['archive_reset_wallets','archive_wipe_players','soft_round'].includes(mode))throw Error('Unsupported reset mode.');
   const now=Date.now();
   syncHistoryToArchive(now);
   const cleanReason=String(reason||'').trim().slice(0,140);
   const sessionRaces=db.archive.races.filter(r=>r.sessionNo===db.archive.sessionNo);
   const sessionWagered=Math.round(sessionRaces.reduce((s,r)=>s+(Number(r.totalStake)||0),0)*100)/100;
   db.archive.resets.unshift({
     id:crypto.randomBytes(6).toString('hex'),
     sessionNo:db.archive.sessionNo,
     resetAt:now,
     by:auth.username,
     mode,
     reason:cleanReason,
     endedRaceNo:game.state.raceNo,
     endedPhase:game.state.phase,
     sessionRacesCount:sessionRaces.length,
     sessionWagered,
     playerCount:Object.keys(db.players).length,
     playersSnapshot:Object.values(db.players).map(p=>({id:p.id,name:p.name,balance:p.balance,openBets:clone(p.bets||[]),joinedAt:p.joinedAt||0}))
   });
   if(db.archive.resets.length>500)db.archive.resets.length=500;
   if(mode==='archive_reset_wallets'){
     db.archive.sessionNo+=1;
     db.cabinet=null;
     bindGame();
     for(const p of Object.values(db.players)){
       p.balance=500;p.bets=[];p.receipts={};p.lastPayout=0;p.readyRaceNo=0;
     }
   }else if(mode==='archive_wipe_players'){
     db.archive.sessionNo+=1;
     db.cabinet=null;
     bindGame();
     db.players={};
     online.clear();
   }else{
     for(const p of Object.values(db.players)){
       const refund=(p.bets||[]).reduce((s,b)=>s+(Number(b.stake)||0),0);
       p.balance=Math.round((p.balance+refund)*100)/100;
       p.bets=[];p.readyRaceNo=0;
     }
     if(game.state.phase==='result'){
       game.next();
     }else{
       game.state.phase='betting';game.state.clock=0;game.state.order=[];game.state.rhythm=null;game.state.boxCall=false;game.state.settled=false;
       for(const h of game.state.runners){delete h.run;delete h.finish;delete h.atStart;delete h.gateFrom;}
       game.save();
     }
   }
   logAudit('server_reset',auth.username,`Mode: ${mode}${cleanReason?' · '+cleanReason:''}`);
   revision++;persist();
   return adminSnapshot(token);
 }
 function adminAction(token,kind,data={}){
   const auth=adminAuth(token);if(!auth)throw Error('Administrator authentication required.');
   switch(kind){
     case'force_close':
       if(game.state.phase!=='betting')throw Error('Betting is not currently open.');
       for(const x of Object.values(db.players))x.readyRaceNo=0;
       game.close();
       logAudit('force_close',auth.username,`Closed betting on race #${game.state.raceNo}`);
       break;
     case'force_next':
       if(game.state.phase!=='result')throw Error('Race has not finished yet.');
       game.next();
       logAudit('force_next',auth.username,`Advanced to race #${game.state.raceNo}`);
       break;
     case'set_join_code':{
       const next=String(data.code||'').replace(/[^a-zA-Z0-9]/g,'').toUpperCase();
       if(next.length<4||next.length>12)throw Error('Table code must be 4 to 12 letters or digits.');
       activeJoinCode=next;db.joinCode=next;
       logAudit('set_join_code',auth.username,`Changed table code to ${next}`);
       break;
     }
     case'adjust_balance':{
       const entry=Object.values(db.players).find(p=>p.id===data.playerId);
       if(!entry)throw Error('Player not found.');
       const amount=Math.round(Number(data.balance)*100)/100;
       if(!Number.isFinite(amount)||amount<0||amount>10000000)throw Error('Balance must be between 0 and 10,000,000.');
       const prev=entry.balance;entry.balance=amount;
       logAudit('adjust_balance',auth.username,`${entry.name}: ${prev}m -> ${amount}m`);
       break;
     }
     case'remove_player':{
       const hit=Object.entries(db.players).find(([,p])=>p.id===data.playerId);
       if(!hit)throw Error('Player not found.');
       const [tok,p]=hit;delete db.players[tok];online.delete(tok);
       logAudit('remove_player',auth.username,`Removed seat ${p.name} (${p.balance}m)`);
       break;
     }
     case'change_credentials':{
       if(envAdminPass)throw Error('Environment admin credentials cannot be changed from the UI.');
       const cur=String(data.currentPassword||'');
       if(!safeEqualHex(hashAdminSecret(cur,db.admin.salt),db.admin.passHash))throw Error('Current password is incorrect.');
       const nextUser=data.newUsername?cleanAdminName(data.newUsername):db.admin.username;
       if(nextUser.length<3)throw Error('Username must be at least 3 characters.');
       const nextPass=String(data.newPassword||'');
       if(nextPass.length<6||nextPass.length>128)throw Error('New password must be 6 to 128 characters.');
       const salt=crypto.randomBytes(16).toString('hex');
       db.admin.username=nextUser;db.admin.salt=salt;db.admin.passHash=hashAdminSecret(nextPass,salt);
       for(const s of Object.values(db.admin.sessions||{}))s.username=nextUser;
       logAudit('change_credentials',nextUser,'Updated administrator credentials');
       break;
     }
     case'export_archive':
       logAudit('export_archive',auth.username,'Exported full history archive');
       persist();
       return {exportedAt:Date.now(),table:{joinCode:activeJoinCode,sessionNo:db.archive.sessionNo,raceNo:game.state.raceNo,phase:game.state.phase},archive:clone(db.archive),players:Object.values(db.players).map(p=>({id:p.id,name:p.name,balance:p.balance,joinedAt:p.joinedAt,receipts:clone(p.receipts||{})}))};
     default:
       throw Error('Unknown administrator action.');
   }
   revision++;persist();
   return adminSnapshot(token);
 }
 function tick(elapsed){const now=Date.now(),dt=Math.max(0,Math.min(.25,Number.isFinite(elapsed)?elapsed:(now-lastTime)/1000));lastTime=now;if(!dt)return;if(game.state.phase==='betting'&&activeEntries(now).length>0){const cap=Math.max(0,(game.state.openSeconds||60)-0.05);if(game.state.clock+dt>=cap){const roomDt=Math.max(0,cap-game.state.clock);if(roomDt>0){game.tick(roomDt);revision++;}return;}}game.tick(dt);revision++;}
 const timer=autoTick?setInterval(()=>tick(),50):null;timer?.unref?.();
 function stop(){if(timer)clearInterval(timer);game.save();persist();}
 return {get joinCode(){return activeJoinCode;},get game(){return game;},register,authenticated,leave,snapshot,action,tick,stop,exportDb:()=>clone(db),adminStatus,adminSetup,adminLogin,adminAuth,adminLogout,adminSnapshot,adminResetServer,adminAction,get revision(){return revision;},dataFile:file};
}
module.exports={createRoom,cleanName};
