import type { AIProvider } from '../providers/AIProvider.ts'
import type { LocalRuntimeManager } from './LocalRuntimeManager.ts'
import type { LocalRuntime, LocalRuntimeCapabilities, LocalRuntimeHealth, LocalRuntimeRole } from './LocalRuntime.ts'

/**
 * Bridges the existing provider/lifecycle split without making shared code
 * assume the runtime is Foundry. iOS can use the same contract with its native
 * provider while leaving lifecycle operations unavailable.
 */
export class ProviderLocalRuntime implements LocalRuntime {
  readonly id: string
  private readonly provider: AIProvider
  private readonly manager?: LocalRuntimeManager
  private readonly platform: LocalRuntimeCapabilities['platform']
  private readonly roles: LocalRuntimeRole[]

  constructor(
    id: string,
    provider: AIProvider,
    manager?: LocalRuntimeManager,
    platform: LocalRuntimeCapabilities['platform'] = 'unknown',
    roles: LocalRuntimeRole[] = ['Quick'],
  ) {
    this.id = id
    this.provider = provider
    this.manager = manager
    this.platform = platform
    this.roles = roles
  }

  async capabilities(): Promise<LocalRuntimeCapabilities> {
    return { platform: this.platform, roles: await this.availableRoles(), supportsModelLifecycle: Boolean(this.manager?.capabilities.canLoadModels) }
  }
  async availableRoles(): Promise<LocalRuntimeRole[]> { return this.roles }
  async activate(_role: LocalRuntimeRole, alias: string): Promise<void> {
    if (!this.manager?.capabilities.canLoadModels) throw new Error('This local runtime does not manage model lifecycle here.')
    const result = await this.manager.activateModel(alias)
    if (!result.supported) throw new Error(result.detail)
  }
  async health(): Promise<LocalRuntimeHealth> {
    const availability = await this.provider.getAvailability()
    return { available: availability.available, detail: availability.detail ?? 'Local runtime health checked.' }
  }
  async loadedModel(): Promise<string | undefined> {
    if (!this.manager) return undefined
    return (await this.manager.listModelCandidates()).find((model) => model.loaded)?.id
  }
}
