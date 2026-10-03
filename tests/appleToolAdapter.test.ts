import test from 'node:test'
import assert from 'node:assert/strict'
import { AppleFoundationModelsProvider } from '../src/providers/AppleFoundationModelsProvider.ts'
import type { NativeAIHost, NativeChatRequest } from '../src/native/NativeAIHost.ts'

test('Apple adapter forwards native local tools and scoped images without opening Web OFF', async () => {
  let actual: NativeChatRequest | undefined
  const host: NativeAIHost = {
    platform: 'ios', provider: 'apple-foundation-models',
    getAvailability: async () => ({ available: true }), listModels: async () => [],
    async streamChat(request, chunk, _error, complete) {
      actual = request; chunk({ text: 'Local result.' }); complete(); return { cancel() {} }
    },
  }
  const provider = new AppleFoundationModelsProvider(host)
  const tools = ['keep.search', 'image.read'].map((id) => ({ id, functionName: `crownkeep_${id.replace('.', '_')}`, description: 'Local tool', inputSchema: {} }))
  for await (const _chunk of provider.streamChat({ modelId: 'proof', messages: [{ role: 'user', content: 'Read the attached image.' }], tools, context: { images: [{ id: 'attachment', dataUrl: 'data:image/png;base64,synthetic' }] } })) { /* collect native call */ }
  assert.equal(actual?.webAccess, 'off')
  assert.deepEqual(actual?.tools?.map((item) => item.id), ['keep.search', 'image.read'])
  assert.deepEqual(actual?.images, [{ id: 'attachment', dataUrl: 'data:image/png;base64,synthetic' }])
})
