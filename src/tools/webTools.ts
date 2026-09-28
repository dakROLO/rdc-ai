import type { CrownKeepTool } from './ToolRegistry.ts'
import {
  WebGatewayClient,
  type WebReadResponse,
  type WebSearchResponse,
} from '../web/WebGatewayClient.ts'

const searchSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'A minimal public-web search query. Do not include conversation history, local files, or unrelated private context.',
    },
    maxResults: {
      type: 'integer',
      minimum: 1,
      maximum: 8,
      description: 'Maximum number of search results to return.',
    },
  },
  required: ['query'],
  additionalProperties: false,
}

const readSchema = {
  type: 'object',
  properties: {
    url: {
      type: 'string',
      description:
        'The single public http(s) webpage URL selected for read-only retrieval.',
    },
  },
  required: ['url'],
  additionalProperties: false,
}

export class WebSearchTool
  implements CrownKeepTool<{ query: string; maxResults?: number }>
{
  readonly id = 'web-search'
  readonly name = 'Web Search'
  readonly description =
    'Search the public web through CrownKeep Web Gateway. Sends only the supplied search query.'
  readonly requiresNetwork = true
  readonly access = 'read' as const
  readonly inputSchema = searchSchema

  private readonly client: WebGatewayClient

  constructor(client: WebGatewayClient) {
    this.client = client
  }

  async isAvailable(): Promise<boolean> {
    return this.client.isConfigured()
  }

  async execute(input: {
    query: string
    maxResults?: number
  }): Promise<{
    text: string
    data: WebSearchResponse
    metadata: {
      dataLeftDevice: true
      sources: Array<{ url: string; title?: string }>
      detail: string
    }
  }> {
    const response = await this.client.search(input.query, input.maxResults ?? 5)
    const sources = response.results.map((result) => ({
      url: result.url,
      title: result.title,
    }))

    return {
      text: response.results.length
        ? response.results
            .map(
              (result, index) =>
                `[${index + 1}] ${result.title}\n${result.url}\n${result.snippet}`,
            )
            .join('\n\n')
        : 'No web results found.',
      data: response,
      metadata: {
        dataLeftDevice: true,
        sources,
        detail:
          'Sent only the supplied search query to the configured CrownKeep Web Gateway.',
      },
    }
  }
}

export class WebReadTool implements CrownKeepTool<{ url: string }> {
  readonly id = 'web-read'
  readonly name = 'Web Read'
  readonly description =
    'Read one selected public webpage through CrownKeep Web Gateway. Sends only the selected URL.'
  readonly requiresNetwork = true
  readonly access = 'read' as const
  readonly inputSchema = readSchema

  constructor(private readonly client: WebGatewayClient) {}

  async isAvailable(): Promise<boolean> {
    return this.client.isConfigured()
  }

  async execute(input: {
    url: string
  }): Promise<{
    text: string
    data: WebReadResponse
    metadata: {
      dataLeftDevice: true
      sources: Array<{ url: string; title?: string }>
      detail: string
    }
  }> {
    const response = await this.client.read(input.url)
    return {
      text: response.content,
      data: response,
      metadata: {
        dataLeftDevice: true,
        sources: [{ url: response.url, title: response.title }],
        detail:
          'Sent only the selected webpage URL to the configured CrownKeep Web Gateway.',
      },
    }
  }
}

export function createWebTools(client = new WebGatewayClient()) {
  return {
    search: new WebSearchTool(client),
    read: new WebReadTool(client),
  }
}
