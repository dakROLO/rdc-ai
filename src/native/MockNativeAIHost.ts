import type {
  NativeAIHost,
  NativeChatChunk,
  NativeChatRequest,
  NativeModelAvailability,
  NativeModelDescriptor,
} from './NativeAIHost.ts'

export type MockNativeAIState =
  | 'available'
  | 'device-not-eligible'
  | 'apple-intelligence-not-enabled'
  | 'model-not-ready'

const model: NativeModelDescriptor = {
  id: 'apple-system-language-model',
  displayName: 'Apple On-Device Model',
  contextWindow: 4096,
}

function availabilityFor(
  state: MockNativeAIState,
): NativeModelAvailability {
  switch (state) {
    case 'available':
      return {
        available: true,
        detail: 'Mock Apple on-device Foundation Model is ready.',
      }
    case 'device-not-eligible':
      return {
        available: false,
        reason: 'device-not-eligible',
        detail: 'Mock device is not eligible for Apple Intelligence.',
      }
    case 'apple-intelligence-not-enabled':
      return {
        available: false,
        reason: 'apple-intelligence-not-enabled',
        detail: 'Mock Apple Intelligence is disabled.',
      }
    case 'model-not-ready':
      return {
        available: false,
        reason: 'model-not-ready',
        detail: 'Mock Apple on-device model is not ready yet.',
      }
  }
}

export function createMockNativeAIHost(
  state: MockNativeAIState = 'available',
): NativeAIHost {
  return {
    platform: 'ios',
    provider: 'apple-foundation-models',

    async getAvailability() {
      return availabilityFor(state)
    },

    async listModels() {
      return state === 'available' ? [model] : []
    },

    async streamChat(
      request: NativeChatRequest,
      onChunk: (chunk: NativeChatChunk) => void,
      onError: (message: string) => void,
      onComplete: () => void,
    ) {
      let cancelled = false
      let timer: number | undefined

      const latestUserMessage = [...request.messages]
        .reverse()
        .find((message) => message.role === 'user')?.content

      const response =
        latestUserMessage?.trim()
          ? `Mock iPhone-local Anne received: ${latestUserMessage.trim()}`
          : 'Mock iPhone-local Anne is ready.'

      if (state !== 'available') {
        queueMicrotask(() => {
          onError(availabilityFor(state).detail ?? 'Mock native AI unavailable.')
        })
      } else {
        timer = window.setTimeout(() => {
          if (cancelled) return
          onChunk({
            text: response,
            usage: {
              promptTokens: request.messages.length * 12,
              completionTokens: Math.max(1, Math.round(response.length / 4)),
            },
          })
          onComplete()
        }, 250)
      }

      return {
        async cancel() {
          cancelled = true
          if (timer !== undefined) window.clearTimeout(timer)
        },
      }
    },
  }
}

export function installMockNativeAIHostFromQuery(): boolean {
  if (!import.meta.env.DEV) return false

  const params = new URLSearchParams(window.location.search)
  if (params.get('nativeAI') !== 'mock') return false

  const requestedState = params.get('nativeAIState')
  const allowedStates: MockNativeAIState[] = [
    'available',
    'device-not-eligible',
    'apple-intelligence-not-enabled',
    'model-not-ready',
  ]

  const state = allowedStates.includes(requestedState as MockNativeAIState)
    ? (requestedState as MockNativeAIState)
    : 'available'

  window.crownKeepNativeAI = createMockNativeAIHost(state)
  return true
}
