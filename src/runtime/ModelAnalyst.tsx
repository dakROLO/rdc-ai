import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AIProvider } from '../providers/AIProvider.ts'
import type { LocalRuntimeManager, RuntimeModelCandidate } from './LocalRuntimeManager.ts'
import { ModelStorage } from './ModelStorage.tsx'
import {
  bestObserved,
  groupFamilies,
  memoryFit,
  PROFILE_KEY,
  PREFERRED_PROFILE_KEY,
  readResults,
  taskOf,
  viableVariants,
} from './modelPolicy.ts'
import type {
  BenchmarkResult,
  DeviceProfile,
  ModelFamily,
  ModelRole,
} from './modelPolicy.ts'

interface Props {
  manager: LocalRuntimeManager
  provider: AIProvider
  candidates: RuntimeModelCandidate[]
  busy: boolean
  setBusy(value: boolean): void
  refresh(): Promise<void>
  onReady(ready: boolean): void
  onCatalogChanged(): void
}

interface NativeOperationProgress {
  stage: string
  message: string
  modelId?: string
  alias?: string
  percent?: number
}

const normalized = (id: string) => id.split(':')[0].toLowerCase()
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const ROLE_ORDER: ModelRole[] = ['Quick', 'Balanced', 'Deep / Experimental', 'Voice']
const ROLE_PRIORITIES: Record<ModelRole, string[]> = {
  Quick: ['phi-4-mini'],
  Balanced: ['mistral-nemo-12b-instruct', 'olmo-3-7b-instruct'],
  'Deep / Experimental': ['gpt-oss-20b'],
  Voice: ['whisper-base', 'whisper-tiny', 'whisper-small'],
}

function preferredFamilyForRole(families: ModelFamily[], role: ModelRole): ModelFamily | undefined {
  const inRole = families.filter((family) => family.role === role)
  for (const alias of ROLE_PRIORITIES[role]) {
    const match = inRole.find((family) => family.alias.toLowerCase() === alias)
    if (match) return match
  }
  if (role === 'Quick') {
    return inRole.find((family) => !/reason|deepseek|gpt-oss/i.test(family.alias))
  }
  return inRole[0]
}

export function ModelAnalyst({
  manager,
  provider,
  candidates,
  busy,
  setBusy,
  refresh,
  onReady,
  onCatalogChanged,
}: Props) {
  const [profile, setProfile] = useState<DeviceProfile>()
  const [results, setResults] = useState(() => readResults(localStorage))
  const [progress, setProgress] = useState('')
  const [operation, setOperation] = useState<NativeOperationProgress>()
  const [error, setError] = useState('')
  const [toolsRequired, setToolsRequired] = useState(false)
  const [running, setRunning] = useState(false)
  const controller = useRef<AbortController | null>(null)

  const families = useMemo(() => groupFamilies(candidates), [candidates])
  const recommendedFamilies = useMemo(
    () => ROLE_ORDER
      .map((role) => preferredFamilyForRole(families, role))
      .filter((family): family is ModelFamily => Boolean(family)),
    [families],
  )
  const recommendedAliases = useMemo(
    () => new Set(recommendedFamilies.map((family) => family.alias.toLowerCase())),
    [recommendedFamilies],
  )
  const otherFamilies = useMemo(
    () => families.filter((family) => !recommendedAliases.has(family.alias.toLowerCase())),
    [families, recommendedAliases],
  )

  useEffect(() => {
    let disposed = false
    void invoke<DeviceProfile>('crownkeep_device_profile')
      .then((value) => {
        if (!disposed) setProfile(value)
      })
      .catch(() => {
        if (!disposed) setError('Hardware inspection unavailable. Retry device analysis before benchmarking.')
      })

    const analysisSubscription = listen<string>(
      'crownkeep-analysis-progress',
      (event) => setProgress(event.payload),
    )
    const operationSubscription = listen<NativeOperationProgress>(
      'crownkeep-foundry-operation-progress',
      (event) => {
        setOperation(event.payload)
        setProgress(event.payload.message)
      },
    )

    return () => {
      disposed = true
      void analysisSubscription.then((unlisten) => unlisten())
      void operationSubscription.then((unlisten) => unlisten())
      controller.current?.abort()
    }
  }, [])

  async function analyze() {
    if (busy) return
    setBusy(true)
    setError('')
    setOperation(undefined)
    setProgress('Discovering device and execution providers…')
    try {
      await manager.analyzeDevice()
      setProfile(await invoke<DeviceProfile>('crownkeep_device_profile'))
      onCatalogChanged()
      await refresh()
      setProgress('Discovery complete. CrownKeep reduced the catalog to recommended model families below.')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function waitForLoadedModel(candidate: RuntimeModelCandidate) {
    let lastError: unknown
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        const models = await provider.listModels()
        const actual = models.find(
          (model) => normalized(model.id) === normalized(candidate.id),
        )
        if (actual) return actual
      } catch (error) {
        lastError = error
      }
      await sleep(350)
    }
    throw new Error(
      `Loaded variant was not exposed by the inference service${lastError ? `: ${String(lastError)}` : '.'}`,
    )
  }

  function benchmarkPaths(family: ModelFamily): RuntimeModelCandidate[] {
    if (!profile) return []
    const viable = viableVariants(family, profile, toolsRequired)
      .sort(
        (a, b) =>
          Number(b.cached) - Number(a.cached) ||
          (a.fileSizeMb ?? Infinity) - (b.fileSizeMb ?? Infinity),
      )

    // When hardware-specific GPU variants exist, the unbound generic-GPU package
    // adds another large download without identifying a distinct execution
    // provider. Keep it in Advanced rather than the normal compare loop.
    const hasExplicitAcceleratedPath = viable.some(
      (candidate) =>
        (candidate.device === 'GPU' || candidate.device === 'NPU') &&
        Boolean(candidate.executionProvider),
    )
    const filtered = viable.filter(
      (candidate) =>
        !(
          hasExplicitAcceleratedPath &&
          (candidate.device === 'GPU' || candidate.device === 'NPU') &&
          !candidate.executionProvider
        ),
    )

    const paths = new Map<string, RuntimeModelCandidate>()
    for (const candidate of filtered) {
      const key = `${candidate.device ?? 'Auto'}/${candidate.executionProvider ?? 'Default'}`
      if (!paths.has(key)) paths.set(key, candidate)
    }
    return [...paths.values()]
  }

  async function benchmark(alias: string) {
    if (!profile || busy) return
    const family = families.find((item) => item.alias === alias)
    if (!family || family.role === 'Voice') return

    const paths = benchmarkPaths(family)
    if (!paths.length) {
      setError('No compatible variants meet these requirements.')
      return
    }

    setBusy(true)
    setRunning(true)
    setError('')
    setOperation(undefined)
    const abort = new AbortController()
    controller.current = abort

    const previous = candidates.find((item) => item.loaded && taskOf(item) === 'chat')
    let accumulated = readResults(localStorage)
    const measured: BenchmarkResult[] = []
    let selected = false

    try {
      let index = 0
      for (const candidate of paths) {
        if (abort.signal.aborted) break
        index += 1
        const wasCached = candidate.cached
        const record: BenchmarkResult = {
          fingerprint: profile.fingerprint,
          alias,
          variantId: candidate.id,
          executionProvider: candidate.executionProvider,
          device: candidate.device,
          cached: candidate.cached,
          downloadedDuringBenchmark: !wasCached,
          supportsToolCalling: candidate.supportsToolCalling,
          timestamp: new Date().toISOString(),
          totalMs: 0,
          outcome: 'error',
        }

        let started = performance.now()
        try {
          setProgress(
            `${index}/${paths.length} · Preparing ${alias} · ${candidate.executionProvider ?? candidate.device ?? 'Default'}…`,
          )
          await manager.activateModel(candidate.id)
          record.cached = true
          if (abort.signal.aborted) break

          const actual = await waitForLoadedModel(candidate)
          setProgress(
            `${index}/${paths.length} · Measuring ${alias} · ${candidate.executionProvider ?? candidate.device ?? 'Default'}…`,
          )
          started = performance.now()

          let text = ''
          let tokens: number | undefined
          const signal = AbortSignal.any([
            abort.signal,
            AbortSignal.timeout(45_000),
          ])
          for await (const chunk of provider.streamChat(
            {
              modelId: actual.id,
              maxTokens: 48,
              messages: [
                {
                  role: 'user',
                  content:
                    'Explain in two short sentences why saving work regularly is useful.',
                },
              ],
            },
            signal,
          )) {
            if (chunk.text && record.firstTokenMs === undefined) {
              record.firstTokenMs = performance.now() - started
            }
            text += chunk.text
            tokens = chunk.usage?.completionTokens ?? tokens
          }

          record.totalMs = performance.now() - started
          if (!text.trim()) throw new Error('The benchmark returned no text.')
          record.tokensPerSecond =
            tokens && record.totalMs > (record.firstTokenMs ?? 0)
              ? tokens / ((record.totalMs - (record.firstTokenMs ?? 0)) / 1000)
              : undefined
          record.outcome =
            (record.firstTokenMs ?? Infinity) <= 8000 && record.totalMs <= 20000
              ? 'accepted'
              : 'slow'
        } catch (e) {
          record.totalMs = performance.now() - started
          record.outcome = abort.signal.aborted ? 'cancelled' : 'error'
          record.detail = String(e)
        }

        measured.push(record)
        accumulated = [
          ...accumulated.filter(
            (result) =>
              !(
                result.fingerprint === profile.fingerprint &&
                result.variantId === record.variantId
              ),
          ),
          record,
        ].slice(-200)
        localStorage.setItem(PROFILE_KEY, JSON.stringify(accumulated))
        setResults(accumulated)
      }

      const winner = bestObserved(measured, profile.fingerprint, alias)
      if (winner && !abort.signal.aborted) {
        setProgress(
          `Loading measured winner: ${alias} · ${winner.executionProvider ?? winner.device}…`,
        )
        await manager.activateModel(winner.variantId)
        if (family.role === 'Quick') {
          localStorage.setItem(PREFERRED_PROFILE_KEY, JSON.stringify(winner))
          localStorage.setItem('crownkeep.preferredWindowsModel', winner.alias)
        }
        selected = true
        setProgress(
          family.role === 'Quick'
            ? `Ready · ${alias} · measured ${Math.round(winner.firstTokenMs!)} ms to first token. Quick startup preference saved for this device.`
            : `Ready · ${alias} · measured ${Math.round(winner.firstTokenMs!)} ms to first token. ${family.role} winner recorded without changing the Quick startup model.`,
        )
      } else if (previous) {
        setProgress(
          abort.signal.aborted
            ? 'Cancel requested. Restoring the previous model after native cleanup…'
            : 'No interactive path passed. Restoring the previous model…',
        )
        await manager.activateModel(previous.id)
      } else {
        setProgress(
          abort.signal.aborted
            ? 'Benchmark cancelled.'
            : 'No interactive path passed.',
        )
      }

      onCatalogChanged()
      await refresh()
    } catch (e) {
      setError(String(e))
      if (previous) {
        try {
          await manager.activateModel(previous.id)
          await refresh()
        } catch (recoveryError) {
          setError(
            `Model recovery needs attention: ${String(recoveryError)}`,
          )
        }
      }
    } finally {
      controller.current = null
      setRunning(false)
      setBusy(false)
      onReady(selected || Boolean(previous))
    }
  }

  function renderFamily(family: ModelFamily, recommended = false) {
    const observed = profile && bestObserved(results, profile.fingerprint, family.alias)
    const viable = profile ? benchmarkPaths(family) : []
    const voiceCompatible = /whisper-(tiny|base|small)/i.test(family.alias)

    return (
      <div key={family.alias} className={`model-family ${recommended ? 'recommended' : ''}`}>
        <div className="model-family-heading">
          <strong>{family.alias}</strong>
          {recommended && <span className="model-recommended-badge">Recommended</span>}
        </div>
        <span>
          {family.variants.length} variants ·{' '}
          {family.variants.some((variant) => variant.cached)
            ? 'Cached variant available'
            : 'Download required'}
        </span>
        <span>
          Tools:{' '}
          {family.variants.some((variant) => variant.supportsToolCalling === true)
            ? 'Advertised on some variants'
            : family.variants.every((variant) => variant.supportsToolCalling === false)
              ? 'Not advertised'
              : 'Unknown'}
        </span>
        {observed && (
          <span>
            Observed: {observed.executionProvider ?? observed.device} ·{' '}
            {Math.round(observed.firstTokenMs!)} ms first token
            {observed.tokensPerSecond
              ? ` · ${observed.tokensPerSecond.toFixed(1)} tok/s`
              : ''}
          </span>
        )}
        {family.role !== 'Voice' && (
          <button
            type="button"
            disabled={busy || !viable.length}
            onClick={() => void benchmark(family.alias)}
          >
            Compare paths and use fastest
          </button>
        )}
        {family.role === 'Voice' && (
          <>
            <span>Used only during local dictation and released afterward.</span>
            {voiceCompatible && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  localStorage.setItem('crownkeep.speechAlias', family.alias)
                  setProgress(
                    `Voice selected: ${family.alias}. Dictate a short sample to validate it.`,
                  )
                  onCatalogChanged()
                }}
              >
                Use for dictation
              </button>
            )}
          </>
        )}
        <details>
          <summary>Advanced · variants and measurements</summary>
          {family.variants.map((variant) => {
            const result =
              profile &&
              results.find(
                (item) =>
                  item.fingerprint === profile.fingerprint &&
                  item.variantId === variant.id,
              )
            return (
              <p key={variant.id}>
                {variant.id} · {variant.executionProvider ?? 'Default'} ·{' '}
                {variant.device} · {variant.fileSizeMb ?? '?'} MB · tools{' '}
                {String(variant.supportsToolCalling ?? 'unknown')}
                <br />
                {profile && memoryFit(variant, profile)}
                {result &&
                  `${result.outcome} · ${(result.totalMs / 1000).toFixed(2)} s · ${result.timestamp}${result.detail ? ` · ${result.detail}` : ''}`}
              </p>
            )
          })}
        </details>
      </div>
    )
  }

  const stale =
    results.length > 0 &&
    profile &&
    !results.some((result) => result.fingerprint === profile.fingerprint)

  return (
    <div className="model-analyst-panel">
      <p>
        CrownKeep shows one recommended family per role. Compare measures the same
        short prompt on each useful execution path; raw variants and the rest of
        the catalog stay under Advanced / More models.
      </p>
      <button type="button" disabled={busy} onClick={() => void analyze()}>
        Analyze this device
      </button>
      {profile && <p>{profile.detail}</p>}
      {stale && (
        <p role="status">
          Hardware, driver, execution-provider, or catalog capabilities changed.
          Previous measurements are stale; analyze and benchmark again.
        </p>
      )}
      <label>
        <input
          type="checkbox"
          checked={toolsRequired}
          onChange={(event) => setToolsRequired(event.target.checked)}
          disabled={busy}
        />{' '}
        Require catalog tool-call support
      </label>

      {progress && (
        <div className="model-progress" role="status" aria-live="polite">
          <span>{progress}</span>
          {operation?.percent !== undefined && (
            <>
              <progress max={100} value={operation.percent} />
              <small>{Math.round(operation.percent)}%</small>
            </>
          )}
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {running && (
        <button
          type="button"
          onClick={() => {
            controller.current?.abort()
            setProgress(
              'Cancel requested. CrownKeep will stop before the next benchmark path and restore the previous model after native cleanup.',
            )
          }}
        >
          Cancel benchmark
        </button>
      )}

      <div className="recommended-models">
        {recommendedFamilies.map((family) => (
          <section key={family.alias} className="model-role">
            <h4>{family.role}</h4>
            {renderFamily(family, true)}
          </section>
        ))}
      </div>

      <ModelStorage
        manager={manager}
        candidates={candidates}
        profile={profile}
        results={results}
        busy={busy}
        setBusy={setBusy}
        refresh={refresh}
        onCatalogChanged={onCatalogChanged}
      />

      {otherFamilies.length > 0 && (
        <details className="more-models">
          <summary>More models ({otherFamilies.length})</summary>
          {ROLE_ORDER.map((role) => {
            const roleFamilies = otherFamilies.filter(
              (family) =>
                family.role === role &&
                (!toolsRequired ||
                  role === 'Voice' ||
                  family.variants.some(
                    (variant) => variant.supportsToolCalling,
                  )),
            )
            if (!roleFamilies.length) return null
            return (
              <section key={role} className="model-role">
                <h4>{role}</h4>
                {roleFamilies.map((family) => renderFamily(family))}
              </section>
            )
          })}
        </details>
      )}
    </div>
  )
}
