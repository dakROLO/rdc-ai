import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AIProvider } from '../providers/AIProvider.ts'
import type { LocalRuntimeManager, RuntimeModelCandidate } from './LocalRuntimeManager.ts'
import { bestObserved, groupFamilies, memoryFit, PROFILE_KEY, PREFERRED_PROFILE_KEY, readResults, viableVariants } from './modelPolicy.ts'
import type { BenchmarkResult, DeviceProfile } from './modelPolicy.ts'

interface Props {
  manager: LocalRuntimeManager
  provider: AIProvider
  candidates: RuntimeModelCandidate[]
  busy: boolean
  setBusy(value: boolean): void
  refresh(): Promise<void>
  onReady(): void
}
const normalized = (id: string) => id.split(':')[0].toLowerCase()
export function ModelAnalyst({ manager, provider, candidates, busy, setBusy, refresh, onReady }: Props) {
  const [profile, setProfile] = useState<DeviceProfile>()
  const [results, setResults] = useState(() => readResults(localStorage))
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [toolsRequired, setToolsRequired] = useState(false)
  const [running, setRunning] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const families = groupFamilies(candidates)
  useEffect(() => {
    let disposed = false
    void invoke<DeviceProfile>('crownkeep_device_profile').then((value) => {
      if (!disposed) setProfile(value)
    }).catch(() => { if (!disposed) setError('Hardware inspection unavailable. Retry device analysis before benchmarking.') })
    const subscription = listen<string>('crownkeep-analysis-progress', (event) => setProgress(event.payload))
    return () => { disposed = true; void subscription.then((unlisten) => unlisten()); controller.current?.abort() }
  }, [])
  async function analyze() {
    if (busy) return
    setBusy(true); setError(''); setProgress('Discovering device and execution providers…')
    try {
      await manager.analyzeDevice()
      setProfile(await invoke<DeviceProfile>('crownkeep_device_profile'))
      onReady()
      await refresh()
      setProgress('Discovery complete. Benchmark a family to compare its viable execution paths.')
    } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function benchmark(alias: string) {
    if (!profile || busy) return
    const family = families.find((item) => item.alias === alias)
    if (!family || family.role === 'Voice') return
    // One variant per execution path. Cached variants first; repeated precision/package
    // variants remain available under Advanced rather than multiplying downloads.
    const paths = new Map<string, RuntimeModelCandidate>()
    for (const candidate of viableVariants(family, profile, toolsRequired).sort((a, b) => Number(b.cached) - Number(a.cached) || (a.fileSizeMb ?? Infinity) - (b.fileSizeMb ?? Infinity))) {
      const key = `${candidate.device}/${candidate.executionProvider}`
      if (!paths.has(key)) paths.set(key, candidate)
    }
    if (!paths.size) { setError('No compatible variants meet these requirements.'); return }
    setBusy(true); setRunning(true); setError('')
    const abort = new AbortController(); controller.current = abort
    const previous = candidates.filter((item) => item.loaded)
    let accumulated = readResults(localStorage)
    const measured: BenchmarkResult[] = []
    let activeId: string | undefined
    let selected = false
    const released: RuntimeModelCandidate[] = []
    try {
      for (const loaded of previous) { await manager.unloadModel(loaded.id); released.push(loaded) }
      let index = 0
      for (const candidate of paths.values()) {
        if (abort.signal.aborted) break
        index += 1
        const record: BenchmarkResult = {
          fingerprint: profile.fingerprint, alias, variantId: candidate.id,
          executionProvider: candidate.executionProvider, device: candidate.device,
          cached: candidate.cached, supportsToolCalling: candidate.supportsToolCalling,
          timestamp: new Date().toISOString(), totalMs: 0, outcome: 'error',
        }
        let started = performance.now()
        try {
          setProgress(`${index}/${paths.size} · Preparing ${alias} · ${candidate.executionProvider ?? candidate.device}…`)
          await manager.installModel(candidate.id)
          record.cached = true
          if (abort.signal.aborted) break
          activeId = candidate.id
          await manager.loadModel(candidate.id)
          await manager.start()
          if (abort.signal.aborted) break
          const models = await provider.listModels()
          const actual = models.find((model) => normalized(model.id) === normalized(candidate.id))
          if (!actual) throw new Error('Loaded variant was not exposed by the inference service.')
          setProgress(`${index}/${paths.size} · Measuring ${alias} · ${candidate.executionProvider ?? candidate.device}…`)
          started = performance.now()
          let text = ''; let tokens: number | undefined
          const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(45_000)])
          for await (const chunk of provider.streamChat({ modelId: actual.id, maxTokens: 48, messages: [{ role: 'user', content: 'Explain in two short sentences why saving work regularly is useful.' }] }, signal)) {
            if (chunk.text && record.firstTokenMs === undefined) record.firstTokenMs = performance.now() - started
            text += chunk.text
            tokens = chunk.usage?.completionTokens ?? tokens
          }
          record.totalMs = performance.now() - started
          if (!text.trim()) throw new Error('The benchmark returned no text.')
          record.tokensPerSecond = tokens && record.totalMs > (record.firstTokenMs ?? 0) ? tokens / ((record.totalMs - (record.firstTokenMs ?? 0)) / 1000) : undefined
          record.outcome = (record.firstTokenMs ?? Infinity) <= 8000 && record.totalMs <= 20000 ? 'accepted' : 'slow'
        } catch (e) {
          record.totalMs = performance.now() - started
          record.outcome = abort.signal.aborted ? 'cancelled' : 'error'
          record.detail = String(e)
        } finally {
          if (activeId) { await manager.unloadModel(activeId); activeId = undefined }
        }
        measured.push(record)
        accumulated = [...accumulated.filter((r) => !(r.fingerprint === profile.fingerprint && r.variantId === record.variantId)), record].slice(-200)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(accumulated)); setResults(accumulated)
      }
      const winner = bestObserved(measured, profile.fingerprint, alias)
      if (winner && !abort.signal.aborted) {
        setProgress(`Loading measured winner: ${alias} · ${winner.executionProvider ?? winner.device}…`)
        activeId = winner.variantId
        await manager.loadModel(winner.variantId)
        await manager.start()
        localStorage.setItem(PREFERRED_PROFILE_KEY, JSON.stringify(winner))
        localStorage.setItem('crownkeep.preferredWindowsModel', winner.alias)
        activeId = undefined; selected = true
        setProgress(`Ready · ${alias} · measured ${Math.round(winner.firstTokenMs!)} ms to first token. Preferred family saved for this device.`)
      } else {
        setProgress(abort.signal.aborted ? 'Benchmark cancelled. Restoring previous model.' : 'No interactive path passed. Restoring previous model.')
      }
    } catch (e) { setError(String(e)) } finally {
      try {
        if (activeId) await manager.unloadModel(activeId)
        if (!selected) for (const item of released) await manager.loadModel(item.id)
        await refresh()
      } catch (e) { setError(`Model recovery needs attention: ${String(e)}`) }
      controller.current = null; setRunning(false); setBusy(false); onReady()
    }
  }
  const stale = results.length > 0 && profile && !results.some((r) => r.fingerprint === profile.fingerprint)
  return <div className="model-analyst-panel">
    <p>Choose a family. Compare uses the same short prompt on each viable execution path and may download models. Deep models are experimental; memory estimates do not guarantee VRAM fit.</p>
    <button type="button" disabled={busy} onClick={() => void analyze()}>Analyze this device</button>
    {profile && <p>{profile.detail}</p>}
    {stale && <p role="status">Hardware or runtime changed. Previous measurements are stale; analyze and benchmark again.</p>}
    <label><input type="checkbox" checked={toolsRequired} onChange={(e) => setToolsRequired(e.target.checked)} disabled={busy} /> Require catalog tool-call support</label>
    {progress && <p role="status" aria-live="polite">{progress}</p>}
    {error && <p role="alert">{error}</p>}
    {running && <button type="button" onClick={() => { controller.current?.abort(); setProgress('Cancelling; waiting for native model operation to finish and release resources…') }}>Cancel benchmark</button>}
    {(['Quick', 'Balanced', 'Deep / Experimental', 'Voice'] as const).map((role) => <section key={role} className="model-role">
      <h4>{role}</h4>
      {families.filter((f) => f.role === role && (!toolsRequired || role === 'Voice' || f.variants.some((v) => v.supportsToolCalling))).map((family) => {
        const observed = profile && bestObserved(results, profile.fingerprint, family.alias)
        const viable = profile ? viableVariants(family, profile, toolsRequired) : []
        return <div key={family.alias} className="model-family">
          <strong>{family.alias}</strong>
          <span>{family.variants.length} variants · {family.variants.some((v) => v.cached) ? 'Cached variant available' : 'Download required'}</span>
          <span>Tools: {family.variants.some((v) => v.supportsToolCalling === true) ? 'Advertised on some variants' : family.variants.every((v) => v.supportsToolCalling === false) ? 'Not advertised' : 'Unknown'}</span>
          {observed && <span>Observed: {observed.executionProvider ?? observed.device} · {Math.round(observed.firstTokenMs!)} ms first token{observed.tokensPerSecond ? ` · ${observed.tokensPerSecond.toFixed(1)} tok/s` : ''}</span>}
          {role !== 'Voice' && <button type="button" disabled={busy || !viable.length} onClick={() => void benchmark(family.alias)}>Compare paths and use fastest</button>}
          {role === 'Voice' && <span>Available to local dictation; released after each recording.</span>}
          <details><summary>Advanced · variants and measurements</summary>
            {family.variants.map((v) => {
              const r = profile && results.find((item) => item.fingerprint === profile.fingerprint && item.variantId === v.id)
              return <p key={v.id}>{v.id} · {v.executionProvider ?? 'Default'} · {v.device} · {v.fileSizeMb ?? '?'} MB · tools {String(v.supportsToolCalling ?? 'unknown')}<br />{profile && memoryFit(v, profile)}{r && `${r.outcome} · ${(r.totalMs / 1000).toFixed(2)} s · ${r.timestamp}${r.detail ? ` · ${r.detail}` : ''}`}</p>
            })}
          </details>
        </div>
      })}
    </section>)}
  </div>
}
