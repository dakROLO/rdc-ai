import { invoke, isTauri } from '@tauri-apps/api/core'
import { getNativeAIHost } from '../native/NativeAIHost.ts'
import { imageCapabilities } from './imageCapabilities.ts'
import type { ImageInstallProgress } from './imageCapabilities.ts'
import { generateImage, localGeneratorEndpoint } from './imageTools.ts'
export type ImageRuntimeState = 'stopped' | 'api-invalid' | 'wrong-endpoint' | 'ready' | 'generation-failed' | 'unavailable'
export interface ImageRuntimeStatus {
  state: ImageRuntimeState
  detail: string
  backend: string
  installProgress?: ImageInstallProgress
}
export interface LocalImageRuntime {
  status(): Promise<ImageRuntimeStatus>
  install?(): Promise<ImageRuntimeStatus>
  remove?(): Promise<ImageRuntimeStatus>
  generate(prompt: string): Promise<string>
}
export const IMAGE_PERMISSION_KEY = 'crownkeep.localImageGeneration'
export function imageGenerationEnabled(): boolean { return localStorage.getItem(IMAGE_PERMISSION_KEY) === 'on' }
export function imageEndpoint(): string { return localStorage.getItem('crownkeep.imageEndpoint') ?? 'http://127.0.0.1:7860' }
export function saveImageEndpoint(endpoint: string): void { localStorage.setItem('crownkeep.imageEndpoint', localGeneratorEndpoint(endpoint)) }
export class WindowsWebUIImageRuntime implements LocalImageRuntime {
  async status(): Promise<ImageRuntimeStatus> {
    if (!isTauri()) return { state: 'unavailable', backend: 'WindowsWebUIImageRuntime', detail: 'The native Windows app is required.' }
    try { return await invoke('crownkeep_image_status', { endpoint: localGeneratorEndpoint(imageEndpoint()) }) }
    catch (error) { return { state: 'wrong-endpoint', backend: 'WindowsWebUIImageRuntime', detail: String(error) } }
  }
  async generate(prompt: string): Promise<string> { return generateImage(prompt, imageEndpoint()) }
}
export class AppleLocalImageRuntime implements LocalImageRuntime {
  async status(): Promise<ImageRuntimeStatus> {
    const capabilities = imageCapabilities(await getNativeAIHost()?.images?.status())
    const state: ImageRuntimeState =
      capabilities.generationAvailable ? 'ready'
        : capabilities.generationState === 'not-installed' ? 'unavailable'
          : 'unavailable'
    return { state, backend: 'AppleLocalImageRuntime', detail: capabilities.detail ?? (capabilities.generationAvailable ? 'Local image model ready.' : 'Optional Apple local image model is not installed.'), installProgress: capabilities.installProgress }
  }
  async install(): Promise<ImageRuntimeStatus> {
    const native = getNativeAIHost()?.images
    if (!native?.install) throw new Error('This device does not support installing the local image model.')
    const capabilities = imageCapabilities(await native.install())
    return { state: capabilities.generationAvailable ? 'ready' : 'unavailable', backend: 'AppleLocalImageRuntime', detail: capabilities.detail ?? 'Image model installation finished.', installProgress: capabilities.installProgress }
  }
  async remove(): Promise<ImageRuntimeStatus> {
    const native = getNativeAIHost()?.images
    if (!native?.remove) throw new Error('This device does not support removing the local image model.')
    const capabilities = imageCapabilities(await native.remove())
    return { state: capabilities.generationAvailable ? 'ready' : 'unavailable', backend: 'AppleLocalImageRuntime', detail: capabilities.detail ?? 'Image model removed.', installProgress: capabilities.installProgress }
  }
  async generate(prompt: string): Promise<string> { return generateImage(prompt, imageEndpoint()) }
}
export function localImageRuntime(): LocalImageRuntime { return getNativeAIHost()?.images ? new AppleLocalImageRuntime() : new WindowsWebUIImageRuntime() }
export async function generatePermittedImage(prompt: string): Promise<string> {
  if (!imageGenerationEnabled()) throw new Error('Local Image Generation is OFF. Turn it ON inside the Keep.')
  const runtime = localImageRuntime()
  const status = await runtime.status()
  if (!imageGenerationEnabled()) throw new Error('Local Image Generation was turned OFF.')
  if (status.state !== 'ready') throw new Error(status.detail)
  return runtime.generate(prompt)
}
