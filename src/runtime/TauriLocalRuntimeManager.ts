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

function notWired(action: string): Promise<RuntimeActionResult> {
  return Promise.resolve({
    supported: false,
    detail:
      `${action} is not wired in the Phase 4A.1 host-shell proof yet. The native CrownKeep host is connected; Foundry Local lifecycle ownership is the next slice.`,
  })
}

export class TauriLocalRuntimeManager implements LocalRuntimeManager {
  readonly id = 'tauri-windows-host'
  readonly displayName = 'CrownKeep Windows host'
  readonly mode = 'embedded' as const
  readonly capabilities = {
    canStartRuntime: false,
    canStopRuntime: false,
    canInstallModels: false,
    canLoadModels: false,
    canUnloadModels: false,
  }

  async inspect(
    provider: AIProvider,
    availability?: ProviderAvailability | null,
    models?: AIModel[],
  ): Promise<RuntimeSnapshot> {
    const host = await invoke<CrownKeepHostInfo>('crownkeep_host_info')
    const resolvedAvailability =
      availability ?? (await provider.getAvailability())

    if (!resolvedAvailability.available) {
      return {
        state: 'unavailable',
        detail:
          `Native CrownKeep host connected on ${host.platform}/${host.arch}, but the selected local AI provider is not ready. ${resolvedAvailability.detail ?? ''}`.trim(),
        models: [],
      }
    }

    const resolvedModels = models ?? (await provider.listModels())

    if (resolvedModels.length === 0) {
      return {
        state: 'model-required',
        detail:
          `Native CrownKeep host connected on ${host.platform}/${host.arch}. Foundry Local is reachable, but no chat model is currently available.`,
        models: [],
      }
    }

    return {
      state: 'ready',
      detail:
        `Native CrownKeep host v${host.version} connected on ${host.platform}/${host.arch}. ${resolvedAvailability.detail ?? 'Local AI is ready.'}`,
      models: resolvedModels,
    }
  }

  start(): Promise<RuntimeActionResult> {
    return notWired('Starting the local runtime')
  }

  stop(): Promise<RuntimeActionResult> {
    return notWired('Stopping the local runtime')
  }

  installModel(_modelId: string): Promise<RuntimeActionResult> {
    return notWired('Installing a local model')
  }

  loadModel(_modelId: string): Promise<RuntimeActionResult> {
    return notWired('Loading a local model')
  }

  unloadModel(_modelId: string): Promise<RuntimeActionResult> {
    return notWired('Unloading a local model')
  }
}

export function isCrownKeepWindowsHost(): boolean {
  return isTauri()
}
