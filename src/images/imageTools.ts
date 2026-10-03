import { invoke, isTauri } from '@tauri-apps/api/core'
import { createWorker } from 'tesseract.js'
import { getNativeAIHost } from '../native/NativeAIHost.ts'

export function localGeneratorEndpoint(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('Use an HTTP loopback address such as http://127.0.0.1:7860. Remote image services are not enabled.')
  }
  return url.origin
}

export async function imageDataUrl(file: Blob): Promise<string> {
  if (file.size > 15 * 1024 * 1024) throw new Error('Choose an image smaller than 15 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image preview is unavailable.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  } finally { bitmap.close() }
}

export async function recognizeImage(dataUrl: string): Promise<string> {
  const native = getNativeAIHost()?.images
  if (native) return native.recognize(dataUrl)
  // Every worker/core/language URL is bundled with the application. No CDN,
  // upload or remote inference is used for OCR, including on Windows.
  const base = new URL('/ocr/', location.href).href
  const worker = await createWorker('eng', 1, {
    workerPath: `${base}worker.min.js`, corePath: base, langPath: base,
    gzip: false, workerBlobURL: true,
  })
  try { return (await worker.recognize(dataUrl)).data.text.slice(0, 12_000) }
  finally { await worker.terminate() }
}

export async function generateImage(prompt: string, endpoint: string): Promise<string> {
  if (!prompt.trim() || prompt.length > 2000) throw new Error('Use a prompt between 1 and 2,000 characters.')
  const native = getNativeAIHost()?.images
  if (native) return native.generate(prompt)
  const origin = localGeneratorEndpoint(endpoint)
  if (!isTauri()) throw new Error('Windows image generation requires the native CrownKeep app and a local Stable Diffusion WebUI started with --api.')
  const dataUrl = await invoke<string>('crownkeep_generate_image', { endpoint: origin, prompt })
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) throw new Error('The image app returned an invalid image.')
  const response = await fetch(dataUrl)
  return imageDataUrl(await response.blob())
}
