import { useEffect, useRef } from 'react'
import { ANNE_SYSTEM_PROMPT } from '../assistant/anne.ts'
import type { ChatMessageInput } from '../providers/AIProvider.ts'

export interface RequestSnapshot {
  providerId: string
  modelId: string
  createdAt: string
  messages: ChatMessageInput[]
  omittedMessages: number
  nativePrompt?: { instructions: string; prompt: string }
}

export function PromptInspector({ snapshot, onClose }: {
  snapshot: RequestSnapshot | null
  onClose(): void
}) {
  const close = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    close.current?.focus()
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => { document.removeEventListener('keydown', key); previous?.focus() }
  }, [onClose])
  return <div className="roadmap-modal" onClick={onClose}>
    <section className="roadmap-modal-panel prompt-inspector" role="dialog" aria-modal="true" aria-label="Prompt and context" onClick={(event) => event.stopPropagation()}>
      <div className="roadmap-modal-header"><h2>Prompt and context</h2><button ref={close} type="button" onClick={onClose}>Close</button></div>
      <p>Build: {import.meta.env.VITE_CROWNKEEP_BUILD_ID ?? 'development'}</p>
      <p>These are CrownKeep’s app instructions and the last request from this session. Provider-owned internal instructions are not visible here. This view stays on this device.</p>
      <details open><summary>Base system prompt</summary><pre>{ANNE_SYSTEM_PROMPT}</pre></details>
      {snapshot ? <>
        <p>{snapshot.providerId} · {snapshot.modelId} · {new Date(snapshot.createdAt).toLocaleString()} · {snapshot.omittedMessages} older messages omitted to fit the request</p>
        <details open><summary>Assembled system prompt</summary><pre>{snapshot.messages.filter((item) => item.role === 'system').map((item) => item.content).join('\n\n')}</pre></details>
        <details><summary>Included conversation and evidence</summary>{snapshot.messages.filter((item) => item.role !== 'system').map((item, index) => <div key={index}><strong>{item.role}</strong><pre>{item.content}</pre></div>)}</details>
        {snapshot.nativePrompt && <details><summary>Exact Apple host instructions and flattened prompt</summary><pre>{snapshot.nativePrompt.instructions}</pre><pre>{snapshot.nativePrompt.prompt}</pre></details>}
      </> : <p>Send a message to inspect an assembled request. Opening this view does not call a model.</p>}
    </section>
  </div>
}
