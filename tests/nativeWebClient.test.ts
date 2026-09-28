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
    provider: 'duckduckgo',
    searchAvailable: true,
    readAvailable: true,
    detail: 'Keyless web ready.',
  }

  searchCalls = 0
  readCalls = 0

  async status() {
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

test('native keyless Web Search and Web Read report available', async () => {
  const transport = new FakeNativeWebTransport()
  const client = new NativeWebClient(transport)

  assert.equal(await client.isSearchAvailable(), true)
  assert.equal(await client.isReadAvailable(), true)

  const page = await client.read('https://example.com/page')
  assert.equal(page.content, 'Readable public page content.')
  assert.equal(transport.readCalls, 1)
})

test('keyless search normalizes the outbound query and bounds result count', async () => {
  const transport = new FakeNativeWebTransport()
  const client = new NativeWebClient(transport)

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
