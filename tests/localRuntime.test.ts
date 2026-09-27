import test from 'node:test'
import assert from 'node:assert/strict'
import { ProviderLocalRuntime } from '../src/runtime/ProviderLocalRuntime.ts'
import type { AIProvider } from '../src/providers/AIProvider.ts'

test('provider-neutral local runtime reports an iOS-style Quick-only runtime honestly', async () => {
  const provider = { id: 'apple', displayName: 'Apple', location: 'local', getAvailability: async () => ({ available: true, detail: 'Ready' }), listModels: async () => [], streamChat: async function* () {} } satisfies AIProvider
  const runtime = new ProviderLocalRuntime('apple-runtime', provider, undefined, 'ios', ['Quick', 'Voice'])
  assert.deepEqual(await runtime.availableRoles(), ['Quick', 'Voice'])
  assert.equal((await runtime.capabilities()).supportsModelLifecycle, false)
  assert.equal((await runtime.health()).available, true)
})
