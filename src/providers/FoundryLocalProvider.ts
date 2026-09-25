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

interface FoundryStatusResponse {
  Endpoints?: string[]
}

interface StreamDelta {
  choices?: Array<{
    delta?: {
      content?: string | null
    }
  }>
}

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

export class FoundryLocalProvider implements AIProvider {
  readonly id = 'foundry-local'
  readonly displayName = 'Anne · Foundry Local'
  readonly location = 'local' as const

  private readonly endpointCandidates: string[]
  private activeEndpoint?: string

  constructor(options: FoundryLocalProviderOptions = {}) {
    const configured = options.endpoint ?? import.meta.env.VITE_FOUNDRY_LOCAL_ENDPOINT

    this.endpointCandidates = configured
      ? [normalizeEndpoint(configured)]
      : [
          'http://127.0.0.1:39839',
          'http://localhost:39839',
        ]
  }

  private async resolveEndpoint(): Promise<string> {
    if (this.activeEndpoint) return this.activeEndpoint

    const failures: string[] = []

    for (const endpoint of this.endpointCandidates) {
      try {
        const response = await fetch(`${endpoint}/openai/status`)
        await assertOk(response, 'Foundry Local status check')
        this.activeEndpoint = endpoint
        return endpoint
      } catch (error) {
        failures.push(
          `${endpoint}: ${error instanceof Error ? error.message : 'unreachable'}`,
        )
      }
    }

    throw new Error(
      `Could not reach Foundry Local. Tried ${failures.join(' | ')}`,
    )
  }

  async getAvailability(): Promise<ProviderAvailability> {
    try {
      const endpoint = await this.resolveEndpoint()
      const response = await fetch(`${endpoint}/openai/status`)
      await assertOk(response, 'Foundry Local status check')

      const status = (await response.json()) as FoundryStatusResponse
      const advertised = status.Endpoints?.join(', ')

      return {
        available: true,
        detail: advertised
          ? `Foundry Local is reachable at ${advertised}.`
          : `Foundry Local is reachable at ${endpoint}.`,
      }
    } catch (error) {
      this.activeEndpoint = undefined
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
    const endpoint = await this.resolveEndpoint()
    const response = await fetch(`${endpoint}/openai/models`)
    await assertOk(response, 'Foundry Local model discovery')

    const modelNames = (await response.json()) as string[]

    return modelNames.map((name) => ({
      id: name,
      displayName: name,
    }))
  }

  private async ensureModelLoaded(modelId: string): Promise<string> {
    const endpoint = await this.resolveEndpoint()
    const response = await fetch(
      `${endpoint}/openai/load/${encodeURIComponent(modelId)}?ttl=3600`,
    )
    await assertOk(response, `Loading Foundry Local model ${modelId}`)
    return endpoint
  }

  async *streamChat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    const endpoint = await this.ensureModelLoaded(request.modelId)

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.modelId,
        messages: request.messages,
        stream: true,
      }),
      signal,
    })

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

          if (text) {
            yield { text }
          }
        }

        if (done) break
      }

      const finalLine = buffer.trim()
      if (finalLine.startsWith('data:')) {
        const data = finalLine.slice(5).trim()
        if (data && data !== '[DONE]') {
          const parsed = JSON.parse(data) as StreamDelta
          const text = parsed.choices?.[0]?.delta?.content ?? ''
          if (text) yield { text }
        }
      }

      yield { text: '', done: true }
    } finally {
      reader.releaseLock()
    }
  }
}
