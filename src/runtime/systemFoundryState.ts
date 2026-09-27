import type { RuntimeModelCandidate } from './LocalRuntimeManager.ts'

/** System Foundry resolves an alias; CrownKeep records its actual selection. */
export function actualModelForAlias(
  alias: string,
  candidates: RuntimeModelCandidate[],
): RuntimeModelCandidate | undefined {
  const normalized = alias.toLowerCase()
  return candidates.find((candidate) => candidate.loaded && candidate.alias.toLowerCase() === normalized)
    ?? candidates.find((candidate) => candidate.loaded && candidate.id.toLowerCase().startsWith(`${normalized}:`))
}

/** A saved exact variant is evidence only; roles are restored from their alias. */
export function startupAlias(savedAlias: string | undefined, fallback = 'phi-4-mini'): string {
  return savedAlias?.trim() || fallback
}

export function apiModelMatchesAlias(alias: string, apiModelId: string): boolean {
  const target = alias.split(':')[0].trim().toLowerCase()
  const actual = apiModelId.split(':')[0].trim().toLowerCase()
  return actual === target || actual.startsWith(target)
}
