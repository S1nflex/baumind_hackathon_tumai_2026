import * as cheerio from 'cheerio'
import type { AnyNode } from 'domhandler'
import type { PriceSourceAdapter, PriceSourceRecord, RawScrapedItem } from '../types'

type JsonLdProduct = {
  '@type'?: string | string[]
  name?: string
  sku?: string
  url?: string
  category?: string
  offers?: {
    price?: number | string
    priceCurrency?: string
  } | Array<{ price?: number | string; priceCurrency?: string }>
}

export class GenericHtmlJsonAdapter implements PriceSourceAdapter {
  readonly type = 'generic'

  async scrape(source: PriceSourceRecord): Promise<RawScrapedItem[]> {
    const response = await fetch(source.base_url, { headers: { 'User-Agent': 'BautonMarketIngestion/1.0' },
      signal: AbortSignal.timeout(15000), cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${source.base_url}`)
    const contentType = response.headers.get('content-type') ?? ''
    if (/json/i.test(contentType)) {
      const json = await response.json()
      return this.fromJson(source, json)
    }
    return this.fromHtml(source, await response.text())
  }

  private fromJson(source: PriceSourceRecord, json: unknown): RawScrapedItem[] {
    const candidates = Array.isArray(json) ? json : [json]
    return candidates.flatMap(candidate => {
      if (!candidate || typeof candidate !== 'object') return []
      const value = candidate as Record<string, unknown>
      const name = typeof value.name === 'string' ? value.name : typeof value.title === 'string' ? value.title : null
      if (!name) return []
      const net = value.net_price ?? value.netPrice ?? value.price
      const gross = value.gross_price ?? value.grossPrice
      const url = typeof value.product_url === 'string' ? value.product_url : typeof value.url === 'string' ? value.url : null
      const shippingRaw = value.shipping_cost ?? value.shippingCost
      const shippingCost = typeof shippingRaw === 'number' || typeof shippingRaw === 'string' ? shippingRaw : null
      const packRaw = value.pack_size ?? value.packSize
      const packSize = typeof packRaw === 'number' || typeof packRaw === 'string' ? packRaw : null
      return [{
        sku: typeof value.sku === 'string' ? value.sku : null,
        materialName: name,
        netPrice: typeof net === 'number' || typeof net === 'string' ? net : null,
        grossPrice: typeof gross === 'number' || typeof gross === 'string' ? gross : null,
        shippingCost,
        currency: typeof value.currency === 'string' ? value.currency : 'EUR',
        unit: typeof value.unit === 'string' ? value.unit : null,
        packSize,
        category: typeof value.category === 'string' ? value.category : null,
        supplierName: typeof value.supplier_name === 'string' ? value.supplier_name : source.name,
        productUrl: url,
      } satisfies RawScrapedItem]
    })
  }

  private fromHtml(source: PriceSourceRecord, html: string): RawScrapedItem[] {
    const $ = cheerio.load(html)
    const products: RawScrapedItem[] = []
    $('script[type="application/ld+json"]').each((_index, element) => {
      try {
        const parsed = JSON.parse($(element).text()) as JsonLdProduct | { '@graph': JsonLdProduct[] }
        const nodes = '@graph' in parsed ? parsed['@graph'] : [parsed]
        for (const node of nodes) {
          const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']]
          if (!types.includes('Product') || !node.name) continue
          const offers = Array.isArray(node.offers) ? node.offers : node.offers ? [node.offers] : []
          for (const offer of offers) {
            if (offer.price === undefined) continue
            products.push({
              sku: node.sku ?? null,
              materialName: node.name,
              grossPrice: offer.price,
              currency: offer.priceCurrency ?? 'EUR',
              category: node.category ?? null,
              supplierName: source.name,
              productUrl: node.url ?? source.base_url,
            })
          }
        }
      } catch {
        // Ignore malformed structured data blocks and continue with HTML fallbacks.
      }
    })

    $('[itemtype*="Product"], article.product, .product-item').each((_index, element: AnyNode) => {
      const $element = $(element)
      const name = $element.find('[itemprop="name"], .product-title, h2, h3').first().text().trim()
      const priceText = $element.find('[itemprop="price"], .price, [class*="price"]').first().text().trim()
      const link = $element.find('a[href]').first().attr('href')
      if (!name || !priceText) return
      let productUrl: string | null = null
      try { productUrl = link ? new URL(link, source.base_url).href : null } catch { productUrl = null }
      products.push({
        materialName: name,
        grossPrice: priceText,
        currency: 'EUR',
        supplierName: source.name,
        productUrl,
      })
    })

    return products.filter((item, index, all) =>
      all.findIndex(other => other.materialName === item.materialName && other.productUrl === item.productUrl) === index)
  }
}
