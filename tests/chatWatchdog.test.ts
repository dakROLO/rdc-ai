import test from 'node:test'
import assert from 'node:assert/strict'
import { chatWatchdogForRole } from '../src/runtime/chatWatchdog.ts'

test('Balanced gets more first-token time than Quick', () => {
  const quick = chatWatchdogForRole('Quick')
  const balanced = chatWatchdogForRole('Balanced')

  assert.equal(quick.firstTokenMs, 20_000)
  assert.equal(quick.totalMs, 120_000)
  assert.equal(balanced.firstTokenMs, 90_000)
  assert.equal(balanced.totalMs, 240_000)
  assert.ok(balanced.firstTokenMs > quick.firstTokenMs)
})

test('Deep watchdog is permissive without changing model qualification', () => {
  const deep = chatWatchdogForRole('Deep')
  assert.equal(deep.firstTokenMs, 60_000)
  assert.equal(deep.totalMs, 240_000)
})
