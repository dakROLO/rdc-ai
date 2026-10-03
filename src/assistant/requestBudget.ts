import type { ChatMessageInput } from '../providers/AIProvider.ts'

/** Keep the current request intact, then retain the newest history that fits.
 * Character budgets are conservative product limits, not token estimates.
 */
export function budgetRequestMessages(messages: ChatMessageInput[], maxChars: number): {
  messages: ChatMessageInput[]; omittedMessages: number
} {
  const systems = messages.filter((item) => item.role === 'system')
  const history = messages.filter((item) => item.role !== 'system')
  const current = history.at(-1)
  if (!current) return { messages: systems, omittedMessages: 0 }
  let remaining = maxChars - systems.reduce((n, item) => n + item.content.length, 0) - current.content.length
  if (remaining < 0) throw new Error('This request is too large for the local context budget. Shorten the message or start a new chat.')
  const selected: ChatMessageInput[] = []
  for (let i = history.length - 2; i >= 0; i -= 1) {
    const item = history[i]
    if (item.content.length > remaining) break
    selected.unshift(item)
    remaining -= item.content.length
  }
  // A retained suffix must begin with a user, never an orphan assistant turn.
  while (selected.length && selected[0].role !== 'user') selected.shift()
  return { messages: [...systems, ...selected, current], omittedMessages: history.length - selected.length - 1 }
}
