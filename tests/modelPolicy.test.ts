import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bestObserved, taskOf, groupFamilies, memoryFit, readResults, viableVariants } from '../src/runtime/modelPolicy.ts'
import type { BenchmarkResult } from '../src/runtime/modelPolicy.ts'
const cpu = { id: 'phi-cpu:5', alias: 'phi-4-mini', modelType: 'chat', displayName: 'Phi', cached: true, loaded: false, device: 'CPU', fileSizeMb: 2000 }
const gpu = { ...cpu, id: 'phi-gpu:5', device: 'GPU' }
const profile = { fingerprint: 'machine-a', memoryMb: 16000, detail: '' }
test('family choices collapse variants and exclude non-chat tasks', () => {
  const families = groupFamilies([cpu, gpu, { ...cpu, alias: 'whisper-tiny', modelType: 'speech' }, { ...cpu, alias: 'embedding', modelType: 'embeddings' }])
  assert.equal(families.length, 2)
  assert.equal(families[0].variants.length, 2)
  assert.equal(families[1].role, 'Voice')
})
test('tool metadata and memory constraints filter before benchmarking', () => {
  const family = groupFamilies([cpu, { ...gpu, supportsToolCalling: true }])[0]
  assert.equal(viableVariants(family, profile, true)[0].id, gpu.id)
  assert.match(memoryFit({ ...cpu, fileSizeMb: 15000 }, profile)!, /headroom/)
})
test('observed CPU beats nominal GPU, excludes stale and failed results', () => {
  const result: BenchmarkResult = { fingerprint: 'machine-a', alias: cpu.alias, variantId: cpu.id, cached: true, timestamp: '', firstTokenMs: 200, totalMs: 970, outcome: 'accepted' }
  assert.equal(bestObserved([result, { ...result, variantId: gpu.id, firstTokenMs: 3000, totalMs: 49900, outcome: 'slow' }, { ...result, fingerprint: 'old', variantId: 'old-fast', totalMs: 1 }], 'machine-a')?.variantId, cpu.id)
  assert.equal(bestObserved([{ ...result, outcome: 'error' }], 'machine-a'), undefined)
})
test('malformed local records are discarded', () => {
  assert.deepEqual(readResults({ getItem: () => '{' }), [])
  assert.deepEqual(readResults({ getItem: () => '[null,{}]' }), [])
})

test('native text catalogs are chat-capable but embedding and unknown tasks are excluded', () => {
  assert.equal(taskOf({ ...cpu, modelType: 'text' }), 'chat')
  assert.equal(taskOf({ ...cpu, modelType: 'text', task: 'embeddings' }), 'other')
  assert.equal(taskOf({ ...cpu, modelType: 'unknown' }), 'other')
})
