import { useEffect, useRef, useState } from 'react'

export function WebQueryReview({ initial, onDone }: { initial: string; onDone(query: string | null): void }) {
  const [query, setQuery] = useState(initial)
  const input = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  return <div className="roadmap-modal"><section className="roadmap-modal-panel" role="dialog" aria-modal="true" aria-label="Review web query" onKeyDown={(event) => { if (event.key === 'Escape') onDone(null) }}>
    <h2>Review web query</h2>
    <p>Confirm the subject and remove private details. Only this query will leave the device.</p>
    <label>Public search query<textarea ref={input} value={query} maxLength={320} onChange={(event) => setQuery(event.target.value)} /></label>
    <button type="button" onClick={() => onDone(null)}>Cancel</button>
    <button type="button" disabled={!query.trim()} onClick={() => onDone(query.trim())}>Search</button>
  </section></div>
}
