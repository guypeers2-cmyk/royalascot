/* Original open racing bike, sculpted in +X-forward mould units. The horse
   wears its harness; the menner sits on the independently grounded chassis.
   Merge parts by moving assembly, not hundreds of draw calls per runner. */
(function(root){'use strict';const spec=(root.AscotCourse||(typeof require==='function'?require('./course'):null)).bike,{wheelR,spread,axle}=spec,field=1.44,pivot=.163,vh=.72*field,vw=vh*176/140,co=5.2/Math.hypot(5.2,.704),si=.704/Math.hypot(5.2,.704),colors=['#e6ddc3','#252b32','#ba302e','#26558f','#deab3f','#267359'];
 // Outer tyre, hub cap, muzzle and poll. The last two bounds enclose
 // every walking/quiet cast, in unscaled (+X forward) team units.
 const envelope=Object.freeze({rear:Math.min(axle-wheelR,-.754),nose:.421,halfWidth:spread+spec.cap,top:.572});
 const seatAt=[-.594,.218,0],hip=[.002,.003,.033],knee=[.148,.050,.105],ankle=[.289,.027,.121],boot=[.308,.030,.121],recline=.50;
 const pose=Object.freeze({seat:seatAt,hip,knee,ankle,boot,recline});
 const plateWidth=(y,scale)=>(46+55*Math.min(1,Math.max(0,(y-302)/140)))*scale*field;
 const anchor=k=>{const a=k*Math.PI/14;return [.5+pivot*Math.cos(a)/vw,.5+(.296*co-pivot*Math.sin(a)*si)/vh]};
 function create(T,horse,body,n){const silk=colors[n-1],trim=n===1?'#33485a':n===5?'#733d26':'#eadfbc',steel='#97a39f',black='#211f1f',leather='#423027',brass='#c6a16a';const wheel=new T.Group(),seat=new T.Group();horse.add(wheel,seat);wheel.position.set(axle,wheelR+.0015,0);seat.position.set(...seatAt);const upper=new T.Group();seat.add(upper);upper.rotation.z=recline;
  const grps=new Map();function add(obj,geo,color,position,quat=null,scale=null){const mat=new T.Matrix4().compose(new T.Vector3(...position),quat||new T.Quaternion(),new T.Vector3(...(scale||[1,1,1])));geo.applyMatrix4(mat);if(geo.index){const b=geo.toNonIndexed();geo.dispose();geo=b;}let a=grps.get(obj);if(!a){a={p:[],n:[],c:[]};grps.set(obj,a)}a.p.push(...geo.attributes.position.array);a.n.push(...geo.attributes.normal.array);const col=new T.Color(color);for(let i=0;i<geo.attributes.position.count;i++)a.c.push(col.r,col.g,col.b);geo.dispose();}
  const V=x=>new T.Vector3(...x),quat=(v,w)=>new T.Quaternion().setFromUnitVectors(v,w),Y=new T.Vector3(0,1,0);
  function rod(o,a,b,r,c,r2=r,seg=7){let v=V(b).sub(V(a)),len=v.length();add(o,new T.CylinderGeometry(r2,r,len,seg),c,V(a).lerp(V(b),.5).toArray(),quat(Y,v.normalize()));}
  function path(o,pts,r,c,res=16){const cr=new T.CatmullRomCurve3(pts.map(V));add(o,new T.TubeGeometry(cr,res,r,6,false),c,[0,0,0]);}
  function oval(o,x,y,z,rx,ry,rz,c,tilt=0){add(o,new T.SphereGeometry(1,14,10),c,[x,y,z],new T.Quaternion().setFromEuler(new T.Euler(0,0,tilt)),[rx,ry,rz]);}
  function ring(o,x,y,z,rx,wire,c){add(o,new T.TorusGeometry(rx,wire,8,44),c,[x,y,z]);}
  function hoop(o,points,r,c){path(o,points.concat([points[0]]),r,c,28);}
  // Racing harness: breastcollar, overgirth and side tugs / buckles.
  for(const x of [-.000,.018])hoop(body,[[x+.023,.423,0],[x+.020,.405,.055],[x+.012,.366,.071],[x+.004,.307,.061],[x,.265,.036],[x,.252,0],[x,.265,-.036],[x+.004,.307,-.062],[x+.012,.366,-.071],[x+.020,.405,-.056]],.0048,leather);
  path(body,[[.000,.372,.073],[.102,.34,.081],[.18,.306,.061],[.204,.295,0],[.18,.306,-.061],[.102,.34,-.081],[.000,.372,-.073]],.0095,'#4b3428',30);
  for(const side of [-1,1]){const z=side;oval(body,.035,.373,z*.073,.019,.014,.011,brass);path(body,[[.30,.493,z*.034],[.216,.486,z*.024],[.112,.422,z*.041],[.017,.415,z*.045]],.0027,leather);}
  // Fitted bridle, pad and QH fittings. The brow, nose and cheek straps
  // have a flat cross-section: the two reins remain thin, round lines.
  function strap(o,pts,w,depth,c){const curve=new T.CatmullRomCurve3(pts.map(V)),xyz=[];let last=null;
   for(let j=0;j<=16;j++){const p=curve.getPoint(j/16),t=curve.getTangent(j/16),z=new T.Vector3(0,0,Math.sign(p.z)||1),a=t.clone().cross(z);if(a.lengthSq()<.01)a.set(0,1,0);a.normalize();const b=t.clone().cross(a).normalize();const ring=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([i,k])=>p.clone().addScaledVector(a,i*w/2).addScaledVector(b,k*depth/2).toArray());if(last)for(let h=0;h<4;h++){const n=(h+1)%4;xyz.push(...last[h],...ring[h],...ring[n],...last[h],...ring[n],...last[n]);}last=ring;}const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(xyz,3));geo.computeVertexNormals();add(o,geo,c,[0,0,0]);}
  oval(body,.011,.413,0,.049,.015,.062,'#3c3730',-.08);oval(body,.015,.425,0,.038,.009,.055,black,-.06);
  path(body,[[.024,.430,0],[-.074,.433,.001],[-.170,.435,.002],[-.214,.423,.011],[-.245,.412,.018]],.0032,'#49362a',22);
  for(const z of [-1,1]){const at=pts=>pts.map(([x,y,d])=>[x,y,d*z]);
   strap(body,at([[.307,.536,.017],[.316,.523,.032],[.333,.496,.037],[.360,.469,.032],[.394,.446,.024]]),.008,.0029,'#423029');
   strap(body,at([[.320,.527,.033],[.330,.526,.021],[.338,.523,0]]),.008,.0028,trim);
   strap(body,at([[.374,.475,.018],[.384,.467,.029],[.396,.457,.025],[.399,.451,.013],[.399,.450,0]]),.010,.003,'#463129');
   path(body,at([[.322,.513,.031],[.308,.492,.048],[.285,.477,.053],[.274,.465,.046]]),.0032,leather,15);
   ring(body,.391,.446,z*.029,.009,.0019,'#c4b79c');rod(body,[.394,.445,z*.028],[.391,.445,z*.011],.0023,steel);
   const keeper=(x,y,d,w,h)=>{const q=at([[x-w,y-h,d],[x-w,y+h,d],[x+w,y+h,d],[x+w,y-h,d],[x-w,y-h,d]]);for(let j=0;j<4;j++)rod(body,q[j],q[j+1],.0017,brass);};
   keeper(.349,.482,.036,.005,.004);keeper(.099,.345,.082,.009,.007);
   rod(horse,[.006,.347,z*.087],[.047,.358,z*.083],.0064,steel);oval(horse,.029,.354,z*.094,.006,.006,.0035,brass);
   path(horse,[[.029,.361,z*.084],[.014,.375,z*.078],[-.002,.373,z*.081]],.0026,black);}
  // Twin independent shafts (below the withers), triangulated stays,
  // foot-rests on each side, rear arch and a single suspended seat.
  // A curved cross-tree above the tyres; two separate forks support the
  // hubs. No transverse spindle through the horse's space. The saddle is
  // a low padded pan on a short pair of cantilevered seat rails.
  path(horse,[[axle,.145,-.154],[axle-.004,.202,-.133],[axle-.004,.210,0],[axle-.004,.202,.133],[axle,.145,.154]],.0082,silk,28);
  oval(horse,-.602,.207,0,.061,.013,.059,black,.035);oval(horse,-.643,.214,0,.021,.018,.057,black,-.18);
  for(const z of [-1,1]){const a=[axle,wheelR+.0015,z*spread],end=[.045,.356,z*.082];
   for(const side of [-1,1]){const foot=[axle,wheelR+.0015,z*(spread+side*.010)];path(horse,[foot,[axle-.003,.147,z*(spread+side*.009)],[axle-.005,.200,z*.144]],.0048,silk,13);rod(horse,[axle+.001,.140,z*(spread+side*.009)],[axle+.036,.187,z*.147],.0035,steel);}
   path(horse,[[axle-.004,.201,z*.145],[-.471,.225,z*.157],[-.327,.252,z*.150],[-.160,.307,z*.115],end],.0063,silk,30);
   path(horse,[a,[-.482,.155,z*.160],[-.324,.246,z*.148]],.0042,steel,20);
   rod(horse,[-.647,.199,z*.038],[-.528,.213,z*.065],.004,steel);rod(horse,[-.529,.214,z*.065],[-.516,.226,z*.153],.0048,steel);
   // Inboard heel and toe rest, right under the extended boot. A return
   // loop, rubber tread and two clamps attach to each separate shaft.
   const heel=[seatAt[0]+.275,.232,z*.121],toe=[seatAt[0]+.329,.242,z*.121];rod(horse,[heel[0],.254,z*.149],heel,.0042,steel);rod(horse,heel,toe,.005,black);for(const d of [-1,1])path(horse,[[heel[0]-.006,.248,z*(.121+d*.018)],[heel[0]-.009,.230,z*(.121+d*.019)],[toe[0]+.007,.237,z*(.121+d*.017)],[toe[0]+.009,.249,z*(.121+d*.016)]],.0035,steel,13);rod(horse,[toe[0]+.007,.245,z*.105],[toe[0]+.007,.245,z*.138],.0038,steel);
   rod(horse,[-.019,.348,z*.087],end,.0080,brass);hoop(horse,[[.027,.353,z*.087],[.02,.366,z*.075],[.043,.371,z*.075],[.050,.357,z*.084]],.0028,leather);
   const rim=n===5?'#d2a348':n===1?'#d5ccb3':silk;ring(wheel,0,0,z*spread,wheelR-.0045,.0045,'#212224');ring(wheel,0,0,z*spread,wheelR-.009,.0037,rim);ring(wheel,0,0,z*spread,wheelR-.006,.0016,'#bec3be');rod(wheel,[0,0,z*(spread-.012)],[0,0,z*(spread+.012)],.0105,steel);oval(wheel,0,0,z*(spread+.012),.007,.007,.005,brass);
   for(let j=0;j<16;j++){const t=j*Math.PI/8;rod(wheel,[.009*Math.cos(t+.38),.009*Math.sin(t+.38),z*(spread+(j%2?.007:-.005))],[(wheelR-.009)*Math.cos(t),(wheelR-.009)*Math.sin(t),z*spread],.00138,j%2?'#bec3bc':'#727c78',.0010,5);}}
  // Thin, smooth dished wheel shields on BOTH faces. Keep the lacing
  // visible through the clear material; a single extra mesh per team.
  const skin=[],R=wheelR-.008;for(const z of [-1,1])for(const face of [-1,1])for(let j=0;j<48;j++){const vertex=(rad,i)=>[rad*Math.cos(i*Math.PI/24),rad*Math.sin(i*Math.PI/24),z*spread+face*(.002+.009*(1-rad/R))];const a=vertex(.010,j),b=vertex(R,j),c=vertex(R,j+1),d=vertex(.010,j+1);skin.push(...a,...b,...c,...a,...c,...d);}const cg=new T.BufferGeometry();cg.setAttribute('position',new T.Float32BufferAttribute(skin,3));cg.computeVertexNormals();const covers=new T.Mesh(cg,new T.MeshPhysicalMaterial({color:0xc2d0c7,roughness:.18,metalness:.06,clearcoat:.85,clearcoatRoughness:.08,reflectivity:.9,envMapIntensity:1.15,transparent:true,opacity:.27,depthWrite:false,side:T.DoubleSide}));covers.name='Clear dished wheel covers';wheel.add(covers);
  // A low seated driver: shaped jacket, breeches, bent elbows, gloves with
  // two independent reins, supported boots, glazed visor, chinguard, silk piping.
  oval(upper,.002,.008,0,.042,.032,.049,'#ddd7c5');oval(upper,-.020,.078,0,.039,.075,.049,silk,.19);oval(upper,-.027,.12,0,.035,.033,.058,silk,.14);oval(upper,-.029,.145,0,.024,.012,.027,trim);oval(upper,-.030,.156,0,.017,.020,.018,'#b87b55');
  oval(upper,-.025,.184,0,.033,.041,.030,'#cd9574',-.10);oval(upper,.003,.18,0,.011,.01,.012,'#d6a183');oval(upper,-.027,.204,0,.038,.030,.034,silk);oval(upper,-.022,.198,0,.040,.006,.035,trim);oval(upper,.006,.195,0,.024,.004,.030,black);oval(upper,.002,.187,0,.009,.010,.030,'#283943',.12);
  // Piped side panels and shoulder yoke read as racing silks, not a mounted cap.
  for(const z of [-1,1]){path(upper,[[-.054,.132,z*.032],[-.031,.139,z*.040],[-.009,.128,z*.044],[.002,.112,z*.040]],.004,trim);path(upper,[[-.046,.121,z*.041],[-.039,.096,z*.047],[-.027,.063,z*.047],[-.016,.042,z*.040]],.0028,trim);oval(upper,-.025,.176,z*.028,.007,.010,.004,'#b78063');path(upper,[[-.004,.171,z*.017],[.002,.174,z*.014],[.005,.174,z*.007]],.0016,'#805442');path(upper,[[-.046,.188,z*.024],[-.029,.17,z*.028],[-.009,.159,z*.014]],.0025,black);oval(upper,-.037,.214,z*.017,.026,.006,.004,trim,-.03);
   const at=q=>[q[0],q[1],z*q[2]],h=at(hip),k=at(knee),a=at(ankle);rod(seat,h,k,.028,'#e4e1d6',.023,12);oval(seat,...k,.025,.021,.023,'#e0dccf');rod(seat,k,a,.023,'#dfddcf',.012,12);path(seat,[[h[0],h[1]+.013,z*.049],[.12,.061,z*.116],[.155,.052,z*.127],[a[0],a[1]+.007,z*.133]],.0038,silk,17);oval(seat,...at(boot),.030,.013,.015,black,.16);rod(seat,[a[0]-.009,a[1]+.002,z*.121],[a[0]+.003,a[1]+.011,z*.121],.013,black);
   const sh=[-.027,.123,z*.044],el=[-.005,.072,z*.057],wr=[.117,.093,z*.054];rod(upper,sh,el,.019,silk,.014,10);oval(upper,...el,.014,.014,.015,silk);rod(upper,el,wr,.014,silk,.009,10);rod(upper,[.058,.085,z*.054],[.079,.087,z*.054],.013,trim,.0108,10);oval(upper,.124,.095,z*.054,.016,.010,.010,black,.42);
   path(horse,[[seatAt[0]+.124*Math.cos(recline)-.095*Math.sin(recline),seatAt[1]+.124*Math.sin(recline)+.095*Math.cos(recline),z*.054],[-.35,.331,z*.078],[-.13,.388,z*.086],[.097,.413,z*.085],[.31,.438,z*.044],[.393,.446,z*.027]],.0022,'#362a24',30);}
  for(const [o,a] of grps){const g=new T.BufferGeometry();for(const [id,key] of [['position','p'],['normal','n'],['color','c']])g.setAttribute(id,new T.Float32BufferAttribute(a[key],3));g.computeBoundingSphere();const m=new T.Mesh(g,new T.MeshStandardMaterial({vertexColors:true,roughness:.48,metalness:.18,envMapIntensity:.88,side:T.DoubleSide}));m.name=o===wheel?'Sixteen-spoke racing wheels':o===upper?'Helmeted seated driver':o===seat?'Extended legs on forward stirrups':o===horse?'Twin-shaft sulky chassis':'Breastcollar and harness';m.castShadow=true;o.add(m);}
  wheel.name='Sulky axle';seat.name='Driver seat';function roll(distance){wheel.rotation.z=-distance/wheelR;}return {wheel,seat,roll,balance(bank){upper.rotation.x=bank*.48;upper.rotation.y=-bank*.45;},update(theta,amp,walk){roll(theta/(Math.PI*2)*(walk?.542:1));upper.rotation.z=recline+amp*(walk?.004:.007)*Math.sin(theta*(walk?1:2));}};
 }const api={create,wheelR,spread,axle,field,pivot,vh,vw,anchor,envelope,pose,plateWidth,pitchCos:co};root.AscotSulky=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;})(globalThis);
