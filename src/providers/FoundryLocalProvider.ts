import type {
  AIModel,
  AIProvider,
  ChatChunk,
  ChatRequest,
  ProviderAvailability,
} from './AIProvider.ts'

interface FoundryLocalProviderOptions {
  endpoint?: string
}

interface OpenAIModelRecord {
  id: string
}

interface OpenAIModelList {
  data?: OpenAIModelRecord[]
}

interface StreamDelta {
  choices?: Array<{
    delta?: {
      content?: string | null
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

type ApiMode = 'v1' | 'legacy'

function normalizeEndpoint(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed
}

async function assertOk(response: Response, operation: string): Promise<Response> {
  if (response.ok) return response

  let detail = ''
  try {
    detail = await response.text()
  } catch {
    detail = ''
  }

  throw new Error(
    `${operation} failed (${response.status})${detail ? `: ${detail}` : ''}`,
  )
}

function inferRuntimeDevice(modelId: string): AIModel['runtimeDevice'] {
  const normalized = modelId.toLowerCase()
  if (/(^|[-_:])npu($|[-_:])/.test(normalized)) return 'NPU'
  if (/(^|[-_:])gpu($|[-_:])/.test(normalized)) return 'GPU'
  if (/(^|[-_:])cpu($|[-_:])/.test(normalized)) return 'CPU'
  return undefined
}

function parseModelNames(payload: unknown): string[] {
  if (Array.isArray(payload)) {
    return payload.filter((value): value is string => typeof value === 'string')
  }

  if (payload && typeof payload === 'object' && 'data' in payload) {
    const records = (payload as OpenAIModelList).data ?? []
    return records
      .map((record) => record.id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  }

  return []
}

export class FoundryLocalProvider implements AIProvider {
  readonly id = 'foundry-local'
  readonly displayName = 'Anne · Foundry Local'
  readonly location = 'local' as const

  private readonly endpointCandidates: string[]
  private activeEndpoint?: string
  private apiMode?: ApiMode

  constructor(options: FoundryLocalProviderOptions = {}) {
    const configured =
      options.endpoint || import.meta.env.VITE_FOUNDRY_LOCAL_ENDPOINT

    this.endpointCandidates = configured
      ? [normalizeEndpoint(configured)]
      : import.meta.env.DEV
        ? [
            '/foundry-local',
            'http://127.0.0.1:39839',
            'http://localhost:39839',
          ]
        : [
            'http://127.0.0.1:39839',
            'http://localhost:39839',
          ]
  }

  private async probeEndpoint(endpoint: string): Promise<ApiMode> {
    const currentResponse = await fetch(`${endpoint}/v1/models`)

    if (currentResponse.ok) {
      return 'v1'
    }

    const legacyResponse = await fetch(`${endpoint}/openai/status`)

    if (legacyResponse.ok) {
      return 'legacy'
    }

    throw new Error(
      `Foundry Local answered at ${endpoint}, but neither /v1/models nor the legacy /openai/status API is available.`,
    )
  }

  private async resolveEndpoint(): Promise<{ endpoint: string; mode: ApiMode }> {
    if (this.activeEndpoint && this.apiMode) {
      return { endpoint: this.activeEndpoint, mode: this.apiMode }
    }

    const failures: string[] = []

    for (const endpoint of this.endpointCandidates) {
      try {
        const mode = await this.probeEndpoint(endpoint)
        this.activeEndpoint = endpoint
        this.apiMode = mode
        return { endpoint, mode }
      } catch (error) {
        failures.push(
          `${endpoint}: ${error instanceof Error ? error.message : 'unreachable'}`,
        )
      }
    }

    throw new Error(
      `Could not reach a supported Foundry Local API. Tried ${failures.join(' | ')}`,
    )
  }

  async getAvailability(): Promise<ProviderAvailability> {
    try {
      const { endpoint, mode } = await this.resolveEndpoint()

      return {
        available: true,
        detail:
          mode === 'v1'
            ? `Foundry Local OpenAI API is reachable at ${endpoint}/v1.`
            : `Foundry Local legacy API is reachable at ${endpoint}.`,
      }
    } catch (error) {
      this.activeEndpoint = undefined
      this.apiMode = undefined

      return {
        available: false,
        detail:
          error instanceof Error
            ? error.message
            : 'Could not reach Foundry Local on the configured loopback endpoint.',
      }
    }
  }

  async listModels(): Promise<AIModel[]> {
    const { endpoint, mode } = await this.resolveEndpoint()
    const url =
      mode === 'v1'
        ? `${endpoint}/v1/models`
        : `${endpoint}/openai/models`

    const response = await fetch(url)
    await assertOk(response, 'Foundry Local model discovery')

    const payload = (await response.json()) as unknown
    const modelNames = parseModelNames(payload)

    return modelNames.map((name) => ({
      id: name,
      displayName: name,
      runtimeDevice: inferRuntimeDevice(name),
      variantId: name,
    }))
  }

  async *streamChat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    const { endpoint } = await this.resolveEndpoint()

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: request.modelId,
        messages: request.messages,
        stream: true,
      }),
      signal,
    })

    if (response.status === 404) {
      throw new Error(
        `Foundry Local could not find model "${request.modelId}". Load it first with: foundry model load <model-alias>`,
      )
    }

    await assertOk(response, 'Foundry Local chat completion')

    if (!response.body) {
      throw new Error('Foundry Local returned no response stream.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          buffer += decoder.decode()
        } else {
          buffer += decoder.decode(value, { stream: true })
        }

        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue

          const data = trimmed.slice(5).trim()
          if (!data) continue

          if (data === '[DONE]') {
            yield { text: '', done: true }
            return
          }

          const parsed = JSON.parse(data) as StreamDelta
          const text = parsed.choices?.[0]?.delta?.content ?? ''
          const usage = parsed.usage
            ? {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              }
            : undefined

          if (text || usage) {
            yield { text, usage }
          }
        }

        if (done) break
      }

      yield { text: '', done: true }
    } finally {
      reader.releaseLock()
    }
  }
}
