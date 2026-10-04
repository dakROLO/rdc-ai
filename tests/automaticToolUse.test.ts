import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry, type CrownKeepTool } from '../src/tools/ToolRegistry.ts'
import { resolveWebPrompt, runAutomaticReadOnlyTools } from '../src/tools/automaticToolUse.ts'

function registryWithWebProof() {
  const registry = new ToolRegistry()
  const calls: string[] = []

  const search: CrownKeepTool<{ query: string }> = {
    id: 'web.search',
    name: 'Web Search',
    description: 'Test search.',
    requiresNetwork: true,
    access: 'read',
    inputSchema: { type: 'object' },
    isAvailable: async () => true,
    execute: async ({ query }) => {
      calls.push(`search:${query}`)
      return {
        text: 'Search result',
        data: {
          results: [
            { title: 'One', url: 'https://example.com/one', snippet: 'one' },
            { title: 'Two', url: 'https://example.com/two', snippet: 'two' },
            { title: 'Three', url: 'https://example.com/three', snippet: 'three' },
          ],
        },
        metadata: {
          dataLeftDevice: true,
          sources: [{ url: 'https://example.com/one', title: 'One' }],
        },
      }
    },
  }

  const read: CrownKeepTool<{ url: string }> = {
    id: 'web.read',
    name: 'Web Read',
    description: 'Test read.',
    requiresNetwork: true,
    access: 'read',
    inputSchema: { type: 'object' },
    isAvailable: async () => true,
    execute: async ({ url }) => {
      calls.push(`read:${url}`)
      return {
        text: `Page for ${url}`,
        metadata: {
          dataLeftDevice: true,
          sources: [{ url }],
        },
      }
    },
  }

  registry.register(search)
  registry.register(read)
  return { registry, calls }
}

test('Web Access OFF makes zero calls even for a current-information request', async () => {
  const { registry, calls } = registryWithWebProof()
  const result = await runAutomaticReadOnlyTools(
    'What is the latest CrownKeep news today?',
    registry,
  )

  assert.equal(calls.length, 0)
  assert.equal(result.attemptedWeb, false)
  assert.match(result.context, /Web Access is OFF/)
})

test('Web Access ON still makes zero calls for a local/non-current question', async () => {
  const { registry, calls } = registryWithWebProof()
  registry.setPolicy({ webAccess: 'on' })

  const result = await runAutomaticReadOnlyTools(
    'Explain why local-first architecture is useful.',
    registry,
  )

  assert.equal(calls.length, 0)
  assert.equal(result.attemptedWeb, false)
})

test('current information triggers search but not unnecessary page reads', async () => {
  const { registry, calls } = registryWithWebProof()
  registry.setPolicy({ webAccess: 'on' })

  const result = await runAutomaticReadOnlyTools(
    'What is the latest release today?',
    registry,
  )

  assert.equal(calls.length, 1)
  assert.match(calls[0], /^search:/)
  assert.equal(result.activities[0]?.toolId, 'web.search')
})

test('source-detail request is bounded to one search plus two webpage reads', async () => {
  const { registry, calls } = registryWithWebProof()
  registry.setPolicy({ webAccess: 'on' })

  const result = await runAutomaticReadOnlyTools(
    'Search the web for the latest release and read the source pages for details.',
    registry,
  )

  assert.equal(calls.length, 3)
  assert.match(calls[0], /^search:/)
  assert.match(calls[1], /^read:/)
  assert.match(calls[2], /^read:/)
  assert.equal(
    result.activities.filter((activity) => activity.toolId === 'web.read').length,
    2,
  )
})


test('version follow-up alone does not trigger a new web search', async () => {
  const { registry, calls } = registryWithWebProof()
  registry.setPolicy({ webAccess: 'on' })

  const result = await runAutomaticReadOnlyTools(
    'What version did you verify earlier?',
    registry,
  )

  assert.equal(calls.length, 0)
  assert.equal(result.attemptedWeb, false)
})

test('Web Access OFF guidance preserves retained-evidence use', async () => {
  const { registry, calls } = registryWithWebProof()

  const result = await runAutomaticReadOnlyTools(
    'What is the latest release today?',
    registry,
  )

  assert.equal(calls.length, 0)
  assert.match(result.context, /retained tool\/web evidence/i)
  assert.match(result.context, /do not claim a new web search/i)
})


test('generic online follow-up resolves to the previous substantive user request', () => {
  const resolved = resolveWebPrompt('can you check online?', [
    { role: 'assistant', content: 'My local knowledge may be stale.' },
    { role: 'user', content: 'Tell me what you know about the newest iPhone announced by Apple.' },
    { role: 'assistant', content: 'I cannot verify that locally.' },
  ])

  assert.match(resolved, /newest iPhone announced by Apple/i)
  assert.doesNotMatch(resolved, /check online/i)
})

test('generic online follow-up does not reuse image/OCR-bearing user content', () => {
  const resolved = resolveWebPrompt('can you check online?', [
    {
      role: 'user',
      content: 'BEGIN IMAGE TEXT\nprivate screenshot text',
      attachments: [{}],
    },
  ])

  assert.equal(resolved, 'can you check online?')
})


test('local image intent uses permitted image.generate fallback and retains the image', async () => {
  const registry = new ToolRegistry()
  let calls = 0
  const image: CrownKeepTool<{ prompt: string }> = {
    id: 'image.generate',
    name: 'Create image',
    description: 'Generate locally.',
    requiresNetwork: false,
    access: 'write',
    inputSchema: { type: 'object' },
    isAvailable: async () => true,
    execute: async ({ prompt }) => {
      calls += 1
      assert.match(prompt, /Pacific Northwest/i)
      return {
        text: 'Image generated locally.',
        data: { dataUrl: 'data:image/png;base64,test' },
        metadata: { dataLeftDevice: false },
      }
    },
  }
  registry.register(image)
  registry.setPolicy({ allowImageGeneration: true })

  const result = await runAutomaticReadOnlyTools(
    'Make an image of a Pacific Northwest valley in spring.',
    registry,
  )

  assert.equal(calls, 1)
  assert.equal(result.attemptedWeb, false)
  assert.equal(result.activities[0]?.toolId, 'image.generate')
  assert.equal(result.activities[0]?.generatedImageDataUrl, 'data:image/png;base64,test')
})

test('local image intent fails locally without turning into a web tool', async () => {
  const registry = new ToolRegistry()
  const image: CrownKeepTool<{ prompt: string }> = {
    id: 'image.generate',
    name: 'Create image',
    description: 'Generate locally.',
    requiresNetwork: false,
    access: 'write',
    inputSchema: { type: 'object' },
    isAvailable: async () => false,
    execute: async () => {
      throw new Error('should not execute')
    },
  }
  registry.register(image)
  registry.setPolicy({ allowImageGeneration: true })

  const result = await runAutomaticReadOnlyTools(
    'Create a picture of a mountain lake.',
    registry,
  )

  assert.equal(result.attemptedWeb, false)
  assert.equal(result.activities[0]?.toolId, 'image.generate')
  assert.equal(result.activities[0]?.outcome, 'error')
  assert.match(result.context, /local image generation could not run/i)
})
