/* Broad (roughness >= .21) GGX lobes of this exact salon. Each mip is an
   independently convolved PMREM level, not a box-filtered room photograph.
   A native cube fetch replaces face selection, two atlas projections and
   software mip blending per light sample. Glossy chrome keeps the full probe.
   The least detailed native face is 16px, the original PMREM tile size. */
(function(root){'use strict';root.CabinetRoomLight=function(T,r,scene,url,invalidate){if(!r.capabilities.isWebGL2)return;const materials=new Set();scene.traverse(o=>{if(o.material?.isMeshStandardMaterial)materials.add(o.material);});const im=new Image();im.onerror=()=>{};im.onload=()=>{if(im.width!==768||im.height!==480)return;
 function cube(y){const levels=[];for(const size of [128,64,32,16]){const faces=[];for(let i=0;i<6;i++){const c=document.createElement('canvas');c.width=c.height=size;c.getContext('2d').drawImage(im,i*size,y,size,size,0,0,size,size);faces.push(c);}levels.push(faces);y+=size;}const t=new T.CubeTexture(levels[0]);t.mipmaps=levels.slice(1).map(image=>({image}));t.colorSpace=T.SRGBColorSpace;t.minFilter=T.LinearMipmapLinearFilter;t.magFilter=T.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;}
 const mid=cube(0),soft=cube(240);for(const m of materials){const prior=m.onBeforeCompile,key=m.customProgramCacheKey();m.customProgramCacheKey=()=>key+'|salon-native-1';m.onBeforeCompile=function(sh,r){prior.call(this,sh,r);sh.uniforms.stationMid={value:mid};sh.uniforms.stationSoft={value:soft};const ibl=T.ShaderChunk.envmap_physical_pars_fragment.replace('textureCubeUV( envMap, worldNormal, 1.0 )','textureLod( stationSoft, worldNormal, 3.0 )').replace('textureCubeUV( envMap, reflectVec, roughness )','stationGloss( reflectVec, roughness )');sh.fragmentShader=sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>',`
#ifdef ENVMAP_TYPE_CUBE_UV
uniform samplerCube stationMid, stationSoft;
vec4 stationGloss(vec3 d, float rough){if(rough<0.21)return textureCubeUV(envMap,d,rough);float m=roughnessToMip(rough);if(m>1.0)return textureLod(stationMid,d,4.0-m);return textureLod(stationSoft,d,1.0-m);}
#endif
`+ibl);};m.needsUpdate=true;}invalidate();};im.src=url;};})(globalThis);
