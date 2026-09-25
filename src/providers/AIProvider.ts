import type { InferenceLocation, MessageRole } from '../domain/conversation.ts'

export interface ProviderAvailability {
  available: boolean
  detail?: string
}

export interface AIModel {
  id: string
  displayName: string
  contextWindow?: number
}

export interface ChatMessageInput {
  role: MessageRole
  content: string
}

export interface ChatRequest {
  modelId: string
  messages: ChatMessageInput[]
  context?: unknown
}

export interface ChatChunk {
  text: string
  done?: boolean
}

export interface AIProvider {
  readonly id: string
  readonly displayName: string
  readonly location: InferenceLocation

  getAvailability(): Promise<ProviderAvailability>
  listModels(): Promise<AIModel[]>
  streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk>
}
