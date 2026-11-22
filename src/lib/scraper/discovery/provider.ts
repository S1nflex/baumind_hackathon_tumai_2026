import type { ShoppingItem } from '../../suppliers'

export type WebSearchResult = {
  title: string
  link: string
  snippet?: string
  source?: string
}

export interface SearchProvider {
  searchShopping(query: string): Promise<ShoppingItem[]>
  searchWeb(query: string): Promise<WebSearchResult[]>
}

type SerpApiResponse = {
  error?: string
  shopping_results?: ShoppingItem[]
  organic_results?: Array<{ title?: string; link?: string; snippet?: string; source?: string }>
}

export class SerpApiSearchProvider implements SearchProvider {
  private readonly apiKey: string

  constructor(apiKey = process.env.SERPAPI_API_KEY) {
    if (!apiKey?.trim()) throw new Error('SERPAPI_API_KEY is not configured')
    this.apiKey = apiKey.trim()
  }

  private async search(engine: 'google_shopping' | 'google', query: string): Promise<SerpApiResponse> {
    const url = new URL('https://serpapi.com/search.json')
    for (const [key, value] of Object.entries({
      engine,
      q: query,
      gl: 'de',
      hl: 'de',
      google_domain: 'google.de',
      api_key: this.apiKey,
    })) url.searchParams.set(key, value)
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (!response.ok) throw new Error(`SerpApi ${engine} search failed (HTTP ${response.status})`)
    const result = await response.json() as SerpApiResponse
    if (result.error) throw new Error(`SerpApi ${engine} search failed: ${result.error}`)
    return result
  }

  async searchShopping(query: string): Promise<ShoppingItem[]> {
    return (await this.search('google_shopping', query)).shopping_results ?? []
  }

  async searchWeb(query: string): Promise<WebSearchResult[]> {
    const results = (await this.search('google', query)).organic_results ?? []
    return results.flatMap(result => result.title && result.link
      ? [{ title: result.title, link: result.link, snippet: result.snippet, source: result.source }]
      : [])
  }
}
