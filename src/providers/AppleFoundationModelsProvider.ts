import type {
  AIModel,
  AIProvider,
  ChatChunk,
  ChatRequest,
  ProviderAvailability,
} from './AIProvider.ts'
import {
  getNativeAIHost,
  type NativeAIHost,
} from '../native/NativeAIHost.ts'

interface PendingChunk {
  value?: ChatChunk
  done?: boolean
  error?: Error
}

export class AppleFoundationModelsProvider implements AIProvider {
  readonly id = 'apple-foundation-models'
  readonly displayName = 'Anne · Apple On-Device'
  readonly location = 'local' as const

  constructor(private readonly host: NativeAIHost = getNativeAIHost() as NativeAIHost) {
    if (!host) {
      throw new Error('Apple on-device AI host is not available.')
    }
  }

  async getAvailability(): Promise<ProviderAvailability> {
    const availability = await this.host.getAvailability()

    return {
      available: availability.available,
      detail:
        availability.detail ??
        (availability.available
          ? 'Apple on-device Foundation Model is ready.'
          : this.describeUnavailableReason(availability.reason)),
    }
  }

  async listModels(): Promise<AIModel[]> {
    const models = await this.host.listModels()

    return models.map((model) => ({
      id: model.id,
      displayName: model.displayName,
      contextWindow: model.contextWindow,
      runtimeDevice: 'NPU',
      variantId: model.id,
    }))
  }

  async *streamChat(
    request: ChatRequest,
    signal?: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    const queue: PendingChunk[] = []
    let resume: (() => void) | undefined
    let completed = false

    const wake = () => {
      resume?.()
      resume = undefined
    }

    const handle = await this.host.streamChat(
      {
        modelId: request.modelId,
        messages: request.messages,
      },
      (chunk) => {
        queue.push({
          value: {
            text: chunk.text,
            done: chunk.done,
            usage: chunk.usage,
          },
        })
        wake()
      },
      (message) => {
        queue.push({ error: new Error(message) })
        completed = true
        wake()
      },
      () => {
        queue.push({ done: true })
        completed = true
        wake()
      },
    )

    const abort = () => {
      void handle.cancel()
      completed = true
      wake()
    }

    signal?.addEventListener('abort', abort, { once: true })

    try {
      while (!completed || queue.length > 0) {
        if (signal?.aborted) {
          throw new DOMException('Generation aborted.', 'AbortError')
        }

        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resume = resolve
          })
          continue
        }

        const next = queue.shift()
        if (!next) continue
        if (next.error) throw next.error
        if (next.done) break
        if (next.value) yield next.value
      }
    } finally {
      signal?.removeEventListener('abort', abort)
    }
  }

  private describeUnavailableReason(reason?: string): string {
    switch (reason) {
      case 'device-not-eligible':
        return 'This iPhone does not support the Apple on-device Foundation Model.'
      case 'apple-intelligence-not-enabled':
        return 'Apple Intelligence must be enabled before Anne can use the on-device model.'
      case 'model-not-ready':
        return 'The Apple on-device model is not ready yet.'
      case 'unsupported-os':
        return 'This iOS version does not support CrownKeep Apple on-device AI.'
      default:
        return 'Apple on-device AI is currently unavailable.'
    }
  }
}

export function createAppleFoundationModelsProviderIfAvailable():
  | AppleFoundationModelsProvider
  | undefined {
  const host = getNativeAIHost()
  return host ? new AppleFoundationModelsProvider(host) : undefined
}
