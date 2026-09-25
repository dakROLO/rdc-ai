import type {
  AIModel,
  AIProvider,
  ChatChunk,
  ChatRequest,
  ProviderAvailability,
} from './AIProvider.ts'

const MODEL: AIModel = {
  id: 'mock-local-v1',
  displayName: 'Anne · Mock Local',
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
  readonly id = 'mock-local'
  readonly displayName = 'Anne · Mock Local'
  readonly location = 'local' as const

  async getAvailability(): Promise<ProviderAvailability> {
    return { available: true, detail: "Anne's development local provider is ready." }
  }

  async listModels(): Promise<AIModel[]> {
    return [MODEL]
  }

  async *streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk> {
    const prompt = request.messages.at(-1)?.content ?? ''
    const response =
      `Yes — CrownKeep's local provider contract is working. You said: "${prompt}". ` +
      'This conversation is staying on this device while the real Foundry Local provider is built.'

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
