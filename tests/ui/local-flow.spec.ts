import { test, expect } from '@playwright/test'

test('local conversation persists and unsupported dictation does not block chat', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start local dictation' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Message Anne' }).fill('Keep this local test message')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeHidden({ timeout: 15000 })
  await page.reload()
  await expect(page.getByText('Keep this local test message', { exact: true }).last()).toBeVisible()
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
