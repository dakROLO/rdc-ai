/** The small cross-platform contract shared CrownKeep code can depend on. */
export type LocalRuntimeRole = 'Quick' | 'Balanced' | 'Deep' | 'Voice'

export interface LocalRuntimeCapabilities {
  platform: 'windows' | 'ios' | 'browser' | 'unknown'
  roles: LocalRuntimeRole[]
  supportsModelLifecycle: boolean
}

export interface LocalRuntimeHealth {
  available: boolean
  detail: string
  runtimeVersion?: string
  loadedModelId?: string
}

/** Deliberately hides Foundry and Apple implementation details. */
export interface LocalRuntime {
  readonly id: string
  capabilities(): Promise<LocalRuntimeCapabilities>
  availableRoles(): Promise<LocalRuntimeRole[]>
  activate(role: LocalRuntimeRole, alias: string): Promise<void>
  health(): Promise<LocalRuntimeHealth>
  loadedModel(): Promise<string | undefined>
}
