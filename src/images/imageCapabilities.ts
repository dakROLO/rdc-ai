export interface ImageCapabilities {
  ocrAvailable: boolean
  understandingAvailable: boolean
  generationAvailable: boolean
  generationState: 'not-installed' | 'ready' | 'unavailable'
  detail?: string
}

/** Optional Core ML capability contract. The base app never downloads weights
 * or activates a non-local service as a consequence of selecting an image. */
export interface LocalImageModelManifest {
  id: string
  version: string
  license: string
  downloadUrl: string
  sha256: string
  sizeBytes: number
  minimumOS: string
  minimumMemoryBytes: number
  format: 'coreml-stable-diffusion'
}

export function imageCapabilities(status?: Partial<ImageCapabilities>): ImageCapabilities {
  return {
    ocrAvailable: status?.ocrAvailable === true,
    understandingAvailable: status?.understandingAvailable === true,
    generationAvailable: status?.generationAvailable === true && status?.generationState === 'ready',
    generationState: status?.generationState ?? 'not-installed',
    detail: status?.detail,
  }
}
