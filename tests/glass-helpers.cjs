/* Operate the real one-sheet cashier. My bets is a separate, paused book;
   selecting a runner never leaves Field. No JS-injected picks or tickets. */
module.exports=function glass(L){const click=q=>L(q).click();
 async function page(name='field'){
   if(name==='ticket'){if(!await L('#dialog[open] .ticket-book').isVisible())await click('#jumpTickets');await L('#dialog[open] .ticket-book').waitFor();return;}
   if(name!=='field')throw Error('Only Field exists on the betting console.');if(await L('#dialog[open]').isVisible())await click('#dialogClose');await L('#tubeField').waitFor();
 }
 async function inList(kind,q){await page(kind);if(kind==='field'){await L(q).scrollIntoViewIfNeeded();return;}
   for(const direction of ['prev','next'])for(let k=0;k<=6;k++){if(await L(q).isVisible())return;const move=L('#folioPager [data-'+direction+']');if(!await move.isVisible()||await move.isDisabled())break;await move.click();}throw Error('Missing cashier entry: '+q);
 }
 async function pick(n){const q=`[data-tube-pick="${n}"]`;await inList('field',q);await click(q);}
 async function market(m){await page('field');await click(`[data-tube-market="${m}"]`);if(await L('#dialog[open]').isVisible())throw Error('Market unexpectedly opened a dialog');}
 async function stake(v){await page('field');await click(`[data-tube-coin="${v}"]`);}
 async function cancel(i){const q=`#dialog [data-cancel="${i}"]`;await inList('ticket',q);await click(q);await page('field');}
 async function finish(which){const q=`#finishTabs [data-official="${which}"]`;if(await L(q).isVisible())await click(q);}
 return {page,inList,pick,market,stake,cancel,finish};};
