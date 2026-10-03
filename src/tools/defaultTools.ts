import { KnowledgeRegistry } from '../knowledge/KnowledgeRegistry.ts'
import { LocalKnowledgeSource } from '../knowledge/KnowledgeSource.ts'
import { ToolRegistry, type CrownKeepTool } from './ToolRegistry.ts'
import { NativeWebClient } from '../web/NativeWebClient.ts'
import { createWebTools } from './webTools.ts'

export const knowledgeRegistry = new KnowledgeRegistry()
knowledgeRegistry.register(new LocalKnowledgeSource('inside-the-keep', 'Inside the Keep', [
  { id: 'local-first', title: 'Local-first CrownKeep', excerpt: 'Conversations and the default assistant runtime stay on this device.' },
  { id: 'projects', title: 'Projects', excerpt: 'Projects keep related conversations and working context together.' },
]))

export const toolRegistry = new ToolRegistry()

const localSearch: CrownKeepTool<{ query: string }> = {
  id: 'keep.search',
  name: 'Search Inside the Keep',
  description: 'Read-only search across configured local knowledge.',
  requiresNetwork: false,
  access: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search terms for local CrownKeep knowledge.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  isAvailable: async () => true,
  execute: async ({ query }) => {
    const results = (await Promise.all(
      knowledgeRegistry.list().map((source) => source.search(query)),
    ))
      .flat()
      .slice(0, 5)
    return {
      text: results.length
        ? results.map((result) => `${result.title}: ${result.excerpt}`).join('\n')
        : 'No local results found.',
      data: results,
      metadata: {
        dataLeftDevice: false,
        detail: 'Local knowledge search stayed inside the Keep.',
      },
    }
  },
}

export const nativeWebClient = new NativeWebClient()
export const webTools = createWebTools(nativeWebClient)

toolRegistry.register(localSearch)
toolRegistry.register(webTools.search)
toolRegistry.register(webTools.read)

/**
 * Manual commands remain useful for diagnostics, but normal product behavior
 * should use the automatic tool path.
 */
export async function runToolCommand(text: string) {
  const local = text.match(/^\/search\s+(.+)/i)
  const web = text.match(/^\/web\s+(.+)/i)
  const url = text.match(/^\/url\s+(https?:\/\/\S+)/i)
  if (!local && !web && !url) return undefined

  const id = local
    ? localSearch.id
    : web
      ? webTools.search.id
      : webTools.read.id
  const input = local
    ? { query: local[1] }
    : web
      ? { query: web[1] }
      : { url: url![1] }

  return {
    tool: toolRegistry.get(id)!,
    result: await toolRegistry.execute(id, input),
  }
}
