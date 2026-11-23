/* Canvas, projected-seat and finish lenses share these sampled cast mattes.
   Work in CSS/film coordinates, never backing-store or device pixels. */
(function(root){'use strict';
 function clip(poly,axis,bound,sign){if(!poly.length)return poly;const out=[];let a=poly.at(-1);for(const b of poly){const u=(a[axis]-bound)*sign,v=(b[axis]-bound)*sign;if((u>=0)!==(v>=0)){const t=u/(u-v);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}if(v>=0)out.push(b);a=b;}return out;}
 function strip(mask,j,l,r){if(mask==null||mask<0)return false;const o=(mask*24+j)*4,bytes=root.AscotMattes;for(let i=Math.max(0,Math.floor(32*l)),end=Math.min(32,Math.ceil(32*r));i<end;i++)if(bytes[o+(i>>3)]&(1<<(i&7)))return true;return false;}
 function rect(h,l,t,r,b){if(l>=1||t>=1||r<=0||b<=0||l>=r||t>=b)return false;for(let j=Math.max(0,Math.floor(24*t)),end=Math.min(24,Math.ceil(24*b));j<end;j++)if(strip(h.m,j,l,r)||strip(h.m2,j,l,r))return true;return false;}
 function covers(h,q,scale,tx,ty,seat){if(h.m2!=null&&h.l2!=null&&(h.l2!==h.l||h.t2!==h.t))return covers({...h,m2:null},q,scale,tx,ty,seat)||covers({...h,m:h.m2,m2:null,l:h.l2,t:h.t2},q,scale,tx,ty,seat);const {l,t,w,H}=h;if(!seat)return rect(h,((q.l-tx)/scale-l)/w,((q.t-ty)/scale-t)/H,((q.r-tx)/scale-l)/w,((q.b-ty)/scale-t)/H);
   let p=[[l,t],[l+w,t],[l+w,t+H],[l,t+H]].map(([x,y])=>seat.project(x,y)).filter(Boolean);if(p.length<3)return false;
   p=clip(clip(clip(clip(p,'x',q.l,1),'x',q.r,-1),'y',q.t,1),'y',q.b,-1);if(p.length<3)return false;
   p=p.map(v=>seat.hit(v.x,v.y)).filter(Boolean).map(v=>({x:(v.x-l)/w,y:(v.y-t)/H}));if(p.length<3)return false;
   for(let j=Math.max(0,Math.floor(Math.min(...p.map(v=>v.y))*24)),end=Math.min(24,Math.ceil(Math.max(...p.map(v=>v.y))*24));j<end;j++){
     const band=clip(clip(p,'y',j/24,1),'y',(j+1)/24,-1);if(band.length<3)continue;const x=band.map(v=>v.x),a=Math.min(...x),b=Math.max(...x);if(b>a&&(strip(h.m,j,a,b)||strip(h.m2,j,a,b)))return true;}return false;}
 const api={rect,covers};root.AscotGlass=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
