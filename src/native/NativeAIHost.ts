import type {
  ChatMessageInput,
  TokenUsage,
} from '../providers/AIProvider.ts'

export type NativeModelUnavailableReason =
  | 'device-not-eligible'
  | 'apple-intelligence-not-enabled'
  | 'model-not-ready'
  | 'unsupported-os'
  | 'unknown'

export interface NativeModelAvailability {
  available: boolean
  reason?: NativeModelUnavailableReason
  detail?: string
}

export interface NativeModelDescriptor {
  id: string
  displayName: string
  contextWindow?: number
}

export interface NativeChatRequest {
  modelId: string
  messages: ChatMessageInput[]
}

export interface NativeChatChunk {
  text: string
  done?: boolean
  usage?: TokenUsage
}

export interface NativeAIHost {
  readonly platform: 'ios'
  readonly provider: 'apple-foundation-models'

  getAvailability(): Promise<NativeModelAvailability>
  listModels(): Promise<NativeModelDescriptor[]>
  streamChat(
    request: NativeChatRequest,
    onChunk: (chunk: NativeChatChunk) => void,
    onError: (message: string) => void,
    onComplete: () => void,
  ): Promise<{ cancel(): Promise<void> | void }>
}

declare global {
  interface Window {
    crownKeepNativeAI?: NativeAIHost
  }
}

export function getNativeAIHost(): NativeAIHost | undefined {
  return window.crownKeepNativeAI
}
