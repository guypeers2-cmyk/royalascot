/* Observed timing, not a prediction. The lead in seconds is how long ago the
   leader passed the challenger's CURRENT point. The search never goes past NOW. */
(function(root){'use strict';const gapText=t=>t>0&&t<.01?'< 0.01 s':t.toFixed(2)+' s';
 function read(g){const s=g.state;if(s.phase!=='race')return null;const now=s.clock,[a,b]=g.positions(),leader=s.runners[a-1],chaser=s.runners[b-1],ld=g.distance(leader,now),cd=g.distance(chaser,now),finished=now>=leader.finish,paid=now>=chaser.finish;
   let lo=0,hi=now;if(!paid)for(let i=0;i<18;i++){const mid=(lo+hi)/2;if(g.distance(leader,mid)<cd)lo=mid;else hi=mid;}
   const gap=paid?Math.max(0,chaser.finish-leader.finish):Math.max(0,now-hi),prior=Math.max(0,now-2),closing=!finished&&now>=2&&(g.distance(leader,prior)-g.distance(chaser,prior))-(ld-cd)>.0017;
   return {a,b,gap,closing,finished,confirmed:paid,lap:g.lap?g.lap(leader,now):Math.min(4,Math.floor(ld)+1)};
 }
 function margin(rec){const first=rec.field.find(h=>h.num===rec.order[0]),next=rec.field.find(h=>h.num===rec.order[1]);return first&&next?Math.max(0,next.finish-first.finish):null;}
 function photoHTML(r){if(![1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17].includes(r?.photo?.v))return '';const gap=margin(r),esc=root.RunnerIntel.esc,h=r.field.find(h=>h.num===r.order[0]),q=r.field.find(h=>h.num===r.order[1]);return `<figure class="wire-exposure" data-print="${r.raceNo}"><figcaption><span><i></i> ${r.source==='warmup'?'WARM-UP':'OFFICIAL'} · FINISH CAMERA</span><b>R${String(r.raceNo).padStart(3,'0')} / 01</b></figcaption><canvas width="1280" height="720" aria-label="Recorded view of the home straight at the first carriage crossing"></canvas><div><strong>${esc(h.name)}</strong><span>by <b>${gapText(gap)}</b> over ${esc(q.name)}</span></div><p>At ${r.photo.at.toFixed(2)} s, the winner’s track sensor reached the line. The frame uses the recorded positions at that instant.</p></figure>`;}
 const api={read,margin,gapText,photoHTML};root.RacePressure=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
