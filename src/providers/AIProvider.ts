import type { InferenceLocation, MessageRole } from '../domain/conversation.ts'

export interface ProviderAvailability {
  available: boolean
  detail?: string
}

export type ModelRuntimeDevice = 'CPU' | 'GPU' | 'NPU'

export interface AIModel {
  id: string
  displayName: string
  contextWindow?: number
  runtimeDevice?: ModelRuntimeDevice
  variantId?: string
}

export interface ChatToolCall {
  id: string
  name: string
  arguments: string
}

export interface ToolExecutionActivity {
  toolId: string
  label: string
  requiresNetwork: boolean
  dataLeftDevice: boolean
  outcome?: 'success' | 'error'
  sources: Array<{ url: string; title?: string }>
  retainedContext?: string
}

export interface ChatToolCallDelta {
  index: number
  id?: string
  name?: string
  arguments?: string
}

export interface ChatToolDefinition {
  id: string
  functionName: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ChatMessageInput {
  role: MessageRole | 'tool'
  content: string
  name?: string
  toolCallId?: string
  toolCalls?: ChatToolCall[]
}

export interface ChatRequest {
  modelId: string
  messages: ChatMessageInput[]
  maxTokens?: number
  context?: unknown
  traceId?: string
  tools?: ChatToolDefinition[]
  toolChoice?: 'auto' | 'none'
}

export interface TokenUsage {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export interface ChatChunk {
  text: string
  done?: boolean
  usage?: TokenUsage
  toolCallDeltas?: ChatToolCallDelta[]
  toolActivities?: ToolExecutionActivity[]
}

export interface AIProvider {
  readonly id: string
  readonly displayName: string
  readonly location: InferenceLocation

  getAvailability(): Promise<ProviderAvailability>
  listModels(): Promise<AIModel[]>
  /**
   * Optional local capability probe. Implementations must not infer support from
   * a model name; return true/false only from an observed provider response.
   */
  probeToolCalling?(
    modelId: string,
    signal?: AbortSignal,
  ): Promise<boolean | undefined>
  streamChat(request: ChatRequest, signal?: AbortSignal): AsyncIterable<ChatChunk>
}
