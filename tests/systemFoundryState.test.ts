import test from 'node:test'
import assert from 'node:assert/strict'
import { actualModelForAlias, apiModelMatchesAlias, startupAlias } from '../src/runtime/systemFoundryState.ts'

const candidates = [
  { id: 'phi-4-mini-cuda-gpu:4', alias: 'phi-4-mini', displayName: 'Phi', cached: true, loaded: true },
  { id: 'phi-4-mini-cpu:4', alias: 'phi-4-mini', displayName: 'Phi CPU', cached: true, loaded: false },
]

test('System Foundry alias records the actual loaded selection', () => {
  assert.equal(actualModelForAlias('phi-4-mini', candidates)?.id, 'phi-4-mini-cuda-gpu:4')
})

test('startup restores an alias instead of a stale exact variant', () => {
  assert.equal(startupAlias('phi-4-mini'), 'phi-4-mini')
  assert.equal(startupAlias(undefined), 'phi-4-mini')
})

test('an API mismatch is not accepted as a loaded alias', () => {
  assert.equal(apiModelMatchesAlias('phi-4-mini', 'phi-4-mini-instruct-cuda-gpu:4'), true)
  assert.equal(apiModelMatchesAlias('phi-4-mini', 'qwen3-4b-cuda-gpu:4'), false)
})
