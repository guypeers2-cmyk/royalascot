/* The same free-standing unmounted trotter and sulky for the orbit and all studio passes. */
(function(){'use strict';const TAU=Math.PI*2;let data;
window.CabinetFigurines=function(arena){const T=THREE,D=data||(data=CarrierMeshData()),loader=new T.TextureLoader();const palette=new Array(64);let gait=null;return function(n){
 const h=new T.Group();arena.add(h);const g=new T.BufferGeometry(),p=new Float32Array(D.pos),smooth=(lo,hi,x)=>{const v=Math.max(0,Math.min(1,(x-lo)/(hi-lo)));return v*v*(3-2*v);};
 // Preserve the photographic contour but give the lit barrel, withers and
 // neck more curvature when the model rotates away from a broadside view.
 for(let i=0;i<p.length;i+=3)p[i+2]*=1+.24*smooth(.19,.30,p[i+1])*(1-.6*smooth(.43,.56,p[i+1]));
 const rest=p.slice();g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('uv',new T.BufferAttribute(D.uv,2));g.setIndex(new T.BufferAttribute(D.idx,1));g.computeVertexNormals();const normals=g.attributes.normal.array,restN=normals.slice();g.attributes.position.setUsage(T.DynamicDrawUsage);g.attributes.normal.setUsage(T.DynamicDrawUsage);
 const file='cast-'+n+'.webp',tex=loader.load(window.ASCOT_ASSETS?.[file]||'assets/'+file);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=16;
 const skin=new T.MeshPhysicalMaterial({map:tex,roughness:.56,metalness:.008,clearcoat:.26,clearcoatRoughness:.32,sheen:.35,sheenRoughness:.55,sheenColor:new T.Color('#ffe8c4'),envMapIntensity:.75,emissiveMap:tex,emissive:0xffffff,emissiveIntensity:.065,side:T.DoubleSide});const body=new T.Mesh(g,skin);body.castShadow=true;h.add(body);
 if(window.AscotCloth){const print=new T.CanvasTexture(AscotCloth.stamp(n));print.colorSpace=T.SRGBColorSpace;print.anisotropy=16;const dye=new T.MeshStandardMaterial({map:print,transparent:true,alphaTest:.38,roughness:.88,envMapIntensity:.35,polygonOffset:true,polygonOffsetFactor:-1});for(const side of [1,-1]){const patch=new T.Mesh(new T.PlaneGeometry(.145,.127),dye);patch.position.set(-.051,.354,side*.104);patch.rotation.order='YXZ';patch.rotation.y=side<0?Math.PI:0;patch.rotation.z=side*-.065;body.add(patch);}}
 // The Turf cast has no plinth or spindle beneath its feet. Ground it
 // on the lowest articulated hoof instead of drawing a shoe-shaped plinth.
 h.userData.cast='harness-trot';const bike=(window.AscotSulky||(typeof require==='function'?require('./sulky'):null)).create(T,h,body,n);
 const parts=[],phases=[];for(let i=0;i<D.weights.length;i++){const phase=D.phase[i];let id=phases.indexOf(phase);if(id<0){id=phases.push(phase)-1;}const j=i*3,x=rest[j],y=rest[j+1],fore=phase>2.8;
   parts.push({x,y,z:rest[j+2],id,fore,leg:smooth(.001,.135,D.weights[i]),distal:1-smooth(.115,.19,y),toe:1-smooth(.057,.098,y),neck:smooth(.13,.30,x)*smooth(.30,.42,y),tail:(1-smooth(-.32,-.20,x))*smooth(.19,.28,y),withers:smooth(.37,.49,y)*(1-smooth(.14,.22,x))*smooth(-.15,-.05,x)});}
 // Cache the planted limb for every weighted vertex. The walk starts from
 // this skeleton, not from a slowed-down midair gallop frame.
 for(const q of parts){const {fore,y}=q,far=Math.max(0,Math.min(1,(phases[q.id]-(fore?3.13:0))/1.71)),root=fore?.277:.300,sole=fore?.07168-.04944*far:.02008+.07312*far,weight=q.leg*Math.max(0,Math.min(1,(root-y)/(root-sole)));
   q.plantX=weight*(fore?-.181+.015*far:-.100+.252*far);q.plantY=weight*(.024-sole);q.load=weight;if(!fore&&q.leg){q.hind=AscotHindGait.bind(q.x,y,far);const t=q.hind.a;q.hipBlend=(1-smooth(.026,.077,Math.abs(t.v)))*(1-smooth(.232+.027*far,.307,y));}}
 const legs=phases.map(v=>{const fore=v>2.8,far=v-(fore?3.13:0)>.8;return (fore?-.25:0)+(far?.5:0);});
 const G=AscotHindGait,sideOf=v=>v>2.8?Math.max(0,Math.min(1,(v-127*TAU/255)/(70*TAU/255))):Math.min(1,v/(69*TAU/255));
 // Material group IDs in the mould are bytes. Snap the measured endpoints;
 // the two surfaces of a hoof belong to the SAME leg, regardless of normal.
 const sides=phases.map(v=>{const t=sideOf(v);return t<.0001?0:t>.9999?1:t;});
 const loadRoll=new Float32Array(parts.length);for(let i=0;i<parts.length;i++){const q=parts[i];loadRoll[i]=q.leg*(1-smooth(.125,.300,q.y));if(!q.leg)continue;
   q.trot=G.trotBind(q.x,q.y,q.fore,sides[q.id]);q.stifle=q.fore?0:Math.exp(-(((q.y-(.222+.027*sides[q.id]))/.031)**2+((q.x-(-.113-.098*sides[q.id]))/.051)**2));q.attach=q.leg*(1-smooth(.035,.081,Math.abs(q.trot.a.v)))*(1-smooth(q.fore?.210:.232+.027*sides[q.id],q.fore?.303:.307,q.y));}
 const result=[0,0];function stepWalk(theta,amp,bank){const a=Math.sin(theta),b=Math.cos(theta),beat=Math.sin(theta*2+.32),m=phases.map((v,i)=>{const s=Math.sin(theta+v),c=Math.cos(theta+v),u=((theta/TAU+legs[i])%1+1)%1,stance=u<.62,vv=stance?u/.62:(u-.62)/.38,air=stance?0:Math.sin(Math.PI*vv)**2;
     return {hind:v<2?G.pose(theta,Math.min(1,v/1.71),true):null,s,fold:Math.max(0,c*.94+.11),slide:.331*(stance?.5-vv:vv*vv*(3-2*vv)-.5),clear:.046*air};});
   const rz=.010*beat*amp,rx=bank+.009*a*amp,sy=Math.cos(rx)*Math.sin(rz),cy=Math.cos(rx)*Math.cos(rz),sz=-Math.sin(rx);let lowest=Infinity;
   for(let i=0,j=0;i<parts.length;i++,j+=3){const q=parts[i],v=m[q.id],{x,y}=q;let dx=0,dy=0,bend=0;
     if(q.leg){dx=q.load*v.slide;dy=q.load*v.clear*(.48+.52*q.distal);bend=q.leg*v.slide*2.5*amp;}
     if(q.hind&&amp){G.sample(v.hind,q.hind,result);dx+=(q.leg*(result[0]-x-q.plantX)-dx)*q.hipBlend;dy+=(q.leg*(result[1]-y-q.plantY)-dy)*q.hipBlend;bend=q.leg*(.42*v.s+.25*v.fold)*amp;}
     dx+=.010*(q.stifle||0);dx+=.52*(q.neck*.006*b-q.withers*(.006*a+.002*beat));dy+=.52*(q.neck*(.010*a+.002*beat)+q.tail*(.014*a-.009*b)+q.withers*(.009*b-.005*beat));
     p[j]=x+q.plantX+dx*amp;p[j+1]=Math.max(q.hind&&amp?.016:.024,y+q.plantY+dy*amp);p[j+2]=q.z+(q.tail*.0105*b+q.withers*.002*a)*amp*.52;
     if(q.leg&&y<.16)lowest=Math.min(lowest,sy*p[j]+cy*p[j+1]+sz*p[j+2]);
     const co=1-.5*bend*bend,si=bend*(1-bend*bend/6);normals[j]=co*restN[j]-si*restN[j+1];normals[j+1]=si*restN[j]+co*restN[j+1];normals[j+2]=restN[j+2];
   }if(amp===0)g.computeVertexNormals();body.rotation.set(rx,0,rz);body.position.y=.0015-lowest;
 }
 function trotBank(bank){if(!bank)return;const co=1/Math.cos(bank)-1,si=Math.tan(bank);for(let i=0,j=0;i<loadRoll.length;i++,j+=3)if(loadRoll[i])p[j+1]+=loadRoll[i]*(co*p[j+1]+si*p[j+2]);}
 function stepTrot(theta,amp,bank){const t=theta/TAU,beat=Math.cos(2*theta+Math.PI/4),s=Math.sin(2*theta),b=Math.sin(2*theta+Math.PI/4),hind=[G.trot(t,false,0,amp),G.trot(t,false,1,amp)],fore=[G.trot(t,true,0,amp),G.trot(t,true,1,amp)],m=phases.map((v,i)=>G.trotPose(...(v>2.8?fore:hind),sides[i]));
   for(let i=0,j=0;i<parts.length;i++,j+=3){const q=parts[i],px=q.x+q.plantX,py=Math.max(G.floor,q.y+q.plantY);let x=px,y=py;
     if(q.attach){G.trotSample(m[q.id],q.trot,result);x+=q.attach*(result[0]-px);y+=q.attach*(result[1]-py);}
     // A quiet back, with two small withers/neck responses per stride. No
     // galloping once-per-cycle dive or coupled push from the hindquarters.
     p[j]=px+amp*(x-px+.013*(q.stifle||0)+.0042*q.neck*b-.0023*q.withers*b);p[j+1]=py+amp*(y-py+.0048*q.neck*b+.004*q.withers*beat+.0065*q.tail*s);p[j+2]=q.z+amp*(.006*q.tail*s+.0008*q.withers*s);
     // A partial first step has a partial hoof rotation, not a linear blend
     // of two soles (which lifts the weight-bearing heel at low effort).
     if(amp<1&&q.trot?.shoe){const k=m[q.id].sole,b=q.trot,w=b.shoe*q.attach;p[j]+=w*(k[0]+k[2]*b.toeX-k[3]*b.toeY);p[j+1]+=w*(k[1]+k[3]*b.toeX+k[2]*b.toeY+(1-amp)*(G.floor+b.toeY-py));}}
   trotBank(bank);g.computeVertexNormals();body.rotation.set(bank,0,0);body.position.y=.0015-G.floor+amp*G.trunk(t);
 }
 function setPhase(theta,amp=1,walk=false,bank=0){if(walk||!amp)stepWalk(theta,amp,bank);else stepTrot(theta,amp,bank);bike.update(theta,amp,walk);g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;}
 // One shared, lazily developed pose palette for the entire moving field.
 // Keep every vertex, silhouette, UV and moving physical shadow. Interpolate
 // across the wrap, not between discrete displayed frames. Bank compensation
 // is applied after interpolation; a race flight is never pinned to the turf. The exact solver
 // above remains authoritative for starting effort and photographic stock.
 const soles=[];for(let j=0;j<parts.length;j++)if(parts[j].leg&&parts[j].y<.16)soles.push(j*3);
 function cell(k,walk){if(palette[k])return palette[k];setPhase(k*TAU/64,1,walk,0);const v=new Int16Array(p.length*2);for(let j=0;j<p.length;j++){v[j]=Math.round(p[j]*32766);v[j+p.length]=Math.round(normals[j]*16000);}return palette[k]=v;}
 function move(theta,amp,walk,bank){if(amp!==1){setPhase(theta,amp,walk,bank);return;}if(gait!==walk){gait=walk;palette.fill(null);}const u=((theta/TAU)%1+1)%1*64,k=Math.floor(u),f=u-k,A=cell(k,walk),B=cell((k+1)%64,walk),N=p.length;
   const p0=(1-f)/32766,p1=f/32766,n0=(1-f)/16000,n1=f/16000;for(let j=0;j<N;j++){p[j]=p0*A[j]+p1*B[j];normals[j]=n0*A[N+j]+n1*B[N+j];}
   if(walk){const a=Math.sin(theta),rz=.010*Math.sin(theta*2+.32),rx=bank+.009*a,sy=Math.cos(rx)*Math.sin(rz),cy=Math.cos(rx)*Math.cos(rz),sz=-Math.sin(rx);let low=Infinity;for(const j of soles)low=Math.min(low,sy*p[j]+cy*p[j+1]+sz*p[j+2]);body.rotation.set(rx,0,rz);body.position.y=.0015-low;}
   else{trotBank(bank);body.rotation.set(bank,0,0);body.position.y=.0015-G.floor+G.trunk(theta/TAU);}bike.update(theta,amp,walk);g.attributes.position.needsUpdate=g.attributes.normal.needsUpdate=true;
 }
 return{mesh:h,texture:tex,balance:bike.balance,roll:bike.roll,setPhase,move,setPose:k=>setPhase(k/8*TAU),get ready(){return !!tex.image?.complete;}};
};};})();
