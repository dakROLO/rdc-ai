import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ModelAnalyst } from './runtime/ModelAnalyst.tsx'
import { bestObserved, bestObservedForRole, PROFILE_KEY, readPreferred, readResults, roleOf, taskOf } from './runtime/modelPolicy.ts'
import type { DeviceProfile, ModelRole } from './runtime/modelPolicy.ts'
import { DictationControl } from './speech/DictationControl.tsx'
import {
  type DragEvent as ReactDragEvent,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ANNE_SYSTEM_PROMPT } from './assistant/anne.ts'
import type { Conversation, Message } from './domain/conversation.ts'
import type { Project } from './domain/project.ts'
import type {
  AIModel,
  ProviderAvailability,
  TokenUsage,
} from './providers/AIProvider.ts'
import {
  createAppleFoundationModelsProviderIfAvailable,
} from './providers/AppleFoundationModelsProvider.ts'
import { installMockNativeAIHostFromQuery } from './native/MockNativeAIHost.ts'
import { FoundryLocalProvider } from './providers/FoundryLocalProvider.ts'
import { IOSBrowserLocalUnavailableProvider } from './providers/IOSBrowserLocalUnavailableProvider.ts'
import { MockProvider } from './providers/MockProvider.ts'
import { ProviderRegistry } from './providers/ProviderRegistry.ts'
import { getMobileCapabilitySnapshot } from './mobile/MobileCapability.ts'
import { localRuntimeManager } from './runtime/runtimeManager.ts'
import type {
  RuntimeModelCandidate,
  RuntimeSnapshot,
} from './runtime/LocalRuntimeManager.ts'
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

installMockNativeAIHostFromQuery()

const appleFoundationModelsProvider =
  createAppleFoundationModelsProviderIfAvailable()
const mobileCapability = getMobileCapabilitySnapshot()
const iosBrowserUnavailableProvider = mobileCapability.isIOS
  ? new IOSBrowserLocalUnavailableProvider()
  : undefined

const developmentProviders = [
  primaryProvider,
  developmentAlternateProvider,
  foundryLocalProvider,
  ...(appleFoundationModelsProvider ? [appleFoundationModelsProvider] : []),
  ...(iosBrowserUnavailableProvider ? [iosBrowserUnavailableProvider] : []),
]

const productionProviders = appleFoundationModelsProvider
  ? [appleFoundationModelsProvider]
  : iosBrowserUnavailableProvider
    ? [iosBrowserUnavailableProvider]
    : [foundryLocalProvider]

const providerRegistry = new ProviderRegistry(
  import.meta.env.DEV ? developmentProviders : productionProviders,
)

const repository = new IndexedDbConversationRepository()
const DEFAULT_TITLE = 'New conversation'
const PROVIDER_STORAGE_KEY = 'crownkeep.providerId'
const SIDEBAR_STORAGE_KEY = 'crownkeep.sidebarCollapsed'
const LOCAL_AI_SETUP_STORAGE_KEY = 'crownkeep.localAiSetup'
const DEFAULT_WINDOWS_MODEL_ALIAS = 'phi-4-mini'
const PREFERRED_WINDOWS_MODEL_KEY = 'crownkeep.preferredWindowsModel'
const IDLE_UNLOAD_MINUTES_KEY = 'crownkeep.idleUnloadMinutes'

type ChatModelRole = Extract<ModelRole, 'Quick' | 'Balanced' | 'Deep / Experimental'>

const CHAT_ROLE_ALIASES: Record<ChatModelRole, string> = {
  Quick: 'phi-4-mini',
  Balanced: 'mistral-nemo-12b-instruct',
  'Deep / Experimental': 'gpt-oss-20b',
}

const CHAT_ROLE_LABELS: Record<ChatModelRole, string> = {
  Quick: 'Quick',
  Balanced: 'Balanced',
  'Deep / Experimental': 'Deep',
}

interface FoundryOperationProgress {
  stage: string
  message: string
  modelId?: string
  alias?: string
  percent?: number
}

interface LocalAiSetupRecord {
  providerId: string
  modelId: string
  validatedAt: string
  firstTokenMs?: number
  totalMs: number
  completionTokens?: number
  healthy: boolean
}

type RunOutcome = 'running' | 'complete' | 'stopped' | 'error'

interface InferenceRunStats {
  providerId: string
  modelId: string
  runtimeDevice?: AIModel['runtimeDevice']
  startedAt: string
  firstTokenMs?: number
  totalMs?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  outputChars: number
  outcome: RunOutcome
}

function formatDuration(value?: number): string {
  if (value === undefined) return '—'
  if (value < 1000) return `${Math.round(value)} ms`
  return `${(value / 1000).toFixed(value < 10_000 ? 2 : 1)} s`
}

function formatTokenRate(run: InferenceRunStats | null): string {
  if (!run?.completionTokens || !run.totalMs || run.totalMs <= 0) return '—'
  return `${(run.completionTokens / (run.totalMs / 1000)).toFixed(1)} tok/s`
}

function hasTemporalIntent(value: string): boolean {
  return /\b(today|date|time|timestamp|when|recent|recently|earlier|ago|minute|minutes|hour|hours|yesterday|tomorrow|last\s+(?:few|\d+|minute|minutes|hour|hours|day|days|week|weeks)|this\s+(?:morning|afternoon|evening|week)|how\s+long)\b/i.test(
    value,
  )
}

function formatTemporalContextTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function buildTemporalContext(
  conversation: Conversation,
  contextMessages: Message[],
  currentPrompt: string,
): string {
  const now = new Date()
  const timeZone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Device local time zone'
  const localNow = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'full',
    timeStyle: 'long',
  }).format(now)

  const lines = [
    'CrownKeep time context. Use this metadata for reasoning; do not repeat it unless the user asks for timing details.',
    `Current local date/time: ${localNow}`,
    `Time zone: ${timeZone}`,
    `Conversation started: ${formatTemporalContextTime(conversation.createdAt)}`,
  ]

  if (hasTemporalIntent(currentPrompt)) {
    lines.push('Relevant conversation timeline:')
    contextMessages.forEach((message, index) => {
      lines.push(
        `#${index + 1} ${message.role} — ${formatTemporalContextTime(message.createdAt)}`,
      )
    })
  }

  return lines.join('\n')
}

function formatMessageTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function cleanTemporalArtifact(value: string): string {
  let cleaned = value.replace(
    /^\s*\[Message timestamp:\s*[^\]]+\]\s*/i,
    '',
  )

  const lines = cleaned.split(/\r?\n/)
  let index = 0
  let sawTemporalBlock = false
  while (index < lines.length) {
    const line = lines[index].trim()
    const temporalLine =
      /^CrownKeep time context\./i.test(line) ||
      /^Current local date\/time:/i.test(line) ||
      /^Time zone:/i.test(line) ||
      /^Conversation started:/i.test(line) ||
      /^Relevant conversation timeline:/i.test(line) ||
      /^#\d+\s+(assistant|user)\s+—/i.test(line)

    if (temporalLine) {
      sawTemporalBlock = true
      index += 1
      continue
    }

    if (sawTemporalBlock && line === '') {
      index += 1
      continue
    }

    break
  }

  if (sawTemporalBlock) cleaned = lines.slice(index).join('\n').trimStart()
  return cleaned
}

function modelStorageKey(providerId: string): string {
  return `crownkeep.modelId.${providerId}`
}

function readLocalAiSetupRecord(): LocalAiSetupRecord | null {
  try {
    const raw = localStorage.getItem(LOCAL_AI_SETUP_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as LocalAiSetupRecord
  } catch {
    return null
  }
}

function saveLocalAiSetupRecord(record: LocalAiSetupRecord): void {
  localStorage.setItem(LOCAL_AI_SETUP_STORAGE_KEY, JSON.stringify(record))
}

interface MessageContentSegment {
  type: 'text' | 'code'
  content: string
  language?: string
}

function parseMessageContent(value: string): MessageContentSegment[] {
  const normalized = cleanTemporalArtifact(value)
  const segments: MessageContentSegment[] = []
  const fence = /```([^\n`]*)\n([\s\S]*?)```/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = fence.exec(normalized)) !== null) {
    if (match.index > cursor) {
      segments.push({
        type: 'text',
        content: normalized.slice(cursor, match.index),
      })
    }

    segments.push({
      type: 'code',
      language: match[1].trim() || undefined,
      content: match[2].replace(/\n$/, ''),
    })
    cursor = fence.lastIndex
  }

  if (cursor < normalized.length) {
    segments.push({
      type: 'text',
      content: normalized.slice(cursor),
    })
  }

  return segments.length > 0 ? segments : [{ type: 'text', content: normalized }]
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
  return makeMessage(
    conversationId,
    'assistant',
    "Welcome to CrownKeep. I'm Anne. This conversation is stored on this device. You can change local providers or models without changing the conversation.",
  )
}

function titleFromMessage(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 44 ? `${compact.slice(0, 44)}…` : compact
}

export default function App() {
  const providers = useMemo(() => providerRegistry.list(), [])
  const defaultProviderId = appleFoundationModelsProvider?.id ?? providers[0]?.id ?? primaryProvider.id

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [projectFilter, setProjectFilter] = useState('all')
  const [dragProjectTarget, setDragProjectTarget] = useState<string | null>(null)
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [speechBusy, setSpeechBusy] = useState(false)
  const [fingerprint, setFingerprint] = useState<string>()
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [selectedProviderId, setSelectedProviderId] = useState(() => {
    const stored = localStorage.getItem(PROVIDER_STORAGE_KEY)
    return appleFoundationModelsProvider?.id ?? (stored && providerRegistry.get(stored) ? stored : defaultProviderId)
  })
  const [models, setModels] = useState<AIModel[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [providerAvailability, setProviderAvailability] =
    useState<ProviderAvailability | null>(null)
  const abortController = useRef<AbortController | null>(null)
  const composerFormRef = useRef<HTMLFormElement | null>(null)
  const pendingRerunRef = useRef<string | null>(null)
  const conversationScrollRef = useRef<HTMLElement | null>(null)
  const nearBottomRef = useRef(true)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const [responseFinishedAway, setResponseFinishedAway] = useState(false)
  const [showRoadmap, setShowRoadmap] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true',
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [lastRun, setLastRun] = useState<InferenceRunStats | null>(null)
  const [runtimeSnapshot, setRuntimeSnapshot] = useState<RuntimeSnapshot | null>(null)
  const [providerRefreshNonce, setProviderRefreshNonce] = useState(0)
  const [isRuntimeCheckRunning, setIsRuntimeCheckRunning] = useState(false)
  const [runtimeCheckError, setRuntimeCheckError] = useState<string | null>(null)
  const [isRuntimeActionRunning, setIsRuntimeActionRunning] = useState(false)
  const [runtimeActionMessage, setRuntimeActionMessage] = useState<string | null>(null)
  const [runtimeOperation, setRuntimeOperation] = useState<FoundryOperationProgress | null>(null)
  const [runtimeSleeping, setRuntimeSleeping] = useState(false)
  const [idleUnloadMinutes, setIdleUnloadMinutes] = useState(() => {
    const stored = Number(localStorage.getItem(IDLE_UNLOAD_MINUTES_KEY) ?? '15')
    return [0, 5, 15, 30, 60].includes(stored) ? stored : 15
  })
  const [modelCandidates, setModelCandidates] = useState<RuntimeModelCandidate[]>([])
  const [analystModelId, setAnalystModelId] = useState('')
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null)
  const autoRestoreAttemptedRef = useRef(false)
  const [setupRecord, setSetupRecord] = useState<LocalAiSetupRecord | null>(
    () => readLocalAiSetupRecord(),
  )

  const selectedProvider =
    providerRegistry.get(selectedProviderId) ?? providerRegistry.require(defaultProviderId)
  const selectedModel = models.find((model) => model.id === selectedModelId)
  const setupVerified =
    setupRecord?.providerId === selectedProviderId &&
    setupRecord.modelId === selectedModelId

  const loadedChatCandidate = useMemo(
    () =>
      modelCandidates.find(
        (candidate) => candidate.loaded && taskOf(candidate) === 'chat',
      ),
    [modelCandidates],
  )
  const activeChatRole = loadedChatCandidate
    ? (roleOf(loadedChatCandidate) as ChatModelRole)
    : undefined

  const measuredRoleWinners = useMemo(() => {
    const results = readResults(localStorage)
    const winnerFor = (role: ChatModelRole) =>
      fingerprint
        ? bestObservedForRole(results, fingerprint, role, modelCandidates)
        : undefined

    return {
      Quick: winnerFor('Quick'),
      Balanced: winnerFor('Balanced'),
      'Deep / Experimental': winnerFor('Deep / Experimental'),
    }
  }, [fingerprint, providerRefreshNonce, modelCandidates])

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  )
  const activeProject = activeConversation?.projectId
    ? projectById.get(activeConversation.projectId)
    : undefined
  const selectedFilterProject =
    projectFilter !== 'all' && projectFilter !== 'unassigned'
      ? projectById.get(projectFilter)
      : undefined
  const visibleConversations = useMemo(() => {
    if (projectFilter === 'all') return conversations
    if (projectFilter === 'unassigned') {
      return conversations.filter((conversation) => !conversation.projectId)
    }
    return conversations.filter(
      (conversation) => conversation.projectId === projectFilter,
    )
  }, [conversations, projectFilter])

  const status = useMemo(() => {
    if (runtimeSleeping) return 'Local AI sleeping · click to wake'
    if (speechBusy) return 'Local dictation active'
    if (isRuntimeActionRunning) return 'Working with local AI…'
    if (!providerAvailability) return 'Checking local AI…'
    if (!providerAvailability.available) return 'Local provider unavailable'
    return isGenerating ? 'Anne is thinking locally…' : 'Inside the Keep'
  }, [
    speechBusy,
    isGenerating,
    isRuntimeActionRunning,
    providerAvailability,
    runtimeSleeping,
  ])

  const performanceGuidance = useMemo(() => {
    if (!lastRun || lastRun.outcome === 'running') return null
    if (lastRun.outcome === 'error') {
      return 'The last local request failed. Check provider health and the selected model.'
    }
    if (lastRun.outcome === 'stopped') return 'The last generation was stopped.'

    const totalMs = lastRun.totalMs ?? 0
    const firstTokenMs = lastRun.firstTokenMs ?? 0
    const rate =
      lastRun.completionTokens && totalMs > 0
        ? lastRun.completionTokens / (totalMs / 1000)
        : undefined

    if (lastRun.runtimeDevice === 'GPU' && totalMs > 15_000) {
      return 'This GPU-labeled variant is performing slowly. On virtual Windows hosts, a CPU variant may be faster.'
    }
    if (
      (lastRun.promptTokens ?? 0) >= 750 &&
      firstTokenMs > 5_000
    ) {
      return `Active context is large (${lastRun.promptTokens} prompt tokens). Exclude older messages from Context to reduce first-token latency.`
    }
    if (firstTokenMs > 8_000) {
      return 'Local startup is slow. A smaller model or different runtime variant may feel more responsive.'
    }
    if (rate !== undefined && rate < 2) {
      return 'Observed generation speed is low. Try a smaller model or a different runtime variant.'
    }
    return 'Observed local inference looks healthy.'
  }, [lastRun])

  const setupRecommendation = useMemo(() => {
    if (!setupVerified || !setupRecord) return null
    if (setupRecord.healthy) return 'Local AI setup is verified on this model.'
    if (selectedModel?.runtimeDevice === 'GPU') {
      return 'This GPU-labeled variant tested slowly. Compare a CPU variant on this machine.'
    }
    return 'This model is working but feels slow. A smaller model may improve responsiveness.'
  }, [setupRecord, setupVerified, selectedModel])

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

  async function refreshProjects(): Promise<Project[]> {
    const next = await repository.listProjects()
    setProjects(next)
    return next
  }

  async function createConversation(): Promise<void> {
    if (speechBusy || isGenerating) return
    const conversation = await repository.create({
      title: DEFAULT_TITLE,
      projectId:
        projectFilter !== 'all' && projectFilter !== 'unassigned'
          ? projectFilter
          : undefined,
    })
    const welcome = welcomeMessage(conversation.id)
    await repository.saveMessage(welcome)
    await refreshConversations()
    setActiveConversation(conversation)
    setMessages([welcome])
    setPrompt('')
    setMobileNavOpen(false)
  }

  async function openConversation(conversation: Conversation): Promise<void> {
    if (isGenerating || speechBusy || isRuntimeActionRunning) return
    const nextMessages = await repository.listMessages(conversation.id)
    setActiveConversation(conversation)
    setMessages(nextMessages)
    setPrompt('')
    setMobileNavOpen(false)
  }

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        const [existing, existingProjects] = await Promise.all([
          repository.list(),
          repository.listProjects(),
        ])
        if (cancelled) return

        setProjects(existingProjects)

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
    setRuntimeSnapshot(null)
    setRuntimeCheckError(null)

    async function loadProviderState() {
      const availability = await provider.getAvailability()
      if (cancelled) return

      let availableModels: AIModel[] = []
      if (availability.available) {
        availableModels = await provider.listModels()
      }

      if (cancelled) return

      setProviderAvailability(availability)
      setModels(availableModels)

      const nativeLoaded = localRuntimeManager.mode === 'embedded' && provider.id === 'foundry-local'
        ? (await localRuntimeManager.listModelCandidates()).filter((item) => item.loaded && taskOf(item) === 'chat')
        : []
      if (cancelled) return
      const storedModel = localStorage.getItem(modelStorageKey(provider.id))
      const nextModel =
        availableModels.find(
          (model) =>
            model.id === storedModel &&
            nativeLoaded.some(
              (item) =>
                normalizeRuntimeModelKey(item.id) ===
                normalizeRuntimeModelKey(model.id),
            ),
        )?.id ??
        availableModels.find((model) =>
          nativeLoaded.some(
            (item) =>
              normalizeRuntimeModelKey(item.id) ===
              normalizeRuntimeModelKey(model.id),
          ),
        )?.id ??
        availableModels.find((model) => model.id === storedModel)?.id ??
        availableModels[0]?.id ??
        ''

      setSelectedModelId(nextModel)

      const snapshot = await localRuntimeManager.inspect(
        provider,
        availability,
        availableModels,
      )
      if (!cancelled) setRuntimeSnapshot(snapshot)
    }

    void loadProviderState().catch((error: unknown) => {
      if (cancelled) return

      const detail =
        error instanceof Error ? error.message : 'Provider initialization failed.'
      setModels([])
      setSelectedModelId('')
      setProviderAvailability({
        available: false,
        detail,
      })
      setRuntimeSnapshot({
        state: 'unavailable',
        detail,
        models: [],
      })
    })

    return () => {
      cancelled = true
    }
  }, [selectedProviderId, providerRefreshNonce])

  useEffect(() => {
    function handleFocus() {
      if (selectedProviderId === 'foundry-local') {
        setProviderRefreshNonce((current) => current + 1)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [selectedProviderId])

  useEffect(() => {
    if (!fingerprint || modelCandidates.length === 0) return

    const migrationKey = 'crownkeep.fingerprintPolicy5Migrated'
    if (localStorage.getItem(migrationKey) === fingerprint) return

    const results = readResults(localStorage)
    const roles: ChatModelRole[] = [
      'Quick',
      'Balanced',
      'Deep / Experimental',
    ]
    let changed = false
    const next = [...results]

    for (const role of roles) {
      if (bestObservedForRole(next, fingerprint, role, modelCandidates)) {
        continue
      }

      const legacy = results
        .filter((result) => {
          if (
            result.outcome !== 'accepted' ||
            result.firstTokenMs === undefined
          ) {
            return false
          }

          const candidate = modelCandidates.find(
            (item) => item.cached && item.id === result.variantId,
          )
          if (!candidate || taskOf(candidate) !== 'chat') return false
          if (roleOf(candidate) !== role) return false

          return role === 'Quick' || result.realWorldValidated === true
        })
        .sort(
          (a, b) =>
            (a.firstTokenMs! * 2 + a.totalMs) -
            (b.firstTokenMs! * 2 + b.totalMs),
        )[0]

      if (!legacy) continue

      next.push({
        ...legacy,
        fingerprint,
        timestamp: new Date().toISOString(),
        detail: legacy.detail
          ? `${legacy.detail} · migrated to stable fingerprint policy`
          : 'Migrated to stable fingerprint policy.',
      })
      changed = true
    }

    if (changed) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next.slice(-200)))
      setProviderRefreshNonce((current) => current + 1)
    }
    localStorage.setItem(migrationKey, fingerprint)
  }, [fingerprint, modelCandidates])

  useEffect(() => {
    if (
      localRuntimeManager.mode !== 'embedded' ||
      selectedProviderId !== 'foundry-local' ||
      autoRestoreAttemptedRef.current ||
      isRuntimeActionRunning ||
      isGenerating || speechBusy ||
      runtimeSleeping ||
      providerAvailability?.available !== false ||
      fingerprint === undefined ||
      modelCandidates.length === 0
    ) {
      return
    }

    const chatCandidates = modelCandidates.filter((item) => taskOf(item) === 'chat')
    const preferred = preferredNativeModelId()
    const normalizedPreferred = normalizeRuntimeModelKey(preferred)

    const candidate =
      chatCandidates.find(
        (item) =>
          item.cached &&
          (normalizeRuntimeModelKey(item.id) === normalizedPreferred ||
            item.alias.toLocaleLowerCase() === preferred.toLocaleLowerCase()),
      ) ??
      chatCandidates.find(
        (item) =>
          item.cached &&
          item.alias.toLocaleLowerCase() ===
            DEFAULT_WINDOWS_MODEL_ALIAS.toLocaleLowerCase(),
      ) ??
      chatCandidates.find((item) => item.cached)

    if (!candidate) return

    const fallbackCandidate =
      chatCandidates.find(
        (item) =>
          item.cached &&
          item.alias.toLocaleLowerCase() ===
            DEFAULT_WINDOWS_MODEL_ALIAS.toLocaleLowerCase() &&
          item.executionProvider?.toLocaleLowerCase() ===
            'cpuexecutionprovider',
      ) ??
      chatCandidates.find(
        (item) =>
          item.cached &&
          item.executionProvider?.toLocaleLowerCase() ===
            'cpuexecutionprovider',
      )

    autoRestoreAttemptedRef.current = true
    setRuntimeActionMessage(`Restoring ${candidate.alias} from the local cache…`)
    void prepareNativeLocalAi(candidate.id, {
      quiet: true,
      fallbackModelId:
        fallbackCandidate && fallbackCandidate.id !== candidate.id
          ? fallbackCandidate.id
          : undefined,
    })
  }, [
    speechBusy,
    isRuntimeCheckRunning,
    idleUnloadMinutes,
    isGenerating,
    isRuntimeActionRunning,
    modelCandidates,
    fingerprint,
    providerAvailability,
    runtimeSleeping,
    selectedProviderId,
  ])

  useEffect(() => {
    if (
      localRuntimeManager.mode !== 'embedded' ||
      selectedProviderId !== 'foundry-local' ||
      runtimeSleeping ||
      isGenerating || speechBusy || isRuntimeCheckRunning ||
      isRuntimeActionRunning ||
      idleUnloadMinutes <= 0 ||
      providerAvailability?.available !== true ||
      !selectedModelId
    ) {
      return
    }

    const timer = window.setTimeout(() => {
      void releaseNativeLocalAi('idle')
    }, idleUnloadMinutes * 60 * 1000)

    return () => window.clearTimeout(timer)
  }, [
    speechBusy,
    isRuntimeCheckRunning,
    idleUnloadMinutes,
    isGenerating,
    isRuntimeActionRunning,
    providerAvailability,
    runtimeSleeping,
    selectedModelId,
    selectedProviderId,
  ])

  useEffect(() => {
    if (
      localRuntimeManager.mode === 'embedded' &&
      selectedProviderId === 'foundry-local'
    ) {
      void refreshModelAnalyst()
    }
  }, [selectedProviderId, providerRefreshNonce])

  async function refreshFingerprint() {
    try { const value = await invoke<DeviceProfile>('crownkeep_device_profile'); setFingerprint(value.fingerprint) }
    catch { setFingerprint('inspection-unavailable') }
  }
  useEffect(() => {
    if (localRuntimeManager.mode === 'embedded') void refreshFingerprint()
  }, [])

  useEffect(() => {
    if (localRuntimeManager.mode !== 'embedded') return

    const subscription = listen<FoundryOperationProgress>(
      'crownkeep-foundry-operation-progress',
      (event) => {
        setRuntimeOperation(event.payload)
        setRuntimeActionMessage(event.payload.message)
      },
    )

    return () => {
      void subscription.then((unlisten) => unlisten())
    }
  }, [])



  function normalizeRuntimeModelKey(value: string): string {
    return value.split(':')[0].trim().toLocaleLowerCase()
  }

  function normalizedModelForStorage(value: string): string {
    return value.split(':')[0].trim()
  }

  function preferredNativeModelId(): string {
    const quickCandidateFor = (value?: string | null) => {
      if (!value) return undefined
      const normalized = normalizeRuntimeModelKey(value)
      return modelCandidates.find(
        (candidate) =>
          taskOf(candidate) === 'chat' &&
          roleOf(candidate) === 'Quick' &&
          (normalizeRuntimeModelKey(candidate.id) === normalized ||
            candidate.alias.toLocaleLowerCase() === value.toLocaleLowerCase()),
      )
    }

    if (fingerprint) {
      const measuredQuick = bestObserved(
        readResults(localStorage),
        fingerprint,
        DEFAULT_WINDOWS_MODEL_ALIAS,
      )
      if (measuredQuick) {
        const measuredCandidate = quickCandidateFor(measuredQuick.variantId)
        if (measuredCandidate) return measuredCandidate.id
      }
    }

    const observed = readPreferred(localStorage)
    if (observed && observed.fingerprint === fingerprint) {
      const observedCandidate = quickCandidateFor(observed.variantId)
      if (observedCandidate) return observedCandidate.id
    }

    const storedQuick = quickCandidateFor(
      localStorage.getItem(PREFERRED_WINDOWS_MODEL_KEY),
    )
    if (storedQuick) return storedQuick.alias

    const setupQuick = quickCandidateFor(setupRecord?.modelId)
    if (setupQuick) return setupQuick.alias

    return DEFAULT_WINDOWS_MODEL_ALIAS
  }

  async function prepareNativeLocalAi(
    modelId = preferredNativeModelId(),
    options: { quiet?: boolean; fallbackModelId?: string } = {},
  ) {
    if (
      localRuntimeManager.mode !== 'embedded' ||
      isRuntimeActionRunning ||
      isGenerating || speechBusy || isRuntimeCheckRunning
    ) {
      return
    }

    setIsRuntimeActionRunning(true)
    setRuntimeCheckError(null)
    setRuntimeOperation(null)
    setRuntimeSleeping(false)
    if (!options.quiet) {
      setRuntimeActionMessage(
        `Preparing ${modelId}. First setup may download local runtime components and the model.`,
      )
    }

    try {
      const activateResult = await localRuntimeManager.activateModel(modelId)
      if (!options.quiet) setRuntimeActionMessage(activateResult.detail)
      setProviderRefreshNonce((current) => current + 1)
    } catch (error) {
      const primaryError =
        error instanceof Error ? error.message : String(error)

      if (options.fallbackModelId) {
        try {
          setRuntimeActionMessage(
            `Preferred model could not start. Falling back to ${options.fallbackModelId}…`,
          )
          const fallbackResult = await localRuntimeManager.activateModel(
            options.fallbackModelId,
          )
          setRuntimeActionMessage(
            `${fallbackResult.detail} Preferred model remains saved and can be retried after provider recovery.`,
          )
          setProviderRefreshNonce((current) => current + 1)
          return
        } catch (fallbackError) {
          setRuntimeCheckError(
            `Preferred model failed: ${primaryError} Fallback also failed: ${String(fallbackError)}`,
          )
          return
        }
      }

      setRuntimeCheckError(primaryError)
    } finally {
      setIsRuntimeActionRunning(false)
    }
  }

  async function releaseNativeLocalAi(reason: 'manual' | 'idle' = 'manual') {
    if (
      localRuntimeManager.mode !== 'embedded' ||
      isRuntimeActionRunning ||
      isGenerating || speechBusy || isRuntimeCheckRunning
    ) {
      return
    }

    setIsRuntimeActionRunning(true)
    setRuntimeCheckError(null)
    if (reason === 'manual') {
      setRuntimeActionMessage('Stopping CrownKeep local AI…')
    }

    try {
      const stopResult = await localRuntimeManager.stop()
      const loaded = (await localRuntimeManager.listModelCandidates()).filter((item) => item.loaded)
      for (const model of loaded) await localRuntimeManager.unloadModel(model.id)

      setRuntimeSleeping(true)
      setRuntimeActionMessage(
        reason === 'idle'
          ? `Local AI went to sleep after ${idleUnloadMinutes} minutes of inactivity. Click the status above to wake it.`
          : stopResult.detail,
      )
      setProviderRefreshNonce((current) => current + 1)
    } catch (error) {
      setRuntimeCheckError(
        error instanceof Error
          ? error.message
          : 'CrownKeep could not stop local AI.',
      )
    } finally {
      setIsRuntimeActionRunning(false)
    }
  }

  async function useAnalystModel(modelId: string) {
    if (!modelId || isRuntimeActionRunning || isGenerating || speechBusy || isRuntimeCheckRunning) return
    setIsRuntimeActionRunning(true)
    setRuntimeCheckError(null)
    setRuntimeOperation(null)
    setRuntimeActionMessage(`Switching local AI to ${modelId}…`)
    try {
      await localRuntimeManager.activateModel(modelId)
      setSetupRecord(null)
      localStorage.removeItem(LOCAL_AI_SETUP_STORAGE_KEY)
      setRuntimeSleeping(false)
      localStorage.setItem(modelStorageKey(selectedProviderId), normalizedModelForStorage(modelId))
      setRuntimeActionMessage('Model switch complete. Benchmark the family to save it as the measured preference.')
    } catch (error) {
      setRuntimeCheckError(String(error))
    } finally {
      setIsRuntimeActionRunning(false)
      setProviderRefreshNonce((value) => value + 1)
    }
  }

  async function switchModelRole(role: ChatModelRole) {
    if (
      localRuntimeManager.mode !== 'embedded' ||
      selectedProviderId !== 'foundry-local' ||
      isRuntimeActionRunning ||
      isGenerating ||
      speechBusy ||
      isRuntimeCheckRunning
    ) {
      return
    }

    const winner = measuredRoleWinners[role]
    if (!winner) return

    setIsRuntimeActionRunning(true)
    setRuntimeCheckError(null)
    setRuntimeOperation(null)
    setRuntimeActionMessage(
      `Switching to ${CHAT_ROLE_LABELS[role]} · ${winner.alias}…`,
    )

    try {
      await localRuntimeManager.activateModel(winner.variantId)
      setRuntimeSleeping(false)
      setSetupRecord(null)
      localStorage.removeItem(LOCAL_AI_SETUP_STORAGE_KEY)
      localStorage.setItem(
        modelStorageKey(selectedProviderId),
        normalizedModelForStorage(winner.variantId),
      )
      setRuntimeActionMessage(
        `${CHAT_ROLE_LABELS[role]} ready · ${winner.alias} · ${winner.executionProvider ?? winner.device ?? 'Default'}.`,
      )
      setProviderRefreshNonce((current) => current + 1)
      await refreshModelAnalyst()
    } catch (error) {
      setRuntimeCheckError(
        `Could not switch to ${CHAT_ROLE_LABELS[role]}: ${String(error)}`,
      )
    } finally {
      setIsRuntimeActionRunning(false)
    }
  }

  async function refreshModelAnalyst() {
    if (localRuntimeManager.mode !== 'embedded') return
    try {
      const candidates = await localRuntimeManager.listModelCandidates()
      setModelCandidates(candidates)
      const preferred =
        localStorage.getItem(PREFERRED_WINDOWS_MODEL_KEY) ||
        setupRecord?.modelId ||
        candidates.find((candidate) => candidate.cached)?.id ||
        candidates[0]?.id ||
        ''
      setAnalystModelId(
        candidates.some((candidate) => candidate.id === preferred)
          ? preferred
          : candidates[0]?.id ?? '',
      )
    } catch (error) {
      setRuntimeCheckError(
        error instanceof Error ? error.message : 'Could not inspect local models.',
      )
    }
  }

  async function copyCode(content: string, key: string) {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedCodeKey(key)
      window.setTimeout(() => {
        setCopiedCodeKey((current) => (current === key ? null : current))
      }, 1400)
    } catch {
      setRuntimeCheckError('CrownKeep could not copy that code block.')
    }
  }

  function rerunMessage(message: Message) {
    if (
      message.role !== 'user' ||
      !message.content.trim() ||
      isGenerating ||
      speechBusy ||
      isRuntimeActionRunning ||
      isRuntimeCheckRunning ||
      providerAvailability?.available === false
    ) {
      return
    }

    const text = cleanTemporalArtifact(message.content).trim()
    if (!text) return

    pendingRerunRef.current = text
    if (prompt.trim() === text) {
      queueMicrotask(() => {
        if (pendingRerunRef.current !== text) return
        pendingRerunRef.current = null
        composerFormRef.current?.requestSubmit()
      })
      return
    }

    setPrompt(text)
  }

  useEffect(() => {
    const pending = pendingRerunRef.current
    if (!pending || prompt.trim() !== pending) return

    pendingRerunRef.current = null
    composerFormRef.current?.requestSubmit()
  }, [prompt])

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = prompt.trim()
    const conversation = activeConversation
    const provider = providerRegistry.require(selectedProviderId)

    if (
      !text ||
      !conversation ||
      !selectedModelId ||
      isGenerating || speechBusy || isRuntimeActionRunning || isRuntimeCheckRunning ||
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
    const firstTokenWatchdog = new AbortController()
    const totalWatchdog = new AbortController()
    abortController.current = controller
    let assistantContent = ''
    let latestUsage: TokenUsage | undefined
    let firstTokenAt: number | undefined
    let runOutcome: RunOutcome = 'complete'
    let firstTokenTimedOut = false
    let totalTimedOut = false
    const startedAt = performance.now()
    const startedAtIso = new Date().toISOString()
    const firstTokenTimer = window.setTimeout(() => {
      if (firstTokenAt === undefined) {
        firstTokenTimedOut = true
        firstTokenWatchdog.abort()
      }
    }, 20_000)
    const totalTimer = window.setTimeout(() => {
      totalTimedOut = true
      totalWatchdog.abort()
    }, 120_000)
    const generationSignal = AbortSignal.any([
      controller.signal,
      firstTokenWatchdog.signal,
      totalWatchdog.signal,
    ])

    setLastRun({
      providerId: provider.id,
      modelId: selectedModelId,
      runtimeDevice: selectedModel?.runtimeDevice,
      startedAt: startedAtIso,
      outputChars: 0,
      outcome: 'running',
    })

    try {
      const contextMessages = [...messages, userMessage].filter(
        (message) => !message.excludedFromContext && message.content.trim(),
      )
      const requestMessages = [
        { role: 'system' as const, content: ANNE_SYSTEM_PROMPT },
        {
          role: 'system' as const,
          content: buildTemporalContext(conversation, contextMessages, text),
        },
        ...contextMessages.map((message) => ({
          role: message.role,
          content: cleanTemporalArtifact(message.content),
        })),
      ]

      for await (const chunk of provider.streamChat(
        { modelId: selectedModelId, messages: requestMessages },
        generationSignal,
      )) {
        if (chunk.text && firstTokenAt === undefined) {
          firstTokenAt = performance.now()
          window.clearTimeout(firstTokenTimer)
        }
        if (chunk.usage) latestUsage = chunk.usage

        assistantContent += chunk.text
        const now = performance.now()
        setLastRun({
          providerId: provider.id,
          modelId: selectedModelId,
          runtimeDevice: selectedModel?.runtimeDevice,
          startedAt: startedAtIso,
          firstTokenMs:
            firstTokenAt === undefined ? undefined : firstTokenAt - startedAt,
          totalMs: now - startedAt,
          promptTokens: latestUsage?.promptTokens,
          completionTokens: latestUsage?.completionTokens,
          totalTokens: latestUsage?.totalTokens,
          outputChars: assistantContent.length,
          outcome: 'running',
        })
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantMessage.id
              ? { ...message, content: assistantContent }
              : message,
          ),
        )
      }
    } catch (error) {
      const aborted =
        error instanceof DOMException && error.name === 'AbortError'

      if (firstTokenTimedOut || totalTimedOut) {
        runOutcome = 'error'
        assistantContent = firstTokenTimedOut
          ? 'Anne’s local response timed out before it began. CrownKeep is recovering the local model; try again in a moment.'
          : 'Anne’s local response exceeded the safety limit. CrownKeep is recovering the local model; try again in a moment.'

        if (
          localRuntimeManager.mode === 'embedded' &&
          selectedProviderId === 'foundry-local'
        ) {
          const failedCandidate =
            modelCandidates.find(
              (candidate) =>
                normalizeRuntimeModelKey(candidate.id) ===
                normalizeRuntimeModelKey(selectedModelId),
            ) ?? loadedChatCandidate

          if (failedCandidate && fingerprint) {
            const observed = readResults(localStorage)
            const failedResult = {
              fingerprint,
              alias: failedCandidate.alias,
              variantId: failedCandidate.id,
              executionProvider: failedCandidate.executionProvider,
              device: failedCandidate.device,
              cached: failedCandidate.cached,
              supportsToolCalling: failedCandidate.supportsToolCalling,
              timestamp: new Date().toISOString(),
              totalMs: performance.now() - startedAt,
              realWorldValidated: false,
              outcome: 'error' as const,
              detail: firstTokenTimedOut
                ? 'Normal CrownKeep chat timed out before the first token.'
                : 'Normal CrownKeep chat exceeded the total-response safety limit.',
            }
            const next = [
              ...observed.filter(
                (result) =>
                  !(
                    result.fingerprint === fingerprint &&
                    result.variantId === failedCandidate.id
                  ),
              ),
              failedResult,
            ].slice(-200)
            localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
            setProviderRefreshNonce((current) => current + 1)
          }
          const quickRecovery =
            modelCandidates.find(
              (candidate) =>
                candidate.cached &&
                taskOf(candidate) === 'chat' &&
                roleOf(candidate) === 'Quick' &&
                candidate.alias.toLocaleLowerCase() ===
                  DEFAULT_WINDOWS_MODEL_ALIAS.toLocaleLowerCase() &&
                candidate.executionProvider?.toLocaleLowerCase() ===
                  'cpuexecutionprovider',
            ) ??
            modelCandidates.find(
              (candidate) =>
                candidate.cached &&
                taskOf(candidate) === 'chat' &&
                roleOf(candidate) === 'Quick',
            )

          if (quickRecovery) {
            try {
              setRuntimeActionMessage(
                `Local response stalled. Recovering with Quick · ${quickRecovery.alias}…`,
              )
              await Promise.race([
                localRuntimeManager.activateModel(quickRecovery.id),
                new Promise<never>((_, reject) =>
                  window.setTimeout(
                    () => reject(new Error('Quick-model recovery exceeded 20 seconds.')),
                    20_000,
                  ),
                ),
              ])
              localStorage.setItem(
                modelStorageKey(selectedProviderId),
                normalizedModelForStorage(quickRecovery.id),
              )
              setRuntimeActionMessage(
                `Recovered with Quick · ${quickRecovery.alias}. You can retry the message.`,
              )
              setProviderRefreshNonce((current) => current + 1)
            } catch (recoveryError) {
              setRuntimeCheckError(
                `The local response timed out. Automatic Quick recovery did not finish: ${String(recoveryError)} Restart CrownKeep to reset the local runtime.`,
              )
            }
          } else {
            setRuntimeCheckError(
              'The local response timed out and no cached Quick recovery model is available. Restart CrownKeep to reset the local runtime.',
            )
          }
        }
      } else if (!aborted) {
        runOutcome = 'error'
        assistantContent = 'Anne hit a local provider error. Open Local AI diagnostics for details.'
        console.error(error)
      } else {
        runOutcome = 'stopped'
        if (!assistantContent) assistantContent = 'Generation stopped.'
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: assistantContent }
            : message,
        ),
      )
    } finally {
      window.clearTimeout(firstTokenTimer)
      window.clearTimeout(totalTimer)
      assistantContent = cleanTemporalArtifact(assistantContent)
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessage.id
            ? { ...message, content: assistantContent }
            : message,
        ),
      )
      const completedAt = performance.now()
      const totalMs = completedAt - startedAt
      const firstTokenMs =
        firstTokenAt === undefined ? undefined : firstTokenAt - startedAt
      setLastRun({
        providerId: provider.id,
        modelId: selectedModelId,
        runtimeDevice: selectedModel?.runtimeDevice,
        startedAt: startedAtIso,
        firstTokenMs,
        totalMs,
        promptTokens: latestUsage?.promptTokens,
        completionTokens: latestUsage?.completionTokens,
        totalTokens: latestUsage?.totalTokens,
        outputChars: assistantContent.length,
        outcome: runOutcome,
      })

      if (runOutcome === 'complete' && assistantContent.trim()) {
        const healthy =
          totalMs <= 15_000 &&
          (firstTokenMs === undefined || firstTokenMs <= 8_000) &&
          !(selectedModel?.runtimeDevice === 'GPU' && totalMs > 10_000)
        const record: LocalAiSetupRecord = {
          providerId: provider.id,
          modelId: selectedModelId,
          validatedAt: new Date().toISOString(),
          firstTokenMs,
          totalMs,
          completionTokens: latestUsage?.completionTokens,
          healthy,
        }
        saveLocalAiSetupRecord(record)
        setSetupRecord(record)
      }

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
    if (isGenerating || speechBusy || isRuntimeActionRunning || isRuntimeCheckRunning || providerId === selectedProviderId) return
    setSelectedProviderId(providerId)
  }

  function handleModelChange(modelId: string) {
    if (isGenerating || speechBusy || isRuntimeActionRunning || isRuntimeCheckRunning) return
    if (
      localRuntimeManager.mode === 'embedded' &&
      selectedProviderId === 'foundry-local'
    ) {
      void useAnalystModel(modelId)
      return
    }
    setSelectedModelId(modelId)
    localStorage.setItem(modelStorageKey(selectedProviderId), modelId)
  }

  async function createProject() {
    if (isGenerating || speechBusy || isRuntimeActionRunning) return
    const title = window.prompt('Project name')?.trim()
    if (!title) return

    const project = await repository.createProject({ title })
    await refreshProjects()
    setProjectFilter(project.id)
  }

  async function renameProject(project: Project) {
    if (isGenerating || speechBusy || isRuntimeActionRunning) return
    const title = window.prompt('Rename project', project.title)?.trim()
    if (!title) return

    await repository.renameProject(project.id, title)
    await refreshProjects()
  }

  async function deleteProject(project: Project) {
    if (
      isGenerating || speechBusy ||
      !window.confirm(
        `Delete project "${project.title}"? Its conversations will be kept and moved to Unassigned.`,
      )
    ) {
      return
    }

    await repository.deleteProject(project.id)
    await Promise.all([refreshProjects(), refreshConversations()])
    if (projectFilter === project.id) setProjectFilter('unassigned')
  }

  async function assignConversationProject(
    conversation: Conversation,
    projectId?: string,
  ) {
    if (isGenerating || speechBusy || isRuntimeActionRunning) return

    await repository.assignConversationToProject(conversation.id, projectId)
    const next = await refreshConversations()
    const updated = next.find((item) => item.id === conversation.id)

    if (updated && activeConversation?.id === conversation.id) {
      setActiveConversation(updated)
    }
  }

  async function handleProjectDrop(
    event: ReactDragEvent<HTMLElement>,
    projectId?: string,
  ) {
    event.preventDefault()
    const conversationId = event.dataTransfer.getData('text/crownkeep-conversation')
    setDragProjectTarget(null)
    if (!conversationId) return

    const conversation = conversations.find((item) => item.id === conversationId)
    if (!conversation) return

    await assignConversationProject(conversation, projectId)
  }

  async function changeActiveConversationProject(projectId: string) {
    const conversation = activeConversation
    if (!conversation) return
    await assignConversationProject(
      conversation,
      projectId === 'unassigned' ? undefined : projectId,
    )
  }

  async function moveConversationToProject(conversation: Conversation) {
    if (isGenerating || speechBusy || isRuntimeActionRunning) return

    const choices = projects.map((project) => project.title).join('\n')
    const currentProject = conversation.projectId
      ? projectById.get(conversation.projectId)?.title ?? ''
      : ''

    const value = window.prompt(
      `Move conversation to project. Enter an exact project name, or leave blank for Unassigned.\n\nProjects:\n${choices || '(No projects yet)'}`,
      currentProject,
    )

    if (value === null) return
    const title = value.trim()

    if (!title) {
      await assignConversationProject(conversation)
      return
    }

    const project = projects.find(
      (item) => item.title.toLocaleLowerCase() === title.toLocaleLowerCase(),
    )
    if (!project) {
      window.alert('Project not found. Use one of the listed project names.')
      return
    }

    await assignConversationProject(conversation, project.id)
  }

  async function renameConversation(conversation: Conversation) {
    if (isGenerating || speechBusy || isRuntimeActionRunning) return
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
    if (isGenerating || speechBusy || !window.confirm(`Delete "${conversation.title}" from this device?`)) {
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

  async function runRuntimeQuickCheck() {
    if (
      isGenerating || speechBusy || isRuntimeActionRunning ||
      isRuntimeCheckRunning ||
      !selectedModelId ||
      providerAvailability?.available === false
    ) {
      return
    }

    const provider = providerRegistry.require(selectedProviderId)
    const startedAt = performance.now()
    let firstTokenAt: number | undefined
    let latestUsage: TokenUsage | undefined
    let output = ''

    setIsRuntimeCheckRunning(true)
    setRuntimeCheckError(null)

    try {
      for await (const chunk of provider.streamChat({
        modelId: selectedModelId,
        maxTokens: 48,
        messages: [
          {
            role: 'system',
            content:
              'You are Anne inside CrownKeep. This is a local runtime verification. Respond very briefly.',
          },
          {
            role: 'user',
            content: 'Reply with one short greeting.',
          },
        ],
      }, AbortSignal.timeout(45000))) {
        if (chunk.text && firstTokenAt === undefined) firstTokenAt = performance.now()
        if (chunk.usage) latestUsage = chunk.usage
        output += chunk.text
      }

      const totalMs = performance.now() - startedAt
      const firstTokenMs =
        firstTokenAt === undefined ? undefined : firstTokenAt - startedAt
      const runtimeDevice = selectedModel?.runtimeDevice
      const healthy = output.trim().length > 0 &&
        totalMs <= 15_000 && firstTokenMs !== undefined && firstTokenMs <= 8_000

      const record: LocalAiSetupRecord = {
        providerId: selectedProviderId,
        modelId: selectedModelId,
        validatedAt: new Date().toISOString(),
        firstTokenMs,
        totalMs,
        completionTokens: latestUsage?.completionTokens,
        healthy,
      }

      saveLocalAiSetupRecord(record)
      setSetupRecord(record)

      setLastRun({
        providerId: selectedProviderId,
        modelId: selectedModelId,
        runtimeDevice,
        startedAt: record.validatedAt,
        firstTokenMs,
        totalMs,
        promptTokens: latestUsage?.promptTokens,
        completionTokens: latestUsage?.completionTokens,
        totalTokens: latestUsage?.totalTokens,
        outputChars: output.length,
        outcome: 'complete',
      })
    } catch (error) {
      setRuntimeCheckError(
        error instanceof Error ? error.message : 'Local AI verification failed.',
      )
    } finally {
      setIsRuntimeCheckRunning(false)
      setProviderRefreshNonce((current) => current + 1)
    }
  }

  async function toggleMessageContext(message: Message) {
    if (isGenerating || speechBusy || !message.content.trim()) return

    const excluded = !message.excludedFromContext
    await repository.setMessageContextExcluded(message.id, excluded)
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? { ...item, excludedFromContext: excluded || undefined }
          : item,
      ),
    )
  }

  function stopGeneration() {
    abortController.current?.abort()
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
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
    <div className={`app-shell ${sidebarCollapsed ? 'nav-collapsed' : ''} ${mobileNavOpen ? 'mobile-nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand-row">
          <div className="brand-lockup">
            <img className="brand-mark" src="/crownkeep-mark.svg" alt="" />
            <div>
              <h1>CrownKeep</h1>
              <p className="muted">Private by default. Powerful by choice.</p>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Show conversations' : 'Collapse conversations'}
            aria-label={sidebarCollapsed ? 'Show conversations' : 'Collapse conversations'}
          >
            {sidebarCollapsed ? '›' : '‹'}
          </button>
        </div>

        <button
          className="new-chat-button"
          type="button"
          onClick={() => void createConversation()}
          disabled={isLoading || isGenerating || speechBusy}
          title="New chat"
        >
          <span className="nav-icon">+</span>
          <span className="nav-label">New Chat</span>
        </button>

        <button
          className="mobile-nav-toggle"
          type="button"
          onClick={() => setMobileNavOpen((current) => !current)}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-navigation"
        >
          <span>{mobileNavOpen ? 'Hide' : 'Chats & Projects'}</span>
          <span aria-hidden="true">{mobileNavOpen ? '⌃' : '⌄'}</span>
        </button>

        <section
          id="mobile-navigation"
          className={`project-nav ${mobileNavOpen ? 'mobile-open' : ''}`}
          aria-label="Projects"
        >
          <div className="nav-heading-row">
            <p className="nav-heading">Projects</p>
            <div className="project-heading-actions">
              {selectedFilterProject && (
                <>
                  <button
                    type="button"
                    className="nav-mini-button project-manage-button"
                    onClick={() => void renameProject(selectedFilterProject)}
                    disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                    title="Rename selected project"
                    aria-label="Rename selected project"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="nav-mini-button project-manage-button"
                    onClick={() => void deleteProject(selectedFilterProject)}
                    disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                    title="Delete selected project"
                    aria-label="Delete selected project"
                  >
                    ×
                  </button>
                </>
              )}
              <button
                type="button"
                className="nav-mini-button"
                onClick={() => void createProject()}
                disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                title="New project"
                aria-label="New project"
              >
                +
              </button>
            </div>
          </div>

          <select
            className="project-filter-select"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            aria-label="Project filter"
          >
            <option value="all">All chats ({conversations.length})</option>
            <option value="unassigned">
              Unassigned ({conversations.filter((conversation) => !conversation.projectId).length})
            </option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.title} ({conversations.filter((conversation) => conversation.projectId === project.id).length})
              </option>
            ))}
          </select>

          <button
            className={`project-filter ${projectFilter === 'all' ? 'active' : ''}`}
            type="button"
            onClick={() => setProjectFilter('all')}
          >
            <span>All chats</span>
            <small>{conversations.length}</small>
          </button>

          <button
            className={`project-filter ${projectFilter === 'unassigned' ? 'active' : ''} ${dragProjectTarget === 'unassigned' ? 'drop-target' : ''}`}
            type="button"
            onClick={() => setProjectFilter('unassigned')}
            onDragOver={(event) => {
              event.preventDefault()
              setDragProjectTarget('unassigned')
            }}
            onDragLeave={() => setDragProjectTarget(null)}
            onDrop={(event) => void handleProjectDrop(event)}
          >
            <span>Unassigned</span>
            <small>{conversations.filter((conversation) => !conversation.projectId).length}</small>
          </button>

          {projects.map((project) => (
            <div className="project-row" key={project.id}>
              <button
                className={`project-filter ${projectFilter === project.id ? 'active' : ''} ${dragProjectTarget === project.id ? 'drop-target' : ''}`}
                type="button"
                onClick={() => setProjectFilter(project.id)}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragProjectTarget(project.id)
                }}
                onDragLeave={() => setDragProjectTarget(null)}
                onDrop={(event) => void handleProjectDrop(event, project.id)}
                title={`${project.title} — drop a conversation here to move it`}
              >
                <span>{project.title}</span>
                <small>
                  {conversations.filter((conversation) => conversation.projectId === project.id).length}
                </small>
              </button>
              <div className="project-actions">
                <button
                  type="button"
                  onClick={() => void renameProject(project)}
                  disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                  title="Rename project"
                  aria-label={`Rename ${project.title}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => void deleteProject(project)}
                  disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                  title="Delete project"
                  aria-label={`Delete ${project.title}`}
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </section>

        <section
          className={`conversation-nav ${mobileNavOpen ? 'mobile-open' : ''}`}
          aria-label="Conversations"
        >
          <p className="nav-heading">Conversations</p>
          {visibleConversations.length === 0 && (
            <p className="nav-empty">No conversations here yet.</p>
          )}
          {visibleConversations.map((conversation) => (
            <div
              className={`conversation-row ${activeConversation?.id === conversation.id ? 'active' : ''}`}
              key={conversation.id}
              draggable={!isGenerating && !speechBusy && !isRuntimeActionRunning}
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move'
                event.dataTransfer.setData(
                  'text/crownkeep-conversation',
                  conversation.id,
                )
              }}
              onDragEnd={() => setDragProjectTarget(null)}
            >
              <button
                className="conversation-open"
                type="button"
                onClick={() => void openConversation(conversation)}
                disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                title={conversation.title}
              >
                <span>{conversation.title}</span>
                <small>
                  {conversation.projectId
                    ? projectById.get(conversation.projectId)?.title ?? 'Project'
                    : 'Unassigned'}
                </small>
              </button>
              <div className="conversation-actions">
                <button
                  type="button"
                  onClick={() => void moveConversationToProject(conversation)}
                  disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                  title="Move to project"
                  aria-label={`Move ${conversation.title} to project`}
                >
                  ▣
                </button>
                <button
                  type="button"
                  onClick={() => void renameConversation(conversation)}
                  disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                  title="Rename"
                  aria-label={`Rename ${conversation.title}`}
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => void deleteConversation(conversation)}
                  disabled={isGenerating || speechBusy || isRuntimeActionRunning}
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
          title="Build roadmap"
        >
          <span>◆</span>
          <span className="nav-label">Build Roadmap</span>
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
            {activeConversation && (
              <label className="active-project-control">
                <span>Project</span>
                <select
                  value={activeConversation.projectId ?? 'unassigned'}
                  onChange={(event) =>
                    void changeActiveConversationProject(event.target.value)
                  }
                  disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                  title="Move this conversation to a project"
                >
                  <option value="unassigned">Unassigned</option>
                  {projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
                <small>
                  {activeProject
                    ? `Stored in ${activeProject.title}`
                    : 'Not assigned to a project'}
                </small>
              </label>
            )}
          </div>

          <div className="provider-area">
            <details className="local-ai-menu">
              <summary
                onClick={(event) => {
                  if (runtimeSleeping) {
                    event.preventDefault()
                    void prepareNativeLocalAi(preferredNativeModelId(), { quiet: true })
                  }
                }}
                title={runtimeSleeping ? 'Wake local AI' : undefined}
              >
                <span
                  className={`status-dot ${
                    runtimeSleeping
                      ? 'sleeping'
                      : providerAvailability?.available === false
                        ? 'unavailable'
                        : isGenerating || speechBusy || isRuntimeActionRunning
                          ? 'working'
                          : ''
                  }`}
                />
                <span className="local-ai-summary-copy">
                  <strong>{status}</strong>
                  <small>
                    {selectedProvider.displayName.replace('Anne · ', '')}
                    {selectedModel ? ` · ${selectedModel.displayName}` : ''}
                  </small>
                </span>
                <span className="menu-chevron" aria-hidden="true">⌄</span>
              </summary>

              <div className="local-ai-panel">
                <div className="local-ai-panel-heading">
                  <strong>Inside the Keep</strong>
                  <button
                    type="button"
                    className="local-ai-close-button"
                    onClick={(event) =>
                      event.currentTarget
                        .closest('details.local-ai-menu')
                        ?.removeAttribute('open')
                    }
                  >
                    Close
                  </button>
                </div>

                <div className="provider-selectors">
                  <label>
                    <span>Provider</span>
                    <select
                      value={selectedProviderId}
                      onChange={(event) => handleProviderChange(event.target.value)}
                      disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                    >
                      {providers.map((provider) => (
                        <option value={provider.id} key={provider.id}>
                          {provider.displayName}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Active model</span>
                    <select
                      value={selectedModelId}
                      onChange={(event) => handleModelChange(event.target.value)}
                      disabled={isGenerating || speechBusy || isRuntimeActionRunning || models.length === 0}
                    >
                      {models.map((model) => (
                        <option value={model.id} key={model.id}>
                          {model.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedProviderId === 'foundry-local' &&
                  localRuntimeManager.mode === 'embedded' && (
                    <div className="model-mode-control" aria-label="Measured model mode">
                      <div className="model-mode-copy">
                        <strong>Model mode</strong>
                        <span>Quick starts by default. Balanced and Deep use their measured winners.</span>
                      </div>
                      <div className="model-mode-segments" role="group" aria-label="Model mode">
                        {(['Quick', 'Balanced', 'Deep / Experimental'] as ChatModelRole[]).map((role) => {
                          const winner = measuredRoleWinners[role]
                          const active = activeChatRole === role
                          return (
                            <button
                              type="button"
                              key={role}
                              className={active ? 'active' : ''}
                              aria-pressed={active}
                              disabled={
                                !winner ||
                                isGenerating ||
                                speechBusy ||
                                isRuntimeActionRunning ||
                                isRuntimeCheckRunning
                              }
                              title={
                                winner
                                  ? `${winner.alias} · ${winner.executionProvider ?? winner.device ?? 'Default'}`
                                  : `Benchmark ${CHAT_ROLE_LABELS[role]} first`
                              }
                              onClick={() => void switchModelRole(role)}
                            >
                              {CHAT_ROLE_LABELS[role]}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                <div className="runtime-grid" aria-label="Local AI runtime status">
                  <div>
                    <span>Health</span>
                    <strong>
                      {runtimeSleeping
                        ? 'Sleeping'
                        : providerAvailability?.available === false
                          ? 'Unavailable'
                          : providerAvailability
                            ? 'Ready'
                            : 'Checking'}
                    </strong>
                  </div>
                  <div>
                    <span>Device</span>
                    <strong>{selectedModel?.runtimeDevice ?? 'Auto / unknown'}</strong>
                  </div>
                  <div>
                    <span>Location</span>
                    <strong>{selectedProvider.location === 'local' ? 'Inside the Keep' : 'Cloud'}</strong>
                  </div>
                </div>

                <p className="provider-detail">
                  {providerAvailability?.detail ??
                    'CrownKeep is checking the selected local provider.'}
                </p>

                {selectedProviderId === 'foundry-local' && (
                  <section className="runtime-setup-card" aria-label="Local AI setup">
                    <div className="runtime-setup-heading">
                      <div>
                        <span className="runtime-kicker">Local AI setup</span>
                        <strong>
                          {runtimeSleeping
                            ? 'Sleeping'
                            : runtimeSnapshot?.state === 'ready'
                              ? setupVerified
                              ? 'Verified'
                              : 'Ready to verify'
                            : runtimeSnapshot?.state === 'model-required'
                              ? 'Model needed'
                              : runtimeSnapshot?.state === 'unavailable'
                                ? 'Runtime not reachable'
                                : 'Checking'}
                        </strong>
                      </div>
                      <button
                        type="button"
                        className="runtime-refresh-button"
                        onClick={() => setProviderRefreshNonce((current) => current + 1)}
                        disabled={isGenerating || speechBusy || isRuntimeActionRunning || isRuntimeCheckRunning}
                      >
                        Recheck
                      </button>
                    </div>

                    <div className="runtime-steps">
                      <div className={providerAvailability?.available ? 'done' : ''}>
                        <span>1</span>
                        <p><strong>Runtime</strong><small>{providerAvailability?.available ? 'Connected' : 'Needs attention'}</small></p>
                      </div>
                      <div className={selectedModelId ? 'done' : ''}>
                        <span>2</span>
                        <p><strong>Model</strong><small>{selectedModelId ? 'Selected' : 'Not ready'}</small></p>
                      </div>
                      <div className={setupVerified ? 'done' : ''}>
                        <span>3</span>
                        <p><strong>Verify</strong><small>{setupVerified ? 'Passed' : 'Not tested'}</small></p>
                      </div>
                    </div>

                    {runtimeSnapshot?.state === 'ready' && selectedModelId && !setupVerified && (
                      <button
                        type="button"
                        className="runtime-verify-button"
                        onClick={() => void runRuntimeQuickCheck()}
                        disabled={isGenerating || speechBusy || isRuntimeActionRunning || isRuntimeCheckRunning}
                      >
                        {isRuntimeCheckRunning ? 'Testing local AI…' : 'Verify local AI'}
                      </button>
                    )}

                    {localRuntimeManager.mode === 'embedded' &&
                      localRuntimeManager.capabilities.canStartRuntime && (
                        <div className="runtime-native-actions">
                          {runtimeSleeping ? (
                            <button
                              type="button"
                              className="runtime-native-button"
                              onClick={() =>
                                void prepareNativeLocalAi(preferredNativeModelId(), {
                                  quiet: true,
                                })
                              }
                              disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                            >
                              {isRuntimeActionRunning ? 'Waking local AI…' : 'Wake local AI'}
                            </button>
                          ) : providerAvailability?.available &&
                            runtimeSnapshot?.state === 'ready' ? (
                            <button
                              type="button"
                              className="runtime-native-button secondary"
                              onClick={() => void releaseNativeLocalAi('manual')}
                              disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                            >
                              {isRuntimeActionRunning ? 'Working…' : 'Sleep local AI'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="runtime-native-button"
                              onClick={() => void prepareNativeLocalAi()}
                              disabled={isGenerating || speechBusy || isRuntimeActionRunning}
                            >
                              {isRuntimeActionRunning
                                ? 'Preparing local AI…'
                                : `Prepare ${preferredNativeModelId()}`}
                            </button>
                          )}
                        </div>
                      )}

                    {localRuntimeManager.mode === 'embedded' && (
                      <label className="idle-unload-control">
                        <span>Idle unload</span>
                        <select
                          value={idleUnloadMinutes}
                          onChange={(event) => {
                            const next = Number(event.target.value)
                            setIdleUnloadMinutes(next)
                            localStorage.setItem(IDLE_UNLOAD_MINUTES_KEY, String(next))
                          }}
                          disabled={isRuntimeActionRunning || isGenerating || speechBusy || isRuntimeCheckRunning}
                        >
                          <option value={0}>Never</option>
                          <option value={5}>5 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                          <option value={60}>60 minutes</option>
                        </select>
                      </label>
                    )}

                    {localRuntimeManager.mode === 'embedded' && (
                      <details className="model-analyst">
                        <summary>Local Model Analyst</summary>
                        <ModelAnalyst manager={localRuntimeManager} provider={foundryLocalProvider}
                          candidates={modelCandidates} busy={isRuntimeActionRunning || isGenerating || speechBusy || isRuntimeCheckRunning}
                          setBusy={setIsRuntimeActionRunning} refresh={refreshModelAnalyst}
                          onReady={(ready) => { setRuntimeSleeping(!ready); setProviderRefreshNonce((n) => n + 1); void refreshFingerprint() }}
                          onCatalogChanged={() => { setProviderRefreshNonce((n) => n + 1); void refreshFingerprint() }} />
                        <details className="model-analyst-panel"><summary>Advanced · force a chat variant</summary>
                          <label className="model-analyst-select">
                            <span>Candidate</span>
                            <select
                              value={analystModelId}
                              onChange={(event) => setAnalystModelId(event.target.value)}
                              disabled={isRuntimeActionRunning || modelCandidates.length === 0}
                            >
                              {modelCandidates.filter((item) => taskOf(item) === 'chat').map((candidate) => (
                                <option value={candidate.id} key={candidate.id}>
                                  {candidate.alias} · {candidate.device ?? 'Auto'}
                                  {candidate.cached ? ' · Cached' : ''}
                                </option>
                              ))}
                            </select>
                          </label>

                          {modelCandidates
                            .filter((candidate) => candidate.id === analystModelId)
                            .map((candidate) => (
                              <div className="model-analyst-details" key={candidate.id}>
                                <span><strong>Variant</strong>{candidate.id}</span>
                                <span><strong>Device</strong>{candidate.device ?? 'Auto'}</span>
                                <span><strong>Runtime</strong>{candidate.executionProvider ?? 'Default'}</span>
                                <span><strong>Cache</strong>{candidate.cached ? 'Downloaded' : 'Not downloaded'}</span>
                                <span><strong>Size</strong>{candidate.fileSizeMb ? `${candidate.fileSizeMb} MB` : '—'}</span>
                                <span><strong>Context</strong>{candidate.contextLength ? candidate.contextLength.toLocaleString() : '—'}</span>
                              </div>
                            ))}

                          <button
                            type="button"
                            className="runtime-native-button"
                            onClick={() => void useAnalystModel(analystModelId)}
                            disabled={!analystModelId || isRuntimeActionRunning || isGenerating || speechBusy || isRuntimeCheckRunning}
                          >
                            {isRuntimeActionRunning ? 'Switching model…' : 'Use this model'}
                          </button>
                        </details>
                      </details>
                    )}

                    {runtimeActionMessage && (
                      <p className="runtime-setup-note healthy">
                        {runtimeActionMessage}
                      </p>
                    )}

                    {runtimeOperation?.percent !== undefined && isRuntimeActionRunning && (
                      <div className="runtime-operation-progress" role="status" aria-live="polite">
                        <progress max={100} value={runtimeOperation.percent} />
                        <small>{Math.round(runtimeOperation.percent)}%</small>
                      </div>
                    )}

                    {setupRecommendation && (
                      <p className={`runtime-setup-note ${setupRecord?.healthy ? 'healthy' : 'warning'}`}>
                        {setupRecommendation}
                        {setupRecord
                          ? ` · ${formatDuration(setupRecord.totalMs)} total`
                          : ''}
                      </p>
                    )}

                    {runtimeCheckError && (
                      <p className="runtime-setup-note warning">{runtimeCheckError}</p>
                    )}

                    <p className="runtime-management-note">
                      {localRuntimeManager.mode === 'external-development'
                        ? 'Development mode: CrownKeep can inspect the runtime, but Foundry/model lifecycle is still managed outside the browser. The Windows desktop build will own these steps.'
                        : localRuntimeManager.capabilities.canStartRuntime
                          ? 'CrownKeep manages the Foundry Local runtime and model lifecycle on this device.'
                          : 'Native Windows host connected.'}
                    </p>
                  </section>
                )}

                {selectedProviderId === 'foundry-local' && models.length === 0 && providerAvailability?.available && (
                  <p className="runtime-warning">
                    Foundry Local is reachable, but CrownKeep cannot see a model ready for chat.
                  </p>
                )}

                <details className="diagnostics-disclosure">
                  <summary>Diagnostics</summary>
                  <div className="diagnostics-panel">
                    <div className="diagnostics-heading-row">
                      <strong>Local AI diagnostics</strong>
                      <button
                        type="button"
                        className="diagnostics-close-button"
                        onClick={(event) =>
                          event.currentTarget.closest('details')?.removeAttribute('open')
                        }
                      >
                        Close
                      </button>
                    </div>
                    <div className="diagnostics-grid">
                      <div><span>Last result</span><strong>{lastRun?.outcome ?? 'No run yet'}</strong></div>
                      <div><span>First token</span><strong>{formatDuration(lastRun?.firstTokenMs)}</strong></div>
                      <div><span>Total time</span><strong>{formatDuration(lastRun?.totalMs)}</strong></div>
                      <div><span>Output rate</span><strong>{formatTokenRate(lastRun)}</strong></div>
                      <div><span>Prompt tokens</span><strong>{lastRun?.promptTokens ?? '—'}</strong></div>
                      <div><span>Completion tokens</span><strong>{lastRun?.completionTokens ?? '—'}</strong></div>
                    </div>
                    <p className={`performance-guidance ${
                      performanceGuidance?.includes('slow') ||
                      performanceGuidance?.includes('low') ||
                      performanceGuidance?.includes('failed')
                        ? 'warning'
                        : ''
                    }`}>
                      {performanceGuidance ??
                        'Run a local response to capture first-token time, total time, and token usage.'}
                    </p>
                    {lastRun && (
                      <p className="diagnostic-footnote">
                        {lastRun.modelId}
                        {lastRun.runtimeDevice ? ` · ${lastRun.runtimeDevice}` : ''}
                        {lastRun.totalTokens ? ` · ${lastRun.totalTokens} total tokens` : ''}
                      </p>
                    )}
                  </div>
                </details>
              </div>
            </details>
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
              <article
                className={`message ${message.role} ${message.excludedFromContext ? 'context-excluded' : ''}`}
                key={message.id}
              >
                <div className="message-meta">
                  <strong>{message.role === 'user' ? 'You' : 'Anne'}</strong>
                  <div className="message-meta-actions">
                    <time dateTime={message.createdAt} title={new Date(message.createdAt).toString()}>
                      {formatMessageTime(message.createdAt)}
                    </time>
                    {message.role === 'assistant' && message.providerId && (
                      <span title={`${message.providerId} · ${message.modelId ?? 'unknown'}`}>
                        ◆ {message.inferenceLocation === 'cloud' ? 'Cloud' : 'Local'}
                      </span>
                    )}
                    {message.role === 'user' && (
                      <button
                        className="message-rerun-button"
                        type="button"
                        onClick={() => rerunMessage(message)}
                        disabled={
                          isGenerating ||
                          speechBusy ||
                          isRuntimeActionRunning ||
                          isRuntimeCheckRunning ||
                          providerAvailability?.available === false ||
                          !message.content.trim()
                        }
                        title="Send this earlier prompt again using the current model and current conversation context"
                      >
                        ↻ Rerun
                      </button>
                    )}
                    <button
                      className="message-context-button"
                      type="button"
                      onClick={() => void toggleMessageContext(message)}
                      disabled={isGenerating || speechBusy || !message.content.trim()}
                      title={
                        message.excludedFromContext
                          ? 'Include this message in future Anne context'
                          : 'Keep this message in history but omit it from future Anne context'
                      }
                    >
                      {message.excludedFromContext ? '↺ Include' : '⊘ Context'}
                    </button>
                  </div>
                </div>
                <div className="message-content">
                  {message.content ? (
                    parseMessageContent(message.content).map((segment, index) => {
                      if (segment.type === 'code') {
                        const codeKey = `${message.id}:${index}`
                        return (
                          <section className="code-block" key={codeKey}>
                            <div className="code-block-header">
                              <span>{segment.language ?? 'code'}</span>
                              <button
                                type="button"
                                onClick={() => void copyCode(segment.content, codeKey)}
                              >
                                {copiedCodeKey === codeKey ? 'Copied' : 'Copy'}
                              </button>
                            </div>
                            <pre><code>{segment.content}</code></pre>
                          </section>
                        )
                      }

                      return segment.content ? (
                        <p key={`${message.id}:text:${index}`}>{segment.content}</p>
                      ) : null
                    })
                  ) : (
                    <p>…</p>
                  )}
                </div>
                {message.excludedFromContext && (
                  <small className="context-state">Excluded from future inference context</small>
                )}
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

          <form className="composer" ref={composerFormRef} onSubmit={sendMessage}>
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
                <DictationControl disabled={isGenerating || isRuntimeActionRunning || isRuntimeCheckRunning || !activeConversation}
                  conversationId={activeConversation?.id} refreshKey={providerRefreshNonce}
                  onBusy={setSpeechBusy} onText={(text) => setPrompt((value) => value ? `${value} ${text}` : text)} />
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
                    isGenerating || speechBusy || isRuntimeActionRunning || isRuntimeCheckRunning ||
                    !activeConversation ||
                    !selectedModelId ||
                    providerAvailability?.available === false ||
                    runtimeSleeping
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
