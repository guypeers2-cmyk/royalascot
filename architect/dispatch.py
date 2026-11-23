"""@architect • kleine, modelonafhankelijke sessieregisseur • Python 3.10+
Geen model, API-sleutel, shell, netwerk of externe schrijfactie in de demo.
Een eigen async adapter ontvangt alleen het werkpakket en directe voorgangers.
Zie README.md voor de productiegrens. Alle tijden gebruiken een monotone klok.
"""
import argparse, asyncio, hashlib, json, math, re, time
from pathlib import Path
from statistics import median

HERE = Path(__file__).resolve().parent
ROLES = {r[0]:r for r in json.loads((HERE/'roles.json').read_text())}
PRESETS = json.loads((HERE/'presets.json').read_text())
class PlanError(ValueError): pass
class TransientRead(Exception): pass  # alleen de adapter mag dit expliciet melden

def validate(p):
    def need(ok, msg):
        if not ok: raise PlanError(msg)
    need(isinstance(p,dict) and isinstance(p.get('objective'),str) and p['objective'].strip(),'Doel ontbreekt.')
    for k,lo,hi in [('cap',1,4),('deadline_s',1,900),('max_calls',1,120)]: need(type(p.get(k)) is int and lo<=p[k]<=hi, f'{k}: verwacht {lo}–{hi}.')
    ts=p.get('tasks');need(isinstance(ts,list) and 1<=len(ts)<=40,'Verwacht 1–40 taken.')
    ids={}; resources=set()
    for t in ts:
        need(isinstance(t,dict),'Geen taakobject.'); i=t.get('id')
        need(isinstance(i,str) and re.fullmatch('[a-z0-9][a-z0-9-]{0,39}',i) and i not in ids, 'Taak-ID ongeldig of dubbel.')
        need(type(t.get('role')) is int and t['role'] in ROLES, f'{i}: onbekende rol.')
        need(t.get('mode') in ('read','draft','verify','approval'), f'{i}: ongeldige modus.')
        for k in ('out','goal','check'): need(isinstance(t.get(k),str) and t[k].strip(), f'{i}: {k} ontbreekt.')
        res=t['out'].strip().casefold();need(res not in resources, f'{i}: output heeft al een eigenaar.');resources.add(res);ids[i]=t
        for k in ('needs','optional'):
            v=t.get(k,[]);need(isinstance(v,list) and all(isinstance(x,str) for x in v), f'{i}: {k} verwacht een lijst van IDs.')
        need('estimate_ms' not in t or type(t['estimate_ms']) is int and 1<=t['estimate_ms']<=600000, f'{i}: ongeldige schatting.')
        need('timeout_s' not in t or type(t['timeout_s']) in (float,int) and math.isfinite(t['timeout_s']) and .001<=t['timeout_s']<=900, f'{i}: ongeldige time-out.')
    for i,t in ids.items():
        ins=t.get('needs',[])+t.get('optional',[]);need(len(set(ins))==len(ins) and all(x in ids and x!=i for x in ins), f'{i}: ongeldige voorganger.')
    seen=set(); order=[]
    while len(seen)<len(ids):
        nxt=[i for i,t in ids.items() if i not in seen and all(d in seen for d in t.get('needs',[])+t.get('optional',[]))];need(nxt,'Cyclus: geen uitvoerbare volgorde.');seen.update(nxt);order.extend(nxt)
    return order

async def run(p, adapter):
    order=validate(p); by={t['id']:t for t in p['tasks']}; waiting=set(order); results={}; running={}; traces=[]
    # Longest remaining dependency chain gets the first free slot; a
    # positive ms estimate is optional (one equal-sized unit otherwise).
    downstream={i:[] for i in order}; score={}
    for i,t in by.items():
        for d in t.get('needs',[])+t.get('optional',[]):downstream[d].append(i)
    for i in reversed(order):score[i]=by[i].get('estimate_ms',1)+max((score[j] for j in downstream[i]),default=0)
    priority=sorted(order,key=lambda i:-score[i])
    start=time.monotonic(); deadline=start+p['deadline_s']; calls=0; peak=0
    def row(status,detail): return {'status':status,'detail':detail}
    async def one(i):
        nonlocal calls
        t=by[i]; packet={k:t[k] for k in ('id','role','mode','goal','out','check')}; packet['objective']=p['objective'];packet['inputs']={d:dict(results[d]) for d in t.get('needs',[])+t.get('optional',[])}
        for attempt in (1,2):
            remain=deadline-time.monotonic()
            if remain<=0:return row('blocked','Verzoekdeadline bereikt.')
            if calls>=p['max_calls']:return row('blocked','Budget voor adapteraanroepen uitgeput.')
            calls+=1; begin=time.monotonic(); state='error'
            try:
                out=await asyncio.wait_for(adapter(packet), min(remain,t.get('timeout_s',30)))
                if not isinstance(out,str) or not out.strip():return row('failed','Leeg adapterresultaat.')
                state='ok';return row('ok',out)
            except (TimeoutError,asyncio.TimeoutError):state='timeout';return row('failed','Time-out; geen blinde herhaling.')
            except TransientRead:
                state='transient';
                if attempt!=1 or t['mode']!='read': return row('failed','Tijdelijke fout; niet veilig/opnieuw herhaalbaar.')
            except Exception as e: return row('failed',type(e).__name__)  # geen private exceptiontekst loggen
            finally:traces.append({'id':i,'attempt':attempt,'state':state,'start_ms':round((begin-start)*1000,2),'ms':round((time.monotonic()-begin)*1000,2)})
    try:
        while waiting or running:
            for i in priority:
                if i not in waiting:continue
                t=by[i];req=t.get('needs',[]);opt=t.get('optional',[])
                if t.get('blocked') or t['mode']=='approval':results[i]=row('blocked',t.get('blocked') or 'Externe actie: afzonderlijke menselijke toestemming nodig.')
                elif time.monotonic()>=deadline:results[i]=row('blocked','Verzoekdeadline bereikt.')
                elif any(d in results and results[d]['status']!='ok' for d in req):results[i]=row('blocked','Vereiste voorganger niet geslaagd.')
                elif any(d not in results for d in req+opt) or len(running)>=p['cap']:continue
                else:
                    j=asyncio.create_task(one(i));running[j]=i;peak=max(peak,len(running))
                waiting.remove(i)
            if running:
                done,_=await asyncio.wait(running,return_when=asyncio.FIRST_COMPLETED)
                for j in done:results[running.pop(j)]=j.result()
    finally:
        for j in running:j.cancel()
        if running:await asyncio.gather(*running,return_exceptions=True)
    return {'results':{i:results[i] for i in order},'elapsed_ms':round((time.monotonic()-start)*1000,2),'attempts':calls,'peak_scheduled':peak,'trace':traces}

async def fixture(packet):
    # Known, controlled I/O-like waits only. No model answers are evaluated.
    await asyncio.sleep({'bron-a':.065,'bron-b':.055,'toets':.015,'antwoord':.010}.get(packet['id'],.012))
    data=json.dumps(packet,ensure_ascii=False,sort_keys=True).encode();return 'FIXTURE:'+hashlib.sha256(data).hexdigest()[:20]

async def bench(n):
    plan=PRESETS['onderzoek'];groups={1:[],2:[]};means={};finger=None;attempts=[]
    for k in range(n+1): # first paired trial is warm-up; alternate order
        for cap in ((1,2) if k%2==0 else (2,1)):
            r=await run(dict(plan,cap=cap),fixture);f=r['results']['antwoord']['detail'];assert all(t['status']=='ok' for t in r['results'].values());assert finger in (None,f) and r['attempts']==4;finger=f
            if k:groups[cap].append(r['elapsed_ms']);attempts.append(r['attempts'])
    for c,a in groups.items():means[str(c)]={'p50_ms':round(median(a),1),'p95_ms':round(sorted(a)[math.ceil(.95*len(a))-1],1),'raw_ms':a}
    return {'what':'Lokale asyncio-proef, geen model/inferentie/netwerk. Gecontroleerde wachttijden 65, 55, 15 en 10 ms.','trials_per_route':n,'warm_up_pairs_excluded':1,'result_fingerprint':finger,'attempts_per_run':4,'caps':means,'model_calls':0}

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__);group=ap.add_mutually_exclusive_group();group.add_argument('--check',metavar='PLAN.json');group.add_argument('--demo',choices=PRESETS);group.add_argument('--bench',type=int,metavar='PAIRS');args=ap.parse_args()
    try:
        if args.check:
            p=json.loads(Path(args.check).read_text());print(json.dumps({'valid':True,'topological_order':validate(p)},ensure_ascii=False));raise SystemExit
        if args.bench is not None:
            if not 2<=args.bench<=500:raise PlanError('Kies 2–500 paren.')
            result=asyncio.run(bench(args.bench))
        else:result={'adapter':'synthetische fixture; geen echte taak, model of publicatie uitgevoerd',**asyncio.run(run(PRESETS[args.demo or 'onderzoek'],fixture))}
        print(json.dumps(result,ensure_ascii=False,indent=2))
    except (ValueError,OSError,TypeError) as e:ap.error(str(e))
