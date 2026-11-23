/* One clock for the cashier, loading movement, fanfare and gate latch.
   Coordinates here are signed lap fractions: zero is the stall datum. */
(function(root){'use strict';
 const C=root.AscotCourse||(typeof module!=='undefined'?require('./course'):null);
 const LOCK=10,HOLD=5,OPEN=60,clip=x=>Math.min(1,Math.max(0,x)),smooth=x=>{const u=clip(x);return u*u*(3-2*u);};
 // All six assemble on the home straight behind their OWN stall. Even a
 // manual start at the beginning of betting never teleports a runner or
 // asks it to cover an entire lap in five seconds. No race RNG is touched.
 function paddock(h,clock,stock=17){const stagger=.15*(h.num-1)+.09*Math.sin(h.seed+h.num*.61);return -(2.51-stagger-1.07*clip(clock/OPEN))/(stock>=17?C.length:stock===16?C.sixteen.length:C.broad.length);}
 // In-progress checkpoints made by the previous release retain their booked
 // latch time, including the old three-second hold; never replay their call.
 const load=s=>Math.max(0,s.gate-(s.gateHold??3));
 function approach(s,h){const d=load(s);if(!d||s.clock>=d)return 0;const left=(1-h.gateFrom)%1;return -left*(1-smooth(s.clock/d));}
 const boxed=s=>s.phase==='gates'&&s.clock>=load(s)||s.phase==='race'&&s.clock===0;
 const api={LOCK,HOLD,OPEN,paddock,load,approach,boxed,smooth};root.AscotMarshal=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
