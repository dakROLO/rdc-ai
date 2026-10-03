import { useEffect, useMemo, useRef, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { createSpeechProvider } from './providers.ts'
import type { SpeechCapability } from './SpeechInputProvider.ts'

type Phase = 'ready' | 'starting' | 'listening' | 'transcribing' | 'cancelling'

interface NativeSpeechProgress {
  stage: string
  message: string
  modelId?: string
  alias?: string
  percent?: number
}

export function DictationControl({
  disabled,
  conversationId,
  onText,
  onBusy,
  refreshKey,
  compact = false,
}: {
  disabled: boolean
  conversationId?: string
  onText(text: string): void
  onBusy(busy: boolean): void
  refreshKey: number
  compact?: boolean
}) {
  const provider = useMemo(createSpeechProvider, [])
  const [capability, setCapability] = useState<SpeechCapability>({
    available: false,
    detail: 'Checking local dictation…',
  })
  const [phase, setPhase] = useState<Phase>('ready')
  const [message, setMessage] = useState('')
  const [nativeProgress, setNativeProgress] = useState<NativeSpeechProgress>()
  const epoch = useRef(0)
  const pending = useRef(false)
  const active = useRef(false)
  const onBusyRef = useRef(onBusy)
  onBusyRef.current = onBusy

  useEffect(() => {
    let disposed = false
    if (!active.current) {
      void provider
        .capability()
        .then((next) => {
          if (!disposed) setCapability(next)
        })
        .catch(() => {
          if (!disposed) {
            setCapability({
              available: false,
              detail:
                'Local speech discovery failed. Recheck Local AI to retry.',
            })
          }
        })
    }
    return () => {
      disposed = true
    }
  }, [provider, refreshKey])

  useEffect(() => {
    if (!isTauri()) return

    const subscription = listen<NativeSpeechProgress>(
      'crownkeep-speech-progress',
      (event) => {
        if (!active.current) return
        setNativeProgress(event.payload)
        setMessage(event.payload.message)
      },
    )
    return () => {
      void subscription.then((unlisten) => unlisten())
    }
  }, [])

  useEffect(() => {
    const cancelOnHide = () => {
      if (document.hidden) void cancel()
    }
    document.addEventListener('visibilitychange', cancelOnHide)
    return () => {
      document.removeEventListener('visibilitychange', cancelOnHide)
      epoch.current += 1
      void provider.cancel()
      active.current = false
      onBusyRef.current(false)
    }
  }, [provider, conversationId])

  useEffect(() => {
    if (phase !== 'listening') return
    const timeout = window.setTimeout(() => void finish(), 60_000)
    return () => window.clearTimeout(timeout)
  }, [phase])

  async function cancel() {
    if (!active.current) return
    epoch.current += 1
    setNativeProgress(undefined)
    setPhase('cancelling')
    setMessage(
      pending.current
        ? 'Cancel requested · finishing native cleanup and restoring chat…'
        : 'Dictation cancelled.',
    )
    await provider.cancel()

    // Native inference/download work cannot always be preempted safely. Keep the
    // shared runtime locked until the in-flight command returns and cleans up.
    if (!pending.current) {
      active.current = false
      setPhase('ready')
      onBusy(false)
    }
  }

  async function start() {
    if (disabled || active.current || !capability.available) return
    active.current = true
    pending.current = true
    const id = ++epoch.current
    setNativeProgress(undefined)
    setPhase('starting')
    setMessage('Preparing microphone…')
    onBusy(true)

    try {
      await provider.startCapture()
      if (id !== epoch.current) {
        await provider.cancel()
        return
      }
      setPhase('listening')
      setMessage('Listening · stop to review your transcript.')
    } catch (error) {
      if (id === epoch.current) setMessage(String(error))
      active.current = false
    } finally {
      pending.current = false
      if (!active.current || id !== epoch.current) {
        active.current = false
        setPhase('ready')
        onBusy(false)
      }
    }
  }

  async function finish() {
    if (!active.current || pending.current) return
    const id = epoch.current
    pending.current = true
    setNativeProgress(undefined)
    setPhase('transcribing')
    setMessage('Preparing local transcription…')

    try {
      await provider.stopCapture()
      if (id !== epoch.current) return

      const text = await provider.transcribe()
      if (id === epoch.current) {
        if (text.trim()) onText(text.trim())
        setMessage(
          text.trim()
            ? 'Ready · review and edit before sending.'
            : 'No speech detected. Try again.',
        )
      }
    } catch (error) {
      if (id === epoch.current) setMessage(String(error))
    } finally {
      await provider.cancel()
      pending.current = false
      active.current = false
      setPhase('ready')
      setNativeProgress(undefined)
      onBusy(false)
    }
  }

  const buttonLabel =
    phase === 'listening'
      ? '■ Stop mic'
      : phase === 'starting'
        ? 'Preparing…'
        : phase === 'transcribing'
          ? nativeProgress?.stage === 'downloading'
            ? 'Downloading…'
            : nativeProgress?.stage === 'restoring-chat'
              ? 'Restoring…'
              : 'Transcribing…'
          : phase === 'cancelling'
            ? 'Releasing…'
            : 'Dictate'

  return (
    <div className={`dictation-control${compact ? ' compact' : ''}`}>
      <button
        type="button"
        className="secondary-button"
        title={capability.detail}
        aria-label={
          phase === 'listening'
            ? 'Stop dictation and transcribe'
            : 'Start local dictation'
        }
        disabled={
          phase === 'ready'
            ? disabled || !capability.available
            : phase !== 'listening'
        }
        onClick={() => void (phase === 'listening' ? finish() : start())}
      >
        {buttonLabel}
      </button>

      {phase !== 'ready' && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => void cancel()}
          disabled={phase === 'cancelling'}
        >
          Cancel
        </button>
      )}

      {(!compact || phase !== 'ready') && (
        <span className="dictation-status" role="status" aria-live="polite">
          {message || (!capability.available ? capability.detail : '')}
        </span>
      )}

      {nativeProgress?.percent !== undefined && phase !== 'ready' && (
        <span className="dictation-progress">
          <progress max={100} value={nativeProgress.percent} />
          <small>{Math.round(nativeProgress.percent)}%</small>
        </span>
      )}
    </div>
  )
}
