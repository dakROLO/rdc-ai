import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { Conversation, Message } from './domain/conversation.ts'
import { MockProvider } from './providers/MockProvider.ts'
import { IndexedDbConversationRepository } from './storage/IndexedDbConversationRepository.ts'
import { createId } from './utils/id.ts'

const provider = new MockProvider()
const repository = new IndexedDbConversationRepository()
const DEFAULT_TITLE = 'New conversation'

function makeMessage(
  conversationId: string,
  role: Message['role'],
  content: string,
): Message {
  return {
    id: createId('message'),
    conversationId,
    role,
    content,
    createdAt: new Date().toISOString(),
  }
}

function welcomeMessage(conversationId: string): Message {
  return {
    ...makeMessage(
      conversationId,
      'assistant',
      "Welcome to CrownKeep. I'm Anne. This conversation is stored on this device, and I'm using a mock local model while Foundry Local integration is built.",
    ),
    providerId: provider.id,
    modelId: 'mock-local-v1',
    inferenceLocation: 'local',
  }
}

function titleFromMessage(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 44 ? `${compact.slice(0, 44)}…` : compact
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const abortController = useRef<AbortController | null>(null)

  const status = useMemo(
    () => (isGenerating ? 'Anne is thinking locally…' : 'Inside the Keep'),
    [isGenerating],
  )

  async function refreshConversations(): Promise<Conversation[]> {
    const next = await repository.list()
    setConversations(next)
    return next
  }

  async function createConversation(): Promise<void> {
    const conversation = await repository.create({ title: DEFAULT_TITLE })
    const welcome = welcomeMessage(conversation.id)
    await repository.saveMessage(welcome)
    await refreshConversations()
    setActiveConversation(conversation)
    setMessages([welcome])
    setPrompt('')
  }

  async function openConversation(conversation: Conversation): Promise<void> {
    if (isGenerating) return
    const nextMessages = await repository.listMessages(conversation.id)
    setActiveConversation(conversation)
    setMessages(nextMessages)
    setPrompt('')
  }

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        const existing = await repository.list()
        if (cancelled) return

        if (existing.length === 0) {
          await createConversation()
          return
        }

        const first = existing[0]
        const firstMessages = await repository.listMessages(first.id)
        if (cancelled) return

        setConversations(existing)
        setActiveConversation(first)
        setMessages(firstMessages)
      } catch (error) {
        if (!cancelled) {
          setStorageError(error instanceof Error ? error.message : 'Local storage failed.')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void initialize()
    return () => {
      cancelled = true
    }
  }, [])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = prompt.trim()
    const conversation = activeConversation
    if (!text || !conversation || isGenerating) return

    const userMessage = makeMessage(conversation.id, 'user', text)
    const assistantMessage: Message = {
      ...makeMessage(conversation.id, 'assistant', ''),
      providerId: provider.id,
      modelId: 'mock-local-v1',
      inferenceLocation: 'local',
    }

    setPrompt('')
    setMessages((current) => [...current, userMessage, assistantMessage])
    setIsGenerating(true)

    await repository.saveMessage(userMessage)

    if (conversation.title === DEFAULT_TITLE) {
      const nextTitle = titleFromMessage(text)
      await repository.rename(conversation.id, nextTitle)
      setActiveConversation({ ...conversation, title: nextTitle })
    }

    const controller = new AbortController()
    abortController.current = controller
    let assistantContent = ''

    try {
      const requestMessages = [...messages, userMessage].map((message) => ({
        role: message.role,
        content: message.content,
      }))

      for await (const chunk of provider.streamChat(
        { modelId: 'mock-local-v1', messages: requestMessages },
        controller.signal,
      )) {
        assistantContent += chunk.text
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: assistantContent }
              : message,
          ),
        )
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        assistantContent = 'Anne hit a local provider error. Check the development console.'
        console.error(error)
      } else if (!assistantContent) {
        assistantContent = 'Generation stopped.'
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: assistantContent }
            : message,
        ),
      )
    } finally {
      await repository.saveMessage({ ...assistantMessage, content: assistantContent })
      await refreshConversations()
      abortController.current = null
      setIsGenerating(false)
    }
  }

  async function renameConversation(conversation: Conversation) {
    if (isGenerating) return
    const value = window.prompt('Rename conversation', conversation.title)?.trim()
    if (!value) return

    await repository.rename(conversation.id, value)
    const next = await refreshConversations()
    const updated = next.find((item) => item.id === conversation.id)
    if (updated && activeConversation?.id === conversation.id) {
      setActiveConversation(updated)
    }
  }

  async function deleteConversation(conversation: Conversation) {
    if (isGenerating || !window.confirm(`Delete "${conversation.title}" from this device?`)) {
      return
    }

    await repository.delete(conversation.id)
    const remaining = await refreshConversations()

    if (activeConversation?.id !== conversation.id) return

    if (remaining.length === 0) {
      await createConversation()
      return
    }

    await openConversation(remaining[0])
  }

  function stopGeneration() {
    abortController.current?.abort()
  }

  if (storageError) {
    return (
      <main className="fatal-state">
        <img src="/crownkeep-mark.svg" alt="" />
        <h1>CrownKeep could not open local storage.</h1>
        <p>{storageError}</p>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <img className="brand-mark" src="/crownkeep-mark.svg" alt="" />
          <div>
            <h1>CrownKeep</h1>
            <p className="muted">Private by default. Powerful by choice.</p>
          </div>
        </div>

        <button
          className="new-chat-button"
          type="button"
          onClick={() => void createConversation()}
          disabled={isLoading || isGenerating}
        >
          + New Chat
        </button>

        <section className="conversation-nav" aria-label="Conversations">
          <p className="nav-heading">Conversations</p>
          {conversations.map((conversation) => (
            <div
              className={`conversation-row ${activeConversation?.id === conversation.id ? 'active' : ''}`}
              key={conversation.id}
            >
              <button
                className="conversation-open"
                type="button"
                onClick={() => void openConversation(conversation)}
                disabled={isGenerating}
                title={conversation.title}
              >
                <span>{conversation.title}</span>
                <small>Stored locally</small>
              </button>
              <div className="conversation-actions">
                <button
                  type="button"
                  onClick={() => void renameConversation(conversation)}
                  disabled={isGenerating}
                  title="Rename"
                  aria-label={`Rename ${conversation.title}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => void deleteConversation(conversation)}
                  disabled={isGenerating}
                  title="Delete"
                  aria-label={`Delete ${conversation.title}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </section>

        <div className="boundary-card">
          <strong>Inside the Keep</strong>
          <span>Conversations are stored on this device.</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Anne · Local assistant</p>
            <h2>{activeConversation?.title ?? 'Opening CrownKeep…'}</h2>
          </div>
          <div className="provider-pill" title={status}>
            <span className="status-dot" />
            {status}
          </div>
        </header>

        <section className="conversation" aria-live="polite">
          {isLoading ? (
            <p className="loading-copy">Opening your local Keep…</p>
          ) : (
            messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-meta">
                  <strong>{message.role === 'user' ? 'You' : 'Anne'}</strong>
                  {message.role === 'assistant' && <span>◆ Local</span>}
                </div>
                <p>{message.content || '…'}</p>
              </article>
            ))
          )}
        </section>

        <section className="composer-wrap">
          <div className="cloud-row">
            <button className="secondary-button cloud-button" type="button" disabled title="Scheduled for a later phase">
              Open to Cloud
            </button>
            <span>{activeConversation?.syncState === 'local-only' ? 'Stored on this device' : status}</span>
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <textarea
              aria-label="Message Anne"
              placeholder="Message Anne…"
              rows={3}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={!activeConversation || isLoading}
            />
            <div className="composer-actions">
              {isGenerating ? (
                <button className="secondary-button" type="button" onClick={stopGeneration}>
                  Stop
                </button>
              ) : null}
              <button
                className="primary-button"
                type="submit"
                disabled={!prompt.trim() || isGenerating || !activeConversation}
              >
                Send
              </button>
            </div>
          </form>

          <p className="privacy-note">
            Anne is running through CrownKeep's local mock provider. No cloud service or RDC data is connected.
          </p>
        </section>
      </main>
    </div>
  )
}
