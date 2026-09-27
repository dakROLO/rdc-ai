import { useMemo, useState } from 'react'
import type { LocalRuntimeManager, RuntimeModelCandidate } from './LocalRuntimeManager.ts'
import { bestObserved } from './modelPolicy.ts'
import type { BenchmarkResult, DeviceProfile } from './modelPolicy.ts'

interface Props {
  manager: LocalRuntimeManager
  candidates: RuntimeModelCandidate[]
  profile?: DeviceProfile
  results: BenchmarkResult[]
  busy: boolean
  setBusy(value: boolean): void
  refresh(): Promise<void>
  onCatalogChanged(): void
}

function formatSize(mb?: number): string {
  if (!mb) return 'Size unavailable'
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10_240 ? 1 : 2)} GB`
  return `${Math.round(mb)} MB`
}


function executionLabel(candidate: RuntimeModelCandidate): string {
  const provider = candidate.executionProvider ?? ''
  if (/cuda/i.test(provider)) return 'NVIDIA dGPU · CUDA'
  if (/tensorrt/i.test(provider)) return 'NVIDIA dGPU · TensorRT RTX'
  if (/webgpu/i.test(provider)) return 'GPU · WebGPU'
  if (/openvino/i.test(provider)) return 'Intel / compatible accelerator · OpenVINO'
  if (/cpu/i.test(provider)) return 'CPU'
  return provider || candidate.device || 'Default'
}

export function ModelStorage({
  manager,
  candidates,
  profile,
  results,
  busy,
  setBusy,
  refresh,
  onCatalogChanged,
}: Props) {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())

  const cached = useMemo(
    () =>
      candidates
        .filter((candidate) => candidate.cached && !removedIds.has(candidate.id))
        .sort(
          (a, b) =>
            Number(b.loaded) - Number(a.loaded) ||
            a.alias.localeCompare(b.alias) ||
            a.id.localeCompare(b.id),
        ),
    [candidates, removedIds],
  )

  const totalKnownMb = cached.reduce(
    (sum, candidate) => sum + (candidate.fileSizeMb ?? 0),
    0,
  )
  const unknownSizeCount = cached.filter((candidate) => !candidate.fileSizeMb).length

  const winnerIds = useMemo(() => {
    const protectedIds = new Set<string>()
    if (!profile) return protectedIds
    const aliases = new Set(
      results
        .filter(
          (result) =>
            result.fingerprint === profile.fingerprint &&
            result.outcome === 'accepted',
        )
        .map((result) => result.alias),
    )
    for (const alias of aliases) {
      const winner = bestObserved(results, profile.fingerprint, alias)
      if (winner) protectedIds.add(winner.variantId)
    }
    return protectedIds
  }, [profile, results])

  const selectedVoiceAlias =
    localStorage.getItem('crownkeep.speechAlias')?.toLowerCase() ?? ''

  const measuredLosers = useMemo(() => {
    if (!profile) return []
    return cached.filter((candidate) => {
      if (candidate.loaded || winnerIds.has(candidate.id)) return false
      if (
        selectedVoiceAlias &&
        candidate.alias.toLowerCase() === selectedVoiceAlias
      ) {
        return false
      }
      return results.some(
        (result) =>
          result.fingerprint === profile.fingerprint &&
          result.variantId === candidate.id,
      )
    })
  }, [cached, profile, results, selectedVoiceAlias, winnerIds])

  async function refreshStorage() {
    onCatalogChanged()
    await refresh()
  }

  async function unload(candidate: RuntimeModelCandidate) {
    if (busy || !candidate.loaded) return
    setBusy(true)
    setError('')
    setMessage(`Unloading ${candidate.alias}…`)
    try {
      const result = await manager.unloadModel(candidate.id)
      setMessage(result.detail)
      await refreshStorage()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function remove(candidate: RuntimeModelCandidate) {
    if (busy || candidate.loaded) return
    const protectedWinner = winnerIds.has(candidate.id)
    const protectedVoice =
      selectedVoiceAlias &&
      candidate.alias.toLowerCase() === selectedVoiceAlias

    if (protectedWinner || protectedVoice) return

    if (
      !window.confirm(
        `Delete ${candidate.alias} (${candidate.id}) from this device? CrownKeep can download it again later.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    setMessage(`Deleting ${candidate.alias} from this device…`)
    try {
      const result = await manager.removeCachedModel(candidate.id)
      setRemovedIds((current) => {
        const next = new Set(current)
        next.add(candidate.id)
        return next
      })
      setMessage(result.detail)
      await refreshStorage()
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  async function cleanMeasuredBenchmarkLosers() {
    if (busy || measuredLosers.length === 0) return
    const total = measuredLosers.reduce(
      (sum, candidate) => sum + (candidate.fileSizeMb ?? 0),
      0,
    )
    const label =
      total > 0
        ? `about ${formatSize(total)}`
        : `${measuredLosers.length} cached variant(s)`

    if (
      !window.confirm(
        `Delete ${measuredLosers.length} cached benchmark loser(s), freeing ${label}? Measured winners and the selected Voice model will be kept. This can also remove a losing variant that was already cached before benchmarking.`,
      )
    ) {
      return
    }

    setBusy(true)
    setError('')
    let removed = 0
    try {
      for (const candidate of measuredLosers) {
        setMessage(
          `Cleaning benchmark download ${removed + 1}/${measuredLosers.length}: ${candidate.alias}…`,
        )
        await manager.removeCachedModel(candidate.id)
        setRemovedIds((current) => {
          const next = new Set(current)
          next.add(candidate.id)
          return next
        })
        removed += 1
      }
      setMessage(
        `Removed ${removed} benchmark download(s). Measured winners were kept.`,
      )
      await refreshStorage()
    } catch (e) {
      setError(
        `Cleanup stopped after ${removed} removal(s): ${String(e)}`,
      )
      await refreshStorage()
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className="model-storage">
      <summary>
        Model Storage · {cached.length} cached variant{cached.length === 1 ? '' : 's'} ·{' '}
        {formatSize(totalKnownMb)}
        {unknownSizeCount > 0 ? '+' : ''}
      </summary>

      <div className="model-storage-body">
        <p>
          Downloaded models stay on this device until you remove them. Unloading
          releases memory; deleting removes the cached files from disk.
        </p>

        <div className="model-storage-actions">
          <button
            type="button"
            disabled={busy || measuredLosers.length === 0}
            onClick={() => void cleanMeasuredBenchmarkLosers()}
          >
            Clean measured benchmark losers
          </button>
          <span>
            {measuredLosers.length > 0
              ? `${measuredLosers.length} measured losing variant(s) can be removed; winners and Voice stay protected.`
              : 'No cached measured losers are currently available for cleanup.'}
          </span>
        </div>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}

        {cached.length === 0 ? (
          <p>No Foundry model variants are currently cached.</p>
        ) : (
          <div className="model-storage-list">
            {cached.map((candidate) => {
              const protectedWinner = winnerIds.has(candidate.id)
              const protectedVoice =
                Boolean(selectedVoiceAlias) &&
                candidate.alias.toLowerCase() === selectedVoiceAlias
              const measured =
                profile &&
                results.find(
                  (result) =>
                    result.fingerprint === profile.fingerprint &&
                    result.variantId === candidate.id,
                )

              return (
                <div className="model-storage-row" key={candidate.id}>
                  <div>
                    <strong>{candidate.alias}</strong>
                    <span>{candidate.id}</span>
                    <span>
                      {executionLabel(candidate)} ·{' '}
                      {formatSize(candidate.fileSizeMb)}
                      {candidate.loaded ? ' · Loaded' : ''}
                    </span>
                    {measured && (
                      <span>
                        Benchmark: {measured.outcome}
                        {measured.firstTokenMs !== undefined
                          ? ` · ${Math.round(measured.firstTokenMs)} ms first token`
                          : ''}
                      </span>
                    )}
                    {(protectedWinner || protectedVoice) && (
                      <span className="model-storage-protected">
                        {protectedWinner ? 'Measured winner' : ''}
                        {protectedWinner && protectedVoice ? ' · ' : ''}
                        {protectedVoice ? 'Selected Voice model' : ''}
                      </span>
                    )}
                  </div>

                  <div className="model-storage-row-actions">
                    {candidate.loaded && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void unload(candidate)}
                      >
                        Unload
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={
                        busy ||
                        candidate.loaded ||
                        protectedWinner ||
                        protectedVoice
                      }
                      title={
                        protectedWinner
                          ? 'Measured winners are protected. Benchmark or select a replacement before deleting this variant.'
                          : protectedVoice
                            ? 'The selected Voice model is protected. Choose another Voice model first.'
                            : candidate.loaded
                              ? 'Unload this model before deleting its cached files.'
                              : 'Delete this cached variant from the device.'
                      }
                      onClick={() => void remove(candidate)}
                    >
                      Delete from device
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </details>
  )
}
