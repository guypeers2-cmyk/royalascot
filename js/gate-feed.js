/* A true lens on the centreline of the home straight: every hinge on the
   front crossbar has the same depth and elevation. +X is towards the lens. */
(function(root){'use strict';const C=root.AscotCourse||(typeof module!=='undefined'?require('./course'):null),cam=Object.freeze({x:1.0,y:.263,aim:.105,fov:35.8,w:1280,h:720}),a=Math.atan2(cam.y-cam.aim,cam.x),c=Math.cos(a),s=Math.sin(a),f=cam.h/2/Math.tan(cam.fov*Math.PI/360);
 function project([x,y,z]){const dx=cam.x-x,dy=y-cam.y,d=dx*c-dy*s;return {x:cam.w/2-f*z/d,y:cam.h/2+f*(-dx*s-dy*c)/d,d};}
 function path(t,lane){const [x,z]=C.run(t,lane);return[x-C.startX,0,z-C.R];}
 const api={cam,project,path,f};root.AscotGateFeed=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
