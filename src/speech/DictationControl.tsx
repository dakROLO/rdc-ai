import { useEffect, useMemo, useRef, useState } from 'react'
import { createSpeechProvider } from './providers.ts'
import type { SpeechCapability } from './SpeechInputProvider.ts'

type Phase = 'ready' | 'starting' | 'listening' | 'transcribing' | 'cancelling'
export function DictationControl({ disabled, conversationId, onText, onBusy, refreshKey }: {
  disabled: boolean
  conversationId?: string
  onText(text: string): void
  onBusy(busy: boolean): void
  refreshKey: number
}) {
  const provider = useMemo(createSpeechProvider, [])
  const [capability, setCapability] = useState<SpeechCapability>({ available: false, detail: 'Checking local dictation…' })
  const [phase, setPhase] = useState<Phase>('ready')
  const [message, setMessage] = useState('')
  const epoch = useRef(0)
  const pending = useRef(false)
  const active = useRef(false)
  const onBusyRef = useRef(onBusy); onBusyRef.current = onBusy
  useEffect(() => {
    let disposed = false
    if (!active.current) void provider.capability().then((c) => { if (!disposed) setCapability(c) }).catch(() => { if (!disposed) setCapability({ available: false, detail: 'Local speech discovery failed. Recheck Local AI to retry.' }) })
    return () => { disposed = true }
  }, [provider, refreshKey])
  useEffect(() => {
    const cancelOnHide = () => { if (document.hidden) void cancel() }
    document.addEventListener('visibilitychange', cancelOnHide)
    return () => { document.removeEventListener('visibilitychange', cancelOnHide); epoch.current++; void provider.cancel(); active.current = false; onBusyRef.current(false) }
  }, [provider, conversationId])
  useEffect(() => {
    if (phase !== 'listening') return
    const timeout = setTimeout(() => void finish(), 60_000)
    return () => clearTimeout(timeout)
  }, [phase])
  async function cancel() {
    if (!active.current) return
    epoch.current++; setMessage('Dictation cancelled.'); setPhase('cancelling')
    await provider.cancel()
    // Native inference cannot be preempted safely by unloading its model. Keep
    // the shared runtime locked until its command finishes cleanup.
    if (!pending.current) { active.current = false; setPhase('ready'); onBusy(false) }
  }
  async function start() {
    if (disabled || active.current || !capability.available) return
    active.current = true; pending.current = true; const id = ++epoch.current
    setPhase('starting'); setMessage('Preparing microphone…'); onBusy(true)
    try {
      await provider.startCapture()
      if (id !== epoch.current) { await provider.cancel(); return }
      setPhase('listening'); setMessage('Listening · stop to review your transcript.')
    } catch (e) { if (id === epoch.current) setMessage(String(e)); active.current = false }
    finally { pending.current = false; if (!active.current || id !== epoch.current) { active.current = false; setPhase('ready'); onBusy(false) } }
  }
  async function finish() {
    if (!active.current || pending.current) return
    const id = epoch.current; pending.current = true
    setPhase('transcribing'); setMessage('Transcribing locally…')
    try {
      await provider.stopCapture()
      if (id !== epoch.current) return
      const text = await provider.transcribe()
      if (id === epoch.current) { if (text.trim()) onText(text.trim()); setMessage(text.trim() ? 'Ready · review and edit before sending.' : 'No speech detected. Try again.') }
    } catch (e) { if (id === epoch.current) setMessage(String(e)) }
    finally { await provider.cancel(); pending.current = false; active.current = false; setPhase('ready'); onBusy(false) }
  }
  return <div className="dictation-control">
    <button type="button" className="secondary-button" title={capability.detail} aria-label={phase === 'listening' ? 'Stop dictation and transcribe' : 'Start local dictation'} disabled={phase === 'ready' ? disabled || !capability.available : phase !== 'listening'} onClick={() => void (phase === 'listening' ? finish() : start())}>
      {phase === 'listening' ? '■ Stop mic' : phase === 'starting' ? 'Preparing…' : phase === 'transcribing' ? 'Transcribing…' : phase === 'cancelling' ? 'Releasing…' : '🎙 Dictate'}
    </button>
    {phase !== 'ready' && <button type="button" className="secondary-button" onClick={() => void cancel()} disabled={phase === 'cancelling'}>Cancel</button>}
    <span role="status" aria-live="polite">{message || (!capability.available ? capability.detail : '')}</span>
  </div>
}
