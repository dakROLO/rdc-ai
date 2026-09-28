import test from 'node:test'
import assert from 'node:assert/strict'
import {
  NativeWebClient,
  type NativeWebStatus,
  type NativeWebTransport,
} from '../src/web/NativeWebClient.ts'

class FakeNativeWebTransport implements NativeWebTransport {
  statusValue: NativeWebStatus = {
    nativeAvailable: true,
    provider: 'tavily',
    searchConfigured: false,
    readAvailable: true,
    credentialStore: 'Test secure store',
    detail: 'Direct read ready; search key missing.',
  }

  searchCalls = 0
  readCalls = 0
  savedCredential?: string

  async status() {
    return this.statusValue
  }

  async saveSearchCredential(apiKey: string) {
    this.savedCredential = apiKey
    this.statusValue = {
      ...this.statusValue,
      searchConfigured: true,
      detail: 'Search configured.',
    }
    return this.statusValue
  }

  async clearSearchCredential() {
    this.savedCredential = undefined
    this.statusValue = {
      ...this.statusValue,
      searchConfigured: false,
      detail: 'Search credential removed.',
    }
    return this.statusValue
  }

  async search(query: string, maxResults: number) {
    this.searchCalls += 1
    return {
      results: [
        {
          title: 'Current result',
          url: 'https://example.com/current',
          snippet: `${query} / ${maxResults}`,
        },
      ],
    }
  }

  async read(url: string) {
    this.readCalls += 1
    return {
      url,
      title: 'Example',
      content: 'Readable public page content.',
    }
  }
}

test('native Web Read can be available without a search credential', async () => {
  const transport = new FakeNativeWebTransport()
  const client = new NativeWebClient(transport)

  assert.equal(await client.isSearchConfigured(), false)
  assert.equal(await client.isReadConfigured(), true)

  const page = await client.read('https://example.com/page')
  assert.equal(page.content, 'Readable public page content.')
  assert.equal(transport.readCalls, 1)
  assert.equal(transport.searchCalls, 0)
})

test('search credential is handed only to the native transport and status exposes no secret', async () => {
  const transport = new FakeNativeWebTransport()
  const client = new NativeWebClient(transport)

  const status = await client.saveSearchCredential('  private-test-key  ')
  assert.equal(transport.savedCredential, 'private-test-key')
  assert.equal(status.searchConfigured, true)
  assert.equal(JSON.stringify(status).includes('private-test-key'), false)

  const result = await client.search('  current   release  ', 99)
  assert.equal(transport.searchCalls, 1)
  assert.equal(result.results[0]?.snippet, 'current release / 8')
})

test('native Web Read rejects non-http URLs before the native transport is invoked', async () => {
  const transport = new FakeNativeWebTransport()
  const client = new NativeWebClient(transport)

  await assert.rejects(
    client.read('file:///private/secret.txt'),
    /only supports http\(s\) URLs/,
  )
  assert.equal(transport.readCalls, 0)
})
