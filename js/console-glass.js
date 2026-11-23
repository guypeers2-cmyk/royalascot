/* The cabinet has a fixed piece of glass. Lay out an overview when there is
   space; otherwise page the SAME controls inside it. No scaled type, phantom
   tickets, duplicate wallets or off-glass submit keys. Zoom may reflow text. */
(function(root){'use strict';
// Rows retain natural height (including wrapped names). Page by measured rows,
// not a device-specific item count. The same utility runs the finish receipt.
root.AscotPager=function(list,nav,kind,rows=()=>[...list.children]){let index=0;
 nav.innerHTML=`<button type="button" data-prev aria-label="Previous ${kind} page">‹</button><span aria-live="polite"></span><button type="button" data-next aria-label="Next ${kind} page">›</button>`;
 function fit(){if(!list.clientWidth)return;const children=rows();nav.hidden=true;children.forEach(c=>c.hidden=false);if(!children.length||list.scrollHeight<=list.clientHeight+1){index=0;return;}
   nav.hidden=false;list.scrollTop=0;const groups=[];for(const el of children){const r=el.getBoundingClientRect(),prev=groups.at(-1);if(prev&&Math.abs(prev.y-r.top)<1)prev.items.push(el);else groups.push({y:r.top,items:[el]});}
   const top=list.getBoundingClientRect().top,first=children[0].getBoundingClientRect(),last=children.at(-1).getBoundingClientRect(),edge=Math.max(0,first.top-top)+Math.max(0,list.scrollHeight-(last.bottom-top)),available=list.clientHeight-edge;
   const gap=groups.length>1?Math.max(0,groups[1].y-groups[0].y-Math.max(...groups[0].items.map(e=>e.getBoundingClientRect().height))):0,sets=[];let used=0;
   for(const g of groups){const h=Math.max(...g.items.map(e=>e.getBoundingClientRect().height));if(!sets.length||used+h>available+1){sets.push([]);used=0;}sets.at(-1).push(...g.items);used+=h+gap;}
   index=Math.max(0,Math.min(sets.length-1,index));children.forEach(el=>el.hidden=!sets[index].includes(el));list.scrollTop=0;
   nav.querySelector('span').textContent=`${index+1}/${sets.length}`;nav.querySelector('[data-prev]').disabled=index===0;nav.querySelector('[data-next]').disabled=index===sets.length-1;
 }
 nav.onclick=e=>{const b=e.target.closest('button');if(!b)return;index+=b.hasAttribute('data-prev')?-1:1;fit();if(b.disabled)nav.querySelector('button:not(:disabled)')?.focus({preventScroll:true});};
 return {fit,goto(n){index=Math.max(0,n||0);fit();},get index(){return index;},reset(){index=0;}};
};
})(globalThis);
