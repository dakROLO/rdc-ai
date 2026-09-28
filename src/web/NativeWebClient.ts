import { invoke, isTauri } from '@tauri-apps/api/core'
import { getNativeAIHost } from '../native/NativeAIHost.ts'

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  score?: number
  publishedAt?: string
}

export interface WebSearchResponse {
  results: WebSearchResult[]
}

export interface WebReadResponse {
  url: string
  title?: string
  content: string
}

export interface NativeWebStatus {
  nativeAvailable: boolean
  provider: 'tavily'
  searchConfigured: boolean
  readAvailable: boolean
  credentialStore?: string
  detail: string
}

export interface NativeWebTransport {
  status(): Promise<NativeWebStatus>
  saveSearchCredential(apiKey: string): Promise<NativeWebStatus>
  clearSearchCredential(): Promise<NativeWebStatus>
  search(query: string, maxResults: number): Promise<WebSearchResponse>
  read(url: string): Promise<WebReadResponse>
}

function safeHttpUrl(value: string): string {
  const parsed = new URL(value)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Web Read only supports http(s) URLs.')
  }
  if (parsed.username || parsed.password) {
    throw new Error('Web Read does not accept URLs containing credentials.')
  }
  return parsed.toString()
}

function iosTransport(): NativeWebTransport | undefined {
  const bridge = getNativeAIHost()?.web
  if (!bridge) return undefined

  return {
    status: () => bridge.getStatus(),
    saveSearchCredential: (apiKey) => bridge.saveSearchCredential(apiKey),
    clearSearchCredential: () => bridge.clearSearchCredential(),
    search: (query, maxResults) => bridge.search(query, maxResults),
    read: (url) => bridge.read(url),
  }
}

function tauriTransport(): NativeWebTransport | undefined {
  if (!isTauri()) return undefined

  return {
    status: () => invoke<NativeWebStatus>('crownkeep_web_status'),
    saveSearchCredential: (apiKey) =>
      invoke<NativeWebStatus>('crownkeep_web_save_search_credential', { apiKey }),
    clearSearchCredential: () =>
      invoke<NativeWebStatus>('crownkeep_web_clear_search_credential'),
    search: (query, maxResults) =>
      invoke<WebSearchResponse>('crownkeep_web_search', { query, maxResults }),
    read: (url) => invoke<WebReadResponse>('crownkeep_web_read', { url }),
  }
}

function nativeTransport(): NativeWebTransport | undefined {
  return iosTransport() ?? tauriTransport()
}

const unavailableStatus: NativeWebStatus = {
  nativeAvailable: false,
  provider: 'tavily',
  searchConfigured: false,
  readAvailable: false,
  detail:
    'Direct Web Access requires the native CrownKeep app. Browser-only development does not store provider credentials.',
}

export class NativeWebClient {
  private readonly explicitTransport?: NativeWebTransport

  constructor(transport?: NativeWebTransport) {
    this.explicitTransport = transport
  }

  private transport(): NativeWebTransport | undefined {
    return this.explicitTransport ?? nativeTransport()
  }

  async status(): Promise<NativeWebStatus> {
    const transport = this.transport()
    return transport ? transport.status() : unavailableStatus
  }

  async isSearchConfigured(): Promise<boolean> {
    return (await this.status()).searchConfigured
  }

  async isReadConfigured(): Promise<boolean> {
    return (await this.status()).readAvailable
  }

  async saveSearchCredential(apiKey: string): Promise<NativeWebStatus> {
    const transport = this.transport()
    if (!transport) throw new Error(unavailableStatus.detail)
    const normalized = apiKey.trim()
    if (!normalized) throw new Error('Search provider API key is required.')
    return transport.saveSearchCredential(normalized)
  }

  async clearSearchCredential(): Promise<NativeWebStatus> {
    const transport = this.transport()
    if (!transport) throw new Error(unavailableStatus.detail)
    return transport.clearSearchCredential()
  }

  async search(query: string, maxResults = 5): Promise<WebSearchResponse> {
    const transport = this.transport()
    if (!transport) throw new Error(unavailableStatus.detail)

    const normalizedQuery = query.replace(/\s+/g, ' ').trim().slice(0, 512)
    if (!normalizedQuery) throw new Error('Web Search requires a query.')

    const payload = await transport.search(
      normalizedQuery,
      Math.max(1, Math.min(8, Math.round(maxResults))),
    )
    const results = Array.isArray(payload.results)
      ? payload.results
          .filter(
            (result) =>
              result &&
              typeof result.title === 'string' &&
              typeof result.url === 'string' &&
              typeof result.snippet === 'string',
          )
          .slice(0, 8)
      : []

    return { results }
  }

  async read(url: string): Promise<WebReadResponse> {
    const transport = this.transport()
    if (!transport) throw new Error(unavailableStatus.detail)

    const normalizedUrl = safeHttpUrl(url)
    const payload = await transport.read(normalizedUrl)
    if (typeof payload.content !== 'string' || !payload.content.trim()) {
      throw new Error('Web Read returned no readable content.')
    }

    return {
      url:
        typeof payload.url === 'string' && payload.url
          ? safeHttpUrl(payload.url)
          : normalizedUrl,
      title: typeof payload.title === 'string' ? payload.title : undefined,
      content: payload.content.trim().slice(0, 18_000),
    }
  }
}
