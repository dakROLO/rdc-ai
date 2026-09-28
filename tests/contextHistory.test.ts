import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeInferenceHistory } from '../src/assistant/contextHistory.ts'
import type { Message } from '../src/domain/conversation.ts'

function message(role: Message['role'], content: string): Message {
  return {
    id: `${role}-${content}`,
    conversationId: 'c1',
    role,
    content,
    createdAt: '2026-09-27T00:00:00Z',
  }
}

test('drops UI-only leading assistant greetings before the first user turn', () => {
  const history = normalizeInferenceHistory([
    message('assistant', 'Welcome to CrownKeep.'),
    message('user', 'Hello'),
    message('assistant', 'Hi'),
    message('user', 'Continue'),
  ])
  assert.deepEqual(history.map((item) => item.role), ['user', 'assistant', 'user'])
  assert.equal(history[0].content, 'Hello')
})

test('preserves already valid user-first history', () => {
  const input = [message('user', 'Hello'), message('assistant', 'Hi')]
  assert.deepEqual(normalizeInferenceHistory(input), input)
})
