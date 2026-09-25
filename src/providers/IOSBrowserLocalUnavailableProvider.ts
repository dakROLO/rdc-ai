import type {
  AIModel,
  AIProvider,
  ChatChunk,
  ChatRequest,
  ProviderAvailability,
} from './AIProvider.ts'

export class IOSBrowserLocalUnavailableProvider implements AIProvider {
  readonly id = 'ios-browser-local-unavailable'
  readonly displayName = 'Anne · iPhone Local'
  readonly location = 'local' as const

  async getAvailability(): Promise<ProviderAvailability> {
    return {
      available: false,
      detail:
        'Apple on-device AI is not exposed to CrownKeep through Safari/PWA. Install or run the native CrownKeep iPhone host to use Anne locally on the phone.',
    }
  }

  async listModels(): Promise<AIModel[]> {
    return []
  }

  async *streamChat(
    _request: ChatRequest,
    _signal?: AbortSignal,
  ): AsyncIterable<ChatChunk> {
    throw new Error(
      'Native Apple on-device AI is unavailable in the browser-only iPhone host.',
    )
  }
}
