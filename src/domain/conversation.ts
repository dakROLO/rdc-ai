export type MessageRole = 'system' | 'user' | 'assistant'
export type InferenceLocation = 'local' | 'cloud'
export type SyncState = 'local-only' | 'pending' | 'synced' | 'conflict'

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  syncState: SyncState
  syncVersion: number
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
  providerId?: string
  modelId?: string
  inferenceLocation?: InferenceLocation
}
