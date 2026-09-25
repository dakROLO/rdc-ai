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

const unsupportedDetail =
  'This browser development build can inspect Foundry Local but cannot manage the native runtime. The installed Windows build will provide these actions through its embedded runtime host.'

function unsupported(): Promise<RuntimeActionResult> {
  return Promise.resolve({
    supported: false,
    detail: unsupportedDetail,
  })
}

export class BrowserLocalRuntimeManager implements LocalRuntimeManager {
  readonly id = 'browser-foundry-external'
  readonly displayName = 'Browser development runtime'
  readonly mode = 'external-development' as const
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
    const resolvedAvailability =
      availability ?? (await provider.getAvailability())

    if (!resolvedAvailability.available) {
      return {
        state: 'unavailable',
        detail:
          resolvedAvailability.detail ??
          'The selected local AI runtime is not reachable.',
        models: [],
      }
    }

    const resolvedModels = models ?? (await provider.listModels())

    if (resolvedModels.length === 0) {
      return {
        state: 'model-required',
        detail:
          'The local runtime is reachable, but no chat model is currently available to CrownKeep.',
        models: [],
      }
    }

    return {
      state: 'ready',
      detail:
        resolvedAvailability.detail ??
        'The local runtime and at least one model are ready.',
      models: resolvedModels,
    }
  }

  start(): Promise<RuntimeActionResult> {
    return unsupported()
  }

  stop(): Promise<RuntimeActionResult> {
    return unsupported()
  }

  installModel(_modelId: string): Promise<RuntimeActionResult> {
    return unsupported()
  }

  loadModel(_modelId: string): Promise<RuntimeActionResult> {
    return unsupported()
  }

  unloadModel(_modelId: string): Promise<RuntimeActionResult> {
    return unsupported()
  }
}

export const browserLocalRuntimeManager = new BrowserLocalRuntimeManager()
