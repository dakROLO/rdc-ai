import { invoke, isTauri } from '@tauri-apps/api/core'
import type { DecisionEngine, DecisionRequest, DecisionResult, DecisionStatus } from './DecisionEngine.ts'
import { DecisionAssist } from './DecisionEngine.ts'
import { getNativeAIHost } from '../native/NativeAIHost.ts'
export class NativeDecisionEngine implements DecisionEngine {
  async status(): Promise<DecisionStatus> {
    if (isTauri()) return invoke('crownkeep_decision_status')
    const native = getNativeAIHost()?.decision
    if (native) return native.status()
    return { available: false, version: 'Julia-1', backend: typeof window !== 'undefined' && window.crownKeepNativeAI ? 'Apple Core AI model not installed' : 'native runtime required', loadState: 'unavailable', qualifiedJobs: [], detail: 'No qualified native Julia runtime is installed. Auto uses Quick. No network fallback.' }
  }
  async decide(request: DecisionRequest): Promise<DecisionResult> {
    if (isTauri()) return invoke('crownkeep_decide', { request })
    const native = getNativeAIHost()?.decision
    if (native) return native.decide(request)
    throw new Error('Local Julia is unavailable on this host.')
  }
  async release(): Promise<void> {
    if (isTauri()) await invoke('crownkeep_decision_release')
    else await getNativeAIHost()?.decision?.release()
  }
}
export const decisionAssist = new DecisionAssist(new NativeDecisionEngine())


export async function installDecisionModel(): Promise<DecisionStatus> {
  const native = getNativeAIHost()?.decision
  if (!native?.install) throw new Error('This device does not support installing the Julia decision model.')
  return native.install()
}

export async function removeDecisionModel(): Promise<DecisionStatus> {
  const native = getNativeAIHost()?.decision
  if (!native?.remove) throw new Error('This device does not support removing the Julia decision model.')
  return native.remove()
}

export function decisionModelInstallable(): boolean {
  return Boolean(getNativeAIHost()?.decision?.install)
}
