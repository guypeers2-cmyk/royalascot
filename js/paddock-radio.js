/* Betting preview. Only the printed entry is an input: no draw, wallet,
   future crossing, order or odds simulation is needed to read the card. */
(function(root){'use strict';
 const book=root.RadioBook||(typeof module!=='undefined'?require('./radio-book'):null),styles=['Front runner','Strong finisher','Pace setter','Late closer','All-rounder','Steady pacer'],skills=['fitness','startStamina','sprintSpeed','pace'];
 const takes=
  [["A front runner. Expect the early dash on the opening lap.", 0.0, 3.2949],
  ["A strong finisher. The bell is the cue to sprint the whole last lap.", 3.3749, 4.1116],
  ["A pace setter. Watch for one well-timed burst.", 7.5666, 3.1639],
  ["A late closer. Look for the kick as the final lap begins.", 10.8104, 3.7224],
  ["An all-rounder. Two bursts to watch, halfway through laps two and three.", 14.6129, 3.9739],
  ["A steady pacer. One little flourish on every circuit.", 18.6668, 2.9377],
  ["A strong finisher. There's a late run pencilled in on this card.", 21.6845, 2.9568],
  ["An older entry. No running style on file.", 24.7213, 3.5762],
  ["Fitness is a standout on this card.", 28.3776, 2.1531],
  ["Plenty in the tank at the start.", 30.6106, 1.7486],
  ["The sprint rating catches my eye.", 32.4393, 1.8325],
  ["Cruising pace is a strong suit.", 34.3518, 1.9578],
  ["That's the form as they go to post.", 36.3895, 1.8624],
  ["The prices are set. The race is another matter.", 38.3319, 2.8323],
  ["A late closer. Two kicks, halfway through laps three and four.", 41.2443, 3.8456]];
 const OPENING=.4, SLOT=8.65, WRAP=OPENING+6*SLOT;
 function entry(s,h,roster){const v=roster.indexOf(h.name),name=book.lines.length+(v<0?roster.length+h.num-1:v);let style=styles.indexOf(h.style);if(style<0)style=7;else if(style===1&&(s.runLaw??2)<8)style=6;else if(style===3&&s.runLaw>=9)style=14;
   const keys=skills.map((k,i)=>({i,n:h.stats?.[k]})).filter(x=>Number.isFinite(x.n)).sort((a,b)=>b.n-a.n||a.i-b.i),note=keys.length?8+keys[0].i:null,words=[takes[style][0],...(note!==null?[takes[note][0]]:[])];
   const take=i=>[takes[i][1],takes[i][2],2];return {n:h.num,name:h.name,style:h.style,best:keys.length?{label:['Fitness','Start stamina','Sprint speed','Pace'][keys[0].i],value:keys[0].n}:null,description:style===1&&s.runLaw>=11?"Strong finisher: sprints through the opening quarter-lap and the whole of lap 4. "+(note!==null?takes[note][0]:''):words.join(' '),line:h.name+'. '+words.join(' '),clips:[book.clips[name],take(style),...(note!==null?[take(note)]:[])]};}
 function card(state,roster){return state.runners.map(h=>entry(state,h,roster));}
 function cue(s,roster){if(s.phase!=='betting')return null;const idx=Math.max(0,Math.min(6,Math.floor((s.clock-OPENING)/SLOT))),at=OPENING+idx*SLOT;
   const row=idx===6?{n:0,name:'The field',line:takes[12][0]+' '+takes[13][0],clips:takes.slice(12,14).map(([,a,b])=>[a,b,2])}:entry(s,s.runners[idx],roster);
   return {...row,at,end:idx===6?s.openSeconds:at+SLOT,key:'preview:'+s.raceNo+':'+idx};}
 const api={file:'paddock-radio.ogg',takes,card,cue,OPENING,SLOT,WRAP};root.PaddockRadio=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
