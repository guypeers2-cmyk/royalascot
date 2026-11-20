/* Six scale stalls on the cabinet datum. See CREDITS.md for the gate study.
   Local coordinates are metres: along the straight, up, across. Every view
   shares these pivots, padded panels and the single marshal release. */
(function(root){'use strict';
 const C=root.AscotCourse||(typeof module!=='undefined'?require('./course'):null),S=root.AscotStride||(typeof module!=='undefined'?require('./stride'):null),M=root.AscotSulky||(typeof module!=='undefined'?require('./sulky'):null),marshal=root.AscotMarshal||(typeof module!=='undefined'?require('./marshal'):null);
 const {B}=C,step=2*B/6,size=S.modelSize,e=M.envelope;
 // The timing wire is under the horse, NOT halfway along horse + bike.
 // Leave space behind the actual outer tyre, in front of the muzzle and
 // under the lower beam of the head truss. Keep the six surveyed lane axes.
 const rearGap=.045,FRONT=e.nose*size+.037,BACK=e.rear*size-rearGap,
   TOP=e.top*size+.038+.028,sill=(2*M.wheelR+.0015)*size+.011,OPEN=.32,CLEAR=2.65,PARK=3.45;
 const clamp=x=>Math.min(1,Math.max(0,x)),ease=x=>x*x*(3-2*x);
 // Lane centres are registered to the photographed turf. Along a lane,
 // however, the TRAVEL survey is strongly foreshortened at the wire: its
 // pixel/metre is not that of a close-up figurine. Project the bay hardware
 // in the same local optical scale as the cast, including its camera pitch.
 function sidePoint([x,y,z],seatLens){const p=C.photo(C.startT,.5+z/(2*B)),ppm=M.plateWidth(p.y,S.scale)/(size*M.vw);let sx=ppm;
   if(seatLens){
     // The fixed seat looks obliquely at the wire. Its photo plane stretches
     // by sec(bearing); the quiet shutter shows a foreshortened wheelbase
     // plus the nearer hub outside it. Register the steel to that same view.
     const a=Math.atan((p.x-seatLens.cx)/seatLens.f),unit=Math.PI/14,shutter=unit*Math.max(-2,Math.min(3,Math.round(a/unit)));
     sx*= (Math.cos(shutter)+e.halfWidth*Math.abs(Math.sin(shutter))/(e.nose-e.rear))/Math.cos(a);
   }
   return {x:p.x+x*sx,y:p.y-y*ppm*M.pitchCos,depth:p.y,ppm};}
 function pose(s){if(s.phase!=='gates'&&(s.phase!=='race'||s.clock>=PARK))return null;
   const t=s.phase==='race'?Math.max(0,s.clock):0,u=clamp(t/OPEN);let rear=0;
   if(s.phase==='gates'){
     // Hold both rear wings against the dividers until the LAST wheel is
     // ahead of the padded hinge. This also works for an early betting lock.
     const left=s.runners?.length?Math.max(...s.runners.map(h=>-C.length*marshal.approach(s,h)))/(rearGap-.008):((s.gate??10)-(s.gateHold??3)-s.clock)/.65;
     rear=ease(clamp(left))*Math.PI/2;
   }
   return {angle:(1-(1-u)**3)*Math.PI/2,rear,lift:ease(clamp((t-CLEAR)/(PARK-CLEAR))),released:s.phase==='race'};}
 const colors={frame:'#dddccf',trim:'#eae9dc',foot:'#929a90',brace:'#b5c5be',door:'#dce3da',hinge:'#8b947e',latch:'#b39454',piping:'#87a69a',pad:'#285c50',rolled:'#4c796a',welt:'#163e36',back:'#355c51',tyre:'#28312d',hub:'#8e9e95'};
 const badges=Array.from({length:6},(_,i)=>({num:i+1,x:FRONT+.010,z:-B+(i+.5)*step,y:TOP-.005,w:step*.66,h:.034}));
 const bars=[],faces=[],leaves=[],rears=[],bar=(list,a,b,w,m)=>list.push({a,b,w,m});
 // Three facets along the outer skin suggest rolled vinyl rather than a flat
 // sheet of steel. Never fill the open bars through which the horses look.
 function cushion(list,a,b,lo,hi,thick,mat='pad'){
   const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len;
   const v=(u,y,d)=>[a[0]+u*dx+d*nx,y,a[1]+u*dz+d*nz],levels=[[lo,thick*.47],[lo+.004,thick],[hi-.005,thick],[hi,thick*.48]];
   for(const sign of [-1,1])for(let j=0;j<3;j++){const [y,d]=levels[j],[Y,D]=levels[j+1];list.push({q:[v(0,y,sign*d),v(1,y,sign*d),v(1,Y,sign*D),v(0,Y,sign*D)],m:['welt',mat,'rolled'][j]});}
   list.push({q:[v(0,hi,-thick*.48),v(1,hi,-thick*.48),v(1,hi,thick*.48),v(0,hi,thick*.48)],m:'rolled'});
   for(const u of [0,1])list.push({q:[v(u,lo,-thick*.47),v(u,lo,thick*.47),v(u,hi,thick*.48),v(u,hi,-thick*.48)],m:'welt'});
 }
 function wheel(x,z,side){const y=.025,r=.024,d=.008,point=(k,rad,depth)=>[x+rad*Math.cos(k*Math.PI/7),y+rad*Math.sin(k*Math.PI/7),z+side*depth];
   for(let k=0;k<14;k++){const j=k+1;faces.push({q:[point(k,r,0),point(j,r,0),point(j,r,d),point(k,r,d)],m:'tyre'},{q:[point(k,r,d),point(j,r,d),point(j,r*.53,d),point(k,r*.53,d)],m:'tyre'});}faces.push({q:Array.from({length:14},(_,k)=>point(k,r*.53,d+.0005)),m:'hub'});}
 for(let j=0;j<=6;j++){const z=-B+j*step,outer=j===0||j===6;
   for(const x of [FRONT,BACK]){bar(bars,[x,outer&&x===BACK?.004:sill,z],[x,TOP,z],outer?.009:.005,'frame');if(outer&&x===BACK)bar(bars,[x-.010,.005,z],[x+.010,.005,z],.006,'foot');}
   bar(bars,[BACK,TOP,z],[FRONT,TOP,z],.006,'trim');
   // Cantilever the internal partitions and wickets from the top truss:
   // both rims can roll UNDER the padding as the team steers into the bend.
   // Only the two outside frames have feet. No cross-lane axle-height curb.
   const split=(M.axle+M.wheelR)*size+.037;
   cushion(faces,[BACK+.006,z],[split,z],sill,sill+.012,outer?.004:.003);
   bar(bars,[BACK,.090,z],[split+.004,.090,z],.0045,'rolled');
   cushion(faces,[split,z],[FRONT-.009,z],sill,sill+.0135,outer?.005:.0037);
   if(outer){bar(bars,[BACK,.074,z],[BACK+.077,TOP-.019,z],.004,'brace');bar(bars,[FRONT,.074,z],[FRONT-.072,TOP-.019,z],.004,'brace');const s=j===0?-1:1;// Cantilever the mouth. Both bogie axles stay behind the wire,
     // where an inside wheel following the first bend cannot hit them.
     bar(bars,[-.041,.027,z+s*.006],[-.041,.075,z+s*.006],.006,'brace');bar(bars,[-.041,.075,z+s*.006],[FRONT,TOP-.023,z],.005,'brace');bar(bars,[BACK+.008,.027,z+s*.005],[-.022,.027,z+s*.005],.008,'foot');for(const x of [BACK+.022,-.052])wheel(x,z+s*.005,s);}}
 for(const x of [BACK,FRONT]){for(const h of [TOP-.025,TOP])bar(bars,[x,h,-B-.007],[x,h,B+.007],h===TOP?.008:.005,'frame');
   for(let j=0;j<6;j++){const z=-B+j*step;bar(bars,[x,TOP,z],[x,TOP-.025,z+step*.5],.0035,'brace');bar(bars,[x,TOP-.025,z+step*.5],[x,TOP,z+step],.0035,'brace');}}
 for(let j=0;j<6;j++)for(const dir of [1,-1]){
   const z=-B+(dir===1?j:j+1)*step+dir*.0026,span=step*.5-.003,tip=.008,local=[],pads=[],pt=(u,y)=>[tip*u,y,dir*span*u];
   for(const u of [0,1])bar(local,pt(u,sill),pt(u,.153),.004,'door');
   for(const y of [sill+.001,.098,.153])bar(local,pt(0,y),pt(1,y),.004,'door');
   for(const u of [1/3,2/3])bar(local,pt(u,.098),pt(u,.152),.0024,'door');
   cushion(pads,[tip*.035,dir*span*.035],[tip*.965,dir*span*.965],sill,sill+.032,.0034);
   bar(local,pt(.025,.097),pt(.97,.097),.0028,'piping');
   for(const y of [sill+.009,.138])bar(local,[0,y-.005,0],[0,y+.005,0],.006,'hinge');
   bar(local,pt(.82,.100),pt(.985,.100),.0043,'latch');
   leaves.push({x:FRONT,z,dir,span,tip,local,pads,swing:dir*(1-Math.atan(tip/span)*2/Math.PI)});
   // Two padded back rails instead of a solid tailboard; the driver and
   // cart remain visible through the closed box. Both pivot as one leaf.
   const q=[],lp=[];for(const y of [sill,.101])cushion(q,[0,dir*.002],[0,dir*(span-.001)],y,y+.012,.004,'back');bar(lp,[0,sill,0],[0,.117,0],.0045,'hinge');bar(lp,[0,sill,dir*(span-.003)],[0,.113,dir*(span-.003)],.003,'trim');bar(lp,[0,.112,0],[0,.112,dir*span],.004,'trim');rears.push({x:BACK,z,dir,span,tip:0,rear:true,swing:-dir,local:lp,pads:q});}
 const doors=leaves.concat(rears),rotation=(leaf,p)=>leaf.swing*(leaf.rear?p.rear:p.angle);
 function transform(leaf,p){const theta=rotation(leaf,p),c=Math.cos(theta),s=Math.sin(theta);return q=>[leaf.x+q[0]*c+q[2]*s,q[1],leaf.z-q[0]*s+q[2]*c];}
 const height=p=>p.lift*(TOP+.027);
 function lines(p,visit){const down=height(p),send=(a,b,rod)=>{if(a[1]<=down&&b[1]<=down)return;let aa=a,bb=b;
   if(a[1]<down||b[1]<down){const u=(down-a[1])/(b[1]-a[1]),v=a.map((x,k)=>x+u*(b[k]-x));if(a[1]<down)aa=v;else bb=v;}
   visit([aa[0],aa[1]-down,aa[2]],[bb[0],bb[1]-down,bb[2]],rod.w,rod.m);};
   for(const rod of bars)send(rod.a,rod.b,rod);for(const leaf of doors){const at=transform(leaf,p);for(const rod of leaf.local)send(at(rod.a),at(rod.b),rod);}}
 function skins(p,visit){const down=height(p);function emit(q,m){if(!down){visit(q,m);return;}const out=[];let a=q.at(-1);for(const b of q){if((a[1]>=down)!==(b[1]>=down)){const u=(down-a[1])/(b[1]-a[1]);out.push([a[0]+(b[0]-a[0])*u,0,a[2]+(b[2]-a[2])*u]);}if(b[1]>=down)out.push([b[0],b[1]-down,b[2]]);a=b;}if(out.length>=3)visit(out,m);}
   for(const f of faces)emit(f.q,f.m);for(const leaf of doors){const at=transform(leaf,p);for(const f of leaf.pads)emit(f.q.map(at),f.m);}}
 // Flush enamel end plate: shared artwork, in the rig's model plane. The
 // luminous telltale changes on the release edge, not one animation later.
 const signH=.031,signW=signH*180/46,sign={x:FRONT-.005-signW/2,y:TOP-.010,z:B+.009,w:signW,h:signH};
 function enamel(g,w,h,go){g.save();g.scale(w/180,h/46);g.fillStyle='#b8b899';g.fillRect(0,0,180,46);g.fillStyle='#193d34';g.fillRect(2,2,176,42);g.fillStyle='#96ad91';g.fillRect(9,8,3,29);g.textAlign='left';g.textBaseline='middle';g.fillStyle='#f7ebcc';g.font='700 29px Georgia,serif';g.fillText('START',19,24);g.fillStyle='#536358';g.fillRect(136,7,2,32);g.beginPath();g.arc(158,23,8,0,Math.PI*2);g.fillStyle=go?'#aadb99':'#eabe72';g.fill();g.restore();}
 const api={sidePoint,sign,enamel,B,FRONT,BACK,TOP,sill,OPEN,CLEAR,PARK,step,badges,colors,bars,faces,leaves,rears,doors,pose,transform,rotation,height,lines,skins};root.AscotGate=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
