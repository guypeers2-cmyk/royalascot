import asyncio, copy, unittest
from dispatch import run, validate, PRESETS, ROLES, fixture, PlanError, TransientRead

def plan():return copy.deepcopy(PRESETS['onderzoek'])
class Contract(unittest.TestCase):
    def test_roles_templates(self):
        self.assertEqual(list(ROLES),list(range(1,25)))
        for p in PRESETS.values():self.assertEqual(set(validate(p)),{t['id'] for t in p['tasks']})
    def test_invalid_graphs(self):
        for op in (lambda p:p.update(cap=20),lambda p:p['tasks'][0].update(needs=['antwoord']),lambda p:p['tasks'][2].update(needs=['onbekend']),lambda p:p['tasks'][1].update(out='BRON-A.md'),lambda p:p['tasks'][0].update(role=999),lambda p:p['tasks'][2].update(needs=['bron-b','bron-b'])):
            p=plan();op(p)
            with self.assertRaises(PlanError):validate(p)
class Execution(unittest.IsolatedAsyncioTestCase):
    async def test_parallel_same_work_and_result(self):
        p=plan();a=await run(dict(p,cap=1),fixture);b=await run(p,fixture);self.assertEqual(a['attempts'],b['attempts']);self.assertEqual(a['results'],b['results']);self.assertEqual((a['peak_scheduled'],b['peak_scheduled']),(1,2))
    async def test_critical_path_not_wave_barrier(self):
        p=plan();p['tasks'][2]['needs']=['bron-a'];p['tasks'][3]['needs']=['toets','bron-b'];seen=asyncio.Event()
        async def adapter(t):
            if t['id']=='bron-b':await asyncio.wait_for(seen.wait(),.5)
            if t['id']=='toets':seen.set()
            return 'ok'
        r=await run(p,adapter);self.assertTrue(all(v['status']=='ok' for v in r['results'].values()))
    async def test_longest_remaining_chain_first(self):
        p=plan();p['cap']=1;p['tasks'][2]['needs']=['bron-b'];p['tasks'][3]['needs']=['toets','bron-a'];p['tasks'][2]['estimate_ms']=200;ids=[]
        async def adapter(t):ids.append(t['id']);return 'ok'
        await run(p,adapter);self.assertEqual(ids[:2],['bron-b','toets'])
    async def test_blocked_and_optional_join(self):
        r=await run(PRESETS['ascot'],fixture);self.assertEqual(r['results']['audio']['status'],'blocked');self.assertEqual(r['results']['overdracht']['status'],'ok');self.assertEqual(r['attempts'],5)
    async def test_explicit_read_retry_only(self):
        seen=set()
        async def transient(t):
            i=t['id'];
            if i not in seen:seen.add(i);raise TransientRead()
            return 'ok'
        p=plan();p['max_calls']=9;r=await run(p,transient);self.assertEqual(r['results']['bron-a']['status'],'ok');self.assertEqual(r['results']['toets']['status'],'failed');self.assertEqual(r['results']['antwoord']['status'],'blocked');self.assertEqual(r['attempts'],5)
    async def test_deadline_budget_timeout_and_approval(self):
        p=plan();p['max_calls']=1;r=await run(p,fixture);self.assertEqual(r['attempts'],1);self.assertEqual(r['results']['antwoord']['status'],'blocked')
        p=plan();p['tasks'][0]['timeout_s']=.004;r=await run(p,fixture);self.assertEqual(r['results']['bron-a']['status'],'failed');self.assertEqual(r['results']['bron-b']['status'],'ok');self.assertEqual(r['results']['antwoord']['status'],'blocked')
        p=plan();p['tasks'][0]['mode']='approval';r=await run(p,fixture);self.assertEqual(r['attempts'],1);self.assertEqual(r['results']['bron-a']['status'],'blocked')
        p=plan();p['deadline_s']=1
        async def slow(t):await asyncio.sleep(2);return 'late'
        r=await run(p,slow);self.assertLess(r['elapsed_ms'],1750);self.assertEqual(r['attempts'],2);self.assertEqual(r['results']['antwoord']['status'],'blocked')
    async def test_cancels_child_on_caller_cancel(self):
        active=set();started=asyncio.Event()
        async def adapter(t):
            active.add(t['id']);started.set()
            try:await asyncio.sleep(5)
            finally:active.remove(t['id'])
        job=asyncio.create_task(run(plan(),adapter));await started.wait();job.cancel()
        with self.assertRaises(asyncio.CancelledError):await job
        self.assertFalse(active)
if __name__=='__main__':unittest.main()
