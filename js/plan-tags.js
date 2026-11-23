/* Keep the number readable without moving its physical position on the map.
   With large screens a pin is usually its own badge. Where lanes are only a
   few CSS pixels apart, use short leaders. No camera/clock/RNG side effects. */
(function(root){'use strict';function place(points,r){const placed=[],d=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);function collision(p,i){let n=0;for(const q of placed)n+=Math.max(0,2*r+1.6-d(p,q))**2;for(let j=0;j<points.length;j++)if(j!==i)n+=Math.max(0,r+1.8-d(p,points[j]))**2;return n;}
   for(let i=0;i<points.length;i++){const p=points[i];let best=p,loss=collision(p,i)*1e4;if(loss){const dir=i%2===0?1:-1;for(const mag of [1.38,2.25,3.25,4.4]){for(const a of [0,Math.PI,Math.PI/4,-Math.PI/4,3*Math.PI/4,-3*Math.PI/4,Math.PI/2,-Math.PI/2]){const dx=Math.cos(a)*dir*r*mag,dy=Math.sin(a)*r*mag,q={x:p.x+dx,y:p.y+dy},v=collision(q,i)*1e4+mag*mag+.15*Math.abs(dy)/r;if(v<loss){loss=v;best=q;}}if(loss<100)break;}}placed.push(best);}
   return placed;}
 const api={place};root.AscotPlanTags=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
