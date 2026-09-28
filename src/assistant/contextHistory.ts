import type { Message } from '../domain/conversation.ts'

/**
 * Normal conversation history for local chat templates.
 * UI-only leading assistant greetings must not become the first inference turn;
 * several local chat templates require the first conversational turn to be user.
 */
export function normalizeInferenceHistory(messages: Message[]): Message[] {
  let firstConversational = 0
  while (
    firstConversational < messages.length &&
    messages[firstConversational].role === 'assistant'
  ) {
    firstConversational += 1
  }
  return messages.slice(firstConversational)
}
