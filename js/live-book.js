/* A joint top-two forecast. Win is its row sum, exact-second Show its
   column sum, Quinella the two opposite cells. Nothing here receives the
   actual drawn curves, finish times, tickets, balance or game RNG. */
(function(root){'use strict';
 const P=root.AscotPerformance||(typeof require==='function'?require('./race-performance'):null);
 const D=root.RaceDay||(typeof require==='function'?require('./race-day'):null);
 const N=D.TRIALS,H=6,S=32,joint=()=>new Float64Array(H*H);
 function exact(places){const a=joint();a[(places[0]-1)*H+places[1]-1]=1;return a;}
 // A pre-ratings saved race has no performance law to replay. Use its issued
 // field weights and the visible relative positions, without inventing skills.
 function unrated(field){const prior=field.map(h=>Math.max(.001,h.p||1/H));return {estimate(t,ds,places=[]){
   if(places.length>1)return exact(places);const a=joint(),best=ds?Math.max(...ds):0;
   const w=prior.map((p,i)=>p*(ds?Math.exp(Math.max(-45,(ds[i]-best)*(3+12*best/4))):1)),sum=w.reduce((a,b)=>a+b);
   for(let i=0;i<H;i++)for(let j=0;j<H;j++)if(i!==j){const win=places.length?+(i===places[0]-1):w[i]/sum;a[i*H+j]=win*w[j]/w.reduce((n,v,k)=>n+(k===i?0:v),0);}return a;
 }};}
 function create(field,law=P.RUN_LAW,stretch=3.35){
   if(field.length!==H)return null;if(!field.every(h=>P.validRatings(h.stats)))return unrated(field);
   let seed=D.forecastSeed(field);const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
   const plans=field.map(h=>P.rhythms.map((_,k)=>law===2?t=>P.run(h.stats,t,k,h.seed,h.style,2):P.prepareRun(h.stats,k,h.seed,h.style,law)));
   const curves=new Float32Array(N*H*(S+1)),first=new Uint8Array(N),second=new Uint8Array(N),rhythms=new Uint8Array(N);
   const twelve=new Float64Array(12),gate=joint();
   for(let i=0;i<N;i++){
     for(let r=0;r<12;r++)twelve[r]=rand();const {times,rhythm}=D.form(field,twelve,stretch);
     const runs=field.map((_,j)=>plans[j][rhythm](times[j],true).t),order=[0,1,2,3,4,5].sort((a,b)=>runs[a][64]-runs[b][64]||a-b);
     const win=runs[order[0]][64],scale=Math.max(37*stretch,Math.min(42*stretch,win))/win;
     rhythms[i]=rhythm;first[i]=order[0];second[i]=order[1];gate[first[i]*H+second[i]]+=1/N;
     for(let j=0;j<H;j++){const off=(i*H+j)*(S+1);for(let k=0;k<=S;k++)curves[off+k]=runs[j][2*k]*scale;}
   }
   const err=new Float64Array(N),delta=new Float64Array(H);
   function estimate(t,ds,places=[],rhythm=-1){
     if(places.length>=2)return exact(places);if(!t||!ds)return gate;
     const answer=joint(),locked=(places[0]||0)-1,sigma=.021+.020*Math.max(0,1-t/130);
     let least=Infinity,compatible=Infinity;
     // A soft match on *observed relative gaps*. Remove the field's common
     // offset so an unusually quick track isn't simply evidence for #1.
     for(let i=0;i<N;i++){
       if(rhythm>=0&&rhythms[i]!==rhythm){err[i]=Infinity;continue;}let sum=0;
       for(let j=0;j<H;j++){
         const off=(i*H+j)*(S+1);let lo=0,hi=S;while(hi-lo>1){const k=(hi+lo)>>1;if(curves[off+k]<=t)lo=k;else hi=k;}
         const f=Math.max(0,Math.min(1,(t-curves[off+lo])/(curves[off+hi]-curves[off+lo])));sum+=(delta[j]=(lo+f)*4/S-ds[j]);
       }
       sum/=H;let loss=0;for(let j=0;j<H;j++)loss+=((delta[j]-sum)/sigma)**2;
       err[i]=loss/2;least=Math.min(least,err[i]);if(first[i]===locked)compatible=Math.min(compatible,err[i]);
     }
     // At the first crossing, restrict to draws with that confirmed winner.
     // In the rare unsampled upset, condition the remaining field instead.
     const condition=Number.isFinite(compatible);if(condition)least=compatible;let total=0;
     for(let i=0;i<N;i++){
       if(!Number.isFinite(err[i])||(condition&&first[i]!==locked))continue;
       const weight=Math.exp(Math.max(-65,least-err[i]));let a=first[i],b=second[i];
       if(locked>=0){b=a===locked?b:a;a=locked;}answer[a*H+b]+=weight;total+=weight;
     }
     for(let k=0;k<answer.length;k++)answer[k]/=total;return answer;
   }
   return {estimate};
 }
 function chance(matrix,ticket,places=[]){
   const [n,m]=ticket.nums,a=n-1,b=m-1,[A,B]=places,pair=ticket.market==='quinella',win=ticket.market==='win';let known=null;
   if(win&&A)known=A===n;
   else if(!win&&B)known=pair?ticket.nums.includes(A)&&ticket.nums.includes(B):B===n;
   else if(A&&(pair?!ticket.nums.includes(A):!win&&A===n))known=false;
   if(known!==null)return {p:+known,known};if(!matrix)return {p:null,known};
   let p=0;if(pair)p=matrix[a*H+b]+matrix[b*H+a];else for(let k=0;k<H;k++)p+=win?matrix[a*H+k]:matrix[k*H+a];
   return {p:Math.max(0,Math.min(1,p)),known};
 }
 function label({p,known}){return known!==null?(known?'100%':'0%'):p===null?'—':p<=.0005?'<0.1%':p>=.9995?'>99.9%':(100*p).toFixed(1)+'%';}
 const api={create,chance,label};root.LiveBook=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
