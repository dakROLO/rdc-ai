import test from 'node:test'
import assert from 'node:assert/strict'
import type { AIProvider, ChatRequest } from '../src/providers/AIProvider.ts'
import { ToolRegistry, type CrownKeepTool } from '../src/tools/ToolRegistry.ts'
import { streamStructuredToolLoop } from '../src/tools/structuredToolLoop.ts'

test('structured loop executes ToolRegistry result and returns to the same provider', async () => {
  const registry = new ToolRegistry()
  registry.setPolicy({ webAccess: 'on' })
  let executions = 0

  const search: CrownKeepTool<{ query: string }> = {
    id: 'web-search',
    name: 'Web Search',
    description: 'Search current public information.',
    requiresNetwork: true,
    access: 'read',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    isAvailable: async () => true,
    execute: async ({ query }) => {
      executions += 1
      return {
        text: `Fresh result for ${query}`,
        metadata: {
          dataLeftDevice: true,
          sources: [{ url: 'https://example.com/source', title: 'Source' }],
        },
      }
    },
  }
  registry.register(search)

  let turns = 0
  const provider: AIProvider = {
    id: 'local-proof',
    displayName: 'Local proof',
    location: 'local',
    getAvailability: async () => ({ available: true }),
    listModels: async () => [{ id: 'proof', displayName: 'Proof' }],
    async *streamChat(request: ChatRequest) {
      turns += 1
      const hasToolOutput = request.messages.some((message) => message.role === 'tool')
      if (!hasToolOutput) {
        yield {
          text: '',
          toolCallDeltas: [
            {
              index: 0,
              id: 'call-1',
              name: 'crownkeep_web_search',
              arguments: '{"query":"current release"}',
            },
          ],
        }
        return
      }

      assert.match(
        request.messages.find((message) => message.role === 'tool')?.content ?? '',
        /Fresh result/,
      )
      yield { text: 'Final local answer.', done: true }
    },
  }

  const activities: string[] = []
  let output = ''
  for await (const chunk of streamStructuredToolLoop({
    provider,
    request: {
      modelId: 'proof',
      messages: [{ role: 'user', content: 'What is current?' }],
    },
    registry,
    onToolActivity: (activity) => activities.push(activity.toolId),
  })) {
    output += chunk.text
  }

  assert.equal(executions, 1)
  assert.equal(turns, 2)
  assert.equal(output, 'Final local answer.')
  assert.deepEqual(activities, ['web-search'])
})

test('structured loop forwards ordinary local text chunks immediately when tools are enabled', async () => {
  const registry = new ToolRegistry()
  registry.setPolicy({ webAccess: 'on' })
  registry.register({
    id: 'web-search',
    name: 'Web Search',
    description: 'Search current public information.',
    requiresNetwork: true,
    access: 'read',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
    isAvailable: async () => true,
    execute: async () => ({ text: 'unused' }),
  })

  const provider: AIProvider = {
    id: 'local-stream-proof',
    displayName: 'Local stream proof',
    location: 'local',
    getAvailability: async () => ({ available: true }),
    listModels: async () => [{ id: 'proof', displayName: 'Proof' }],
    async *streamChat() {
      yield { text: 'Local ' }
      yield { text: 'answer.', done: true }
    },
  }

  const chunks: string[] = []
  for await (const chunk of streamStructuredToolLoop({
    provider,
    request: {
      modelId: 'proof',
      messages: [{ role: 'user', content: 'Explain a local concept.' }],
    },
    registry,
  })) {
    if (chunk.text) chunks.push(chunk.text)
  }

  assert.deepEqual(chunks, ['Local ', 'answer.'])
})

