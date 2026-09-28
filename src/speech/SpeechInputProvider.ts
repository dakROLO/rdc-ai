export interface SpeechCapability { available: boolean; detail: string }
export interface SpeechInputProvider {
  capability(): Promise<SpeechCapability>
  startCapture(): Promise<void>
  stopCapture(): Promise<void>
  transcribe(): Promise<string>
  cancel(): Promise<void>
}
export interface NativeSpeechBridge {
  capability(): Promise<SpeechCapability>
  startCapture(): Promise<void>
  stopCapture(): Promise<void>
  transcribe(): Promise<string>
  cancel(): Promise<void>
}
