import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { AIProvider } from '../providers/AIProvider.ts'
import type { LocalRuntimeManager, RuntimeModelCandidate } from './LocalRuntimeManager.ts'
import { ModelStorage } from './ModelStorage.tsx'
import { apiModelMatchesAlias } from './systemFoundryState.ts'
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

function traceBenchmark(event: string, detail: string, requestId?: string) {
  try {
    void invoke('crownkeep_trace', {
      scope: 'benchmark',
      event,
      detail,
      requestId,
    }).catch(() => {})
  } catch {
    // Browser-only tests do not have the Tauri bridge.
  }
}

const ROLE_ORDER: ModelRole[] = ['Quick', 'Balanced', 'Deep', 'Voice']
const ROLE_PRIORITIES: Record<ModelRole, string[]> = {
  Quick: ['phi-4-mini'],
  Balanced: [],
  Deep: ['gpt-oss-20b'],
  Voice: ['whisper-base', 'whisper-tiny', 'whisper-small'],
}

function preferredFamilyForRole(
  families: ModelFamily[],
  role: ModelRole,
  results: BenchmarkResult[],
  fingerprint?: string,
): ModelFamily | undefined {
  const inRole = families.filter((family) => family.role === role)
  if (!inRole.length) return undefined

  const currentResults = fingerprint
    ? results.filter((result) => result.fingerprint === fingerprint)
    : []

  const familyWasAttempted = (family: ModelFamily) =>
    currentResults.some(
      (result) =>
        result.alias.toLowerCase() === family.alias.toLowerCase(),
    )

  const familyIsValidated = (family: ModelFamily) =>
    currentResults.some(
      (result) =>
        result.alias.toLowerCase() === family.alias.toLowerCase() &&
        result.outcome === 'accepted' &&
        result.firstTokenMs !== undefined &&
        (role === 'Quick' || result.realWorldValidated === true),
    )

  if (fingerprint && role !== 'Voice') {
    const validated = inRole.find(familyIsValidated)
    if (validated) return validated
  }

  for (const alias of ROLE_PRIORITIES[role]) {
    const match = inRole.find(
      (family) => family.alias.toLowerCase() === alias,
    )
    if (!match) continue

    if (!fingerprint || role === 'Quick' || role === 'Voice') return match
    if (!familyWasAttempted(match)) return match
  }

  if (role === 'Quick') {
    return inRole.find(
      (family) => !/reason|deepseek|gpt-oss/i.test(family.alias),
    )
  }

  // A failed/slow family is evidence, not a recommendation. Once the preferred
  // candidates have been attempted without a validated winner, advance through
  // the remaining untried families instead of falling back alphabetically to a
  // family that has already failed on this device.
  return inRole.find((family) => !familyWasAttempted(family))
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
      .map((role) =>
        preferredFamilyForRole(families, role, results, profile?.fingerprint),
      )
      .filter((family): family is ModelFamily => Boolean(family)),
    [families, profile?.fingerprint, results],
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
    if (!profile?.fingerprint) return
    setResults(readResults(localStorage))
  }, [profile?.fingerprint, candidates])

  useEffect(() => {
    let disposed = false
    void invoke<DeviceProfile>('crownkeep_device_profile')
      .then((value) => {
        if (!disposed) {
          setProfile(value)
          setResults(readResults(localStorage))
        }
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
      setResults(readResults(localStorage))
      onCatalogChanged()
      await refresh()
      setProgress('Discovery complete. CrownKeep reduced the catalog to recommended model families below.')
    } catch (e) {
      traceBenchmark('analyze-error', `error=${String(e)}`)
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function waitForLoadedModel(alias: string) {
    let lastError: unknown
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        const models = await provider.listModels()
        const actual = models.find(
          (model) => apiModelMatchesAlias(alias, model.id),
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

    // CrownKeep evaluates an alias once. System Foundry chooses its compatible
    // variant/device path; the variant rows remain diagnostic-only.
    return viable.slice(0, 1)
  }

  async function benchmark(alias: string) {
    if (!profile || busy) return
    const family = families.find((item) => item.alias === alias)
    if (!family || family.role === 'Voice') return

    const paths = benchmarkPaths(family)
    const traceId = crypto.randomUUID()
    traceBenchmark(
      'begin',
      `alias=${alias} role=${family.role} fingerprint=${profile.fingerprint} paths=[${paths
        .map(
          (candidate) =>
            `${candidate.id}|${candidate.executionProvider ?? '-'}|${candidate.device ?? '-'}|cached=${candidate.cached}`,
        )
        .join(',')}]`,
      traceId,
    )
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
    traceBenchmark(
      'previous-model',
      `id=${previous?.id ?? '-'} ep=${previous?.executionProvider ?? '-'} device=${previous?.device ?? '-'}`,
      traceId,
    )
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

        traceBenchmark(
          'candidate-begin',
          `index=${index}/${paths.length} variant=${candidate.id} ep=${candidate.executionProvider ?? '-'} device=${candidate.device ?? '-'} cached=${candidate.cached}`,
          traceId,
        )

        let started = performance.now()
        try {
          setProgress(
            `${index}/${paths.length} · Preparing ${alias} · ${candidate.executionProvider ?? candidate.device ?? 'Default'}…`,
          )
          await manager.activateModel(alias)
          traceBenchmark(
            'candidate-activated',
            `variant=${candidate.id}`,
            traceId,
          )
          record.cached = true
          if (abort.signal.aborted) break

          const actual = await waitForLoadedModel(alias)
          const actualCandidate = candidates.find((item) => normalized(item.id) === normalized(actual.id))
          record.variantId = actual.id
          record.executionProvider = actualCandidate?.executionProvider
          record.device = actualCandidate?.device
          traceBenchmark(
            'candidate-api-model',
            `variant=${candidate.id} apiModel=${actual.id}`,
            traceId,
          )
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
              traceId,
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
          const speedAccepted =
            (record.firstTokenMs ?? Infinity) <= 8000 && record.totalMs <= 20000

          traceBenchmark(
            'speed-result',
            `variant=${candidate.id} apiModel=${actual.id} firstTokenMs=${Math.round(record.firstTokenMs ?? -1)} totalMs=${Math.round(record.totalMs)} tokPerSec=${record.tokensPerSecond?.toFixed(1) ?? '-'} accepted=${speedAccepted}`,
            traceId,
          )

          if (!speedAccepted) {
            record.outcome = 'slow'
          } else {
            setProgress(
              `${index}/${paths.length} · Validating normal chat context · ${candidate.executionProvider ?? candidate.device ?? 'Default'}…`,
            )

            const contextStarted = performance.now()
            let contextText = ''
            const contextSignal = AbortSignal.any([
              abort.signal,
              AbortSignal.timeout(30_000),
            ])

            traceBenchmark(
              'context-begin',
              `variant=${candidate.id} apiModel=${actual.id}`,
              traceId,
            )

            for await (const chunk of provider.streamChat(
              {
                modelId: actual.id,
                maxTokens: 64,
                traceId,
                messages: [
                  {
                    role: 'system',
                    content:
                      'You are Anne, a concise local assistant. Use the supplied project context and answer the final request directly.',
                  },
                  {
                    role: 'user',
                    content:
                      'Project context: CrownKeep is a local-first assistant. Recent work includes runtime startup, model selection, benchmark cleanup, dictation, recovery after stalled requests, and preserving a dependable Quick model. The user wants visible progress, predictable recovery, and model choices based on measured behavior. A previous model answered a tiny benchmark quickly but stalled when normal conversation context was present.',
                  },
                  {
                    role: 'assistant',
                    content:
                      'Understood. I will use the project context and keep the answer concise.',
                  },
                  {
                    role: 'user',
                    content:
                      'In exactly two bullets, state the current priority and the next action.',
                  },
                ],
              },
              contextSignal,
            )) {
              if (chunk.text && record.contextFirstTokenMs === undefined) {
                record.contextFirstTokenMs = performance.now() - contextStarted
              }
              contextText += chunk.text
            }

            record.contextTotalMs = performance.now() - contextStarted
            if (!contextText.trim()) {
              throw new Error('The representative-context probe returned no text.')
            }

            record.realWorldValidated =
              (record.contextFirstTokenMs ?? Infinity) <= 12_000 &&
              record.contextTotalMs <= 30_000
            record.outcome = record.realWorldValidated ? 'accepted' : 'slow'
            traceBenchmark(
              'context-result',
              `variant=${candidate.id} apiModel=${actual.id} firstTokenMs=${Math.round(record.contextFirstTokenMs ?? -1)} totalMs=${Math.round(record.contextTotalMs)} validated=${record.realWorldValidated}`,
              traceId,
            )
            record.detail = record.realWorldValidated
              ? `Normal-context probe passed in ${Math.round(record.contextTotalMs)} ms.`
              : `Normal-context probe was too slow: ${Math.round(record.contextFirstTokenMs ?? 0)} ms first token / ${Math.round(record.contextTotalMs)} ms total.`

            if (
              record.realWorldValidated &&
              record.supportsToolCalling === undefined &&
              provider.probeToolCalling
            ) {
              setProgress(
                `${index}/${paths.length} · Checking local tool-call support · ${candidate.executionProvider ?? candidate.device ?? 'Default'}…`,
              )
              try {
                const toolSignal = AbortSignal.any([
                  abort.signal,
                  AbortSignal.timeout(15_000),
                ])
                record.supportsToolCalling = await provider.probeToolCalling(
                  actual.id,
                  toolSignal,
                )
                traceBenchmark(
                  'tool-capability',
                  `variant=${candidate.id} apiModel=${actual.id} supported=${String(record.supportsToolCalling ?? 'unknown')}`,
                  traceId,
                )
                record.detail +=
                  record.supportsToolCalling === true
                    ? ' Local structured tool calling passed.'
                    : record.supportsToolCalling === false
                      ? ' Local structured tool calling was not supported.'
                      : ' Local structured tool-call support was inconclusive.'
              } catch (toolError) {
                traceBenchmark(
                  'tool-capability',
                  `variant=${candidate.id} apiModel=${actual.id} supported=unknown error=${String(toolError)}`,
                  traceId,
                )
                record.detail +=
                  ' Local structured tool-call support was inconclusive.'
              }
            }
          }
        } catch (e) {
          record.totalMs = performance.now() - started
          record.outcome = abort.signal.aborted ? 'cancelled' : 'error'
          record.detail = String(e)
          traceBenchmark(
            'candidate-error',
            `variant=${candidate.id} elapsedMs=${Math.round(record.totalMs)} aborted=${abort.signal.aborted} error=${String(e)}`,
            traceId,
          )
        }

        traceBenchmark(
          'candidate-finish',
          `variant=${candidate.id} outcome=${record.outcome} firstTokenMs=${Math.round(record.firstTokenMs ?? -1)} totalMs=${Math.round(record.totalMs)} contextValidated=${record.realWorldValidated ?? false}`,
          traceId,
        )
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
      traceBenchmark(
        'selection',
        winner
          ? `winner=${winner.variantId} ep=${winner.executionProvider ?? '-'} device=${winner.device ?? '-'} firstTokenMs=${Math.round(winner.firstTokenMs ?? -1)} contextValidated=${winner.realWorldValidated ?? false}`
          : 'winner=-',
        traceId,
      )
      if (winner && !abort.signal.aborted) {
        if (family.role === 'Quick') {
          setProgress(
            `Loading measured winner: ${alias} · ${winner.executionProvider ?? winner.device}…`,
          )
          await manager.activateModel(winner.alias)
          localStorage.setItem(PREFERRED_PROFILE_KEY, JSON.stringify(winner))
          localStorage.setItem('crownkeep.preferredWindowsModel', winner.alias)
          selected = true
          setProgress(
            `Ready · ${alias} · measured ${Math.round(winner.firstTokenMs!)} ms to first token. Quick startup preference saved for this device.`,
          )
        } else if (previous) {
          setProgress(
            `${family.role} winner recorded: ${alias} · ${winner.executionProvider ?? winner.device} · ${Math.round(winner.firstTokenMs!)} ms. Restoring the everyday Quick model…`,
          )
          traceBenchmark('restore-quick-begin', `id=${previous.id}`, traceId)
          await manager.activateModel(previous.alias)
          traceBenchmark('restore-quick-ready', `id=${previous.id}`, traceId)
          selected = true
          setProgress(
            `Recorded ${family.role} winner: ${alias} · ${winner.executionProvider ?? winner.device} · ${Math.round(winner.firstTokenMs!)} ms. Quick model restored.`,
          )
        } else {
          // With no prior chat model to restore, leave the measured winner active,
          // but do not promote it to the Windows startup preference.
          await manager.activateModel(winner.alias)
          selected = true
          setProgress(
            `Recorded ${family.role} winner: ${alias} · ${winner.executionProvider ?? winner.device} · ${Math.round(winner.firstTokenMs!)} ms. No prior Quick model was available to restore.`,
          )
        }
      } else if (previous) {
        setProgress(
          abort.signal.aborted
            ? 'Cancel requested. Restoring the previous model after native cleanup…'
            : 'No interactive path passed. Restoring the previous model…',
        )
        traceBenchmark('restore-previous-begin', `id=${previous.id}`, traceId)
        await manager.activateModel(previous.alias)
        traceBenchmark('restore-previous-ready', `id=${previous.id}`, traceId)
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
          await manager.activateModel(previous.alias)
          await refresh()
        } catch (recoveryError) {
          traceBenchmark(
            'recovery-failed',
            `previous=${previous.id} error=${String(recoveryError)}`,
            traceId,
          )
          setError(
            `Model recovery needs attention: ${String(recoveryError)}`,
          )
        }
      }
    } finally {
      traceBenchmark(
        'end',
        `alias=${alias} selected=${selected} previous=${previous?.id ?? '-'}`,
        traceId,
      )
      controller.current = null
      setRunning(false)
      setBusy(false)
      onReady(selected || Boolean(previous))
    }
  }

  function renderFamily(family: ModelFamily, recommended = false) {
    const observedRaw =
      profile && bestObserved(results, profile.fingerprint, family.alias)
    const observed =
      observedRaw &&
      (family.role === 'Quick' || observedRaw.realWorldValidated === true)
        ? observedRaw
        : undefined
    const legacyObserved =
      observedRaw && family.role !== 'Quick' && observedRaw.realWorldValidated !== true
        ? observedRaw
        : undefined
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
            {observed.realWorldValidated ? ' · normal context passed' : ''}
            {observed.supportsToolCalling === true
              ? ' · structured tools passed'
              : observed.supportsToolCalling === false
                ? ' · structured tools unsupported'
                : ''}
          </span>
        )}
        {legacyObserved && (
          <span>
            Prior speed-only result: {legacyObserved.executionProvider ?? legacyObserved.device} ·{' '}
            {Math.round(legacyObserved.firstTokenMs!)} ms first token · needs normal-context revalidation
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
                  `${result.outcome === 'error' ? 'runtime/benchmark error' : result.outcome} · ${(result.totalMs / 1000).toFixed(2)} s${result.realWorldValidated ? ' · context passed' : ''}${result.supportsToolCalling === true ? ' · tools passed' : result.supportsToolCalling === false ? ' · tools unsupported' : ''}${result.contextTotalMs ? ` · context ${(result.contextTotalMs / 1000).toFixed(2)} s` : ''} · ${result.timestamp}${result.detail ? ` · ${result.detail}` : ''}`}
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
        CrownKeep shows one recommended family per role. Compare first measures a
        short speed prompt, then requires a representative normal-chat context
        probe before Balanced or Deep can become a usable winner. Raw variants and
        the rest of the catalog stay under Advanced / More models.
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
