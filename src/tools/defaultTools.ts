import { KnowledgeRegistry } from '../knowledge/KnowledgeRegistry.ts'
import { LocalKnowledgeSource } from '../knowledge/KnowledgeSource.ts'
import { ToolRegistry, type CrownKeepTool } from './ToolRegistry.ts'

export const knowledgeRegistry = new KnowledgeRegistry()
knowledgeRegistry.register(new LocalKnowledgeSource('inside-the-keep', 'Inside the Keep', [
  { id: 'local-first', title: 'Local-first CrownKeep', excerpt: 'Conversations and the default assistant runtime stay on this device.' },
  { id: 'projects', title: 'Projects', excerpt: 'Projects keep related conversations and working context together.' },
]))

export const toolRegistry = new ToolRegistry()
const localSearch: CrownKeepTool<{ query: string }> = {
  id: 'local-crownkeep-search', name: 'Search Inside the Keep', description: 'Read-only search across configured local knowledge.', requiresNetwork: false, access: 'read',
  isAvailable: async () => true,
  execute: async ({ query }) => {
    const results = (await Promise.all(knowledgeRegistry.list().map((source) => source.search(query)))).flat().slice(0, 5)
    return { text: results.length ? results.map((result) => `${result.title}: ${result.excerpt}`).join('\n') : 'No local results found.', data: results }
  },
}
const urlRead: CrownKeepTool<{ url: string }> = {
  id: 'read-url', name: 'Read webpage', description: 'Read-only URL fetch; never changes the language-model provider.', requiresNetwork: true, access: 'read',
  isAvailable: async () => typeof fetch === 'function',
  execute: async ({ url }) => {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http(s) URLs are supported.')
    const response = await fetch(parsed, { signal: AbortSignal.timeout(10_000) })
    if (!response.ok) throw new Error(`Page request failed (${response.status}).`)
    return { text: (await response.text()).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4_000) }
  },
}
toolRegistry.register(localSearch)
toolRegistry.register(urlRead)

export async function runToolCommand(text: string) {
  const local = text.match(/^\/search\s+(.+)/i)
  const url = text.match(/^\/url\s+(https?:\/\/\S+)/i)
  if (!local && !url) return undefined
  const id = local ? localSearch.id : urlRead.id
  const input = local ? { query: local[1] } : { url: url![1] }
  return { tool: toolRegistry.get(id)!, result: await toolRegistry.execute(id, input) }
}
