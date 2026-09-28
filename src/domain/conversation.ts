export type MessageRole = 'system' | 'user' | 'assistant'
export type InferenceLocation = 'local' | 'cloud'
export type SyncState = 'local-only' | 'pending' | 'synced' | 'conflict'

export interface MessageToolSource {
  url: string
  title?: string
}

export interface MessageToolActivity {
  toolId: string
  label: string
  requiresNetwork: boolean
  dataLeftDevice: boolean
  sources: MessageToolSource[]
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  syncState: SyncState
  syncVersion: number
  projectId?: string
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
  /**
   * Monotonic position within a conversation. Assigned by the local repository.
   * Optional on newly-created in-memory messages until they are persisted.
   */
  sequence?: number
  providerId?: string
  modelId?: string
  inferenceLocation?: InferenceLocation
  /** Visible evidence of read-only tool/network use for this response. */
  toolActivity?: MessageToolActivity[]
  /**
   * When true, the message remains visible in local history but is omitted from
   * future inference requests until the user restores it.
   */
  excludedFromContext?: boolean
}
