import { parseShoppingResults, type ShoppingItem } from '../../suppliers'
import type { PriceSourceAdapter, PriceSourceRecord, RawScrapedItem } from '../types'

export class SerpApiAdapter implements PriceSourceAdapter {
  readonly type = 'serpapi'

  async scrape(source: PriceSourceRecord): Promise<RawScrapedItem[]> {
    const apiKey = process.env.SERPAPI_API_KEY
    if (!apiKey) throw new Error('SERPAPI_API_KEY is not configured')
    const url = new URL('https://serpapi.com/search.json')
    for (const [key, value] of Object.entries({
      engine: 'google_shopping',
      q: source.name,
      gl: 'de',
      hl: 'de',
      google_domain: 'google.de',
      api_key: apiKey,
    })) url.searchParams.set(key, value)
    const response = await fetch(url, { signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (!response.ok) throw new Error(`SerpApi HTTP ${response.status}`)
    const data = await response.json() as { shopping_results?: ShoppingItem[] }
    const items = parseShoppingResults(data.shopping_results ?? [], source.name, new Date().toISOString())
    return items.map(item => ({
      sku: null,
      materialName: item.title,
      netPrice: item.net,
      grossPrice: null,
      shippingCost: item.delivery,
      currency: 'EUR',
      packSize: item.pack,
      supplierName: item.merchant,
      productUrl: item.url ?? null,
    }))
  }
}
