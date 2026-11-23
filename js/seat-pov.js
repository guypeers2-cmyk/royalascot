/* Station 07 is one fixed eye. Turning a head rotates RAYS, not the table or
   the camera position. The same pinhole projects the photograph, live figures,
   CRTs, scenery and clicks. No WebGL or device-orientation permission needed. */
(function(root){'use strict';
 const ZOOM=1.5;
 const W=1150,gutter=80,stockW=W+2*gutter,H=W*768/1376,F=407,RAD=Math.PI/180,limit=(v,a,b)=>Math.max(a,Math.min(b,v)),dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
 const film={u:[1/F,0,0],v:[0,1/F,0],o:[-W/(2*F),-H/(2*F),1]};
 // Beyond the photographed plate the backdrop is the real cubical room.
 // Give an obliquely projected wheel room to overhang the plate without
 // clipping it on the intermediate canvas. Survey coordinates stay intact.
 const overscan={...film,o:[-(W/2+gutter)/F,-H/(2*F),1]};
 function angles(x,y){const u=(x-W/2)/F,v=(y-H/2)/F;return {yaw:Math.atan(u),pitch:Math.atan2(v,Math.hypot(1,u))};}
 function basis(yaw,pitch){const s=Math.sin(yaw),c=Math.cos(yaw),t=Math.sin(pitch),h=Math.cos(pitch);return {right:[c,0,-s],down:[-s*t,h,-c*t],forward:[s*h,t,c*h]};}
 function lens(w,h){return ZOOM*Math.max(w/(2*Math.tan(39*RAD)),h/(2*Math.tan(34*RAD)));}
 function frame(yaw,pitch,width,height){return {...basis(yaw,pitch),width,height,f:lens(width,height)};}
 // Return the homogeneous x, y and depth coefficients for a texture plane.
 function coefficients(fr,p){const row=v=>{const d=dot(v,fr.forward);return [dot(v,fr.right)*fr.f+d*(fr.cx??fr.width*.5),dot(v,fr.down)*fr.f+d*(fr.cy??fr.height*.5),d]};return [row(p.u),row(p.v),row(p.o)];}
 function cssMatrix(m){const [[a,b,c],[d,e,f],[g,h,i]]=m;return `matrix3d(${a},${b},0,${c},${d},${e},0,${f},0,0,1,0,${g},${h},0,${i})`;}
 function screenPoint(fr,x,y){const ray=[(x-W/2)/F,(y-H/2)/F,1],d=dot(ray,fr.forward);if(d<=0)return null;return {x:(fr.cx??fr.width/2)+fr.f*dot(ray,fr.right)/d,y:(fr.cy??fr.height/2)+fr.f*dot(ray,fr.down)/d};}
 function pick(fr,x,y){const u=(x-(fr.cx??fr.width/2))/fr.f,v=(y-(fr.cy??fr.height/2))/fr.f,q=fr.forward.map((a,k)=>a+u*fr.right[k]+v*fr.down[k]);if(q[2]<=0)return null;return {x:W/2+F*q[0]/q[2],y:H/2+F*q[1]/q[2]};}
 // The field command holds the long side, including both bends. Only a
 // deliberate runner pin is entitled to turn the spectator's head.
 function fieldAim(points){const mid=angles(W/2,349);if(points.length!==1)return mid;const p=angles(limit(points[0].x,68,W-68),limit(points[0].y,275,443));return {yaw:p.yaw*.38,pitch:mid.pitch+(p.pitch-mid.pitch)*.68};}
 function head(reduced=false){let yaw=0,pitch=5*RAD,fresh=true,dragging=false,hold=0,free=false,ox=0,oy=0;
   const cap=(goal,old,dt,speed)=>old+limit((goal-old)*(1-Math.exp(-dt*(reduced?4.5:7.4))),-dt*speed,dt*speed);
   function pose(){return {yaw,pitch};}
   function steer(a,b){yaw=limit(a,-72*RAD,72*RAD);pitch=limit(b,-21*RAD,28*RAD);fresh=false;}
   return {pose,get manual(){return free||dragging||hold>0;},get free(){return free},set free(v){free=!!v;hold=0;dragging=false;},reset(){fresh=true;hold=0;dragging=free=false;},
     tick(dt,aim,tracking=true){dt=limit(dt,0,.13);if(fresh&&!free&&!dragging){steer(aim.yaw,aim.pitch);return pose();}if(tracking&&!dragging&&!free){if(hold>0)hold=Math.max(0,hold-dt);else steer(cap(aim.yaw,yaw,dt,(reduced?60:96)*RAD),cap(aim.pitch,pitch,dt,45*RAD));}return pose();},
     begin(){ox=yaw;oy=pitch;dragging=true;},drag(dx,dy,f){steer(ox-Math.atan(dx/f),oy-Math.atan(dy/f));},end(moved){if(dragging&&moved)hold=1.25;dragging=false;},
     nudge(dx,dy){steer(yaw+dx*RAD,pitch+dy*RAD);hold=1.25;},release(){hold=0;dragging=false;}
   };
 }
 const SX=1.003,faceDefs={front:[[2,0,0],[0,2,0],[0,0,1]],left:[[0,0,2],[0,2,0],[-1,0,0]],right:[[0,0,-2],[0,2,0],[1,0,0]],up:[[2,0,0],[0,0,2],[0,-1,0]],down:[[2,0,0],[0,0,-2],[0,1,0]]};
 function create(view,reduced){const motion=head(reduced);let stage=null,plate=null,ctx=null,faces=[],fr=null,px=1,last='',mode='',exposure=null,sF=null,sCx=null,sCy=null,lastW=0,lastH=0,zoomTarget=1,zoomSmooth=1;
   function init(){if(stage)return;stage=document.createElement('div');stage.id='seatStage';stage.setAttribute('aria-hidden','true');view.prepend(stage);
     for(const [key,[U,V,n]] of Object.entries(faceDefs)){const size=768,u=U.map(k=>k*SX/size),v=V.map(k=>k*SX/size),o=n.map((k,i)=>k-(U[i]+V[i])*SX/2);const im=new Image();im.alt='';im.draggable=false;im.width=im.height=size;const file='seat-'+key+'.webp';im.src=root.ASCOT_ASSETS?.[file]||'assets/'+file;stage.append(im);faces.push({el:im,p:{u,v,o}});}
     plate=document.createElement('canvas');plate.className='seat-film';plate.style.width=stockW+'px';plate.style.height=H+'px';stage.append(plate);ctx=plate.getContext('2d');}
   function enable(on){view.classList.toggle('seat-pov',on);if(on)init();if(stage)stage.hidden=!on;if(!on){motion.reset();fr=null;exposure=null;sF=sCx=sCy=null;lastW=lastH=0;zoomTarget=zoomSmooth=1;last='';}}
   function zoom(f){zoomTarget=limit(zoomTarget*f,.75,2.2);}
   function resetZoom(){zoomTarget=1;}
   function aim(w,h,dpr,dt,targets,phase,pin,cap=2,box=null,ink=null){const wanted=phase==='race'?fieldAim(targets):phase==='gates'?angles(root.AscotCourse.photo(0,.5).x,385):{yaw:0,pitch:10*RAD},a=motion.tick(dt,wanted,phase==='race'||phase==='gates');fr=frame(a.yaw,a.pitch,w,h);
     const m=phase!=='race'?'station':motion.free?'free':pin?'runner-'+pin:'field';if(mode!==m){stage.dataset.gaze=mode=m;}
     if((m==='field'||m.startsWith('runner-'))&&!motion.manual){const a=box??{l:0,t:0,r:w,b:h},aw=a.r-a.l,ah=a.b-a.t;
       // Offset the optical centre, not the picture separately from its
       // clickable plane. All six teams stay inside the actual clear glass.
       fr.f=1;fr.cx=fr.cy=0;const b=m==='field'||!ink?{l:-18,r:1212,t:253,b:462}:ink,ps=[];for(const x of [b.l,b.r])for(const y of [b.t,b.b]){const p=screenPoint(fr,x,y);if(p)ps.push(p);}if(ps.length===4){const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),L=Math.min(...xs),R=Math.max(...xs),T=Math.min(...ys),B=Math.max(...ys),pad=Math.min(6,.03*aw,.04*ah);fr.f=Math.max(.1,Math.min((aw-2*pad)/(R-L),(ah-2*pad)/(B-T),aw*.77,ah*2.2));const k=fr.f;fr.cx=limit((a.l+a.r-k*(R+L)*.68)/2,a.l+pad-L*k,a.r-pad-R*k);fr.cy=limit((a.t+a.b-k*(B+T)*.68)/2,a.t+pad-T*k,a.b-pad-B*k);}else fr=frame(0,0,w,h);exposure=[fr.f/w,(fr.cx??w/2)/w,(fr.cy??h/2)/h];
     }else if(phase==='race'&&motion.manual&&exposure){fr.f=w*exposure[0];fr.cx=w*exposure[1];fr.cy=h*exposure[2];}
     const stepDt=limit(dt,0,.13),zEase=1-Math.exp(-stepDt*14);
     zoomSmooth=Math.abs(zoomTarget-zoomSmooth)<.001?zoomTarget:zoomSmooth+(zoomTarget-zoomSmooth)*zEase;
     const tf0=fr.f,tcx0=fr.cx??w*.5,tcy0=fr.cy??h*.5;
     const bx=box?(box.l+box.r)*.5:w*.5,by=box?(box.t+box.b)*.5:h*.5;
     const tf=tf0*zoomSmooth,tcx=zoomSmooth===1?tcx0:bx+zoomSmooth*(tcx0-bx),tcy=zoomSmooth===1?tcy0:by+zoomSmooth*(tcy0-by);
     if(sF==null||lastW!==w||lastH!==h){sF=tf;sCx=tcx;sCy=tcy;lastW=w;lastH=h;}
     else{const fEase=1-Math.exp(-stepDt*16);sF=Math.abs(tf-sF)<.005?tf:sF+(tf-sF)*fEase;sCx=Math.abs(tcx-sCx)<.02?tcx:sCx+(tcx-sCx)*fEase;sCy=Math.abs(tcy-sCy)<.02?tcy:sCy+(tcy-sCy)*fEase;}
     fr.f=sF;fr.cx=sCx;fr.cy=sCy;
     const key=[a.yaw,a.pitch,w,h,fr.f,fr.cx,fr.cy].join('/');if(last!==key){last=key;for(const face of faces)face.el.style.transform=cssMatrix(coefficients(fr,face.p));plate.style.transform=cssMatrix(coefficients(fr,overscan));}
     // The projected texture must not change the CSS viewport or its hit box.
     const next=limit(fr.f*dpr/F,Math.min(.75,cap*.68),cap);const pw=Math.round(stockW*next),ph=Math.round(H*next);if(plate.width!==pw||plate.height!==ph){plate.width=pw;plate.height=ph;}px=plate.width/stockW;ctx.setTransform(px,0,0,plate.height/H,px*gutter,0);ctx.clearRect(-gutter,0,stockW,H);return ctx;
   }
   return {enable,aim,motion,zoom,resetZoom,get magnification(){return fr?fr.f/F:1;},get ready(){return faces.every(f=>f.el.complete&&f.el.naturalWidth>0);},project:(x,y)=>fr?screenPoint(fr,x,y):null,hit:(x,y)=>fr?pick(fr,x,y):null,drag:(dx,dy)=>motion.drag(dx,dy,fr?.f||500)};
 }
 const api={W,H,F,ZOOM,gutter,stockW,overscan,film,angles,basis,frame,coefficients,cssMatrix,screenPoint,pick,fieldAim,head,create};root.SeatPOV=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
