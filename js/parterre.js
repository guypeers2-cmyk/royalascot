/* Survey of the centre garden in table metres. Four ribbon beds frame the
   indicator without entering a lane. The little flowers are shared by the
   printed side view, the diagram and the batched cabinet geometry. */
(function(root){'use strict';let seed=27091;const rand=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296),beds=[];
 const tones=[['#eee2bd','#fff5d9'],['#b84852','#e98183'],['#dda647','#ffe3a1'],['#886b9a','#d8b3cb']];
 for(const face of [-1,1])for(const side of [-1,1]){const path=(t,f)=>{const bow=Math.sin(t*Math.PI),w=.006+.028*bow;return [side*(.045+1.39*t),face*(.034+.025*bow+w*f)];},rim=[],buds=[];
   for(const s of [1,-1])for(let i=0;i<=28;i++)rim.push(path(s===1?i/28:1-i/28,s));
   for(let i=0;i<49;i++){const t=(i+.25+rand()*.5)/49,colors=tones[(Math.floor(t*6)+(face<0?2:0))%4];for(let j=0;j<2;j++){const [x,z]=path(t,((j-.5)*1.04+(rand()-.5)*.66));buds.push({x,z,y:.011+rand()*.016+(Math.abs(x)>.66?.018:0),r:.006+rand()*.005,col:colors[j],turn:rand()*Math.PI});}}
   beds.push({rim,buds,face,side});}
 const api={beds};root.AscotParterre=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
