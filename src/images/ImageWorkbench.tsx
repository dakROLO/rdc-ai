import { useEffect, useRef, useState } from 'react'
import { imageDataUrl, recognizeImage, generateImage, understandImage } from './imageTools.ts'
import { imageCapabilities } from './imageCapabilities.ts'
import { getNativeAIHost } from '../native/NativeAIHost.ts'
import type { ImageAttachment } from '../domain/conversation.ts'
import { createId } from '../utils/id.ts'

export function ImageWorkbench({ onUse, onClose }: { onUse(image: ImageAttachment): void; onClose(): void }) {
  const [image, setImage] = useState<ImageAttachment | null>(null)
  const [description, setDescription] = useState('')
  const [endpoint, setEndpoint] = useState(() => localStorage.getItem('crownkeep.imageEndpoint') ?? 'http://127.0.0.1:7860')
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState('')
  const [error, setError] = useState('')
  const [capability, setCapability] = useState(imageCapabilities())
  const [question, setQuestion] = useState('Describe this image.')
  const native = getNativeAIHost()?.images
  const mounted = useRef(true)
  const fileInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    mounted.current = true
    if (native) void native.status().then((status) => { if (mounted.current) setCapability(imageCapabilities(status)) }).catch(() => {})
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose() }
    document.addEventListener('keydown', key)
    return () => { mounted.current = false; document.removeEventListener('keydown', key) }
  }, [native, busy, onClose])
  async function select(file?: File) {
    if (!file) return
    setBusy(true); setError(''); setDetail('Reading text on this device…'); setImage(null)
    try {
      const dataUrl = await imageDataUrl(file)
      const extractedText = await recognizeImage(dataUrl)
      if (mounted.current) {
        setImage({ id: createId('image'), name: file.name, dataUrl, extractedText, kind: 'selected' })
        setDetail(extractedText.trim() ? 'Review the extracted text before adding it to your message.' : 'No text found. This local path extracts text; it does not describe the picture.')
      }
    } catch (failure) { if (mounted.current) setError(String(failure)) }
    finally { if (mounted.current) setBusy(false) }
  }
  async function analyze() {
    if (!image) return
    setBusy(true); setError(''); setDetail('Analyzing on this device…')
    try {
      const understanding = await understandImage(image.dataUrl, question)
      if (mounted.current) { setImage({ ...image, understanding }); setDetail('Local analysis ready. Add it to your message.') }
    } catch (failure) { if (mounted.current) setError(String(failure)) }
    finally { if (mounted.current) setBusy(false) }
  }
  async function generate() {
    setBusy(true); setError(''); setDetail('Generating on this device…')
    try {
      const dataUrl = await generateImage(description, endpoint)
      if (mounted.current) { setImage({ id: createId('image'), name: 'Generated image', dataUrl, extractedText: '', kind: 'generated' }); setDetail('Image ready. Save it or keep it with a message.'); localStorage.setItem('crownkeep.imageEndpoint', endpoint) }
    } catch (failure) { if (mounted.current) setError(String(failure)) }
    finally { if (mounted.current) setBusy(false) }
  }
  return <div className="roadmap-modal"><section className="roadmap-modal-panel image-workbench" role="dialog" aria-modal="true" aria-label="Images">
    <div className="roadmap-modal-header"><h2>Images</h2><button type="button" onClick={onClose} disabled={busy}>Close</button></div>
    <p>Extract text from a photo or screenshot on this device. Review it before Anne uses it. Image text is reference material, not instructions.</p>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/heic,image/heif" aria-label="Choose image" disabled={busy} onChange={(event) => { void select(event.target.files?.[0]); event.target.value = '' }} />
    {native && <section><h3>Understand an image</h3>
      <p>{capability.understandingAvailable ? 'Analyze the selected image with Apple’s on-device model.' : 'Direct image understanding needs a compatible iOS 27 build. Extract text remains available as local OCR.'}</p>
      <label>Ask about the image<input value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
      <button type="button" disabled={busy || !image || !capability.understandingAvailable} onClick={() => void analyze()}>Understand image</button>
      {image?.understanding && <p>{image.understanding}</p>}
    </section>}
    <h3>Create an image</h3>
    <p>{native ? 'Optional local image model. Generation stays on this device once a compatible model is installed.' : 'Uses your local Stable Diffusion WebUI API. Only the image prompt is sent to the loopback service; your chat stays in CrownKeep.'}</p>
    {!native && <label>Local image app address<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} disabled={busy} /></label>}
    <label>Image prompt<textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} disabled={busy} /></label>
    <button type="button" onClick={() => void generate()} disabled={busy || !description.trim() || Boolean(native && !capability.generationAvailable)}>Generate image</button>
    {native && !capability.generationAvailable && <p>The optional local image model is not installed yet. No download or upload happens automatically.</p>}
    <p role="status">{detail}</p>{error && <p role="alert">{error}</p>}
    {image && <div className="image-review"><img src={image.dataUrl} alt={image.name} /><label>Extracted text (editable)<textarea value={image.extractedText} onChange={(event) => setImage({ ...image, extractedText: event.target.value.slice(0, 12_000) })} /></label>
      <a href={image.dataUrl} download="crownkeep-image.jpg">Save image</a>
      <button type="button" disabled={busy} onClick={() => onUse(image)}>Add to message</button>
    </div>}
  </section></div>
}
