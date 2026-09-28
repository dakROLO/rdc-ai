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

export interface WebGatewayClientOptions {
  endpoint?: string
  fetchImpl?: typeof fetch
}

function normalizeGatewayEndpoint(value?: string): string | undefined {
  const trimmed = value?.trim().replace(/\/+$/, '')
  return trimmed || undefined
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

async function responseJson<T>(response: Response, operation: string): Promise<T> {
  if (!response.ok) {
    let detail = ''
    try {
      detail = (await response.text()).trim()
    } catch {
      detail = ''
    }
    throw new Error(
      `${operation} failed (${response.status})${detail ? `: ${detail.slice(0, 240)}` : ''}`,
    )
  }
  return (await response.json()) as T
}

export class WebGatewayClient {
  private readonly endpoint?: string
  private readonly fetchImpl: typeof fetch

  constructor(options: WebGatewayClientOptions = {}) {
    this.endpoint = normalizeGatewayEndpoint(
      options.endpoint ?? import.meta.env.VITE_CROWNKEEP_WEB_GATEWAY_URL,
    )
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  isConfigured(): boolean {
    return Boolean(this.endpoint)
  }

  async search(query: string, maxResults = 5): Promise<WebSearchResponse> {
    if (!this.endpoint) throw new Error('CrownKeep Web Gateway is not configured.')

    const normalizedQuery = query.replace(/\s+/g, ' ').trim().slice(0, 512)
    if (!normalizedQuery) throw new Error('Web Search requires a query.')

    const response = await this.fetchImpl(`${this.endpoint}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: normalizedQuery,
        maxResults: Math.max(1, Math.min(8, Math.round(maxResults))),
      }),
      signal: AbortSignal.timeout(15_000),
    })

    const payload = await responseJson<WebSearchResponse>(response, 'Web Search')
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
    if (!this.endpoint) throw new Error('CrownKeep Web Gateway is not configured.')

    const normalizedUrl = safeHttpUrl(url)
    const response = await this.fetchImpl(`${this.endpoint}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: normalizedUrl }),
      signal: AbortSignal.timeout(20_000),
    })

    const payload = await responseJson<WebReadResponse>(response, 'Web Read')
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
