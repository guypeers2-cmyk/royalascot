
/* Pure betting math used by the game and Node unit tests. No DOM or random state. */
(function attachBetMath(root) {
  'use strict';

  function pairKey(a, b) {
    const low = Math.min(a, b) - 1;
    const high = Math.max(a, b) - 1;
    return `${low}-${high}`;
  }

  function quinellaProbability(runners, i, j) {
    const a = runners[i].p;
    const b = runners[j].p;
    return a * b / (1 - a) + b * a / (1 - b);
  }

  function secondPlaceProbability(runners, index) {
    const target = runners[index]?.p;
    if (!Number.isFinite(target) || target < 0 || target >= 1) return 0;
    let probability = 0;
    for (let first = 0; first < runners.length; first++) {
      if (first === index) continue;
      const p = runners[first].p;
      probability += p * target / Math.max(1e-9, 1 - p);
    }
    return probability;
  }

  // Prices depend on stable strength and a fixed card-noise sample, never on form or starting stamina.
  function marketProbabilities(runners, width, noiseSamples) {
    if (!Array.isArray(runners) || runners.length < 3 || !Array.isArray(noiseSamples) || noiseSamples.length !== runners.length)
      throw new TypeError('A field and one noise sample per runner are required.');
    if (!Number.isFinite(width) || runners.some(runner => !Number.isFinite(runner.str)) || noiseSamples.some(sample => !Number.isFinite(sample)))
      throw new RangeError('Market inputs must be finite numbers.');
    const weights = runners.map((runner, index) => {
      const strength = (runner.str - 40) / 56;
      return Math.exp(width * (strength - 0.5) * 1.35 + noiseSamples[index]);
    });
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    return weights.map(weight => weight / total);
  }

  function priceField(runners, rtp, bias) {
    if (!Array.isArray(runners) || runners.length < 3) throw new TypeError('A field of at least three runners is required.');
    if (!Number.isFinite(rtp) || rtp <= 0 || !Number.isFinite(bias) || bias <= 0) throw new RangeError('RTP and bias must be positive finite numbers.');
    const margin = (rtp / 100) * bias * 0.965;
    const winOdds = runners.map(runner => {
      const fair = 1 / Math.max(0.004, runner.p);
      return Math.min(99, Math.max(2, Math.round(fair * margin)));
    });
    const showProbabilities = runners.map((_, index) => secondPlaceProbability(runners, index));
    const showOdds = showProbabilities.map(probability => {
      const fair = 1 / Math.max(0.004, probability);
      return Math.min(99, Math.max(2, Math.round(fair * margin)));
    });
    const qPrices = {};
    for (let i = 0; i < runners.length; i++) {
      for (let j = i + 1; j < runners.length; j++) {
        const probability = Math.max(0.0012, quinellaProbability(runners, i, j));
        qPrices[`${i}-${j}`] = Math.min(999, Math.max(2, Math.round((1 / probability) * margin)));
      }
    }
    const tPrices = {};
    for (let i = 0; i < runners.length; i++) {
      for (let j = 0; j < runners.length; j++) {
        for (let k = 0; k < runners.length; k++) {
          if (i === j || i === k || j === k) continue;
          const a = runners[i].p, b = runners[j].p, c = runners[k].p;
          const probability = Math.max(1e-9, a * (b / Math.max(1e-6, 1 - a)) * (c / Math.max(1e-6, 1 - a - b)));
          tPrices[`${i}-${j}-${k}`] = Math.min(9999, Math.max(2, Math.round((1 / probability) * margin)));
        }
      }
    }
    return { winOdds, showOdds, showProbabilities, qPrices, tPrices };
  }

  // Exhibition prices in PLAY MEDALS, printed once. Work from each market's
  // unrounded weight, so two chances on the old integer ladder can separate.
  // Sharpen the new-field book by probability rank: favourites shorten and
  // outsiders lengthen. No tickets, balances or outcome rolls are inputs.
  function sharpen(probabilities,power=1.25) {
    const weights=probabilities.map(p=>Math.pow(Math.max(1e-9,p),power)),sum=weights.reduce((a,b)=>a+b,0);
    return weights.map(w=>w/sum);
  }
  function medalBoard(runners) {
    const base=priceField(runners,92,1),N=runners.length;
    const ranks=ps=>{const order=ps.map((_,i)=>i).sort((a,b)=>ps[b]-ps[a]||a-b),score=Array(ps.length);order.forEach((i,r)=>score[i]=1-2*r/Math.max(1,ps.length-1));return score;};
    const quote=(p,anchor,baseLift,tailLift,cap,rank)=>{
      const fair=1/Math.max(.0001,p),rarity=Math.max(0,Math.min(1,(fair/anchor-.6)/1.5));
      // Price tilt is relative to this market's rank: higher-ranked chances
      // shorten, while lower-ranked ones lengthen. Never rewrite issued odds.
      return Math.min(cap,Math.max(2,Math.round(fair*(baseLift-.22*rank+tailLift*rarity))));
    };
    // Tighten the top of the book: favourites get shorter prices while
    // outsiders get longer ones. The race probabilities themselves are not
    // touched; issued odds remain frozen on existing cards.
    const winP=sharpen(runners.map(h=>h.p)),showP=sharpen(base.showProbabilities),winRank=ranks(winP),showRank=ranks(showP);
    const winOdds=runners.map((h,i)=>quote(winP[i],N,1.32,.50,199,winRank[i]));
    const showOdds=showP.map((p,i)=>quote(p,N,1.23,.36,199,showRank[i]));
    const keys=[],pairP=[];for(let i=0;i<N;i++)for(let j=i+1;j<N;j++){keys.push(`${i}-${j}`);pairP.push(quinellaProbability(runners,i,j));}
    const sharpenedPairs=sharpen(pairP),pairRank=ranks(sharpenedPairs),qPrices={};keys.forEach((key,i)=>{qPrices[key]=quote(sharpenedPairs[i],N*(N-1)/2,1.36,.58,1999,pairRank[i]);});
    // Print 6/5 of the PREVIOUS posted quote, not 20% on underlying fair
    // probabilities. Store decimal odds in tenths without rounding away uplift.
    const salon=q=>q*12/10;
    return {winOdds:winOdds.map(salon),showOdds:showOdds.map(salon),qPrices:Object.fromEntries(Object.entries(qPrices).map(([k,q])=>[k,salon(q)]))};
  }
  // Presentation sort only. Preserve submission order within a market and
  // carry the ledger index for refunds and hit-testing on the physical CRT.
  function ticketRows(bets){const rank={win:0,show:1,quinella:2};return bets.map((bet,index)=>({bet,index})).sort((a,b)=>rank[a.bet.market]-rank[b.bet.market]||a.index-b.index);}

  function validateStake(stake, credits) {
    if (!Number.isSafeInteger(stake) || stake <= 0) return { ok: false, error: 'Stake must be a positive whole number.' };
    if (!Number.isFinite(credits) || credits < stake) return { ok: false, error: 'Not enough credits at this station.' };
    return { ok: true, error: '' };
  }

  function settleUserBets(order, bets, runners, qPrices, tPrices) {
    if (!Array.isArray(order) || order.length < 3) throw new TypeError('Finish order must contain at least three runners.');
    const [first, second, third] = order;
    const exactOrder = `${first - 1}-${second - 1}-${third - 1}`;
    const qKey = pairKey(first, second);
    let payout = 0;
    const hits = [];
    for (const [numText, stake] of Object.entries(bets.win || {})) {
      const num = Number(numText);
      if (num === first && stake > 0) {
        const odds = runners.find(runner => runner.num === first)?.winOdds;
        if (!Number.isFinite(odds)) throw new Error(`Missing win odds for runner ${first}.`);
        payout += stake * odds;
        hits.push(`${stake} on ${first} @ ${odds}×`);
      }
    }
    for (const [numText, stakeValue] of Object.entries(bets.show || {})) {
      const num = Number(numText), stake = Number(stakeValue);
      if (num === second && stake > 0) {
        const odds = runners.find(runner => runner.num === second)?.showOdds;
        if (!Number.isFinite(odds)) throw new Error(`Missing SHOW odds for runner ${second}.`);
        payout += stake * odds;
        hits.push(`${stake} SHOW on ${second} @ ${odds}×`);
      }
    }
    const quinellaStake = Number((bets.q || {})[qKey] || 0);
    if (quinellaStake > 0) {
      const odds = Number(qPrices[qKey]);
      if (!Number.isFinite(odds)) throw new Error(`Missing quinella odds for ${qKey}.`);
      payout += quinellaStake * odds;
      hits.push(`quinella ${first}–${second} @ ${odds}×`);
    }
    const tierceStake = Number((bets.t || {})[exactOrder] || 0);
    if (tierceStake > 0) {
      const odds = Number(tPrices[exactOrder]);
      if (!Number.isFinite(odds)) throw new Error(`Missing Tierce odds for ${exactOrder}.`);
      payout += tierceStake * odds;
      hits.push(`Tierce ${first}–${second}–${third} exact @ ${odds}×`);
    }
    return { payout, hits };
  }

  const gross=(stake,odds)=>Math.round(stake*Math.round(odds*100))/100;
  const api = Object.freeze({ gross, pairKey, quinellaProbability, secondPlaceProbability, marketProbabilities, priceField, medalBoard, ticketRows, validateStake, settleUserBets });
  root.HippoBetMath = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

