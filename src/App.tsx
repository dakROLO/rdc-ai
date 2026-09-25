import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ANNE_SYSTEM_PROMPT } from './assistant/anne.ts'
import type { Conversation, Message } from './domain/conversation.ts'
import type { AIModel, ProviderAvailability } from './providers/AIProvider.ts'
import { FoundryLocalProvider } from './providers/FoundryLocalProvider.ts'
import { MockProvider } from './providers/MockProvider.ts'
import { ProviderRegistry } from './providers/ProviderRegistry.ts'
import { IndexedDbConversationRepository } from './storage/IndexedDbConversationRepository.ts'
import { createId } from './utils/id.ts'

const primaryProvider = new MockProvider()
const developmentAlternateProvider = new MockProvider({
  id: 'mock-local-alternate',
  displayName: 'Anne · Alternate Local',
  modelId: 'mock-local-alternate-v1',
  modelDisplayName: 'Alternate Mock Model',
  responseLabel: 'alternate local development provider',
})
const foundryLocalProvider = new FoundryLocalProvider()

const providerRegistry = new ProviderRegistry(
  import.meta.env.DEV
    ? [primaryProvider, developmentAlternateProvider, foundryLocalProvider]
    : [primaryProvider, foundryLocalProvider],
)

const repository = new IndexedDbConversationRepository()
const DEFAULT_TITLE = 'New conversation'
const PROVIDER_STORAGE_KEY = 'crownkeep.providerId'

function modelStorageKey(providerId: string): string {
  return `crownkeep.modelId.${providerId}`
}

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
      "Welcome to CrownKeep. I'm Anne. This conversation is stored on this device. You can change local providers or models without changing the conversation.",
    ),
    providerId: primaryProvider.id,
    modelId: 'mock-local-v1',
    inferenceLocation: 'local',
  }
}

function titleFromMessage(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 44 ? `${compact.slice(0, 44)}…` : compact
}

export default function App() {
  const providers = useMemo(() => providerRegistry.list(), [])
  const defaultProviderId = providers[0]?.id ?? primaryProvider.id

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState(() => {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY)
    return stored && providerRegistry.get(stored) ? stored : defaultProviderId
  })
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [providerAvailability, setProviderAvailability] =
    useState<ProviderAvailability | null>(null)
  const abortController = useRef<AbortController | null>(null)
  const conversationScrollRef = useRef<HTMLElement | null>(null)
  const nearBottomRef = useRef(true)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [responseFinishedAway, setResponseFinishedAway] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)

  const selectedProvider =
    providerRegistry.get(selectedProviderId) ?? providerRegistry.require(defaultProviderId)

  const status = useMemo(() => {
    if (providerAvailability && !providerAvailability.available) {
      return 'Local provider unavailable'
    }

    return isGenerating ? 'Anne is thinking locally…' : 'Inside the Keep'
  }, [isGenerating, providerAvailability])

  function updateScrollState() {
    const element = conversationScrollRef.current
    if (!element) return

    const nearBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 96

    nearBottomRef.current = nearBottom
    setIsNearBottom(nearBottom)

    if (nearBottom) {
      setResponseFinishedAway(false)
    }
  }

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    const element = conversationScrollRef.current
    if (!element) return

    element.scrollTo({
      top: element.scrollHeight,
      behavior,
    })

    nearBottomRef.current = true
    setIsNearBottom(true)
    setResponseFinishedAway(false)
  }

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

  useEffect(() => {
    if (!nearBottomRef.current) return

    const frame = window.requestAnimationFrame(() => {
      scrollToBottom(isGenerating ? 'auto' : 'smooth')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [messages, isGenerating])

  useEffect(() => {
    let cancelled = false
    const provider = providerRegistry.require(selectedProviderId)

    localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProviderId)
    setProviderAvailability(null)

    async function loadProviderState() {
      const [availability, availableModels] = await Promise.all([
        provider.getAvailability(),
        provider.listModels(),
      ])

      if (cancelled) return

      setProviderAvailability(availability)
      setModels(availableModels)

      const storedModel = localStorage.getItem(modelStorageKey(provider.id))
      const nextModel =
        availableModels.find((model) => model.id === storedModel)?.id ??
        availableModels[0]?.id ??
        ''

      setSelectedModelId(nextModel)
    }

    void loadProviderState().catch((error: unknown) => {
      if (cancelled) return

      setModels([])
      setSelectedModelId('')
      setProviderAvailability({
        available: false,
        detail: error instanceof Error ? error.message : 'Provider initialization failed.',
      })
    })

    return () => {
      cancelled = true
    }
  }, [selectedProviderId])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = prompt.trim()
    const conversation = activeConversation
    const provider = providerRegistry.require(selectedProviderId)

    if (
      !text ||
      !conversation ||
      !selectedModelId ||
      isGenerating ||
      providerAvailability?.available === false
    ) {
      return
    }

    const userMessage = makeMessage(conversation.id, 'user', text)
    const assistantMessage: Message = {
      ...makeMessage(conversation.id, 'assistant', ''),
      providerId: provider.id,
      modelId: selectedModelId,
      inferenceLocation: provider.location,
    }

    setPrompt('')
    setMessages((current) => [...current, userMessage, assistantMessage])
    setIsGenerating(true)
    setResponseFinishedAway(false)

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
      const requestMessages = [
        { role: 'system' as const, content: ANNE_SYSTEM_PROMPT },
        ...[...messages, userMessage].map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ]

      for await (const chunk of provider.streamChat(
        { modelId: selectedModelId, messages: requestMessages },
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

      if (nearBottomRef.current) {
        window.requestAnimationFrame(() => scrollToBottom('smooth'))
      } else {
        setResponseFinishedAway(true)
      }
    }
  }

  function handleComposerKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === 'Enter' &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  function handleProviderChange(providerId: string) {
    if (isGenerating || providerId === selectedProviderId) return
    setSelectedProviderId(providerId)
  }

  function handleModelChange(modelId: string) {
    if (isGenerating) return
    setSelectedModelId(modelId)
    localStorage.setItem(modelStorageKey(selectedProviderId), modelId)
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

        <button
          className="roadmap-button"
          type="button"
          onClick={() => setShowRoadmap(true)}
        >
          <span>◆</span>
          Build Roadmap
        </button>

        <div className="boundary-card">
          <strong>Inside the Keep</strong>
          <span>Conversations are stored on this device.</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div className="conversation-title">
            <p className="eyebrow">Anne · Local assistant</p>
            <h2>{activeConversation?.title ?? 'Opening CrownKeep…'}</h2>
          </div>

          <div className="provider-area">
            <div className="provider-selectors">
              <label>
                <span>Provider</span>
                <select
                  value={selectedProviderId}
                  onChange={(event) => handleProviderChange(event.target.value)}
                  disabled={isGenerating}
                >
                  {providers.map((provider) => (
                    <option value={provider.id} key={provider.id}>
                      {provider.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Model</span>
                <select
                  value={selectedModelId}
                  onChange={(event) => handleModelChange(event.target.value)}
                  disabled={isGenerating || models.length === 0}
                >
                  {models.map((model) => (
                    <option value={model.id} key={model.id}>
                      {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="provider-pill" title={providerAvailability?.detail ?? status}>
              <span className="status-dot" />
              {status}
            </div>

            {selectedProviderId === 'foundry-local' && (
              <p className="provider-help">
                {providerAvailability?.available === false
                  ? 'Foundry Local is not reachable through a supported /v1 or legacy API.'
                  : models.length === 0
                    ? 'Foundry Local is reachable. Load a model with: foundry model load phi-4-mini'
                    : 'Foundry Local is ready for Anne.'}
              </p>
            )}
          </div>
        </header>

        <section
          className="conversation"
          aria-live="polite"
          ref={conversationScrollRef}
          onScroll={updateScrollState}
        >
          {isLoading ? (
            <p className="loading-copy">Opening your local Keep…</p>
          ) : (
            messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="message-meta">
                  <strong>{message.role === 'user' ? 'You' : 'Anne'}</strong>
                  {message.role === 'assistant' && (
                    <span title={`${message.providerId ?? 'unknown'} · ${message.modelId ?? 'unknown'}`}>
                      ◆ {message.inferenceLocation === 'cloud' ? 'Cloud' : 'Local'}
                    </span>
                  )}
                </div>
                <p>{message.content || '…'}</p>
              </article>
            ))
          )}
          {!isNearBottom && (
            <button
              className={`scroll-latest-button ${responseFinishedAway ? 'finished' : ''}`}
              type="button"
              onClick={() => scrollToBottom()}
            >
              {responseFinishedAway ? '↓ Anne finished' : '↓ Latest'}
            </button>
          )}
        </section>

        <section className="composer-wrap">
          <div className="cloud-row">
            <button
              className="secondary-button cloud-button"
              type="button"
              disabled
              title="Scheduled for a later phase"
            >
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
              onKeyDown={handleComposerKeyDown}
              disabled={!activeConversation || isLoading}
            />
            <div className="composer-footer">
              <span>Enter to send · Shift+Enter for a new line</span>
              <div className="composer-actions">
                {isGenerating ? (
                  <button className="secondary-button" type="button" onClick={stopGeneration}>
                    Stop
                  </button>
                ) : null}
                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    !prompt.trim() ||
                    isGenerating ||
                    !activeConversation ||
                    !selectedModelId ||
                    providerAvailability?.available === false
                  }
                >
                  Send
                </button>
              </div>
            </div>
          </form>

          <p className="privacy-note">
            Anne is using {selectedProvider.displayName}. Provider/model choices can change without changing this conversation.
          </p>
        </section>
      </main>

      {showRoadmap && (
        <div
          className="roadmap-modal"
          role="dialog"
          aria-modal="true"
          aria-label="CrownKeep sprint roadmap"
          onClick={() => setShowRoadmap(false)}
        >
          <div className="roadmap-modal-panel" onClick={(event) => event.stopPropagation()}>
            <div className="roadmap-modal-header">
              <div>
                <p className="eyebrow">CrownKeep build plan</p>
                <h2>Sprint Roadmap</h2>
              </div>
              <button
                type="button"
                className="roadmap-close"
                onClick={() => setShowRoadmap(false)}
                aria-label="Close roadmap"
              >
                ×
              </button>
            </div>
            <img
              className="roadmap-image"
              src="/crownkeep-sprints.svg"
              alt="CrownKeep sprint roadmap showing completed, active, next, and planned phases"
            />
            <p className="roadmap-note">
              The visual is shared with the repository README. Detailed sprint definitions remain in docs/ROADMAP.md.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
