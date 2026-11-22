import { extractUniversalProducts } from '../discovery/extractor'
import { fetchPublicResource } from '../discovery/safe-fetch'
import type { PriceSourceAdapter, PriceSourceRecord, RawScrapedItem } from '../types'

type ResourceFetcher = typeof fetchPublicResource

export class GenericHtmlJsonAdapter implements PriceSourceAdapter {
  readonly type = 'generic'

  constructor(private readonly fetchResource: ResourceFetcher = fetchPublicResource) {}

  async scrape(source: PriceSourceRecord): Promise<RawScrapedItem[]> {
    const response = await this.fetchResource(source.base_url, true)
    const contentType = response.contentType
    if (/json/i.test(contentType)) {
      let json: unknown
      try { json = JSON.parse(response.body) } catch { throw new Error(`Invalid JSON from ${source.base_url}`) }
      const items = this.fromJson(source, json, response.url)
      if (!items.length) throw this.noProductsError(source)
      return items
    }
    const items = extractUniversalProducts(response.body, response.url, source.name)
    if (!items.length) throw this.noProductsError(source)
    return items
  }

  private noProductsError(source: PriceSourceRecord) {
    return new Error(`No products found at ${source.base_url}. Provide a product feed, JSON-LD, OpenGraph, Microdata, or standard price/unit metadata; JavaScript rendering and link traversal are not supported.`)
  }

  private fromJson(source: PriceSourceRecord, json: unknown, baseUrl = source.base_url): RawScrapedItem[] {
    const root = json && typeof json === 'object' && !Array.isArray(json) ? json as Record<string, unknown> : null
    const nested = root && ['products', 'items', 'results', 'data'].map(key => root[key]).find(Array.isArray)
    const candidates = Array.isArray(json) ? json : Array.isArray(nested) ? nested : [json]
    return candidates.flatMap(candidate => {
      if (!candidate || typeof candidate !== 'object') return []
      const value = candidate as Record<string, unknown>
      const materialName = typeof value.name === 'string' ? value.name : typeof value.title === 'string' ? value.title : null
      if (!materialName) return []
      const netPrice = value.net_price ?? value.netPrice ?? value.price
      const grossPrice = value.gross_price ?? value.grossPrice
      const rawUrl = typeof value.product_url === 'string' ? value.product_url : typeof value.url === 'string' ? value.url : null
      let productUrl: string | null = null
      try { productUrl = rawUrl ? new URL(rawUrl, baseUrl).href : null } catch { productUrl = null }
      const shippingRaw = value.shipping_cost ?? value.shippingCost
      const packRaw = value.pack_size ?? value.packSize
      return [{
        sku: typeof value.sku === 'string' ? value.sku : null,
        materialName,
        netPrice: typeof netPrice === 'number' || typeof netPrice === 'string' ? netPrice : null,
        grossPrice: typeof grossPrice === 'number' || typeof grossPrice === 'string' ? grossPrice : null,
        shippingCost: typeof shippingRaw === 'number' || typeof shippingRaw === 'string' ? shippingRaw : null,
        currency: typeof value.currency === 'string' ? value.currency : undefined,
        unit: typeof value.unit === 'string' ? value.unit : null,
        packSize: typeof packRaw === 'number' || typeof packRaw === 'string' ? packRaw : null,
        category: typeof value.category === 'string' ? value.category : null,
        supplierName: typeof value.supplier_name === 'string' ? value.supplier_name : source.name,
        productUrl,
      } satisfies RawScrapedItem]
    })
  }
}
