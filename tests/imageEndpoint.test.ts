import test from 'node:test'
import assert from 'node:assert/strict'
import { localGeneratorEndpoint } from '../src/images/imageTools.ts'

test('local image generation rejects remote services, credentials and misleading URLs', () => {
  assert.equal(localGeneratorEndpoint('http://127.0.0.1:7860/'), 'http://127.0.0.1:7860')
  assert.equal(localGeneratorEndpoint('http://localhost:7860'), 'http://localhost:7860')
  assert.equal(localGeneratorEndpoint('http://[::1]:7860'), 'http://[::1]:7860')
  for (const url of ['https://example.com', 'http://example.com', 'http://localhost.evil.com', 'http://localhost@evil.com', 'http://user:secret@localhost', 'http://localhost:7860/other', 'http://localhost:7860?key=x', 'http://localhost:7860#x']) assert.throws(() => localGeneratorEndpoint(url))
})
