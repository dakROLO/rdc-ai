import test from 'node:test'
import assert from 'node:assert/strict'
import { ToolRegistry, type CrownKeepTool } from '../src/tools/ToolRegistry.ts'
import { runAutomaticReadOnlyTools } from '../src/tools/automaticToolUse.ts'

function registryWithWebProof() {
  const registry = new ToolRegistry()
  const calls: string[] = []

  const search: CrownKeepTool<{ query: string }> = {
    id: 'web-search',
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
    id: 'web-read',
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
  assert.equal(result.activities[0]?.toolId, 'web-search')
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
    result.activities.filter((activity) => activity.toolId === 'web-read').length,
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
