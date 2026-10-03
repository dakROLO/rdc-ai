import test from 'node:test'
import assert from 'node:assert/strict'
import type { AIProvider, ChatRequest, ChatChunk } from '../src/providers/AIProvider.ts'
import { ToolRegistry } from '../src/tools/ToolRegistry.ts'
import { streamStructuredToolLoop } from '../src/tools/structuredToolLoop.ts'
import { runAutomaticReadOnlyTools, resolveWebPrompt } from '../src/tools/automaticToolUse.ts'
import { streamGroundedAnswer } from '../src/tools/groundedAnswer.ts'
import { imageCapabilities } from '../src/images/imageCapabilities.ts'

function setup() {
  const registry = new ToolRegistry()
  registry.setPolicy({ webAccess: 'on' })
  let executions = 0
  let probes = 0
  registry.register({ id: 'web.search', name: 'Web Search', description: 'Search current information', requiresNetwork: true, access: 'read',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    isAvailable: async () => { probes++; return true },
    execute: async () => { executions++; return { text: 'Lighthouse code is 725.', metadata: { dataLeftDevice: true, sources: [{ url: 'https://example.com/code' }] } } },
  })
  return { registry, executions: () => executions, probes: () => probes }
}
function provider(stream: (request: ChatRequest) => AsyncIterable<ChatChunk>): AIProvider {
  return { id: 'proof', displayName: 'Proof', location: 'local', getAvailability: async () => ({ available: true }), listModels: async () => [], streamChat: stream }
}
async function collect(stream: AsyncIterable<ChatChunk>) {
  let text = ''
  for await (const chunk of stream) text += chunk.text
  return text
}

test('Web ON offers search without keyword gate; model decision uses result in second round', async () => {
  const { registry, executions } = setup()
  let turns = 0
  const local = provider(async function* (request) {
    turns++
    if (!request.messages.some((item) => item.role === 'tool')) {
      assert.ok(request.tools?.some((tool) => tool.id === 'web.search'))
      yield { text: '', toolCallDeltas: [{ index: 0, name: 'crownkeep_web_search', arguments: '{"query":"lighthouse code"}' }] }
    } else {
      const evidence = request.messages.find((item) => item.role === 'tool')!.content
      assert.match(evidence, /725/)
      assert.match(evidence, /https:\/\/example.com\/code/)
      yield { text: 'The source says 725.' }
    }
  })
  assert.equal(await collect(streamStructuredToolLoop({ provider: local, request: { modelId: 'proof', messages: [{ role: 'user', content: 'Tell me the lighthouse code.' }] }, registry })), 'The source says 725.')
  assert.equal(turns, 2); assert.equal(executions(), 1)
})

test('local model skips structured call: invisible fallback discards stale answer and reasons again', async () => {
  const { registry, executions } = setup()
  let turns = 0
  const local = provider(async function* (request) {
    turns++
    if (turns === 1) yield { text: 'My training cutoff is April 2023.' }
    else {
      assert.equal(request.tools, undefined)
      assert.ok(request.messages.some((item) => item.content.includes('725')))
      yield { text: 'The retrieved lighthouse code is 725.' }
    }
  })
  const activities: unknown[] = []
  const text = await collect(streamStructuredToolLoop({ provider: local, request: { modelId: 'proof', messages: [{ role: 'user', content: 'current lighthouse code' }] }, registry, fallback: () => runAutomaticReadOnlyTools('current lighthouse code', registry), onToolActivity: (item) => activities.push(item) }))
  assert.equal(text, 'The retrieved lighthouse code is 725.')
  assert.equal(turns, 2); assert.equal(executions(), 1); assert.equal(activities.length, 1)
})

test('Web OFF rejects hallucinated requests before network availability or execution', async () => {
  const { registry, executions, probes } = setup()
  registry.setPolicy({ webAccess: 'off' })
  const local = provider(async function* (request) {
    assert.equal(request.tools, undefined)
    yield { text: 'Local answer' }
  })
  await collect(streamStructuredToolLoop({ provider: local, request: { modelId: 'proof', messages: [] }, registry }))
  await assert.rejects(registry.execute('web.search', { query: 'x' }), /OFF/)
  assert.equal(executions(), 0); assert.equal(probes(), 0)
})

test('false cannot-browse answer is corrected once; repeated failure yields honest source evidence', async () => {
  const local = provider(async function* (request) {
    assert.ok(request.messages.some((item) => item.content.includes('725')))
    yield { text: "I cannot browse the web." }
  })
  const evidence = [{ toolId: 'web.search', label: 'Search', requiresNetwork: true, dataLeftDevice: true, sources: [{ url: 'https://example.com/code' }], retainedContext: 'Lighthouse code 725.' }]
  const text = await collect(streamGroundedAnswer({ provider: local, request: { modelId: 'proof', messages: [] }, stream: (async function* () { yield { text: 'My training cutoff is April 2023.' } })(), evidence: () => evidence }))
  assert.match(text, /725/); assert.match(text, /https:\/\/example.com\/code/)
  assert.doesNotMatch(text, /cannot browse|training cutoff/i)
})

test('native tool activities suppress duplicate fallback and are retained', async () => {
  const { registry, executions } = setup()
  const activities: unknown[] = []
  const local = provider(async function* () {
    yield { text: 'Source says 725.', toolActivities: [{ toolId: 'web.search', label: 'Search', requiresNetwork: true, dataLeftDevice: true, retainedContext: '725', sources: [{ url: 'https://example.com' }] }] }
  })
  let fallbacks = 0
  await collect(streamStructuredToolLoop({ provider: local, request: { modelId: 'proof', messages: [] }, registry, fallback: async () => { fallbacks++; return { context: '', activities: [], attemptedWeb: false } }, onToolActivity: (item) => activities.push(item) }))
  assert.equal(fallbacks, 0); assert.equal(executions(), 0); assert.equal(activities.length, 1)
})

test('query follow-up uses only explicit user context and excludes image text', () => {
  assert.equal(resolveWebPrompt('Look it up online', [{ role: 'user', content: 'lighthouse code' }]), 'search the web for lighthouse code')
  assert.equal(resolveWebPrompt('Look it up online', [{ role: 'user', content: 'secret image text', attachments: [{}] }]), 'Look it up online')
})

test('image capability claims require explicit framework/runtime state', () => {
  assert.equal(imageCapabilities().understandingAvailable, false)
  assert.equal(imageCapabilities({ generationAvailable: true }).generationAvailable, false)
  assert.equal(imageCapabilities({ generationAvailable: true, generationState: 'ready' }).generationAvailable, true)
  assert.equal(imageCapabilities({ understandingAvailable: true }).understandingAvailable, true)
})

test('image generation permission does not permit arbitrary write tools', async () => {
  const registry = new ToolRegistry()
  let imageWrites = 0
  let otherWrites = 0
  registry.register({ id: 'image.generate', name: 'Create image', description: 'Local generator', requiresNetwork: false, access: 'write', isAvailable: async () => true, execute: async () => { imageWrites++; return { text: 'Local image' } } })
  registry.register({ id: 'files.delete', name: 'Delete', description: 'Unsupported arbitrary write', requiresNetwork: false, access: 'write', isAvailable: async () => true, execute: async () => { otherWrites++; return { text: 'deleted' } } })
  await assert.rejects(registry.execute('image.generate', {}), /approval/)
  registry.setPolicy({ allowImageGeneration: true })
  await registry.execute('image.generate', {})
  await assert.rejects(registry.execute('files.delete', {}), /approval/)
  assert.equal(imageWrites, 1); assert.equal(otherWrites, 0)
})

test('repeated model calls stop at three tool executions and require a tool-free final answer', async () => {
  const { registry, executions } = setup()
  let finalRounds = 0
  const local = provider(async function* (request) {
    if (request.toolChoice === 'none') { finalRounds++; yield { text: 'Bounded final answer.' }; return }
    yield { text: '', toolCallDeltas: [{ index: 0, name: 'crownkeep_web_search', arguments: '{"query":"lighthouse"}' }] }
  })
  const answer = await collect(streamStructuredToolLoop({ provider: local, request: { modelId: 'proof', messages: [] }, registry }))
  assert.equal(executions(), 3); assert.equal(finalRounds, 1); assert.equal(answer, 'Bounded final answer.')
})
