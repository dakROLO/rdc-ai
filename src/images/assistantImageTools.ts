import { localImageRuntime, imageGenerationEnabled, generatePermittedImage } from './LocalImageRuntime.ts'
import type { CrownKeepTool, ToolRegistry } from '../tools/ToolRegistry.ts'
import type { ImageAttachment } from '../domain/conversation.ts'
import { getNativeAIHost } from '../native/NativeAIHost.ts'
import { imageCapabilities } from './imageCapabilities.ts'
import { understandImage } from './imageTools.ts'

/** Attachment IDs are scoped to the current turn. The model cannot read a path
 * or arbitrary saved image and never passes pixels through a web tool. */
export function registerImageTools(registry: ToolRegistry, attachments: () => ImageAttachment[]) {
  const read: CrownKeepTool<{ imageId: string; question: string }> = {
    id: 'image.read', name: 'Read image', description: 'Analyze an attached image locally. Use only an image ID supplied in the current request.', requiresNetwork: false, access: 'read',
    inputSchema: { type: 'object', properties: { imageId: { type: 'string' }, question: { type: 'string' } }, required: ['imageId', 'question'], additionalProperties: false },
    isAvailable: async () => Boolean(attachments().length && imageCapabilities(await getNativeAIHost()?.images?.status()).understandingAvailable),
    execute: async ({ imageId, question }) => {
      const image = attachments().find((item) => item.id === imageId)
      if (!image) throw new Error('Image is not attached to this request.')
      return { text: await understandImage(image.dataUrl, question), metadata: { dataLeftDevice: false } }
    },
  }
  const generate: CrownKeepTool<{ prompt: string }> = {
    id: 'image.generate', name: 'Create image', description: 'Generate an image with the installed local capability. Requires the separate local image generation permission.', requiresNetwork: false, access: 'write',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string', maxLength: 2000 } }, required: ['prompt'], additionalProperties: false },
    isAvailable: async () => imageGenerationEnabled() && (await localImageRuntime().status()).state === 'ready',
    execute: async ({ prompt }) => ({ text: 'Image generated locally.', data: { dataUrl: await generatePermittedImage(prompt) }, metadata: { dataLeftDevice: false } }),
  }
  registry.register(read)
  registry.register(generate)
}
