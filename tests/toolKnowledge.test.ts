import test from 'node:test'
import assert from 'node:assert/strict'
import { LocalKnowledgeSource } from '../src/knowledge/KnowledgeSource.ts'
import { ToolRegistry, type CrownKeepTool } from '../src/tools/ToolRegistry.ts'
import { knowledgeRegistry, runToolCommand, toolRegistry } from '../src/tools/defaultTools.ts'

test('local knowledge source searches and fetches without a product-specific dependency', async () => {
  const source = new LocalKnowledgeSource('local-notes', 'Local notes', [{ id: 'one', title: 'CrownKeep privacy', excerpt: 'Conversations stay on this device by default.' }])
  assert.equal((await source.search('privacy device')).length, 1)
  assert.equal((await source.fetch('one'))?.title, 'CrownKeep privacy')
  assert.equal((await source.health()).available, true)
})

test('registered local tool and knowledge proof stay local while URL tool is network-marked', async () => {
  assert.equal(knowledgeRegistry.list().length, 1)
  assert.equal(toolRegistry.get('read-url')?.requiresNetwork, true)
  const result = await runToolCommand('/search local-first')
  assert.match(result?.result.text ?? '', /Local-first CrownKeep/)
})

test('a local tool executes while its access and network boundary remain explicit', async () => {
  const registry = new ToolRegistry()
  const tool: CrownKeepTool<{ query: string }> = { id: 'local-search', name: 'Local search', description: 'Searches local notes.', requiresNetwork: false, access: 'read', isAvailable: async () => true, execute: async ({ query }) => ({ text: `Found local result for ${query}.` }) }
  registry.register(tool)
  assert.equal((await registry.execute('local-search', { query: 'privacy' })).text, 'Found local result for privacy.')
})
