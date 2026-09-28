import test from 'node:test'
import assert from 'node:assert/strict'
import { activeChatAlias, activeSpeechVariant } from '../src/speech/systemFoundrySpeech.ts'

const models = [
  { id: 'balanced-gpu:2', alias: 'qwen3-8b', displayName: '', cached: true, loaded: true, modelType: 'Chat' },
  { id: 'whisper-base-gpu:1', alias: 'whisper-base', displayName: '', cached: true, loaded: true, modelType: 'Speech', device: 'GPU', executionProvider: 'CUDAExecutionProvider' },
]
test('dictation captures the active Chat alias rather than saved Quick preference', () => assert.equal(activeChatAlias(models), 'qwen3-8b'))
test('Voice alias resolves to its actual loaded Speech variant', () => assert.equal(activeSpeechVariant(models, 'whisper-base')?.id, 'whisper-base-gpu:1'))
