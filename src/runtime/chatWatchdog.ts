import type { ModelRole } from './modelPolicy.ts'

export interface ChatWatchdogLimits {
  firstTokenMs: number
  totalMs: number
}

/**
 * Larger local models need more startup/prefill time, especially after a role
 * switch or when the conversation carries retained tool evidence.
 */
export function chatWatchdogForRole(role?: ModelRole): ChatWatchdogLimits {
  switch (role) {
    case 'Balanced':
      return { firstTokenMs: 90_000, totalMs: 240_000 }
    case 'Deep':
      return { firstTokenMs: 60_000, totalMs: 240_000 }
    case 'Voice':
      return { firstTokenMs: 30_000, totalMs: 120_000 }
    case 'Quick':
    default:
      return { firstTokenMs: 20_000, totalMs: 120_000 }
  }
}
