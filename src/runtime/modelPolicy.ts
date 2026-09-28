import type { RuntimeModelCandidate } from './LocalRuntimeManager.ts'

export type ModelRole = 'Quick' | 'Balanced' | 'Deep' | 'Voice'
export interface DeviceProfile {
  fingerprint: string
  memoryMb?: number
  detail: string
}
export interface BenchmarkResult {
  fingerprint: string
  alias: string
  variantId: string
  executionProvider?: string
  device?: string
  cached: boolean
  downloadedDuringBenchmark?: boolean
  supportsToolCalling?: boolean
  timestamp: string
  firstTokenMs?: number
  totalMs: number
  tokensPerSecond?: number
  realWorldValidated?: boolean
  contextFirstTokenMs?: number
  contextTotalMs?: number
  outcome: 'accepted' | 'slow' | 'error' | 'cancelled'
  detail?: string
}
export interface ModelFamily {
  alias: string
  role: ModelRole
  variants: RuntimeModelCandidate[]
}
export const PROFILE_KEY = 'crownkeep.observedProfiles.v2'
export const PREFERRED_PROFILE_KEY = 'crownkeep.preferredProfile.v2'

export function taskOf(model: RuntimeModelCandidate): 'chat' | 'speech' | 'other' {
  const metadata = `${model.modelType ?? ''} ${model.task ?? ''}`.toLowerCase()
  // Foundry 0.10.3 exposes `type`, not the old task/capability fields.
  if (model.modelType?.toLowerCase() === 'chat') return 'chat'
  if (model.modelType?.toLowerCase() === 'speech') return 'speech'
  if (/^(embedding|multimodal)$/i.test(model.modelType ?? '')) return 'other'
  if (/speech|transcri|automatic-speech-recognition|whisper/.test(`${metadata} ${model.alias}`)) return 'speech'
  if (/embed|image|vision-only|rerank/.test(metadata)) return 'other'
  if (/chat|\btext\b|text-generation|completion|llm/.test(metadata)) return 'chat'
  return 'other' // Unknown capability is not evidence of chat compatibility.
}
export function roleOf(model: RuntimeModelCandidate): ModelRole {
  if (taskOf(model) === 'speech') return 'Voice'

  const alias = model.alias.toLowerCase()
  if (/gpt-oss|20b|32b|70b|deepseek|reasoning|reasoner/i.test(alias)) {
    return 'Deep'
  }

  // CrownKeep's intended everyday baseline stays Quick even when a specific
  // package reports a disk size above the generic size heuristic.
  if (alias === 'phi-4-mini' || alias.startsWith('phi-4-mini-instruct')) {
    return 'Quick'
  }

  if (/12b|14b|nemo|8b|9b/i.test(alias) || (model.fileSizeMb ?? 0) > 4500) {
    return 'Balanced'
  }

  return 'Quick'
}
export function groupFamilies(models: RuntimeModelCandidate[]): ModelFamily[] {
  const grouped = new Map<string, ModelFamily>()
  for (const model of models.filter((item) => taskOf(item) !== 'other')) {
    const key = model.alias.toLowerCase()
    const family = grouped.get(key) ?? { alias: model.alias, role: roleOf(model), variants: [] }
    family.variants.push(model)
    grouped.set(key, family)
  }
  return [...grouped.values()].sort((a, b) => a.alias.localeCompare(b.alias))
}
export function memoryFit(model: RuntimeModelCandidate, profile: DeviceProfile): string | undefined {
  // Disk size is only a conservative lower bound, never a VRAM-fit claim.
  if (profile.memoryMb && model.fileSizeMb && model.fileSizeMb * 1.5 + 2048 > profile.memoryMb) {
    return 'Insufficient system-memory headroom (estimated weights × 1.5 + 2 GB).'
  }
  return undefined
}
export function viableVariants(family: ModelFamily, profile: DeviceProfile, toolsRequired = false) {
  return family.variants.filter((model) => !memoryFit(model, profile) &&
    (!toolsRequired || model.supportsToolCalling === true))
}
export function bestObserved(results: BenchmarkResult[], fingerprint: string, alias?: string) {
  // Compare the same bounded prompt. Slow/error/cancelled paths cannot win.
  return results.filter((r) => r.fingerprint === fingerprint && r.outcome === 'accepted' &&
    r.firstTokenMs !== undefined && (!alias || r.alias.toLowerCase() === alias.toLowerCase()))
    .sort((a, b) => ((a.firstTokenMs! * 2 + a.totalMs) - (b.firstTokenMs! * 2 + b.totalMs)))[0]
}
export function readResults(storage: Pick<Storage, 'getItem'>): BenchmarkResult[] {
  try {
    const data: unknown = JSON.parse(storage.getItem(PROFILE_KEY) ?? '[]')
    return Array.isArray(data) ? data.filter((r): r is BenchmarkResult =>
      r && typeof r.fingerprint === 'string' && typeof r.variantId === 'string' &&
      typeof r.alias === 'string' && Number.isFinite(r.totalMs) &&
      ['accepted', 'slow', 'error', 'cancelled'].includes(r.outcome) &&
      !(
        r.outcome === 'error' &&
        typeof r.detail === 'string' &&
        /^Normal CrownKeep chat (?:timed out|exceeded)/.test(r.detail)
      )) : []
  } catch { return [] }
}
export function readPreferred(storage: Pick<Storage, 'getItem'>): BenchmarkResult | undefined {
  try {
    const r = JSON.parse(storage.getItem(PREFERRED_PROFILE_KEY) ?? 'null')
    return r && typeof r.alias === 'string' && typeof r.variantId === 'string' &&
      typeof r.fingerprint === 'string' && r.outcome === 'accepted' ? r : undefined
  } catch { return undefined }
}


export function bestObservedForRole(results: BenchmarkResult[], fingerprint: string, role: ModelRole, models: RuntimeModelCandidate[]) {
  const matches: BenchmarkResult[] = []
  for (const result of results) {
    if (result.fingerprint !== fingerprint) continue
    if (result.outcome !== 'accepted') continue
    if (result.firstTokenMs === undefined) continue
    const familyCandidates = models.filter(
      (model) =>
        model.alias.toLowerCase() === result.alias.toLowerCase() &&
        taskOf(model) === 'chat',
    )
    if (!familyCandidates.length) continue
    // Role qualification is alias-first. The API-visible model ID may omit or
    // otherwise differ from the catalog's exact variant suffix, so a validated
    // family result must not disappear solely because variant IDs differ.
    const normalizedVariant = result.variantId.split(':')[0].toLowerCase()
    const candidate =
      familyCandidates.find(
        (model) => model.id.split(':')[0].toLowerCase() === normalizedVariant,
      ) ?? familyCandidates[0]
    if (roleOf(candidate) !== role) continue
    if (role !== 'Quick' && result.realWorldValidated !== true) continue
    matches.push(result)
  }
  matches.sort((a, b) => ((a.firstTokenMs! * 2 + a.totalMs) - (b.firstTokenMs! * 2 + b.totalMs)))
  return matches[0]
}
