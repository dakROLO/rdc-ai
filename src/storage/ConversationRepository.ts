import type { Conversation, Message } from '../domain/conversation.ts'

export interface CreateConversationInput {
  title?: string
}

export interface ConversationRepository {
  create(input?: CreateConversationInput): Promise<Conversation>
  get(id: string): Promise<Conversation | undefined>
  list(): Promise<Conversation[]>
  rename(id: string, title: string): Promise<void>
  delete(id: string): Promise<void>
  saveMessage(message: Message): Promise<void>
  listMessages(conversationId: string): Promise<Message[]>
}
