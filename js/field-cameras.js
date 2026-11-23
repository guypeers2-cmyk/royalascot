/* Field optics in CSS pixels. Always fit actual saddle/hoof bounds inside
   exposed glass, including when the book sits over the lower-right corner. */
(function(root){'use strict';const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function openings(w,h,blocks){const edge=Math.min(5,w*.014,h*.02),full={l:edge,r:w-edge,t:edge,b:h-edge};let list=[full];
   const inside=(a,b)=>a.l>=b.l&&a.r<=b.r&&a.t>=b.t&&a.b<=b.b;
   for(const q of blocks){const next=[];for(const a of list){if(q.r<=a.l||q.l>=a.r||q.b<=a.t||q.t>=a.b){next.push(a);continue;}
     for(const p of [{...a,r:q.l},{...a,l:q.r},{...a,b:q.t},{...a,t:q.b}])if(p.r-p.l>16&&p.b-p.t>10)next.push(p);}
     list=next.filter((a,i)=>!next.some((b,j)=>i!==j&&inside(a,b)&&(!inside(b,a)||i>j)));}return list.length?list:[full];}
 // The home point is the horse, NOT the centre of the long sulky negative.
 // Frame actual ink rather than the transparent corners of a turning team.
 const inks=[];function ink(cell){if(inks[cell])return inks[cell];let l=32,t=24,r=0,b=0;const m=root.AscotMattes;if(!m)return [0,0,1,1];for(let y=0;y<24;y++)for(let x=0;x<32;x++)if(m[cell*96+y*4+(x>>3)]&(1<<(x&7))){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=y+1;}return inks[cell]=[(l-.65)/32,(t-.45)/24,(r+.65)/32,(b+.45)/24];}
 function bounds(rows){let l=Infinity,t=l,r=-l,b=-l;for(const i of rows){const o=i.origin||[.5,.91],q=i.ink||[-.02,-.03,1.02,1.03];l=Math.min(l,i.p.x+i.w*(q[0]-o[0]));r=Math.max(r,i.p.x+i.w*(q[2]-o[0]));t=Math.min(t,i.p.y+i.hgt*(q[1]-o[1]));b=Math.max(b,i.p.y+i.hgt*(q[3]-o[1]));}return {l,r,t,b};}
 // The protected part of the screen is the viewfinder. It is NOT the
 // centre of the canvas when a ledger covers the bottom/right. Pick a
 // stable window for the course rather than chasing changing horse boxes.
 const filmW=1150,filmH=1150*768/1376;
 function windowFor(areas,w,h,ratio=7.3){let best=null,score=-Infinity;for(const a of areas){const aw=a.r-a.l,ah=a.b-a.t,v=Math.min(aw,ah*ratio)+.065*aw+.025*ah-.007*Math.abs(a.l+a.r-w);if(v>score){score=v;best=a;}}return best||{l:0,r:w,t:0,b:h};}
 const railLens=(w,h,box={l:0,r:w,t:0,b:h})=>Math.max(.025,Math.min(1.8,w/1050,(box.r-box.l)/1125,(box.b-box.t)/193,h/265));
 // Limit translation on the image plane. When the plate cannot fill one
 // dimension, centre it: letterbox, never follow a subject into blank space.
 function stops(desired,lo,hi,a,b,size,k,aimLo,aimHi){const centre=(a+b)/2,filmLo=b-size*k,filmHi=a;
   if(filmLo>filmHi)return centre-size*k/2;
   const L=Math.max(filmLo,lo),R=Math.min(filmHi,hi);if(L>R)return clamp(desired,filmLo,filmHi);
   const l=Math.max(L,centre-k*aimHi),r=Math.min(R,centre-k*aimLo);return l<=r?clamp(desired,l,r):clamp(desired,L,R);}
 function compose(items,order,pin,areas,w,h,dx,dy,prev,dt,rack,action){const a=windowFor(areas,w,h),aw=a.r-a.l,ah=a.b-a.t,q=bounds(items),p=items.find(i=>i.h.num===pin),bb=rack?{l:Math.min(q.l,rack.l),t:Math.min(q.t,rack.t),r:Math.max(q.r,rack.r),b:Math.max(q.b,rack.b)}:q;
   const k=action?Math.min(2.12,aw/Math.max(620,bb.r-bb.l+56),ah/Math.max(153,bb.b-bb.t+22)):railLens(w,h,a),cx=(a.l+a.r)/2,cy=(a.t+a.b)/2;
   const edge=Math.min(5,.019*aw,.029*ah),sx=(bb.r+bb.l)/2,sy=(bb.b+bb.t)/2,mix=p?(action?.52:.34):0,fx=sx+mix*((p?.p.x||sx)-sx),fy=sy+mix*((p?p.p.y-p.hgt*.38:sy)-sy);
   const bx=v=>stops(v,a.l+edge-k*bb.l,a.r-edge-k*bb.r,a.l,a.r,filmW,k,43,filmW-43),by=v=>stops(v,a.t+edge-k*bb.t,a.b-edge-k*bb.b,a.t,a.b,filmH,k,278,442),
     goalX=bx(cx-k*fx+dx*.36),goalY=by(cy-k*fy+dy*.26),f=prev?-Math.expm1(-5*dt):1;
   return {k,x:bx(prev?prev.x+(goalX-prev.x)*f:goalX),y:by(prev?prev.y+(goalY-prev.y)*f:goalY),count:items.length,box:a,bb};}
 function rail(items,order,pin,areas,w,h,dx=0,dy=0,prev=null,dt=1,rack=null){return compose(items,order,pin,areas,w,h,dx,dy,prev,dt,rack,false);}
 function pack(items,order,pin,areas,w,h,dx=0,dy=0,action=false){return compose(items,order,pin,areas,w,h,dx,dy,null,1,null,action);}
 // Follow in continuous lap coordinates. An arithmetic average of world
 // points cuts the infield at the bend and can aim through the cabinet.
 const wrap=x=>x-Math.floor(x),short=(a,b)=>wrap(b-a+.5)-.5;
 function fieldPhase(ts,subject){const a=ts.map(wrap).sort((a,b)=>a-b);let gap=-1,start=a[0];for(let i=0;i<a.length;i++){const n=i+1<a.length?a[i+1]:a[0]+1,d=n-a[i];if(d>gap){gap=d;start=n;}}const mid=start+(1-gap)*.5;return mid+clamp(short(mid,subject)*.24,-.024,.024);}
 // Rate actual changes over the previous second only. A closing adjacent pair
 // or an active runner challenging the leaders earns a shot; hold a subject
 // for several seconds so one noisy timing sample cannot cut the picture.
 function director(){let heat=null,held=null,change=-20,sample=-1,phase='';return function shot(g){const s=g.state,t=s.clock;if(heat!==s.raceNo||phase!==s.phase||sample>t){held=null;heat=s.raceNo;phase=s.phase;change=-20;sample=-1;}
   if(s.phase!=='race')return {n:1,pair:2,mode:'parade'};if(held&&t-sample<.42)return held;sample=t;const order=g.positions(),old=Math.max(0,t-.95),rows=order.map(n=>{const h=s.runners[n-1],d=g.distance(h);return {n,d,v:(d-g.distance(h,old))/Math.max(.03,t-old),active:g.sprint(h)==='active'};});
   const cuts=rows.slice(1).map((b,i)=>{const a=rows[i],gap=a.d-b.d,closing=b.v-a.v,score=(i===0?1.3:0)-i*.18+Math.max(0,1-gap/.055)*2.25+(b.active?.75:0)+clamp(closing*105,-1,2.3);return {n:b.active||closing>.001?b.n:a.n,pair:b.active||closing>.001?a.n:b.n,mode:gap<.042&&closing>.001?'duel':a.active||b.active?'drive':'leaders',score};}).sort((a,b)=>b.score-a.score);
   if(!held||t-change>=4.2){let best=cuts[0];const current=held&&cuts.find(v=>v.n===held.n&&v.pair===held.pair);if(current&&current.score+.48>=best.score)best=current;if(!held||best.n!==held.n||best.pair!==held.pair||best.mode!==held.mode)change=t;held=best;}return held;};}
 // Smooth optical centre and magnification, not upper-left pixel offsets:
 // zooming into a distant subject must not throw the centre of the shot.
 function dolly(){let x,y,z,heat,phase,clock,w,h;return (target,state,width,height,dt,force)=>{const k=target.k,cx=(width*.5-target.x)/k,cy=(height*.5-target.y)/k;
   const cut=force||w!==width||h!==height||heat!==state.raceNo||phase!==state.phase||state.clock<clock||state.clock-clock>.75,pan=cut?1:-Math.expm1(-10*dt),zoom=cut?1:-Math.expm1(-6*dt);
   x=cut?cx:x+(cx-x)*pan;y=cut?cy:y+(cy-y)*pan;z=cut?Math.log(k):z+(Math.log(k)-z)*zoom;heat=state.raceNo;phase=state.phase;clock=state.clock;w=width;h=height;let scale=Math.exp(z);const b=target.box,q=target.bb;if(!b||!q)return {k:scale,x:width*.5-scale*x,y:height*.5-scale*y};const aw=b.r-b.l,ah=b.b-b.t;scale=Math.min(scale,aw/(q.r-q.l+9),ah/(q.b-q.t+9));z=Math.log(scale);
   const X=stops(width*.5-scale*x,b.l+3-scale*q.l,b.r-3-scale*q.r,b.l,b.r,filmW,scale,43,1107),Y=stops(height*.5-scale*y,b.t+3-scale*q.t,b.b-3-scale*q.b,b.t,b.b,filmH,scale,278,442);x=(width*.5-X)/scale;y=(height*.5-Y)/scale;return {k:scale,x:X,y:Y};};}
 // One resolution decision per window, never in response to a single hitch.
 // Do not count a still, a seek, a paused tab or a new shot as a slow device.
 function frameBudget(){let last=null,ms=0,slow=0,n=0;return {reset(){last=null;ms=slow=n=0;},sample(now,clock,level){const prev=last;last={now,clock};if(!prev)return false;const dt=now-prev.now,dc=(clock-prev.clock)*1000;
   if(dt<=0||dc<=0||Math.abs(dt-dc)>Math.max(14,dt*.16)){ms=slow=n=0;return false;}const threshold=[28,34,48][level];ms+=dt;n++;if(dt>threshold)slow++;
   if(ms<850||n<4)return false;const over=slow/n>=.68;ms=slow=n=0;return over;}};}
 // Only for Auto. Test the canvas that will actually be used; declining a
 // software renderer here does not disable a later, explicit Cabinet orbit.
 function acceleration(canvas){try{const attrs={alpha:false,antialias:true,preserveDrawingBuffer:false,powerPreference:'high-performance',failIfMajorPerformanceCaveat:true};const gl=canvas.getContext('webgl2',attrs)||canvas.getContext('webgl',attrs);if(!gl)return false;
   const ext=gl.getExtension('WEBGL_debug_renderer_info'),name=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);return !/swiftshader|llvmpipe|softpipe|software|basic render driver|lavapipe/i.test(name||'');}catch{return false;}}
 // A projected horse footprint (or map disc), tested against actual glass.
 // Checking the closest point also rejects near misses in the ellipse corners.
 function touches(q,x,y,rx,ry){if(!q||rx<=0||ry<=0)return false;const dx=(x-clamp(x,q.l,q.r))/rx,dy=(y-clamp(y,q.t,q.b))/ry;return dx*dx+dy*dy<1;}
 const api={windowFor,short,fieldPhase,stops,touches,openings,ink,bounds,railLens,rail,pack,director,dolly,frameBudget,acceleration};root.AscotFieldCameras=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
