import type { AIProvider } from './AIProvider.ts'

export class ProviderRegistry {
  private readonly providers = new Map<string, AIProvider>()

  constructor(providers: AIProvider[]) {
    for (const provider of providers) {
      this.register(provider)
    }
  }

  register(provider: AIProvider): void {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider "${provider.id}" is already registered.`)
    }

    this.providers.set(provider.id, provider)
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values())
  }

  get(id: string): AIProvider | undefined {
    return this.providers.get(id)
  }

  require(id: string): AIProvider {
    const provider = this.get(id)
    if (!provider) {
      throw new Error(`Provider "${id}" is not registered.`)
    }

    return provider
  }
}
