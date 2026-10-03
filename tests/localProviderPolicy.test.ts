import test from 'node:test'
import assert from 'node:assert/strict'
import { localProviderId } from '../src/providers/localProviderPolicy.ts'

test('native platform and explicit local configuration override stale mock selections', () => {
  assert.equal(localProviderId({ nativeWindows: true, storedId: 'mock-local', defaultId: 'mock-local' }), 'foundry-local')
  assert.equal(localProviderId({ appleId: 'apple-foundation-models', nativeWindows: false, storedId: 'foundry-local', defaultId: 'mock-local' }), 'apple-foundation-models')
  assert.equal(localProviderId({ nativeWindows: false, browserUnavailableId: 'ios-browser-unavailable', storedId: 'mock-local', defaultId: 'foundry-local' }), 'ios-browser-unavailable')
  assert.equal(localProviderId({ nativeWindows: false, configuredId: 'foundry-local', storedId: 'mock-local', defaultId: 'mock-local' }), 'foundry-local')
  assert.equal(localProviderId({ nativeWindows: false, defaultId: 'mock-local' }), 'mock-local')
})
