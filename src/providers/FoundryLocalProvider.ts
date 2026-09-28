import { invoke, isTauri } from '@tauri-apps/api/core'
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
      tool_calls?: Array<{
        index: number
        id?: string
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

type ApiMode = 'v1' | 'legacy'

function traceHost(event: string, detail: string, requestId?: string) {
  try {
    void invoke('crownkeep_trace', {
      scope: 'provider',
      event,
      detail,
      requestId,
    }).catch(() => {})
  } catch {
    // Browser-only tests do not have the Tauri bridge.
  }
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

function inferRuntimeDevice(modelId: string): AIModel['runtimeDevice'] {
  const normalized = modelId.toLowerCase()
  if (/(^|[-_:])npu($|[-_:])/.test(normalized)) return 'NPU'
  if (/(^|[-_:])gpu($|[-_:])/.test(normalized)) return 'GPU'
  if (/(^|[-_:])cpu($|[-_:])/.test(normalized)) return 'CPU'
  return undefined
}

function openAIMessage(message: ChatRequest['messages'][number]) {
  const value: Record<string, unknown> = {
    role: message.role,
    content:
      message.toolCalls && message.toolCalls.length > 0
        ? null
        : message.content,
  }

  if (message.name) value.name = message.name
  if (message.toolCallId) value.tool_call_id = message.toolCallId
  if (message.toolCalls?.length) {
    value.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function',
      function: {
        name: call.name,
        arguments: call.arguments,
      },
    }))
  }

  return value
}

function openAITools(request: ChatRequest) {
  if (!request.tools?.length) return undefined
  return request.tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.functionName,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }))
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
    const currentResponse = await fetch(`${endpoint}/v1/models`, { signal: AbortSignal.timeout(5000) })

    if (currentResponse.ok) {
      return 'v1'
    }

    const legacyResponse = await fetch(`${endpoint}/openai/status`, { signal: AbortSignal.timeout(5000) })

    if (legacyResponse.ok) {
      return 'legacy'
    }

    throw new Error(
      `Foundry Local answered at ${endpoint}, but neither /v1/models nor the legacy /openai/status API is available.`,
    )
  }

  private async resolveEndpoint(): Promise<{ endpoint: string; mode: ApiMode }> {
    if (!isTauri() && this.activeEndpoint && this.apiMode) {
      return { endpoint: this.activeEndpoint, mode: this.apiMode }
    }

    const failures: string[] = []

    // A packaged Windows app follows the installed System Foundry service,
    // including its dynamically reported endpoint. Browser development keeps
    // its explicitly configured/proxied loopback behavior.
    if (isTauri()) {
      try {
        const endpoint = normalizeEndpoint(await invoke<string>('crownkeep_system_foundry_endpoint'))
        const mode = await this.probeEndpoint(endpoint)
        this.activeEndpoint = endpoint
        this.apiMode = mode
        return { endpoint, mode }
      } catch (error) {
        failures.push(`System Foundry: ${error instanceof Error ? error.message : 'unreachable'}`)
        throw new Error(`Could not reach the current System Foundry endpoint. ${failures.join(' | ')}`)
      }
    }

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
      this.activeEndpoint = undefined
      this.apiMode = undefined
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
    let response: Response | undefined
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const { endpoint, mode } = await this.resolveEndpoint()
        response = await fetch(mode === 'v1' ? `${endpoint}/v1/models` : `${endpoint}/openai/models`)
        await assertOk(response, 'Foundry Local model discovery')
        break
      } catch (error) {
        lastError = error
        this.activeEndpoint = undefined
        this.apiMode = undefined
      }
    }
    if (!response?.ok) throw new Error(`System Foundry endpoint retry failed: ${String(lastError)}`)

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
    const traceId = request.traceId
    const started = performance.now()
    const messageChars = request.messages.reduce(
      (total, message) => total + message.content.length,
      0,
    )

    traceHost(
      'chat-begin',
      `model=${request.modelId} messages=${request.messages.length} chars=${messageChars} maxTokens=${request.maxTokens ?? 'default'}`,
      traceId,
    )

    let endpoint: string
    try {
      const resolved = await this.resolveEndpoint()
      endpoint = resolved.endpoint
      traceHost(
        'endpoint-ready',
        `endpoint=${endpoint} mode=${resolved.mode} elapsedMs=${Math.round(performance.now() - started)}`,
        traceId,
      )
    } catch (error) {
      traceHost(
        'endpoint-failed',
        `elapsedMs=${Math.round(performance.now() - started)} error=${String(error)}`,
        traceId,
      )
      throw error
    }

    let response!: Response
    const fetchStarted = performance.now()
    try {
      let lastError: unknown
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          response = await fetch(`${endpoint}/v1/chat/completions`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
            body: JSON.stringify({
              model: request.modelId,
              messages: request.messages.map(openAIMessage),
              stream: true,
              ...(request.maxTokens ? { max_tokens: request.maxTokens } : {}),
              ...(request.tools?.length ? { tools: openAITools(request) } : {}),
              ...(request.tools?.length
                ? { tool_choice: request.toolChoice ?? 'auto' }
                : {}),
            }),
            signal,
          })
          if (response.ok || attempt === 1 || signal?.aborted) break
          this.activeEndpoint = undefined; this.apiMode = undefined
          endpoint = (await this.resolveEndpoint()).endpoint
        } catch (error) {
          lastError = error
          if (attempt === 1 || signal?.aborted) throw error
          this.activeEndpoint = undefined; this.apiMode = undefined
          endpoint = (await this.resolveEndpoint()).endpoint
        }
      }
      if (!response!) throw lastError
    } catch (error) {
      traceHost(
        'http-fetch-failed',
        `model=${request.modelId} elapsedMs=${Math.round(performance.now() - fetchStarted)} aborted=${Boolean(signal?.aborted)} error=${String(error)}`,
        traceId,
      )
      throw error
    }

    traceHost(
      'http-response',
      `model=${request.modelId} status=${response.status} contentType=${response.headers.get('content-type') ?? '-'} elapsedMs=${Math.round(performance.now() - fetchStarted)}`,
      traceId,
    )

    if (response.status === 404) {
      traceHost('model-not-found', `model=${request.modelId}`, traceId)
      throw new Error(
        `Foundry Local could not find model "${request.modelId}". Load it first with: foundry model load <model-alias>`,
      )
    }

    try {
      await assertOk(response, 'Foundry Local chat completion')
    } catch (error) {
      traceHost(
        'http-error',
        `model=${request.modelId} status=${response.status} error=${String(error)}`,
        traceId,
      )
      throw error
    }

    if (!response.body) {
      traceHost('stream-missing', `model=${request.modelId}`, traceId)
      throw new Error('Foundry Local returned no response stream.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let outputChars = 0
    let firstTokenLogged = false

    traceHost(
      'stream-open',
      `model=${request.modelId} elapsedMs=${Math.round(performance.now() - started)}`,
      traceId,
    )

    try {
      while (true) {
        let chunk: ReadableStreamReadResult<Uint8Array>
        try {
          chunk = await reader.read()
        } catch (error) {
          traceHost(
            'stream-read-failed',
            `model=${request.modelId} elapsedMs=${Math.round(performance.now() - started)} aborted=${Boolean(signal?.aborted)} outputChars=${outputChars} error=${String(error)}`,
            traceId,
          )
          throw error
        }

        const { done, value } = chunk

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
            traceHost(
              'stream-done',
              `model=${request.modelId} elapsedMs=${Math.round(performance.now() - started)} outputChars=${outputChars}`,
              traceId,
            )
            yield { text: '', done: true }
            return
          }

          const parsed = JSON.parse(data) as StreamDelta
          const delta = parsed.choices?.[0]?.delta
          const text = delta?.content ?? ''
          const toolCallDeltas = delta?.tool_calls?.map((call) => ({
            index: call.index,
            id: call.id,
            name: call.function?.name,
            arguments: call.function?.arguments,
          }))
          const usage = parsed.usage
            ? {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              }
            : undefined

          if (text && !firstTokenLogged) {
            firstTokenLogged = true
            traceHost(
              'first-token',
              `model=${request.modelId} elapsedMs=${Math.round(performance.now() - started)}`,
              traceId,
            )
          }

          outputChars += text.length
          if (text || usage || toolCallDeltas?.length) {
            yield { text, usage, toolCallDeltas }
          }
        }

        if (done) break
      }

      traceHost(
        'stream-eof',
        `model=${request.modelId} elapsedMs=${Math.round(performance.now() - started)} outputChars=${outputChars}`,
        traceId,
      )
      yield { text: '', done: true }
    } finally {
      reader.releaseLock()
    }
  }
}
