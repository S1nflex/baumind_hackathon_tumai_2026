import { extractUniversalProducts } from '../discovery/extractor'
import type { PriceSourceAdapter, PriceSourceRecord, RawScrapedItem } from '../types'

export class GenericHtmlJsonAdapter implements PriceSourceAdapter {
  readonly type = 'generic'

  async scrape(source: PriceSourceRecord): Promise<RawScrapedItem[]> {
    const response = await fetch(source.base_url, {
      headers: { 'User-Agent': 'BautonMarketIngestion/1.0' },
      signal: AbortSignal.timeout(15000),
      cache: 'no-store',
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${source.base_url}`)
    const contentType = response.headers.get('content-type') ?? ''
    if (/json/i.test(contentType)) {
      const items = this.fromJson(source, await response.json())
      if (!items.length) throw this.noProductsError(source)
      return items
    }
    if (!/html/i.test(contentType)) throw new Error(`Unsupported content type at ${source.base_url}: ${contentType || 'missing'}`)
    const items = extractUniversalProducts(await response.text(), source.base_url, source.name)
    if (!items.length) throw this.noProductsError(source)
    return items
  }

  private noProductsError(source: PriceSourceRecord) {
    return new Error(`No products found at ${source.base_url}. Provide a product feed, JSON-LD, OpenGraph, Microdata, or standard price/unit metadata; JavaScript rendering and link traversal are not supported.`)
  }

  private fromJson(source: PriceSourceRecord, json: unknown): RawScrapedItem[] {
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
      try { productUrl = rawUrl ? new URL(rawUrl, source.base_url).href : null } catch { productUrl = null }
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
