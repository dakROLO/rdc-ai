import type {
  AIModel,
  AIProvider,
  ProviderAvailability,
} from '../providers/AIProvider.ts'

export type RuntimeLifecycleState =
  | 'checking'
  | 'unavailable'
  | 'model-required'
  | 'ready'

export interface RuntimeCapabilities {
  canStartRuntime: boolean
  canStopRuntime: boolean
  canInstallModels: boolean
  canLoadModels: boolean
  canUnloadModels: boolean
}

export interface RuntimeSnapshot {
  state: RuntimeLifecycleState
  detail: string
  models: AIModel[]
}

export interface RuntimeActionResult {
  supported: boolean
  detail: string
}

export interface RuntimeModelCandidate {
  id: string
  alias: string
  displayName: string
  cached: boolean
  loaded: boolean
  device?: string
  executionProvider?: string
  fileSizeMb?: number
  contextLength?: number
}

export interface LocalRuntimeManager {
  readonly id: string
  readonly displayName: string
  readonly mode: 'external-development' | 'embedded'
  readonly capabilities: RuntimeCapabilities

  inspect(
    provider: AIProvider,
    availability?: ProviderAvailability | null,
    models?: AIModel[],
  ): Promise<RuntimeSnapshot>

  start(): Promise<RuntimeActionResult>
  stop(): Promise<RuntimeActionResult>
  installModel(modelId: string): Promise<RuntimeActionResult>
  loadModel(modelId: string): Promise<RuntimeActionResult>
  unloadModel(modelId: string): Promise<RuntimeActionResult>
  listModelCandidates(): Promise<RuntimeModelCandidate[]>
}
