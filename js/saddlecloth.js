/* The dye is attached to the cloth, not a billboard following a screen
   coordinate. Measured at the old ink's UV centre on the articulated mould. */
(function(root){'use strict';const linen=['#f3ecd8','#252624','#a53930','#28578a','#d9aa40','#28583f'],ink=['#191c1c','#fff8e8','#fff8e8','#fff8e8','#201e18','#fff8e8'],stamps=[];
 function stamp(n,original=false){const key=n+(original?6:0);if(stamps[key])return stamps[key];const el=document.createElement('canvas');el.width=96;el.height=104;const g=el.getContext('2d');g.beginPath();g.moveTo(4,3);g.lineTo(94,6);g.lineTo(88,98);g.quadraticCurveTo(43,103,2,94);g.closePath();g.fillStyle=linen[n-1];g.fill();g.lineWidth=4;g.strokeStyle='#d2ba87';g.stroke();g.fillStyle=ink[n-1];g.textAlign='center';g.textBaseline='middle';g.font='900 '+(original?87:60.9)+'px Arial, sans-serif';g.fillText(n,47,54);stamps[key]=el;return el;}
 const gallop=[[-25,339],[-30,338],[-32,335],[-31,341],[-29,349],[-27,359],[-25,360],[-22,365],[-18,369],[-15,368],[-15,362],[-19,352]],walk=[[-25,360],[-28,361],[-23,360],[-20,362],[-25,360],[-28,362],[-23,362],[-20,363]],TAU=2*Math.PI;
 // The new hoof plant changes the height of the whole barrel relative to
 // the ground. Measured body-matrix deltas, in mm, for the same 20 shutters.
 const lift=[[30,39,41,28,16,-18,-14,-5,0,0,7,16],[9,9,0,0,7,6,7,4]];
 function mark(g,n,k,frame,w,h,effort=1,walking=false,original=false,stock=17){const a=k/28*TAU,c=Math.cos(a),s=Math.sin(a),side=Math.sign(c);if(Math.abs(c)<.26)return; // A nose/tail must occlude the opposite cloth.
   // V12's cast stays level in pitch. The cloth's surveyed mount centre is
   // (-.025,.382) before the common turf origin and twice-per-stride heave.
   const i=frame%(walking?8:12),p=(walking?walk:gallop)[i],trot=stock>=12&&!walking,
     x=stock>=15?-.051:trot?-.024-.001*effort:(-24+(p[0]+24)*effort)/1000,
     y=stock>=15&&!walking?.3315+effort*root.AscotHindGait.trunk(i/12):trot?.3595+effort*root.AscotHindGait.trunk(i/12):(359.5+(p[1]+(stock>=11?lift[+walking][i]:0)-359.5)*effort)/1000,z=(stock>=15?.104:.076)*side;
   const X=x*c+z*s,Z=z*c-x*s,Y=((y-.296)*.991-.134*Z);g.save();if(stock>=15){const M=root.AscotSulky;g.translate(w*X/M.vw,h*(-(y-(stock>=15&&walking?.028:0))*.991+.134*Z)/M.vh);}else g.translate(w*X/.905,h*(-.41-Y/.72));g.transform(1,.065*side,0,1,0,0);const f=stock>=15?root.AscotSulky.field:1,ww=w*.171*Math.abs(c)/f,hh=.182*h/f;g.drawImage(stamp(n,original),-ww/2,-hh/2,ww,hh);g.restore();}
 const api={mark,stamp};root.AscotCloth=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
