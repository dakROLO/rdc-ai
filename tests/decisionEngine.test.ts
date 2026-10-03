import test from 'node:test'
import assert from 'node:assert/strict'
import { DecisionAssist, type DecisionEngine, type DecisionResult, type DecisionStatus } from '../src/decision/DecisionEngine.ts'
import { ToolRegistry } from '../src/tools/ToolRegistry.ts'
function fixture(selected = 'Quick', confidence = .95) {
  let calls = 0; let releases = 0
  const status: DecisionStatus = { available: true, backend: 'local test', version: 'fixture', loadState: 'loaded', qualifiedJobs: ['model-route', 'tool-choice', 'tool-arguments', 'tool-result'], detail: '' }
  const engine: DecisionEngine = { status: async () => status, release: async () => { releases++ }, decide: async (): Promise<DecisionResult> => { calls++; return { selected, confidence, scores: { [selected]: confidence }, latencyMs: 12 } } }
  return { assist: new DecisionAssist(engine), status, calls: () => calls, releases: () => releases }
}
test('Julia disabled/unavailable use Quick; unqualified jobs run only in shadow; low confidence falls back', async () => {
  const f = fixture('Deep')
  assert.equal(await f.assist.route('Auto', 'complex', ['Quick','Deep']), 'Quick'); assert.equal(f.calls(), 0)
  await f.assist.setEnabled(true); f.status.available = false
  assert.equal(await f.assist.route('Auto', 'complex', ['Quick','Deep']), 'Quick'); assert.equal(f.calls(), 0)
  f.status.available = true; f.status.qualifiedJobs = []
  assert.equal(await f.assist.route('Auto', 'complex', ['Quick','Deep']), 'Quick')
  assert.equal(f.calls(), 1)
  assert.match(f.assist.last?.reason ?? '', /shadow/i)
  assert.equal(f.assist.last?.result?.selected, 'Deep')
  const low = fixture('Deep', .7); await low.assist.setEnabled(true)
  assert.equal(await low.assist.route('Auto', 'complex', ['Quick','Deep']), 'Quick')
  assert.equal(low.assist.history[0]?.result?.confidence, .7)
  assert.equal(low.assist.history[0]?.result?.latencyMs, 12)
  await f.assist.setEnabled(false); assert.equal(f.releases(),1)
})
test('Auto routes simple/moderate/difficult only among supplied qualified roles; manual overrides', async () => {
  for (const [prompt, role] of [['hello','Quick'], ['compare plans','Balanced'], ['distributed consensus proof','Deep']] as const) {
    const f = fixture(role); await f.assist.setEnabled(true)
    assert.equal(await f.assist.route('Auto',prompt,['Quick','Balanced','Deep']),role)
    assert.equal(f.assist.last?.result?.latencyMs,12)
    assert.equal(await f.assist.route('Quick',prompt,['Quick','Balanced','Deep']),'Quick'); assert.equal(f.calls(),1)
  }
  const f = fixture('Deep'); await f.assist.setEnabled(true)
  assert.equal(await f.assist.route('Auto','hard',['Quick','Balanced']),'Quick')
  assert.equal(await f.assist.route('Auto','hard',['Quick']),'Quick')
})
test('tool-choice advice and relevance judgments are event-driven and threshold gated', async () => {
  const f=fixture('WEB_SEARCH'); await f.assist.setEnabled(true)
  assert.equal(await f.assist.toolChoice('current iPhone'),'WEB_SEARCH'); assert.equal(f.calls(),1)
  const no=fixture('IRRELEVANT');await no.assist.setEnabled(true)
  assert.equal(await no.assist.relevant('tool-arguments','iPhone: proposed can you check online?'),false)
  assert.equal(await no.assist.relevant('tool-result','iPhone: personal bank checks'),false)
  const low=fixture('IRRELEVANT',.2);await low.assist.setEnabled(true)
  assert.equal(await low.assist.relevant('tool-result','ambiguous'),undefined)
})
test('bad query is rejected before execution; irrelevant result is excluded from evidence', async () => {
  let executions=0
  const f=fixture('IRRELEVANT');await f.assist.setEnabled(true)
  const registry=new ToolRegistry();registry.setPolicy({webAccess:'on'});registry.setSteward(f.assist,'Previous topic: newest Apple iPhone. User: can you check online?')
  registry.register({id:'web.search',name:'search',description:'',requiresNetwork:true,access:'read',isAvailable:async()=>true,execute:async()=>{executions++;return {text:'Personal checks and checkers'}}})
  await assert.rejects(registry.execute('web.search',{query:'can you check online?'}),/arguments/);assert.equal(executions,0)
  f.status.qualifiedJobs=['tool-result']
  const result=await registry.execute('web.search',{query:'newest Apple iPhone'})
  assert.equal(result.metadata?.detail,'irrelevant-result');assert.doesNotMatch(result.text,/Personal checks/);assert.equal(executions,1)
})
test('privacy/image permissions override Julia before probes, decisions or execution', async () => {
  let probes=0;let executions=0
  const f=fixture('RELEVANT');await f.assist.setEnabled(true)
  const r=new ToolRegistry();r.setSteward(f.assist,'request')
  for (const id of ['web.search','image.generate']) r.register({id,name:id,description:'',requiresNetwork:id==='web.search',access:id==='image.generate'?'write':'read',isAvailable:async()=>{probes++;return true},execute:async()=>{executions++;return {text:'local'}}})
  await assert.rejects(r.execute('web.search',{}),/OFF/);await assert.rejects(r.execute('image.generate',{}),/approval/)
  assert.deepEqual(await r.availableDefinitions(),[]);assert.equal(probes,0);assert.equal(executions,0);assert.equal(f.calls(),0)
  r.setPolicy({allowImageGeneration:true});assert.equal((await r.execute('image.generate',{})).metadata?.dataLeftDevice,false)
  assert.equal(executions,1)
})
test('engine failure and invalid/nonfinite scores never cause network or cloud fallback', async () => {
  for(const confidence of [NaN, Infinity, 1.2]) {const f=fixture('Deep',confidence);await f.assist.setEnabled(true);assert.equal(await f.assist.route('Auto','hard',['Quick','Deep']),'Quick')}
  const f=fixture();f.assist.engine.decide=async()=>{throw new Error('native unavailable')};await f.assist.setEnabled(true)
  assert.equal(await f.assist.route('Auto','hard',['Quick','Deep']),'Quick')
})


test('real checks/checkers failure is rejected even with Julia OFF', async () => {
  const registry = new ToolRegistry(); registry.setPolicy({webAccess:'on'})
  registry.register({id:'web.search',name:'search',description:'',requiresNetwork:true,access:'read',isAvailable:async()=>true,execute:async()=>({text:'Order personal checks and bank checks online. Checkers.'})})
  const result=await registry.execute('web.search',{query:'newest Apple iPhone'})
  assert.equal(result.metadata?.detail,'irrelevant-result');assert.equal(result.data,undefined);assert.equal(result.metadata?.sources,undefined)
})


test('Web OFF during local evaluation blocks execution despite Julia approval', async () => {
  const f=fixture('RELEVANT');await f.assist.setEnabled(true)
  const r=new ToolRegistry();r.setPolicy({webAccess:'on'});r.setSteward(f.assist,'topic')
  let executed=false
  r.register({id:'web.search',name:'search',description:'',access:'read',requiresNetwork:true,isAvailable:async()=>true,execute:async()=>{executed=true;return {text:'evidence'}}})
  f.assist.engine.decide=async()=>{r.setPolicy({webAccess:'off'});return {selected:'RELEVANT',confidence:.99,scores:{RELEVANT:.99},latencyMs:1}}
  await assert.rejects(r.execute('web.search',{query:'topic'}),/OFF/);assert.equal(executed,false)
})
