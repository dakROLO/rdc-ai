import type { NativeSpeechBridge } from '../speech/SpeechInputProvider.ts'
import type {
  ChatMessageInput,
  TokenUsage,
  ToolExecutionActivity,
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

export interface NativeToolDefinition {
  id: string
  name: string
  description: string
}

export interface NativeWebStatus {
  nativeAvailable: boolean
  provider: 'duckduckgo'
  searchAvailable: boolean
  readAvailable: boolean
  detail: string
}

export interface NativeWebSearchResult {
  title: string
  url: string
  snippet: string
  score?: number
  publishedAt?: string
}

export interface NativeWebBridge {
  getStatus(): Promise<NativeWebStatus>
  search(query: string, maxResults: number): Promise<{ results: NativeWebSearchResult[] }>
  read(url: string): Promise<{ url: string; title?: string; content: string }>
}

export interface NativeChatRequest {
  modelId: string
  messages: ChatMessageInput[]
  webAccess?: 'off' | 'on'
  tools?: NativeToolDefinition[]
}

export interface NativeChatChunk {
  promptSnapshot?: { instructions: string; prompt: string }
  text: string
  done?: boolean
  usage?: TokenUsage
  toolActivities?: ToolExecutionActivity[]
}

export interface NativeAIHost {
  readonly images?: {
    status(): Promise<{ ocrAvailable: boolean; generationAvailable: boolean }>
    recognize(dataUrl: string): Promise<string>
    generate(prompt: string): Promise<string>
  }

  readonly speech?: NativeSpeechBridge
  readonly web?: NativeWebBridge
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
