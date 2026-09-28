import test from 'node:test'
import assert from 'node:assert/strict'
import type { Message } from '../src/domain/conversation.ts'
import {
  buildRetainedToolContext,
  composeCurrentUserWithRetainedEvidence,
} from '../src/assistant/toolContext.ts'

test('retained web evidence becomes explicit current-turn conversation evidence', () => {
  const messages: Message[] = [
    {
      id: 'assistant-1',
      conversationId: 'conversation-1',
      role: 'assistant',
      content: 'Earlier answer.',
      createdAt: '2026-09-28T12:00:00.000Z',
      toolActivity: [
        {
          toolId: 'web-search',
          label: 'Web Search',
          requiresNetwork: true,
          dataLeftDevice: true,
          outcome: 'success',
          sources: [
            {
              title: 'Node.js 24.11.0 (LTS)',
              url: 'https://nodejs.org/example',
            },
          ],
          retainedContext:
            '[1] Node.js 24.11.0 (LTS)\nhttps://nodejs.org/example\nCurrent LTS release.',
        },
      ],
    },
  ]

  const retained = buildRetainedToolContext(messages)
  assert.match(retained, /Node\.js 24\.11\.0/)
  assert.match(retained, /https:\/\/nodejs\.org\/example/)

  const prompt = composeCurrentUserWithRetainedEvidence(
    'What version did you verify earlier?',
    retained,
  )

  assert.match(prompt, /local conversation evidence/i)
  assert.match(prompt, /Node\.js 24\.11\.0/)
  assert.match(prompt, /Web Access is OFF/i)
  assert.match(prompt, /Current user request:/)
  assert.match(prompt, /What version did you verify earlier\?/)
})

test('source-only legacy web activity is still retained', () => {
  const messages: Message[] = [
    {
      id: 'assistant-legacy',
      conversationId: 'conversation-1',
      role: 'assistant',
      content: 'Legacy answer.',
      createdAt: '2026-09-28T12:00:00.000Z',
      toolActivity: [
        {
          toolId: 'web-search',
          label: 'Web Search',
          requiresNetwork: true,
          dataLeftDevice: true,
          sources: [
            {
              title: 'Official release page',
              url: 'https://example.com/releases',
            },
          ],
        },
      ],
    },
  ]

  const retained = buildRetainedToolContext(messages)
  assert.match(retained, /Full result text was not retained/)
  assert.match(retained, /Official release page/)
})

test('no retained evidence leaves the user prompt untouched', () => {
  const prompt = 'Explain local-first AI.'
  assert.equal(composeCurrentUserWithRetainedEvidence(prompt, ''), prompt)
})
