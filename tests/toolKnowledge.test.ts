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

test('registered local and web tools keep their network boundary explicit', async () => {
  assert.equal(knowledgeRegistry.list().length, 1)
  assert.equal(toolRegistry.get('web-search')?.requiresNetwork, true)
  assert.equal(toolRegistry.get('web-read')?.requiresNetwork, true)
  assert.equal(toolRegistry.getPolicy().webAccess, 'off')

  const result = await runToolCommand('/search local-first')
  assert.match(result?.result.text ?? '', /Local-first CrownKeep/)
  assert.equal(result?.result.metadata?.dataLeftDevice, false)
})

test('Web Access OFF blocks a network tool before availability or execution can make a call', async () => {
  const registry = new ToolRegistry()
  let availabilityChecks = 0
  let executions = 0

  const networkTool: CrownKeepTool<{ query: string }> = {
    id: 'network-proof',
    name: 'Network proof',
    description: 'Test-only network tool.',
    requiresNetwork: true,
    access: 'read',
    isAvailable: async () => {
      availabilityChecks += 1
      return true
    },
    execute: async () => {
      executions += 1
      return { text: 'network result' }
    },
  }

  registry.register(networkTool)

  await assert.rejects(
    registry.execute(networkTool.id, { query: 'should never leave device' }),
    /Web Access is OFF/,
  )
  assert.equal(availabilityChecks, 0)
  assert.equal(executions, 0)

  registry.setPolicy({ webAccess: 'on' })
  const result = await registry.execute(networkTool.id, { query: 'public query' })
  assert.equal(availabilityChecks, 1)
  assert.equal(executions, 1)
  assert.equal(result.metadata?.dataLeftDevice, true)
})

test('manual URL proof is also blocked while Web Access is OFF', async () => {
  toolRegistry.setPolicy({ webAccess: 'off' })
  await assert.rejects(
    runToolCommand('/url https://example.com'),
    /Web Access is OFF/,
  )
})

test('a local tool executes while its access and network boundary remain explicit', async () => {
  const registry = new ToolRegistry()
  const tool: CrownKeepTool<{ query: string }> = { id: 'local-search', name: 'Local search', description: 'Searches local notes.', requiresNetwork: false, access: 'read', isAvailable: async () => true, execute: async ({ query }) => ({ text: `Found local result for ${query}.` }) }
  registry.register(tool)
  const result = await registry.execute('local-search', { query: 'privacy' })
  assert.equal(result.text, 'Found local result for privacy.')
  assert.equal(result.metadata?.dataLeftDevice, false)
})
