import test from 'node:test'
import assert from 'node:assert/strict'
import { budgetRequestMessages } from '../src/assistant/requestBudget.ts'

test('context budget preserves instructions and current request while dropping oldest history', () => {
  const input = [{ role: 'system' as const, content: 'rules' }, { role: 'user' as const, content: 'old question' }, { role: 'assistant' as const, content: 'old answer' }, { role: 'user' as const, content: 'new' }, { role: 'assistant' as const, content: 'reply' }, { role: 'user' as const, content: 'current' }]
  const result = budgetRequestMessages(input, 20)
  assert.equal(result.messages[0].content, 'rules')
  assert.equal(result.messages[1].content, 'new')
  assert.equal(result.messages.at(-1)?.content, 'current')
  assert.equal(result.omittedMessages, 2)
  assert.deepEqual(input[1].content, 'old question')
})
test('budget does not include an orphan assistant or silently truncate the current message', () => {
  const result = budgetRequestMessages([{ role: 'system', content: 'rules' }, { role: 'user', content: 'long question' }, { role: 'assistant', content: 'a' }, { role: 'user', content: 'now' }], 10)
  assert.equal(result.messages.length, 2)
  assert.throws(() => budgetRequestMessages([{ role: 'system', content: 'rules' }, { role: 'user', content: 'too long' }], 4), /too large/)
})
