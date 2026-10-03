import { invoke, isTauri } from '@tauri-apps/api/core'
import type { DecisionEngine, DecisionRequest, DecisionResult, DecisionStatus } from './DecisionEngine.ts'
import { DecisionAssist } from './DecisionEngine.ts'
export class NativeDecisionEngine implements DecisionEngine {
  async status(): Promise<DecisionStatus> {
    if (isTauri()) return invoke('crownkeep_decision_status')
    return { available: false, version: 'Julia-1', backend: typeof window !== 'undefined' && window.crownKeepNativeAI ? 'Apple native conversion pending' : 'native runtime required', loadState: 'unavailable', qualifiedJobs: [], detail: 'No qualified native Julia runtime is installed. Auto uses Quick. No network fallback.' }
  }
  async decide(request: DecisionRequest): Promise<DecisionResult> {
    if (!isTauri()) throw new Error('Local Julia is unavailable on this host.')
    return invoke('crownkeep_decide', { request })
  }
  async release(): Promise<void> { if (isTauri()) await invoke('crownkeep_decision_release') }
}
export const decisionAssist = new DecisionAssist(new NativeDecisionEngine())
