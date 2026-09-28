import type { RuntimeModelCandidate } from '../runtime/LocalRuntimeManager.ts'

export function activeChatAlias(models: RuntimeModelCandidate[]): string | undefined {
  return models.find((model) => model.loaded && model.modelType?.toLowerCase() === 'chat')?.alias
}

export function activeSpeechVariant(models: RuntimeModelCandidate[], alias: string): RuntimeModelCandidate | undefined {
  return models.find((model) => model.loaded && model.alias.toLowerCase() === alias.toLowerCase() && model.modelType?.toLowerCase() === 'speech')
}
