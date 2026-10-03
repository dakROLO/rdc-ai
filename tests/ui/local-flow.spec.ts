import { test, expect } from '@playwright/test'

test('local conversation persists and unsupported dictation does not block chat', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start local dictation' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Message Anne' }).fill('Keep this local test message')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden({ timeout: 15000 })

  await page.getByRole('button', { name: '↻ Rerun' }).first().click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden({ timeout: 15000 })
  const repeatedUserMessages = page.locator('.message.user').filter({
    hasText: 'Keep this local test message',
  })
  await expect(repeatedUserMessages).toHaveCount(2)

  await page.reload()
  await expect(
    page.locator('.message.user').filter({
      hasText: 'Keep this local test message',
    }),
  ).toHaveCount(2)
})

test('native dictation requires review, preserves drafts on cancellation, and fits mobile', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { crownKeepNativeAI: {
      platform: 'ios', provider: 'apple-foundation-models',
      getAvailability: async () => ({ available: true }),
      listModels: async () => [{ id: 'apple-test', displayName: 'Apple Test' }],
      streamChat: async () => ({ cancel() {} }),
      speech: {
        capability: async () => ({ available: true, detail: 'Local test speech' }),
        startCapture: async () => {}, stopCapture: async () => {}, cancel: async () => {},
        transcribe: async () => { await new Promise((r) => setTimeout(r, 500)); return 'Dictated text' },
      },
    } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const draft = page.getByRole('textbox', { name: 'Message Anne' })
  const mic = page.getByRole('button', { name: 'Start local dictation' })
  const stop = page.getByRole('button', { name: 'Stop dictation and transcribe' })
  await draft.fill('Draft')
  await mic.click()
  await expect(stop).toBeVisible()
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await stop.click()
  await expect(draft).toHaveValue('Draft Dictated text')
  await mic.click(); await expect(stop).toBeVisible(); await stop.click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(mic).toBeEnabled()
  await expect(draft).toHaveValue('Draft Dictated text')
  await expect(page.getByText('Local Model Analyst', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('iOS web evidence is supplied to the request, retained after reload, and inspectable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { crownKeepNativeAI: {
      platform: 'ios', provider: 'apple-foundation-models',
      getAvailability: async () => ({ available: true }),
      listModels: async () => [{ id: 'apple-test', displayName: 'Apple Test' }],
      web: {
        getStatus: async () => ({ nativeAvailable: true, provider: 'duckduckgo', searchAvailable: true, readAvailable: true, detail: 'Test transport' }),
        search: async () => ({ results: [{ title: 'Verified synthetic source', url: 'https://example.com/source', snippet: 'Synthetic current fact: lighthouse code 725.' }] }),
        read: async () => ({ url: 'https://example.com/source', content: 'Synthetic current fact: lighthouse code 725.' }),
      },
      streamChat: async (request: { messages: { content: string }[] }, onChunk: (chunk: { text: string }) => void, _onError: unknown, onComplete: () => void) => {
        const grounded = request.messages.some((item) => item.content.includes('lighthouse code 725'))
        onChunk({ text: grounded ? 'Grounded: lighthouse code 725.' : 'No source evidence.' })
        onComplete()
        return { cancel() {} }
      },
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: /Web Access OFF/ }).click()
  await page.getByRole('textbox', { name: 'Message Anne' }).fill('Search the web for current lighthouse codes')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Grounded: lighthouse code 725.', { exact: true })).toBeVisible()
  await page.locator('details.local-ai-menu > summary').click()
  await page.getByRole('button', { name: 'System Prompt / Prompt & Context' }).click()
  const inspector = page.getByRole('dialog', { name: 'Prompt and context' })
  await expect(inspector).toContainText('lighthouse code 725')
  await inspector.getByRole('button', { name: 'Close' }).click()
  await page.locator('.local-ai-close-button').click()
  await page.getByRole('textbox', { name: 'Message Anne' }).fill('Look it up online')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Review web query' })).toHaveCount(0)
  await expect(page.getByText('Grounded: lighthouse code 725.', { exact: true })).toHaveCount(2)
  await page.reload()
  await page.getByRole('button', { name: /Web Access ON/ }).click()
  await page.getByRole('textbox', { name: 'Message Anne' }).fill('What did that source say?')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Grounded: lighthouse code 725.', { exact: true })).toHaveCount(3)
})

test('image text requires review, is persisted with its image, and is not uploaded', async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { crownKeepNativeAI: {
      platform: 'ios', provider: 'apple-foundation-models',
      getAvailability: async () => ({ available: true }),
      listModels: async () => [{ id: 'apple-test', displayName: 'Apple Test' }],
      images: {
        status: async () => ({ ocrAvailable: true, generationAvailable: true }),
        recognize: async () => 'Meeting at 0900',
        generate: async () => { throw new Error('Not used in this test') },
      },
      streamChat: async (request: { messages: { content: string }[] }, onChunk: (chunk: { text: string }) => void, _onError: unknown, onComplete: () => void) => {
        onChunk({ text: request.messages.some((item) => item.content.includes('Meeting at 1000')) ? 'Reviewed image text received.' : 'No image text.' })
        onComplete(); return { cancel() {} }
      },
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Attach or create image' }).click()
  const dialog = page.getByRole('dialog', { name: 'Images' })
  const data = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAwAAAAMCAIAAADZF8uwAAAAF0lEQVR4nGP8//8/AyHARFDFqKIBUAQAP6kDFQZDzEYAAAAASUVORK5CYII=', 'base64')
  await dialog.getByLabel('Choose image').setInputFiles({ name: 'meeting.png', mimeType: 'image/png', buffer: data })
  await expect(dialog.getByLabel('Extracted text (editable)')).toHaveValue('Meeting at 0900')
  await dialog.getByLabel('Extracted text (editable)').fill('Meeting at 1000')
  await dialog.getByRole('button', { name: 'Add to message' }).click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Reviewed image text received.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.locator('.message-image')).toHaveCount(1)
  await expect(page.locator('.message.user')).toContainText('Meeting at 1000')
})


test('browser OCR reads bundled English assets without contacting a CDN', async ({ page }) => {
  const remote: string[] = []
  await page.route('https://**', async (route) => { remote.push(route.request().url()); await route.abort() })
  await page.goto('/')
  await page.getByRole('button', { name: 'Attach or create image' }).click()
  const dialog = page.getByRole('dialog', { name: 'Images' })
  await dialog.getByLabel('Choose image').setInputFiles('tests/ui/fixtures/ocr-meeting.png')
  await expect(dialog.getByLabel('Extracted text (editable)')).toHaveValue(/Meeting at 0900/, { timeout: 20000 })
  expect(remote).toEqual([])
})


test('assistant settings expose modes and inspector; technical details stay in Diagnostics', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  const image = page.getByRole('button', { name: 'Attach or create image' })
  await expect(page.locator('.composer-actions').getByRole('button', { name: 'Attach or create image' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Images', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'System Prompt / Prompt & Context' })).toBeHidden()
  await page.locator('details.local-ai-menu > summary').click()
  await expect(page.getByRole('group', { name: 'Model mode' })).toBeVisible()
  for (const role of ['Auto', 'Quick', 'Balanced', 'Deep']) await expect(page.getByRole('button', { name: role, exact: true })).toBeVisible()
  await expect(page.locator('.provider-selectors')).toHaveCount(0)
  await expect(page.getByText('Search provider · DuckDuckGo')).toHaveCount(0)
  await expect(page.locator('.runtime-grid')).toBeHidden()
  await page.getByRole('button', { name: 'System Prompt / Prompt & Context' }).click()
  await expect(page.getByRole('dialog', { name: 'Prompt and context' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.locator('.diagnostics-disclosure > summary').click()
  await expect(page.locator('.runtime-grid')).toBeVisible()
  await page.locator('.local-ai-close-button').click()
  await image.click()
  await expect(page.getByRole('dialog', { name: 'Images' })).not.toContainText('Image Playground')
})

test('native image understanding is separate from OCR and optional generation stays unavailable', async ({ page }) => {
  const remote: string[] = []
  await page.route('https://**', async (route) => { remote.push(route.request().url()); await route.abort() })
  await page.addInitScript(() => {
    Object.assign(window, { crownKeepNativeAI: {
      platform: 'ios', provider: 'apple-foundation-models',
      getAvailability: async () => ({ available: true }),
      listModels: async () => [{ id: 'apple-test', displayName: 'Apple Test' }],
      images: {
        status: async () => ({ ocrAvailable: true, understandingAvailable: true, generationAvailable: false, generationState: 'not-installed' }),
        recognize: async () => 'Exact OCR text',
        understand: async (dataUrl: string, question: string) => {
          if (!dataUrl.startsWith('data:image/jpeg;base64,') || question !== 'Describe this image.') throw new Error('Invalid local image request')
          return 'A synthetic square scene.'
        },
        generate: async () => { throw new Error('Generation is not installed') },
      },
      streamChat: async (request: { messages: { content: string }[] }, onChunk: (chunk: { text: string }) => void, _onError: unknown, onComplete: () => void) => {
        onChunk({ text: request.messages.some((item) => item.content.includes('A synthetic square scene.')) ? 'Local image analysis received.' : 'Missing analysis.' })
        onComplete(); return { cancel() {} }
      },
    } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Attach or create image' }).click()
  const dialog = page.getByRole('dialog', { name: 'Images' })
  await dialog.getByLabel('Choose image').setInputFiles('tests/ui/fixtures/ocr-meeting.png')
  await expect(dialog.getByLabel('Extracted text (editable)')).toHaveValue('Exact OCR text')
  await dialog.getByRole('button', { name: 'Understand image' }).click()
  await expect(dialog.getByText('A synthetic square scene.', { exact: true })).toBeVisible()
  await dialog.getByLabel('Image prompt').fill('Generate a landscape')
  await expect(dialog.getByRole('button', { name: 'Generate image' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Add to message' }).click()
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByText('Local image analysis received.', { exact: true })).toBeVisible()
  expect(remote).toEqual([])
})


test('local decision and image switches persist; Auto remains safe with unavailable engine', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', {name:'Auto',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.locator('details.local-ai-menu > summary').click()
  const decision=page.locator('.web-access-setting').filter({hasText:'Decision Assist'})
  const images=page.locator('.web-access-setting').filter({hasText:'Local Image Generation'})
  await decision.getByRole('button').click(); await images.getByRole('button').click()
  await page.reload();await page.locator('details.local-ai-menu > summary').click()
  await expect(decision.getByRole('button')).toHaveAttribute('aria-pressed','true')
  await expect(images.getByRole('button')).toHaveAttribute('aria-pressed','true')
  await page.locator('.diagnostics-disclosure > summary').click()
  await expect(page.getByText(/No qualified native Julia runtime is installed/)).toBeVisible()
  await page.getByRole('button',{name:'Quick',exact:true}).click()
  await expect(page.getByRole('button',{name:'Quick',exact:true})).toHaveAttribute('aria-pressed','true')
})
