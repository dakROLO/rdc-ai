import type { KnowledgeSource } from './KnowledgeSource.ts'

export class KnowledgeRegistry {
  private readonly sources = new Map<string, KnowledgeSource>()
  register(source: KnowledgeSource) {
    if (this.sources.has(source.id)) throw new Error(`Knowledge source '${source.id}' is already registered.`)
    this.sources.set(source.id, source)
  }
  get(id: string) { return this.sources.get(id) }
  list() { return [...this.sources.values()] }
}
