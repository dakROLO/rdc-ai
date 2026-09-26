import { invoke, isTauri } from '@tauri-apps/api/core'
import type {
  AIModel,
  AIProvider,
  ProviderAvailability,
} from '../providers/AIProvider.ts'
import type {
  LocalRuntimeManager,
  RuntimeActionResult,
  RuntimeSnapshot,
} from './LocalRuntimeManager.ts'

interface CrownKeepHostInfo {
  host: string
  platform: string
  arch: string
  version: string
  runtimeControlAvailable: boolean
}

interface NativeFoundryModelSummary {
  id: string
  alias: string
}

interface NativeFoundryRuntimeStatus {
  sdkReady: boolean
  serviceUrls: string[]
  catalogModelCount: number
  cachedModels: NativeFoundryModelSummary[]
  loadedModels: NativeFoundryModelSummary[]
}

async function invokeAction(
  command: string,
  args?: Record<string, unknown>,
): Promise<RuntimeActionResult> {
  return invoke<RuntimeActionResult>(command, args)
}

export class TauriLocalRuntimeManager implements LocalRuntimeManager {
  readonly id = 'tauri-windows-host'
  readonly displayName = 'CrownKeep Windows host'
  readonly mode = 'embedded' as const
  readonly capabilities = {
    canStartRuntime: true,
    canStopRuntime: true,
    canInstallModels: true,
    canLoadModels: true,
    canUnloadModels: true,
  }

  async inspect(
    provider: AIProvider,
    availability?: ProviderAvailability | null,
    models?: AIModel[],
  ): Promise<RuntimeSnapshot> {
    const [host, nativeStatus] = await Promise.all([
      invoke<CrownKeepHostInfo>('crownkeep_host_info'),
      invoke<NativeFoundryRuntimeStatus>('crownkeep_foundry_status'),
    ])

    const resolvedAvailability =
      availability ?? (await provider.getAvailability())
    const resolvedModels =
      resolvedAvailability.available
        ? (models ?? (await provider.listModels()))
        : []

    const loadedText = nativeStatus.loadedModels.length > 0
      ? ` Loaded: ${nativeStatus.loadedModels.map((model) => model.alias).join(', ')}.`
      : ''
    const cachedText = nativeStatus.cachedModels.length > 0
      ? ` Cached: ${nativeStatus.cachedModels.length}.`
      : ''

    if (!resolvedAvailability.available) {
      return {
        state: 'unavailable',
        detail:
          `Native CrownKeep host v${host.version} connected on ${host.platform}/${host.arch}. Foundry Local SDK is ready with ${nativeStatus.catalogModelCount} compatible catalog models, but CrownKeep's embedded OpenAI service is not currently reachable.${cachedText}${loadedText}`,
        models: [],
      }
    }

    if (resolvedModels.length === 0) {
      return {
        state: 'model-required',
        detail:
          `Native CrownKeep host v${host.version} connected. CrownKeep owns the Foundry Local lifecycle, but no loaded chat model is currently exposed to the local API.${cachedText}${loadedText}`,
        models: [],
      }
    }

    return {
      state: 'ready',
      detail:
        `Native CrownKeep host v${host.version} connected on ${host.platform}/${host.arch}. CrownKeep owns the Foundry Local lifecycle. ${resolvedAvailability.detail ?? 'Local AI is ready.'}${loadedText}`,
      models: resolvedModels,
    }
  }

  start(): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_foundry_start')
  }

  stop(): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_foundry_stop')
  }

  installModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_foundry_install_model', { modelId })
  }

  loadModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_foundry_load_model', { modelId })
  }

  unloadModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_foundry_unload_model', { modelId })
  }
}

export function isCrownKeepWindowsHost(): boolean {
  return isTauri()
}
