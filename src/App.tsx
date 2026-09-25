import { type FormEvent, useMemo, useRef, useState } from 'react'
import type { Message } from './domain/conversation.ts'
import { MockProvider } from './providers/MockProvider.ts'

const provider = new MockProvider()
const conversationId = 'foundation-demo'

function createMessage(role: Message['role'], content: string): Message {
  return {
    id: crypto.randomUUID(),
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([
    {
      ...createMessage(
        'assistant',
        'RDC AI foundation is running. This response is from a mock local provider; no RDC data or cloud service is connected.',
      ),
      providerId: provider.id,
      modelId: 'mock-local-v1',
      inferenceLocation: 'local',
    },
  ])
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const abortController = useRef<AbortController | null>(null)

  const status = useMemo(
    () => (isGenerating ? 'Generating locally…' : 'Local provider ready'),
    [isGenerating],
  )

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = prompt.trim()
    if (!text || isGenerating) return

    const userMessage = createMessage('user', text)
    const assistantMessage: Message = {
      ...createMessage('assistant', ''),
      providerId: provider.id,
      modelId: 'mock-local-v1',
      inferenceLocation: 'local',
    }

    setPrompt('')
    setMessages((current) => [...current, userMessage, assistantMessage])
    setIsGenerating(true)

    const controller = new AbortController()
    abortController.current = controller

    try {
      const requestMessages = [...messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }))

      for await (const chunk of provider.streamChat(
        { modelId: 'mock-local-v1', messages: requestMessages },
        controller.signal,
      )) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: message.content + chunk.text }
              : message,
          ),
        )
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: 'Provider error. Check the development console.' }
              : message,
          ),
        )
        console.error(error)
      }
    } finally {
      abortController.current = null
      setIsGenerating(false)
    }
  }

  function stopGeneration() {
    abortController.current?.abort()
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-mark">RDC</div>
          <div>
            <h1>RDC AI</h1>
            <p className="muted">Local-first foundation</p>
          </div>
        </div>

        <nav aria-label="Primary">
          <button className="nav-button active" type="button">New Chat</button>
          <button className="nav-button" type="button" disabled>Conversations</button>
          <button className="nav-button" type="button" disabled>Settings</button>
        </nav>

        <div className="boundary-card">
          <strong>RDC data</strong>
          <span>Disconnected by design</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Foundation conversation</p>
            <h2>Local Chat</h2>
          </div>
          <div className="provider-pill" title={status}>
            <span className="status-dot" />
            ⚡ Mock Local
          </div>
        </header>

        <section className="conversation" aria-live="polite">
          {messages.map((message) => (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-meta">
                <strong>{message.role === 'user' ? 'You' : 'RDC AI'}</strong>
                {message.role === 'assistant' && <span>⚡ Local</span>}
              </div>
              <p>{message.content || '…'}</p>
            </article>
          ))}
        </section>

        <section className="composer-wrap">
          <div className="cloud-row">
            <button className="secondary-button" type="button" disabled title="Scheduled for Phase 6">
              ☁ Take to Cloud
            </button>
            <span>{status}</span>
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <textarea
              aria-label="Message"
              placeholder="Message RDC AI…"
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="composer-actions">
              {isGenerating ? (
                <button className="secondary-button" type="button" onClick={stopGeneration}>
                  Stop
                </button>
              ) : null}
              <button className="primary-button" type="submit" disabled={!prompt.trim() || isGenerating}>
                Send
              </button>
            </div>
          </form>

          <p className="privacy-note">
            Foundation build: local mock inference only. No RDC customer data, sync,
            authentication, or cloud AI is connected.
          </p>
        </section>
      </main>
    </div>
  )
}
