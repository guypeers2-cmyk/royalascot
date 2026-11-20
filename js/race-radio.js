/* This caller gets a clock, binoculars and the confirmed line judge. No
   finishing order, tickets or access to the race-day RNG. Half-second looks
   make the same call sheet on a fast machine, a slow frame or a saved race. */
(function(root){'use strict';
 const book=root.RadioBook||(typeof require==='function'?require('./radio-book'):null);
 const course=root.AscotCourse||(typeof require==='function'?require('./course'):null);
 const breaks=[0,0,1,2,3,3+course.stops[3],4],marks=['','','lap2','lap3','bell','home','wire'];
 const levels=[{name:'Opening lap',gain:.43,rate:.97},{name:'Lap two',gain:.51,rate:1.01},{name:'Lap three',gain:.61,rate:1.055},{name:'Final lap',gain:.73,rate:1.10},{name:'Home straight',gain:.88,rate:1.17}];
 const spacing=[0,1.5,5,4.5,3.75,2.5],close=.013,clear=.034,groups={};
 book.lines.forEach(([group],i)=>(groups[group]||=[]).push(i));
 function hash(s){let n=2166136261;for(const c of s)n=Math.imul(n^c.charCodeAt(0),16777619)>>>0;return n;}
 function create(game){
   const {raceNo,runners}=game.state,courseLaw=game.state.courseStartLaw||0,shifted=courseLaw>0,route=courseLaw===1?course.legacyRaceDistance:course.raceDistance,firstPass=courseLaw===1?course.legacyStartToFinish:1,progress=d=>4*d/route;
   const marksAt=shifted?[0,0,progress(firstPass),progress(firstPass+1),progress(firstPass+2),progress(courseLaw===1?3+course.stops[3]-course.startT:3+course.stops[3]),4]:breaks;
   const used=new Set(),history=[],recent=[];
   let seed=hash(raceNo+'|'+runners.map(h=>h.name+':'+h.seed).join('/')),next=0,stage=0,bell=[],lastLook=null,last=-99,firstAway=0;
   const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   const look=t=>runners.map(h=>({h,d:game.distance(h,t)})).sort((a,b)=>b.d-a.d||a.h.num-b.h.num);
   const pos=(o,n)=>o.findIndex(p=>p.h.num===n);
   const eligible=(g,o)=>groups[g].filter(i=>!used.has(i)&&(i!==6||o[0].h.num===firstAway)&&!(courseLaw===1&&g==='lap2'&&/Three still to run|One down, three to go/i.test(book.lines[i][1])));
   function emit(at,kind,level,o,extra={}){
     const ids=eligible(kind,o);if(!ids.length)return;
     // Give the new asides a regular turn at the mic, with space for a
     // straight call after a joke. Both registers use the same observed event.
     const wry=ids.filter(i=>book.clips[i][2]),plain=ids.filter(i=>!book.clips[i][2]),lastId=history.at(-1)?.id;
     const pool=wry.length&&plain.length?(rand()<(book.clips[lastId]?.[2] ? .30 : .62)?wry:plain):ids;
     const id=pool[Math.floor(rand()*pool.length)],tpl=book.lines[id][1],match=tpl.match(/\{(.)\}/);
     const roles={L:o[0].h,S:o[1].h,T:o[2].h,F:o[3].h,Z:o[5].h,...extra},horse=match?roles[match[1]]:null;
     used.add(id);history.push({id,at,kind,level,line:horse?tpl.replace(match[0],horse.name):tpl,n:horse?.num||0,name:horse?.name||'',prefix:tpl.startsWith('{')});
     last=at;recent.unshift(kind);if(recent.length>4)recent.pop();
   }
   function choose(opts,t,o,extra){
     const choices=opts.filter(([g])=>eligible(g,o).length);
     for(const v of choices)if(recent.includes(v[0]))v[1]*=recent[0]===v[0] ? .12 : .50;
     let roll=rand()*choices.reduce((n,a)=>n+a[1],0);for(const [g,w] of choices)if((roll-=w)<=0){emit(t,g,stage,o,extra);break;}
   }
   // When a mark becomes observable, reconstruct its *past* crossing. For a
   // turn-in, bisect against the physical course survey, not a guessed time.
   function marksSeen(now,o){while(stage<6&&o[0].d>=marksAt[stage+1]){
     const limit=marksAt[++stage],there=o.filter(p=>p.d>=limit).map(({h})=>{
       if(stage!==5)return {h,at:Math.min(now,game.crossing(h,shifted?(stage===6?4:stage-1):limit))};
       let lo=0,hi=now;for(let j=0;j<32;j++){const mid=(lo+hi)/2;if(game.distance(h,mid)<limit)lo=mid;else hi=mid;}
       return {h,at:Math.min(now,Math.ceil(hi*1e6)/1e6)};
     }).sort((a,b)=>a.at-b.at||a.h.num-b.h.num);
     const {h,at}=there[0],atMark=look(at);if(stage===4)bell=atMark;
     if(shifted&&stage===2&&courseLaw===1){history.push({id:-100-stage,at,kind:'lap1',level:1,line:'Lap 1 begins at the post.',n:h.num,name:h.name,prefix:false,dynamic:true});last=at;recent.unshift('lap1');if(recent.length>4)recent.pop();}else emit(at,shifted?(courseLaw>=2?['','','lap2','lap3','bell','home','wire']:['','','lap1','lap2','bell','home','wire'])[stage]:marks[stage],Math.min(stage,5),atMark,{L:h,W:h});lastLook=atMark;
   }}
   function observe(t){const o=look(t);if(!stage){stage=1;emit(0,'start',1,o);lastLook=o;return;}
     if(!firstAway&&t>0)firstAway=o[0].h.num;marksSeen(t,o);
     if(stage===6||t-last<spacing[stage])return;
     const lead=o[0].h.num,d=o[0].d,gap=d-o[1].d,before=lastLook;
     const mover=o.find((a,i)=>i<pos(before,a.h.num));
     const rally=stage===4&&o.slice(0,3).find((a,i)=>pos(bell,a.h.num)>=3&&pos(bell,a.h.num)-i>=2);
     const speeders=o.filter(x=>game.sprint(x.h,t)==='active'),focus=speeders.length?speeders[Math.floor(rand()*speeders.length)].h:null;
     const f=shifted?((course.startT+d/4*route)%1+1)%1:d%1,turn=f<course.stops[1]||(f>=course.stops[2]&&f<course.stops[3]),opts=[];
     if(before[0].h.num!==lead)opts.push(['change',stage===5?28:12]);
     if(stage===1)opts.push(['early',3],['stalk',2],['field',2]);
     else if(stage===5){opts.push(['runin',3]);if(gap<=close)opts.push(['duel',9]);if(gap>clear)opts.push(['free',7]);}
     else{
       if(turn)opts.push(['bend',2]);if(mover)opts.push(['gain',4]);if(focus)opts.push(['sprint',4]);if(gap<=close)opts.push(['tight',5]);
       if(stage===4){opts.push(['chase',2]);if(gap>clear)opts.push(['clear',4]);if(rally)opts.push(['rally',8]);
         if(gap<.043&&before[0].d-before[pos(before,o[1].h.num)].d>gap+.004)opts.push(['press',7]);
       }else{opts.push(['second',2],['third',2]);if(gap>clear)opts.push(['gap',3]);}
     }
     choose(opts,t,o,{M:mover?.h,R:rally?.h,K:focus});lastLook=o;
   }
   function read(now){while(next<=now&&stage<6){observe(next);next+=.5;}
     if(stage<6)marksSeen(now,look(now));return history.slice(-3).reverse();}
   return {read,history};
 }
 const api={create,levels};root.RaceRadio=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
