/* Pure race model. A book of quotes is deliberately NOT an input. The engine
   gives each runner a neutral race-day time; ratings and fuel turn that time
   into a sector-by-sector run. Only the resulting crossings rank the field. */
(function (root) {
  'use strict';
  const PER_LAP=16, COUNT=4*PER_LAP, LOW=60, HIGH=100;
  const FIELDS=Object.freeze([
    {key:'fitness',label:'Fitness',effect:'Fitness at the gate. On new cards live FIT loses 0.025 percentage points per racing second when saving, or 1 when sprinting. It supports actual speed, separately from stamina.'},
    {key:'startStamina',label:'Start stamina',effect:'Stamina at the gates. A bigger reserve helps the break and lasts into the run.'},
    {key:'sprintSpeed',label:'Sprint speed',effect:'Speed gained during this running style’s sprint windows; remaining stamina affects the lift.'},
    {key:'pace',label:'Pace',effect:'Cruising speed between sprint windows; usable pace drops as stamina is used.'}
  ]);
  // Permanent skills still share a budget. New condition readings are two
  // separate draws, not complements. Old printed entries retain their rule.
  const CONDITION_MIN=80,CONDITION_MAX=100,OLD_SKILL=160,SKILL_TOTAL=165,FORM_MODE='independent-form-80',INDEPENDENT_FORM=5,RUN_LAW=13;
  const specialists={'Waregem Flyer':100,'Susy Spitfire':60};
  const skills={'Front runner':84,'Strong finisher':97,'Pace setter':62,'Late closer':98,'All-rounder':80,'Steady pacer':72};
  const profiles={
    'Front runner':[78,70], 'Strong finisher':[88,83], 'Pace setter':[63,68],
    'Late closer':[88,78], 'All-rounder':[75,75], 'Steady pacer':[69,76]
  };
  // Also accept honest historical 300-point entries. Never "correct" an
  // archived start or a booked older heat to match a new breeding rule.
  function validRatings(r){if(!r||!FIELDS.every(({key})=>Number.isInteger(r[key])&&r[key]>=LOW&&r[key]<=HIGH))return false;
    const form=r.fitness+r.startStamina,skill=r.sprintSpeed+r.pace;
    return (skill===SKILL_TOTAL&&r.fitness>=CONDITION_MIN&&r.startStamina>=CONDITION_MIN)||(skill===OLD_SKILL&&(form===150||(r.fitness>=CONDITION_MIN&&r.startStamina>=CONDITION_MIN)))||(form+skill===300&&FIELDS.every(f=>r[f.key]<=90));}
  function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h;}
  function fixedSprint(name,style,law){const prior=specialists[name]??Math.max(LOW,Math.min(HIGH,(skills[style]??80)+hash('skill:'+name)%7-3));
    // Keep the horse’s position on the style scale, including both specialists.
    // The two skills are printed once per name: no condition or heat seed here.
    const floor=SKILL_TOTAL-HIGH;return law>=9?floor+Math.round((prior-LOW)*(HIGH-floor)/(HIGH-LOW)):prior;}
  function condition(key,previous){
    // Domain-separated FIT/STA seeds, including both endpoints. Skip only
    // this trait's own previous value, with no further market/outcome rolls.
    let h=hash(key);h=Math.imul(h^(h>>>16),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);h=(h^(h>>>16))>>>0;
    const skip=Number.isInteger(previous)&&previous>=CONDITION_MIN&&previous<=CONDITION_MAX;
    const n=CONDITION_MIN+Math.floor(h/4294967296*(CONDITION_MAX-CONDITION_MIN+1-(skip?1:0)));return skip&&n>=previous?n+1:n;
  }
  function raceRatings(name,style,heat,seed,previous,law=RUN_LAW){const key=name+':'+heat+':'+Math.floor(seed*1e7),sprintSpeed=fixedSprint(name,style,law);
    return {fitness:condition('FIT:'+key,previous?.fitness),startStamina:condition('STA:'+key,previous?.startStamina),sprintSpeed,pace:(law>=9?SKILL_TOTAL:OLD_SKILL)-sprintSpeed};}
  function ratings(name,style,law=RUN_LAW){if(law>=INDEPENDENT_FORM)return raceRatings(name,style,0,0,null,law);
    // Exact reconstruction only for older undrawn saves missing their ratings.
    const [kick,form]=profiles[style]||profiles['All-rounder'],legacy=law===true||law===2||law===3,sprintSpeed=legacy?kick+hash('skill:'+name)%5-2:fixedSprint(name,style,law),fitness=form+hash('condition:'+name)%5-2;
    return {fitness,startStamina:150-fitness,sprintSpeed,pace:(legacy?150:OLD_SKILL)-sprintSpeed};}
  // Each rhythm changes the demands on all six horses, never their prices.
  const patterns=[
    {name:'Fast break',    open:.42,load:1.01,fitness:.93,cruise:.95,kick:.94},
    {name:'Staying test',  open:.29,load:1.10,fitness:1.27,cruise:.96,kick:.94},
    {name:'Long gallop',   open:.23,load:1.00,fitness:.96,cruise:1.24,kick:.96},
    {name:'Sprint finish', open:.26,load:.91,fitness:.90,cruise:.92,kick:1.38}
  ];
  const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
  function smooth(a,b,x){const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
  const phases=patterns.map(p=>Array.from({length:COUNT},(_,i)=>{const x=(i+.5)/COUNT;return {x,open:1-smooth(.025,p.open,x),wear:smooth(.18,.85,x)};}));
  // Half-open *distance* intervals in a runner's own 64-sector race.
  // Ticket edits, cameras, frame rate and reloads never draw another window.
  function sprintWindows(style,phase=0,rhythm=0,law=RUN_LAW){
    let n=(Math.floor(phase*1e8)^Math.imul(rhythm+1,0x9e3779b1)^(style==='Steady pacer'?0x85ebca6b:0x27d4eb2d))>>>0;
    const pick=max=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return Math.floor(n/4294967296*max);};
    if(style==='Front runner')return [[0,8]];
    if(style==='Strong finisher')return law>=11?[[0,4],[48,64]]:[[law>=8?48:law===7?52:56,64]];
    if(style==='Late closer')return law>=9?[[40,48],[56,64]]:[[48,60]];
    if(style==='Pace setter'){const len=6+pick(4),start=pick(COUNT-len+1);return [[start,start+len]];}
    if(style==='Steady pacer'){let prev=-1;return Array.from({length:4},(_,lap)=>{const len=2+pick(2),base=lap*PER_LAP,rest=prev===base?1:0,a=base+rest+pick(PER_LAP-len-rest+1);prev=a+len;return [a,prev];});}
    return [[24,28],[40,44]]; // All-rounder: halfway into laps two and three.
  }
  // Race-day figures are immutable. Reserve changes the usable part of
  // *every* trait; it never rewrites the entry, the board or a saved finish.
  const FADE={fitness:.14,startStamina:.18,sprintSpeed:.23,pace:.16};
  function fatigue(energy,law=RUN_LAW){const loss=1-clamp(energy,0,100)/100;return loss*(.35+.65*loss)*(law>=13?.72:1);}
  function effectiveStats(s,energy,out={},law=RUN_LAW){const f=fatigue(energy,law);
    out.fitness=s.fitness*(1-FADE.fitness*f);out.startStamina=s.startStamina*(1-FADE.startStamina*f);
    out.sprintSpeed=s.sprintSpeed*(1-FADE.sprintSpeed*f);out.pace=s.pace*(1-FADE.pace*f);return out;
  }
  // Booked v2 fields ONLY. Keep the previous per-sector arithmetic and
  // rounding exactly; these curves are part of a saved betting contract.
  const BOOKED_SPRINT_FACTOR=2;
  function sprintCost(s,rhythm,i,drive){const p=patterns[rhythm],o=phases[rhythm][i].open,fit=(s.fitness-75)/15,spr=(s.sprintSpeed-75)/15,pace=(s.pace-75)/15,eff=Math.max(0,pace);
    const load=8+13*pace+14*eff*eff+36*(p.open-.26)*eff-6*Math.max(0,spr);
    return BOOKED_SPRINT_FACTOR*(42+12*o+load*(1-o)+(33+14*spr)*drive)*p.load*(1-.155*fit)/COUNT;
  }
  function cruiseCost(live,pattern,open){const fit=(live.fitness-75)/15,stamina=(live.startStamina-75)/15,pace=(live.pace-75)/15,effort=Math.max(0,pace);
    const work=34+8*open+(1-open)*(4+9*pace+27*effort*effort+18*(pattern.open-.26)*effort);
    return work*pattern.load*(1-.15*fit-.075*stamina)/COUNT;
  }
  function bookedPlan(stats,neutralSeconds,rhythm,phase,style){
    const p=patterns[rhythm],windows=sprintWindows(style,phase,rhythm,2),patient=Math.max(0,(stats.sprintSpeed-75)/15),live={},t=[0],fuel=[stats.startStamina];let energy=fuel[0],sec=0,which=0,owed=0;
    // Bank the actual cost of the remaining moves. Protecting it slows the
    // cruising horse, not the clock; a late move never gets a free refill.
    for(const [a,b] of windows)for(let k=a;k<b;k++)owed+=sprintCost(stats,rhythm,k,Math.min(1,(k-a+1)/2));
    for(let i=0;i<COUNT;i++){if(windows[which]&&i===windows[which][1])which++;const w=windows[which],active=!!w&&i>=w[0],drive=active?Math.min(1,(i-w[0]+1)/2):0;
      const {x,open,wear}=phases[rhythm][i],cruise=1-open;effectiveStats(stats,energy,live,2);
      const free=Math.max(0,energy-owed),bill=active?sprintCost(stats,rhythm,i,drive):cruiseCost(live,p,open);
      if(active)owed=Math.max(0,owed-bill);const spent=Math.min(active?energy:free,bill),mid=energy-spent*.5;effectiveStats(stats,mid,live,2);
      const fit=(live.fitness-75)/15,start=(live.startStamina-75)/15,sprint=(live.sprintSpeed-75)/15,pace=(live.pace-75)/15;
      const ready=clamp(mid/36,0,1),roll=.017*Math.sin(2*Math.PI*x+phase)+.010*Math.sin(4*Math.PI*x-phase*1.3);
      const gain=roll+open*(.054*start-.013)+.028*p.cruise*pace*(.14+.86*cruise)-patient*.016*(1-drive)
        +.019*p.fitness*fit*wear+drive*Math.max(.065,.115+.060*wear+.113*p.kick*sprint)*(.55+.45*ready)-.036*wear*(1-ready)-(active?0:.019*wear*(1-clamp(free/15,0,1)));
      sec+=neutralSeconds*(1-.78*gain)/COUNT;energy=Math.max(0,energy-spent);t.push(+sec.toFixed(6));fuel.push(+energy.toFixed(3));
    }
    return {t,fuel,drive:{windows},energyLaw:2};
  }
  function intervals(r){const d=r?.drive;return d?.windows||((d?.from!=null&&d.to!=null)?[[d.from,d.to]]:[]);}
  function driveAt(r,time){if(!r?.drive)return null;if(time>=r.t[COUNT])return 'finished';for(const [a,b] of intervals(r)){if(time<r.t[a])return 'saving';if(time<r.t[b])return 'active';}return r.drive.trigger!=null&&time<r.t[r.drive.trigger]?'saving':'spent';}
  // Convert neutral seconds to the same wall-clock pace for each common rhythm.
  // No individual profile is normalised to a prescribed finish time or place.
  const neutral={fitness:75,startStamina:75,sprintSpeed:75,pace:75};
  const tempoScale=patterns.map((_,i)=>1/bookedPlan(neutral,1,i,0).t[COUNT]);
  // Equal point totals should not create a universally faster build merely
  // because fatigue and sprinting interact nonlinearly. Calibrate each build
  // ONCE across all four reference rhythms, never against today's field or
  // draw. Its early/late strengths and its advantage on a matching day remain.
  const economy=new Map();
  function budgetScale(stats,style){
    if(!validRatings(stats))return 1;
    const key=style+':'+FIELDS.map(f=>stats[f.key]).join('/');if(economy.has(key))return economy.get(key);
    // Random bursts have no distinguished "phase zero". Average over a
    // fixed set of reference schedules instead of favouring a lucky example.
    const samples=['Pace setter','Steady pacer'].includes(style)?8:1;
    let mean=0;for(let j=0;j<samples;j++)for(let i=0;i<patterns.length;i++)mean+=bookedPlan(stats,1,i,j*2*Math.PI/samples,style).t[COUNT]*tempoScale[i];mean/=patterns.length*samples;
    const value=1/mean;if(economy.size>=2048)economy.delete(economy.keys().next().value);economy.set(key,value);return value;
  }
  function bookedRun(stats,neutralSeconds,rhythm,phase,style='Strong finisher'){return bookedPlan(stats,neutralSeconds*tempoScale[rhythm]*budgetScale(stats,style),rhythm,phase,style);}
  // Since v3, reserve is measured in percentage POINTS per racing second. The
  // release starts the clock; the individual finish stops it. Sprint windows
  // are still distance markers, but one sector is not a unit of time.
  // FIT is the slower conditioning clock; STA is the style-normalized effort reserve.
  const FIT_SAVING=.025,FIT_SPRINT=1,NEW_FIT_SPRINT=.65,ENERGY_LAW=7,OLD_CLOCK=3,SPRINT_DRAIN=3,SAVING_DRAIN=.025,SPRINT_SPEED_FACTOR=.75,REFERENCE_SECONDS=134; // 40 s nominal × the production stretch, 3.35
  // Read the debit contract from the issued heat/curve, never the newest default.
  const fitSprint=law=>law>=13?NEW_FIT_SPRINT:law>=12?FIT_SPRINT:2;
  const savingRate=law=>law>=6?SAVING_DRAIN:law===5?.10:.25;
  const clocked=r=>r.energyLaw===OLD_CLOCK||r.energyLaw===5||r.energyLaw===6||r.energyLaw===ENERGY_LAW;
  // Law 13 calibrates total sprint expenditure by style, then normalizes to
  // the actual number of sprint sectors this card drew (Pace setter and
  // Steady pacer vary by draw). Legacy laws retain their issued 3 pt/s debit.
  const STYLE_SPRINT_FACTOR=Object.freeze({'Front runner':1.65,'Strong finisher':.80,'Pace setter':1.65,'Late closer':.90,'All-rounder':1.65,'Steady pacer':1.25});
  const STYLE_SPRINT_SECTORS=Object.freeze({'Front runner':8,'Strong finisher':20,'Pace setter':7.5,'Late closer':16,'All-rounder':8,'Steady pacer':10});
  const styleSprintDrain=(style,law,planned=STYLE_SPRINT_SECTORS[style])=>SPRINT_DRAIN*(law>=13?(STYLE_SPRINT_FACTOR[style]||1)*STYLE_SPRINT_SECTORS[style]/Math.max(1,planned||STYLE_SPRINT_SECTORS[style]):1);
  function reserveReadiness(energy,law){const v=clamp(energy/36,0,1);return law>=13?1-(1-v)*(1-v):v;}
  const stamp=t=>Math.round(t*1e6)/1e6,points=e=>Math.round(Math.max(0,e)*1e8)/1e8;
  function clockPlan(s,rhythm,phase,style,law=3){
    const p=patterns[rhythm],windows=sprintWindows(style,phase,rhythm,law),planned=windows.reduce((n,[a,b])=>n+b-a,0),patient=Math.max(0,(s.sprintSpeed-75)/15),rows=[];
    for(let i=0;i<COUNT;i++){
      const {x,open,wear}=phases[rhythm][i],w=windows.find(([a,b])=>a<=i&&i<b),drive=w?Math.min(1,(i-w[0]+1)/2):0;
      const start=open*.054,pace=.028*p.cruise*(.14+.86*(1-open)),fit=.019*p.fitness*wear;
      // Pre-factor effectiveStats(s,energy) for fast, exact forecast trials.
      const base=.017*Math.sin(2*Math.PI*x+phase)+.010*Math.sin(4*Math.PI*x-phase*1.3)-open*.013-patient*.016*(1-drive)
        +(start*(s.startStamina-75)+pace*(s.pace-75)+fit*(s.fitness-75))/15;
      const fade=(start*s.startStamina*FADE.startStamina+pace*s.pace*FADE.pace+(law>=10?0:fit*s.fitness*FADE.fitness))/15;
      // A measured first call is not a fixed running order. A horse can
      // settle into its cruise a little early or late. The pre-drawn phase
      // tilts saving strides across the first two laps in opposite directions;
      // it never changes an active sprint or reads a rival's position.
      const breakTempo=law>=6&&x<.5?1+.10*Math.sin(phase)*Math.sin(4*Math.PI*x):1;
      rows.push({base,fade,drive,wear,breakTempo,fitSlope:fit/15,fitRate:w?fitSprint(law):FIT_SAVING,kick:.115+.060*wear+.113*p.kick*(s.sprintSpeed-75)/15,kickFade:.113*p.kick*s.sprintSpeed*FADE.sprintSpeed/15,rate:w?styleSprintDrain(style,law,planned):savingRate(law)});
    }
    if(law>=6){
      // A random move may use up some of either lap's saving strides. Spread
      // the counter-swing over the remaining saving strides in lap two so the
      // break cadence is not a free finishing-time bonus for a long move.
      let first=0,second=0;for(let i=0;i<32;i++)if(!rows[i].drive){if(i<16)first+=rows[i].breakTempo-1;else second+=1-rows[i].breakTempo;}
      if(Math.abs(first)>1e-9&&Math.abs(second)>1e-9)for(let i=0;i<32;i++)rows[i].breakTempo=1+(rows[i].breakTempo-1)*Math.min(1,i<16?second/first:first/second);
    }
    // Same stepper for a complete exposure and a finish-time-only inquiry.
    // Speed reads the reserve on entry; charge the elapsed duration at the
    // active rate, even on the half-strength push-off or between two moves.
    // A longer random move is a different distribution of the same race-day
    // effort, not extra free form. Set the cruise schedule before the draw;
    // never inspect this runner’s position, a rival, a ticket or a finish.
    const usual=style==='Pace setter'?7.5:style==='Steady pacer'?10:planned;
    const distanceBudget=law>=4?(COUNT-.5*usual)/(COUNT-.5*planned):1;
    // Retain the booked sprint reference, but budget the saving sectors for
    // today's 1.5× move instead of the former 2× move on variable schedules.
    const freeShare=1-1/(2*SPRINT_SPEED_FACTOR),coastBudget=law>=6?(COUNT-freeShare*usual)/(COUNT-freeShare*planned)/distanceBudget:1;
    return function simulate(seconds,record=false,savingClock=1){const step=seconds*distanceBudget/COUNT,t=record?[0]:null,fuel=record?[s.startStamina]:null,fitness=record&&law>=10?[s.fitness]:null;let sec=0,e=s.startStamina,fitNow=s.fitness;
      for(const row of rows){const fade=fatigue(e,law),ready=reserveReadiness(e,law);
        const cruise=row.base-row.fade*fade-.036*row.wear*(1-ready)+(law>=10?row.fitSlope*(fitNow-s.fitness):0);let fraction;
        if(law>=4){
          // A rate of travel, NOT a multiplier on the old bonus. Same sector,
          // same horse, same reserve: v5 gives 2× at SPR 80; v6 gives 1.5×.
          const usable=s.sprintSpeed*(1-FADE.sprintSpeed*fade);
          const sprintRate=(2+.008*(usable-80))*(law>=6?SPRINT_SPEED_FACTOR:1);
          fraction=(1-.78*cruise)/(row.drive?sprintRate:1);if(law>=6&&!row.drive)fraction*=savingClock*coastBudget*row.breakTempo;
        }else{const gain=row.base-row.fade*fade+row.drive*Math.max(.065,row.kick-row.kickFade*fade)*(.55+.45*ready)-.036*row.wear*(1-ready);fraction=1-.78*gain;}
        const next=stamp(sec+step*fraction);e=Math.max(0,e-row.rate*(next-sec));if(law>=10){fitNow=Math.max(0,fitNow-row.fitRate*(next-sec));if(fitness)fitness.push(points(fitNow));}sec=next;if(record){t.push(sec);fuel.push(points(e));}
      }
      return record?{t,fuel,...(fitness?{fitness}:{}),drive:law>=13?{windows,style,sprintRate:styleSprintDrain(style,law,planned)}:{windows},energyLaw:law>=13?ENERGY_LAW:law>=6?6:law===5?5:OLD_CLOCK,...(law>=4?{runLaw:law}:{})}:sec;
    };
  }
  // Correct fixed build/style bias at a real race duration, not at a one-
  // second reference (which would spend virtually no reserve under this law).
  // Keep the preceding clock law for every card already posted on a station.
  const midForm={fitness:90,startStamina:90,sprintSpeed:80,pace:80};
  const tempoByLaw=new Map([3,4,5].map(law=>[law,patterns.map((_,i)=>REFERENCE_SECONDS/clockPlan(law>=INDEPENDENT_FORM?midForm:neutral,i,0,'All-rounder',law)(REFERENCE_SECONDS))])),scales=new Map();
  function clockScale(s,style,law){if(!validRatings(s))return 1;
    // Balance fixed builds at an ordinary 90/90 gate. Do not normalise
    // away a genuinely good (or poor) day's independent FIT and STA.
    if(law>=INDEPENDENT_FORM)s={...s,fitness:90,startStamina:90};const key=law+':'+style+':'+FIELDS.map(f=>s[f.key]).join('/');if(scales.has(key))return scales.get(key);
    // Average the new skill reference over phases even for fixed sprint windows:
    // cadence also has a phase, and can otherwise privilege one style.
    const samples=law>=INDEPENDENT_FORM?16:['Pace setter','Steady pacer'].includes(style)?8:1,refs=[],tempo=tempoByLaw.get(law);for(let j=0;j<samples;j++)for(let i=0;i<patterns.length;i++)refs.push([clockPlan(s,i,j*2*Math.PI/samples,style,law),REFERENCE_SECONDS*tempo[i]]);
    let k=1;for(let pass=0;pass<3;pass++){let sum=0;for(const [sim,seconds] of refs)sum+=sim(seconds*k);k*=REFERENCE_SECONDS*refs.length/sum;}
    if(scales.size>=2048)scales.delete(scales.keys().next().value);scales.set(key,k);return k;
  }
  // An 8-sector neutral move took 4 of 60 equal-time units. It now takes
  // 4/.75: allow the meet to last longer. Level the named *builds* on that
  // reference by trimming ONLY cruise, not by speeding the sprints back up.
  const FIELD_REFERENCE=REFERENCE_SECONDS*(56+4/SPRINT_SPEED_FACTOR)/60,cruiseTrims=new Map();
  // Law 12 gets a separate steady-stride trim per meeting rhythm. Calibrate
  // at a neutral gate, NOT against opponents or the current random draw.
  // Keep 45% of the natural rhythm advantage rather than letting tempo
  // alone decide a six-horse race. Active sprint speeds and windows are
  // untouched. A secant solve changes saving time, never finishing order.
  function matchedTrims(gate,style,base,law){
    const rows=patterns.map((_,r)=>Array.from({length:16},(_,j)=>clockPlan(gate,r,j*2*Math.PI/16,style,law))),
      mean=(r,k)=>rows[r].reduce((n,sim)=>n+sim(REFERENCE_SECONDS*tempoByLaw.get(5)[r]*base,false,k),0)/16,
      raw=patterns.map((_,r)=>mean(r,1)),middle=raw.reduce((a,b)=>a+b)/raw.length;
    return raw.map((seconds,r)=>{const target=FIELD_REFERENCE+.45*(seconds-middle);let x=1,fx=seconds-target,y=1.02;
      for(let i=0;i<6;i++){const fy=mean(r,y)-target;if(Math.abs(fy)<.000025||Math.abs(fy-fx)<1e-9)break;const next=y-fy*(y-x)/(fy-fx);x=y;fx=fy;y=clamp(next,.72,1.34);}return y;});
  }
  function cruiseTrim(s,style,law,rhythm){if(!validRatings(s))return 1;const key=law+':'+style+':'+s.sprintSpeed+'/'+s.pace;
    if(cruiseTrims.has(key)){const hit=cruiseTrims.get(key);return law>=12?hit[rhythm]:hit;}
    const gate={...s,fitness:90,startStamina:90},base=clockScale(gate,style,5),refs=[];
    if(law>=12){const trims=matchedTrims(gate,style,base,law);if(cruiseTrims.size>=2048)cruiseTrims.clear();cruiseTrims.set(key,trims);return trims[rhythm];}
    for(let j=0;j<16;j++)for(let i=0;i<patterns.length;i++)refs.push([clockPlan(gate,i,j*2*Math.PI/16,style,law),REFERENCE_SECONDS*tempoByLaw.get(5)[i]*base]);
    let trim=1;const passes=law>=11&&style==='Strong finisher'?14:5;for(let pass=0;pass<passes;pass++){let sum=0;for(const [sim,seconds] of refs)sum+=sim(seconds,false,trim);trim*=FIELD_REFERENCE*refs.length/sum;}
    if(cruiseTrims.size>=2048)cruiseTrims.clear();cruiseTrims.set(key,trim);return trim;
  }
  function prepareRun(s,rhythm,phase,style='Strong finisher',law=RUN_LAW){
    // Do not normalise the 25% reduction back out. v6 uses the old clock
    // reference for sprint speed; the reference cruise correction is separate.
    const ref=law>=6?5:law,sim=clockPlan(s,rhythm,phase,style,law),scale=tempoByLaw.get(ref)[rhythm]*clockScale(s,style,ref),trim=law>=6?cruiseTrim(s,style,law,rhythm):1;return (seconds,record=false)=>sim(seconds*scale,record,trim);
  }
  function run(s,seconds,rhythm,phase,style='Strong finisher',law=RUN_LAW){return law===2?bookedRun(s,seconds,rhythm,phase,style):prepareRun(s,rhythm,phase,style,law)(seconds,true);}
  function sprintingAt(r,i){return intervals(r).some(([a,b])=>i>=a&&i<b);}
  function sectorRate(r,i){if(!sprintingAt(r,i))return savingRate(r.energyLaw);const windows=intervals(r),planned=windows.reduce((n,[a,b])=>n+b-a,0);return Number.isFinite(r.drive?.sprintRate)?r.drive.sprintRate:styleSprintDrain(r.drive?.style,r.runLaw??3,planned);}
  function rescaleClock(r,k){r.t=r.t.map(t=>t*k);if(!clocked(r))return;let e=r.fuel[0],f=r.fitness?.[0];for(let i=0;i<COUNT;i++){const dt=r.t[i+1]-r.t[i],active=sprintingAt(r,i),rate=sectorRate(r,i);e=Math.max(0,e-rate*dt);r.fuel[i+1]=points(e);if(r.fitness){f=Math.max(0,f-dt*(active?fitSprint(r.runLaw):FIT_SAVING));r.fitness[i+1]=points(f);}}}
  function validRun(r){return !!r&&(r.runLaw<10||r.runLaw==null||(Array.isArray(r.fitness)&&r.fitness.length===COUNT+1&&r.fitness.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=100&&(!i||v<=r.fitness[i-1]))))&&Array.isArray(r.t)&&r.t.length===COUNT+1&&r.t[0]===0&&r.t.every((v,i)=>Number.isFinite(v)&&(!i||v>r.t[i-1]))&&Array.isArray(r.fuel)&&r.fuel.length===COUNT+1&&r.fuel.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=100&&(!i||v<=r.fuel[i-1]));}
  function sectorAt(r,t){const a=r.t;if(t<=0)return 0;if(t>=a[COUNT])return COUNT;let lo=0,hi=COUNT;while(hi-lo>1){const m=(lo+hi)>>1;if(t<a[m])hi=m;else lo=m;}return lo+(t-a[lo])/(a[hi]-a[lo]);}
  function reserveAt(r,t){const x=sectorAt(r,t),i=Math.floor(x);if(i>=COUNT||t<=0)return r.fuel[i];
    // The last bit of reserve may run out part-way across a sector. Never
    // stretch that final debit to the next marker, or recharge after zero.
    if(clocked(r))return Math.max(0,r.fuel[i]-sectorRate(r,i)*(t-r.t[i]));
    return r.fuel[i]+(x-i)*(r.fuel[i+1]-r.fuel[i]);}
  function fitnessAt(r,t){if(!r?.fitness)return null;const i=Math.floor(sectorAt(r,t));if(i>=COUNT||t<=0)return r.fitness[i];const rate=sprintingAt(r,i)?fitSprint(r.runLaw):FIT_SAVING;return Math.max(0,r.fitness[i]-rate*(t-r.t[i]));}
  // A current FIT reading on law 10 is its own clock, not a second debit
  // to the stamina-adjusted gate fitness. Old live files keep their old law.
  function liveStats(s,r,t){const v=effectiveStats(s,reserveAt(r,t),{},r?.runLaw??(r?.energyLaw===OLD_CLOCK?3:RUN_LAW)),fit=fitnessAt(r,t);if(fit!==null)v.fitness=fit;return v;}
  const api=Object.freeze({FIELDS,FIT_SAVING,FIT_SPRINT,fitnessAt,liveStats,CONDITION_MIN,CONDITION_MAX,SKILL_TOTAL,RUN_LAW,FORM_MODE,LOW,HIGH,PER_LAP,COUNT,rhythms:Object.freeze(patterns.map(p=>p.name)),ratings,raceRatings,validRatings,effectiveStats,fatigue,ENERGY_LAW,SPRINT_DRAIN,SAVING_DRAIN,SPRINT_SPEED_FACTOR,NEW_FIT_SPRINT,STYLE_SPRINT_FACTOR,styleSprintDrain,reserveReadiness,prepareRun,rescaleClock,sprintWindows,intervals,run,validRun,sectorAt,reserveAt,driveAt});
  root.AscotPerformance=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
