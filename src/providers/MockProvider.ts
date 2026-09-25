import type {
  AIModel,
  AIProvider,
  ChatChunk,
  ChatRequest,
  ProviderAvailability,
} from './AIProvider.ts'

export interface MockProviderOptions {
  id?: string
  displayName?: string
  modelId?: string
  modelDisplayName?: string
  responseLabel?: string
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Generation stopped.', 'AbortError'))
      return
    }

    const timer = window.setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timer)
        reject(new DOMException('Generation stopped.', 'AbortError'))
      },
      { once: true },
    )
  })
}

export class MockProvider implements AIProvider {
  readonly id: string
  readonly displayName: string
  readonly location = 'local' as const

  private readonly model: AIModel
  private readonly responseLabel: string

  constructor(options: MockProviderOptions = {}) {
    this.id = options.id ?? 'mock-local'
    this.displayName = options.displayName ?? 'Anne · Mock Local'
    this.model = {
      id: options.modelId ?? 'mock-local-v1',
      displayName: options.modelDisplayName ?? 'Anne · Mock Local',
    }
    this.responseLabel = options.responseLabel ?? 'local development provider'
  }

  async getAvailability(): Promise<ProviderAvailability> {
    return { available: true, detail: `${this.displayName} is ready.` }
  }

  async listModels(): Promise<AIModel[]> {
    return [this.model]
  }

  async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    const prompt = request.messages.at(-1)?.content ?? ''
    const response =
      `Yes — CrownKeep's ${this.responseLabel} is working. You said: "${prompt}". ` +
      'This conversation stays intact even when Anne changes providers or models.'

    const words = response.split(' ')
    for (const [index, word] of words.entries()) {
      await delay(35, signal)
      yield {
        text: index === words.length - 1 ? word : `${word} `,
        done: index === words.length - 1,
      }
    }
  }
}
