import { invoke, isTauri } from '@tauri-apps/api/core'
import type { SpeechInputProvider, SpeechCapability } from './SpeechInputProvider.ts'
import { getNativeAIHost } from '../native/NativeAIHost.ts'
import type { RuntimeModelCandidate } from '../runtime/LocalRuntimeManager.ts'
import { taskOf } from '../runtime/modelPolicy.ts'

class WindowsSpeechInput implements SpeechInputProvider {
  private stream?: MediaStream
  private context?: AudioContext
  private processor?: ScriptProcessorNode
  private source?: MediaStreamAudioSourceNode
  private chunks: Float32Array[] = []
  private wav?: number[]
  private model = ''
  private epoch = 0
  private frames = 0
  private rate = 16000
  async capability(): Promise<SpeechCapability> {
    if (!navigator.mediaDevices?.getUserMedia) return { available: false, detail: 'Microphone capture is unavailable in this host.' }
    const models = (await invoke<RuntimeModelCandidate[]>('crownkeep_foundry_models'))
      .filter((m) => taskOf(m) === 'speech' && /whisper-(tiny|base|small)/i.test(m.alias))
      .sort((a, b) => (a.fileSizeMb ?? Infinity) - (b.fileSizeMb ?? Infinity))
    // Alias allows the native SDK to resolve the hardware variant normally.
    const preference = localStorage.getItem('crownkeep.speechAlias')
    this.model =
      models.find((m) => m.alias === preference)?.alias ??
      models.find((m) => m.alias.toLowerCase() === 'whisper-base')?.alias ??
      models[0]?.alias ??
      ''
    return { available: !!this.model, detail: this.model ? `Local ${this.model}. First use may download the model; review text before sending. Record up to 60 seconds.` : 'No compatible Whisper speech model found. Run device analysis; text chat remains available.' }
  }
  async startCapture() {
    const epoch = ++this.epoch
    this.chunks = []; this.wav = undefined; this.frames = 0
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true }, video: false })
    if (epoch !== this.epoch) { stream.getTracks().forEach((t) => t.stop()); throw new Error('Dictation cancelled.') }
    this.stream = stream
    try {
      this.context = new AudioContext({ sampleRate: 16000 })
      await this.context.resume()
      if (epoch !== this.epoch) throw new Error('Dictation cancelled.')
      this.rate = this.context.sampleRate
      this.source = this.context.createMediaStreamSource(stream)
      this.processor = this.context.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (event) => {
        if (this.frames >= this.rate * 60) return
        const chunk = event.inputBuffer.getChannelData(0).slice(0, this.rate * 60 - this.frames)
        this.chunks.push(chunk); this.frames += chunk.length
        event.outputBuffer.getChannelData(0).fill(0)
      }
      this.source.connect(this.processor); this.processor.connect(this.context.destination)
    } catch (error) { await this.cancel(); throw error }
  }
  async stopCapture() {
    await this.release()
    if (!this.frames) throw new Error('No microphone audio was captured.')
    const buffer = new ArrayBuffer(44 + this.frames * 2)
    const view = new DataView(buffer)
    const text = (offset: number, value: string) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
    text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
    view.setUint32(24, this.rate, true); view.setUint32(28, this.rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true)
    text(36, 'data'); view.setUint32(40, this.frames * 2, true)
    let offset = 44
    for (const chunk of this.chunks) for (const sample of chunk) { view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 32767, true); offset += 2 }
    this.wav = Array.from(new Uint8Array(buffer)); this.chunks = []
  }
  async transcribe() {
    if (!this.wav || !this.model) throw new Error('No local recording or speech model is ready.')
    const epoch = this.epoch
    try {
      const result = await Promise.race([
        invoke<{ text: string; elapsedMs: number; modelId: string }>(
          'crownkeep_transcribe',
          { audio: this.wav, modelId: this.model },
        ),
        new Promise<never>((_, reject) =>
          window.setTimeout(
            () => reject(new Error('Local dictation exceeded the 10-minute safety limit. Restart CrownKeep if native cleanup does not finish.')),
            10 * 60 * 1000,
          ),
        ),
      ])
      if (epoch !== this.epoch) throw new Error('Dictation cancelled.')
      // Store only performance metadata; never audio or transcript text.
      localStorage.setItem('crownkeep.speechObservation', JSON.stringify({ alias: this.model, variantId: result.modelId,
        timestamp: new Date().toISOString(), audioSeconds: this.frames / this.rate, transcriptionMs: result.elapsedMs }))
      return result.text
    } finally { this.wav = undefined }
  }
  private async release() {
    this.stream?.getTracks().forEach((t) => t.stop()); this.stream = undefined
    this.processor?.disconnect(); this.source?.disconnect()
    if (this.processor) this.processor.onaudioprocess = null
    this.processor = undefined; this.source = undefined
    const context = this.context; this.context = undefined
    if (context && context.state !== 'closed') await context.close()
  }
  async cancel() { this.epoch++; await this.release(); this.chunks = []; this.wav = undefined; this.frames = 0 }
}
export function createSpeechProvider(): SpeechInputProvider {
  const native = getNativeAIHost()?.speech
  if (native) return native
  if (isTauri()) return new WindowsSpeechInput()
  return {
    capability: async () => ({ available: false, detail: 'Local dictation requires the native Windows or iPhone app.' }),
    startCapture: async () => { throw new Error('Local dictation unavailable.') },
    stopCapture: async () => {}, transcribe: async () => '', cancel: async () => {},
  }
}
