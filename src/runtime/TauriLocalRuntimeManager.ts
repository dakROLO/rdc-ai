import { invoke, isTauri } from '@tauri-apps/api/core'
import type {
  AIModel,
  AIProvider,
  ProviderAvailability,
} from '../providers/AIProvider.ts'
import type {
  LocalRuntimeManager,
  RuntimeActionResult,
  RuntimeDeviceAnalysis,
  RuntimeModelCandidate,
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
interface NativeLegacyCacheInventory {
  path: string
  exists: boolean
  approximateSizeBytes: number
  entries: string[]
  entryCount: number
  status: string
  cleanup: string
}

interface NativeFoundryRuntimeStatus {
  sdkReady: boolean
  serviceUrls: string[]
  catalogModelCount: number
  cachedModelCount: number
  loadedModelCount: number
  cachedModels: NativeFoundryModelSummary[]
  loadedModels: NativeFoundryModelSummary[]
  runtimeVersion?: string
  cacheLocation?: string
  authority?: string
  legacyCacheLocation?: string
  legacyCache: NativeLegacyCacheInventory
  serviceReady: boolean
  serviceState: string
  foundryLocalCoreVersion: string
  ortVersion: string
  ortGenAiVersion: string
}

interface NativeFoundryDeviceAnalysis extends RuntimeDeviceAnalysis {}

interface NativeFoundryModelCandidate {
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
      invoke<NativeFoundryRuntimeStatus>('crownkeep_system_foundry_status'),
    ])

    const resolvedAvailability =
      availability ?? (await provider.getAvailability())
    const resolvedModels =
      resolvedAvailability.available
        ? (models ?? (await provider.listModels()))
        : []

    const loadedText = nativeStatus.loadedModelCount > 0
      ? ` Loaded: ${nativeStatus.loadedModelCount}.`
      : ''
    const cachedText = nativeStatus.cachedModelCount > 0
      ? ` Cached: ${nativeStatus.cachedModelCount}.`
      : ''

    if (!resolvedAvailability.available) {
      return {
        state: 'unavailable',
        detail:
          `Native CrownKeep host v${host.version} connected on ${host.platform}/${host.arch}. ${nativeStatus.authority ?? 'System Foundry'} is available with ${nativeStatus.catalogModelCount} catalog models, but its OpenAI service is not currently reachable.${cachedText}${loadedText}`,
        models: [],
        authority: nativeStatus.authority,
        runtimeVersion: nativeStatus.runtimeVersion,
        cacheLocation: nativeStatus.cacheLocation,
        legacyCacheLocation: nativeStatus.legacyCacheLocation,
        legacyCache: nativeStatus.legacyCache,
      }
    }

    if (resolvedModels.length === 0) {
      return {
        state: 'model-required',
        detail:
          `Native CrownKeep host v${host.version} connected. ${nativeStatus.authority ?? 'System Foundry'} owns model lifecycle, but no loaded chat model is currently exposed to the local API.${cachedText}${loadedText}`,
        models: [],
        authority: nativeStatus.authority,
        runtimeVersion: nativeStatus.runtimeVersion,
        cacheLocation: nativeStatus.cacheLocation,
        legacyCacheLocation: nativeStatus.legacyCacheLocation,
        legacyCache: nativeStatus.legacyCache,
      }
    }

    return {
      state: 'ready',
      detail:
        `Native CrownKeep host v${host.version} connected on ${host.platform}/${host.arch}. ${nativeStatus.authority ?? 'System Foundry'} is the lifecycle authority. ${resolvedAvailability.detail ?? 'Local AI is ready.'}${loadedText}`,
      models: resolvedModels,
      authority: nativeStatus.authority,
      runtimeVersion: nativeStatus.runtimeVersion,
      cacheLocation: nativeStatus.cacheLocation,
      legacyCacheLocation: nativeStatus.legacyCacheLocation,
      legacyCache: nativeStatus.legacyCache,
    }
  }

  start(): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_system_foundry_start')
  }

  stop(): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_system_foundry_stop')
  }

  installModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_system_foundry_install_model', { modelId })
  }

  activateModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_system_foundry_activate_model', { modelId })
  }

  loadModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_system_foundry_load_model', { modelId })
  }

  unloadModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_system_foundry_unload_model', { modelId })
  }

  removeCachedModel(modelId: string): Promise<RuntimeActionResult> {
    return invokeAction('crownkeep_system_foundry_remove_cached_model', { modelId })
  }

  listModelCandidates(): Promise<RuntimeModelCandidate[]> {
    return invoke<NativeFoundryModelCandidate[]>('crownkeep_system_foundry_models')
  }

  inspectLegacyCache(): Promise<NativeLegacyCacheInventory> {
    return invoke<NativeLegacyCacheInventory>('crownkeep_system_foundry_legacy_inventory')
  }

  analyzeDevice(): Promise<RuntimeDeviceAnalysis> {
    return invoke<NativeFoundryDeviceAnalysis>('crownkeep_system_foundry_analyze_device')
  }
}

export function isCrownKeepWindowsHost(): boolean {
  return isTauri()
}
