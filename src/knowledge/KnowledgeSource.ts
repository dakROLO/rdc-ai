export interface KnowledgeSearchResult { id: string; title: string; excerpt: string; metadata?: Record<string, string> }

export interface KnowledgeSource {
  readonly id: string
  readonly name: string
  readonly type: string
  readonly capabilities: readonly ('search' | 'fetch')[]
  health(): Promise<{ available: boolean; detail: string }>
  search(query: string): Promise<KnowledgeSearchResult[]>
  fetch(id: string): Promise<KnowledgeSearchResult | undefined>
  metadata(): Promise<Record<string, string>>
}

/** Synthetic/local proof only. RDC will be an independently configured source. */
export class LocalKnowledgeSource implements KnowledgeSource {
  readonly type = 'local'
  readonly capabilities = ['search', 'fetch'] as const
  readonly id: string
  readonly name: string
  private readonly entries: KnowledgeSearchResult[]
  constructor(id: string, name: string, entries: KnowledgeSearchResult[]) {
    this.id = id
    this.name = name
    this.entries = entries
  }
  async health() { return { available: true, detail: 'Stored on this device.' } }
  async search(query: string) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    return this.entries.filter((entry) => terms.every((term) => `${entry.title} ${entry.excerpt}`.toLowerCase().includes(term)))
  }
  async fetch(id: string) { return this.entries.find((entry) => entry.id === id) }
  async metadata() { return { locality: 'device', synthetic: 'true' } }
}
