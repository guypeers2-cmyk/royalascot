/* Review-only mesh witnesses in mould coordinates (+x = horse's nose).
   Select material patches ONCE on the rest cast; read those same vertices
   on each deformed flank. This must not silently become a plot of IK goals.
   Run directly to project the numbered studio's twelve exposures. */
'use strict';
const tau=2*Math.PI;
function patches(d){const legs=[[[0,-.113,.222],[0,-.135,.149],[0,-.053,.060]],[[69,-.211,.249],[69,-.262,.190],[69,-.303,.140]]];
 return legs.map((points,side)=>[[null,-.184,.353],...points].map(([byte,x,y])=>{
  const ids=[];for(let i=0;i<d.weights.length;i++){const j=3*i,match=byte===null?(side?-1:1)*d.pos[j+2]>0:Math.round(d.phase[i]*255/tau)===byte;
   if(match&&Math.hypot(d.pos[j]-x,d.pos[j+1]-y)<(byte===null?.016:.012))ids.push(j);}
  if(ids.length<8)throw Error('Missing hind limb witness');return ids;
 }));
}
function read(vertices,ids){let x=0,y=0,z=0;for(const j of ids){x+=vertices[j];y+=vertices[j+1];z+=vertices[j+2];}return [x/ids.length,y/ids.length,z/ids.length];}
module.exports={patches,read};
if(require.main===module){global.window=global;const T=global.THREE=require('../js/three.min');T.TextureLoader.prototype.load=()=>new T.Texture();require('../js/mould');require('../js/hind-gait');require('../js/horse-rig');
 const f=CabinetFigurines(new T.Group())(4),m=f.mesh.children[0],p=m.geometry.attributes.position.array,groups=patches(CarrierMeshData()),w=AscotSulky.vw,c=new T.OrthographicCamera(-w/2,w/2,AscotSulky.vh/2,-AscotSulky.vh/2,.03,30);c.position.set(0,1,5.2);c.lookAt(0,.296,0);c.updateMatrixWorld();f.mesh.position.x=AscotSulky.pivot;
 const frames=Array.from({length:12},(_,i)=>{f.setPhase(i*tau/12);f.mesh.updateMatrixWorld(true);return groups.map(leg=>leg.map(ids=>{const v=new T.Vector3(...read(p,ids)).applyMatrix4(m.matrixWorld).project(c);return [(1+v.x)/2,(1-v.y)/2].map(x=>+x.toFixed(5));}));});console.log(JSON.stringify(frames));
}
